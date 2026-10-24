import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiTypingSeconds, parseRelease, uiCamera } from './release.ts';

const shots = new Set(['look', 'service-page']);
const clip = {
    version: '22.7',
    beats: [
        { kind: 'ui', shot: 'look', caption: 'A new look. **Dark and light.**' },
        { kind: 'api', shot: 'service-page', source: 'lib/notification/notification.service.ts', caption: 'Services and pipes get **their own pages.**' }
    ]
};

test('parseRelease returns a valid description unchanged', () => {
    assert.deepEqual(parseRelease(structuredClone(clip), shots), clip);
});

test('parseRelease wants a minor version, not a full one', () => {
    assert.throws(() => parseRelease({ ...clip, version: '22.7.0' }, shots), { message: 'Version must look like 22.7' });
});

test('parseRelease wants one to three beats', () => {
    assert.throws(() => parseRelease({ ...clip, beats: [] }, shots), { message: 'A release clip has 1 to 3 beats' });
    assert.throws(() => parseRelease({ ...clip, beats: [...clip.beats, ...clip.beats] }, shots), { message: 'A release clip has 1 to 3 beats' });
});

test('parseRelease names an unknown shot and its beat', () => {
    const beats = [clip.beats[0], { ...clip.beats[1], shot: 'x' }];
    assert.throws(() => parseRelease({ ...clip, beats }, shots), { message: 'Unknown shot "x" in beat 2' });
});

test('parseRelease wants a source for an api beat', () => {
    const beats = [{ kind: 'api', shot: 'service-page', caption: 'Pages.' }];
    assert.throws(() => parseRelease({ ...clip, beats }, shots), { message: 'Beat 1 (api) needs a source' });
});

test('parseRelease wants a known kind and a caption', () => {
    assert.throws(() => parseRelease({ ...clip, beats: [{ ...clip.beats[0], kind: 'video' }] }, shots), { message: 'Beat 1 has the unknown kind "video" (ui or api)' });
    assert.throws(() => parseRelease({ ...clip, beats: [{ kind: 'ui', shot: 'look' }] }, shots), { message: 'Beat 1 needs a caption' });
});

test('parseRelease rejects a caption with unbalanced ** before anything renders', () => {
    const beats = [clip.beats[0], { ...clip.beats[1], caption: 'Services get **their own pages.' }];
    assert.throws(() => parseRelease({ ...clip, beats }, shots), { message: 'Beat 2: Unbalanced ** in "Services get **their own pages."' });
});

test('parseRelease takes a zoom up to 2 for a ui beat and up to 4 for the half-size recording of an api beat', () => {
    const zoomed = (index: number, zoom: unknown) => ({ ...clip, beats: clip.beats.map((beat, i) => (i === index ? { ...beat, zoom } : beat)) });
    assert.doesNotThrow(() => parseRelease(zoomed(0, 2), shots));
    assert.doesNotThrow(() => parseRelease(zoomed(1, 3.5), shots));
    assert.throws(() => parseRelease(zoomed(0, 2.5), shots), { message: 'Beat 1 (ui) has the zoom 2.5: above 1, at most 2' });
    assert.throws(() => parseRelease(zoomed(1, 1), shots), { message: 'Beat 2 (api) has the zoom 1: above 1, at most 4' });
    assert.throws(() => parseRelease(zoomed(0, '2'), shots), { message: 'Beat 1 (ui) has the zoom 2: above 1, at most 2' });
});

test('uiCamera moves onto the first mark after the caption and back to the whole frame before the beat ends', () => {
    const info = { id: 'copy-link', durationSec: 7, focus: [{ name: 'variant-tabs', at: 0, rect: { x: 0, y: 0, width: 10, height: 10 } }] };
    assert.deepEqual(uiCamera(info, 1.8), [
        { at: 0.6, mark: 'variant-tabs', scale: 1.8, seconds: 1 },
        { at: 5.6, seconds: 0.9 }
    ]);
    assert.deepEqual(uiCamera(info, undefined), []);
    assert.throws(() => uiCamera({ ...info, focus: [] }, 1.8), { message: 'The recording copy-link has no mark to zoom onto' });
});

test('apiTypingSeconds types a one-line decorator in 1.5 s and a longer one at the tour’s pace, 5 s at most', () => {
    assert.equal(apiTypingSeconds(1), 1.5);
    assert.ok(Math.abs(apiTypingSeconds(11) - 4.4) < 1e-9);
    assert.equal(apiTypingSeconds(30), 5);
});
