import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAG, TITLE_LOCKUP, end, title } from '../lib/light.mjs';

const word = { w: 860, h: 235, xs: [0, 118, 236, 300, 420, 500, 560, 660] };
const t = (line) => title({ id: 'title', dur: 5.6, line, word });
const e = (command) => end({ id: 'end', dur: 5.5, command, word });

test('no reversed smoothstep', () => {
    const uses = FRAG.split('\n').filter((l) => l.includes('smoothstep('));
    assert.equal(uses.length, 2);
    assert.ok(uses.every((l) => /^float (rise|fall)\(/.test(l)));
});

test('release line is mono', () => {
    const { html } = t('22.8');
    assert.match(html, /<p class="t-line-txt t-ver"[^>]*>.*22\.8.*<\/p>/);
    assert.match(html, /\.t-ver\{[^}]*font-family:'JBM Prism'[^}]*font-size:56px/);
    assert.doesNotMatch(t('Your components, in **full spectrum.**').html, /class="t-line-txt t-ver"/);
});

test('end types its command', () => {
    const { html } = e('ng update @ng-prism/core');
    assert.equal([...html.matchAll(/id="end-k\d+"/g)].length, 24);
});

test('light follows the scene clock', () => {
    for (const { html } of [t('22.8'), e('ng add @ng-prism/core')]) {
        assert.ok(html.includes('onUpdate: () => renderAt(clock.t)'));
        assert.ok(!html.includes('hf-seek'));
    }
});

test('preserves the drawing buffer', () => {
    for (const { html } of [t('22.8'), e('ng add @ng-prism/core')]) assert.ok(html.includes('preserveDrawingBuffer: true'));
});

test('the lockup pose is where poster and thumbnail come from', () => {
    assert.equal(TITLE_LOCKUP, 3.4);
    assert.ok(t('22.8').sfx.some((s) => s[0] === 'impact-bass-1'));
});

test('the sheen may cover the name', () => {
    for (const { html } of [t('22.8'), e('ng add @ng-prism/core')]) {
        assert.match(html, /<p class="l-word" id="(title|end)-word" data-layout-allow-occlusion>/);
        assert.match(html, /<p class="l-word l-sheen" id="(title|end)-sheen" data-layout-allow-occlusion>/);
    }
});
