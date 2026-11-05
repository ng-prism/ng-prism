import { PseudoStyleSheets } from '../pseudo/pseudo-stylesheets.js';
import { MEDIA_FALSE, MEDIA_TRUE } from './media-condition.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { SCOPE_OUT_SUFFIX, scopeIn } from './scope-selector.js';

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
        it('marks every declaration of a copied forced-colors rule !important', () => {
            const sheet = addStyle('@media (forced-colors: active) { .t { outline-color: Highlight } }');

            engine.apply({ 'forced-colors': 'active' });
            expect(((sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyPriority('outline-color')).toBe('important');
        });

        it('marks the nested rules of the copy, and leaves the original as it is', () => {
            const sheet = addStyle(
                '@media (forced-colors: active) { @supports (outline-style: solid) { .t { outline: 2px solid CanvasText; background: url("a;b.png") } } }'
            );

            engine.apply({ 'forced-colors': 'active' });
            const original = ((sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSSupportsRule).cssRules[0] as CSSStyleRule;
            const copy = ((sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSSupportsRule).cssRules[0] as CSSStyleRule;

            expect(original.style.getPropertyPriority('background')).toBe('');
            expect(copy.style.getPropertyPriority('background')).toBe('important');
            expect(copy.style.getPropertyValue('background')).toBe(original.style.getPropertyValue('background'));
        });

        it('leaves the priorities of a copy alone when forced colors are not emulated', () => {
            const sheet = addStyle('@media (prefers-color-scheme: dark) and (forced-colors: active) { .t { color: white } }');

            engine.apply(DARK);
            expect(((sheet.cssRules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyPriority('color')).toBe('');
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
    });

    describe('selectors the browser writes back differently', () => {
        it('takes the suffix out in the form the browser writes it', () => {
            // An engine that drops the space after a comma whenever it stores a selector.
            const proto = CSSStyleRule.prototype;
            const own = Object.getOwnPropertyDescriptor(proto, 'selectorText');
            const texts = new WeakMap<object, string>();
            const warn = jest.spyOn(console, 'warn');

            Object.defineProperty(proto, 'selectorText', {
                configurable: true,
                get(this: object): string {
                    return texts.get(this) ?? '';
                },
                set(this: object, value: string) {
                    texts.set(this, value.replace(/,\s+/g, ','));
                }
            });
            try {
                const sheet = addStyle('@media (prefers-reduced-motion: reduce) { .spin { animation: none } }');

                engine.apply(REDUCE);
                expect(selectorOf(sheet.cssRules[0])).toBe(`.spin${SCOPE_OUT_SUFFIX.replace(/,\s+/g, ',')}`);

                engine.clear();
                expect(selectorOf(sheet.cssRules[0])).toBe('.spin');
                expect(warn).not.toHaveBeenCalled();
            } finally {
                if (own) Object.defineProperty(proto, 'selectorText', own);
                else delete (proto as { selectorText?: string }).selectorText;
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
