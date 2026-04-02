"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
const child_process_1 = require("child_process");
const isDev = !electron_1.app.isPackaged;
// ─── ABS License Check ───────────────────────────────────────────────────────
const PRODUCT_NAME = 'PLRAPP10UAT';
const MAJOR_VER = 1;
const MINOR_VER = 0;
function checkLicense() {
    // Skip license check in dev mode
    if (isDev)
        return true;
    const appDir = path.dirname(electron_1.app.getPath('exe'));
    const licExe = path.join(appDir, 'LicChkSrcEXE.exe');
    const licDll1 = path.join(appDir, 'ABS.Licensing.dll');
    const licDll2 = path.join(appDir, 'abs.licensing.core.dll');
    // Verify required files are present
    for (const f of [licExe, licDll1, licDll2]) {
        if (!fs.existsSync(f)) {
            electron_1.dialog.showErrorBox('License Error', `Required licensing file not found:\n${f}\n\nPlease contact your system administrator.`);
            return false;
        }
    }
    // Run license check: LicChkSrcEXE.exe <product> <major>.<minor> "<appPath>"
    const result = (0, child_process_1.spawnSync)(licExe, [`${PRODUCT_NAME}`, `${MAJOR_VER}.${MINOR_VER}`, appDir], { encoding: 'utf-8', timeout: 15000 });
    if (result.status !== 0) {
        electron_1.dialog.showErrorBox('License Validation Failed', 'This software is not licensed for use on this machine.\n\nPlease contact your ABS representative to obtain a valid license.');
        return false;
    }
    return true;
}
// ─────────────────────────────────────────────────────────────────────────────
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        title: 'PRoll Diagram App',
        width: 1600,
        height: 900,
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
        icon: path.join(__dirname, '../public/icon.ico'),
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.on('ready', () => {
    if (!checkLicense()) {
        electron_1.app.quit();
        return;
    }
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// Window control handlers
electron_1.ipcMain.on('window-minimize', () => mainWindow?.minimize());
electron_1.ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized())
        mainWindow.unmaximize();
    else
        mainWindow?.maximize();
});
electron_1.ipcMain.on('window-close', () => mainWindow?.close());
// IPC Handlers
/**
 * Select a folder for polar data
 */
electron_1.ipcMain.handle('select-folder', async () => {
    if (!mainWindow)
        return { success: false, error: 'Window not ready' };
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Polar Data Folder',
    });
    if (result.canceled) {
        return { success: false, canceled: true };
    }
    return {
        success: true,
        folderPath: result.filePaths[0],
    };
});
/**
 * Select a control file (typically proll.ctl or proll.cfg)
 */
electron_1.ipcMain.handle('select-control-file', async (_, startPath) => {
    if (!mainWindow)
        return { success: false, error: 'Window not ready' };
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select Control File',
        defaultPath: startPath,
        filters: [
            { name: 'Control Files', extensions: ['ctl', 'cfg'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });
    if (result.canceled) {
        return { success: false, canceled: true };
    }
    return {
        success: true,
        filePath: result.filePaths[0],
    };
});
/**
 * Read a file from the selected folder
 */
electron_1.ipcMain.handle('read-file', async (_, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return {
            success: true,
            data: Buffer.from(data).toString('base64'),
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to read file: ${error.message}`,
        };
    }
});
/**
 * Read a text file from the selected folder
 */
electron_1.ipcMain.handle('read-text-file', async (_, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return {
            success: true,
            data,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to read file: ${error.message}`,
        };
    }
});
/**
 * List files in a directory
 */
electron_1.ipcMain.handle('list-directory', async (_, dirPath) => {
    try {
        const files = fs.readdirSync(dirPath);
        return {
            success: true,
            files,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to list directory: ${error.message}`,
        };
    }
});
/**
 * Check if a file exists
 */
electron_1.ipcMain.handle('file-exists', async (_, filePath) => {
    try {
        const exists = fs.existsSync(filePath);
        return {
            success: true,
            exists,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to check file: ${error.message}`,
        };
    }
});
/**
 * Check if a directory exists
 */
electron_1.ipcMain.handle('directory-exists', async (_, dirPath) => {
    try {
        const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        return {
            success: true,
            exists,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to check directory: ${error.message}`,
        };
    }
});
/**
 * Get file stats
 */
electron_1.ipcMain.handle('get-file-stats', async (_, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            success: true,
            stats: {
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                size: stats.size,
                mtime: stats.mtimeMs,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to get stats: ${error.message}`,
        };
    }
});
/**
 * Open a URL or file with the default application
 */
electron_1.ipcMain.handle('open-url', async (_, url) => {
    try {
        // If it's a relative path, resolve it to the app's public folder
        let targetPath = url;
        if (url.startsWith('/')) {
            if (isDev) {
                targetPath = path.join(__dirname, '../public', url.slice(1));
            }
            else {
                targetPath = path.join(__dirname, '../dist', url.slice(1));
            }
        }
        await electron_1.shell.openPath(targetPath);
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to open URL: ${error.message}`,
        };
    }
});
/**
 * Open a PDF in a new independent Electron window
 */
electron_1.ipcMain.handle('open-pdf-window', async (_, pdfPath) => {
    try {
        // Resolve the PDF path
        let filePath = pdfPath;
        if (pdfPath.startsWith('/')) {
            if (isDev) {
                filePath = path.join(__dirname, '../public', pdfPath.slice(1));
            }
            else {
                filePath = path.join(__dirname, '../dist', pdfPath.slice(1));
            }
        }
        // Create a new independent BrowserWindow for the PDF
        const pdfWindow = new electron_1.BrowserWindow({
            title: 'PRoll Diagram User Guide',
            width: 1000,
            height: 800,
            minWidth: 600,
            minHeight: 400,
            webPreferences: {
                preload: undefined, // No preload for PDF window
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
            },
        });
        // Load the PDF file using file:// protocol
        const fileUrl = `file://${filePath}`;
        await pdfWindow.loadURL(fileUrl);
        // Window is independent, so we don't track it
        pdfWindow.on('closed', () => {
            // Window cleanup happens automatically
        });
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to open PDF window: ${error.message}`,
        };
    }
});
// ─── LICENSING SYSTEM ───────────────────────────────────────────────────────
// Import licensing services
const licenseManager_1 = require("./services/licenseManager.cjs");
const emailService_1 = require("./services/emailService.cjs");
const machineIdentifier_1 = require("./services/machineIdentifier.cjs");
// Shared secret for license signing (in production, use environment variables)
const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET || 'default-secret-key-change-in-production';
/**
 * IPC: Generate a new license request
 */
electron_1.ipcMain.handle('license:generate-request', async (_, contactEmail, organizationName) => {
    try {
        const { xmlContent, filePath } = (0, licenseManager_1.generateLicenseRequest)(contactEmail, organizationName);
        return {
            success: true,
            xmlContent,
            filePath,
            machineId: (0, machineIdentifier_1.generateMachineId)(),
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to generate license request: ${error.message}`,
        };
    }
});
/**
 * IPC: Get machine information (for user reference)
 */
electron_1.ipcMain.handle('license:get-machine-info', async () => {
    try {
        const info = (0, machineIdentifier_1.getMachineInfo)();
        return {
            success: true,
            machineId: info.machineId,
            hostname: info.hostname,
            platform: info.platform,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to get machine info: ${error.message}`,
        };
    }
});
/**
 * IPC: Get license status
 */
electron_1.ipcMain.handle('license:get-status', async () => {
    try {
        const info = (0, licenseManager_1.getLicenseInfo)();
        return {
            success: true,
            installed: info.installed,
            expiresIn: info.expiresIn,
            machineId: info.machineId,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to get license status: ${error.message}`,
        };
    }
});
/**
 * IPC: Validate current license
 */
electron_1.ipcMain.handle('license:validate', async () => {
    try {
        const result = (0, licenseManager_1.validateLicense)(LICENSE_SECRET_KEY);
        return {
            success: result.valid,
            valid: result.valid,
            reason: result.reason,
            expiresIn: result.expiresIn,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to validate license: ${error.message}`,
        };
    }
});
/**
 * IPC: Install a license file
 * Expects base64-encoded license file content
 */
electron_1.ipcMain.handle('license:install', async (_, licenseContent) => {
    try {
        // Parse the license data (expecting JSON)
        const licenseData = JSON.parse(Buffer.from(licenseContent, 'base64').toString('utf-8'));
        // Validate the license before saving
        if (!licenseData.licenseKey || !licenseData.machineId) {
            return {
                success: false,
                error: 'Invalid license file format',
            };
        }
        // Save to disk
        const saved = (0, licenseManager_1.saveLicense)(licenseData);
        if (!saved) {
            return {
                success: false,
                error: 'Failed to save license file',
            };
        }
        // Validate the newly installed license
        const validation = (0, licenseManager_1.validateLicense)(LICENSE_SECRET_KEY, licenseData);
        if (!validation.valid) {
            (0, licenseManager_1.removeLicense)();
            return {
                success: false,
                error: `License validation failed: ${validation.reason}`,
            };
        }
        return {
            success: true,
            message: 'License installed successfully',
            expiresIn: validation.expiresIn,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to install license: ${error.message}`,
        };
    }
});
/**
 * IPC: Remove the current license
 */
electron_1.ipcMain.handle('license:remove', async () => {
    try {
        const removed = (0, licenseManager_1.removeLicense)();
        return {
            success: removed,
            message: removed ? 'License removed' : 'No license to remove',
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to remove license: ${error.message}`,
        };
    }
});
/**
 * IPC: Open license request in email client
 */
electron_1.ipcMain.handle('license:open-email', async (_, recipient) => {
    try {
        const requestPath = (0, licenseManager_1.getLicenseRequestPath)();
        if (!requestPath) {
            return {
                success: false,
                error: 'No license request found. Please generate one first.',
            };
        }
        const emailOpened = await (0, emailService_1.openEmailClientWithLicense)(requestPath, recipient);
        if (!emailOpened) {
            return {
                success: false,
                error: 'Failed to open email client',
            };
        }
        return {
            success: true,
            message: 'Email client opened. Please attach the license request file.',
            requestPath,
            // Also return the template text for manual entry
            emailTemplate: (0, emailService_1.getEmailTemplate)(requestPath),
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to open email: ${error.message}`,
        };
    }
});
/**
 * IPC: Open license request folder in Windows Explorer
 */
electron_1.ipcMain.handle('license:open-folder', async (_, folderPath) => {
    try {
        const path_module = require('path');
        const { app } = require('electron');
        const requestDir = folderPath || path_module.join(app.getPath('userData'), 'license-requests');
        const folderOpened = await (0, emailService_1.openLicenseRequestFolder)(requestDir);
        if (!folderOpened) {
            return {
                success: false,
                error: 'Failed to open folder',
            };
        }
        return {
            success: true,
            message: 'License request folder opened',
            folderPath: requestDir,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to open folder: ${error.message}`,
        };
    }
});
/**
 * IPC: Get license history (for debugging)
 */
electron_1.ipcMain.handle('license:get-history', async () => {
    try {
        const history = (0, licenseManager_1.getLicenseHistory)();
        return {
            success: true,
            ...history,
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to get history: ${error.message}`,
        };
    }
});
/**
 * IPC: Select and upload a license file
 */
electron_1.ipcMain.handle('license:select-file', async () => {
    if (!mainWindow)
        return { success: false, error: 'Window not ready' };
    try {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            title: 'Select License File',
            filters: [
                { name: 'License Files', extensions: ['json', 'lic', 'xml'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (result.canceled) {
            return { success: false, canceled: true };
        }
        const filePath = result.filePaths[0];
        const licenseContent = fs.readFileSync(filePath, 'utf-8');
        const base64Content = Buffer.from(licenseContent).toString('base64');
        return {
            success: true,
            base64Content,
            fileName: path.basename(filePath),
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to read license file: ${error.message}`,
        };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
exports.default = electron_1.app;
