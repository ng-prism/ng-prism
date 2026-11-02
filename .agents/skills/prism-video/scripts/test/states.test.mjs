import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { paths } from '../lib/paths.mjs';
import { loadState, prefixIds, rescope, still } from '../lib/states.mjs';
import { missingMarks, unliftedStates } from '../measure.mjs';

test('rescope', () => {
    assert.equal(rescope('.ngp .a{} :where(.ngp) b{} .ngp-body{} .ngp-x{}', 'ngv'), '.ngv .a{} :where(.ngv) b{} .ngv-body{} .ngp-x{}');
    assert.equal(rescope('.ngp .a{}', 'ngp'), '.ngp .a{}');
});

test('still', () => {
    assert.equal(still('.a{color:red;transition:color .2s;animation-name:x}'), '.a{color:red;}');
});

test('prefixIds', () => {
    const html = prefixIds('<div id="t"><svg><use href="#g"/><path fill="url(#g)"/></svg></div>', 'w1');
    assert.match(html, /id="w1-t"/);
    assert.match(html, /href="#w1-g"/);
    assert.match(html, /url\(#w1-g\)/);
});

test('loadState sets the scope and prefixes ids', () => {
    const dir = mkdtempSync(join(tmpdir(), 'states-'));
    mkdirSync(join(dir, 'video'));
    writeFileSync(join(dir, 'video', 'btn.html'), '<div class="ngp"><div class="ngp-body x" id="a"></div></div>');
    const film = { builds: { video: { scope: 'ngv', css: 'ui-video.css' } }, liftDir: (b) => join(dir, b) };
    assert.equal(loadState(film, 'video/btn', 'w0'), '<div class="ngv"><div class="ngv-body x" id="w0-a"></div></div>');
});

test('missingMarks', () => {
    assert.deepEqual(missingMarks({ btn: { a: { x: 1, y: 1, w: 1, h: 1 }, b: null } }), ['btn.b']);
});

test('unliftedStates', () => {
    const marks = { 'video/btn': { a: '.a' }, 'test/api-before': { seg: '.seg' } };
    assert.deepEqual(
        unliftedStates(marks, (f) => f.endsWith('btn.html')),
        ['test/api-before']
    );
});

test('paths', () => {
    assert.ok(paths('22.8').web.endsWith('.videos/ng-prism-22.8.mp4'));
    assert.ok(paths('tour').lift('video').endsWith('.videos/work/tour/lift/video'));
    assert.ok(paths('tour').srt.endsWith('.videos/ng-prism-tour.en.srt'));
});
