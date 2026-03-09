import type { IFileSystemService } from './IFileSystemService';

/**
 * Web implementation of IFileSystemService using the File System Access API.
 * Used automatically when window.electronAPI is not present (browser mode).
 */
export class WebFileSystemService implements IFileSystemService {
    private rootHandle: FileSystemDirectoryHandle | null = null;
    private _basePath: string = '';

    setBasePath(basePath: string): void {
        this._basePath = basePath;
    }

    getBasePath(): string {
        return this._basePath;
    }

    /**
     * Strips the basePath prefix from an input path and splits into segments.
     * Examples (basePath = "VesselData"):
     *   "VesselData/proll.ctl"              → ["proll.ctl"]
     *   "Draft=11m/GM=0.7m/bin/file.bpolar" → ["Draft=11m","GM=0.7m","bin","file.bpolar"]
     *   ""                                  → []  (root)
     */
    private resolvePathSegments(inputPath: string): string[] {
        const normalized = inputPath.replace(/\\/g, '/');
        const basePrefix = this._basePath.replace(/\\/g, '/');

        let relative = normalized;
        if (basePrefix && relative.startsWith(basePrefix + '/')) {
            relative = relative.slice(basePrefix.length + 1);
        } else if (basePrefix && relative === basePrefix) {
            relative = '';
        }

        return relative.split('/').filter(s => s.length > 0);
    }

    private async traverseToDirectory(segments: string[]): Promise<FileSystemDirectoryHandle> {
        if (!this.rootHandle) throw new Error('No folder selected. Please select a vessel data folder first.');
        let current: FileSystemDirectoryHandle = this.rootHandle;
        for (const segment of segments) {
            current = await current.getDirectoryHandle(segment);
        }
        return current;
    }

    private async traverseToFile(segments: string[]): Promise<FileSystemFileHandle> {
        if (segments.length === 0) throw new Error('No file name provided.');
        const dir = await this.traverseToDirectory(segments.slice(0, -1));
        return dir.getFileHandle(segments[segments.length - 1]);
    }

    async selectFolder(): Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }> {
        try {
            const handle = await showDirectoryPicker({ mode: 'read' });
            this.rootHandle = handle;
            this._basePath = handle.name;
            return { success: true, folderPath: handle.name };
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return { success: false, canceled: true };
            }
            return { success: false, error: String(err) };
        }
    }

    async selectControlFile(_startPath?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
        try {
            const [fileHandle] = await showOpenFilePicker({
                types: [{ description: 'Control Files', accept: { 'text/plain': ['.ctl', '.cfg'] } }],
                multiple: false,
            });
            const file = await fileHandle.getFile();
            return { success: true, filePath: `${this._basePath}/${file.name}` };
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return { success: false, canceled: true };
            }
            return { success: false, error: String(err) };
        }
    }

    async readTextFile(filePath: string): Promise<string> {
        const segments = this.resolvePathSegments(filePath);
        const fileHandle = await this.traverseToFile(segments);
        const file = await fileHandle.getFile();
        return file.text();
    }

    async readBinaryFile(filePath: string): Promise<ArrayBuffer> {
        const segments = this.resolvePathSegments(filePath);
        const fileHandle = await this.traverseToFile(segments);
        const file = await fileHandle.getFile();
        return file.arrayBuffer();
    }

    async listDirectory(dirPath: string): Promise<string[]> {
        const segments = this.resolvePathSegments(dirPath);
        const dir = await this.traverseToDirectory(segments);
        const names: string[] = [];
        for await (const name of dir.keys()) {
            names.push(name);
        }
        return names;
    }

    async fileExists(filePath: string): Promise<boolean> {
        try {
            await this.traverseToFile(this.resolvePathSegments(filePath));
            return true;
        } catch {
            return false;
        }
    }

    async directoryExists(dirPath: string): Promise<boolean> {
        try {
            await this.traverseToDirectory(this.resolvePathSegments(dirPath));
            return true;
        } catch {
            return false;
        }
    }
}
