import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build, remoteRefs } from '../build.mjs';

const word = { w: 860, h: 235, xs: [0, 118, 236, 300, 420, 500, 560, 660] };

function fixture({ music = null, css = '.ngv .x{color:red;transition:color .2s}', cssName = 'ui-video.css' } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'build-'));
    mkdirSync(join(dir, 'lift/video'), { recursive: true });
    writeFileSync(join(dir, 'lift/video/mini.html'), '<div class="ngp"><a href="https://ng-prism.github.io/ng-prism/#/">docs</a><button id="b">Save</button></div>');
    writeFileSync(join(dir, 'lift/video', cssName), css);
    mkdirSync(join(dir, 'voice'));
    for (const f of ['logo.wav', 'beat.wav']) writeFileSync(join(dir, 'voice', f), 'RIFF');
    mkdirSync(join(dir, 'music'));
    writeFileSync(join(dir, 'music/track.mp3'), 'ID3');
    const film = {
        id: 'fixture',
        kind: 'release',
        line: '22.8',
        command: 'ng update @ng-prism/core',
        builds: { video: { scope: 'ngv', css: 'ui-video.css' } },
        music,
        scenes: () => [
            { id: 'title', kind: 'title', dur: 5.6 },
            { id: 'beat', kind: 'app', dur: 6, vo: { at: 0.5, text: 'Hello.' }, wins: [['video/mini']], cap: 'Mini. **Beat.**', cam: [{ t: 0, cx: 960, cy: 540, z: 1 }] },
            { id: 'end', kind: 'end', dur: 5.5 }
        ]
    };
    const out = join(dir, 'project');
    const files = build({
        film,
        coords: {},
        voice: { logo: 3.42, beat: 2 },
        words: { title: word, end: word },
        out,
        liftDir: (b) => join(dir, 'lift', b),
        voiceDir: join(dir, 'voice'),
        musicDir: join(dir, 'music')
    }).files;
    return { dir, out, files, index: readFileSync(join(out, 'index.html'), 'utf8') };
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('no remote URLs', () => {
    const { out } = fixture();
    const text = walk(out).filter((f) => /\.(html|css|js)$/.test(f));
    assert.ok(text.length > 4);
    for (const f of text) assert.deepEqual(remoteRefs(readFileSync(f, 'utf8')), [], f);
});

test('refuses a lift that loads from the network', () => {
    assert.throws(() => fixture({ css: "@import url('https://fonts.googleapis.com/css2?family=Inter');" }), /ui-video\.css/);
});

test('remoteRefs finds loads, not links', () => {
    assert.deepEqual(remoteRefs('<a href="https://x.dev">x</a><svg xmlns="http://www.w3.org/2000/svg"></svg>'), []);
    assert.equal(remoteRefs('<img src="https://x.dev/a.png">').length, 1);
    assert.equal(remoteRefs(".a{background:url( 'https://x.dev/a.png')}").length, 1);
    assert.equal(remoteRefs('<link rel="stylesheet" href="https://x.dev/a.css">').length, 1);
});

test('no music without music', () => {
    const { index, out } = fixture();
    assert.doesNotMatch(index, /data-timeline-role="music"/);
    assert.ok(!existsSync(join(out, 'assets/music')));
    assert.match(fixture({ music: { file: 'track.mp3', from: 15.485 } }).index, /data-timeline-role="music"[^>]*/);
});

test('hosts are laid out', () => {
    const starts = [...fixture().index.matchAll(/data-composition-src="compositions\/[^"]+" data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(starts, [0, 5.6, 11.6]);
});

test('writes only under out', () => {
    const { out, files } = fixture();
    assert.ok(files.length > 0);
    for (const f of files) assert.ok(f.startsWith(out + '/'), f);
});

test('lifted CSS is scoped and still', () => {
    const { out } = fixture();
    assert.equal(readFileSync(join(out, 'assets/ui-video.css'), 'utf8'), '.ngv .x{color:red;}');
});

test('stops when a build has no lifted CSS', () => {
    assert.throws(() => fixture({ cssName: 'ui-other.css' }), /build 'video' has no lifted CSS at .*ui-video\.css/);
});
