import { collectForcedColorRules, FORCED_PROPERTIES, type ForcedColorRules, forcedColorsCss, isForced } from './forced-colors.js';
import { FORCED_PALETTES, SYSTEM_COLORS } from './forced-palette.js';

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

const NONE: ForcedColorRules = { exempt: [], gradients: [] };

const OVERLAY_STRUCTURE = ':not(:where(.cdk-overlay-popover, .cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

describe('collectForcedColorRules', () => {
    afterEach(() => {
        document.head.innerHTML = '';
        delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
        jest.restoreAllMocks();
    });

    it('collects exemptions and gradients from author rules', () => {
        addStyle(
            '.dot { forced-color-adjust: none } .p { forced-color-adjust: preserve-parent-color } .g { background: linear-gradient(red, blue) } .u { background-image: url(x.png) }'
        );
        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.dot', '.p'], gradients: ['.g'] });
    });

    it('is empty for a document without either', () => {
        addStyle('.a { color: red; background: #fff } .b { forced-color-adjust: auto; background-image: none }');
        expect(collectForcedColorRules(document)).toEqual(NONE);
    });

    it('takes every selector of a list, whatever the whitespace, once', () => {
        addStyle('.a,.b > .c,\n .d:not(.e, .f) { forced-color-adjust: none } .a { forced-color-adjust: none }');
        expect(collectForcedColorRules(document).exempt).toEqual(['.a', '.b > .c', '.d:not(.e, .f)']);
    });

    it('reads rules in grouping rules, in a media query for forced colors above all', () => {
        addStyle(
            '@media (forced-colors: active) { .q { forced-color-adjust: none } } @supports (display: grid) { @media (min-width: 1px) { .r { background: radial-gradient(red, blue) } } }'
        );
        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.q'], gradients: ['.r'] });
    });

    it('lets a gradient fall away only where the browser would: no url() beside it', () => {
        addStyle(
            [
                '.a { background-image: linear-gradient(red, blue), url(y.png) }',
                '.b { background: url("g.png"), linear-gradient(red, blue) }',
                '.c { background-image: repeating-conic-gradient(red, blue 10%) }',
                '.d { background: -webkit-linear-gradient(red, blue) !important }',
                '.e { background: LINEAR-GRADIENT(red, blue) }',
                '.f { background-image: none }'
            ].join('\n')
        );
        expect(collectForcedColorRules(document).gradients).toEqual(['.c', '.d', '.e']);
    });

    it('follows the last word of a block on the exemption and on the image', () => {
        addStyle('.a { forced-color-adjust: none; forced-color-adjust: auto } .b { background: linear-gradient(red, blue); background-image: url(x.png) }');
        expect(collectForcedColorRules(document)).toEqual(NONE);
    });

    it('keeps the pseudo-element of a gradient and leaves a pseudo-element out of the exemptions', () => {
        addStyle('.b::before, .c:hover::after { background: linear-gradient(red, blue) } .x::before { forced-color-adjust: none } .y { forced-color-adjust: none }');
        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.y'], gradients: ['.b::before', '.c:hover::after'] });
    });

    it('reads the sheets that are adopted, and the ones an @import brings in', () => {
        const adopted = addStyle('.adopted { forced-color-adjust: none }');
        const imported = addStyle('.imported { background: linear-gradient(red, blue) }');
        const own = addStyle('.own { forced-color-adjust: none }');
        const importRule = { href: 'imported.css', styleSheet: imported, media: { mediaText: '' } };

        listSheets({ cssRules: [importRule] }, own);
        Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, value: [adopted] });

        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.own', '.adopted'], gradients: ['.imported'] });
    });

    it('leaves out the sheets it is told to skip', () => {
        const own = addStyle('.own { forced-color-adjust: none }');

        addStyle('.author { forced-color-adjust: none }');
        expect(collectForcedColorRules(document, [own])).toEqual({ exempt: ['.author'], gradients: [] });
    });

    it('does not stop at a sheet it cannot read, a cross-origin one', () => {
        const foreign = {
            get cssRules(): CSSRuleList {
                throw new DOMException('Cannot access rules', 'SecurityError');
            }
        };
        const own = addStyle('.own { forced-color-adjust: none }');

        listSheets(foreign, own);
        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.own'], gradients: [] });
    });

    it('reads a sheet only once, whether it is listed twice or imported in a cycle', () => {
        const sheet = addStyle('.a { forced-color-adjust: none }');
        const cycle = { cssRules: [] as unknown[] };

        cycle.cssRules.push({ href: 'cycle.css', styleSheet: cycle, media: { mediaText: '' } });
        listSheets(sheet, sheet, cycle);
        expect(collectForcedColorRules(document)).toEqual({ exempt: ['.a'], gradients: [] });
    });

    describe('in nested CSS', () => {
        it('resolves & to the rule it is nested in, and a bare selector to a descendant of it', () => {
            const sheet = {
                cssRules: [
                    nested(
                        '.card, .tile',
                        '',
                        nested('&::before', 'background: linear-gradient(red, blue)'),
                        nested('.icon', 'forced-color-adjust: none'),
                        nested('&.on > .mark, .dark &', 'forced-color-adjust: preserve-parent-color'),
                        nested('&:hover', '', nested('& .deep', 'forced-color-adjust: none'))
                    )
                ]
            };

            listSheets(sheet);
            expect(collectForcedColorRules(document)).toEqual({
                exempt: [':is(.card, .tile) .icon', ':is(.card, .tile).on > .mark', '.dark :is(.card, .tile)', ':is(:is(.card, .tile):hover) .deep'],
                gradients: [':is(.card, .tile)::before']
            });
        });

        it('leaves & inside a string or an attribute value as it is', () => {
            listSheets({ cssRules: [nested('.a', '', nested('&[data-x="&"]', 'forced-color-adjust: none'), nested('& :not(&.b)', 'forced-color-adjust: none'))] });
            expect(collectForcedColorRules(document).exempt).toEqual([':is(.a)[data-x="&"]', ':is(.a) :not(:is(.a).b)']);
        });

        it('takes the declarations that a nested @media holds for the rule around it', () => {
            listSheets({ cssRules: [nested('.btn', '', mediaGroup(declarations('forced-color-adjust: none')))] });
            expect(collectForcedColorRules(document)).toEqual({ exempt: ['.btn'], gradients: [] });
        });

        it('has no selector for declarations outside a rule, such as @font-face', () => {
            listSheets({ cssRules: [{ style: { cssText: 'forced-color-adjust: none' } }] });
            expect(collectForcedColorRules(document)).toEqual(NONE);
        });
    });
});

/** What a rule of the generated sheet sets: its selector and its declarations, property by property. */
function parse(css: string): { selector: string; values: Record<string, string> }[] {
    const rules: { selector: string; values: Record<string, string> }[] = [];

    for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const values: Record<string, string> = {};

        for (const declaration of match[2].split(';')) {
            const colon = declaration.indexOf(':');

            if (colon > 0) values[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
        }
        rules.push({ selector: match[1].trim(), values });
    }
    return rules;
}

type Pseudo = '' | '::before' | '::after' | '::placeholder';

/**
 * What the sheet forces on `element`, or on its pseudo-element for `pseudo`: the
 * declarations of every rule that matches it, a later rule over an earlier one. All of them are
 * `!important` at the same weight, which is how the sheet is written, so the order is all there
 * is to the cascade among them.
 */
function forcedOn(css: string, element: Element, pseudo: Pseudo = ''): Record<string, string> {
    const forced: Record<string, string> = {};

    for (const { selector, values } of parse(css)) {
        // One selector per line, as the sheet writes a list.
        const matches = selector.split(',\n').some((part) => {
            const own = /::(?:before|after|placeholder)$/.exec(part)?.[0] ?? '';

            return own === pseudo && element.matches(own === '' ? part : part.slice(0, -own.length));
        });

        if (!matches) continue;
        for (const [property, value] of Object.entries(values)) forced[property] = value.replace(/\s*!important$/, '');
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

/**
 * {@link forcedOn} with the `var()`s of the context resolved and `currentcolor` taken to the color
 * of the element: what the element computes from the sheet.
 */
function computedOn(css: string, element: Element, pseudo: Pseudo = ''): Record<string, string> {
    const forced = forcedOn(css, element, pseudo);
    const resolved = Object.fromEntries(
        Object.entries(forced).map(([property, value]) => [property, substituteVars(value, (name) => customOn(css, element, name, pseudo))])
    );

    return Object.fromEntries(
        Object.entries(resolved).map(([property, value]) => [property, property !== 'color' && /^currentcolor$/i.test(value) ? (resolved['color'] ?? value) : value])
    );
}

describe('forcedColorsCss', () => {
    it('forces the colors of the palette inside the scope only, minus exempt subtrees', () => {
        const css = forcedColorsCss({ exempt: ['.dot'], gradients: ['.g'] }, 'light');

        expect(css).toContain(`--prism-sim-fg: ${LIGHT.canvastext} !important`);
        expect(css).toContain('color: var(--prism-sim-fg) !important');
        expect(css).toContain(`background-color: ${LIGHT.canvas} !important`);
        expect(css).toContain('box-shadow: none !important');
        expect(css).toContain(`--prism-sim-fg: ${LIGHT.linktext} !important`);
        expect(css).toContain(':not(:where(.dot, .dot *))');
        expect(css).toMatch(/:where\(\.g\)[^{]*\{[^}]*background-image: none !important/);
    });

    it('writes the values of the palette instead of system color keywords, which would resolve against the normal one', () => {
        const css = forcedColorsCss(NONE, 'dark');
        const values = parse(css).flatMap(({ values }) => Object.values(values));

        // A whole name only: `background-color` holds no `Background`. Selectors name elements such as `mark`.
        for (const keyword of SYSTEM_COLORS) {
            expect([keyword, values.some((value) => new RegExp(`(?<![\\w-])${keyword}(?![\\w-])`, 'i').test(value))]).toEqual([keyword, false]);
        }
        expect(css).toContain('--prism-sim-fg: #ffffff !important');
        expect(css).toContain('background-color: #000000 !important');
        expect(css).toContain(`--prism-sim-fg: ${DARK.linktext} !important`);
    });

    it('sets the context on the scope roots in the palette', () => {
        const css = forcedColorsCss(NONE, 'dark');
        const root = document.createElement('div');

        root.setAttribute('data-prism-sim', '');
        expect(parse(css).find(({ selector }) => selector === ':where([data-prism-sim], .cdk-overlay-container)')?.values).toEqual({
            '--prism-sim-fg': '#ffffff !important',
            '--prism-sim-bg-rgb': '0 0 0 !important'
        });
        // The color of a root, as of everything in the scope, is the context's.
        expect(forcedOn(css, root)).toMatchObject({ '--prism-sim-fg': '#ffffff', '--prism-sim-bg-rgb': '0 0 0', color: 'var(--prism-sim-fg)' });
        expect(forcedColorsCss(NONE, 'light')).toContain('--prism-sim-bg-rgb: 255 255 255 !important');
    });

    it('has no fill or stroke rules any more', () => {
        const css = forcedColorsCss({ exempt: ['.dot'], gradients: ['.g'] }, 'dark');
        const properties = parse(css).flatMap(({ values }) => Object.keys(values));

        expect(properties).not.toContain('fill');
        expect(properties).not.toContain('stroke');
        expect(css).not.toMatch(/\[(?:fill|stroke)/);
    });

    it('keeps the layout elements of the CDK overlay out of its grounds, with a selector that weighs nothing', () => {
        const css = forcedColorsCss(NONE, 'dark');

        expect(css).toContain(OVERLAY_STRUCTURE);
        expect(css).toContain('-webkit-text-fill-color: currentColor !important');
    });

    it('has no exemption in its selectors when none was found', () => {
        expect(forcedColorsCss(NONE, 'dark').replaceAll(OVERLAY_STRUCTURE, '')).not.toContain(':not(:where(');
        expect(forcedColorsCss(NONE, 'dark')).not.toContain('background-image');
    });

    it('exempts every selector together with what is inside it', () => {
        expect(forcedColorsCss({ exempt: ['.a', '.b > .c'], gradients: [] }, 'dark')).toContain(':not(:where(.a, .b > .c, .a *, .b > .c *))');
    });

    it('weighs nothing and wins over the author, which is as important', () => {
        for (const { selector, values } of parse(forcedColorsCss({ exempt: ['.dot'], gradients: ['.g', '.b::before'] }, 'dark'))) {
            // Every class, attribute and type name in a selector sits in a `:where()`.
            expect(selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/\*/g, '')).toMatch(
                /^(?:(?::not\(\)|:before|:after|::before|::after|::placeholder|,|\s)*)$/
            );
            for (const value of Object.values(values)) expect(value).toMatch(/ !important$/);
        }
    });

    it('lists every property it sets as forced, and nothing else; the custom properties of the context are none', () => {
        const set = new Set(parse(forcedColorsCss({ exempt: ['.dot'], gradients: ['.g'] }, 'dark')).flatMap(({ values }) => Object.keys(values)));
        const context = ['--prism-sim-fg', '--prism-sim-bg-rgb', '--prism-sim-outline'];

        expect(
            Array.from(set)
                .filter((property) => property.startsWith('--'))
                .sort()
        ).toEqual([...context].sort());
        expect(Array.from(FORCED_PROPERTIES).sort()).toEqual(
            Array.from(set)
                .filter((property) => !context.includes(property))
                .sort()
        );
    });

    describe('applied to a document', () => {
        let root: HTMLElement;
        const css = forcedColorsCss({ exempt: ['.dot'], gradients: ['.g', '.g::before'] }, 'dark');
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
                    <div id="inline" style="background: red; color: blue">i</div> <div id="inline-border" style="border: 1px solid red">b</div>
                    <mark id="inline-mark" style="Background: orange">m <span id="inline-in-mark" style="background-color: red">in</span></mark>
                    <div class="g" id="gradient"></div>
                    <div class="dot" id="dot"><span id="in-dot" style="color: red; background: red; border: 1px solid red"></span><a href="#x" id="dot-link"></a></div>
                    <svg id="svg"><path id="plain"></path><path id="named" fill="#f00" stroke="blue"></path></svg>
                </div>
                <div class="cdk-overlay-container" id="overlay">
                    <div id="pane"><button id="menu-button">m</button></div>
                    <div class="cdk-overlay-backdrop" id="backdrop"></div>
                    <div class="cdk-global-overlay-wrapper" id="wrapper"><div class="cdk-overlay-pane" id="dialog"><p id="dialog-text">t</p></div></div>
                    <div class="cdk-overlay-connected-position-bounding-box" id="bounding-box"><div class="cdk-overlay-pane" id="menu-pane"></div></div>
                    <div class="cdk-overlay-popover" popover="manual" id="popover"><div class="cdk-overlay-pane" id="bare-pane"><p id="bare-text">t</p></div></div>
                </div>
                <div id="shell"><button id="shell-button">s</button><span id="shell-inline" style="color: red; background: red; border: 1px solid red">s</span></div>`;
            document.body.appendChild(root);
        });

        afterEach(() => root.remove());

        it('forces the colors of what is inside the scope', () => {
            expect(computedOn(css, at('#text'))).toMatchObject({
                color: DARK.canvastext,
                'background-color': DARK.canvas,
                'border-color': DARK.canvastext,
                'outline-color': DARK.canvastext,
                'text-decoration-color': DARK.canvastext,
                'text-emphasis-color': DARK.canvastext,
                'column-rule-color': DARK.canvastext,
                'caret-color': DARK.canvastext,
                'box-shadow': 'none',
                'text-shadow': 'none',
                'accent-color': 'auto',
                'scrollbar-color': 'auto'
            });
        });

        it('forces the text to the foreground of the context and every other foreground to the color of the element, as Chromium does', () => {
            // A border, an outline, a decoration and a caret take the element's own color, whatever it is: the text color, `LinkText` on a link.
            expect(forcedOn(css, at('#text'))).toMatchObject({
                color: 'var(--prism-sim-fg)',
                'border-color': 'currentcolor',
                'outline-color': 'var(--prism-sim-outline, currentcolor)',
                'text-decoration-color': 'currentcolor',
                'text-emphasis-color': 'currentcolor',
                'column-rule-color': 'currentcolor',
                'row-rule-color': 'currentcolor',
                'caret-color': 'currentcolor',
                'stop-color': 'currentcolor',
                'flood-color': 'currentcolor',
                'lighting-color': 'currentcolor'
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
            expect(computedOn(css, at('#pane'))).toMatchObject({ color: DARK.canvastext, 'background-color': DARK.canvas, 'box-shadow': 'none' });
            expect(computedOn(css, at('#menu-button'))).toMatchObject({ color: DARK.buttontext, 'background-color': DARK.buttonface });
        });

        it('leaves the layout elements of the CDK overlay unpainted, which are as large as the viewport and transparent on purpose', () => {
            // The popover is the host of every overlay; without a position strategy nothing else lies between it and the pane.
            for (const selector of ['#wrapper', '#bounding-box', '#backdrop', '#popover']) {
                const forced = computedOn(css, at(selector));

                expect(forced['color']).toBe(DARK.canvastext);
                for (const property of ['background-color', 'box-shadow', 'border-color', 'outline-color']) expect(forced).not.toHaveProperty(property);
                for (const pseudo of ['::before', '::after'] as const) expect(forcedOn(css, at(selector), pseudo)).not.toHaveProperty('border-color');
            }
        });

        it('paints the panel inside the wrapper and what is in it', () => {
            for (const selector of ['#dialog', '#menu-pane', '#dialog-text', '#bare-pane', '#bare-text']) {
                expect(computedOn(css, at(selector))).toMatchObject({
                    color: DARK.canvastext,
                    'background-color': DARK.canvas,
                    'box-shadow': 'none',
                    'border-color': DARK.canvastext
                });
            }
        });

        it('keeps the generated content free of a ground and a shadow, which could only hide what it overlays', () => {
            for (const pseudo of ['::before', '::after'] as const) {
                for (const selector of ['#text', '#pane', '#dialog']) {
                    const forced = forcedOn(css, at(selector), pseudo);

                    expect(forced).not.toHaveProperty('background-color');
                    expect(forced).not.toHaveProperty('box-shadow');
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

        it('drops the gradient of a pseudo-element for the rules that said so, and of no other', () => {
            expect(forcedOn(css, at('#gradient'), '::before')['background-image']).toBe('none');
            expect(forcedOn(css, at('#gradient'), '::after')).not.toHaveProperty('background-image');
            expect(forcedOn(css, at('#text'), '::before')).not.toHaveProperty('background-image');
        });

        it('lets the fill of text follow its color, so that gradient text does not vanish with its gradient', () => {
            for (const selector of ['#text', '#link', '#button', '#field', '#dialog-text']) {
                expect(forcedOn(css, at(selector))['-webkit-text-fill-color']).toBe('currentColor');
            }
            expect(computedOn(css, at('#link'))['color']).toBe(DARK.linktext);
            expect(forcedOn(css, at('#text'), '::before')['-webkit-text-fill-color']).toBe('currentColor');
            expect(forcedOn(css, at('#stage'))['-webkit-text-fill-color']).toBe('currentColor');
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

        it('takes a mark to MarkText on Mark, and gives what is inside it the text color but not the ground', () => {
            expect(computedOn(css, at('#mark'))).toMatchObject({ color: DARK.marktext, 'background-color': DARK.mark, '--prism-sim-bg-rgb': '255 255 0' });
            for (const selector of ['#in-mark', '#deep-in-mark']) {
                expect(computedOn(css, at(selector))).toMatchObject({ color: DARK.marktext, 'background-color': DARK.canvas, '--prism-sim-bg-rgb': '0 0 0' });
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
            expect(computedOn(css, at('#area'))['outline-color']).toBe(DARK.canvastext);

            (at('#focus-host') as HTMLElement).focus();
            expect(computedOn(css, at('#focus-host'))['outline-color']).toBe(DARK.highlight);
            expect(computedOn(css, at('#in-focus'))['outline-color']).toBe(DARK.canvastext);
            expect(computedOn(css, at('#field'))['outline-color']).toBe(DARK.canvastext);
            // Nor of its generated content, which inherits from it.
            for (const pseudo of ['::before', '::after'] as const)
                expect([pseudo, computedOn(css, at('#focus-host'), pseudo)['outline-color']]).toEqual([pseudo, DARK.canvastext]);
        });

        it('forces an inline color, background and border, whatever the rule weighs', () => {
            const net = parse(css).filter(({ selector }) => selector.includes('[style*='));
            const netOn = (element: Element): Record<string, string> =>
                Object.assign({}, ...net.filter(({ selector }) => element.matches(selector)).map(({ values }) => values));

            // `!important` at the weight of nothing: an inline declaration has no weight to beat it with.
            expect(netOn(at('#inline'))).toEqual({ color: 'var(--prism-sim-fg) !important', 'background-color': 'rgb(var(--prism-sim-bg-rgb)) !important' });
            expect(netOn(at('#inline-border'))).toEqual({ 'border-color': 'currentcolor !important' });
            expect(computedOn(css, at('#inline'))).toMatchObject({ color: DARK.canvastext, 'background-color': 'rgb(0 0 0)', 'border-color': DARK.canvastext });
            // The ground of the context: Mark on a mark, the page's inside it.
            expect(computedOn(css, at('#inline-mark'))['background-color']).toBe('rgb(255 255 0)');
            expect(computedOn(css, at('#inline-in-mark'))['background-color']).toBe('rgb(0 0 0)');
            // Not on a scope root, which the simulation gives an inline `color-scheme`, nor in an exempt subtree.
            at('#stage').setAttribute('style', 'color-scheme: dark; background: red; border: 0');
            for (const selector of ['#stage', '#in-dot', '#shell-inline']) expect(netOn(at(selector))).toEqual({});
        });

        it('drops the gradient of the rules it was told about, and no other image', () => {
            expect(forcedOn(css, at('#gradient'))['background-image']).toBe('none');
            expect(forcedOn(css, at('#text'))).not.toHaveProperty('background-image');
        });

        it('leaves an exempt subtree to the author, links in it included', () => {
            for (const selector of ['#dot', '#in-dot', '#dot-link']) expect(forcedOn(css, at(selector))).toEqual({});
        });

        it('leaves the fill and stroke of an SVG to the author, as Chromium does', () => {
            expect(forcedOn(css, at('#named'))).not.toHaveProperty('fill');
            expect(forcedOn(css, at('#named'))).not.toHaveProperty('stroke');
        });

        it('forces the stops and floods of an SVG', () => {
            expect(computedOn(css, at('#svg'))).toMatchObject({ 'background-color': DARK.canvas });
            expect(computedOn(css, at('#plain'))).toMatchObject({ 'stop-color': DARK.canvastext, 'flood-color': DARK.canvastext, 'lighting-color': DARK.canvastext });
        });
    });
});

describe('isForced', () => {
    it('takes a forced property, a longhand of one for a side and a shorthand that sets one', () => {
        for (const property of [
            'color',
            'background-color',
            'background',
            'background-image',
            'border-color',
            'border',
            'border-left',
            'border-block-start',
            'border-inline-end-color',
            'border-top-color',
            'outline',
            'outline-color',
            'text-decoration',
            'column-rule',
            'caret',
            'box-shadow',
            'text-shadow',
            '-webkit-text-fill-color'
        ]) {
            expect([property, isForced(property)]).toEqual([property, true]);
        }
    });

    it('leaves what the sheet does not force: layout, the rest of a family, the paint of an SVG and custom properties', () => {
        for (const property of [
            'display',
            'padding',
            'opacity',
            'border-width',
            'border-left-style',
            'border-top-left-radius',
            'border-image',
            'outline-offset',
            'background-position',
            'text-decoration-line',
            'color-scheme',
            'fill',
            'stroke',
            'stroke-width',
            'fill-opacity',
            'forced-color-adjust',
            '--focus',
            '--prism-sim-fg'
        ]) {
            expect([property, isForced(property)]).toEqual([property, false]);
        }
    });
});
