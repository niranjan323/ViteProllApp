"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─────────────────────────────────────────────────────────────────────────────
const electronAPI = {
    // File dialog APIs
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    selectControlFile: (startPath) => electron_1.ipcRenderer.invoke('select-control-file', startPath),
    // File read APIs
    readFile: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    readTextFile: (filePath) => electron_1.ipcRenderer.invoke('read-text-file', filePath),
    // Directory listing
    listDirectory: (dirPath) => electron_1.ipcRenderer.invoke('list-directory', dirPath),
    // File system checks
    fileExists: (filePath) => electron_1.ipcRenderer.invoke('file-exists', filePath),
    directoryExists: (dirPath) => electron_1.ipcRenderer.invoke('directory-exists', dirPath),
    getFileStats: (filePath) => electron_1.ipcRenderer.invoke('get-file-stats', filePath),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.send('window-minimize'),
    maximizeWindow: () => electron_1.ipcRenderer.send('window-maximize'),
    closeWindow: () => electron_1.ipcRenderer.send('window-close'),
    // Open URL or file
    openURL: (url) => electron_1.ipcRenderer.invoke('open-url', url),
    // Open PDF in a new window
    openPdfWindow: (pdfPath) => electron_1.ipcRenderer.invoke('open-pdf-window', pdfPath),
    // ─── LICENSING SYSTEM APIS ───────────────────────────────────────────────
    license: {
        /**
         * Generate a new license request XML file
         */
        generateRequest: (contactEmail, organizationName) => electron_1.ipcRenderer.invoke('license:generate-request', contactEmail, organizationName),
        /**
         * Get current machine information
         */
        getMachineInfo: () => electron_1.ipcRenderer.invoke('license:get-machine-info'),
        /**
         * Get license installation status
         */
        getStatus: () => electron_1.ipcRenderer.invoke('license:get-status'),
        /**
         * Validate the current license
         */
        validate: () => electron_1.ipcRenderer.invoke('license:validate'),
        /**
         * Install a license file (base64 encoded content)
         */
        install: (licenseContent) => electron_1.ipcRenderer.invoke('license:install', licenseContent),
        /**
         * Remove the current license
         */
        remove: () => electron_1.ipcRenderer.invoke('license:remove'),
        /**
         * Open the default email client for sending license request
         */
        openEmail: (recipient) => electron_1.ipcRenderer.invoke('license:open-email', recipient),
        /**
         * Open license request folder in Windows Explorer
         */
        openFolder: (folderPath) => electron_1.ipcRenderer.invoke('license:open-folder', folderPath),
        /**
         * Get license history (for debugging)
         */
        getHistory: () => electron_1.ipcRenderer.invoke('license:get-history'),
        /**
         * Select and load a license file
         */
        selectFile: () => electron_1.ipcRenderer.invoke('license:select-file'),
    },
    // ─────────────────────────────────────────────────────────────────────────
};
// Expose the electron API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
