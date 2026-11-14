import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, 'prism-overview-cell.component.css'), 'utf8');

function rule(selector: string): string {
    const start = CSS.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'));

    if (start < 0) throw new Error(`${selector} not found`);
    return CSS.slice(start, CSS.indexOf('}', start));
}

/**
 * Nothing between a cell and the document root is positioned. Without a
 * containing block of its own, an absolutely positioned element inside a
 * component (a visually hidden text, say) resolves against the root, so none
 * of the scroll boxes around it clips it: a matrix row far down the panel
 * made the whole document scroll and pushed the styleguide out of the window.
 */
describe('prism-overview-cell layout', () => {
    it('should anchor what the component positions absolutely to the cell', () => {
        expect(rule('.cell__mount')).toMatch(/position:\s*relative/);
    });

    // The ground layer is `inset: 0` against its containing block: without one in
    // the cell, every cell would draw its filtered ground over the whole viewport.
    it('should anchor the ground layer of a vision simulation to the stage', () => {
        expect(rule('.cell__stage[data-sim-vision]::before')).toMatch(/position:\s*absolute/);
        expect(rule('.cell__stage[data-sim-vision]')).toMatch(/position:\s*relative/);
    });

    // The frame is an inset outline, painted before the positioned layer: the layer stays inside it.
    it('should keep the frame visible over the ground layer', () => {
        expect(rule('.cell__stage[data-sim-vision]::before')).toMatch(/clip-path:\s*inset\(1px round calc\(var\(--radius-sm\) - 1px\)\)/);
    });
});

describe('prism-overview-cell forced ground', () => {
    // The keyword `Canvas` would resolve against the browser's normal palette, not the forced one.
    it("should paint the ground in the forced palette's Canvas, which the cell binds", () => {
        const html = readFileSync(join(__dirname, 'prism-overview-cell.component.html'), 'utf8');

        expect(rule('.cell__stage[data-sim-forced]')).toMatch(/background-color:\s*var\(--prism-sim-canvas\)/);
        expect(html.slice(html.indexOf('<div'), html.indexOf('>'))).toContain('[style.--prism-sim-canvas]="ground().canvas"');
    });
});

describe('prism-overview-cell text colour', () => {
    // The ground sets the relay on the stage, and only the box the component hangs in reads it: the cell's caption and badges are chrome.
    it('should take the colour of the ground the stage paints, the theme text on grounds without one', () => {
        expect(rule('.cell__mount')).toContain('color: var(--prism-ground-text, var(--prism-text))');
    });
});
