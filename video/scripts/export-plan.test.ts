import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mp4Args, posterArgs } from './export-plan.ts';

test('mp4Args encodes H.264 at crf 18 for the web, with AAC audio when there is any', () => {
    const args = mp4Args('in.mov', 'out.mp4');
    for (const expected of ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '+faststart', '-c:a', 'aac']) assert.ok(args.includes(expected), expected);
    assert.deepEqual(args.slice(-1), ['out.mp4']);
});

test('posterArgs takes the last frame as 8-bit RGB, not the master’s 16-bit RGBA', () => {
    const args = posterArgs('in.mov', 'poster.png');
    assert.equal(args[args.indexOf('-sseof') + 1], '-0.05');
    assert.equal(args[args.indexOf('-pix_fmt') + 1], 'rgb24');
    assert.deepEqual(args.slice(-1), ['poster.png']);
});

test('no export changes the resolution', () => {
    const all = [...mp4Args('in.mov', 'out.mp4'), ...posterArgs('in.mov', 'poster.png')];
    assert.ok(!all.some((arg) => arg.includes('scale') || arg === '-s'), JSON.stringify(all));
});
