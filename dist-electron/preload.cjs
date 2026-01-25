"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
};
// Expose the electron API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
