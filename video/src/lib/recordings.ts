// The recordings manifest (out/recordings/manifest.json) and the check that keeps old recordings from being cut to new
// code: it stores a hash of everything the styleguide is built from, and a render refuses recordings with another hash.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecordingsManifest } from './recording-info.ts';

export { RECORDING_SCALE, type FocusMark, type RecordingInfo, type RecordingsManifest } from './recording-info.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** The core and the plugins video-lib's styleguide uses (Nx project names, which are also their folders under packages/). */
export const BUILT_PACKAGES: readonly string[] = ['ng-prism', 'plugin-box-model', 'plugin-coverage', 'plugin-jsdoc', 'plugin-visual-regression'];

/** Everything the recorded styleguide is built from: video-lib and the built core and plugins it uses. */
export const SOURCE_PATHS: readonly string[] = [
    'test-workspace/projects/video-lib/src',
    'test-workspace/projects/video-lib/fixtures',
    'test-workspace/video-lib.prism.config.ts',
    ...BUILT_PACKAGES.map((name) => `packages/${name}/dist`)
].map((path) => join(REPO_ROOT, path));

/**
 * `npx` arguments that build those packages before a recording, so the recordings show the current sources and not
 * whatever an earlier build left in `dist`. Nx caches the build, so it costs nothing when nothing changed.
 */
export function buildPackagesArgs(): string[] {
    return ['nx', 'run-many', '-t', 'build', `--projects=${BUILT_PACKAGES.join(',')}`];
}

async function files(path: string): Promise<string[]> {
    if (!(await stat(path)).isDirectory()) return [path];
    const entries = await readdir(path, { withFileTypes: true });
    const nested = await Promise.all(
        entries.filter((entry) => entry.name !== 'node_modules' && !entry.name.endsWith('.map')).map((entry) => files(join(path, entry.name)))
    );
    return nested.flat();
}

/** sha256 over the files under `paths` (recursively, without source maps), keyed by their path relative to `root`. */
export async function hashSources(paths: readonly string[], root: string = REPO_ROOT): Promise<string> {
    const all = (await Promise.all(paths.map(files))).flat().sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
    const hash = createHash('sha256');
    for (const file of all) {
        hash.update(relative(root, file));
        hash.update('\0');
        hash.update(await readFile(file));
        hash.update('\0');
    }
    return hash.digest('hex');
}

export function assertFresh(manifest: RecordingsManifest, currentHash: string, requiredIds: readonly string[]): void {
    if (manifest.sourceHash !== currentHash) throw new Error(`Recordings are stale: video-lib changed since ${manifest.recordedAt}`);
    for (const id of requiredIds) {
        if (!manifest.shots.some((shot) => shot.id === id)) throw new Error(`Missing recording: ${id}`);
    }
}
