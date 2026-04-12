/**
 * Electron API Type Definitions
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

interface ElectronAPI {
  // File dialog APIs
  selectFolder(): Promise<FolderSelectResult>;
  selectControlFile(startPath?: string): Promise<FileSelectResult>;

  // File read APIs
  readFile(filePath: string): Promise<FileBinaryResult>;
  readTextFile(filePath: string): Promise<FileReadResult>;

  // Directory listing
  listDirectory(dirPath: string): Promise<FileListResult>;

  // File system checks
  fileExists(filePath: string): Promise<FileExistsResult>;
  directoryExists(dirPath: string): Promise<FileExistsResult>;
  getFileStats(filePath: string): Promise<FileStatsResult>;

  // Window controls
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;

  // Open URL or file
  openURL(url: string): Promise<void>;

  // Open PDF in a new window
  openPdfWindow(pdfPath: string): Promise<OpenWindowResult>;

  // Get OS username and hostname for watermark text
  getSystemInfo(): Promise<SystemInfoResult>;

  // Save PDF via native Save dialog (needed in packaged Electron)
  savePdf(data: string, defaultName: string): Promise<{ success: boolean; canceled?: boolean; error?: string }>;

  // SQLite case persistence
  dbSaveCase(caseData: Omit<DbCaseRow, 'os_username' | 'machine_name' | 'synced'>): Promise<DbResult>;
  dbLoadCases(): Promise<DbLoadResult>;
  dbUpdateChartImage(id: string, chartImage: string): Promise<DbResult>;
  dbDeleteCase(id: string): Promise<DbResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  // File System Access API — available in modern browsers but not always in TypeScript DOM lib
  function showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  function showOpenFilePicker(options?: {
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    multiple?: boolean;
  }): Promise<FileSystemFileHandle[]>;

  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

export {};
