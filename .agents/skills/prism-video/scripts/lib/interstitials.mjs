// Short interstitials between beats (1.5–3 s, no voice line), in the light and brand look. Each returns { html, sfx }
// like a beat. New patterns in the same style are welcome; these three come with the skill.
import { GRAD, SPECTRUM, capHtml, esc, n2, words } from './look.mjs';
import { sounds } from './beats.mjs';
import { TL, caption, composition } from './timeline.mjs';

const whipIn = (tl, sel) => tl.ft(sel, { x: 300, filter: 'blur(18px)' }, { x: 0, filter: 'blur(0px)', duration: 0.3, ease: 'power3.out' }, 0);
const whipOut = (tl, sel, dur) =>
    tl.ft(
        sel,
        { x: 0, filter: 'blur(0px)', opacity: 1 },
        { x: -320, filter: 'blur(18px)', opacity: 0.3, duration: 0.26, ease: 'power3.in', immediateRender: false },
        dur - 0.26
    );
const thud = (tl, sel, at) =>
    tl.ft(
        sel,
        { y: 0 },
        {
            keyframes: [
                { y: 7, duration: 0.04 },
                { y: -5, duration: 0.04 },
                { y: 2, duration: 0.05 },
                { y: 0, duration: 0.05 }
            ],
            immediateRender: false
        },
        at
    );
const HEAD_CSS = (top) => `
.i-head{position:absolute;left:0;right:0;top:${top}px;margin:0;text-align:center;font-size:132px;font-weight:800;letter-spacing:-.045em;line-height:1.1}
.i-head .w{display:inline-block;white-space:pre}
`;

/**
 * A file chip cut in half by a slash of the spectrum, then a line slams in. spec: { id, dur, chip, head }
 * (`head` with its **closing part** in the gradient, e.g. 'No **story files.**').
 */
export function slash({ id, dur, chip, head }) {
    const s = sounds();
    const CH = 46 * 1.2 + 44,
        CWD = chip.length * 46 * 0.6 + 80 + 60;
    const slant = Math.atan(((0.62 - 0.38) * CH) / CWD);
    const style = `${HEAD_CSS(500)}
.i-chiprow{position:absolute;left:0;right:0;top:${380 - CH / 2}px;height:${CH}px}
.i-chip{position:absolute;left:${960 - CWD / 2}px;top:0;width:${CWD}px;height:${CH}px;box-sizing:border-box;padding:22px 40px 22px 100px;border-radius:20px;background:rgb(17 24 39);
 box-shadow:0 30px 80px rgb(0 0 0 / 50%),0 0 0 1px rgb(241 245 249 / 14%);font-family:'JBM Prism',monospace;font-size:46px;font-weight:500;line-height:1.2;color:#cbd5e1;white-space:nowrap}
.i-chip svg{position:absolute;left:38px;top:${CH / 2 - 24}px;width:40px;height:48px}
.i-a{clip-path:polygon(0 0,100% 0,100% 38%,0 62%)}
.i-b{clip-path:polygon(0 62%,100% 38%,100% 100%,0 100%)}
.i-slashrow{position:absolute;left:${960 - CWD / 2 - 120}px;top:380px;width:${CWD + 240}px;height:0;rotate:${n2((-slant * 180) / Math.PI)}deg}
.i-slash{position:absolute;left:0;top:-4px;width:100%;height:8px;border-radius:4px;background:${GRAD};box-shadow:0 0 18px #00cfea,0 0 46px #a20cf0;transform-origin:0 50%}
`;
    const icon = `<svg viewBox="0 0 20 24"><path d="M2 1h11l5 5v17H2z" fill="none" stroke="#7c8aa5" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 1v5h5" fill="none" stroke="#7c8aa5" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const body = `    <div class="ground"></div>
    <div class="fill" id="${id}-all" data-layout-allow-overflow>
      <div class="i-chiprow">
        <div class="i-chip i-a" id="${id}-a" data-layout-allow-overlap>${icon}${esc(chip)}</div>
        <div class="i-chip i-b" id="${id}-b" data-layout-allow-overlap>${icon}${esc(chip)}</div>
      </div>
      <div class="i-slashrow"><div class="i-slash" id="${id}-slash"></div></div>
      <p class="i-head" id="${id}-head">${words(head)}</p>
    </div>`;
    const tl = new TL();
    whipIn(tl, `#${id}-all`);
    tl.ft(`#${id}-all .i-chip`, { opacity: 0, y: -70, scale: 1.18 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'back.out(2)' }, 0.05);
    tl.ft(`#${id}-slash`, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.16, ease: 'power3.out' }, 0.5);
    tl.ft(`#${id}-slash`, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 0.78);
    tl.ft(
        `#${id}-a`,
        { x: 0, y: 0, rotation: 0, filter: 'blur(0px)' },
        { x: -90, y: -60, rotation: -5, filter: 'blur(6px)', opacity: 0, duration: 0.5, ease: 'power2.in', immediateRender: false },
        0.68
    );
    tl.ft(
        `#${id}-b`,
        { x: 0, y: 0, rotation: 0, filter: 'blur(0px)' },
        { x: 90, y: 60, rotation: 5, filter: 'blur(6px)', opacity: 0, duration: 0.5, ease: 'power2.in', immediateRender: false },
        0.68
    );
    tl.ft(
        `#${id}-head .w`,
        { opacity: 0, scale: 1.7, filter: 'blur(16px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.22, stagger: 0.12, ease: 'expo.out' },
        0.82
    );
    thud(tl, `#${id}-all`, 1.06);
    whipOut(tl, `#${id}-all`, dur);
    s.add('whoosh-short', 0, 0.35);
    s.add('whoosh', 0.48, 0.45);
    s.add('glitch-1', 0.66, 0.18, 0.6);
    s.add('impact-bass-1', 1.04, 0.55);
    s.add('whoosh-short', dur - 0.24, 0.4);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}

/**
 * One component flies into the prism; out come its variants and states on rays of the spectrum, with their real
 * values from the lifted CSS. spec: { id, dur, outs: [label, css][], cap, label = 'Save' } (outs[0] is the one that
 * flies in).
 */
export function split({ id, dur, outs, cap, label = 'Save' }) {
    const s = sounds();
    const AX = 640,
        AY = 470,
        TX = 1260;
    const MH = 170,
        MW = Math.round((MH * 556) / 437);
    const ys = outs.map((_, i) => AY + (i - (outs.length - 1) / 2) * 118);
    const btn = (st) => `<span class="s-btn" style="${st}">${esc(label)}</span>`;
    const color = (i) => SPECTRUM[Math.round((i * (SPECTRUM.length - 1)) / Math.max(1, outs.length - 1))];
    const rays = outs
        .map((_, i) => {
            const dx = TX - AX,
                dy = ys[i] - AY;
            const c = color(i);
            return `<i class="s-ray" id="${id}-r${i}" style="width:${n2(Math.hypot(dx, dy))}px;rotate:${n2((Math.atan2(dy, dx) * 180) / Math.PI)}deg;background:linear-gradient(90deg,${c},${c} 60%,transparent);box-shadow:0 0 14px ${c}"></i>`;
        })
        .join('');
    const outHtml = outs
        .map(
            ([name, st], i) =>
                `<div class="s-out" id="${id}-o${i}" style="left:${TX}px;top:${ys[i]}px">${btn(st)}<span class="s-lbl" id="${id}-l${i}" style="color:${color(i)}">${esc(name)}</span></div>`
        )
        .join('');
    const style = `
.s-btn{display:inline-block;padding:20px 40px;border:2px solid transparent;border-radius:16px;font-size:30px;font-weight:500;line-height:1;white-space:nowrap}
.s-in{position:absolute;left:0;top:${AY}px;width:0;height:0}
.s-in .s-btn{position:absolute;left:-90px;top:-36px}
.s-trail{position:absolute;left:${-AX}px;top:-3px;width:${AX}px;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,#fff);box-shadow:0 0 16px #fff,0 0 40px rgb(160 230 255 / 70%);transform-origin:100% 50%}
.s-mark{position:absolute;left:${AX - MW / 2}px;top:${AY - MH / 2}px;width:${MW}px;height:${MH}px}
.s-mark img{width:100%;height:100%}
.s-rays{position:absolute;left:${AX}px;top:${AY}px;width:0;height:0}
.s-ray{position:absolute;left:0;top:-1.5px;height:3px;transform-origin:0 50%;display:block}
.s-flash{position:absolute;left:${AX - 300}px;top:${AY - 300}px;width:600px;height:600px;border-radius:50%;background:radial-gradient(closest-side,#fff,rgb(190 240 255 / 60%) 35%,transparent);mix-blend-mode:screen}
.s-out{position:absolute;width:0;height:0}
.s-out .s-btn{position:absolute;left:-50px;top:-36px}
.s-lbl{position:absolute;left:140px;top:-26px;font-size:40px;font-weight:700;letter-spacing:-.02em;white-space:nowrap}
`;
    const body = `    <div class="ground"></div>
    <div class="fill" id="${id}-all" data-layout-allow-overflow>
      <div class="s-rays">${rays}</div>
      <div class="s-in" id="${id}-in"><div class="s-trail"></div>${btn(outs[0][1])}</div>
      <div class="s-mark" id="${id}-mark"><img src="assets/img/symbol.png" alt=""></div>
      ${outHtml}
      <div class="s-flash" id="${id}-flash" style="opacity:0"></div>
    </div>
    ${capHtml(id, cap)}`;
    const tl = new TL();
    whipIn(tl, `#${id}-all`);
    tl.ft(`#${id}-mark`, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 0.05);
    tl.ft(`#${id}-in`, { x: -150 }, { x: AX - 20, duration: 0.5, ease: 'power2.in' }, 0);
    tl.ft(`#${id}-in`, { opacity: 1 }, { opacity: 0, duration: 0.06, immediateRender: false }, 0.5);
    tl.ft(`#${id}-flash`, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.07 }, 0.5);
    tl.ft(`#${id}-flash`, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.6, duration: 0.6, ease: 'power2.out', immediateRender: false }, 0.57);
    outs.forEach((_, i) => {
        tl.ft(`#${id}-r${i}`, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'expo.out' }, 0.52 + i * 0.035);
        tl.ft(
            `#${id}-o${i}`,
            { x: AX - TX, y: AY - ys[i], scale: 0.3, opacity: 0 },
            { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'expo.out' },
            0.52 + i * 0.04
        );
        tl.ft(`#${id}-l${i}`, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }, 0.82 + i * 0.05);
    });
    caption(tl, id, 0.62);
    whipOut(tl, `#${id}-all`, dur);
    tl.ft(`#${id}-cap`, { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, dur - 0.22);
    tl.ft(`#${id}-scrim`, { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, dur - 0.22);
    s.add('whoosh', 0.02, 0.4);
    s.add('impact-bass-1', 0.5, 0.45);
    s.add('pop', 0.56, 0.3);
    s.add('whoosh-short', dur - 0.24, 0.4);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}

/**
 * A short line, its words slamming in one after the other. spec: { id, dur, text } (`text` with its **closing part**
 * in the gradient).
 */
export function kinetic({ id, dur, text }) {
    const s = sounds();
    const n = text
        .replace(/\*\*/g, '')
        .split(/(?<= )/)
        .filter(Boolean).length;
    const land = 0.25 + (n - 1) * 0.14 + 0.2;
    const style = `${HEAD_CSS(470)}
.i-line{position:absolute;left:${960 - 360}px;top:${470 + 168}px;width:720px;height:3px;background:${GRAD};box-shadow:0 0 18px #00cfea,0 0 40px #244bff}
`;
    const body = `    <div class="ground"></div>
    <div class="fill" id="${id}-all" data-layout-allow-overflow>
      <p class="i-head" id="${id}-head">${words(text)}</p>
      <div class="i-line" id="${id}-line"></div>
    </div>`;
    const tl = new TL();
    whipIn(tl, `#${id}-all`);
    tl.ft(
        `#${id}-head .w`,
        { opacity: 0, scale: 1.7, filter: 'blur(16px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.22, stagger: 0.14, ease: 'expo.out' },
        0.25
    );
    thud(tl, `#${id}-all`, land - 0.02);
    tl.ft(`#${id}-line`, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, land);
    whipOut(tl, `#${id}-all`, dur);
    s.add('whoosh-short', 0, 0.35);
    for (let i = 0; i < n; i++) s.add('whoosh-short', 0.22 + i * 0.14, 0.18);
    s.add('impact-bass-1', land - 0.04, 0.55);
    s.add('whoosh-short', dur - 0.24, 0.4);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}
