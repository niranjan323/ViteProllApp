import type { IFileSystemService } from './IFileSystemService';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export interface ProjectInfo {
  name: string;
  isOwned: boolean;
}

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
  private userId: string = '';
  private isOwned: boolean = false;
  private cachedTree: string[] | null = null;

  setBasePath(basePath: string): void {
    this.basePath = basePath.replace(/\\/g, '/').replace(/\/$/, '');
    this.cachedTree = null;
  }

  setUserId(userId: string): void {
    this.userId = userId;
    this.cachedTree = null;
  }

  setIsOwned(isOwned: boolean): void {
    this.isOwned = isOwned;
    this.cachedTree = null;
  }

  getBasePath(): string {
    return this.basePath;
  }

  /** Full blob prefix: "users/{userId}/{project}" for owned, "{project}" for shared. */
  private get fullBlobPrefix(): string {
    return this.isOwned && this.userId
      ? `users/${this.userId}/${this.basePath}`
      : this.basePath;
  }

  /** Query string fragment to scope file operations to the correct user path. */
  private get userQuery(): string {
    return this.isOwned && this.userId ? `&userId=${encodeURIComponent(this.userId)}` : '';
  }

  // ─── FILE READ ──────────────────────────────────────────────────────────────

  async readBinaryFile(filePath: string): Promise<ArrayBuffer> {
    const path = this.toRelativePath(filePath);
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/file?path=${encodeURIComponent(path)}${this.userQuery}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to read binary file '${filePath}': ${response.status} ${response.statusText}`);
    return response.arrayBuffer();
  }

  async readTextFile(filePath: string): Promise<string> {
    const path = this.toRelativePath(filePath);
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/file?path=${encodeURIComponent(path)}${this.userQuery}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to read text file '${filePath}': ${response.status} ${response.statusText}`);
    return response.text();
  }

  // ─── DIRECTORY LISTING ──────────────────────────────────────────────────────

  /**
   * List direct children of dirPath within the project.
   *
   * The cached tree holds paths relative to the project root, e.g.:
   *   "croll.ctl"
   *   "Draft=11m/GM=1.5m/bin/MAXROLL_H10.0_T10.5.bpolar"
   *
   * For root listing (dirPath = '') we return unique first path segments:
   *   ["croll.ctl", "Draft=11m", "Draft=15m"]
   *
   * For a subdir like "Draft=11m" we return unique first segments after the prefix:
   *   ["GM=1.5m", "GM=2.0m"]
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    const tree = await this.getTree();
    const rel = this.toRelativePath(dirPath).replace(/\/$/, '');

    if (rel === '') {
      // Root listing — unique top-level names
      return [...new Set(tree.map(b => b.split('/')[0]))];
    }

    const prefix = rel + '/';
    return [...new Set(
      tree
        .filter(b => b.startsWith(prefix))
        .map(b => b.slice(prefix.length).split('/')[0])
        .filter(s => s !== '')
    )];
  }

  async fileExists(filePath: string): Promise<boolean> {
    const path = this.toRelativePath(filePath);
    const tree = await this.getTree();
    return tree.some(blob => blob === path);
  }

  async directoryExists(dirPath: string): Promise<boolean> {
    const path = this.toRelativePath(dirPath).replace(/\/$/, '') + '/';
    const tree = await this.getTree();
    return tree.some(blob => blob.startsWith(path));
  }

  // ─── PROJECT SELECTION ──────────────────────────────────────────────────────

  async selectFolder(): Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }> {
    return { success: false, error: 'web-select-folder-not-supported' };
  }

  /**
   * Locate the control file inside the current project.
   * Tries croll.ctl, CRoll.ctl, control.ctl in order.
   */
  async selectControlFile(_startPath?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
    if (!this.basePath)
      return { success: false, error: 'No project selected. Select a project first.' };

    for (const name of ['croll.ctl', 'CRoll.ctl', 'control.ctl']) {
      if (await this.fileExists(name))
        return { success: true, filePath: name };
    }

    return {
      success: false,
      error: `Control file not found in project '${this.basePath}'. Tried: croll.ctl, CRoll.ctl, control.ctl`,
    };
  }

  // ─── PUBLIC HELPERS ─────────────────────────────────────────────────────────

  static async listProjects(userId?: string): Promise<ProjectInfo[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const url = `${API_BASE}/api/files/projects${query}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error reaching ${url}: ${msg}`);
    }
    if (!response.ok)
      throw new Error(`Failed to list projects (${response.status}) from ${url}`);
    return response.json() as Promise<ProjectInfo[]>;
  }

  static async deleteProject(projectName: string, userId: string): Promise<void> {
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(projectName)}?userId=${encodeURIComponent(userId)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Delete failed (${response.status}): ${text}`);
    }
  }

  static async uploadFiles(projectName: string, files: File[], relativePaths: string[], ownerId?: string): Promise<void> {
    const formData = new FormData();
    files.forEach((file, i) => {
      const renamedFile = new File([file], relativePaths[i], { type: file.type });
      formData.append('files', renamedFile);
    });

    const ownerQuery = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    const response = await fetch(
      `${API_BASE}/api/files/projects/${encodeURIComponent(projectName)}/upload${ownerQuery}`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 409) throw new Error(text);
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────────

  private async getTree(): Promise<string[]> {
    if (this.cachedTree) return this.cachedTree;

    const uq = this.userQuery ? this.userQuery.slice(1) : ''; // remove leading '&'
    const url = `${API_BASE}/api/files/projects/${encodeURIComponent(this.basePath)}/tree${uq ? '?' + uq : ''}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error fetching project tree: ${msg}`);
    }

    if (!response.ok)
      throw new Error(`Failed to fetch project tree: ${response.status} ${response.statusText}`);

    const blobs: string[] = await response.json();
    // Strip the full blob prefix (e.g. "users/{userId}/{project}/" or "{project}/")
    const prefix = this.fullBlobPrefix + '/';
    this.cachedTree = blobs.map(b => b.startsWith(prefix) ? b.slice(prefix.length) : b);
    return this.cachedTree;
  }

  /** Normalise any path format to a blob-relative path (no leading slash, forward slashes). */
  private toRelativePath(filePath: string): string {
    // Normalise separators and strip absolute Windows drive prefix (C:\...)
    let normalized = filePath.replace(/\\/g, '/').replace(/^[A-Za-z]:\//, '');
    // Strip leading project prefix if the caller accidentally included it
    if (normalized.startsWith(this.basePath + '/'))
      normalized = normalized.slice(this.basePath.length + 1);
    // Strip any remaining leading slash
    return normalized.replace(/^\/+/, '');
  }
}
