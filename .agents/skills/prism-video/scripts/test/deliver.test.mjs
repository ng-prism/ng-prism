import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clobbered, posterArgs, targets, titleOf, webArgs, youtubeArgs } from '../deliver.mjs';

const has = (args, ...seq) => args.some((_, i) => seq.every((s, k) => args[i + k] === s));

test('refuses to overwrite', () => {
    assert.deepEqual(
        clobbered(['a.mp4', 'b.png'], (p) => p === 'b.png'),
        ['b.png']
    );
});

test('tour targets include the docs', () => {
    const tour = targets('tour', 'tour');
    assert.ok(tour.some((p) => p.endsWith('docs/assets/video/tour.mp4')));
    assert.ok(tour.some((p) => p.endsWith('docs/assets/video/tour-poster.jpg')));
    const release = targets('22.8', 'release');
    assert.ok(!release.some((p) => p.includes('/docs/')));
    for (const end of ['.videos/ng-prism-22.8.mp4', '.videos/ng-prism-22.8-youtube.mp4', '.videos/ng-prism-22.8-youtube-thumbnail.png', '.videos/ng-prism-22.8.en.srt'])
        assert.ok(
            release.some((p) => p.endsWith(end)),
            end
        );
});

test('the title credits the voice', () => {
    assert.equal(titleOf('22.8'), 'ng-prism 22.8 · voice: elevenlabs.io');
});

test('web encode swaps the first frame', () => {
    const a = webArgs({ master: 'm.mp4', out: 'o.mp4', crf: 22, title: titleOf('22.8') });
    const graph = a[a.indexOf('-filter_complex') + 1];
    assert.match(graph, /trim=start=3\.4/);
    assert.match(graph, /fps=30/);
    assert.ok(has(a, '-crf', '22'));
    assert.ok(has(a, '-movflags', '+faststart'));
    assert.ok(has(a, '-metadata', 'title=ng-prism 22.8 · voice: elevenlabs.io'));
    assert.ok(has(a, '-preset', 'slow', '-tune', 'animation'));
    assert.ok(has(webArgs({ master: 'm.mp4', out: 'o.mp4', crf: 20, title: 't' }), '-crf', '20'));
    assert.ok(!a.includes('-af'));
    assert.ok(has(webArgs({ master: 'm.mp4', out: 'o.mp4', crf: 22, title: 't', loudnorm: 'loudnorm=I=-16' }), '-af', 'loudnorm=I=-16'));
});

test('youtube is 1440p60', () => {
    const a = youtubeArgs({ master: 'm.mp4', out: 'y.mp4', title: titleOf('tour') });
    assert.ok(a.some((x) => x.includes('scale=2560:1440:flags=lanczos')));
    assert.ok(has(a, '-r', '60'));
    assert.ok(has(a, '-crf', '18'));
    assert.ok(has(a, '-metadata', 'title=ng-prism tour · voice: elevenlabs.io'));
});

test('thumbnail and poster come from the lockup', () => {
    const t = posterArgs({ master: 'm.mp4', out: 't.png', width: 1280, height: 720 });
    assert.ok(has(t, '-ss', '3.4'));
    assert.ok(t.some((x) => x.includes('scale=1280:720')));
});

test('the docs poster is a JPEG', () => {
    const a = posterArgs({ master: 'm.mp4', out: 'tour-poster.jpg', width: 1920, height: 1080 });
    assert.ok(has(a, '-q:v', '3'));
    assert.ok(!posterArgs({ master: 'm.mp4', out: 't.png', width: 1280, height: 720 }).includes('-q:v'));
});
