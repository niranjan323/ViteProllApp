import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron Preload Script
 * Exposes safe IPC APIs to the renderer process
 */

interface FileReadResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface FileListResult {
  success: boolean;
  files?: string[];
  error?: string;
}

interface FileExistsResult {
  success: boolean;
  exists?: boolean;
  error?: string;
}

interface FileStatsResult {
  success: boolean;
  stats?: {
    isDirectory: boolean;
    isFile: boolean;
    size: number;
    mtime: number;
  };
  error?: string;
}

interface FolderSelectResult {
  success: boolean;
  folderPath?: string;
  canceled?: boolean;
  error?: string;
}

interface FileSelectResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

interface FileBinaryResult {
  success: boolean;
  data?: string; // Base64 encoded
  error?: string;
}

interface OpenWindowResult {
  success: boolean;
  error?: string;
}

interface SystemInfoResult {
  username: string;
  hostname: string;
}

interface DbCaseRow {
  id: string;
  created_at: number;
  os_username: string;
  machine_name: string;
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
  synced: number;
}

interface DbResult {
  success: boolean;
  error?: string;
}

interface DbLoadResult {
  success: boolean;
  cases?: DbCaseRow[];
  error?: string;
}

const electronAPI = {
  // File dialog APIs
  selectFolder: (): Promise<FolderSelectResult> =>
    ipcRenderer.invoke('select-folder'),

  selectControlFile: (startPath?: string): Promise<FileSelectResult> =>
    ipcRenderer.invoke('select-control-file', startPath),

  // File read APIs
  readFile: (filePath: string): Promise<FileBinaryResult> =>
    ipcRenderer.invoke('read-file', filePath),

  readTextFile: (filePath: string): Promise<FileReadResult> =>
    ipcRenderer.invoke('read-text-file', filePath),

  // Directory listing
  listDirectory: (dirPath: string): Promise<FileListResult> =>
    ipcRenderer.invoke('list-directory', dirPath),

  // File system checks
  fileExists: (filePath: string): Promise<FileExistsResult> =>
    ipcRenderer.invoke('file-exists', filePath),

  directoryExists: (dirPath: string): Promise<FileExistsResult> =>
    ipcRenderer.invoke('directory-exists', dirPath),

  getFileStats: (filePath: string): Promise<FileStatsResult> =>
    ipcRenderer.invoke('get-file-stats', filePath),

  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),

  // Open URL or file
  openURL: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-url', url),

  // Open PDF in a new window
  openPdfWindow: (pdfPath: string): Promise<OpenWindowResult> =>
    ipcRenderer.invoke('open-pdf-window', pdfPath),

  // Get OS username and hostname for watermark text
  getSystemInfo: (): Promise<SystemInfoResult> =>
    ipcRenderer.invoke('get-system-info'),

  // Save PDF via native Save dialog (needed in packaged Electron)
  savePdf: (data: string, defaultName: string): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke('save-pdf', { data, defaultName }),

  // SQLite case persistence
  dbSaveCase: (caseData: Omit<DbCaseRow, 'os_username' | 'machine_name' | 'synced'>): Promise<DbResult> =>
    ipcRenderer.invoke('db-save-case', caseData),

  dbLoadCases: (): Promise<DbLoadResult> =>
    ipcRenderer.invoke('db-load-cases'),

  dbUpdateChartImage: (id: string, dataFilePath: string, chartImage: string): Promise<DbResult> =>
    ipcRenderer.invoke('db-update-chart-image', id, dataFilePath, chartImage),

  dbDeleteCase: (id: string, dataFilePath: string): Promise<DbResult> =>
    ipcRenderer.invoke('db-delete-case', id, dataFilePath),
};

// Expose the electron API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Declare global types for the API
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

export {};
