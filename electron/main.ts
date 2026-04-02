import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const isDev = !app.isPackaged;

// ─── ABS License Check ───────────────────────────────────────────────────────
const PRODUCT_NAME = 'PRollDig261.EAT';
const MAJOR_VER = 1;
const MINOR_VER = 0;

function checkLicense(): boolean {
  // Skip license check in dev mode
  if (isDev) return true;

  const appDir = path.dirname(app.getPath('exe'));
  const licExe  = path.join(appDir, 'LicChkSrcEXE.exe');
  const licDll1 = path.join(appDir, 'ABS.Licensing.dll');
  const licDll2 = path.join(appDir, 'abs.licensing.core.dll');

  // Verify required files are present
  for (const f of [licExe, licDll1, licDll2]) {
    if (!fs.existsSync(f)) {
      dialog.showErrorBox(
        'License Error',
        `Required licensing file not found:\n${f}\n\nPlease contact your system administrator.`
      );
      return false;
    }
  }

  // Run license check: LicChkSrcEXE.exe <product> <major>.<minor> "<appPath>"
  const result = spawnSync(
    licExe,
    [`${PRODUCT_NAME}`, `${MAJOR_VER}.${MINOR_VER}`, appDir],
    { encoding: 'utf-8', timeout: 15000 }
  );

  if (result.status !== 0) {
    dialog.showErrorBox(
      'License Validation Failed',
      'This software is not licensed for use on this machine.\n\nPlease contact your ABS representative to obtain a valid license.'
    );
    return false;
  }

  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  if (!checkLicense()) {
    app.quit();
    return;
  }
  createWindow();
});

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

// Window control handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

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

/**
 * Open a URL or file with the default application
 */
ipcMain.handle('open-url', async (_, url: string) => {
  try {
    // If it's a relative path, resolve it to the app's public folder
    let targetPath = url;
    if (url.startsWith('/')) {
      if (isDev) {
        targetPath = path.join(__dirname, '../public', url.slice(1));
      } else {
        targetPath = path.join(__dirname, '../dist', url.slice(1));
      }
    }
    
    await shell.openPath(targetPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to open URL: ${(error as Error).message}`,
    };
  }
});

/**
 * Open a PDF in a new independent Electron window
 */
ipcMain.handle('open-pdf-window', async (_, pdfPath: string) => {
  try {
    // Resolve the PDF path
    let filePath = pdfPath;
    if (pdfPath.startsWith('/')) {
      if (isDev) {
        filePath = path.join(__dirname, '../public', pdfPath.slice(1));
      } else {
        filePath = path.join(__dirname, '../dist', pdfPath.slice(1));
      }
    }

    // Create a new independent BrowserWindow for the PDF
    const pdfWindow = new BrowserWindow({
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
  } catch (error) {
    return {
      success: false,
      error: `Failed to open PDF window: ${(error as Error).message}`,
    };
  }
});

export default app;
