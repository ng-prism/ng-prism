import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TITLE_LOCKUP, end, title } from '../lib/cards.mjs';

const word = { w: 860, h: 235, xs: [0, 118, 236, 300, 420, 500, 560, 660] };
const t = (line) => title({ id: 'title', dur: 5.6, line, word });
const e = (command) => end({ id: 'end', dur: 5.5, command, word });
// the stage x at which a tween's `--sx` starts and ends, and when it starts
const shineOf = (html, id) => {
    const m = html.match(new RegExp(`tl\\.fromTo\\("#${id}-all", \\{"--sx":"(-?[\\d.]+)px"\\}, \\{"--sx":"(-?[\\d.]+)px","duration":([\\d.]+)[^}]*\\}, ([\\d.]+)\\);`));
    return m && { from: Number(m[1]), to: Number(m[2]), dur: Number(m[3]), at: Number(m[4]) };
};

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

test('title and end card are plain: the mark, the name, no beam and no shader', () => {
    for (const { html } of [t('22.8'), e('ng add @ng-prism/core')]) {
        assert.doesNotMatch(html, /<canvas|webgl|getContext/);
        assert.match(html, /<img id="(title|end)-img" src="assets\/img\/symbol\.png"/);
        assert.match(html, /<div class="ground"><\/div>/);
    }
});

test('one shine runs from the mark to the end of the name', () => {
    for (const [html, id] of [
        [t('22.8').html, 'title'],
        [e('ng add @ng-prism/core').html, 'end']
    ]) {
        const left = Number(html.match(new RegExp(`#${id}-mark\\{left:([\\d.]+)px`))[1]);
        const wx = Number(html.match(new RegExp(`#${id}-word,#${id}-sheen\\{left:([\\d.]+)px`))[1]);
        const s = shineOf(html, id);
        assert.ok(s, 'a tween of --sx on the scene');
        assert.ok(s.from < left, 'it starts left of the mark');
        assert.ok(s.to > wx + word.w, 'it ends right of the name');
        // both layers put the band at the same stage x
        assert.match(html, new RegExp(`#${id}-glint\\{[^}]*background-position:calc\\(var\\(--sx\\) - [\\d.]+px\\) 0`));
        assert.match(html, new RegExp(`#${id}-sheen\\{[^}]*background-position:calc\\(var\\(--sx\\) - [\\d.]+px\\) 0`));
    }
});

test('the shine stays inside the letters', () => {
    // a `background:` shorthand on the sheen would reset background-clip:text and paint a box over the name
    for (const [html, id] of [
        [t('22.8').html, 'title'],
        [e('ng add @ng-prism/core').html, 'end']
    ]) {
        assert.doesNotMatch(html, new RegExp(`#${id}-sheen\\{background:`));
        assert.match(html, /\.l-sheen\{[^}]*background-clip:text/);
    }
});

test('the lockup frame shows mark, name and line at rest', () => {
    const { html } = t('22.8');
    const s = shineOf(html, 'title');
    assert.equal(TITLE_LOCKUP, 3.4);
    assert.ok(s.at + s.dur <= TITLE_LOCKUP, 'the shine is through');
    // nothing creeps: the only scale on the scene is the exit at its end
    const scales = [...html.matchAll(/tl\.fromTo\("#title-all", \{"scale":[^;]*, ([\d.]+)\);/g)].map((m) => Number(m[1]));
    assert.deepEqual(scales, [4.85]);
});

test('the sheen may cover the name', () => {
    for (const { html } of [t('22.8'), e('ng add @ng-prism/core')]) {
        assert.match(html, /<p class="l-word" id="(title|end)-word" data-layout-allow-occlusion>/);
        assert.match(html, /<p class="l-word l-sheen" id="(title|end)-sheen" data-layout-allow-occlusion>/);
    }
});
