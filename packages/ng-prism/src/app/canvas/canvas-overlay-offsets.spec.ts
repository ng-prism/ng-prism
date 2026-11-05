import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Canvas overlays agree on where the stage's usable area begins.
 *
 * `.prism-canvas-stage` publishes `--prism-canvas-overlay-top` and
 * `--prism-canvas-overlay-inline`, and grows both when `[data-rulers]` puts a
 * 20px ruler band along its top and left edges. Anything floating over the
 * canvas reads those instead of hard-coding a corner.
 *
 * The pills (`.stage-pills`, which holds the background and the simulation pill)
 * inherit them, being inside the stage. The tool rail
 * cannot: capture mode's structural rule only suppresses a direct child of
 * `.prism-canvas-wrap` that does not contain the stage, so the rail has to live
 * outside it. It therefore mirrors the same two values off `canvas.rulers()`,
 * and mirrored values drift. This test is what stops them.
 *
 * If they drift, the rail stays at the no-rulers offset and switching rulers
 * on slides the ruler band underneath the buttons.
 */
const RENDERER = join(__dirname, '../renderer/prism-renderer.component.css');
const TOOLBAR = join(__dirname, 'prism-canvas-toolbar.component.css');

/** The two overlay offsets declared inside the block a selector opens. */
function offsets(file: string, selector: string): Record<string, string> {
    const src = readFileSync(file, 'utf-8');
    const start = src.indexOf(selector);

    if (start === -1) throw new Error(`selector not found: ${selector}`);
    const open = src.indexOf('{', start);
    const close = src.indexOf('}', open);
    const block = src.slice(open, close);

    const found: Record<string, string> = {};

    for (const m of block.matchAll(/(--prism-canvas-overlay-(?:top|inline))\s*:\s*([^;]+);/g)) {
        found[m[1]] = m[2].trim();
    }
    return found;
}

describe('canvas overlay offsets', () => {
    it('the stage publishes both offsets, with and without rulers', () => {
        const base = offsets(RENDERER, '.prism-canvas-stage {');
        const withRulers = offsets(RENDERER, '.prism-canvas-stage[data-rulers] {');

        expect(Object.keys(base).sort()).toEqual(['--prism-canvas-overlay-inline', '--prism-canvas-overlay-top']);
        expect(Object.keys(withRulers).sort()).toEqual(['--prism-canvas-overlay-inline', '--prism-canvas-overlay-top']);
    });

    it('rulers push the overlays further in, never nearer', () => {
        const px = (v: string) => Number.parseInt(v, 10);
        const base = offsets(RENDERER, '.prism-canvas-stage {');
        const withRulers = offsets(RENDERER, '.prism-canvas-stage[data-rulers] {');

        for (const key of Object.keys(base)) {
            expect(px(withRulers[key])).toBeGreaterThan(px(base[key]));
        }
    });

    it('the tool rail mirrors the stage exactly when rulers are on', () => {
        const stage = offsets(RENDERER, '.prism-canvas-stage[data-rulers] {');
        const rail = offsets(TOOLBAR, '.prism-toolrail.has-rulers {');

        expect(rail).toEqual(stage);
    });

    /**
     * Two overlays that anchor to the same corner do not tile. They stack, and
     * the one drawn later wins. That is how the tool rail came to sit on top of
     * the background pill: both read the same two offsets, one from `right` and
     * one from `right`. The rail is permanent and the pills are notices, so the
     * rail keeps the right corner and the pills take the left.
     */
    it('the rail and the stage pills claim opposite corners', () => {
        const renderer = readFileSync(RENDERER, 'utf-8');
        const start = renderer.indexOf('.stage-pills {');
        const pills = renderer.slice(start, renderer.indexOf('}', start));
        const rail = readFileSync(TOOLBAR, 'utf-8');

        expect(pills).toMatch(/left:\s*var\(--prism-canvas-overlay-inline/);
        expect(pills).not.toMatch(/right:\s*var\(--prism-canvas-overlay-inline/);

        expect(rail).toMatch(/right:\s*var\(--prism-canvas-overlay-inline/);
        expect(rail).not.toMatch(/left:\s*var\(--prism-canvas-overlay-inline/);
    });

    it('the tool rail falls back to the stage values when rulers are off', () => {
        const base = offsets(RENDERER, '.prism-canvas-stage {');
        const src = readFileSync(TOOLBAR, 'utf-8');

        // The rail sits outside the stage, so the custom properties do not reach
        // it and the fallback in var() is what actually applies with rulers off.
        for (const [name, value] of Object.entries(base)) {
            const prop = name.endsWith('top') ? 'top' : 'right';

            expect(src).toMatch(new RegExp(`${prop}:\\s*var\\(${name},\\s*${value}\\)`));
        }
    });
});
