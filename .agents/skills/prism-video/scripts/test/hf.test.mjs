import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan } from '../hf.mjs';

test('allows check, lint, snapshot, render, preview, beats, browser, doctor, timeline, info', () => {
    for (const cmd of ['check', 'lint', 'snapshot', 'render', 'preview', 'beats', 'browser', 'doctor', 'timeline', 'info']) {
        const p = plan([cmd, '--x'], {});
        assert.ok(p.bin.endsWith('node_modules/.bin/hyperframes'), p.bin);
        assert.deepEqual(p.args, [cmd, '--x']);
    }
});

test('refuses usage, publish, cloud, lambda, cloudrun, auth, feedback, upgrade, skills, events, init', () => {
    for (const cmd of ['usage', 'publish', 'cloud', 'lambda', 'cloudrun', 'auth', 'feedback', 'upgrade', 'skills', 'events', 'init']) {
        const p = plan([cmd], {});
        assert.equal(p.bin, undefined);
        assert.match(p.refused, new RegExp(`\\b${cmd}\\b`));
    }
});

test('refuses an unknown command', () => {
    assert.ok(plan(['frobnicate'], {}).refused);
    assert.ok(plan([], {}).refused);
});

test('sets the privacy env', () => {
    const { env } = plan(['lint'], { PATH: '/x', HYPERFRAMES_NO_TELEMETRY: '0' });
    assert.equal(env.HYPERFRAMES_NO_TELEMETRY, '1');
    assert.equal(env.HYPERFRAMES_NO_UPDATE_CHECK, '1');
    assert.equal(env.HYPERFRAMES_NO_AUTO_INSTALL, '1');
    assert.equal(env.PATH, '/x');
});

test('refuses options that send frames away', () => {
    assert.match(plan(['snapshot', '--at', '1', '--describe'], {}).refused, /--describe/);
    assert.match(plan(['snapshot', '--describe=Is the logo visible?'], {}).refused, /--describe/);
});
