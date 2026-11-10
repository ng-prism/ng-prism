import {
    collectForcedColorRules,
    collectForcedColorRulesIn,
    exemptionSelector,
    FORCED_LAYER,
    type ForcedColorRules,
    forcedColorsCss,
    mergeForcedColorRules
} from './forced-colors.js';
import { FORCED_PALETTES, SYSTEM_COLORS } from './forced-palette.js';
import { MediaStyleSheets } from './media-stylesheets.js';

const LIGHT = FORCED_PALETTES.light;
const DARK = FORCED_PALETTES.dark;

function addStyle(css: string): CSSStyleSheet {
    const style = document.createElement('style');

    style.textContent = css;
    document.head.appendChild(style);
    if (!style.sheet) throw new Error('style element has no sheet');
    return style.sheet;
}

/** A sheet as `document.styleSheets` would list it, for what jsdom cannot load: `<link>`s, `@import`s, cross-origin rules. */
function listSheets(...sheets: unknown[]): void {
    jest.spyOn(document, 'styleSheets', 'get').mockReturnValue(sheets as unknown as StyleSheetList);
}

/** A style rule as the browser nests it, which jsdom cannot parse: its own declarations and the rules inside. */
function nested(selectorText: string, cssText: string, ...rules: object[]): object {
    return { selectorText, style: { cssText }, cssRules: rules, insertRule: jest.fn(), deleteRule: jest.fn() };
}

/** The bare declarations of a nested `@media` (`CSSNestedDeclarations`): a style, no selector. */
function declarations(cssText: string): object {
    return { style: { cssText } };
}

function mediaGroup(...rules: object[]): object {
    return { cssRules: rules, media: { mediaText: '(forced-colors: active)' }, insertRule: jest.fn(), deleteRule: jest.fn() };
}

const NONE: ForcedColorRules = { exempt: [], reenabled: [], gradientVars: [], layerVars: [] };

/** The rules of `NONE` with what `found` says instead. */
const rulesOf = (found: Partial<ForcedColorRules>): ForcedColorRules => ({ ...NONE, ...found });

const OVERLAY_STRUCTURE = ':not(:where(.cdk-overlay-popover, .cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

describe('collectForcedColorRules', () => {
    afterEach(() => {
        document.head.innerHTML = '';
        delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
        jest.restoreAllMocks();
    });

    it('collects exemptions from author rules', () => {
        addStyle('.dot { forced-color-adjust: none } .p { forced-color-adjust: preserve-parent-color } .g { background: linear-gradient(red, blue) }');
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.dot', '.p'] }));
    });

    it('is empty for a document without any of them', () => {
        addStyle('.a { color: red; background: #fff } .b { forced-color-adjust: normal; background-image: none }');
        expect(collectForcedColorRules(document)).toEqual(NONE);
    });

    it('takes every selector of a list, whatever the whitespace, once', () => {
        addStyle('.a,.b > .c,\n .d:not(.e, .f) { forced-color-adjust: none } .a { forced-color-adjust: none }');
        expect(collectForcedColorRules(document).exempt).toEqual(['.a', '.b > .c', '.d:not(.e, .f)']);
    });

    it('reads rules in grouping rules, in a media query for forced colors above all', () => {
        addStyle(
            '@media (forced-colors: active) { .q { forced-color-adjust: none } } @supports (display: grid) { @media (min-width: 1px) { .r { forced-color-adjust: auto } } }'
        );
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.q'], reenabled: ['.r'] }));
    });

    it('follows the last word of a block on the exemption', () => {
        addStyle('.a { forced-color-adjust: none; forced-color-adjust: auto } .c { forced-color-adjust: auto; forced-color-adjust: none }');
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.c'], reenabled: ['.a'] }));
    });

    it('collects the rules that declare auto, which take an exemption back below it', () => {
        addStyle('.opt { forced-color-adjust: none } .opt .slot { forced-color-adjust: auto } .x:hover::before { forced-color-adjust: auto }');
        expect(collectForcedColorRules(document)).toMatchObject({ exempt: ['.opt'], reenabled: ['.opt .slot'] });
    });

    it('collects custom properties that hold a gradient somewhere and a url() nowhere', () => {
        addStyle(
            ':root { --ai: linear-gradient(red, blue); --img: url(a.png); --mix: linear-gradient(red, blue); --plain: red } .x { --mix: url(b.png) } @media (min-width: 1px) { .y { --media: radial-gradient(red, blue) } }'
        );
        expect(collectForcedColorRules(document).gradientVars).toEqual(['--ai', '--media']);
    });

    it('keeps a custom property that has both in one value out of the gradients, and its case', () => {
        addStyle(':root { --Both: linear-gradient(red, blue), url(a.png); --Case: conic-gradient(red, blue) }');
        expect(collectForcedColorRules(document).gradientVars).toEqual(['--Case']);
    });

    it('collects custom properties that some declaration gives a background list', () => {
        addStyle(
            ':root { --ring: linear-gradient(red, blue), #8529d5; --font: Inter, sans-serif; --shadow: 0 1px red, 0 2px blue; --ai: linear-gradient(red, blue) } .x { --ring: #fff } @media (min-width: 1px) { .y { --Photo: url(a.png), red } }'
        );
        expect(collectForcedColorRules(document).layerVars).toEqual(['--ring', '--Photo']);
    });

    it('leaves a pseudo-element out of the exemptions', () => {
        addStyle('.x::before { forced-color-adjust: none } .y { forced-color-adjust: none }');
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.y'] }));
    });

    it('reads the sheets that are adopted, and the ones an @import brings in', () => {
        const adopted = addStyle('.adopted { forced-color-adjust: none }');
        const imported = addStyle('.imported { forced-color-adjust: none }');
        const own = addStyle('.own { forced-color-adjust: none }');
        const importRule = { href: 'imported.css', styleSheet: imported, media: { mediaText: '' } };

        listSheets({ cssRules: [importRule] }, own);
        Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, value: [adopted] });

        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.imported', '.own', '.adopted'] }));
    });

    it('reads a sheet the media engine has rewritten as the author wrote it', () => {
        addStyle('@media (forced-colors: active) { .a, .b > .c { forced-color-adjust: none } } .a .slot { forced-color-adjust: auto } .d { color: red }');
        const before = collectForcedColorRules(document);
        const engine = new MediaStyleSheets(document);

        engine.apply({ 'forced-colors': 'active' }, { palette: 'dark', rules: before });
        try {
            // The copy in the scope and the original out of it are one rule, and the twins say nothing about exemptions.
            expect(document.styleSheets[0].cssRules.length).toBeGreaterThan(3);
            expect(collectForcedColorRules(document)).toEqual(before);
            expect(before).toEqual(rulesOf({ exempt: ['.a', '.b > .c'], reenabled: ['.a .slot'] }));
        } finally {
            engine.clear();
        }
    });

    it('leaves out the sheets it is told to skip', () => {
        const own = addStyle('.own { forced-color-adjust: none }');

        addStyle('.author { forced-color-adjust: none }');
        expect(collectForcedColorRules(document, [own])).toEqual(rulesOf({ exempt: ['.author'] }));
    });

    it('reads only the sheets it is given, when it is given some', () => {
        addStyle('.other { forced-color-adjust: none }');
        const given = addStyle('.given { forced-color-adjust: none } :root { --ai: linear-gradient(red, blue) }');

        expect(collectForcedColorRulesIn([given])).toEqual(rulesOf({ exempt: ['.given'], gradientVars: ['--ai'] }));
    });

    it('does not stop at a sheet it cannot read, a cross-origin one', () => {
        const foreign = {
            get cssRules(): CSSRuleList {
                throw new DOMException('Cannot access rules', 'SecurityError');
            }
        };
        const own = addStyle('.own { forced-color-adjust: none }');

        listSheets(foreign, own);
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.own'] }));
    });

    it('reads a sheet only once, whether it is listed twice or imported in a cycle', () => {
        const sheet = addStyle('.a { forced-color-adjust: none }');
        const cycle = { cssRules: [] as unknown[] };

        cycle.cssRules.push({ href: 'cycle.css', styleSheet: cycle, media: { mediaText: '' } });
        listSheets(sheet, sheet, cycle);
        expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.a'] }));
    });

    describe('in nested CSS', () => {
        it('resolves & to the rule it is nested in, and a bare selector to a descendant of it', () => {
            const sheet = {
                cssRules: [
                    nested(
                        '.card, .tile',
                        '',
                        nested('&::before', 'forced-color-adjust: none'),
                        nested('.icon', 'forced-color-adjust: none'),
                        nested('&.on > .mark, .dark &', 'forced-color-adjust: preserve-parent-color'),
                        nested('&:hover', '', nested('& .deep', 'forced-color-adjust: none'))
                    )
                ]
            };

            listSheets(sheet);
            expect(collectForcedColorRules(document)).toEqual(
                rulesOf({ exempt: [':is(.card, .tile) .icon', ':is(.card, .tile).on > .mark', '.dark :is(.card, .tile)', ':is(:is(.card, .tile):hover) .deep'] })
            );
        });

        it('leaves & inside a string or an attribute value as it is', () => {
            listSheets({ cssRules: [nested('.a', '', nested('&[data-x="&"]', 'forced-color-adjust: none'), nested('& :not(&.b)', 'forced-color-adjust: none'))] });
            expect(collectForcedColorRules(document).exempt).toEqual([':is(.a)[data-x="&"]', ':is(.a) :not(:is(.a).b)']);
        });

        it('takes the declarations that a nested @media holds for the rule around it', () => {
            listSheets({ cssRules: [nested('.btn', '', mediaGroup(declarations('forced-color-adjust: none')))] });
            expect(collectForcedColorRules(document)).toEqual(rulesOf({ exempt: ['.btn'] }));
        });

        it('has no selector for declarations outside a rule, such as @font-face', () => {
            listSheets({ cssRules: [{ style: { cssText: 'forced-color-adjust: none' } }] });
            expect(collectForcedColorRules(document)).toEqual(NONE);
        });
    });
});

describe('mergeForcedColorRules', () => {
    it('adds what the new styles bring to every list, once and in the order it was found', () => {
        const rules = rulesOf({ exempt: ['.a'], gradientVars: ['--ai'], layerVars: ['--ring'] });

        expect(mergeForcedColorRules(rules, rulesOf({ exempt: ['.b', '.a'], reenabled: ['.c'], gradientVars: ['--ring'], layerVars: ['--photo', '--ring'] }))).toEqual({
            exempt: ['.a', '.b'],
            reenabled: ['.c'],
            gradientVars: ['--ai', '--ring'],
            layerVars: ['--ring', '--photo']
        });
    });

    it('is the rules themselves where the new styles add nothing', () => {
        const rules = rulesOf({ exempt: ['.a'], layerVars: ['--ring'] });

        expect(mergeForcedColorRules(rules, rulesOf({ layerVars: ['--ring'] }))).toBe(rules);
    });
});

describe('exemptionSelector', () => {
    it('names what is exempt as a selector that weighs nothing, with one level of auto below it', () => {
        expect(exemptionSelector(rulesOf({ exempt: ['.opt'], reenabled: ['.slot'] }))).toBe(
            ':where(:where(.opt, .opt *):not(:where(:is(.opt) :is(.slot), :is(.opt) :is(.slot) *)))'
        );
        expect(exemptionSelector(rulesOf({ exempt: ['.opt'] }))).toBe(':where(.opt, .opt *)');
        expect(exemptionSelector(rulesOf({ exempt: ['.a', '.b > .c'], reenabled: ['.d', '.e'] }))).toBe(
            ':where(:where(.a, .b > .c, .a *, .b > .c *):not(:where(:is(.a, .b > .c) :is(.d, .e), :is(.a, .b > .c) :is(.d, .e) *)))'
        );
    });

    it('is null without an exemption, whatever an auto says', () => {
        expect(exemptionSelector(NONE)).toBeNull();
        expect(exemptionSelector(rulesOf({ reenabled: ['.slot'] }))).toBeNull();
    });

    describe('applied to a document', () => {
        let root: HTMLElement;
        const at = (selector: string): Element => {
            const element = root.querySelector(selector);

            if (!element) throw new Error(`no ${selector}`);
            return element;
        };

        beforeEach(() => {
            root = document.createElement('div');
            root.innerHTML = `
                <div class="opt" id="opt"><b id="b">b</b><i class="slot" id="slot"><span id="in-slot"><u id="deep-in-slot">u</u></span></i></div>
                <i class="slot" id="outside-slot"><span id="outside-in-slot">s</span></i>
                <div id="plain"><b id="outside-b">b</b></div>`;
            document.body.appendChild(root);
        });

        afterEach(() => root.remove());

        it('matches the exemption and what is inside it, and not what an auto takes back with all that is below it', () => {
            const selector = exemptionSelector(rulesOf({ exempt: ['.opt'], reenabled: ['.opt .slot'] }));

            if (selector === null) throw new Error('no selector');
            for (const id of ['#opt', '#b']) expect([id, at(id).matches(selector)]).toEqual([id, true]);
            for (const id of ['#slot', '#in-slot', '#deep-in-slot', '#outside-slot', '#outside-in-slot', '#plain', '#outside-b']) {
                expect([id, at(id).matches(selector)]).toEqual([id, false]);
            }
        });

        it('has the auto count only below an exemption, whatever the selector of the auto says', () => {
            const selector = exemptionSelector(rulesOf({ exempt: ['.opt'], reenabled: ['.slot'] }));

            if (selector === null) throw new Error('no selector');
            expect(at('#slot').matches(selector)).toBe(false);
            expect(at('#in-slot').matches(selector)).toBe(false);
            expect(at('#b').matches(selector)).toBe(true);
            // Not an exemption, with or without the auto.
            expect(at('#outside-slot').matches(selector)).toBe(false);
        });
    });
});

interface SheetRule {
    selector: string;
    /** The declarations by property, a value with its `!important`. */
    values: Record<string, string>;
    /** Whether the rule sits in the layer of the sheet. */
    layered: boolean;
}

/** The rules of a block of rules, without a group in it. */
function rulesIn(css: string, layered: boolean): SheetRule[] {
    const rules: SheetRule[] = [];

    for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const values: Record<string, string> = {};

        for (const declaration of match[2].split(';')) {
            const colon = declaration.indexOf(':');

            if (colon > 0) values[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
        }
        rules.push({ selector: match[1].trim(), values, layered });
    }
    return rules;
}

const parsed = new Map<string, SheetRule[]>();

/** The rules of the generated sheet, in order: those in its layer, then the ones outside it. */
function parse(css: string): SheetRule[] {
    const known = parsed.get(css);

    if (known) return known;

    const opening = `@layer ${FORCED_LAYER} {`;
    const start = css.indexOf(opening);
    let rules: SheetRule[];

    if (start < 0) {
        rules = rulesIn(css, false);
    } else {
        let end = start + opening.length;

        for (let depth = 1; depth > 0; end++) {
            if (css[end] === '{') depth++;
            else if (css[end] === '}') depth--;
        }
        rules = [...rulesIn(css.slice(0, start), false), ...rulesIn(css.slice(start + opening.length, end - 1), true), ...rulesIn(css.slice(end), false)];
    }
    parsed.set(css, rules);
    return rules;
}

/** `selector` without its `:where()` groups, nested ones inside them included, which weigh nothing. */
function withoutWhere(selector: string): string {
    let out = '';
    let i = 0;

    while (i < selector.length) {
        if (!selector.startsWith(':where(', i)) {
            out += selector[i++];
            continue;
        }
        for (let depth = 0; i < selector.length; i++) {
            if (selector[i] === '(') depth++;
            else if (selector[i] === ')' && --depth === 0) {
                i++;
                break;
            }
        }
    }
    return out;
}

type Pseudo = '' | '::before' | '::after' | '::placeholder';

/** Whether `rule` selects `element`, or its pseudo-element for `pseudo`. One selector per line, as the sheet writes a list. */
function selects(rule: SheetRule, element: Element, pseudo: Pseudo): boolean {
    return rule.selector.split(',\n').some((part) => {
        const own = /::(?:before|after|placeholder)$/.exec(part)?.[0] ?? '';

        return own === pseudo && element.matches(own === '' ? part : part.slice(0, -own.length));
    });
}

/**
 * What the sheet sets on `element`, or on its pseudo-element for `pseudo`: the declarations of
 * every rule that matches it. Every rule weighs nothing, so the order decides among the rules of the
 * layer, and the inline net comes after them and is `!important`: in the order of the sheet, a later
 * rule over an earlier one.
 */
function forcedOn(css: string, element: Element, pseudo: Pseudo = ''): Record<string, string> {
    const forced: Record<string, string> = {};

    for (const rule of parse(css)) {
        if (!selects(rule, element, pseudo)) continue;
        for (const [property, value] of Object.entries(rule.values)) forced[property] = value.replace(/\s*!important$/, '');
    }
    return forced;
}

/**
 * The custom property `name` as the sheet sets it on `element`, or on its pseudo-element: its own
 * or, since custom properties inherit, the nearest ancestor's. `undefined` for none and for
 * `initial`, which leaves a `var()` to its fallback.
 */
function customOn(css: string, element: Element, name: string, pseudo: Pseudo = ''): string | undefined {
    const chain: [Element, Pseudo][] = pseudo === '' ? [] : [[element, pseudo]];

    for (let at: Element | null = element; at; at = at.parentElement) chain.push([at, '']);
    for (const [at, own] of chain) {
        const value = forcedOn(css, at, own)[name];

        if (value !== undefined) return value === 'initial' ? undefined : value;
    }
    return undefined;
}

/** `value` with each `var(--name, fallback)` replaced by `lookup(name)`, or else by its fallback. */
function substituteVars(value: string, lookup: (name: string) => string | undefined): string {
    const start = value.indexOf('var(');

    if (start < 0) return value;

    let end = start + 'var'.length;

    for (let depth = 0; end < value.length; end++) {
        if (value[end] === '(') depth++;
        else if (value[end] === ')' && --depth === 0) break;
    }

    const [name, ...fallback] = value.slice(start + 'var('.length, end).split(',');
    const substituted = lookup(name.trim()) ?? substituteVars(fallback.join(',').trim(), lookup);

    return value.slice(0, start) + substituted + substituteVars(value.slice(end + 1), lookup);
}

/** The properties the sheet sets that inherit: an element without a value of its own takes its parent's, a pseudo-element its element's. */
const INHERITED = ['color', 'caret-color', '-webkit-text-fill-color', 'text-shadow', 'accent-color', 'scrollbar-color'];

/** {@link forcedOn} with the `var()`s resolved where they are set, and what inherits taken from the parent where the element sets nothing. */
function specifiedOn(css: string, element: Element, pseudo: Pseudo = ''): Record<string, string> {
    const values = Object.fromEntries(
        Object.entries(forcedOn(css, element, pseudo)).map(([property, value]) => [property, substituteVars(value, (name) => customOn(css, element, name, pseudo))])
    );
    const parent = pseudo !== '' ? specifiedOn(css, element) : element.parentElement ? specifiedOn(css, element.parentElement) : {};

    for (const property of INHERITED) if (values[property] === undefined && parent[property] !== undefined) values[property] = parent[property];
    return values;
}

/**
 * What the element computes from the sheet: {@link specifiedOn} with `currentcolor` taken to the
 * color of the element, which is how it inherits as well.
 */
function computedOn(css: string, element: Element, pseudo: Pseudo = ''): Record<string, string> {
    const values = specifiedOn(css, element, pseudo);

    return Object.fromEntries(
        Object.entries(values).map(([property, value]) => [property, property !== 'color' && /^currentcolor$/i.test(value) ? (values['color'] ?? value) : value])
    );
}

describe('forcedColorsCss', () => {
    it('forces the colors of the palette inside the scope only, minus exempt subtrees', () => {
        const css = forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'light');

        expect(css).toContain(`--prism-sim-fg: ${LIGHT.canvastext};`);
        expect(css).toContain('color: var(--prism-sim-fg);');
        expect(css).toContain(`--prism-sim-fg: ${LIGHT.linktext};`);
        expect(css).toContain(':not(:where(.dot, .dot *))');
    });

    it('puts its rules in the lowest layer at normal importance, and only the net for inline styles outside it and !important', () => {
        const rules = parse(forcedColorsCss(rulesOf({ exempt: ['.dot'], reenabled: ['.dot .slot'] }), 'dark'));

        expect(forcedColorsCss(NONE, 'dark')).toMatch(new RegExp(`^@layer ${FORCED_LAYER} \\{`));
        for (const { selector, values, layered } of rules) {
            const net = selector.includes('[style*=');

            expect([selector, layered]).toEqual([selector, !net]);
            for (const value of Object.values(values)) expect([selector, value.endsWith('!important')]).toEqual([selector, net]);
        }
        expect(rules.filter(({ layered }) => !layered).length).toBeGreaterThan(0);
    });

    it('writes the same rules without the layer when asked to', () => {
        const layered = parse(forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark'));
        const css = forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark', false);

        expect(css).not.toContain('@layer');
        expect(parse(css).map(({ selector, values }) => ({ selector, values }))).toEqual(layered.map(({ selector, values }) => ({ selector, values })));
    });

    it('weighs nothing', () => {
        for (const { selector } of parse(forcedColorsCss(rulesOf({ exempt: ['.dot'], reenabled: ['.dot .slot'] }), 'dark'))) {
            // Every class, attribute and type name in a selector sits in a `:where()`.
            expect(withoutWhere(selector).replace(/\*/g, '')).toMatch(/^(?:(?::not\(\)|:before|:after|::before|::after|::placeholder|,|\s)*)$/);
        }
    });

    it('writes the values of the palette instead of system color keywords, which would resolve against the normal one', () => {
        const css = forcedColorsCss(NONE, 'dark');
        const values = parse(css).flatMap(({ values }) => Object.values(values));

        // A whole name only: `background-color` holds no `Background`. Selectors name elements such as `mark`.
        for (const keyword of SYSTEM_COLORS) {
            expect([keyword, values.some((value) => new RegExp(`(?<![\\w-])${keyword}(?![\\w-])`, 'i').test(value))]).toEqual([keyword, false]);
        }
        expect(css).toContain('--prism-sim-fg: #ffffff;');
        expect(css).toContain(`--prism-sim-fg: ${DARK.linktext};`);
        expect(css).toContain(`background-color: ${DARK.buttonface};`);
    });

    it('sets the context and what inherits on the scope roots in the palette', () => {
        const css = forcedColorsCss(NONE, 'dark');

        expect(parse(css).find(({ selector }) => selector === ':where([data-prism-sim], .cdk-overlay-container)')?.values).toEqual({
            '--prism-sim-fg': '#ffffff',
            '--prism-sim-bg-rgb': '0 0 0',
            color: 'var(--prism-sim-fg)',
            '-webkit-text-fill-color': 'currentcolor',
            'caret-color': 'currentcolor',
            'text-shadow': 'none',
            'accent-color': 'auto',
            'scrollbar-color': 'auto'
        });
        expect(forcedColorsCss(NONE, 'light')).toContain('--prism-sim-bg-rgb: 255 255 255;');
    });

    it('has no rules for the paint of an SVG, no ground for every element and no rules for gradients any more', () => {
        const css = forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark');
        const properties = parse(css).flatMap(({ values }) => Object.keys(values));

        for (const paint of ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']) expect(properties).not.toContain(paint);
        expect(css).not.toMatch(/\[(?:fill|stroke)/);
        // A ground only where a user agent paints one, and an image only for an inline gradient.
        for (const { selector, values } of parse(css)) {
            if ('background-color' in values) expect([selector, /(?:input|button|mark|dialog|popover|style\*=)/.test(selector)]).toEqual([selector, true]);
            if ('background-image' in values) expect([selector, selector.includes('[style*="gradient" i]')]).toEqual([selector, true]);
            if ('box-shadow' in values) expect([selector, selector.includes('[style*=')]).toEqual([selector, true]);
        }
    });

    it('has no exemption in its selectors when none was found', () => {
        expect(forcedColorsCss(NONE, 'dark').replaceAll(OVERLAY_STRUCTURE, '')).not.toContain(':not(:where(');
    });

    it('exempts every selector together with what is inside it', () => {
        expect(forcedColorsCss(rulesOf({ exempt: ['.a', '.b > .c'] }), 'dark')).toContain(':not(:where(.a, .b > .c, .a *, .b > .c *))');
    });

    it('takes the exemption from exemptionSelector, so that what an `auto` takes back is forced again', () => {
        const rules = rulesOf({ exempt: ['.opt'], reenabled: ['.slot'] });
        const css = forcedColorsCss(rules, 'dark');

        expect(css).toContain(`:not(${exemptionSelector(rules)})`);
        // An `auto` without an exemption above it changes nothing.
        expect(forcedColorsCss(rulesOf({ reenabled: ['.slot'] }), 'dark')).toBe(forcedColorsCss(NONE, 'dark'));
    });

    it('sets the context and what inherits again below an exemption, where `auto` takes it back', () => {
        const css = forcedColorsCss(rulesOf({ exempt: ['.opt', '.card'], reenabled: ['.slot'] }), 'dark');
        // Every rule has the exemption in its selector; this one is the only that selects what an `auto` takes back.
        const again = parse(css).filter(({ selector }) => selector === ':where([data-prism-sim], .cdk-overlay-container) *:where(:is(.opt, .card) :is(.slot))');

        expect(again).toHaveLength(1);
        expect(again[0].values).toMatchObject({ '--prism-sim-fg': '#ffffff', '--prism-sim-bg-rgb': '0 0 0', color: 'var(--prism-sim-fg)', 'text-shadow': 'none' });
        expect(forcedColorsCss(rulesOf({ exempt: ['.opt'] }), 'dark')).not.toContain(':is(.opt) :is(');
    });

    describe('applied to a document', () => {
        let root: HTMLElement;
        const css = forcedColorsCss(rulesOf({ exempt: ['.dot'] }), 'dark');
        const at = (selector: string): Element => {
            const element = root.querySelector(selector);

            if (!element) throw new Error(`no ${selector}`);
            return element;
        };

        beforeEach(() => {
            root = document.createElement('div');
            root.innerHTML = `
                <div data-prism-sim id="stage">
                    <p id="text">text <a href="#x" id="link">link <span id="in-link">in</span></a> <a id="anchor">no link</a></p>
                    <input id="field" placeholder="p" /> <textarea id="area" placeholder="p"></textarea> <select id="select"></select>
                    <button id="button">b</button> <input type="submit" id="submit" />
                    <button id="disabled" disabled>d <span id="in-disabled">in</span></button>
                    <input type="search" id="search-disabled" disabled /> <input type="TEXT" id="text-disabled" disabled /> <input type="reset" id="reset-disabled" disabled />
                    <select id="select-disabled" disabled></select> <textarea id="area-disabled" disabled></textarea>
                    <select><optgroup id="group-disabled" label="g" disabled><option id="in-group">o</option></optgroup></select>
                    <input id="plain-disabled" disabled /> <input type="checkbox" id="checkbox-disabled" disabled /> <input type="file" id="file-disabled" disabled />
                    <mark id="mark">m <span id="in-mark">in <b id="deep-in-mark">deep</b></span> <mark id="nested-mark">n</mark></mark>
                    <div id="focus-host" tabindex="0"><span id="in-focus">in</span></div>
                    <hr id="rule" /> <dialog open id="dialog-native">d <span id="in-dialog">in</span></dialog> <div popover id="popover-native">p</div>
                    <div id="inline" style="background: red; color: blue">i</div> <div id="inline-border" style="border: 1px solid red">b</div>
                    <div id="inline-rest" style="box-shadow: 0 0 2px red; text-shadow: 1px 1px red; outline: 1px solid red; background-image: linear-gradient(red, blue)">r</div>
                    <div id="inline-url" style="background-image: url(a.png), linear-gradient(red, blue)">u</div>
                    <mark id="inline-mark" style="Background: orange">m <span id="inline-in-mark" style="background-color: red">in</span></mark>
                    <div class="dot" id="dot"><span id="in-dot" style="color: red; background: red; border: 1px solid red"></span><a href="#x" id="dot-link"></a></div>
                    <svg id="svg"><path id="plain"></path><path id="named" fill="#f00" stroke="blue"></path></svg>
                </div>
                <div class="cdk-overlay-container" id="overlay">
                    <div id="pane"><button id="menu-button">m</button></div>
                    <div class="cdk-overlay-backdrop" id="backdrop" style="background: rgba(0, 0, 0, 0.32); box-shadow: 0 0 1px red"></div>
                    <div class="cdk-global-overlay-wrapper" id="wrapper" style="color: red"><div class="cdk-overlay-pane" id="dialog"><p id="dialog-text">t</p></div></div>
                    <div class="cdk-overlay-connected-position-bounding-box" id="bounding-box"><div class="cdk-overlay-pane" id="menu-pane"></div></div>
                    <div class="cdk-overlay-popover" popover="manual" id="popover" style="background: none"><div class="cdk-overlay-pane" id="bare-pane"><p id="bare-text">t</p></div></div>
                </div>
                <div id="shell"><button id="shell-button">s</button><span id="shell-inline" style="color: red; background: red; border: 1px solid red">s</span></div>`;
            document.body.appendChild(root);
        });

        afterEach(() => root.remove());

        it('forces the colors of what is inside the scope', () => {
            expect(computedOn(css, at('#text'))).toMatchObject({
                color: DARK.canvastext,
                'border-color': DARK.canvastext,
                'outline-color': DARK.canvastext,
                'text-decoration-color': DARK.canvastext,
                'text-emphasis-color': DARK.canvastext,
                'column-rule-color': DARK.canvastext,
                'caret-color': DARK.canvastext,
                'text-shadow': 'none',
                'accent-color': 'auto',
                'scrollbar-color': 'auto'
            });
        });

        it('sets what inherits only on the scope roots, the elements a user agent colors and what an auto takes back, so that the rest inherits it', () => {
            // An element without a color of its own takes its parent's, a system color the author keeps there included.
            for (const selector of ['#text', '#in-link', '#in-mark', '#in-focus', '#pane', '#dialog-text', '#in-dialog']) {
                const forced = forcedOn(css, at(selector));

                for (const property of INHERITED) expect([selector, property, forced[property]]).toEqual([selector, property, undefined]);
            }
            for (const selector of ['#stage', '#overlay']) expect(forcedOn(css, at(selector))).toMatchObject({ color: 'var(--prism-sim-fg)', 'text-shadow': 'none' });
            for (const selector of ['#link', '#field', '#button', '#disabled', '#mark', '#rule', '#dialog-native', '#popover-native']) {
                expect([selector, forcedOn(css, at(selector))['color']]).toEqual([selector, 'var(--prism-sim-fg)']);
            }
        });

        it('forces every other foreground to the color of the element, as Chromium does', () => {
            // A border, an outline, a decoration and a caret take the element's own color, whatever it is: the text color, `LinkText` on a link.
            expect(forcedOn(css, at('#text'))).toMatchObject({
                'border-color': 'currentcolor',
                'outline-color': 'var(--prism-sim-outline, currentcolor)',
                'text-decoration-color': 'currentcolor',
                'text-emphasis-color': 'currentcolor',
                'column-rule-color': 'currentcolor',
                'row-rule-color': 'currentcolor'
            });
            expect(computedOn(css, at('#link'))).toMatchObject({
                color: DARK.linktext,
                'border-color': DARK.linktext,
                'outline-color': DARK.linktext,
                'caret-color': DARK.linktext
            });
            expect(computedOn(css, at('#in-link'), '::before')).toMatchObject({ color: DARK.linktext, 'border-color': DARK.linktext });
        });

        it('forces the overlay container and what it holds in the same way', () => {
            expect(computedOn(css, at('#pane'))).toMatchObject({ color: DARK.canvastext, 'border-color': DARK.canvastext });
            expect(computedOn(css, at('#menu-button'))).toMatchObject({ color: DARK.buttontext, 'background-color': DARK.buttonface });
        });

        it('paints no element of its own accord but those a user agent paints: the author does, through the twins', () => {
            for (const selector of ['#text', '#pane', '#dialog', '#bare-pane', '#wrapper', '#bounding-box', '#svg', '#in-mark']) {
                for (const pseudo of ['', '::before', '::after'] as const) {
                    const forced = forcedOn(css, at(selector), pseudo);

                    expect([selector, pseudo, forced['background-color'], forced['box-shadow'], forced['background-image']]).toEqual([
                        selector,
                        pseudo,
                        undefined,
                        undefined,
                        undefined
                    ]);
                }
            }
        });

        it('still forces the colors on the generated content, and leaves it to an exempt subtree', () => {
            for (const pseudo of ['::before', '::after'] as const) {
                expect(computedOn(css, at('#text'), pseudo)).toMatchObject({
                    color: DARK.canvastext,
                    'border-color': DARK.canvastext,
                    'outline-color': DARK.canvastext,
                    'text-decoration-color': DARK.canvastext,
                    'text-shadow': 'none'
                });
                expect(computedOn(css, at('#link'), pseudo)).toMatchObject({ color: DARK.linktext, 'border-color': DARK.linktext });
                expect(forcedOn(css, at('#dot'), pseudo)).toEqual({});
                expect(forcedOn(css, at('#in-dot'), pseudo)).toEqual({});
                expect(forcedOn(css, at('#shell'), pseudo)).toEqual({});
            }
        });

        it('lets the fill of text follow its color, so that gradient text does not vanish with its gradient', () => {
            expect(forcedOn(css, at('#stage'))['-webkit-text-fill-color']).toBe('currentcolor');
            // The keyword inherits and takes the color of each element.
            for (const selector of ['#text', '#link', '#in-link', '#button', '#field', '#dialog-text']) {
                expect([selector, computedOn(css, at(selector))['-webkit-text-fill-color']]).toEqual([selector, computedOn(css, at(selector))['color']]);
            }
            expect(computedOn(css, at('#link'))['-webkit-text-fill-color']).toBe(DARK.linktext);
            expect(forcedOn(css, at('#dot'))).not.toHaveProperty('-webkit-text-fill-color');
            expect(forcedOn(css, at('#shell'))).not.toHaveProperty('-webkit-text-fill-color');
        });

        it('leaves the page outside the scope alone', () => {
            for (const selector of ['#shell', '#shell-button', '#shell-inline']) expect(forcedOn(css, at(selector))).toEqual({});
        });

        it('does not paint the scope roots, which stand in for the page behind them: only what inherits', () => {
            for (const selector of ['#stage', '#overlay']) {
                const forced = computedOn(css, at(selector));

                expect(forced['color']).toBe(DARK.canvastext);
                for (const property of ['background-color', 'border-color', 'outline-color', 'box-shadow', 'background-image']) {
                    expect(forced).not.toHaveProperty(property);
                }
            }
        });

        it('takes links to LinkText and native disabled buttons to GrayText, through the context', () => {
            // The element sets the context, its color and borders read it, and what is inside inherits it.
            expect(forcedOn(css, at('#link'))).toMatchObject({ '--prism-sim-fg': DARK.linktext, color: 'var(--prism-sim-fg)', 'border-color': 'currentcolor' });
            expect(forcedOn(css, at('#in-link'))).not.toHaveProperty('--prism-sim-fg');
            expect(forcedOn(css, at('#disabled'))).toMatchObject({ '--prism-sim-fg': DARK.graytext, color: 'var(--prism-sim-fg)' });
            for (const selector of ['#link', '#in-link']) {
                expect(computedOn(css, at(selector))).toMatchObject({
                    color: DARK.linktext,
                    'border-color': DARK.linktext,
                    'text-decoration-color': DARK.linktext,
                    'caret-color': DARK.linktext
                });
            }
            for (const selector of ['#disabled', '#in-disabled', '#search-disabled']) {
                expect(computedOn(css, at(selector))).toMatchObject({ color: DARK.graytext, 'border-color': DARK.graytext });
            }
            expect(computedOn(css, at('#anchor'))['color']).toBe(DARK.canvastext);
        });

        it('grays out the controls Chromium grays out when disabled, and only those', () => {
            for (const selector of ['#text-disabled', '#reset-disabled', '#select-disabled', '#area-disabled', '#group-disabled', '#in-group']) {
                expect([selector, computedOn(css, at(selector))['color']]).toEqual([selector, DARK.graytext]);
            }
            // An input without a type, a checkbox and a file input keep the text color of a field.
            for (const selector of ['#plain-disabled', '#checkbox-disabled', '#file-disabled']) {
                expect([selector, computedOn(css, at(selector))['color']]).toEqual([selector, DARK.fieldtext]);
            }
        });

        it('takes buttons to ButtonText on ButtonFace and fields to FieldText on Field', () => {
            for (const selector of ['#button', '#submit']) {
                expect(computedOn(css, at(selector))).toMatchObject({ color: DARK.buttontext, 'background-color': DARK.buttonface, 'border-color': DARK.buttontext });
            }
            for (const selector of ['#field', '#area', '#select']) {
                expect(computedOn(css, at(selector))).toMatchObject({ color: DARK.fieldtext, 'background-color': DARK.field, 'border-color': DARK.fieldtext });
            }
        });

        it('takes rules, dialogs and popovers to the colors Chromium gives them, as it does any other element its user agent colors', () => {
            expect(computedOn(css, at('#rule'))).toMatchObject({ color: DARK.canvastext, 'border-color': DARK.canvastext });
            for (const selector of ['#dialog-native', '#popover-native']) {
                expect(computedOn(css, at(selector))).toMatchObject({ color: DARK.canvastext, 'background-color': DARK.canvas });
            }
        });

        it('takes a mark to MarkText on Mark, and gives what is inside it the text color but not the ground', () => {
            expect(computedOn(css, at('#mark'))).toMatchObject({ color: DARK.marktext, 'background-color': DARK.mark, '--prism-sim-bg-rgb': '255 255 0' });
            for (const selector of ['#in-mark', '#deep-in-mark']) {
                expect(computedOn(css, at(selector))['color']).toBe(DARK.marktext);
                expect(customOn(css, at(selector), '--prism-sim-bg-rgb')).toBe('0 0 0');
            }
            // A mark inside a mark is one again; the generated content of either gets the ground of the page.
            expect(computedOn(css, at('#nested-mark'))).toMatchObject({ color: DARK.marktext, 'background-color': DARK.mark, '--prism-sim-bg-rgb': '255 255 0' });
            for (const selector of ['#mark', '#nested-mark']) {
                for (const pseudo of ['::before', '::after'] as const)
                    expect([selector, pseudo, customOn(css, at(selector), '--prism-sim-bg-rgb', pseudo)]).toEqual([selector, pseudo, '0 0 0']);
            }
        });

        it('takes the placeholder of a field to GrayText', () => {
            for (const selector of ['#field', '#area']) expect(computedOn(css, at(selector), '::placeholder')).toMatchObject({ color: DARK.graytext });
            expect(forcedOn(css, at('#in-dot'), '::placeholder')).toEqual({});
        });

        it('takes the outline of the element with visible focus to Highlight, and of nothing inside it or beside it', () => {
            (at('#field') as HTMLElement).focus();
            expect(computedOn(css, at('#field'))['outline-color']).toBe(DARK.highlight);
            expect(computedOn(css, at('#area'))['outline-color']).toBe(DARK.fieldtext);

            (at('#focus-host') as HTMLElement).focus();
            expect(computedOn(css, at('#focus-host'))['outline-color']).toBe(DARK.highlight);
            expect(computedOn(css, at('#in-focus'))['outline-color']).toBe(DARK.canvastext);
            expect(computedOn(css, at('#field'))['outline-color']).toBe(DARK.fieldtext);
            // Nor of its generated content, which inherits from it.
            for (const pseudo of ['::before', '::after'] as const)
                expect([pseudo, computedOn(css, at('#focus-host'), pseudo)['outline-color']]).toEqual([pseudo, DARK.canvastext]);
        });

        describe('the net for inline styles', () => {
            const net = parse(css).filter(({ selector }) => selector.includes('[style*='));
            const netOn = (element: Element): Record<string, string> =>
                Object.assign({}, ...net.filter(({ selector }) => element.matches(selector)).map(({ values }) => values));

            it('forces an inline color, background and border, whatever the rule weighs', () => {
                // `!important` at the weight of nothing: an inline declaration has no weight to beat it with.
                expect(netOn(at('#inline'))).toEqual({ color: 'var(--prism-sim-fg) !important', 'background-color': 'rgb(var(--prism-sim-bg-rgb)) !important' });
                expect(netOn(at('#inline-border'))).toEqual({ 'border-color': 'currentcolor !important' });
                expect(computedOn(css, at('#inline'))).toMatchObject({ color: DARK.canvastext, 'background-color': 'rgb(0 0 0)', 'border-color': DARK.canvastext });
                // The ground of the context: Mark on a mark, the page's inside it.
                expect(computedOn(css, at('#inline-mark'))['background-color']).toBe('rgb(255 255 0)');
                expect(computedOn(css, at('#inline-in-mark'))['background-color']).toBe('rgb(0 0 0)');
            });

            it('forces inline shadows, an inline outline and an inline gradient without a url()', () => {
                expect(netOn(at('#inline-rest'))).toEqual({
                    'box-shadow': 'none !important',
                    'text-shadow': 'none !important',
                    'outline-color': 'var(--prism-sim-outline, currentcolor) !important',
                    'background-color': 'rgb(var(--prism-sim-bg-rgb)) !important',
                    'background-image': 'none !important'
                });
                expect(netOn(at('#inline-url'))).not.toHaveProperty('background-image');
            });

            it('has one rule for each property, so that a selector the browser rejects takes no other with it', () => {
                expect(net.length).toBeGreaterThan(0);
                for (const { selector, values } of net) expect([selector, Object.keys(values).length]).toEqual([selector, 1]);
            });

            it('leaves the scope roots, an exempt subtree, the page and the layout elements of the CDK overlay alone', () => {
                // The simulation gives a scope root an inline `color-scheme`; the overlay's layout elements are as large as the viewport.
                at('#stage').setAttribute('style', 'color-scheme: dark; background: red; border: 0');
                for (const selector of ['#stage', '#in-dot', '#shell-inline', '#backdrop', '#wrapper', '#popover'])
                    expect([selector, netOn(at(selector))]).toEqual([selector, {}]);
            });
        });

        it('leaves an exempt subtree to the author, links in it included', () => {
            for (const selector of ['#dot', '#in-dot', '#dot-link']) expect(forcedOn(css, at(selector))).toEqual({});
        });

        it('leaves the fill and stroke of an SVG to the author, as Chromium does', () => {
            expect(forcedOn(css, at('#named'))).not.toHaveProperty('fill');
            expect(forcedOn(css, at('#named'))).not.toHaveProperty('stroke');
        });

        it('leaves the stops of a gradient and the colors of a filter to the author as well, as Chromium does', () => {
            for (const paint of ['stop-color', 'flood-color', 'lighting-color']) expect(forcedOn(css, at('#plain'))).not.toHaveProperty(paint);
        });
    });
});

describe('forcedColorsCss with an auto below an exemption', () => {
    let root: HTMLElement;
    const css = forcedColorsCss(rulesOf({ exempt: ['.opt'], reenabled: ['.opt .slot'] }), 'dark');
    const at = (selector: string): Element => {
        const element = root.querySelector(selector);

        if (!element) throw new Error(`no ${selector}`);
        return element;
    };

    beforeEach(() => {
        root = document.createElement('div');
        root.innerHTML = `
            <div data-prism-sim id="stage">
                <a href="#x" id="link"><div class="opt" id="opt"><b id="b">b</b><span class="slot" id="slot"><span id="in-slot">in</span></span><i class="other" id="other">o</i></div></a>
            </div>`;
        document.body.appendChild(root);
    });

    afterEach(() => root.remove());

    it('leaves the exemption and what is inside it to the author', () => {
        for (const selector of ['#opt', '#b', '#other']) expect([selector, forcedOn(css, at(selector))]).toEqual([selector, {}]);
    });

    it('forces the element that takes the exemption back, and what is inside it, in the context of the page and not of the link around the exemption', () => {
        expect(computedOn(css, at('#slot'))).toMatchObject({ color: DARK.canvastext, 'border-color': DARK.canvastext, 'text-shadow': 'none' });
        expect(computedOn(css, at('#in-slot'))).toMatchObject({ color: DARK.canvastext, 'border-color': DARK.canvastext });
        expect(customOn(css, at('#in-slot'), '--prism-sim-bg-rgb')).toBe('0 0 0');
        // Without the context set again, it would inherit what the exemption inherits from the link.
        expect(customOn(css, at('#opt'), '--prism-sim-fg')).toBe(DARK.linktext);
    });
});
