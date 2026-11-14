import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the measuring overlay sits in the stage's stack, and why it is not
 * free to move.
 *
 * The overlay shipped with no `z-index` at all, which is the one value it
 * cannot have. `.demo-wrap` is `position: relative` with a `transform` — a
 * stacking context of its own — and renders *after* `<prism-canvas-measure />`
 * in `prism-renderer.component.html`, so at `z-index: auto` the two are
 * painted in tree order and `.demo-wrap` wins. Every line and label over the
 * specimen was hidden behind it, every `pointerdown` over the specimen landed
 * on it instead of on the overlay, and alt-click anchoring — which by
 * definition requires clicking *on* an element — could not be entered at all.
 *
 * The naive repair trades that for a different bug, which is why the ceiling
 * below is asserted as hard as the floor: this is the only overlay on the
 * stage that takes pointer events across its whole area. Raised past the
 * pills it covers their Reset buttons, the failure `.vp-grip`
 * already documents; raised past the toolrail it covers the very button that
 * switches the tool off again.
 *
 * None of it is observable under jsdom — no layout, no paint, no hit testing —
 * so it is asserted against the source text, the way `viewport-css.spec.ts`
 * and `canvas-overlay-offsets.spec.ts` assert their own CSS invariants.
 */
const MEASURE_CSS = join(__dirname, 'prism-canvas-measure.component.css');
const RULERS_CSS = join(__dirname, 'prism-canvas-rulers.component.css');
const TOOLBAR_CSS = join(__dirname, 'prism-canvas-toolbar.component.css');
const RENDERER_CSS = join(__dirname, '../renderer/prism-renderer.component.css');

/** `src` with every block comment removed, so prose can never be mistaken for a rule. */
function withoutComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The declarations inside the block a selector opens. */
function block(file: string, selector: string): string {
    const src = withoutComments(readFileSync(file, 'utf-8'));
    const start = src.indexOf(selector);

    if (start === -1) throw new Error(`selector not found: ${selector}`);
    const open = src.indexOf('{', start);

    return src.slice(open, src.indexOf('}', open));
}

/** The `z-index` a rule declares, or `null` when it declares none. */
function layer(file: string, selector: string): number | null {
    const found = /z-index:\s*(-?\d+)/.exec(block(file, selector));

    return found ? Number(found[1]) : null;
}

const OVERLAY = ':host {';

describe('measuring overlay anchor preview', () => {
    /**
     * The preview has to read as weaker than the anchor it predicts.
     *
     * Holding Alt before clicking outlines whatever the click would anchor, in
     * the same dashed shape the anchor itself takes. Drawn at the same weight,
     * the click would produce no visible change at all — the outline is
     * already there and simply stops following the pointer — which is the very
     * gap the anchor outline was added to close. A lighter stroke makes the
     * click firm the outline up, so the confirmation survives.
     *
     * Only the relation is asserted, not the two numbers: the exact opacities
     * are a visual call, but the preview being the fainter of the two is the
     * behaviour, and a later tweak that inverted them would pass any test
     * written against the values alone.
     */
    it('draws the preview fainter than the anchor it predicts', () => {
        const opacity = (selector: string): number => {
            const found = /stroke-opacity:\s*([\d.]+)/.exec(block(MEASURE_CSS, selector));

            if (!found) throw new Error(`no stroke-opacity in ${selector}`);

            return Number(found[1]);
        };

        expect(opacity('.m-outline--preview')).toBeLessThan(opacity('.m-outline {'));
    });
});

describe('measuring overlay drawing surface', () => {
    /**
     * `.m-svg` has to state its own size, and `inset: 0` is not enough to give
     * it one.
     *
     * An `<svg>` is a *replaced* element, and for an absolutely positioned
     * replaced element CSS takes the used width and height from the intrinsic
     * size — 300x150 when the element declares none — rather than resolving
     * them from `left`/`right`/`top`/`bottom`. The box therefore came out
     * 300x150 in the stage's top-left corner, while the sibling `.m-labels`,
     * an ordinary `<div>`, stretched to the host exactly as the same
     * declarations promised.
     *
     * An `<svg>` also clips to its own viewport, so every line, tick, snap
     * echo and §4.5 outline outside that corner was drawn and immediately
     * thrown away — while the HTML labels, clipped by nothing, kept
     * appearing. That asymmetry is the whole of the bug: the tool printed
     * numbers with no marks to attach them to, and alt-click anchoring looked
     * dead because the dashed outline confirming it was among the discarded
     * marks.
     *
     * Verified in Chromium rather than reasoned about: with these two
     * declarations the box measures 900x600 inside a 900x600 host and the
     * line paints; without them, 300x150 and it does not. The identical trap
     * is why `prism-canvas-rulers.component.ts` sets `width` and `height` on
     * its `<canvas>` elements by hand — a `<canvas>` is replaced too.
     */
    it('gives the svg an explicit size, because inset does not size a replaced element', () => {
        const svg = block(MEASURE_CSS, '.m-svg {');

        expect(svg).toMatch(/width:\s*100%/);
        expect(svg).toMatch(/height:\s*100%/);
    });
});

describe('measuring overlay layering', () => {
    it('declares a z-index at all', () => {
        expect(layer(MEASURE_CSS, OVERLAY)).not.toBeNull();
    });

    it('sits above .demo-wrap, which declares none', () => {
        // The whole reason a z-index is needed: a positioned element with any
        // positive z-index is painted after every `z-index: auto` positioned
        // element, regardless of tree order. If `.demo-wrap` ever took one of
        // its own, this comparison stops being enough and has to become a
        // numeric one — which is exactly what this assertion is here to catch.
        expect(layer(RENDERER_CSS, '.demo-wrap {')).toBeNull();
        expect(layer(MEASURE_CSS, OVERLAY)!).toBeGreaterThan(0);
    });

    it.each([
        ['the pills', RENDERER_CSS, '.stage-pills {'],
        ['the rulers', RULERS_CSS, '.ruler-wrap {'],
        ['the viewport grips', RENDERER_CSS, '.vp-grip {'],
        ['the viewport dimension line', RENDERER_CSS, '.vp-dim {'],
        ['the toolrail', TOOLBAR_CSS, '.prism-toolrail {']
    ])('stays below %s', (_label, file, selector) => {
        const sibling = layer(file, selector);

        expect(sibling).not.toBeNull();
        expect(layer(MEASURE_CSS, OVERLAY)!).toBeLessThan(sibling!);
    });

    it('draws the anchor dashed and the target solid, per Spec 4.5', () => {
        // The two outlines are what say *which* boxes the four numbers are
        // about. Both in --prism-measure like everything else the tool draws;
        // only the anchor is dashed, and only the anchor — a second
        // dasharray, or none, and the pair stops distinguishing the two ends
        // of a one-sided reading.
        const shared = block(MEASURE_CSS, '.m-svg .m-outline {');

        expect(shared).toContain('stroke: var(--prism-measure)');
        expect(shared).toContain('fill: none');
        expect(shared).not.toContain('stroke-dasharray');
        expect(block(MEASURE_CSS, '.m-svg .m-outline--anchor {')).toContain('stroke-dasharray');
    });

    it('keeps everything it draws out of the hit test', () => {
        // The host is the layer that takes the pointer; its own SVG and label
        // layers must not, or the hit test lands on a measurement line instead
        // of on the specimen. `elementUnderPoint` walks past the host itself,
        // but it has no way to walk past a line that claims to be the thing
        // under the cursor.
        expect(block(MEASURE_CSS, '.m-svg,')).toContain('pointer-events: none');
    });
});
