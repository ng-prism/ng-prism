// Writes a scene's GSAP timeline as script lines, and the HyperFrames composition around it. Every tween sits at an
// absolute position in the scene; nothing reads layout at play time (HyperFrames forbids it, the build measures before).
import { BASE, FONTS, n2 } from './look.mjs';

const J = (o) => JSON.stringify(o);

export class TL {
    constructor() {
        this.l = [];
    }
    ft(sel, from, to, at) {
        this.l.push(`tl.fromTo(${J(sel)}, ${J(from)}, ${J(to)}, ${n2(at)});`);
        return this;
    }
    set(sel, vars, at) {
        this.l.push(`tl.set(${J(sel)}, ${J(vars)}, ${n2(at)});`);
        return this;
    }
    raw(js) {
        this.l.push(js);
        return this;
    }
    toString() {
        return this.l.join('\n    ');
    }
}

// The caption comes in word by word with a blur; its scrim a little before.
export const caption = (tl, id, at) => {
    tl.ft(`#${id}-scrim`, { opacity: 0 }, { opacity: 1, duration: 0.35 }, at - 0.05);
    tl.ft(`#${id}-cap .w`, { opacity: 0, filter: 'blur(10px)', y: 16 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.055, ease: 'expo.out' }, at);
};

export const composition = ({ id, dur, style = '', body, tl }) => `<template>
  <style>${FONTS}${BASE}${style}</style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${n2(dur)}">
${body}
  </div>
  <script>
  (function () {
    const tl = gsap.timeline({ paused: true });
    ${tl}
    window.__timelines = window.__timelines || {};
    window.__timelines["${id}"] = tl;
  })();
  </script>
</template>
`;
