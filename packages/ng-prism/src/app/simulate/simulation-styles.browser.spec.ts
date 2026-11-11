import { pseudoStateClass } from '../pseudo/pseudo-selector.js';
import { PseudoStyleSheets } from '../pseudo/pseudo-stylesheets.js';
import { collectForcedColorRules, exemptionSelector, type ForcedColorRules, forcedColorsCss } from './forced-colors.js';
import { FORCED_PALETTES } from './forced-palette.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { scopeIn } from './scope-selector.js';
import { SimulationStyles } from './simulation-styles.js';

/** Lets pending MutationObserver callbacks run. */
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const FORCED = { 'forced-colors': 'active' } as const;
const NO_RULES: ForcedColorRules = { exempt: [], reenabled: [], gradientVars: [], layerVars: [] };

/** The rules of `NO_RULES` with what `found` says instead. */
const rulesOf = (found: Partial<ForcedColorRules>): ForcedColorRules => ({ ...NO_RULES, ...found });

function addStyle(css: string): CSSStyleSheet {
    const style = document.createElement('style');

    style.textContent = css;
    document.head.appendChild(style);
    if (!style.sheet) throw new Error('style element has no sheet');
    return style.sheet;
}

/**
 * What jsdom lacks for constructable sheets: `document.adoptedStyleSheets`, with
 * a spy on its setter, and `replaceSync`, which only remembers the text.
 */
function stubAdoptedSheets(): { adopt: jest.Mock; textOf: (sheet: CSSStyleSheet) => string | undefined } {
    const texts = new WeakMap<CSSStyleSheet, string>();
    let sheets: CSSStyleSheet[] = [];
    const adopt = jest.fn((next: CSSStyleSheet[]) => {
        sheets = next;
    });

    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, get: () => sheets, set: adopt });
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
        configurable: true,
        writable: true,
        value(this: CSSStyleSheet, text: string) {
            texts.set(this, text);
        }
    });
    return { adopt, textOf: (sheet) => texts.get(sheet) };
}

/** A readable sheet that takes a `@layer` statement, which the CSSOM of jsdom cannot parse, and keeps the rules as their text. */
function layerableSheet(): { sheet: CSSStyleSheet; texts: () => string[] } {
    const rules: { cssText: string }[] = [];
    const sheet = {
        href: null,
        media: { mediaText: '' },
        cssRules: rules,
        insertRule(text: string, index = 0): number {
            rules.splice(index, 0, { cssText: text });
            return index;
        },
        deleteRule(index: number): void {
            rules.splice(index, 1);
        }
    };

    return { sheet: sheet as unknown as CSSStyleSheet, texts: () => rules.map((rule) => rule.cssText) };
}

describe('SimulationStyles', () => {
    /** Every instance a spec makes, cleared after it, so that no engine keeps watching the head for the next spec. */
    const instances: SimulationStyles[] = [];
    const create = (): SimulationStyles => {
        const styles = new SimulationStyles(document);

        instances.push(styles);
        return styles;
    };
    let warn: jest.SpyInstance;

    beforeEach(() => {
        // jsdom rejects a `@layer` statement, which the simulation warns about.
        warn = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        for (const styles of instances.splice(0)) styles.clear();
        jest.restoreAllMocks();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
        delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync;
    });

    it('adopts the forced colors sheet, ignored by the media engine, and removes it on clear', () => {
        const { adopt, textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const ignore = jest.spyOn(MediaStyleSheets.prototype, 'ignore');
        const styles = create();

        addStyle('.dot { forced-color-adjust: none }');
        styles.apply(FORCED, 'dark');

        const [sheet] = document.adoptedStyleSheets;

        expect(document.adoptedStyleSheets).toHaveLength(1);
        // Without its layer, which jsdom does not take.
        expect(textOf(sheet)).toBe(forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark', false));
        expect(ignore).toHaveBeenCalledWith(sheet);
        // The engine has rewritten the sheets before the forced one arrives, and never gets to see it unignored.
        expect(apply.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);
        expect(ignore.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);

        styles.clear();
        expect(document.adoptedStyleSheets).toEqual([]);
    });

    it('declares the layer prism-sim-forced first in the first readable sheet and takes it out on clear', () => {
        const { textOf } = stubAdoptedSheets();
        const foreign = {
            href: 'https://fonts.example.com/face.css',
            get cssRules(): CSSRuleList {
                throw new DOMException('Cannot access rules', 'SecurityError');
            }
        };
        const first = layerableSheet();
        const second = layerableSheet();

        jest.spyOn(document, 'styleSheets', 'get').mockReturnValue([foreign, first.sheet, second.sheet] as unknown as StyleSheetList);
        const styles = create();

        styles.apply(FORCED, 'dark');
        // Before any layer of the author's: the forced colors sheet loses against each of them.
        expect(first.texts()).toEqual(['@layer prism-sim-forced;']);
        expect(second.texts()).toEqual([]);
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(NO_RULES, 'dark'));
        expect(textOf(document.adoptedStyleSheets[0])).toMatch(/^@layer prism-sim-forced \{/);

        styles.apply(FORCED, 'light');
        expect(first.texts()).toEqual(['@layer prism-sim-forced;']);

        styles.clear();
        expect(first.texts()).toEqual([]);
        expect(document.adoptedStyleSheets).toEqual([]);
    });

    it('writes the forced colors sheet without a layer, and warns once, when the browser rejects the statement', () => {
        const { textOf } = stubAdoptedSheets();
        const sheet = addStyle('.a { color: red }');

        jest.spyOn(sheet, 'insertRule').mockImplementation((text: string) => {
            if (text.startsWith('@layer')) throw new DOMException('Failed to parse the rule', 'SyntaxError');
            return 0;
        });
        const styles = create();

        styles.apply(FORCED, 'dark');
        styles.apply(FORCED, 'light');
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(NO_RULES, 'light', false));
        expect(warn.mock.calls.filter(([message]) => String(message).includes('prism-sim-forced'))).toHaveLength(1);
    });

    it('is idempotent', () => {
        stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = create();

        styles.apply(FORCED, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        styles.apply(FORCED, 'dark');
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(apply).toHaveBeenCalledTimes(2);
        expect(apply.mock.calls[1][1]).toBe(apply.mock.calls[0][1]);
    });

    it('collects the exemptions anew each time forced colors turn on', () => {
        const { textOf } = stubAdoptedSheets();
        const styles = create();

        styles.apply(FORCED, 'dark');
        styles.clear();

        addStyle('.late { forced-color-adjust: none }');
        styles.apply(FORCED, 'dark');
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(collectForcedColorRules(document), 'dark', false));
        expect(textOf(document.adoptedStyleSheets[0])).toContain('.late');
    });

    it('rewrites the forced colors sheet in place for another palette, once, and hands palette and rules to the media engine', () => {
        const { adopt, textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = create();

        addStyle('@media (forced-colors: active) { .t { color: Highlight } } .dot { forced-color-adjust: none }');
        styles.apply(FORCED, 'dark');
        const [sheet] = document.adoptedStyleSheets;
        const replaceSync = jest.spyOn(sheet, 'replaceSync');

        styles.apply(FORCED, 'light');
        expect(apply).toHaveBeenLastCalledWith(FORCED, { palette: 'light', rules: expect.objectContaining({ exempt: expect.arrayContaining(['.dot']) }) });
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(adopt).toHaveBeenCalledTimes(1);
        expect(replaceSync).toHaveBeenCalledTimes(1);
        expect(textOf(sheet)).toContain('.dot');
    });

    it('writes the sheet for another palette without styles that would make the media engine call back', () => {
        const { textOf } = stubAdoptedSheets();
        const styles = create();

        styles.apply(FORCED, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        styles.apply(FORCED, 'light');
        expect(textOf(sheet)).toBe(forcedColorsCss(NO_RULES, 'light'));
    });

    it('keeps the other adopted sheets', () => {
        stubAdoptedSheets();
        const own = new CSSStyleSheet();

        document.adoptedStyleSheets = [own];
        const styles = create();

        styles.apply(FORCED, 'dark');
        expect(document.adoptedStyleSheets).toHaveLength(2);
        expect(document.adoptedStyleSheets[0]).toBe(own);
        styles.clear();
        expect(document.adoptedStyleSheets).toEqual([own]);
    });

    it('goes without the forced colors sheet where the document cannot adopt one, and emulates the rest', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = create();

        expect(() => styles.apply(FORCED, 'dark')).not.toThrow();
        expect(apply).toHaveBeenLastCalledWith(FORCED, { palette: 'dark', rules: NO_RULES });
    });

    it('takes the forced colors sheet away and keeps emulating the scheme when only forced colors go', () => {
        stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const styles = create();

        styles.apply({ ...FORCED, 'prefers-color-scheme': 'dark' }, 'dark');
        expect(document.adoptedStyleSheets).toHaveLength(1);
        clear.mockClear();

        styles.apply({ 'prefers-color-scheme': 'dark' }, null);
        expect(document.adoptedStyleSheets).toEqual([]);
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-color-scheme': 'dark' }, null);
        expect(clear).not.toHaveBeenCalled();
    });

    it('clears the media engine for an emulation of nothing', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const styles = create();

        styles.apply({}, null);
        expect(clear).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();

        styles.apply({ 'prefers-reduced-motion': 'reduce' }, null);
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce' }, null);

        clear.mockClear();
        styles.clear();
        expect(clear).toHaveBeenCalledTimes(1);
    });

    it('collects the exemptions of styles that arrive while forced colors are on', async () => {
        const { textOf } = stubAdoptedSheets();
        const styles = create();

        styles.apply(FORCED, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        expect(textOf(sheet)).toBe(forcedColorsCss(NO_RULES, 'dark'));

        addStyle('.dot { forced-color-adjust: none }');
        await flushMutations();
        // Rewritten in place: the same sheet, still the only one adopted. The new sheet is the first one, which takes no layer in jsdom.
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(textOf(sheet)).toBe(forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark', false));
    });

    it('re-applies the twins when new styles bring new exemptions', async () => {
        stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const sheet = addStyle('.a { color: red }');
        const styles = create();

        styles.apply(FORCED, 'dark');
        expect((sheet.cssRules[1] as CSSStyleRule).selectorText).toBe(scopeIn('.a', false, `:not(${exemptionSelector(NO_RULES)})`));

        addStyle('.b { color: blue }');
        await flushMutations();
        // Nothing new about forced colors: the engine goes on as it is.
        expect(apply).toHaveBeenCalledTimes(1);

        addStyle('.dot { forced-color-adjust: none }');
        await flushMutations();
        expect(apply).toHaveBeenCalledTimes(2);
        expect(sheet.cssRules).toHaveLength(2);
        expect((sheet.cssRules[1] as CSSStyleRule).selectorText).toBe(scopeIn('.a', false, `:not(${exemptionSelector(rulesOf({ exempt: ['.dot'] }))})`));
    });

    // The pseudo engine widens a sheet once, and the forced colors sheet is written anew for every palette: it has to
    // match the stand-in class of a forced Focus visible state on its own.
    it.each(['before', 'after'])('gives the element of a Focus visible state forced %s forced colors the Highlight outline, in every palette', (order) => {
        const { textOf } = stubAdoptedSheets();
        const pseudo = new PseudoStyleSheets(document);
        const styles = create();

        document.body.innerHTML = '<div data-prism-sim><button class="f">b <span class="k">in</span></button></div>';
        const button = document.querySelector('.f') as Element;
        const inside = document.querySelector('.k') as Element;

        button.classList.add(pseudoStateClass('focus-visible'));
        if (order === 'before') pseudo.acquire();
        styles.apply(FORCED, 'dark');
        if (order === 'after') pseudo.acquire();

        const [sheet] = document.adoptedStyleSheets;

        expect(outlineOf(textOf(sheet), button)).toBe(FORCED_PALETTES.dark.highlight);
        expect(outlineOf(textOf(sheet), inside)).toBeUndefined();

        styles.apply(FORCED, 'light');
        expect(outlineOf(textOf(sheet), button)).toBe(FORCED_PALETTES.light.highlight);
        expect(outlineOf(textOf(sheet), inside)).toBeUndefined();
        pseudo.release();
    });
});

/**
 * The outline of the focus that the forced colors sheet `css` gives `element`: the value of
 * `--prism-sim-outline` of the last of its rules whose selector matches it, `undefined` for none
 * and for `initial`. One selector per line, as the sheet writes a list.
 */
function outlineOf(css: string | undefined, element: Element): string | undefined {
    let outline: string | undefined;

    for (const [, selector, block] of (css ?? '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const value = /--prism-sim-outline:\s*([^;]+);/.exec(block)?.[1].trim();

        if (value !== undefined && selector.split(',\n').some((part) => !part.includes('::') && element.matches(part.trim()))) outline = value;
    }
    return outline === 'initial' ? undefined : outline;
}
