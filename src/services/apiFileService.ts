import type { IFileSystemService } from './IFileSystemService';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

/**
 * Web implementation of IFileSystemService.
 * All file operations go through the CRoll .NET API → Azure Blob Storage.
 * Replaces WebFileSystemService (File System Access API) when running in browser mode.
 *
 * basePath = blob project folder name (e.g. "VesselAlpha-2024")
 * filePath args = relative paths within the project (e.g. "polars/Draft=15.0/GM=1.5/v.bpolar")
 */
export class ApiFileSystemService implements IFileSystemService {
  private basePath: string = '';
  private cachedTree: string[] | null = null;  // cache the project tree to avoid repeat fetches

  setBasePath(basePath: string): void {
    this.basePath = basePath.replace(/\\/g, '/').replace(/\/$/, '');
    this.cachedTree = null;  // clear cache on project change
  }

  getBasePath(): string {
    return this.basePath;
  }

  // ─── FILE READ ──────────────────────────────────────────────────────────────

  async readBinaryFile(filePath: string): Promise<ArrayBuffer> {
    const path = this.toRelativePath(filePath);
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/file?path=${encodeURIComponent(path)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to read binary file '${filePath}': ${response.status} ${response.statusText}`);
    return response.arrayBuffer();
  }

  async readTextFile(filePath: string): Promise<string> {
    const path = this.toRelativePath(filePath);
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/file?path=${encodeURIComponent(path)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to read text file '${filePath}': ${response.status} ${response.statusText}`);
    return response.text();
  }

  // ─── DIRECTORY LISTING ──────────────────────────────────────────────────────

  async listDirectory(dirPath: string): Promise<string[]> {
    const tree = await this.getTree();
    const prefix = this.toRelativePath(dirPath).replace(/\/$/, '') + '/';

    // Return only entries directly inside this directory (one level deep)
    return tree
      .filter(blob => blob.startsWith(prefix))
      .map(blob => blob.slice(prefix.length))
      .filter(name => !name.includes('/'));  // direct children only
  }

  async fileExists(filePath: string): Promise<boolean> {
    const path = this.toRelativePath(filePath);
    const tree = await this.getTree();
    return tree.some(blob => blob === path || blob.endsWith('/' + path));
  }

  async directoryExists(dirPath: string): Promise<boolean> {
    const path = this.toRelativePath(dirPath).replace(/\/$/, '') + '/';
    const tree = await this.getTree();
    return tree.some(blob => blob.startsWith(path));
  }

  // ─── PROJECT SELECTION ──────────────────────────────────────────────────────

  /**
   * Not used in web mode — project selection is handled by the ProjectSelector UI.
   * Returns a special code so ElectronContext knows to defer to the web project picker.
   */
  async selectFolder(): Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }> {
    return { success: false, error: 'web-select-folder-not-supported' };
  }

  /**
   * In web mode, fetches the control file text and returns its blob path as filePath.
   */
  async selectControlFile(_startPath?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
    if (!this.basePath)
      return { success: false, error: 'No project selected. Select a project first.' };

    const controlBlobName = 'control.ctl';
    const exists = await this.fileExists(controlBlobName);
    if (!exists)
      return { success: false, error: `control.ctl not found in project '${this.basePath}'.` };

    // Return a virtual path that readTextFile / DataLoader will resolve via API
    return { success: true, filePath: controlBlobName };
  }

  // ─── PUBLIC HELPERS ─────────────────────────────────────────────────────────

  /**
   * Fetch all available project names from blob storage.
   * Used by the project picker UI.
   */
  static async listProjects(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/api/files/projects`);
    if (!response.ok)
      throw new Error(`Failed to list projects: ${response.status}`);
    return response.json();
  }

  /**
   * Upload files to a project folder.
   * files: array of File objects from an <input type="file"> or drag-and-drop.
   * relativePaths: matching array of paths within the project (e.g. "polars/Draft=15.0/GM=1.5/v.bpolar").
   */
  static async uploadFiles(projectName: string, files: File[], relativePaths: string[]): Promise<void> {
    const formData = new FormData();
    files.forEach((file, i) => {
      // Use relativePaths as file name — the server uses file.FileName as the blob sub-path
      const renamedFile = new File([file], relativePaths[i], { type: file.type });
      formData.append('files', renamedFile);
    });

    const response = await fetch(
      `${API_BASE}/api/files/projects/${encodeURIComponent(projectName)}/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────────

  /** Fetch and cache the full blob tree for the current project. */
  private async getTree(): Promise<string[]> {
    if (this.cachedTree) return this.cachedTree;

    const response = await fetch(
      `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/tree`
    );
    if (!response.ok)
      throw new Error(`Failed to fetch project tree: ${response.status}`);

    const blobs: string[] = await response.json();
    // Strip the project name prefix — store paths relative to project root
    this.cachedTree = blobs.map(b =>
      b.startsWith(this.basePath + '/') ? b.slice(this.basePath.length + 1) : b
    );
    return this.cachedTree;
  }

  /** Convert an absolute or relative file path to a blob-relative path. */
  private toRelativePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    // Strip leading project name if accidentally included
    if (normalized.startsWith(this.basePath + '/'))
      return normalized.slice(this.basePath.length + 1);
    // Strip leading slash
    return normalized.replace(/^\//, '');
  }
}
