"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const pdf_lib_1 = require("pdf-lib");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const isDev = !electron_1.app.isPackaged;
// ─── SQLite Database ──────────────────────────────────────────────────────────
let db;
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
    synced        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, data_file_path)
  )
`;
function initDatabase() {
    // Store DB in the app's own folder — dev: project root, production: next to the exe
    const dbDir = isDev
        ? path.join(__dirname, '..') // project root (next to package.json)
        : path.dirname(electron_1.app.getPath('exe')); // same folder as the installed exe
    const dbPath = path.join(dbDir, 'croll_cases.db');
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL'); // better performance for concurrent reads
    // Schema version tracking for migrations
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);
    const versionRow = db.prepare('SELECT version FROM schema_version').get();
    const schemaVersion = versionRow?.version ?? 0;
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
        }
        else {
            db.exec(NEW_CASES_DDL);
        }
        db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(1);
    }
}
function readLicenseInfo() {
    const fallback = { fullName: os.userInfo().username, machineId: os.hostname() };
    try {
        // Search in app directory for Req_*.xml (license request file)
        const appDir = isDev
            ? path.join(__dirname, '..', 'dist', 'win-unpacked')
            : path.dirname(electron_1.app.getPath('exe'));
        if (!fs.existsSync(appDir))
            return fallback;
        const xmlFile = fs.readdirSync(appDir).find(f => f.startsWith('Req_') && f.endsWith('.xml'));
        if (!xmlFile)
            return fallback;
        const xml = fs.readFileSync(path.join(appDir, xmlFile), 'utf-8');
        const contactMatch = xml.match(/<Contact>([^<]+)<\/Contact>/i);
        const macidMatch = xml.match(/<MACID>([^<]+)<\/MACID>/i);
        return {
            fullName: contactMatch?.[1]?.trim() || fallback.fullName,
            machineId: macidMatch?.[1]?.trim() || fallback.machineId,
        };
    }
    catch {
        return fallback;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// ─── Watermark Helpers ────────────────────────────────────────────────────────
function buildWatermarkTimestamp() {
    const now = new Date();
    const y = String(now.getUTCFullYear());
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s} UTC`;
}
function buildWatermarkText(username, machineId) {
    const year = new Date().getFullYear();
    return `Authorized to ABS Eagle CRoll software licensed user ${username} (${machineId}) only, ${buildWatermarkTimestamp()}, copyright ${year} by ABS. All rights reserved.`;
}
async function applyWatermarkToPdf(pdfBytes, username, hostname) {
    const pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const watermarkText = buildWatermarkText(username, hostname);
    const fontSize = 8;
    pdfDoc.getPages().forEach((page, index) => {
        if (index === 0)
            return; // no watermark on page 1
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        page.drawText(watermarkText, {
            x: width - 10,
            y: (height + textWidth) / 2,
            size: fontSize,
            font,
            color: (0, pdf_lib_1.rgb)(0.38, 0.38, 0.38),
            rotate: (0, pdf_lib_1.degrees)(-90),
            opacity: 0.75,
        });
    });
    return pdfDoc.save();
}
// ─────────────────────────────────────────────────────────────────────────────
// ─── ABS License Check ───────────────────────────────────────────────────────
const PRODUCT_NAME = 'PROLLDIG261UAT';
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
    const result = (0, child_process_1.spawnSync)(licExe, [`${PRODUCT_NAME}`, `${MAJOR_VER}.${MINOR_VER}`, appDir], { encoding: 'utf-8' });
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
    initDatabase();
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
 * Save a PDF file via native Save dialog.
 * Accepts base64-encoded PDF data from the renderer.
 * This is needed in packaged Electron where jsPDF's anchor-click download is blocked.
 */
electron_1.ipcMain.handle('save-pdf', async (_, { data, defaultName }) => {
    if (!mainWindow)
        return { success: false, error: 'Window not ready' };
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: 'Save PDF Report',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath)
        return { success: false, canceled: true };
    try {
        fs.writeFileSync(result.filePath, Buffer.from(data, 'base64'));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
/**
 * Return username and hostname for watermark generation in the renderer
 */
electron_1.ipcMain.handle('get-system-info', () => {
    return {
        username: os.userInfo().username,
        hostname: os.hostname(),
    };
});
/**
 * Open a PDF in a new independent Electron window, with a watermark applied
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
        // Apply watermark to the PDF before opening
        const pdfBytes = fs.readFileSync(filePath);
        const { fullName, machineId } = readLicenseInfo();
        const watermarkedBytes = await applyWatermarkToPdf(pdfBytes, fullName, machineId);
        // Write watermarked PDF to a temp file
        const tempDir = electron_1.app.getPath('temp');
        const tempFile = path.join(tempDir, `ABS Eagle CRoll User Guide v2026.1.pdf`);
        fs.writeFileSync(tempFile, watermarkedBytes);
        // parent: mainWindow ensures closing the PDF does not quit the whole app.
        // setMenu(null): removes Electron's default "File > Exit" which calls app.quit().
        const pdfWindow = new electron_1.BrowserWindow({
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
            try {
                fs.unlinkSync(tempFile);
            }
            catch { /* ignore */ }
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
// ─── Cases SQLite IPC Handlers ───────────────────────────────────────────────
/**
 * Save a case to SQLite
 */
electron_1.ipcMain.handle('db-save-case', (_event, caseData) => {
    try {
        const username = os.userInfo().username;
        const hostname = os.hostname();
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO cases (
        id, created_at, os_username, machine_name, color,
        draft_aft, draft_fore, gm, heading, speed, max_roll,
        hs, tz, wave_direction, data_file_path,
        fitted_draft, fitted_gm, fitted_hs, fitted_tz,
        chart_mode, chart_orientation, chart_image, synced
      ) VALUES (
        @id, @created_at, @os_username, @machine_name, @color,
        @draft_aft, @draft_fore, @gm, @heading, @speed, @max_roll,
        @hs, @tz, @wave_direction, @data_file_path,
        @fitted_draft, @fitted_gm, @fitted_hs, @fitted_tz,
        @chart_mode, @chart_orientation, @chart_image, 0
      )
    `);
        stmt.run({ ...caseData, os_username: username, machine_name: hostname });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
/**
 * Load all cases from SQLite (for the current machine)
 */
electron_1.ipcMain.handle('db-load-cases', () => {
    try {
        const rows = db.prepare(`
      SELECT * FROM cases ORDER BY created_at ASC
    `).all();
        return { success: true, cases: rows };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
/**
 * Update chart image for an existing case
 */
electron_1.ipcMain.handle('db-update-chart-image', (_event, id, dataFilePath, chartImage) => {
    try {
        db.prepare(`UPDATE cases SET chart_image = ? WHERE id = ? AND data_file_path = ?`).run(chartImage, id, dataFilePath);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
/**
 * Delete a case from SQLite
 */
electron_1.ipcMain.handle('db-delete-case', (_event, id, dataFilePath) => {
    try {
        db.prepare(`DELETE FROM cases WHERE id = ? AND data_file_path = ?`).run(id, dataFilePath);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
exports.default = electron_1.app;
