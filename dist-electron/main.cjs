"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = !electron_1.app.isPackaged;
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
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startUrl);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.on('ready', createWindow);
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
exports.default = electron_1.app;
