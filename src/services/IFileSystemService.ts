export interface IFileSystemService {
  setBasePath(basePath: string): void;
  getBasePath(): string;
  readBinaryFile(filePath: string): Promise<ArrayBuffer>;
  readTextFile(filePath: string): Promise<string>;
  listDirectory(dirPath: string): Promise<string[]>;
  fileExists(filePath: string): Promise<boolean>;
  directoryExists(dirPath: string): Promise<boolean>;
  selectFolder(): Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }>;
  selectControlFile(startPath?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
}
