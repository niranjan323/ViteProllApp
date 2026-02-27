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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
