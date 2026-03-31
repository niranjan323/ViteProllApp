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
exports.default = electron_1.app;
