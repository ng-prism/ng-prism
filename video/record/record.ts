// Builds the core and plugins, then video-lib's styleguide, serves it on STYLEGUIDE_PORT and records shots into
// out/recordings/.
//
//   node record/record.ts                 every shot
//   node record/record.ts --shot reveal   only these (repeatable); the manifest keeps the others
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { hashSources, REPO_ROOT, SOURCE_PATHS, type RecordingsManifest } from '../src/lib/recordings.ts';
import { recordShot } from './recorder.ts';
import { buildPackages, buildStyleguide, serveStatic, STYLEGUIDE_DIST, STYLEGUIDE_PORT } from './serve.ts';
import { SHOTS, shotById } from './shots/index.ts';

export const RECORDINGS_DIR = join(REPO_ROOT, 'video/out/recordings');
const MANIFEST = join(RECORDINGS_DIR, 'manifest.json');

const { values } = parseArgs({ options: { shot: { type: 'string', multiple: true } } });
const shots = values.shot?.length ? values.shot.map(shotById) : [...SHOTS];

console.log('Building the core and plugins …');
await buildPackages();
console.log('Building video-lib:prism-build …');
await buildStyleguide();
const sourceHash = await hashSources(SOURCE_PATHS);
const server = await serveStatic(STYLEGUIDE_DIST, STYLEGUIDE_PORT);
try {
    const previous: RecordingsManifest | null = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
    // Recordings from other sources are worth nothing next to new ones: start over instead of mixing them. A shot that
    // is no longer registered drops out.
    const isKept = (id: string) => SHOTS.some((s) => s.id === id) && !shots.some((s) => s.id === id);
    const kept = previous?.sourceHash === sourceHash ? previous.shots.filter((shot) => isKept(shot.id)) : [];
    const recorded = [];
    for (const shot of shots) {
        console.log(`Recording ${shot.id} …`);
        const info = await recordShot(shot, server.url, RECORDINGS_DIR);
        console.log(`  ${info.file}: ${info.durationSec.toFixed(2)} s`);
        recorded.push(info);
    }
    const manifest: RecordingsManifest = { sourceHash, recordedAt: new Date().toISOString(), shots: [...kept, ...recorded].sort((a, b) => a.id.localeCompare(b.id)) };
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 4) + '\n');
} finally {
    await server.close();
}
