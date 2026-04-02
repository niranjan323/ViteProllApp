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

// ─── LICENSING SYSTEM TYPE DEFINITIONS ───────────────────────────────────────

interface LicenseGenerateRequestResult {
  success: boolean;
  xmlContent?: string;
  filePath?: string;
  machineId?: string;
  error?: string;
}

interface LicenseMachineInfoResult {
  success: boolean;
  machineId?: string;
  hostname?: string;
  platform?: string;
  error?: string;
}

interface LicenseStatusResult {
  success: boolean;
  installed?: boolean;
  expiresIn?: number;
  machineId?: string;
  error?: string;
}

interface LicenseValidationResult {
  success: boolean;
  valid?: boolean;
  reason?: string;
  expiresIn?: number;
  error?: string;
}

interface LicenseInstallResult {
  success: boolean;
  message?: string;
  expiresIn?: number;
  error?: string;
}

interface LicenseHistoryResult {
  success: boolean;
  licenses?: string[];
  requests?: string[];
  licenseDir?: string;
  requestDir?: string;
  error?: string;
}

interface LicenseFileResult {
  success: boolean;
  base64Content?: string;
  fileName?: string;
  canceled?: boolean;
  error?: string;
}

interface LicenseEmailResult {
  success: boolean;
  message?: string;
  requestPath?: string;
  emailTemplate?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // ─── LICENSING SYSTEM APIS ───────────────────────────────────────────────

  license: {
    /**
     * Generate a new license request XML file
     */
    generateRequest: (
      contactEmail?: string,
      organizationName?: string
    ): Promise<LicenseGenerateRequestResult> =>
      ipcRenderer.invoke('license:generate-request', contactEmail, organizationName),

    /**
     * Get current machine information
     */
    getMachineInfo: (): Promise<LicenseMachineInfoResult> =>
      ipcRenderer.invoke('license:get-machine-info'),

    /**
     * Get license installation status
     */
    getStatus: (): Promise<LicenseStatusResult> =>
      ipcRenderer.invoke('license:get-status'),

    /**
     * Validate the current license
     */
    validate: (): Promise<LicenseValidationResult> =>
      ipcRenderer.invoke('license:validate'),

    /**
     * Install a license file (base64 encoded content)
     */
    install: (licenseContent: string): Promise<LicenseInstallResult> =>
      ipcRenderer.invoke('license:install', licenseContent),

    /**
     * Remove the current license
     */
    remove: (): Promise<LicenseInstallResult> =>
      ipcRenderer.invoke('license:remove'),

    /**
     * Open the default email client for sending license request
     */
    openEmail: (recipient?: string): Promise<LicenseEmailResult> =>
      ipcRenderer.invoke('license:open-email', recipient),

    /**
     * Open license request folder in Windows Explorer
     */
    openFolder: (folderPath?: string): Promise<LicenseEmailResult> =>
      ipcRenderer.invoke('license:open-folder', folderPath),

    /**
     * Get license history (for debugging)
     */
    getHistory: (): Promise<LicenseHistoryResult> =>
      ipcRenderer.invoke('license:get-history'),

    /**
     * Select and load a license file
     */
    selectFile: (): Promise<LicenseFileResult> =>
      ipcRenderer.invoke('license:select-file'),
  },

  // ─────────────────────────────────────────────────────────────────────────
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
