import { Injectable, signal } from '@angular/core';

/** URL query parameter that switches the Prism canvas into capture-isolation mode. */
export const CAPTURE_PARAM = 'capture';

/** Attribute set on `<html>` while capture mode is active. */
export const CAPTURE_ATTRIBUTE = 'data-prism-capture';

const STYLE_ELEMENT_ID = 'ng-prism-capture-styles';

/** Room in px capture mode leaves around a component that forces pseudo states, for a focus ring drawn outside its box. */
export const CAPTURE_PSEUDO_ROOM = 8;

/**
 * Everything capture mode makes see-through for `bg: 'transparent'`.
 *
 * A screenshot tool clips the composited page, so the stage and every painting
 * ancestor must clear together or the PNG comes back opaque. `html`, `body`,
 * the `prism-shell` host element and `.prism-body` are insurance: ng-prism
 * paints none of them, but an app stylesheet or a `:host` rule can. The
 * browser's own backdrop above `html` needs `omitBackground: true` in the runner.
 *
 * Scoped by `:has()` to a transparent stage so the other backgrounds are
 * untouched. Exported so a test can check it against the real DOM: a renamed
 * wrapper or a new painting layer makes captures opaque again, and an opaque
 * capture still looks correct.
 */
export const CAPTURE_TRANSPARENT_SELECTOR =
    `[${CAPTURE_ATTRIBUTE}] .prism-canvas-stage[data-bg='transparent'],\n` +
    `[${CAPTURE_ATTRIBUTE}] :is(html, body, prism-shell, .prism-shell, .prism-body, .prism-main, .prism-canvas-wrap):has(.prism-canvas-stage[data-bg='transparent'])`;

/**
 * Everything capture mode removes from layout so the canvas owns the viewport.
 *
 * Runners screenshot the screen coordinates of `.demo-wrap`, which is centred
 * in a scrolling stage. A component larger than the canvas extends past it,
 * and whichever sibling region paints there (ribbon, panel) leaks into the image.
 *
 * Use `display: none`, not `visibility: hidden`: a hidden box keeps its space
 * and `.prism-main`'s background paints there instead. The canvas is `flex: 1`
 * and only gets the space back once its siblings leave layout.
 *
 * Structural rather than a list of chrome selectors: at each level from the
 * shell to the canvas wrap, the child leading to the stage survives and every
 * sibling goes, so a new shell region is covered without touching this file.
 * The grid track overrides in `CAPTURE_STYLES` are required too: without them
 * the survivor lands in the first sized track and the canvas renders 52px tall
 * or 264px wide.
 *
 * Scoped by `:has(.prism-canvas-stage)`: a component page or view panel has no
 * canvas, and blanking the shell there would give an empty screenshot.
 */
const CAPTURE_CANVAS_ONLY_SELECTOR =
    `[${CAPTURE_ATTRIBUTE}] ` + `:is(.prism-shell, .prism-body, .prism-main, .prism-canvas-wrap)` + `:has(.prism-canvas-stage) > :not(:has(.prism-canvas-stage))`;

/**
 * Global stylesheet applied in capture mode.
 *
 * Document-level because emulated encapsulation would stop a renderer rule from
 * reaching the dynamically created showcase component's transitions and
 * animations.
 *
 * `background-image` is stripped because the dot/checkerboard pattern's phase
 * shifts whenever the centred component resizes; the declared colour is
 * deterministic and stays. `!important` is required to beat the component-scoped stage rules.
 * `transparent` also drops the colour, across the layers in
 * {@link CAPTURE_TRANSPARENT_SELECTOR}; alpha is per-pixel and does not shift.
 * The rules from {@link CAPTURE_CANVAS_ONLY_SELECTOR} down give the canvas the
 * whole viewport, so the background covers the capture target's whole box.
 *
 * The stage padding goes too. The stage is `height: 100%` under `content-box`,
 * so the padding makes it 64px taller than its row and centres the component
 * 32px too low. Without it the stage is the canvas, and a component is
 * contained iff it fits the viewport.
 *
 * The stage edge is `outline` plus `box-shadow`, never a border, so it does not
 * move `.demo-wrap`'s centre and shift baselines. It still paints, and with the
 * padding gone it sits flush against the component, so capture mode removes the
 * paint and keeps the geometry. {@link CAPTURE_TRANSPARENT_SELECTOR} does not
 * cover this: an outline is not a background.
 *
 * A variant that forces pseudo states (`.demo-wrap[data-pseudo]`) gets 8px of
 * room around the component. `.demo-wrap` hugs the component's box, but a focus
 * ring is drawn outside it (an `outline` with an offset, a `box-shadow` halo),
 * so a screenshot of the bare box would crop it. The negative margin takes the
 * padding back out of layout, so the component sits and sizes exactly as
 * without it, and `content-box` keeps the padding outside a `stretch` variant's
 * width. That width gives up the room where the canvas is narrower than
 * `max-width` plus the room, so the room stays inside the canvas instead of
 * being clipped on one side and scrolling on the other; from there on
 * `max-width` clamps it to the width it has without the room. Only these
 * variants: any other change to `.demo-wrap`'s box would move every existing
 * baseline.
 */
export const CAPTURE_STYLES = `
[${CAPTURE_ATTRIBUTE}] *,
[${CAPTURE_ATTRIBUTE}] *::before,
[${CAPTURE_ATTRIBUTE}] *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}

[${CAPTURE_ATTRIBUTE}] .prism-canvas-stage {
  background-image: none !important;
  padding: 0 !important;
  outline: none !important;
  box-shadow: none !important;
}

${CAPTURE_TRANSPARENT_SELECTOR} {
  background-color: transparent !important;
  background-image: none !important;
}

${CAPTURE_CANVAS_ONLY_SELECTOR} {
  display: none !important;
}

[${CAPTURE_ATTRIBUTE}] .prism-shell:has(.prism-canvas-stage) {
  grid-template-rows: minmax(0, 1fr) !important;
}

[${CAPTURE_ATTRIBUTE}] .prism-body:has(.prism-canvas-stage) {
  grid-template-columns: minmax(0, 1fr) !important;
}

[${CAPTURE_ATTRIBUTE}] .prism-canvas-wrap:has(.prism-canvas-stage) {
  grid-template-rows: minmax(0, 1fr) !important;
}

[${CAPTURE_ATTRIBUTE}] .demo-wrap[data-pseudo] {
  box-sizing: content-box !important;
  padding: ${CAPTURE_PSEUDO_ROOM}px !important;
  margin: -${CAPTURE_PSEUDO_ROOM}px !important;
}

[${CAPTURE_ATTRIBUTE}] .demo-wrap[data-pseudo][data-canvas-layout='stretch'] {
  width: calc(100% - ${2 * CAPTURE_PSEUDO_ROOM}px) !important;
}
`;

/**
 * Capture-isolation mode, for external screenshot runners.
 *
 * Keeps the declared canvas colour but strips its pattern (or clears the whole
 * paint chain for `bg: 'transparent'`), hides canvas chrome and every other
 * shell region, locks zoom to 1 and freezes animation, so a variant renders the
 * same on every run and a runner can screenshot `.demo-wrap` directly. It
 * cannot make room the viewport lacks: sizing the viewport is the runner's job.
 *
 * The flag is read once from the URL in the constructor and never written back.
 * {@link PrismUrlStateService} rebuilds the query string, so `?capture=1` leaves
 * the address bar on navigation while the mode stays on. Reading it during
 * `PrismUrlStateService.init()` instead would make zoom-locking racy:
 * `PrismCanvasService` restores persisted zoom in its own constructor, which
 * can run first.
 */
@Injectable({ providedIn: 'root' })
export class PrismCaptureService {
    private readonly _active = signal(typeof window !== 'undefined' ? parseCaptureParam(window.location.search) : false);

    /** True while the app renders for an external screenshot tool. */
    readonly active = this._active.asReadonly();

    constructor() {
        if (this._active()) this.applyToDocument();
    }

    private applyToDocument(): void {
        if (typeof document === 'undefined') return;
        document.documentElement.setAttribute(CAPTURE_ATTRIBUTE, '');
        if (document.getElementById(STYLE_ELEMENT_ID)) return;
        const style = document.createElement('style');

        style.id = STYLE_ELEMENT_ID;
        style.textContent = CAPTURE_STYLES;
        document.head.appendChild(style);
    }
}

/**
 * Parses the capture flag out of a `window.location.search` string.
 *
 * Accepts `?capture`, `?capture=1` and `?capture=true` as "on"; anything else
 * (including `?capture=0` and `?capture=false`) is "off".
 */
export function parseCaptureParam(search: string): boolean {
    const value = new URLSearchParams(search).get(CAPTURE_PARAM);

    if (value === null) return false;
    return value === '' || value === '1' || value === 'true';
}
