import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingPrereqs, parseEncoders, REQUIRED_ENCODERS } from './prereqs.ts';

test('parseEncoders reads encoder names from `ffmpeg -encoders`', () => {
    const out = ' V....D libx264              libx264 H.264 / AVC\n VFS... prores_ks            Apple ProRes\n';
    assert.deepEqual(parseEncoders(out), new Set(['libx264', 'prores_ks']));
});

test('missingPrereqs names every gap', () => {
    assert.deepEqual(missingPrereqs({ nodeVersion: '22.12.0', encoders: new Set(['libx264']) }), ['Node >= 22.18.0 (found 22.12.0)', 'ffmpeg encoder prores_ks']);
});

test('the pipeline needs H.264 for the deliveries and ProRes for the masters, nothing else', () => {
    assert.deepEqual([...REQUIRED_ENCODERS], ['libx264', 'prores_ks']);
});

test('missingPrereqs is empty when all is there', () => {
    assert.deepEqual(missingPrereqs({ nodeVersion: '22.22.3', encoders: new Set(REQUIRED_ENCODERS) }), []);
});
