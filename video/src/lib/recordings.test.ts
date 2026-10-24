import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertFresh, BUILT_PACKAGES, buildPackagesArgs, hashSources, REPO_ROOT, SOURCE_PATHS, type RecordingsManifest } from './recordings.ts';

test('the recorder builds exactly the packages whose build the recordings are hashed from', () => {
    const hashedDists = SOURCE_PATHS.filter((path) => path.startsWith(join(REPO_ROOT, 'packages/')));
    assert.deepEqual(
        hashedDists,
        BUILT_PACKAGES.map((name) => join(REPO_ROOT, 'packages', name, 'dist'))
    );
    assert.deepEqual(buildPackagesArgs(), ['nx', 'run-many', '-t', 'build', `--projects=${BUILT_PACKAGES.join(',')}`]);
});

const manifest: RecordingsManifest = {
    sourceHash: 'abc',
    recordedAt: '2026-10-22T20:00:00.000Z',
    shots: [{ id: 'reveal', file: 'reveal.mp4', durationSec: 7, width: 3840, height: 2160, fps: 60, focus: [], clicks: [] }]
};

test('assertFresh accepts a manifest with the current hash and every required shot', () => {
    assert.doesNotThrow(() => assertFresh(manifest, 'abc', ['reveal']));
});

test('assertFresh rejects recordings made from other sources', () => {
    assert.throws(() => assertFresh(manifest, 'def', ['reveal']), { message: 'Recordings are stale: video-lib changed since 2026-10-22T20:00:00.000Z' });
});

test('assertFresh names a missing recording', () => {
    assert.throws(() => assertFresh(manifest, 'abc', ['reveal', 'quality']), { message: 'Missing recording: quality' });
});

function tree(): string {
    const root = mkdtempSync(join(tmpdir(), 'video-hash-'));
    mkdirSync(join(root, 'lib'));
    writeFileSync(join(root, 'lib', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(root, 'lib', 'a.js.map'), '{"ignored":true}');
    writeFileSync(join(root, 'config.ts'), 'export default {};\n');
    return root;
}

test('hashSources does not depend on the order of the paths', async () => {
    const root = tree();
    assert.equal(await hashSources([join(root, 'lib'), join(root, 'config.ts')], root), await hashSources([join(root, 'config.ts'), join(root, 'lib')], root));
});

test('hashSources changes when one byte of a file changes', async () => {
    const root = tree();
    const before = await hashSources([join(root, 'lib'), join(root, 'config.ts')], root);
    writeFileSync(join(root, 'lib', 'a.ts'), 'export const a = 2;\n');
    assert.notEqual(await hashSources([join(root, 'lib'), join(root, 'config.ts')], root), before);
});

test('hashSources ignores source maps', async () => {
    const root = tree();
    const before = await hashSources([join(root, 'lib')], root);
    writeFileSync(join(root, 'lib', 'a.js.map'), '{"changed":true}');
    assert.equal(await hashSources([join(root, 'lib')], root), before);
});
