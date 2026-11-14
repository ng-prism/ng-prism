import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const withoutComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '');
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

/** The declarations of the rule `selector` opens in `css` (comments removed), whitespace collapsed. */
function rule(css: string, selector: string): string {
    const start = css.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'));

    if (start < 0) throw new Error(`${selector} not found`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start)).replace(/\s+/g, ' ');
}

const SIM_CSS = withoutComments(read('prism-sim-pill.component.css'));
const BG_CSS = withoutComments(read('prism-canvas-bg-pill.component.css'));
const OVERVIEW_HTML = read('../overview/prism-overview.component.html');
const OVERVIEW_CSS = withoutComments(read('../overview/prism-overview.component.css'));

/**
 * The pills are laid out by whoever holds them: the stage stacks them, the
 * overview puts one above its sheet. jsdom has no cascade, so these hold the
 * stylesheets to what the browser was checked against.
 */
describe('prism-sim-pill styles', () => {
    it('takes no space while it renders nothing', () => {
        // The stage's column gap counts an empty item, and so does a margin in the overview.
        expect(rule(SIM_CSS, ':host')).toMatch(/display: flex;/);
        expect(rule(SIM_CSS, ':host:empty')).toMatch(/display: none;/);
    });

    it('reads the overlay tokens with the theme as fallback, and declares none of its own', () => {
        // The stage's wrap sets them inline on the two absolute grounds; a declaration here would beat that.
        expect(SIM_CSS).not.toMatch(/--prism-canvas-overlay-[\w-]+:/);
        for (const token of ['bg', 'fg', 'muted', 'border', 'primary', 'active']) {
            expect(SIM_CSS).toMatch(new RegExp(`var\\(--prism-canvas-overlay-${token}, var\\(--prism-[\\w-]+\\)\\)`));
        }
    });

    it('takes pointer events back on the pill, as the stage container gives none', () => {
        expect(rule(SIM_CSS, '.sim-pill')).toMatch(/pointer-events: auto;/);
    });

    // A touch screen has no tooltip to read a cut-off label in, and the pill is what says what is active.
    it('wraps a label that is wider than the stage and never cuts it off', () => {
        expect(rule(SIM_CSS, '.label')).toMatch(/min-width: 0;/);
        expect(rule(SIM_CSS, '.label')).not.toMatch(/white-space: nowrap|text-overflow|overflow:/);
        expect(rule(SIM_CSS, '.sim-pill')).not.toMatch(/border-radius: 999px/);
        expect(rule(SIM_CSS, '.sim-pill')).toMatch(/border-radius: 16px;/);
    });
});

describe('prism-canvas-bg-pill styles', () => {
    it('no longer positions itself: the stage container does', () => {
        expect(rule(BG_CSS, ':host')).not.toMatch(/position:/);
        expect(rule(BG_CSS, ':host')).not.toMatch(/(top|left|z-index|transition):/);
        expect(rule(BG_CSS, ':host:empty')).toMatch(/display: none;/);
    });

    it('keeps its pill as it was', () => {
        expect(rule(BG_CSS, '.prism-bg-pill')).toMatch(/pointer-events: auto;/);
        expect(rule(BG_CSS, '.prism-bg-pill')).toMatch(/border-radius: 999px;/);
    });
});

describe('prism-overview sim pill', () => {
    it('shows the pill once, above the matrix and above the list', () => {
        const pill = OVERVIEW_HTML.indexOf('<prism-sim-pill');

        expect(pill).toBeGreaterThanOrEqual(0);
        expect(OVERVIEW_HTML.lastIndexOf('<prism-sim-pill')).toBe(pill);
        expect(pill).toBeLessThan(OVERVIEW_HTML.indexOf('<prism-overview-matrix'));
        expect(pill).toBeLessThan(OVERVIEW_HTML.indexOf('class="prism-overview"'));
    });

    it('sits in the flow, with the inset of the sheet and a small gap below', () => {
        expect(rule(OVERVIEW_CSS, '.prism-overview__sim')).toMatch(/margin: var\(--sp-6\) var\(--sp-6\) var\(--sp-4\);/);
    });

    // The overview has no tools rail: in a long list the pill is the only sign that something is simulated.
    it('stays where it is while the list scrolls, above the cells, and lets clicks beside it through', () => {
        const pill = rule(OVERVIEW_CSS, '.prism-overview__sim');

        expect(pill).toMatch(/position: sticky;/);
        expect(pill).toMatch(/top: var\(--sp-6\);/);
        expect(pill).toMatch(/z-index: 1;/);
        expect(pill).toMatch(/pointer-events: none;/);
        // Whatever a component in a cell stacks stays below the pill.
        expect(rule(OVERVIEW_CSS, '.prism-overview')).toMatch(/isolation: isolate;/);
    });

    it('trades the top padding of the list for that gap while the pill shows', () => {
        expect(rule(OVERVIEW_CSS, '.prism-overview__sim:not(:empty) + .prism-overview')).toMatch(/padding-top: 0;/);
    });
});
