import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import Database from 'better-sqlite3';

const isDev = !app.isPackaged;

// ─── SQLite Database ──────────────────────────────────────────────────────────
let db: Database.Database;

const NEW_CASES_DDL = `
  CREATE TABLE cases (
    id            TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    os_username   TEXT NOT NULL,
    machine_name  TEXT NOT NULL,
    color         TEXT NOT NULL,
    draft_aft     REAL,
    draft_fore    REAL,
    gm            REAL,
    heading       REAL,
    speed         REAL,
    max_roll      REAL,
    hs            REAL,
    tz            REAL,
    wave_direction REAL,
    data_file_path TEXT NOT NULL DEFAULT '',
    fitted_draft  REAL,
    fitted_gm     REAL,
    fitted_hs     REAL,
    fitted_tz     REAL,
    chart_mode    TEXT,
    chart_orientation TEXT,
    chart_image   TEXT,
    art_mode      TEXT,
    synced        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, data_file_path)
  )
`;

function initDatabase(): void {
  // Store DB in the app's own folder — dev: project root, production: next to the exe
  const dbDir = isDev
    ? path.join(__dirname, '..')          // project root (next to package.json)
    : path.dirname(app.getPath('exe'));   // same folder as the installed exe
  const dbPath = path.join(dbDir, 'croll_cases.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // better performance for concurrent reads

  // Schema version tracking for migrations
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);
  const versionRow = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let schemaVersion = versionRow?.version ?? 0;

  if (schemaVersion < 1) {
    // Migrate to composite PRIMARY KEY (id, data_file_path) so two vessels can share case IDs
    const casesExist = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='cases'`).get();
    if (casesExist) {
      db.exec(`
        CREATE TABLE cases_new (
          id            TEXT NOT NULL,
          created_at    INTEGER NOT NULL,
          os_username   TEXT NOT NULL,
          machine_name  TEXT NOT NULL,
          color         TEXT NOT NULL,
          draft_aft     REAL,
          draft_fore    REAL,
          gm            REAL,
          heading       REAL,
          speed         REAL,
          max_roll      REAL,
          hs            REAL,
          tz            REAL,
          wave_direction REAL,
          data_file_path TEXT NOT NULL DEFAULT '',
          fitted_draft  REAL,
          fitted_gm     REAL,
          fitted_hs     REAL,
          fitted_tz     REAL,
          chart_mode    TEXT,
          chart_orientation TEXT,
          chart_image   TEXT,
          synced        INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, data_file_path)
        );
        INSERT OR IGNORE INTO cases_new
          SELECT id, created_at, os_username, machine_name, color,
                 draft_aft, draft_fore, gm, heading, speed, max_roll,
                 hs, tz, wave_direction, COALESCE(data_file_path, ''),
                 fitted_draft, fitted_gm, fitted_hs, fitted_tz,
                 chart_mode, chart_orientation, chart_image, synced
          FROM cases;
        DROP TABLE cases;
        ALTER TABLE cases_new RENAME TO cases;
      `);
    } else {
      db.exec(NEW_CASES_DDL);
    }
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(2);
    schemaVersion = 2;
  }
  
  const caseColumns = db.prepare(`PRAGMA table_info(cases)`).all() as Array<{ name: string }>;
  const artModeExists = caseColumns.some(column => column.name === 'art_mode');
  if (!artModeExists) {
      db.exec(`ALTER TABLE cases ADD COLUMN art_mode TEXT`);
    }
    if (schemaVersion < 2) {
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(2);
      schemaVersion = 2;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── License XML Reader ───────────────────────────────────────────────────────
interface LicenseInfo {
  fullName: string;   // <Contact>
  machineId: string;  // <MACID>
}

function readLicenseInfo(): LicenseInfo {
  const fallback = { fullName: os.userInfo().username, machineId: os.hostname() };
  try {
    // Search in app directory for Req_*.xml (license request file)
    const appDir = isDev
      ? path.join(__dirname, '..', 'dist', 'win-unpacked')
      : path.dirname(app.getPath('exe'));

    if (!fs.existsSync(appDir)) return fallback;

    const xmlFile = fs.readdirSync(appDir).find(f => f.startsWith('Req_') && f.endsWith('.xml'));
    if (!xmlFile) return fallback;

    const xml = fs.readFileSync(path.join(appDir, xmlFile), 'utf-8');

    const contactMatch = xml.match(/<Contact>([^<]+)<\/Contact>/i);
    const macidMatch   = xml.match(/<MACID>([^<]+)<\/MACID>/i);

    return {
      fullName:  contactMatch?.[1]?.trim() || fallback.fullName,
      machineId: macidMatch?.[1]?.trim()   || fallback.machineId,
    };
  } catch {
    return fallback;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Watermark Helpers ────────────────────────────────────────────────────────
function buildWatermarkTimestamp(): string {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s} UTC`;
}

function buildWatermarkText(username: string, machineId: string): string {
  const year = new Date().getFullYear();
  return `Authorized to ABS Eagle CRoll software licensed user ${username} (${machineId}) only, ${buildWatermarkTimestamp()}, copyright ${year} by ABS. All rights reserved.`;
}

async function applyWatermarkToPdf(pdfBytes: Buffer, username: string, hostname: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const watermarkText = buildWatermarkText(username, hostname);
  const fontSize = 8;

  pdfDoc.getPages().forEach((page, index) => {
    if (index === 0) return; // no watermark on page 1
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    page.drawText(watermarkText, {
      x: width - 10,
      y: (height + textWidth) / 2,
      size: fontSize,
      font,
      color: rgb(0.38, 0.38, 0.38),
      rotate: degrees(-90),
      opacity: 0.75,
    });
  });

  return pdfDoc.save();
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── ABS License Check ───────────────────────────────────────────────────────
const PRODUCT_NAME = 'CROLL261UAT';
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
    { encoding: 'utf-8' }
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
    title: 'CRoll',
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
    icon: path.join(__dirname, '../public/CRoll App icon.ico'),
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
  initDatabase();
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
 * Save a PDF file via native Save dialog.
 * Accepts base64-encoded PDF data from the renderer.
 * This is needed in packaged Electron where jsPDF's anchor-click download is blocked.
 */
ipcMain.handle('save-pdf', async (_, { data, defaultName }: { data: string; defaultName: string }) => {
  if (!mainWindow) return { success: false, error: 'Window not ready' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save PDF Report',
    defaultPath: defaultName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(data, 'base64'));
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Return username and hostname for watermark generation in the renderer
 */
ipcMain.handle('get-system-info', () => {
  return {
    username: os.userInfo().username,
    hostname: os.hostname(),
  };
});

/**
 * Open a PDF in a new independent Electron window, with a watermark applied
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

    // Apply watermark to the PDF before opening
    const pdfBytes = fs.readFileSync(filePath);
    const { fullName, machineId } = readLicenseInfo();
    const watermarkedBytes = await applyWatermarkToPdf(pdfBytes, fullName, machineId);

    // Write watermarked PDF to a temp file
    const tempDir = app.getPath('temp');
    const tempFile = path.join(tempDir, `ABS Eagle CRoll User Guide v2026.1.pdf`);
    fs.writeFileSync(tempFile, watermarkedBytes);

    // parent: mainWindow ensures closing the PDF does not quit the whole app.
    // setMenu(null): removes Electron's default "File > Exit" which calls app.quit().
    const pdfWindow = new BrowserWindow({
      title: 'CRoll User Guide',
      width: 1000,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      parent: mainWindow ?? undefined,
      webPreferences: {
        preload: undefined,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    pdfWindow.setMenu(null);

    // loadFile handles Windows path encoding correctly (no backslash issues)
    await pdfWindow.loadFile(tempFile);

    // Clean up temp file after window is closed
    pdfWindow.on('closed', () => {
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to open PDF window: ${(error as Error).message}`,
    };
  }
});

// ─── Cases SQLite IPC Handlers ───────────────────────────────────────────────

/**
 * Save a case to SQLite
 */
ipcMain.handle('db-save-case', (_event, caseData: {
  id: string;
  created_at: number;
  color: string;
  draft_aft: number;
  draft_fore: number;
  gm: number;
  heading: number;
  speed: number;
  max_roll: number;
  hs: number;
  tz: number;
  wave_direction: number;
  data_file_path: string;
  fitted_draft: number | null;
  fitted_gm: number | null;
  fitted_hs: number | null;
  fitted_tz: number | null;
  chart_mode: string;
  chart_orientation: string;
  chart_image: string | null;
  art_mode: string | null;
}) => {
  try {
    const username = os.userInfo().username;
    const hostname = os.hostname();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO cases (
        id, created_at, os_username, machine_name, color,
        draft_aft, draft_fore, gm, heading, speed, max_roll,
        hs, tz, wave_direction, data_file_path,
        fitted_draft, fitted_gm, fitted_hs, fitted_tz,
        chart_mode, chart_orientation, chart_image, art_mode,synced
      ) VALUES (
        @id, @created_at, @os_username, @machine_name, @color,
        @draft_aft, @draft_fore, @gm, @heading, @speed, @max_roll,
        @hs, @tz, @wave_direction, @data_file_path,
        @fitted_draft, @fitted_gm, @fitted_hs, @fitted_tz,
        @chart_mode, @chart_orientation, @chart_image, @art_mode, 0
      )
    `);
    stmt.run({ ...caseData, os_username: username, machine_name: hostname });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Load all cases from SQLite (for the current machine)
 */
ipcMain.handle('db-load-cases', () => {
  try {
    const rows = db.prepare(`
      SELECT * FROM cases ORDER BY created_at ASC
    `).all();
    return { success: true, cases: rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Update chart image for an existing case
 */
ipcMain.handle('db-update-chart-image', (_event, id: string, dataFilePath: string, chartImage: string) => {
  try {
    db.prepare(`UPDATE cases SET chart_image = ? WHERE id = ? AND data_file_path = ?`).run(chartImage, id, dataFilePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Delete a case from SQLite
 */
ipcMain.handle('db-delete-case', (_event, id: string, dataFilePath: string) => {
  try {
    db.prepare(`DELETE FROM cases WHERE id = ? AND data_file_path = ?`).run(id, dataFilePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
// ─────────────────────────────────────────────────────────────────────────────

export default app;
