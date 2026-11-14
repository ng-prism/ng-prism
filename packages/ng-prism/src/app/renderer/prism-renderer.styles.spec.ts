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
    it("paints the ground in the palette's Canvas under forced colors, over every [data-bg] rule that follows it", () => {
        const forced = '.prism-canvas-stage[data-sim-forced]';
        const grounds = withoutComments(CANVAS_BG_STYLES)
            .split('}')
            .flatMap((block) => (block.includes('{') ? block.slice(0, block.indexOf('{')).split(',') : []))
            .map((selector) => selector.trim());

        // The keyword `Canvas` would resolve against the browser's normal palette, not the forced one.
        expect(rule(forced)).toMatch(/background-color: var\(--prism-sim-canvas\);/);
        expect(HTML.slice(HTML.indexOf('<div'), HTML.indexOf('>'))).toContain('[style.--prism-sim-canvas]="ground().canvas"');
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

/** What the specimen inherits. The ground sets the relay, and only the box the component hangs in reads it. */
describe('prism-renderer text colour', () => {
    it('takes the colour of the ground the stage paints, the theme text on grounds without one', () => {
        expect(rule('.demo-wrap')).toContain('color: var(--prism-ground-text, var(--prism-text));');
    });
});

/**
 * The width of the tool rail with a fine or a coarse pointer, from what it is made of: its buttons (all of them extra small), its
 * padding and its border. The rail sits outside the stage and sizes to its content, so no rule states the number. A touch screen
 * grows every icon button to a minimum size (`@media (pointer: coarse)` in the button's stylesheet), which widens the rail.
 * Throws when a part changes shape.
 */
function toolRailWidth(pointer: 'fine' | 'coarse'): number {
    const read = (path: string): string => withoutComments(readFileSync(join(__dirname, path), 'utf8'));
    const toolbarHtml = readFileSync(join(__dirname, '../canvas/prism-canvas-toolbar.component.html'), 'utf8');
    const toolbarCss = read('../canvas/prism-canvas-toolbar.component.css');
    const buttonCss = read('../shared/prism-icon-button.component.css');
    const rail = /^\.prism-toolrail \{([^}]*)\}/m.exec(toolbarCss)?.[1] ?? '';
    const fine = /:host\(\.prism-icon-button--xs\) \{[^}]*width: (\d+)px/.exec(buttonCss)?.[1];
    const coarse = /@media \(pointer: coarse\) \{[^{]*:host\(\.prism-icon-button--xs\)[^{]*\{[^}]*min-width: (\d+)px/.exec(buttonCss)?.[1];
    const space = /'--sp-2': '(\d+)px'/.exec(readFileSync(join(__dirname, '../theme/prism-default-theme.ts'), 'utf8'))?.[1];

    // Every button of the rail takes the extra small size; a larger one would widen it.
    expect(toolbarHtml.match(/size="(\w+)"/g)?.every((size) => size === 'size="xs"')).toBe(true);
    expect(rail).toMatch(/padding: var\(--sp-2\);/);
    expect(rail).toMatch(/border: 1px solid/);
    // The rail itself does not change with the pointer; its buttons do.
    expect(toolbarCss).not.toMatch(/@media \(pointer: coarse\) \{[^{]*\.prism-toolrail \{/);
    if (!fine || !coarse || !space) throw new Error('a button width or the spacing token is not where the rail width is read from');

    const button = pointer === 'coarse' ? Math.max(Number(fine), Number(coarse)) : Number(fine);

    return button + 2 * Number(space) + 2 * 1;
}

/**
 * The pills the stage stacks in its top left corner. They moved off the
 * background pill's host, which positioned itself, so that a second pill could
 * sit under the first.
 */
describe('prism-renderer stage pills', () => {
    const container = '.stage-pills';

    it('stacks both pills in one container inside the capture guard', () => {
        const guard = HTML.slice(HTML.indexOf('@if (!capture.active())'), HTML.indexOf('#demoWrap'));

        expect(guard).toMatch(/<div class="stage-pills">\s*<prism-canvas-bg-pill \/>\s*<prism-sim-pill \/>\s*<\/div>/);
    });

    it('sits top left, where the background pill used to, and follows the overlay offsets', () => {
        expect(rule(container)).toMatch(/position: absolute;/);
        expect(rule(container)).toMatch(/top: var\(--prism-canvas-overlay-top, 12px\);/);
        expect(rule(container)).toMatch(/left: var\(--prism-canvas-overlay-inline, 20px\);/);
        expect(rule(container)).toMatch(/z-index: 2;/);
        expect(rule(container)).toMatch(/transition: top var\(--dur-base\), left var\(--dur-base\);/);
    });

    it('is a column that takes no pointer events itself, so only the pills do', () => {
        expect(rule(container)).toMatch(/display: flex;/);
        expect(rule(container)).toMatch(/flex-direction: column;/);
        expect(rule(container)).toMatch(/align-items: flex-start;/);
        expect(rule(container)).toMatch(/gap: var\(--sp-2\);/);
        expect(rule(container)).toMatch(/pointer-events: none;/);
    });

    /**
     * The tool rail is `z-index: 5` at the same top and the mirrored inline offset, on the right. A pill that
     * ends under it loses its Reset button to it, so the pills end a gap short of the rail.
     */
    it('stays inside the stage and clear of the tool rail, so a long label wraps instead of running under it', () => {
        expect(rule(container)).toMatch(/max-width: calc\(100% - 2 \* var\(--prism-canvas-overlay-inline, 20px\) - var\(--prism-toolrail-reserve\)\);/);
    });

    // Both insets, the rail's width, a gap. The rail has no width of its own, so it is derived from its parts.
    it('reserves the rail and a gap with a fine pointer', () => {
        const reserve = /--prism-toolrail-reserve: (\d+)px;/.exec(rule(container));

        expect(reserve).not.toBeNull();
        expect(Number(reserve![1])).toBeGreaterThanOrEqual(toolRailWidth('fine') + 8);
    });

    // A touch screen grows every icon button to 40px, and the rail with them: wider than with a mouse.
    it('reserves the wider rail and a gap with a coarse pointer', () => {
        const reserve = /@media \(pointer: coarse\) \{\s*\.stage-pills \{\s*--prism-toolrail-reserve: (\d+)px;/.exec(CSS);

        expect(reserve).not.toBeNull();
        expect(toolRailWidth('coarse')).toBeGreaterThan(toolRailWidth('fine'));
        expect(Number(reserve![1])).toBeGreaterThanOrEqual(toolRailWidth('coarse') + 8);
    });
});
