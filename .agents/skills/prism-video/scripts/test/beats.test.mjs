import assert from 'node:assert/strict';
import { test } from 'node:test';
import { app, code, sceneCtx, tourCode } from '../lib/beats.mjs';
import { kinetic, slash, split } from '../lib/interstitials.mjs';
import { esc } from '../lib/look.mjs';

const ctx = { state: (ref, wid) => `<div class="ngv"><span id="${wid}-x">${ref}</span></div>` };
const hasSfx = (sfx, want) => sfx.some((s) => s[0] === want[0] && s[1] === want[1] && s[2] === want[2]);

test('app shows each state once', () => {
    const { html } = app({ id: 'a', dur: 6, wins: [['video/btn'], ['video/btn-ghost']], cap: 'One. **Two.**', cam: [{ t: 0, cx: 960, cy: 540, z: 1 }] }, ctx);
    const wins = [...html.matchAll(/<div id="a-w(\d)" class="win"[^>]*>/g)];
    assert.equal(wins.length, 2);
    assert.doesNotMatch(wins[0][0], /opacity:0/);
    assert.match(wins[1][0], /opacity:0/);
    assert.ok(html.includes('video/btn-ghost'));
});

test('app applies a state transform', () => {
    const { html } = app({ id: 'a', dur: 6, wins: [['video/btn', (h) => h.replace('video/btn', 'changed')]], cap: 'x', cam: [{ t: 0, cx: 960, cy: 540, z: 1 }] }, ctx);
    assert.ok(html.includes('changed'));
});

test('clicks bring a ring and a sound', () => {
    const { html, sfx } = app(
        {
            id: 'a',
            dur: 6,
            wins: [['video/btn']],
            cap: 'x',
            cam: [{ t: 0, cx: 960, cy: 540, z: 1 }],
            cur: [
                { t: 0, x: 100, y: 100 },
                { t: 1, x: 200, y: 200 }
            ],
            vis: [0.9, 1.2],
            clicks: [
                { t: 1.4, x: 200, y: 200 },
                { t: 3, x: 300, y: 300 }
            ]
        },
        ctx
    );
    assert.equal([...html.matchAll(/class="rip"/g)].length, 2);
    assert.ok(hasSfx(sfx, ['click', 1.38, 0.6]));
    assert.ok(hasSfx(sfx, ['click', 2.98, 0.6]));
});

test('whips in and out', () => {
    const { sfx } = app({ id: 'a', dur: 6, wins: [['video/btn']], cap: 'x', cam: [{ t: 0, cx: 960, cy: 540, z: 1 }] }, ctx);
    assert.ok(hasSfx(sfx, ['whoosh-short', 5.78, 0.4]));
});

test('code types its line at 34 cps', () => {
    const src = ['@Showcase({', "    title: 'Field',", 'template: \'<input uiInput placeholder="x" />\'', '})'];
    const line = "    inputs: { label: 'E-Mail' } },";
    const { html } = code(
        {
            id: 'c',
            dur: 7,
            file: 'field.component.ts',
            src: [...src, line],
            typedLine: 4,
            t0: 1.4,
            cap: 'Compose. **Compiled.**',
            win: { states: ['video/compose-before', 'video/compose-after'], after: 3.45 },
            veil: true
        },
        ctx
    );
    assert.equal(line.trimStart().length, 30);
    const typed = 'abcdefghijklmnopqrstuvwxyz01234567';
    const { html: h34 } = code({ id: 'd', dur: 7, file: 'f.ts', src: [typed], typedLine: 0, t0: 1, cap: 'x', veil: false }, ctx);
    assert.match(h34, /"duration":1,"ease":"steps\(34\)"/);
    // highlight spans never nest, so a line's text ends at the first </span></span>
    const lines = [...html.matchAll(/id="c-i\d+">(.*?)<\/span><\/span>/g)].map((m) => m[1].replace(/<[^>]*>/g, ''));
    assert.deepEqual(
        lines,
        [...src, line].map((l) => esc(l))
    );
    assert.match(html, /class="k-veil"/);
    assert.match(html, /id="c-w1" class="win"[^>]*opacity:0/);
});

test('code keeps its glow off a light window', () => {
    const card = (veil) => code({ id: 'c', dur: 7, file: 'f.ts', src: ['x'], typedLine: 0, t0: 1, cap: 'x', veil }, ctx).html;
    assert.match(card(true), /class="k-glow"/);
    assert.doesNotMatch(card(false), /class="k-glow"/);
    assert.doesNotMatch(card(false), /#c-glow/);
});

test('tourCode types its block', () => {
    const { html, sfx } = tourCode(
        { id: 't', dur: 10, file: 'button.component.ts', src: ['@Showcase({', "    title: 'Button'", '})'], typed: 3, t0: 1.4, seconds: 2, cap: 'Annotate **it.**' },
        ctx
    );
    assert.match(html, /window\.__timelines\["t"\]/);
    assert.ok(sfx.some((s) => s[0] === 'typing'));
});

test('interstitials register their timeline', () => {
    for (const { html } of [
        slash({ id: 's1', dur: 1.9, chip: 'button.stories.ts', head: 'No **story files.**' }),
        split({
            id: 's2',
            dur: 2.7,
            outs: [
                ['Primary', 'background:#2563eb;color:#fff'],
                ['Ghost', 'background:#0e1524']
            ],
            cap: 'One. **Every state.**'
        }),
        kinetic({ id: 's3', dur: 2, text: 'Fast. **Really fast.**' })
    ]) {
        const id = html.match(/data-composition-id="([^"]+)"/)[1];
        assert.ok(html.includes(`window.__timelines["${id}"] = tl`), id);
    }
});

test('sceneCtx finds measured marks and names a missing one', () => {
    const c = sceneCtx({ btn: { b: { x: 10, y: 20, w: 30, h: 40 } } });
    assert.deepEqual(c.box('btn.b'), { x: 10, y: 20, w: 30, h: 40 });
    assert.deepEqual(c.mid(c.box('btn.b'), 5), { x: 30, y: 40 });
    assert.throws(() => c.box('btn.nope'), /btn\.nope/);
    assert.deepEqual(sceneCtx(null).box('btn.nope'), { x: 0, y: 0, w: 0, h: 0 });
});

test('a code card can hide what its line adds in the state before', () => {
    const { html } = code(
        {
            id: 'c',
            dur: 7,
            file: 'f.ts',
            src: ['a'],
            typedLine: 0,
            t0: 1,
            cap: 'x',
            win: { states: [['video/compose', (h) => h.replace('<span', '<span style="opacity:0"')], 'video/compose'], after: 3 }
        },
        ctx
    );
    assert.match(html, /id="c-w0" class="win"[^>]*><div class="ngv"><span style="opacity:0" id="c-w0-x">/);
    assert.match(html, /id="c-w1" class="win"[^>]*><div class="ngv"><span id="c-w1-x">/);
});

const card = (extra) => code({ id: 'c', dur: 8, file: 'f.ts', t0: 1.4, cap: 'x', typedLine: 0, ...extra }, ctx);

test('a code card fades its window when the line is typed', () => {
    const typed = 'x'.repeat(34);
    const { html } = card({ src: [typed], win: { states: ['video/a', 'video/a'] } });
    // typed from 1.4 s for 1 s, the window follows 0.1 s later
    assert.match(html, /tl\.fromTo\("#c-w1", \{"opacity":0\}, \{"opacity":1,[^}]*\}, 2\.5\);/);
});

test('a code card hides what its line adds in the window before', () => {
    const { html } = card({ src: ['a'], win: { states: ['video/a', 'video/a'], hide: ['[data-v=field]'] } });
    assert.match(html, /#c-w0 \[data-v=field\]\{opacity:0!important\}/);
    assert.doesNotMatch(html, /#c-w1 \[data-v=field\]/);
});

test('the fade on the right only comes with a line too long for the card', () => {
    assert.doesNotMatch(card({ src: ['short line'] }).html, /class="k-fade"/);
    assert.match(card({ src: ['x'.repeat(80)] }).html, /class="k-fade"/);
});
