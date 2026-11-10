import { PseudoStyleSheets } from '../pseudo/pseudo-stylesheets.js';
import { prelude } from './css-rules.js';
import { exemptionSelector, type ForcedColorRules } from './forced-colors.js';
import { FORCED_PALETTES, type ForcedPaletteName } from './forced-palette.js';
import { MEDIA_FALSE, MEDIA_TRUE } from './media-condition.js';
import { type ForcedOptions, MediaStyleSheets } from './media-stylesheets.js';
import { SCOPE_IN_SUFFIX, SCOPE_OUT_SUFFIX, scopeIn } from './scope-selector.js';

function addStyle(css: string): CSSStyleSheet {
    const style = document.createElement('style');

    style.textContent = css;
    document.head.appendChild(style);
    if (!style.sheet) throw new Error('style element has no sheet');
    return style.sheet;
}

/** Lets pending MutationObserver callbacks run. */
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The selector of a style rule, or of the first rule in a group. */
function selectorOf(rule: CSSRule): string {
    const inner = 'cssRules' in rule ? (rule as CSSGroupingRule).cssRules[0] : rule;

    return (inner as CSSStyleRule).selectorText;
}

const mediaOf = (rule: CSSRule): string => (rule as CSSMediaRule).media.mediaText;

/** A sheet as `document.styleSheets` would list it, for what jsdom cannot load: `<link>`s and cross-origin rules. */
function listSheets(...sheets: CSSStyleSheet[]): void {
    jest.spyOn(document, 'styleSheets', 'get').mockReturnValue(sheets as unknown as StyleSheetList);
}

/**
 * Makes every style rule store its selector the way `write` says, as a browser
 * may rewrite it, or keep the old one where `write` gives `null`, as a browser
 * does with a selector it rejects. Returns what undoes it.
 */
function writeSelectorsAs(write: (selector: string) => string | null): () => void {
    const proto = CSSStyleRule.prototype;
    const own = Object.getOwnPropertyDescriptor(proto, 'selectorText');
    const texts = new WeakMap<object, string>();

    Object.defineProperty(proto, 'selectorText', {
        configurable: true,
        get(this: object): string {
            return texts.get(this) ?? '';
        },
        set(this: object, value: string) {
            const written = write(value);

            if (written !== null) texts.set(this, written);
        }
    });
    return () => {
        if (own) Object.defineProperty(proto, 'selectorText', own);
        else delete (proto as { selectorText?: string }).selectorText;
    };
}

const REDUCE = { 'prefers-reduced-motion': 'reduce' } as const;
const DARK = { 'prefers-color-scheme': 'dark' } as const;
const LIGHT = { 'prefers-color-scheme': 'light' } as const;

describe('MediaStyleSheets', () => {
    let engine: MediaStyleSheets;

    beforeEach(() => {
        engine = new MediaStyleSheets(document);
    });

    afterEach(() => {
        engine.clear();
        document.head.innerHTML = '';
        jest.restoreAllMocks();
    });

    it('excludes the original from the scope and inserts a scoped copy right after it', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } } .x { color: red }');

        engine.apply({ 'prefers-reduced-motion': 'reduce' });
        const [orig, copy, x] = Array.from(sheet.cssRules) as CSSMediaRule[];

        expect((orig.cssRules[0] as CSSStyleRule).selectorText).toBe(`.spin${SCOPE_OUT_SUFFIX}`);
        expect(copy.media.mediaText).toBe(MEDIA_TRUE);
        expect((copy.cssRules[0] as CSSStyleRule).selectorText).toBe(scopeIn('.spin'));
        expect((x as unknown as CSSStyleRule).selectorText).toBe('.x');
    });

    it('keeps the declarations in the copy', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none; transition-duration: 0s !important } }');

        engine.apply(REDUCE);
        const copy = (sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule;

        expect(copy.style.getPropertyValue('animation')).toBe('none');
        expect(copy.style.getPropertyPriority('transition-duration')).toBe('important');
    });

    it('keeps the live part of a combined condition in the copy', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) and (min-width: 600px) { .a { opacity: 0 } }');

        engine.apply({ 'prefers-reduced-motion': 'reduce' });
        expect((sheet.cssRules[1] as CSSMediaRule).media.mediaText).toContain('(min-width: 600px)');
    });

    it('settles a condition the emulation answers with no, too', () => {
        const sheet = addStyle('@media (prefers-color-scheme: dark) { .c { color: white } }');

        engine.apply(LIGHT);
        expect(mediaOf(sheet.cssRules[1])).toBe(MEDIA_FALSE);
        expect(selectorOf(sheet.cssRules[0])).toBe(`.c${SCOPE_OUT_SUFFIX}`);
    });

    it('leaves rules alone whose condition tests nothing emulated', () => {
        const css = '@media (min-width: 600px) { .w { width: 50% } } @media (prefers-color-scheme: dark) { .c { color: white } }';
        const sheet = addStyle(css);

        engine.apply(REDUCE);
        expect(sheet.cssRules).toHaveLength(2);
        expect(Array.from(sheet.cssRules).map(selectorOf)).toEqual(['.w', '.c']);
    });

    it('rewrites nested groups and styles added later', async () => {
        engine.apply({ 'prefers-color-scheme': 'dark' });
        const sheet = addStyle('@supports (display: grid) { @media (prefers-color-scheme: dark) { .c { color: white } } }');

        await flushMutations();
        expect((sheet.cssRules[0] as CSSSupportsRule).cssRules.length).toBe(2);
    });

    it('copies a nested emulated @media once, as part of the copy of the outer one', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { @media (prefers-color-scheme: dark) { .a { color: white } } }');

        engine.apply({ ...REDUCE, ...DARK });
        const [orig, copy] = Array.from(sheet.cssRules) as CSSMediaRule[];

        expect(sheet.cssRules).toHaveLength(2);
        expect(orig.cssRules).toHaveLength(1);
        expect(selectorOf(orig.cssRules[0])).toBe(`.a${SCOPE_OUT_SUFFIX}`);
        expect(mediaOf(copy)).toBe(MEDIA_TRUE);
        expect(mediaOf(copy.cssRules[0])).toBe(MEDIA_TRUE);
        expect(selectorOf(copy.cssRules[0])).toBe(scopeIn('.a'));
    });

    it('is idempotent', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

        engine.apply(REDUCE);
        engine.apply({ ...REDUCE });
        expect(sheet.cssRules).toHaveLength(2);
        expect(selectorOf(sheet.cssRules[0])).toBe(`.spin${SCOPE_OUT_SUFFIX}`);
    });

    it('clear restores the sheet exactly', () => {
        const css = '@media (prefers-reduced-motion: reduce) { .spin { animation: none } }';
        const sheet = addStyle(css);

        engine.apply({ 'prefers-reduced-motion': 'reduce' });
        engine.clear();
        expect(sheet.cssRules.length).toBe(1);
        expect(((sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule).selectorText).toBe('.spin');
    });

    it('stops rewriting new styles once cleared', async () => {
        engine.apply(REDUCE);
        engine.clear();
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

        await flushMutations();
        expect(sheet.cssRules).toHaveLength(1);
    });

    it('takes an emulation of nothing for clear', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

        engine.apply(REDUCE);
        engine.apply({});
        expect(sheet.cssRules).toHaveLength(1);
        expect(selectorOf(sheet.cssRules[0])).toBe('.spin');
    });

    it('rewrites a style element again once its content is replaced', async () => {
        const style = document.createElement('style');

        style.textContent = '.a { color: red }';
        document.head.appendChild(style);
        engine.apply(REDUCE);
        style.textContent = '@media (prefers-reduced-motion: reduce) { .spin { animation: none } }';
        await flushMutations();
        expect(style.sheet?.cssRules).toHaveLength(2);
    });

    it('undoes and forgets a sheet that leaves the document, as a component style that Angular removes', async () => {
        const style = document.createElement('style');

        style.textContent = '@media (prefers-reduced-motion: reduce) { .spin { animation: none } }';
        document.head.appendChild(style);
        const sheet = style.sheet as CSSStyleSheet;

        engine.apply(REDUCE);
        expect(sheet.cssRules).toHaveLength(2);

        style.remove();
        await flushMutations();

        // A sheet that comes back, as an adopted one may, comes back as it was.
        expect(sheet.cssRules).toHaveLength(1);
        expect(selectorOf(sheet.cssRules[0])).toBe('.spin');

        // Nothing is left to undo: clearing touches it no more.
        const deleteRule = jest.spyOn(sheet, 'deleteRule');

        engine.clear();
        expect(deleteRule).not.toHaveBeenCalled();
    });

    it('reads the rules of a group once when it removes its copies, however many there are', () => {
        const real = addStyle(Array.from({ length: 200 }, (_, i) => `@media (prefers-reduced-motion: reduce) { .r${i} { animation: none } }`).join('\n'));
        let reads = 0;
        // The same sheet, counting how often its rules are asked for.
        const counted = {
            media: real.media,
            href: null,
            get cssRules(): CSSRuleList {
                reads++;
                return real.cssRules;
            },
            insertRule: (rule: string, index?: number) => real.insertRule(rule, index),
            deleteRule: (index: number) => real.deleteRule(index)
        };

        listSheets(counted as unknown as CSSStyleSheet);
        engine.apply(REDUCE);
        expect(real.cssRules).toHaveLength(400);

        reads = 0;
        engine.clear();

        expect(real.cssRules).toHaveLength(200);
        expect(Array.from(real.cssRules).map(selectorOf)).toEqual(Array.from({ length: 200 }, (_, i) => `.r${i}`));
        expect(reads).toBeLessThanOrEqual(2);
    });

    it('warns once about a rule the browser does not take, however often it is applied', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

        jest.spyOn(sheet, 'insertRule').mockImplementation(() => {
            throw new DOMException('Failed to parse the rule', 'SyntaxError');
        });
        engine.apply(REDUCE);
        engine.apply({ ...REDUCE, ...DARK });
        engine.apply(REDUCE);

        expect(sheet.cssRules).toHaveLength(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('@media (prefers-reduced-motion: reduce)'));
    });

    it('a different emulation re-applies without leaving old copies', () => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } } @media (prefers-color-scheme: dark) { .c { color: white } }');

        engine.apply(REDUCE);
        engine.apply(DARK);
        const rules = Array.from(sheet.cssRules);

        expect(rules.map(mediaOf)).toEqual(['(prefers-reduced-motion: reduce)', '(prefers-color-scheme: dark)', MEDIA_TRUE]);
        expect(rules.map(selectorOf)).toEqual(['.spin', `.c${SCOPE_OUT_SUFFIX}`, scopeIn('.c')]);
    });

    it.each([
        ['before', true],
        ['after', false]
    ])('keeps the pseudo widening when pseudo states are forced %s apply()', (_, before) => {
        const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .a:hover { transition: none } }');
        const pseudo = new PseudoStyleSheets(document);
        const widened = '.a:is(:hover, .prism-pseudo--hover)';

        if (before) pseudo.rewriteSheet(sheet);
        engine.apply(REDUCE);
        if (!before) pseudo.rewriteSheet(sheet);
        expect(Array.from(sheet.cssRules).map(selectorOf)).toEqual([`${widened}${SCOPE_OUT_SUFFIX}`, scopeIn(widened)]);

        engine.clear();
        expect(sheet.cssRules).toHaveLength(1);
        expect(selectorOf(sheet.cssRules[0])).toBe(widened);
    });

    describe('forced colors', () => {
        const FORCED = { 'forced-colors': 'active' } as const;
        const NO_RULES: ForcedColorRules = { exempt: [], reenabled: [], gradientVars: [], layerVars: [] };
        const forced = (palette: ForcedPaletteName = 'dark', rules: Partial<ForcedColorRules> = {}): ForcedOptions => ({ palette, rules: { ...NO_RULES, ...rules } });
        /** The condition of a twin that forces, without an exemption of the author's: an SVG is exempt all the same. */
        const NOT_EXEMPT = `:not(${exemptionSelector(NO_RULES)})`;
        const styleRules = (group: { cssRules: CSSRuleList }): CSSStyleRule[] => Array.from(group.cssRules) as CSSStyleRule[];
        /** A sheet's text, rule by rule. */
        const textOf = (sheet: CSSStyleSheet): string => Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');

        it('puts a twin right behind every rule that sets a forced property, scoped and as important as the original', () => {
            const sheet = addStyle('.a { color: red } .b { padding: 1px } .c { border-color: blue !important }');

            engine.apply(FORCED, forced());
            const rules = styleRules(sheet);

            expect(rules.map(selectorOf)).toEqual(['.a', scopeIn('.a', false, NOT_EXEMPT), '.b', '.c', scopeIn('.c', false, NOT_EXEMPT)]);
            expect(rules[1].style.getPropertyValue('color')).toBe('var(--prism-sim-fg)');
            expect(rules[1].style.getPropertyPriority('color')).toBe('');
            expect(rules[4].style.getPropertyValue('border-top-color')).toBe('currentcolor');
            expect(rules[4].style.getPropertyPriority('border-top-color')).toBe('important');
        });

        it("gives an exempt subtree a twin with the palette's system colors only", () => {
            const sheet = addStyle('.a { color: Highlight; background-color: red } .b { color: red }');
            const exemption = exemptionSelector({ ...NO_RULES, exempt: ['.dot'] });

            engine.apply(FORCED, forced('dark', { exempt: ['.dot'] }));
            const [, twin, exemptTwin, , bTwin] = styleRules(sheet);

            expect(sheet.cssRules).toHaveLength(5);
            expect(twin.selectorText).toBe(scopeIn('.a', false, `:not(${exemption})`));
            expect(twin.style.getPropertyValue('color')).toBe(FORCED_PALETTES.dark.highlight);
            expect(twin.style.getPropertyValue('background-color')).toBe('rgb(from red var(--prism-sim-bg-rgb) / alpha)');
            expect(exemptTwin.selectorText).toBe(scopeIn('.a', false, exemption));
            expect(Array.from(exemptTwin.style)).toEqual(['color']);
            expect(exemptTwin.style.getPropertyValue('color')).toBe(FORCED_PALETTES.dark.highlight);
            // A rule without a system color has nothing to resolve for an exempt subtree.
            expect(bTwin.selectorText).toBe(scopeIn('.b', false, `:not(${exemption})`));
        });

        it('leaves a copied forced-colors rule as important as the original, its system colors in the palette', () => {
            const sheet = addStyle('@media (forced-colors: active) { .t { outline-color: Highlight; border-top-color: red !important; display: none } }');

            engine.apply(FORCED, forced('light'));
            const [copy, twin] = styleRules(sheet.cssRules[1] as CSSMediaRule);

            expect(copy.selectorText).toBe(scopeIn('.t'));
            expect(copy.style.getPropertyValue('outline-color')).toBe(FORCED_PALETTES.light.highlight);
            for (const [property, priority] of [
                ['outline-color', ''],
                ['border-top-color', 'important'],
                ['display', '']
            ]) {
                expect([property, copy.style.getPropertyPriority(property)]).toEqual([property, priority]);
            }
            // Computed from the keyword, which stays standing, and not from the value it resolves to, which would be forced.
            expect(twin.selectorText).toBe(scopeIn('.t', false, NOT_EXEMPT));
            expect(twin.style.getPropertyValue('outline-color')).toBe(FORCED_PALETTES.light.highlight);
            expect(twin.style.getPropertyValue('border-top-color')).toBe('currentcolor');
            expect(twin.style.getPropertyPriority('border-top-color')).toBe('important');
            expect(((sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyValue('outline-color')).toBe('Highlight');
        });

        it('leaves the copies alone when forced colors are not emulated', () => {
            const sheet = addStyle('@media (prefers-color-scheme: dark) and (forced-colors: active) { .t { color: GrayText } } .a { color: red }');

            engine.apply(DARK);
            expect((sheet.cssRules[1] as CSSMediaRule).cssRules).toHaveLength(1);
            expect(((sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyValue('color')).toBe('GrayText');
            expect(sheet.cssRules).toHaveLength(3);
        });

        it('resolves system colors only where a color can be, and a custom property only when it is one', () => {
            const sheet = addStyle(
                '@media (forced-colors: active) { .t { border: 1px solid ButtonText; transition: background 0.2s; font: menu; --ring: Highlight; --word: Background; --mix: 0 0 0 2px Highlight } }'
            );

            engine.apply(FORCED, forced('dark'));
            const copy = (sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule;

            expect(copy.style.getPropertyValue('border')).toBe('1px solid #ffffff');
            expect(copy.style.getPropertyValue('transition')).toBe('background 0.2s');
            expect(copy.style.getPropertyValue('font')).toBe('menu');
            expect(copy.style.getPropertyValue('--ring')).toBe(FORCED_PALETTES.dark.highlight);
            // A deprecated color is as much a word, and a custom property with more than a color is a list of tokens.
            expect(copy.style.getPropertyValue('--word')).toBe('Background');
            expect(copy.style.getPropertyValue('--mix')).toBe('0 0 0 2px Highlight');
        });

        it('resolves the system colors of every copy under a palette, builds everything anew for another one, and resolves none without one', () => {
            const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .t { color: GrayText } }');
            const copy = (): CSSStyleRule => (sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule;

            engine.apply({ ...REDUCE, ...FORCED }, forced('light'));
            expect(copy().style.getPropertyValue('color')).toBe(FORCED_PALETTES.light.graytext);
            expect(copy().style.getPropertyPriority('color')).toBe('');

            engine.apply({ ...REDUCE, ...FORCED }, forced('dark'));
            expect(sheet.cssRules).toHaveLength(2);
            expect(copy().style.getPropertyValue('color')).toBe(FORCED_PALETTES.dark.graytext);

            engine.apply(REDUCE, null);
            expect(copy().style.getPropertyValue('color')).toBe('GrayText');
            expect((sheet.cssRules[1] as CSSMediaRule).cssRules).toHaveLength(1);
        });

        it('rewrites a copy only where a system color changes it', () => {
            const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .plain { color: red } .system { color: GrayText } }');
            // The declarations of the sheet's rules, as the CSSOM of jsdom makes them.
            const set = jest.spyOn(Object.getPrototypeOf(((sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule).style), 'cssText', 'set');

            engine.apply({ ...REDUCE, ...FORCED }, forced('light'));
            expect(set).toHaveBeenCalledTimes(1);
            expect(((sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyValue('color')).toBe('red');
        });

        it('builds anew for other rules, and only then', () => {
            const sheet = addStyle('.a { color: red }');
            const insertRule = jest.spyOn(sheet, 'insertRule');

            engine.apply(FORCED, forced('dark'));
            engine.apply(FORCED, forced('dark'));
            expect(insertRule).toHaveBeenCalledTimes(1);

            engine.apply(FORCED, forced('dark', { exempt: ['.dot'] }));
            expect(insertRule).toHaveBeenCalledTimes(2);
            expect(selectorOf(sheet.cssRules[1])).toBe(scopeIn('.a', false, `:not(${exemptionSelector({ ...NO_RULES, exempt: ['.dot'] })})`));
        });

        it('twins @keyframes that set a forced property and renames them in the twins of rules that use them', () => {
            const sheet = addStyle(
                '@keyframes p { from { background-color: #c00; opacity: 0 } } @keyframes q { from { opacity: 0 } } .k { animation-name: p } .q { animation-name: q }'
            );

            engine.apply(FORCED, forced());
            const rules = Array.from(sheet.cssRules);
            const twin = rules[1] as CSSKeyframesRule;
            const frame = twin.cssRules[0] as CSSKeyframeRule;

            expect(rules.map((rule) => prelude(rule.cssText))).toEqual([
                '@keyframes p',
                '@keyframes p-prism-sim',
                '@keyframes q',
                '.k',
                scopeIn('.k', false, NOT_EXEMPT),
                '.q'
            ]);
            expect(twin.name).toBe('p-prism-sim');
            expect(frame.keyText).toBe('from');
            // What a twin does not force stays, so that the animation keeps its course.
            expect(frame.style.getPropertyValue('background-color')).toBe('rgb(from #c00 var(--prism-sim-bg-rgb) / alpha)');
            expect(frame.style.getPropertyValue('opacity')).toBe('0');
            expect((rules[4] as CSSStyleRule).style.getPropertyValue('animation-name')).toBe('p-prism-sim');
        });

        it('gives a rule on the document root a twin of only what the scope roots may inherit', () => {
            const sheet = addStyle('body { background-color: #fff; color: #333; --tok: Highlight }');

            engine.apply(FORCED, forced('dark'));
            const twin = sheet.cssRules[1] as CSSStyleRule;

            expect(twin.selectorText).toBe(scopeIn('body', false, NOT_EXEMPT));
            expect(Array.from(twin.style).sort()).toEqual(['--prism-sim-sys-tok', '--tok', 'color']);
            expect(twin.style.getPropertyValue('--tok')).toBe(FORCED_PALETTES.dark.highlight);
        });

        it('forces a root value that it sets on the scope roots again, with the twin of its rule behind it', () => {
            const sheet = addStyle(':root { --bg: Canvas; color: #333 } @media (prefers-color-scheme: dark) { :root { --bg: #000 } }');

            engine.apply({ ...LIGHT, ...FORCED }, forced('dark'));
            const [root, copy, twin] = styleRules(sheet);

            expect([root, copy, twin].map(selectorOf)).toEqual([':root', scopeIn(':root'), scopeIn(':root', false, NOT_EXEMPT)]);
            expect(Array.from(copy.style)).toEqual(['--bg']);
            expect(twin.style.getPropertyValue('--bg')).toBe(FORCED_PALETTES.dark.canvas);
            expect(twin.style.getPropertyValue('--prism-sim-sys-bg')).toBe(FORCED_PALETTES.dark.canvas);
            expect(twin.style.getPropertyValue('color')).toBe('var(--prism-sim-fg)');
        });

        it('restores every sheet to its text after on, a palette switch and off', () => {
            const sheets = [
                addStyle(':root { --bg: #fff; --tok: Highlight } @media (prefers-color-scheme: dark) { :root { --bg: #000 } } .a { color: red; background-color: #fff }'),
                addStyle(
                    '@media (forced-colors: active) { .b { outline-color: Highlight; forced-color-adjust: none } } @keyframes p { from { color: red } } .k { animation-name: p }'
                )
            ];
            const before = sheets.map(textOf);

            engine.apply({ ...LIGHT, ...FORCED }, forced('dark', { exempt: ['.b'] }));
            expect(sheets.map(textOf)).not.toEqual(before);
            engine.apply({ ...LIGHT, ...FORCED }, forced('light', { exempt: ['.b'] }));
            engine.apply(LIGHT, null);
            engine.clear();
            expect(sheets.map(textOf)).toEqual(before);
        });

        it('twins styles that arrive while forced colors are on and undoes sheets that leave', async () => {
            engine.apply(FORCED, forced());
            const style = document.createElement('style');

            style.textContent = '.late { color: red }';
            document.head.appendChild(style);
            await flushMutations();
            const sheet = style.sheet as CSSStyleSheet;

            expect(styleRules(sheet).map(selectorOf)).toEqual(['.late', scopeIn('.late', false, NOT_EXEMPT)]);

            style.remove();
            await flushMutations();
            expect(styleRules(sheet).map(selectorOf)).toEqual(['.late']);
        });

        it("warns once and keeps going when the browser rejects a twin's selector", () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            const sheet = addStyle('.bad::part(x) { color: Highlight } .ok { color: red }');
            const insertRule = sheet.insertRule.bind(sheet);

            // A browser that does not take the first selector with the scope and the exemption added.
            jest.spyOn(sheet, 'insertRule').mockImplementation((text: string, index?: number) => {
                if (text.startsWith('.bad')) throw new DOMException('Failed to parse the rule', 'SyntaxError');
                return insertRule(text, index);
            });
            // Each palette and each exemption gives the twin another text.
            engine.apply(FORCED, forced('dark'));
            engine.apply(FORCED, forced('light'));
            engine.apply(FORCED, forced('light', { exempt: ['.dot'] }));

            expect(styleRules(sheet).map(selectorOf)).toEqual([
                '.bad::part(x)',
                '.ok',
                scopeIn('.ok', false, `:not(${exemptionSelector({ ...NO_RULES, exempt: ['.dot'] })})`)
            ]);
            expect(warn).toHaveBeenCalledTimes(1);
            // The selector as the author wrote it, and not the twin with the scope and the exemption.
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('".bad::part(x)"'));
            expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('data-prism-sim'));
        });

        it('splits the twin of a list that mixes the document root with other selectors, so that the others are forced whole', () => {
            const sheet = addStyle(':root, .theme-dark { color: #eee; background-color: #111; border-color: red }');

            engine.apply(FORCED, forced());
            const [, others, root] = styleRules(sheet);

            expect(sheet.cssRules).toHaveLength(3);
            expect(others.selectorText).toBe(scopeIn('.theme-dark', false, NOT_EXEMPT));
            expect(others.style.getPropertyValue('color')).toBe('var(--prism-sim-fg)');
            expect(others.style.getPropertyValue('background-color')).toBe('rgb(from #111 var(--prism-sim-bg-rgb) / alpha)');
            expect(others.style.getPropertyValue('border-top-color')).toBe('currentcolor');
            // The scope roots only take what they may inherit.
            expect(root.selectorText).toBe(scopeIn(':root', false, NOT_EXEMPT));
            expect(Array.from(root.style)).toEqual(['color']);
        });

        it('splits a copy of such a list, and its twin, in the same way', () => {
            const sheet = addStyle('@media (forced-colors: active) { :root, [data-theme=dark] { --x: red; background-color: #111 } }');

            engine.apply(FORCED, forced());
            const [others, root, othersTwin, rootTwin] = styleRules(sheet.cssRules[1] as CSSMediaRule);

            expect([others, root, othersTwin, rootTwin].map(selectorOf)).toEqual([
                scopeIn('[data-theme=dark]'),
                scopeIn(':root'),
                scopeIn('[data-theme=dark]', false, NOT_EXEMPT),
                scopeIn(':root', false, NOT_EXEMPT)
            ]);
            expect(others.style.getPropertyValue('background-color')).toBe('#111');
            expect(Array.from(root.style)).toEqual(['--x']);
            expect(othersTwin.style.getPropertyValue('background-color')).toBe('rgb(from #111 var(--prism-sim-bg-rgb) / alpha)');
            expect(Array.from(rootTwin.style)).toEqual(['--prism-sim-sys-x']);
        });

        it.each([
            ['before', true],
            ['after', false]
        ])('twins the widened selector when pseudo states are forced %s apply()', (_, before) => {
            const sheet = addStyle('.a:hover { color: red }');
            const pseudo = new PseudoStyleSheets(document);
            const widened = '.a:is(:hover, .prism-pseudo--hover)';

            if (before) pseudo.rewriteSheet(sheet);
            engine.apply(FORCED, forced());
            if (!before) pseudo.rewriteSheet(sheet);
            expect(styleRules(sheet).map(selectorOf)).toEqual([widened, scopeIn(widened, false, NOT_EXEMPT)]);

            engine.clear();
            expect(styleRules(sheet).map(selectorOf)).toEqual([widened]);
        });

        /** A rule jsdom can parse. */
        const parse = (text: string): CSSRule => {
            const scratch = new CSSStyleSheet();

            scratch.insertRule(text, 0);
            return scratch.cssRules[0];
        };
        const group = (rules: CSSRule[]): { cssRules: CSSRule[]; insertRule(text: string, index?: number): number; deleteRule(index: number): void } => ({
            cssRules: rules,
            insertRule(text, index = 0) {
                rules.splice(index, 0, parse(text));
                return index;
            },
            deleteRule(index) {
                rules.splice(index, 1);
            }
        });
        /** A style rule with nested rules, which jsdom cannot parse, from rules it can, alone in a sheet the document lists. */
        const nestedRule = (selectorText: string, declarations: string, ...rules: string[]): { cssRules: CSSRule[] } => {
            const rule = Object.assign(group(rules.map(parse)), { selectorText, style: (parse(`.x { ${declarations} }`) as CSSStyleRule).style });

            listSheets(Object.assign(group([rule as unknown as CSSRule]), { media: { mediaText: '' }, href: null }) as unknown as CSSStyleSheet);
            return rule;
        };

        it("twins a nested rule's own declarations as its first nested rule", () => {
            const card = nestedRule('.card', 'color: red', '.icon { color: blue }');

            engine.apply(FORCED, forced());

            // Before the nested rules, as the declarations of the rule come before them.
            expect(card.cssRules.map(selectorOf)).toEqual([`&${SCOPE_IN_SUFFIX}${NOT_EXEMPT}`, '.icon', scopeIn('.icon', false, NOT_EXEMPT)]);
            expect((card.cssRules[0] as CSSStyleRule).style.getPropertyValue('color')).toBe('var(--prism-sim-fg)');

            engine.clear();
            expect(card.cssRules.map(selectorOf)).toEqual(['.icon']);
        });

        it('gives a nested rule of a list that mixes the document root with other selectors a twin for each', () => {
            const theme = nestedRule(':root, .theme-dark', 'color: #eee; background-color: #111', '.icon { color: blue }');

            engine.apply(FORCED, forced());
            const [others, root] = theme.cssRules as CSSStyleRule[];

            expect([others, root].map(selectorOf)).toEqual([`&${SCOPE_IN_SUFFIX}${NOT_EXEMPT}`, `& :where([data-prism-sim], .cdk-overlay-container)${NOT_EXEMPT}`]);
            expect(others.style.getPropertyValue('background-color')).toBe('rgb(from #111 var(--prism-sim-bg-rgb) / alpha)');
            expect(Array.from(root.style)).toEqual(['color']);
        });
    });

    describe('root values', () => {
        it('sets a root value on the scope roots again where an emulated condition stops overriding it', () => {
            const sheet = addStyle(':root{--bg:#fff} @media (prefers-color-scheme: dark){:root{--bg:#000}}');

            engine.apply(LIGHT);
            const [root, rootCopy, media, mediaCopy] = Array.from(sheet.cssRules);

            expect(sheet.cssRules).toHaveLength(4);
            expect(selectorOf(root)).toBe(':root');
            expect(selectorOf(rootCopy)).toBe(':root :where([data-prism-sim], .cdk-overlay-container)');
            expect((rootCopy as CSSStyleRule).style.getPropertyValue('--bg')).toBe('#fff');
            expect(selectorOf(media)).toBe(':root');
            expect(mediaOf(mediaCopy)).toBe(MEDIA_FALSE);
            expect(selectorOf(mediaCopy)).toBe(scopeIn(':root'));
        });

        it('copies only what an emulated condition sets on the root, with its priority', () => {
            const sheet = addStyle(
                ':root { --bg: #fff !important; --gap: 4px; color: black } .card { --bg: #eee } @media (prefers-color-scheme: dark) { html { --bg: #000 } }'
            );

            engine.apply(DARK);
            const copy = sheet.cssRules[1] as CSSStyleRule;

            expect(Array.from(sheet.cssRules).map(selectorOf)).toEqual([':root', scopeIn(':root'), '.card', 'html', scopeIn('html')]);
            expect(Array.from(copy.style)).toEqual(['--bg']);
            expect(copy.style.getPropertyPriority('--bg')).toBe('important');
        });

        it('keeps the condition a root rule sits in', () => {
            const sheet = addStyle('@media (min-width: 600px) { :root { --bg: #fff } } @media (prefers-color-scheme: dark) { :root { --bg: #000 } }');

            engine.apply(LIGHT);
            expect(Array.from((sheet.cssRules[0] as CSSMediaRule).cssRules).map(selectorOf)).toEqual([':root', scopeIn(':root')]);
        });

        it('finds root values across sheets, whichever arrives first', async () => {
            engine.apply(LIGHT);
            const tokens = addStyle(':root { --bg: #fff }');

            await flushMutations();
            expect(tokens.cssRules).toHaveLength(1);

            addStyle('@media (prefers-color-scheme: dark) { :root { --bg: #000 } }');
            await flushMutations();
            expect(Array.from(tokens.cssRules).map(selectorOf)).toEqual([':root', scopeIn(':root')]);
        });

        it('removes the root copies on clear', () => {
            const sheet = addStyle(':root{--bg:#fff} @media (prefers-color-scheme: dark){:root{--bg:#000}}');

            engine.apply(LIGHT);
            engine.clear();
            expect(Array.from(sheet.cssRules).map(selectorOf)).toEqual([':root', ':root']);
        });

        it('passes only custom and inherited properties on to the scope roots', () => {
            // The overlay container is one of them: a background there would cover the shell.
            const sheet = addStyle('@media (prefers-color-scheme: dark) { body { background: #111; color: #eee; --x: 1 } }');

            engine.apply(DARK);
            const copy = (sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule;

            expect(copy.selectorText).toBe(scopeIn('body'));
            expect(Array.from(copy.style).sort()).toEqual(['--x', 'color']);
            expect(copy.style.getPropertyValue('color')).toBe('#eee');
        });

        it('inserts no root copy that is left with nothing to set', () => {
            const sheet = addStyle('body { background: #fff } @media (prefers-color-scheme: dark) { body { background: #111 } }');

            engine.apply(LIGHT);
            expect(sheet.cssRules).toHaveLength(3);
            expect(selectorOf(sheet.cssRules[0])).toBe('body');
            expect((sheet.cssRules[2] as CSSMediaRule).cssRules).toHaveLength(0);
        });
    });

    describe('what a copy cannot carry', () => {
        it('drops a rule whose scoped selector the browser rejects, with one warning', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            // A browser that does not take the selector with the scope added.
            const undo = writeSelectorsAs((selector) => (selector.includes(SCOPE_IN_SUFFIX) ? null : selector));

            try {
                const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } .x { color: red } }');

                engine.apply(REDUCE);
                engine.apply({ ...REDUCE, ...DARK });
                expect((sheet.cssRules[1] as CSSMediaRule).cssRules).toHaveLength(0);
                expect(warn).toHaveBeenCalledTimes(2);
                expect(warn).toHaveBeenCalledWith(expect.stringContaining('".spin"'));
                expect(warn).toHaveBeenCalledWith(expect.stringContaining('".x"'));
                // While rules still store their selectors the patched way.
                engine.clear();
            } finally {
                undo();
            }
        });

        it('drops @keyframes and @font-face, which would apply to the whole page, with one warning each', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            const sheet = addStyle(
                '@media (prefers-reduced-motion: reduce) { @keyframes fade-in { from { opacity: 0 } } @font-face { font-family: x; src: url(x.woff) } .x { animation: none } }'
            );

            engine.apply(REDUCE);
            engine.apply({ ...REDUCE, ...DARK });
            const [original, copy] = Array.from(sheet.cssRules) as CSSMediaRule[];

            expect(original.cssRules).toHaveLength(3);
            expect(Array.from(copy.cssRules).map(selectorOf)).toEqual([scopeIn('.x')]);
            expect(warn).toHaveBeenCalledTimes(2);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('@keyframes fade-in'));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('@font-face'));
        });
    });

    describe('selectors the browser writes back differently', () => {
        it('takes the suffix out in the form the browser writes it', () => {
            // An engine that drops the space after a comma whenever it stores a selector.
            const undo = writeSelectorsAs((selector) => selector.replace(/,\s+/g, ','));
            const warn = jest.spyOn(console, 'warn');

            try {
                const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

                engine.apply(REDUCE);
                expect(selectorOf(sheet.cssRules[0])).toBe(`.spin${SCOPE_OUT_SUFFIX.replace(/,\s+/g, ',')}`);

                engine.clear();
                expect(selectorOf(sheet.cssRules[0])).toBe('.spin');
                expect(warn).not.toHaveBeenCalled();
            } finally {
                undo();
            }
        });

        it('falls back to the selector it replaced when it cannot find the suffix, with a warning', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

            engine.apply(REDUCE);
            const rule = (sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule;

            rule.selectorText = rule.selectorText.replace(':not(', ':not( ');
            engine.clear();
            expect(rule.selectorText).toBe('.spin');
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('.spin'));
        });
    });

    it('tells its owner when it has rewritten styles it had not seen', async () => {
        const onNewStyles = jest.fn();

        engine = new MediaStyleSheets(document, onNewStyles);
        addStyle('.a { color: red }');
        engine.apply(DARK);
        expect(onNewStyles).toHaveBeenCalledTimes(1);

        addStyle('.b { color: blue }');
        await flushMutations();
        expect(onNewStyles).toHaveBeenCalledTimes(2);

        // A change in the head that brings no sheet is not news.
        document.head.appendChild(document.createElement('meta'));
        await flushMutations();
        expect(onNewStyles).toHaveBeenCalledTimes(2);

        engine.clear();
        addStyle('.c { color: green }');
        await flushMutations();
        expect(onNewStyles).toHaveBeenCalledTimes(2);
    });

    it('never touches an ignored sheet', () => {
        const sheet = addStyle('@media (forced-colors: active) { .t { color: CanvasText } }');

        engine.ignore(sheet);
        engine.apply({ 'forced-colors': 'active' });
        expect(sheet.cssRules).toHaveLength(1);
        expect(selectorOf(sheet.cssRules[0])).toBe('.t');
    });

    describe('a condition outside the rules', () => {
        it('warns once for an @import that tests an emulated feature', async () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();

            addStyle('@import url(dark.css) (prefers-color-scheme: dark);');
            engine.apply(DARK);
            engine.apply(LIGHT);
            addStyle('.late { color: red }');
            await flushMutations();

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('dark.css'));
        });

        it('warns once for a <link> that tests an emulated feature', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            const linked = { href: 'http://localhost/dark.css', media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] };

            listSheets(linked as unknown as CSSStyleSheet);
            engine.apply(DARK);
            engine.apply(LIGHT);

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('http://localhost/dark.css'));
        });

        it('stays quiet about a condition that tests nothing emulated', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();

            addStyle('@import url(print.css) print;');
            engine.apply(DARK);
            expect(warn).not.toHaveBeenCalled();
        });
    });

    it('skips a cross-origin sheet with one warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        const crossOrigin = {
            href: 'https://fonts.example.com/face.css',
            get cssRules(): CSSRuleList {
                throw new DOMException('Cannot access rules', 'SecurityError');
            }
        };

        listSheets(crossOrigin as unknown as CSSStyleSheet);
        engine.apply(DARK);
        engine.apply(LIGHT);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('https://fonts.example.com/face.css'));
    });
});
