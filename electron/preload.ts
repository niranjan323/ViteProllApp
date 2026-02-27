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
