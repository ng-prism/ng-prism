import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE, FONTS, capHtml } from '../lib/look.mjs';
import { TL, caption, composition } from '../lib/timeline.mjs';

const words = (html) => [...html.matchAll(/<span class="w([^"]*)"([^>]*)>([^<]*)<\/span>/g)].map(([, cls, attrs, text]) => ({ em: cls.includes('em'), attrs, text }));

test('caption marks the closing part', () => {
    const w = words(capHtml('x', 'Change inputs. **See it live.**'));
    assert.deepEqual(
        w.map((s) => s.text),
        ['Change ', 'inputs. ', 'See ', 'it ', 'live.']
    );
    assert.deepEqual(
        w.map((s) => s.em),
        [false, false, true, true, true]
    );
    for (const s of w.filter((s) => s.em)) assert.match(s.attrs, /background-size:300% 100%/);
    assert.deepEqual(
        w.filter((s) => s.em).map((s) => s.attrs.match(/background-position:([\d.]+)%/)[1]),
        ['0', '50', '100']
    );
});

test('caption escapes', () => {
    const html = capHtml('x', 'a < b');
    assert.equal(
        words(html)
            .map((s) => s.text)
            .join(''),
        'a &lt; b'
    );
    assert.equal(html.replace(/<[^>]*>/g, '').includes('<'), false);
});

test('composition registers its timeline', () => {
    const tl = new TL();
    caption(tl, 'intro', 0.3);
    const html = composition({ id: 'intro', dur: 4, style: '.a{}', body: '<p>hi</p>', tl });
    assert.match(html, /data-composition-id="intro"/);
    assert.match(html, /data-duration="4"/);
    assert.ok(html.includes('window.__timelines["intro"] = tl'));
    assert.ok(html.indexOf(FONTS) > -1 && html.indexOf(FONTS) < html.indexOf(BASE));
    assert.ok(html.includes('tl.fromTo("#intro-cap .w"'));
});

test('TL writes absolute positions', () => {
    assert.equal(
        new TL().ft('#a', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.234).toString(),
        'tl.fromTo("#a", {"opacity":0}, {"opacity":1,"duration":0.2}, 1.23);'
    );
});

test('fonts are local', () => {
    assert.equal(FONTS.includes('http'), false);
    assert.match(FONTS, /'Inter Prism'/);
    assert.match(FONTS, /'JBM Prism'/);
});

test('the cursor stays hidden until a beat shows it', () => {
    assert.match(BASE, /\.cur-p\{opacity:0\}/);
});
