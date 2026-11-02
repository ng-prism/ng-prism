// The beats between title and end card. Each takes its scene's spec and a context (`ctx.state(ref, wid)` returns a
// lifted state's HTML for window `wid`) and returns { html, sfx }: the composition, and its sounds as
// [file, at, volume, duration?] with `at` in scene time.
import { CURSOR, GRAD, capHtml, esc, n2 } from './look.mjs';
import { TL, caption, composition } from './timeline.mjs';

// JetBrains Mono advances 0.6 em per character.
const CW = (fs) => fs * 0.6;

export const mid = (r, dx = 0, dy = 0) => ({ x: n2(r.x + r.w / 2 + dx), y: n2(r.y + r.h / 2 + dy) });

// What `film.scenes(ctx)` gets: the measured boxes ('state.mark') and `mid`. Without coords (a narration run before
// measuring) every box is empty, which is enough to read the scenes' lines.
export const sceneCtx = (coords) => ({
    box(key) {
        if (!coords) return { x: 0, y: 0, w: 0, h: 0 };
        const [state, mark] = key.split('.');
        const b = coords[state]?.[mark];
        if (!b) throw new Error(`no measured mark '${key}': add it to the film's marks and run measure.mjs`);
        return b;
    },
    mid
});

export const sounds = () => {
    const list = [];
    return { list, add: (file, at, vol, dur) => list.push(dur === undefined ? [file, n2(at), vol] : [file, n2(at), vol, n2(dur)]) };
};

// ---------- camera: each key holds, then moves to the next; a drift keeps it alive after the last one
const CAM = (k) => ({ x: n2(960 - k.cx * k.z), y: n2(540 - k.cy * k.z), scale: n2(k.z * 10000) / 10000 });

function camera(tl, id, cam, dur) {
    tl.raw(`gsap.set('#${id}-cam', { transformOrigin: '0 0' });`);
    tl.ft(`#${id}-cam`, CAM(cam[0]), { ...CAM(cam[0]), duration: 0.01 }, 0);
    tl.set(`#${id}-curz`, { scale: n2(1 / cam[0].z) }, 0);
    for (let i = 1; i < cam.length; i++) {
        const a = cam[i - 1],
            b = cam[i],
            s = a.t + (a.hold || 0);
        tl.ft(`#${id}-cam`, CAM(a), { ...CAM(b), duration: n2(b.t - s), ease: 'power3.inOut', immediateRender: false }, s);
        tl.ft(`#${id}-curz`, { scale: n2(1 / a.z) }, { scale: n2(1 / b.z), duration: n2(b.t - s), ease: 'power3.inOut', immediateRender: false }, s);
    }
    const last = cam[cam.length - 1];
    if (last.drift) {
        const span = dur - last.t - (last.hold || 0);
        const [dx, dy, dz] = last.drift;
        const to = { cx: last.cx + dx * span, cy: last.cy + dy * span, z: last.z * (1 + dz * span) };
        tl.ft(`#${id}-cam`, CAM(last), { ...CAM(to), duration: n2(span), ease: 'none', immediateRender: false }, last.t + (last.hold || 0));
    }
}

// whip in from the right, whip out to the left: one motion through every cut
function whips(tl, s, sel, id, dur) {
    tl.ft(sel, { x: 300, filter: 'blur(18px)', opacity: 0.4 }, { x: 0, filter: 'blur(0px)', opacity: 1, duration: 0.32, ease: 'power3.out' }, 0);
    tl.ft(
        sel,
        { x: 0, filter: 'blur(0px)', opacity: 1 },
        { x: -300, filter: 'blur(18px)', opacity: 0.4, duration: 0.24, ease: 'power3.in', immediateRender: false },
        dur - 0.24
    );
    tl.ft(`#${id}-cap`, { opacity: 1 }, { opacity: 0, duration: 0.18, immediateRender: false }, dur - 0.2);
    tl.ft(`#${id}-scrim`, { opacity: 1 }, { opacity: 0, duration: 0.18, immediateRender: false }, dur - 0.2);
    s.add('whoosh-short', dur - 0.22, 0.4);
}

// A window per state; the first shows, the others wait for their cross-fade. `alt` is the state's HTML, or a function
// that changes the lifted HTML (an id to aim a tween at, spans for typed text).
const windows = (id, wins, ctx) =>
    wins
        .map(([ref, alt], i) => {
            const wid = `${id}-w${i}`;
            const html = typeof alt === 'string' ? alt : (alt ?? ((h) => h))(ctx.state(ref, wid));
            return `        <div id="${wid}" class="win" data-layout-ignore${i ? ' style="opacity:0"' : ''}>${html}</div>`;
        })
        .join('\n');

// one state cross-fades into the next 0.04 s after the click that causes it
const fadeWin = (tl, id, i, at) => tl.ft(`#${id}-w${i}`, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' }, at + 0.04);

const cursorHtml = (id) => `        <div class="cur" id="${id}-cur"><div class="cur-z" id="${id}-curz"><div class="cur-p" id="${id}-curp">${CURSOR}</div></div></div>`;

/**
 * The styleguide at work: lifted states in the film's window, a camera push, a cursor that clicks, cross-fades from
 * one state to the next, a highlight, the caption.
 * spec: { id, dur, wins: [ref, alt?][], cap, cam: { t, cx, cy, z, hold?, drift?: [dx, dy, dz] }[],
 *   cur?: { t, x, y }[], vis?: [in0, in1, out0?, out1?], clicks?: { t, x, y }[], his?: { name, box, at }[],
 *   fades?: { win, at }[], scan?: boolean, light?: [t0, t1], extra?: (tl, sfx) => void }
 */
export function app(spec, ctx) {
    const { id, dur, wins, cap, cam, cur, vis = [0.9, 1.2], clicks = [], his = [], fades = [], scan, light, extra } = spec;
    const tl = new TL();
    const s = sounds();
    const hiHtml = his
        .map(
            ({ name, box: r }) =>
                `        <div class="hi" id="${id}-${name}" style="left:${n2(r.x)}px;top:${n2(r.y)}px;width:${n2(r.w)}px;height:${n2(r.h)}px;opacity:0"></div>`
        )
        .join('\n');
    const scanHtml = scan
        ? `        <div id="${id}-scan" style="position:absolute;left:228px;top:90px;width:1464px;height:4px;border-radius:2px;background:${GRAD};box-shadow:0 0 22px #00cfea,0 0 60px #244bff;opacity:0"></div>`
        : '';
    const body = `    <div class="ground"></div>
    <div class="persp"><div class="fill" id="${id}-enter" data-layout-ignore>
      <div class="cam" id="${id}-cam">
${windows(id, wins, ctx)}
${scanHtml}
${hiHtml}
${clicks.map((_, i) => `        <div class="rip" id="${id}-rip${i}" style="opacity:0"></div>`).join('\n')}
${cursorHtml(id)}
      </div>
    </div></div>
    ${capHtml(id, cap)}`;
    camera(tl, id, cam, dur);
    // the cursor lives in scene space, counter-scaled against the camera so it keeps its size
    if (cur) {
        tl.ft(`#${id}-cur`, { x: cur[0].x, y: cur[0].y }, { x: cur[0].x, y: cur[0].y, duration: 0.01 }, 0);
        for (let i = 1; i < cur.length; i++) {
            const a = cur[i - 1],
                b = cur[i];
            if (a.x === b.x && a.y === b.y) continue;
            tl.ft(`#${id}-cur`, { x: a.x }, { x: b.x, duration: n2(b.t - a.t), ease: 'power2.inOut', immediateRender: false }, a.t);
            tl.ft(`#${id}-cur`, { y: a.y }, { y: b.y, duration: n2(b.t - a.t), ease: 'sine.inOut', immediateRender: false }, a.t);
        }
        tl.ft(`#${id}-curp`, { opacity: 0 }, { opacity: 1, duration: n2(vis[1] - vis[0]) }, vis[0]);
        if (vis[2] !== undefined) tl.ft(`#${id}-curp`, { opacity: 1 }, { opacity: 0, duration: n2(vis[3] - vis[2]), immediateRender: false }, vis[2]);
    }
    clicks.forEach((c, i) => {
        if (cur) {
            tl.ft(`#${id}-curp`, { scale: 1 }, { scale: 0.78, duration: 0.07, ease: 'power2.in', immediateRender: false }, c.t - 0.05);
            tl.ft(`#${id}-curp`, { scale: 0.78 }, { scale: 1, duration: 0.18, ease: 'back.out(3)', immediateRender: false }, c.t + 0.02);
        }
        tl.set(`#${id}-rip${i}`, { x: c.x, y: c.y }, 0);
        tl.ft(`#${id}-rip${i}`, { opacity: 0.95, scale: 0.25 }, { opacity: 0, scale: 1.5, duration: 0.5, ease: 'expo.out', immediateRender: false }, c.t);
        s.add('click', c.t - 0.02, 0.6);
    });
    for (const f of fades) fadeWin(tl, id, f.win, f.at);
    for (const h of his) tl.ft(`#${id}-${h.name}`, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'expo.out' }, h.at);
    // the first appearance of the styleguide: it builds from the top under a line of the spectrum
    if (scan) {
        tl.ft(
            `#${id}-w0`,
            { clipPath: 'inset(0px 0px 900px 0px round 12px)' },
            { clipPath: 'inset(0px 0px 0px 0px round 12px)', duration: 1.0, ease: 'power2.inOut' },
            0.1
        );
        tl.ft(`#${id}-scan`, { y: 0, opacity: 1 }, { y: 898, opacity: 1, duration: 1.0, ease: 'power2.inOut' }, 0.1);
        tl.ft(`#${id}-scan`, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 1.1);
    }
    // the light across the styleguide's header
    if (light) tl.ft(`#${id}-w0`, { '--sheen': '-100%' }, { '--sheen': '400%', duration: n2(light[1] - light[0]), ease: 'power2.inOut' }, light[0]);
    whips(tl, s, `#${id}-enter`, id, dur);
    caption(tl, id, 0.3);
    if (extra) extra(tl, s.add);
    return { html: composition({ id, dur, body, tl }), sfx: s.list };
}

// ---------- code
// strings green, keys cyan, decorators pink
const hl = (line) =>
    line
        .split(/('[^']*')/)
        .map((p, i) =>
            i % 2
                ? `<span class="k-s">${esc(p)}</span>`
                : esc(p)
                      .replace(/@(\w+)/g, '<span class="k-d">@$1</span>')
                      .replace(/(\w+)(?=:)/g, '<span class="k-k">$1</span>')
        )
        .join('');

const CODE_CSS = (fs, lh) => `
.k-file{margin:0 0 14px;height:18px;font-size:15px;line-height:18px;color:#7c8aa5}
.k-code{position:relative;overflow:hidden;font-size:${fs}px;line-height:${lh}px;font-weight:500;color:#cbd5e1}
.k-ln{position:relative;display:block;white-space:pre;overflow:hidden;height:${lh}px}
.k-in{display:block;white-space:pre;overflow:hidden}
.k-s{color:#86efac}.k-k{color:#67e8f9}.k-d{color:#e879f9}
.k-caret{position:absolute;left:0;top:${(lh - 22) / 2}px;width:2px;height:22px;background:#f1f5f9;box-shadow:0 0 8px #00cfea,0 0 18px rgb(0 207 234 / 60%)}
`;

/**
 * A code card on the left over a veil, the styleguide behind it: the card types one line, the window behind fades into
 * the state that line makes (cause and effect in one picture). Without a veil where the window behind is light.
 * Lines stay verbatim and never wrap; a long line runs out under the fade on the right.
 * spec: { id, dur, file, src: string[], typedLine, t0, cap, win?: { states: [before, after], after, cam? },
 *   veil = true, width = 832 }. A state is 'build/state' or [ref, alt] like an app beat's window: the styleguide always
 * shows the component, so `before` is usually the after state with what the line adds hidden (`opacity:0`).
 */
export function code(spec, ctx) {
    const { id, dur, file, src, typedLine, t0 = 1.4, cap, win, veil = true, width = 832 } = spec;
    const FS = 18,
        LH = 28,
        cw = CW(FS);
    const tl = new TL();
    const s = sounds();
    const H = 22 + 18 + 14 + src.length * LH + 26;
    const TOP = Math.round(444 - H / 2);
    const line = src[typedLine];
    const indent = line.length - line.trimStart().length;
    const typed = line.length - indent;
    const typeS = typed / 34;
    const style = `${CODE_CSS(FS, LH)}
.k-veil{position:absolute;inset:0;background:linear-gradient(90deg,rgb(8 13 25 / 97%) 0%,rgb(8 13 25 / 90%) 44%,transparent 60%)}
.k-glow{position:absolute;left:${84 + width / 2 - 560}px;top:${TOP + H / 2 - 340}px;width:1120px;height:680px;border-radius:50%;background:radial-gradient(closest-side,rgb(36 75 255 / 34%),rgb(162 12 240 / 18%) 55%,transparent);filter:blur(40px)}
.k-card{position:absolute;left:84px;top:${TOP}px;width:${width}px;padding:22px 30px 26px;box-sizing:border-box;border-radius:16px;overflow:hidden;background:rgb(13 19 42);
 box-shadow:0 30px 80px rgb(0 0 0 / 45%),0 0 0 1px rgb(241 245 249 / 12%),0 0 70px rgb(36 75 255 / 22%);font-family:'JBM Prism',monospace;transform-origin:0 50%}
.k-fade{position:absolute;right:0;top:0;bottom:0;width:110px;background:linear-gradient(90deg,transparent,rgb(13 19 42))}
`;
    const lines = src.map((l, i) => `<span class="k-ln" id="${id}-l${i}"><span class="k-in" id="${id}-i${i}">${hl(l)}</span></span>`).join('');
    const cam = win?.cam ?? [{ t: 0, cx: 960, cy: 540, z: 1 }];
    const body = `    <div class="ground"></div>
    <div class="persp"><div class="fill" id="${id}-enter" data-layout-ignore>
      <div class="cam" id="${id}-cam">
${
    win
        ? windows(
              id,
              win.states.map((st) => (Array.isArray(st) ? st : [st])),
              ctx
          )
        : ''
}
${cursorHtml(id)}
      </div>
      ${veil ? '<div class="k-veil"></div>' : ''}
      <div class="k-glow" id="${id}-glow"></div>
      <div class="k-card" id="${id}-card" data-layout-allow-overflow>
        <p class="k-file">${esc(file)}</p>
        <div class="k-code">${lines}<span class="k-caret" id="${id}-caret" style="opacity:0"></span><span class="k-fade"></span></div>
      </div>
    </div></div>
    ${capHtml(id, cap)}`;
    camera(tl, id, cam, dur);
    // the card flies in with a slight tilt and settles; its glow follows
    tl.ft(`#${id}-card`, { opacity: 0, rotationY: 22, x: -60, z: -180 }, { opacity: 1, rotationY: 0, x: 0, z: 0, duration: 0.8, ease: 'expo.out' }, 0.1);
    tl.ft(`#${id}-glow`, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.0, ease: 'power2.out' }, 0.2);
    // the line types itself at 34 characters a second, the caret ahead of it
    const w0 = n2(indent * cw),
        w1 = n2(line.length * cw);
    tl.ft(`#${id}-i${typedLine}`, { width: w0 }, { width: w1, duration: n2(typeS), ease: `steps(${typed})` }, t0);
    tl.ft(`#${id}-caret`, { x: w0, y: typedLine * LH }, { x: w1, y: typedLine * LH, duration: n2(typeS), ease: `steps(${typed})` }, t0);
    tl.ft(`#${id}-caret`, { opacity: 0 }, { opacity: 1, duration: 0.05, immediateRender: false }, t0 - 0.2);
    const end = t0 + typeS;
    for (let k = 0; k < 4; k++) tl.set(`#${id}-caret`, { opacity: k % 2 ? 1 : 0 }, end + 0.3 + k * 0.5);
    tl.set(`#${id}-caret`, { opacity: 0 }, end + 2.3);
    s.add('typing', t0, 0.32, typeS + 0.05);
    if (win) fadeWin(tl, id, 1, win.after - 0.04);
    whips(tl, s, `#${id}-enter`, id, dur);
    caption(tl, id, 0.3);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}

/**
 * The tour's opening card: a 3D card in the middle types a whole block above the code it annotates, the block stays
 * marked, a scan line runs over the card as the scanner will.
 * spec: { id, dur, file, src: string[], typed: lines typed, t0, seconds: typing time, cap }
 */
export function tourCode(spec) {
    const { id, dur, file, src, typed: TYPED, t0: T0, seconds, cap } = spec;
    const LH = 28,
        cw = CW(19);
    const s = sounds();
    const ind = (l) => l.length - l.trimStart().length;
    const typed = src.slice(0, TYPED).map((l) => l.trimStart());
    const N = typed.join('\n').length;
    const cps = N / seconds;
    let s0 = 0;
    const starts = typed.map((l) => {
        const a = s0;
        s0 += l.length + 1;
        return a;
    });
    const tAt = (k) => T0 + k / cps;
    const TEND = tAt(N);
    const SCAN = dur - 3;
    const CARD_W = 880;
    const CARD_H = 22 + 19 + 14 + src.length * LH + 26;
    const TOP = Math.round(500 - CARD_H / 2);
    const lines = src
        .map((l, i) => `<span class="k-ln" id="${id}-l${i}"${i < TYPED ? ' style="height:0"' : ''}><span class="k-in" id="${id}-i${i}">${hl(l)}</span></span>`)
        .join('');
    const style = `${CODE_CSS(19, LH)}
.t-glow{position:absolute;left:${960 - 700}px;top:${TOP + CARD_H / 2 - 380}px;width:1400px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgb(36 75 255 / 40%),rgb(162 12 240 / 22%) 55%,transparent);filter:blur(40px)}
.t-card{position:absolute;left:${960 - CARD_W / 2}px;top:${TOP}px;width:${CARD_W}px;padding:22px 34px 26px;box-sizing:border-box;border-radius:18px;background:rgb(13 19 42);
 box-shadow:0 40px 100px rgb(0 0 0 / 50%),0 0 0 1px rgb(241 245 249 / 12%);font-family:'JBM Prism',monospace;transform-origin:50% 40%}
.t-card .k-file{height:19px;font-size:16px;line-height:19px}
.t-band{position:absolute;left:-14px;right:-14px;top:0;height:${TYPED * LH}px;border-radius:10px;background:rgb(7 139 250 / 14%);box-shadow:inset 0 0 0 1px rgb(0 207 234 / 30%),0 0 40px rgb(36 75 255 / 25%);opacity:0}
.t-scan{position:absolute;left:-34px;right:-34px;top:0;height:3px;background:${GRAD};box-shadow:0 0 18px #00cfea,0 0 40px #244bff;opacity:0}
.t-scan::after{content:'';position:absolute;left:0;right:0;bottom:3px;height:120px;background:linear-gradient(to top,rgb(0 207 234 / 18%),transparent)}
.t-card .k-code{overflow:visible}
`;
    const body = `    <div class="ground"></div>
    <div class="t-glow" id="${id}-glow"></div>
    <div class="persp"><div class="t-card" id="${id}-card" data-layout-allow-overflow>
      <p class="k-file">${esc(file)}</p>
      <div class="k-code"><div class="t-band" id="${id}-band"></div>${lines}<span class="k-caret" id="${id}-caret" style="opacity:0"></span>
      <div class="t-scan" id="${id}-scan"></div></div>
    </div></div>
    ${capHtml(id, cap)}
    <div class="flash" id="${id}-in"></div>`;
    const tl = new TL();
    tl.ft(`#${id}-in`, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0);
    tl.ft(
        `#${id}-card`,
        { opacity: 0, rotationX: 26, rotationY: -18, z: -520, y: 90 },
        { opacity: 1, rotationX: 0, rotationY: 0, z: 0, y: 0, duration: 1.0, ease: 'expo.out' },
        0.12
    );
    tl.ft(`#${id}-glow`, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0.2);
    caption(tl, id, 0.35);
    // each line opens when its first key lands, then its characters appear one by one
    typed.forEach((l, i) => {
        const open = tAt(starts[i]);
        tl.ft(`#${id}-l${i}`, { height: 0 }, { height: LH, duration: 0.08, ease: 'power2.out' }, open - 0.06);
        const w0 = ind(src[i]) * cw,
            w1 = (ind(src[i]) + l.length) * cw;
        tl.ft(`#${id}-i${i}`, { width: n2(w0) }, { width: n2(w1), duration: n2(l.length / cps), ease: `steps(${l.length})` }, open);
        tl.ft(
            `#${id}-caret`,
            { x: n2(w0), y: i * LH },
            { x: n2(w1), y: i * LH, duration: n2(l.length / cps), ease: `steps(${l.length})`, immediateRender: i === 0 },
            open
        );
    });
    tl.ft(`#${id}-caret`, { opacity: 0 }, { opacity: 1, duration: 0.05 }, T0 - 0.2);
    for (let k = 0; k < 4; k++) tl.set(`#${id}-caret`, { opacity: k % 2 ? 1 : 0 }, TEND + 0.3 + k * 0.5);
    tl.set(`#${id}-caret`, { opacity: 0 }, TEND + 2.3);
    tl.ft(`#${id}-band`, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, TEND + 0.3);
    tl.set(`#${id}-scan`, { opacity: 0, y: -4 }, 0);
    tl.ft(`#${id}-scan`, { opacity: 1, y: -4 }, { opacity: 1, y: src.length * LH + 6, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, SCAN);
    tl.ft(`#${id}-scan`, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, SCAN + 1.1);
    tl.ft(`#${id}-card`, { scale: 1 }, { scale: 1.03, duration: n2(dur - 2.5), ease: 'none', immediateRender: false }, 1.1);
    tl.ft(
        `#${id}-card`,
        { opacity: 1, filter: 'blur(0px)', scale: 1.03 },
        { opacity: 0, filter: 'blur(12px)', scale: 1.22, duration: 0.45, ease: 'power3.in', immediateRender: false },
        dur - 0.45
    );
    tl.ft(`#${id}-cap`, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, dur - 0.35);
    tl.ft(`#${id}-scrim`, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, dur - 0.35);
    tl.ft(`#${id}-glow`, { opacity: 1 }, { opacity: 0, duration: 0.4, immediateRender: false }, dur - 0.4);
    for (let t = T0; t < TEND; t += 1.5) s.add('typing', t, 0.32, Math.min(1.5, TEND - t));
    s.add('whoosh-short', SCAN, 0.25);
    s.add('whoosh', dur - 0.4, 0.4);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}
