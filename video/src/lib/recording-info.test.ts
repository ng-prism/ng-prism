import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clickAt, markAt, type RecordingInfo } from './recording-info.ts';

const info: RecordingInfo = {
    id: 'controls',
    file: 'controls.mp4',
    durationSec: 10,
    width: 3840,
    height: 2160,
    fps: 60,
    focus: [{ name: 'events-tab', at: 8.25, rect: { x: 0, y: 0, width: 10, height: 10 } }],
    clicks: [2.5, 6.1]
};

test('clickAt and markAt tell when the shot clicked and when it marked an element', () => {
    assert.equal(clickAt(info, 1), 6.1);
    assert.equal(markAt(info, 'events-tab'), 8.25);
});

test('clickAt and markAt reject a click or mark the recording does not have', () => {
    assert.throws(() => clickAt(info, 2), { message: 'The recording controls has no click 2 (it has 2)' });
    assert.throws(() => markAt(info, 'canvas'), { message: 'The recording controls has no mark "canvas"' });
});
