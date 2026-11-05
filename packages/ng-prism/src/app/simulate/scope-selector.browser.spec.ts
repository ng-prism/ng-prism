import { scopeIn, scopeOut, SIM_SCOPE, unscopeOut } from './scope-selector.js';

// Outside the scope: #theme, #a, #dark and everything in them, plus html, head and body.
// Scope roots: #wrap ([data-prism-sim]), #scopedHost ([data-prism-sim] below an outside .dark) and the
// overlay container. Inside: whatever sits below one of them.
const DOM = `
    <div id="theme" class="theme"><div id="themeB" class="b"></div></div>
    <div id="a" class="a"><div id="aB" class="b"></div></div>
    <div id="dark" class="dark"><div id="host" _nghost-x></div></div>
    <div id="wrap" class="wrap" data-prism-sim>
        <div id="wrapB" class="b"></div>
        <div id="wrapA" class="a"><div id="wrapAB" class="b"></div></div>
        <div id="wrapTheme" class="theme"><div id="wrapThemeB" class="b"></div></div>
        <div id="wrapDark" class="dark"><div id="wrapHost" _nghost-x></div></div>
    </div>
    <div id="outerDark" class="dark">
        <div id="scopedHost" data-prism-sim _nghost-x><span id="hostChild" _nghost-x></span></div>
    </div>
    <div id="overlay" class="cdk-overlay-container">
        <div id="item" class="item"></div>
        <div id="overlayB" class="b"></div>
        <div id="overlayA" class="a"><div id="overlayAB" class="b"></div></div>
    </div>
`;

/** Selectors whose subject is not the document root, so that they can reach inside the scope. */
const SELECTORS = [
    '.b',
    '.a .b',
    '.theme .b',
    '.wrap .b',
    '.wrap',
    '.cdk-overlay-container .item',
    '.cdk-overlay-container .b',
    '[data-prism-sim] .b',
    'html body .b',
    'body .b',
    'body > .theme .b',
    '.dark [_nghost-x]',
    '.dark > [_nghost-x]',
    ':is(.a, .theme) > .b',
    '.theme:not(.a) .b',
    '.a .b, .wrap .b',
    '.item',
    'div',
    '*'
];

/** Selectors whose subject is the document root, and whether the document `html` meets their conditions. */
const ROOT_SELECTORS: [string, boolean][] = [
    [':root', true],
    ['html', true],
    ['body', true],
    ['html body', true],
    [':root.dark', true],
    ['html:not(.light)', true],
    [':root:not(.dark)', false],
    ['html.light', false]
];

const describeElement = (el: Element): string => el.id || el.tagName.toLowerCase();

/** Every element of the document the selector matches, by id. */
function matched(selector: string): string[] {
    return Array.from(document.querySelectorAll('*'))
        .filter((el) => el.matches(selector))
        .map(describeElement);
}

describe('scope selectors, matched against a DOM', () => {
    let everything: Element[];

    beforeAll(() => {
        document.documentElement.classList.add('dark');
        document.body.innerHTML = DOM;
        everything = Array.from(document.querySelectorAll('*'));
    });

    afterAll(() => {
        document.documentElement.classList.remove('dark');
        document.body.innerHTML = '';
    });

    it('has the elements the table is about', () => {
        const roots = Array.from(document.querySelectorAll(SIM_SCOPE)).map(describeElement);

        expect(roots).toEqual(['wrap', 'scopedHost', 'overlay']);
        expect(everything.filter((el) => el.closest(SIM_SCOPE) === null).map(describeElement)).toContain('theme');
    });

    describe.each(SELECTORS)('%s', (selector) => {
        it('matches inside the scope with the copy, outside it with the original, and each element with one of them', () => {
            const original = matched(selector);
            const out = matched(scopeOut(selector));
            const inside = matched(scopeIn(selector));

            expect(original).not.toEqual([]);
            expect(out.filter((id) => inside.includes(id))).toEqual([]);
            expect([...out, ...inside].sort()).toEqual(original.sort());
        });

        it('has the copy match inside the scope only and the original outside it only', () => {
            const wrong = everything.filter((el) => el.matches(el.closest(SIM_SCOPE) !== null ? scopeOut(selector) : scopeIn(selector)));

            expect(wrong.map(describeElement)).toEqual([]);
        });

        it('is undone by unscopeOut', () => {
            expect(unscopeOut(scopeOut(selector))).toBe(selector);
        });
    });

    describe.each(ROOT_SELECTORS)('%s, on the document root', (selector, reachesScope) => {
        it('is left alone outside the scope', () => {
            expect(scopeOut(selector)).toBe(selector);
        });

        it('goes to the scope roots, and only while the document root meets its conditions', () => {
            const roots = Array.from(document.querySelectorAll(SIM_SCOPE)).map(describeElement);

            expect(matched(scopeIn(selector))).toEqual(reachesScope ? roots : []);
        });
    });

    it('sends a list with a root selector to the scope roots and its other selectors inside the scope', () => {
        const list = ':root, .b';

        expect(matched(scopeIn(list)).sort()).toEqual(['wrap', 'scopedHost', 'overlay', 'wrapB', 'wrapAB', 'wrapThemeB', 'overlayB', 'overlayAB'].sort());
        expect(matched(scopeOut(list))).toEqual(['html', 'themeB', 'aB']);
    });
});
