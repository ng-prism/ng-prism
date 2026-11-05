import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANVAS_BG_STYLES } from '../canvas/canvas-bg.styles.js';
import { GROUND_SCROLL_X, GROUND_SCROLL_Y } from '../simulate/ground-layer.js';
import { CANVAS_AUDITING_ATTR } from './canvas-audit.js';

const withoutComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = withoutComments(readFileSync(join(__dirname, 'prism-renderer.component.css'), 'utf8'));
const HTML = readFileSync(join(__dirname, 'prism-renderer.component.html'), 'utf8');

/** The declarations of the rule `selector` opens, whitespace collapsed. */
function rule(selector: string): string {
    const start = CSS.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'));

    if (start < 0) throw new Error(`${selector} not found`);
    return CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start)).replace(/\s+/g, ' ');
}

/** Classes and attributes in a compound selector: the specificity of the stage rules, which have neither ids nor pseudo-classes. */
const weight = (selector: string): number => (selector.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length;

/**
 * How the stage paints its ground under the simulation. The renderer cannot be
 * rendered under JIT, and jsdom has no cascade, so these hold the stylesheet to
 * what the browser was checked against (see the task 8 report).
 */
describe('prism-renderer simulated ground', () => {
    it('paints the ground Canvas under forced colors, over every [data-bg] rule that follows it', () => {
        const forced = '.prism-canvas-stage[data-sim-forced]';
        const grounds = withoutComments(CANVAS_BG_STYLES)
            .split('}')
            .flatMap((block) => (block.includes('{') ? block.slice(0, block.indexOf('{')).split(',') : []))
            .map((selector) => selector.trim());

        expect(rule(forced)).toMatch(/background-color: Canvas;/);
        expect(rule(forced)).toMatch(/background-image: none;/);
        expect(grounds.length).toBeGreaterThan(0);
        // CANVAS_BG_STYLES comes after this stylesheet, so the forced rule has to outweigh it.
        for (const ground of grounds) expect(weight(forced)).toBeGreaterThan(weight(ground));
    });

    it('takes the measurement colours of the forced palette, not those of the background', () => {
        // The canvas wrap carries the palette's overlay tokens then; [data-bg="light"] and "dark" re-point them on the stage.
        expect(rule('.prism-canvas-stage[data-sim-forced]')).toMatch(/--prism-measure: inherit;/);
        expect(rule('.prism-canvas-stage[data-sim-forced]')).toMatch(/--prism-measure-plate: inherit;/);
    });

    it('draws the vision ground as a filtered copy of the stage background, under the edge', () => {
        const layer = rule('.prism-canvas-stage[data-sim-vision]::before');

        expect(layer).toMatch(/position: absolute;/);
        expect(layer).toMatch(/inset: 0;/);
        expect(layer).toMatch(/pointer-events: none;/);
        expect(layer).toMatch(/background: inherit;/);
        expect(layer).toMatch(/filter: var\(--prism-sim-filter\);/);
        // The stage's edge is an inset outline, painted before the positioned layer.
        expect(layer).toMatch(/clip-path: inset\(1px\);/);
        // The renderer binds the filter on the stage under the name the layer reads.
        expect(HTML.slice(HTML.indexOf('<div'), HTML.indexOf('>'))).toContain('[style.--prism-sim-filter]="ground().filter"');
    });

    it('keeps the vision ground over the scrolled-to part of the stage', () => {
        expect(rule('.prism-canvas-stage[data-sim-vision]::before')).toContain(`transform: translate(var(${GROUND_SCROLL_X}, 0), var(${GROUND_SCROLL_Y}, 0));`);
    });

    it('takes the vision ground away while the live audit runs', () => {
        // axe reads a positioned pseudo-element with a background behind the text as
        // covering it, and leaves every colour-contrast check undecided.
        expect(rule(`.prism-canvas-stage[data-sim-vision][${CANVAS_AUDITING_ATTR}]::before`)).toMatch(/content: none;/);
    });
});
