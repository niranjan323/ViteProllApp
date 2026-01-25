/**
 * FileSystemService - Abstraction layer for file operations
 * Uses Electron IPC to access files securely
 */

export class FileSystemService {
  private basePath: string = '';

  constructor(basePath?: string) {
    this.basePath = basePath || '';
  }

  /**
   * Set the base path for relative file operations
   */
  setBasePath(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Get the current base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Resolve a full path from a relative path
   */
  private resolvePath(relativePath: string): string {
    // Check if path is already absolute (Windows: C:\ or Unix: /)
    const isAbsolute = /^[a-zA-Z]:/.test(relativePath) || relativePath.startsWith('/');
    if (isAbsolute) {
      return relativePath;
    }

    if (!this.basePath) {
      throw new Error('Base path not set. Please select a folder first.');
    }

    // Use forward slash for path joining (works cross-platform)
    const normalized = relativePath.replace(/\\/g, '/');
    const baseParts = this.basePath.replace(/\\/g, '/').split('/').filter(p => p);
    const pathParts = normalized.split('/').filter(p => p && p !== '.');

    // On Windows use backslash, on other platforms use forward slash
    const separator = navigator.platform.includes('Win') ? '\\' : '/';
    return [...baseParts, ...pathParts].join('/').replace(/\//g, separator);
  }

  /**
   * Read a binary file and return as base64, then decode to buffer
   */
  async readBinaryFile(filePath: string): Promise<ArrayBuffer> {
    const fullPath = this.resolvePath(filePath);

    try {
      const result = await window.electronAPI.readFile(fullPath);

      if (!result.success) {
        throw new Error(result.error || 'Failed to read file');
      }

      // Decode base64 to binary
      const binaryString = atob(result.data!);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('Error reading binary file:', error);
      throw error;
    }
  }

  /**
   * Read a text file
   */
  async readTextFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);

    try {
      const result = await window.electronAPI.readTextFile(fullPath);

      if (!result.success) {
        throw new Error(result.error || 'Failed to read file');
      }

      return result.data!;
    } catch (error) {
      console.error('Error reading text file:', error);
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);

    try {
      const result = await window.electronAPI.listDirectory(fullPath);

      if (!result.success) {
        throw new Error(result.error || 'Failed to list directory');
      }

      return result.files || [];
    } catch (error) {
      console.error('Error listing directory:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);

    try {
      const result = await window.electronAPI.fileExists(fullPath);
      return result.exists || false;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    const fullPath = this.resolvePath(dirPath);

    try {
      const result = await window.electronAPI.directoryExists(fullPath);
      return result.exists || false;
    } catch (error) {
      console.error('Error checking directory existence:', error);
      return false;
    }
  }

  /**
   * Select a folder via dialog
   */
  async selectFolder(): Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }> {
    return window.electronAPI.selectFolder();
  }

  /**
   * Select a file via dialog
   */
  async selectControlFile(startPath?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
    console.log('FileSystemService.selectControlFile called with startPath:', startPath);
    console.log('window.electronAPI available:', !!window.electronAPI);
    
    if (!window.electronAPI) {
      console.error('window.electronAPI is not available!');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electronAPI.selectControlFile(startPath);
      console.log('IPC selectControlFile result:', result);
      return result;
    } catch (error) {
      console.error('Error calling selectControlFile IPC:', error);
      return { success: false, error: String(error) };
    }
  }
}
