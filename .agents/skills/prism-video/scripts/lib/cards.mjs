// The title and the end card, kept plain (the maintainer's call: less is more): on the brand's ground the mark and the
// name come in, and one shine runs from the mark's left edge to the end of the name. The title then brings its line and
// flies into the mark; the end card types its command.
import { GRAD, esc, n2, words } from './look.mjs';
import { sounds } from './beats.mjs';
import { TL, composition } from './timeline.mjs';
const WORD = 'ng-prism';
// The shine: one band of light, slanted, that runs across mark and name in one go. Both layers place the same band at
// the same stage x (`--sx` on the scene), so it travels on unbroken from the mark's left edge to the name's end.
const BAND = 620;
// longhands only: the shorthand would reset the name's background-clip:text and paint a box
const band = (left) =>
    `background-image:linear-gradient(105deg,transparent 22%,rgb(255 255 255 / 18%) 38%,rgb(255 255 255 / 80%) 50%,rgb(255 255 255 / 18%) 62%,transparent 78%);background-repeat:no-repeat;background-size:${BAND}px 100%;background-position:calc(var(--sx) - ${n2(BAND / 2 + left)}px) 0`;
const LOCKUP_CSS = `
.l-all{--sx:-2000px}
.l-mark{position:absolute}
.l-mark img{position:absolute;inset:0;width:100%;height:100%}
.l-glint{position:absolute;inset:0;-webkit-mask:url('assets/img/symbol.png') center/contain no-repeat;mask:url('assets/img/symbol.png') center/contain no-repeat}
.l-word{position:absolute;margin:0;white-space:nowrap;font-weight:700;letter-spacing:-.04em;line-height:1.2}
.l-ch{display:inline-block;color:transparent;background-image:${GRAD};background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text}
.l-sheen{color:transparent;-webkit-background-clip:text;background-clip:text}
`;
// Mark and name side by side, centred; the name's letters share one gradient over its measured width.
const lockup = ({ id, word, fs, MH, GAP, CY }) => {
    const MW = Math.round((MH * 556) / 437);
    const left = (1920 - (MW + GAP + word.w)) / 2;
    const ML = n2(left),
        X1 = n2(left + MW / 2),
        WX = n2(left + MW + GAP),
        WY = n2(CY - word.h / 2 + fs / 32);
    const letters = WORD.split('')
        .map((ch, i) => `<span class="l-ch" style="background-size:${n2(word.w)}px 100%;background-position:${-n2(word.xs[i])}px 0">${esc(ch)}</span>`)
        .join('');
    const css = `#${id}-mark{left:${ML}px;top:${n2(CY - MH / 2)}px;width:${MW}px;height:${MH}px}
#${id}-glint{${band(ML)}}
#${id}-word,#${id}-sheen{left:${WX}px;top:${WY}px;font-size:${fs}px}
#${id}-sheen{${band(WX)}}`;
    const html = `<div class="l-mark" id="${id}-mark"><img id="${id}-img" src="assets/img/symbol.png" alt=""><div class="l-glint" id="${id}-glint"></div></div>
        <p class="l-word" id="${id}-word" data-layout-allow-occlusion>${letters}</p>
        <p class="l-word l-sheen" id="${id}-sheen" data-layout-allow-occlusion>${WORD}</p>`;
    return { MW, ML, X1, WX, WY, css, html, END: n2(WX + word.w) };
};
// mark and name come in: the mark settles out of a soft blur, the letters follow one after another; nothing moves on
// once they have landed
const arrive = (tl, id, at) => {
    tl.ft(`#${id}-mark`, { opacity: 0, scale: 0.94, filter: 'blur(10px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, at);
    tl.ft(
        `#${id}-word .l-ch`,
        { opacity: 0, y: 14, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, stagger: 0.035, ease: 'expo.out' },
        at + 0.15
    );
};
// the one shine, from the mark's left edge to the end of the name
const shine = (tl, id, L, at, dur = 1.35) =>
    tl.ft(`#${id}-all`, { '--sx': `${L.ML - BAND}px` }, { '--sx': `${L.END + BAND}px`, duration: dur, ease: 'power2.inOut' }, at);

// The second of the title where mark, name and line hold together: the web version's first frame and the thumbnail.
export const TITLE_LOCKUP = 3.4;

/**
 * The title, kept simple: on the brand's ground the mark and the name come in, one shine runs from the mark's left edge
 * to the end of the name, the line comes in under a hairline of the spectrum; at the end a flight into the mark.
 * spec: { id, dur, line, word } — `line` is the tour's slogan (Inter, with a **closing part** in the gradient) or a
 * release's version (starts with a digit: mono); `word` is the name's measured box at 196 px: { w, h, xs[] }.
 */
export function title({ id, dur, line, word }) {
    const MH = 280,
        CY = 470;
    const L = lockup({ id, word, fs: 196, MH, GAP: 62, CY });
    const version = /^\d/.test(line);
    const s = sounds();
    const IN = 0.15,
        SHINE = 1.2,
        EXIT = dur - 0.75;
    const style = `${LOCKUP_CSS}${L.css}
.t-rule{position:absolute;left:${960 - 300}px;top:${CY + 150}px;width:600px;height:2px;background:linear-gradient(90deg,transparent,#00cfea 20%,#078bfa 40%,#244bff 60%,#a20cf0 80%,transparent);box-shadow:0 0 14px rgb(36 75 255 / 80%),0 0 30px rgb(0 207 234 / 35%)}
.t-line-txt{position:absolute;left:0;right:0;top:${CY + 172}px;margin:0;text-align:center;font-size:44px;font-weight:500;letter-spacing:-.01em;color:#dbe4f0}
.t-line-txt .w{display:inline-block;white-space:pre}
.t-ver{font-family:'JBM Prism',monospace;font-size:56px;letter-spacing:.06em;top:${CY + 166}px}
`;
    const body = `    <div class="ground"></div>
    <div class="fill l-all" id="${id}-all" data-layout-allow-overflow>
        ${L.html}
        <div class="t-rule" id="${id}-rule"></div>
        <p class="t-line-txt${version ? ' t-ver' : ''}" id="${id}-line">${words(line)}</p>
    </div>
    <div class="flash" id="${id}-out" style="opacity:0"></div>`;
    const tl = new TL();
    arrive(tl, id, IN);
    shine(tl, id, L, SHINE);
    tl.ft(`#${id}-rule`, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.1);
    tl.ft(`#${id}-line .w`, { opacity: 0, filter: 'blur(8px)', y: 12 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.07, ease: 'expo.out' }, 2.25);
    // into the mark
    tl.raw(`gsap.set('#${id}-all', { transformOrigin: '${L.X1}px ${CY}px' });`);
    tl.ft(`#${id}-all`, { scale: 1, filter: 'blur(0px)' }, { scale: 9, filter: 'blur(12px)', duration: 0.75, ease: 'power3.in', immediateRender: false }, EXIT);
    tl.ft(`#${id}-out`, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.in' }, dur - 0.3);
    s.add('whoosh', IN - 0.05, 0.3);
    s.add('whoosh-short', SHINE + 0.15, 0.22);
    s.add('whoosh-cinematic', EXIT - 0.3, 0.5, 1.6);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}

/**
 * The end card, as plain as the title: mark and name come in, one shine runs across them, the command types itself into
 * its pill (`ng add @ng-prism/core` for the tour, `ng update @ng-prism/core` for a release), the address under it.
 * spec: { id, dur, command, word } — `word` is the name's measured box at 136 px.
 */
export function end({ id, dur, command, word }) {
    const MH = 190,
        CY = 420;
    const L = lockup({ id, word, fs: 136, MH, GAP: 48, CY });
    const s = sounds();
    const IN = 0.1,
        SHINE = 0.85,
        CMD = 1.35,
        T0 = CMD + 0.28;
    const cmdChars = [...command].map((ch, i) => `<span id="${id}-k${i}" style="opacity:0">${esc(ch)}</span>`).join('');
    const style = `${LOCKUP_CSS}${L.css}
.e-cmdrow{position:absolute;left:0;right:0;top:${CY + 150}px;text-align:center}
.e-cmd{display:inline-block;position:relative;margin:0;padding:24px 52px;border:3px solid transparent;border-radius:999px;font-family:'JBM Prism',monospace;font-size:46px;font-weight:500;color:#f1f5f9;
 background:linear-gradient(rgb(14 20 44 / 88%),rgb(14 20 44 / 88%)) padding-box,${GRAD} border-box;box-shadow:0 0 50px rgb(36 75 255 / 40%);white-space:pre}
.e-caret{display:inline-block;width:3px;height:48px;margin-left:4px;vertical-align:-8px;background:#f1f5f9;box-shadow:0 0 10px #00cfea}
.e-url{position:absolute;left:0;right:0;top:${CY + 300}px;margin:0;text-align:center;font-family:'JBM Prism',monospace;font-size:30px;color:#8a98b3}
`;
    const body = `    <div class="ground"></div>
    <div class="fill l-all" id="${id}-all" data-layout-allow-overflow>
        ${L.html}
        <div class="e-cmdrow"><p class="e-cmd" id="${id}-cmd">${cmdChars}<span class="e-caret" id="${id}-caret"></span></p></div>
        <p class="e-url" id="${id}-url">github.com/ng-prism/ng-prism</p>
    </div>`;
    const tl = new TL();
    arrive(tl, id, IN);
    shine(tl, id, L, SHINE);
    // the command, typed into its pill at 34 characters a second; the address under it
    tl.ft(`#${id}-cmd`, { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, CMD);
    [...command].forEach((_, i) => tl.set(`#${id}-k${i}`, { opacity: 1 }, T0 + i / 34));
    const TE = T0 + command.length / 34;
    for (let k = 0; k < 6; k++) tl.set(`#${id}-caret`, { opacity: k % 2 ? 1 : 0 }, TE + 0.25 + k * 0.5);
    tl.ft(`#${id}-url`, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, TE + 0.1);
    s.add('whoosh', 0.05, 0.3);
    s.add('whoosh-short', SHINE + 0.15, 0.22);
    s.add('typing', T0, 0.32, n2(TE - T0 + 0.05));
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}
