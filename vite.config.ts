import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';

// ── Local-data dev plugin ──────────────────────────────────────────────────────
// When LOCAL_DATA_PATH is set in .env.local, the Vite dev server intercepts
// all /api/files/... requests and serves them from a local folder on disk.
// This lets you run `npm run dev:web` without deploying to Azure.
//
// Setup: copy .env.local.example to .env.local and set LOCAL_DATA_PATH
//        to the folder that contains your vessel project sub-folders.
// ──────────────────────────────────────────────────────────────────────────────
function localDataApiPlugin(localDataPath: string | undefined) {

    return {
        name: 'local-data-api',
        configureServer(server: import('vite').ViteDevServer) {
            if (!localDataPath) return; // only active when LOCAL_DATA_PATH is set

            console.log(`\n🗂  Local data API active — reading from: ${localDataPath}\n`);

            server.middlewares.use('/api/files', (req, res, next) => {
                const url = req.url ?? '';

                try {
                    // GET /api/files/projects  →  list top-level project folders
                    if (url === '/projects' || url === '/projects/') {
                        const folders = fs.readdirSync(localDataPath, { withFileTypes: true })
                            .filter(d => d.isDirectory())
                            .map(d => d.name);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(folders));
                        return;
                    }

                    // GET /api/files/projects/{name}/tree  →  recursive file list
                    const treeMatch = url.match(/^\/projects\/([^/]+)\/tree$/);
                    if (treeMatch) {
                        const project = decodeURIComponent(treeMatch[1]);
                        const projectDir = path.join(localDataPath, project);
                        if (!fs.existsSync(projectDir)) {
                            res.statusCode = 404;
                            res.end(`Project '${project}' not found`);
                            return;
                        }
                        const files = walkDir(projectDir, projectDir);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(files));
                        return;
                    }

                    // GET /api/files/projects/{name}/file?path=...  →  read a file
                    const fileMatch = url.match(/^\/projects\/([^/]+)\/file(\?.*)?$/);
                    if (fileMatch) {
                        const project = decodeURIComponent(fileMatch[1]);
                        const qs = new URLSearchParams(fileMatch[2]?.slice(1) ?? '');
                        const filePath = qs.get('path') ?? '';
                        const fullPath = path.join(localDataPath, project, filePath);

                        if (!fs.existsSync(fullPath)) {
                            res.statusCode = 404;
                            res.end(`File not found: ${filePath}`);
                            return;
                        }

                        const ext = path.extname(fullPath).toLowerCase();
                        const isBinary = ['.bpolar', '.bin', '.dat'].includes(ext);
                        const content = fs.readFileSync(fullPath);

                        res.setHeader('Content-Type', isBinary ? 'application/octet-stream' : 'text/plain; charset=utf-8');
                        res.end(content);
                        return;
                    }

                    next();
                } catch (err) {
                    console.error('[local-data-api]', err);
                    res.statusCode = 500;
                    res.end(String(err));
                }
            });
        },
    };
}

/** Recursively walk a directory and return paths relative to rootDir */
function walkDir(dir: string, rootDir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full, rootDir));
        } else {
            results.push(path.relative(rootDir, full).replace(/\\/g, '/'));
        }
    }
    return results;
}

export default defineConfig(({ mode }) => {
    // Load ALL env vars (including non-VITE_ ones like LOCAL_DATA_PATH) from .env.local
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react(), localDataApiPlugin(env.LOCAL_DATA_PATH)],
        server: {
            open: false,
        },
        base: './',
        build: {
            outDir: 'dist',
            emptyOutDir: true,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
    };
});
