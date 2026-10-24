// Builds video-lib's styleguide and serves the static build for the recorder. Never on the user's ports (4400/4401),
// and never by stopping whatever already listens on a port.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { buildPackagesArgs, REPO_ROOT } from '../src/lib/recordings.ts';

export const STYLEGUIDE_PORT = 4420;
export const STYLEGUIDE_DIST = join(REPO_ROOT, 'test-workspace/dist/video-lib-prism');

/** Builds the core and the plugins the styleguide uses (`buildPackagesArgs`); rejects when the build fails. */
export function buildPackages(): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', buildPackagesArgs(), { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Building the packages failed (exit ${code}):\n${output.slice(-2000)}`))));
    });
}

/** Runs `ng run video-lib:prism-build`; rejects on a failed build and on any `⚠ ng-prism:` warning, which would mean the code on screen and the styleguide disagree. */
export function buildStyleguide(): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['ng', 'run', 'video-lib:prism-build'], { cwd: join(REPO_ROOT, 'test-workspace'), stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.on('error', reject);
        child.on('close', (code) => {
            const warnings = output.split('\n').filter((line) => line.includes('⚠ ng-prism:'));
            if (code !== 0) reject(new Error(`video-lib:prism-build failed (exit ${code}):\n${output.slice(-2000)}`));
            else if (warnings.length > 0) reject(new Error(`video-lib:prism-build printed ng-prism warnings:\n${warnings.join('\n')}`));
            else resolve();
        });
    });
}

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

/** Serves `dir` on 127.0.0.1:`port` (0 picks a free port); unknown paths get index.html. */
export function serveStatic(dir: string, port: number): Promise<{ url: string; close(): Promise<void> }> {
    const server = createServer((request, response) => {
        const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
        let file = join(dir, path);
        if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
        response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        createReadStream(file).pipe(response);
    });
    return new Promise((resolve, reject) => {
        server.once('error', (error: NodeJS.ErrnoException) => {
            reject(error.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use; stop whatever runs there or free it yourself`) : error);
        });
        server.listen(port, '127.0.0.1', () => {
            const { port: actual } = server.address() as AddressInfo;
            resolve({
                url: `http://127.0.0.1:${actual}`,
                close: () => new Promise<void>((done) => server.close(() => done()))
            });
        });
    });
}
