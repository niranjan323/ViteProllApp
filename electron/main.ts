import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
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

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

/**
 * Select a folder for polar data
 */
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return { success: false, error: 'Window not ready' };

  const result = await dialog.showOpenDialog(mainWindow, {
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
ipcMain.handle('select-control-file', async (_, startPath?: string) => {
  if (!mainWindow) return { success: false, error: 'Window not ready' };

  const result = await dialog.showOpenDialog(mainWindow, {
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
ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath);
    return {
      success: true,
      data: Buffer.from(data).toString('base64'),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${(error as Error).message}`,
    };
  }
});

/**
 * Read a text file from the selected folder
 */
ipcMain.handle('read-text-file', async (_, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${(error as Error).message}`,
    };
  }
});

/**
 * List files in a directory
 */
ipcMain.handle('list-directory', async (_, dirPath: string) => {
  try {
    const files = fs.readdirSync(dirPath);
    return {
      success: true,
      files,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${(error as Error).message}`,
    };
  }
});

/**
 * Check if a file exists
 */
ipcMain.handle('file-exists', async (_, filePath: string) => {
  try {
    const exists = fs.existsSync(filePath);
    return {
      success: true,
      exists,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to check file: ${(error as Error).message}`,
    };
  }
});

/**
 * Check if a directory exists
 */
ipcMain.handle('directory-exists', async (_, dirPath: string) => {
  try {
    const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    return {
      success: true,
      exists,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to check directory: ${(error as Error).message}`,
    };
  }
});

/**
 * Get file stats
 */
ipcMain.handle('get-file-stats', async (_, filePath: string) => {
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
  } catch (error) {
    return {
      success: false,
      error: `Failed to get stats: ${(error as Error).message}`,
    };
  }
});

export default app;
