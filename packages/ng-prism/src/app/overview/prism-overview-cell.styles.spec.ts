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
});
