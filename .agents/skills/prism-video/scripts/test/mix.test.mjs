import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duck, layout } from '../lib/mix.mjs';
import { srt } from '../lib/srt.mjs';
import { cacheKey } from '../narrate.mjs';
import { cc0Only, credit } from '../music.mjs';

const vo = (at, text = 'x') => ({ at, text });

test('starts are cumulative', () => {
    const { total, scenes } = layout(
        [
            { id: 'title', kind: 'title', dur: 5.6 },
            { id: 'annotate', kind: 'app', dur: 10 },
            { id: 'nostory', kind: 'slash', dur: 1.9 }
        ],
        { logo: 3.42 }
    );
    assert.deepEqual(
        scenes.map((s) => s.start),
        [0, 5.6, 15.6]
    );
    assert.equal(total, 17.5);
});

test('the title gets the sonic logo', () => {
    const { lines } = layout([{ id: 'title', kind: 'title', dur: 5.6, vo: vo(2.9, 'Your components.') }], { logo: 3.42, title: 2.44 });
    assert.deepEqual(lines[0], { id: 'logo', start: 0.45, dur: 3.42, text: 'ng-prism' });
    assert.equal(lines[1].start, 2.9);
});

test('throws when a line overruns its scene', () => {
    assert.throws(
        () => layout([{ id: 'annotate', kind: 'app', dur: 10, vo: vo(0.8) }], { annotate: 9.5 }),
        (e) => e.message.includes("'annotate'") && e.message.includes('0.30 s')
    );
});

test('throws when a line runs into the next', () => {
    assert.throws(
        () =>
            layout(
                [
                    { id: 'a', kind: 'app', dur: 5, vo: vo(2) },
                    { id: 'b', kind: 'app', dur: 5, vo: vo(0) }
                ],
                { a: 3.1, b: 2 }
            ),
        (e) => e.message.includes("'a'") && e.message.includes("'b'")
    );
});

test('the sonic logo may overlap the title line', () => {
    assert.doesNotThrow(() => layout([{ id: 'title', kind: 'title', dur: 5.6, vo: vo(2.9) }], { logo: 3.42, title: 2.44 }));
});

const level = (pts, t) => {
    const i = pts.findIndex((p) => p.t > t);
    if (i < 0) return pts[pts.length - 1].v;
    if (i === 0) return pts[0].v;
    const a = pts[i - 1],
        b = pts[i];
    return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
};

test('duck levels', () => {
    const lines = [
        { id: 'logo', start: 0.45, dur: 3.42 },
        { id: 'a', start: 2.9, dur: 3 },
        { id: 'b', start: 7.4, dur: 2 },
        { id: 'c', start: 13.4, dur: 2 }
    ];
    const pts = duck(lines, 0, 20);
    assert.deepEqual(pts[0], { t: 0, v: 0.5 });
    assert.equal(level(pts, 1.5), 0.5);
    assert.equal(level(pts, 4), 0.1);
    assert.equal(level(pts, 6.6), 0.1);
    assert.equal(level(pts, 11.5), 0.3);
    assert.equal(level(pts, 14), 0.1);
    assert.equal(level(pts, 18), 0.5);
});

test('duck points are in music time', () => {
    const pts = duck([{ id: 'a', start: 2.9, dur: 1 }], 0.58, 10);
    assert.ok(pts.some((p) => p.t === 2.32 && p.v === 0.1));
});

test('srt', () => {
    const out = srt([
        { id: 'logo', start: 0.45, dur: 3.42, text: 'ng-prism' },
        { id: 'api', start: 2.9, dur: 2.44, text: 'Your J S Doc becomes N G prism pages.' },
        { id: 'title', start: 6, dur: 2, text: "What's new in twenty-two point eight.", sub: "What's new in 22.8." }
    ]);
    assert.equal(
        out,
        "1\n00:00:00,450 --> 00:00:01,950\nng-prism\n\n2\n00:00:02,900 --> 00:00:05,340\nYour JSDoc becomes ng-prism pages.\n\n3\n00:00:06,000 --> 00:00:08,000\nWhat's new in 22.8.\n"
    );
});

test('cacheKey matches the existing cache', () => {
    assert.equal(cacheKey('iP95p4xoKVk53GoZ742B', 'eleven_v4', 1, 'Try it out!'), '61e862ef96fcb02b');
});

test('cc0Only drops every other licence', () => {
    const r = cc0Only([
        { id: 1, license: 'cc0' },
        { id: 2, license: 'by' },
        { id: 3, license: 'by-nc' }
    ]);
    assert.deepEqual(
        r.map((x) => x.id),
        [1]
    );
});

test('credit records source and licence', () => {
    assert.deepEqual(
        credit({ title: 'Circuit Synthwave', creator: 'Doctor_Dreamchip', foreign_landing_url: 'https://freesound.org/s/460357' }, 'circuit-synthwave.mp3'),
        {
            file: 'circuit-synthwave.mp3',
            title: 'Circuit Synthwave',
            creator: 'Doctor_Dreamchip',
            source: 'https://freesound.org/s/460357',
            licence: 'CC0'
        }
    );
});

test('refuses what would turn into NaN', () => {
    assert.throws(() => layout([{ id: 'a', kind: 'app' }], {}), /scene 'a'.*dur/);
    assert.throws(() => layout([{ id: 'a', kind: 'app', dur: 5, vo: { t: 1, text: 'x' } }], { a: 9 }), /scene 'a'.*vo\.at/);
    assert.throws(() => layout([{ id: 'a', kind: 'app', dur: 5, vo: { at: -0.5, text: 'x' } }], { a: 1 }), /scene 'a'.*vo\.at/);
    assert.throws(() => layout([{ id: 'a', kind: 'app', dur: 5, vo: { at: 0.5, text: 'x' } }], { a: null }), /scene 'a'.*narrate/);
});

test('refuses duplicate and reserved scene ids', () => {
    assert.throws(
        () =>
            layout(
                [
                    { id: 'a', kind: 'app', dur: 5 },
                    { id: 'a', kind: 'app', dur: 5 }
                ],
                {}
            ),
        /'a'.*twice/
    );
    for (const id of ['logo', 'main', 'music']) assert.throws(() => layout([{ id, kind: 'app', dur: 5 }], {}), new RegExp(`'${id}'`));
});
