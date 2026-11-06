import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Without comments, which talk about ::ng-deep too.
const CSS = readFileSync(join(__dirname, 'prism-page-renderer.component.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const LAYER = '@layer prism-page-defaults {';

/** The stylesheet without the defaults layer, matched by brace depth. */
function outsideLayer(): string {
    const start = CSS.indexOf(LAYER);

    if (start < 0) return CSS;
    let depth = 0;

    for (let i = start + LAYER.length - 1; i < CSS.length; i++) {
        if (CSS[i] === '{') depth++;
        if (CSS[i] === '}' && --depth === 0) return CSS.slice(0, start) + CSS.slice(i + 1);
    }
    throw new Error('unbalanced layer block');
}

/** The declarations of the rule outside the defaults layer whose selector list names `selector`. */
function declarations(selector: string): string {
    for (const [, selectors, body] of outsideLayer().matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (selectors.split(',').some((s) => s.trim() === selector)) return body;
    }
    throw new Error(`${selector} not found`);
}

/**
 * The typography a page gets by default reaches into the page through
 * ::ng-deep, so it also meets the consumer's global stylesheet and the
 * components a page renders. In a cascade layer it loses to every unlayered
 * style, whatever its specificity: a global `a { text-decoration: none }` or a
 * Tailwind preflight wins, as it did before these rules matched at all.
 */
describe('page renderer default typography', () => {
    it('should keep every rule that reaches into the page inside the defaults layer', () => {
        expect(CSS).toContain(LAYER);
        expect(outsideLayer()).not.toContain('::ng-deep');
    });
});

/**
 * On a phone the desktop edge took 48px of a 390px screen before the page
 * added its own. The title, a component page and a custom page share one
 * narrower edge there, so the title lines up with the page. The phone layout
 * is the attribute the app sets on <html>, as everywhere else in the app,
 * never a media query of the renderer's own.
 */
describe('page renderer edge on a phone', () => {
    it.each(['title', 'component', 'json'])('should give the %s the phone edge from a spacing token', (element) => {
        expect(declarations(`:host-context([data-prism-mobile]) .prism-page-renderer__${element}`)).toMatch(/^\s*padding:\s*var\(--sp-5\);\s*$/);
    });

    it('should not detect the phone layout with a media query', () => {
        expect(CSS).not.toContain('@media');
    });
});
