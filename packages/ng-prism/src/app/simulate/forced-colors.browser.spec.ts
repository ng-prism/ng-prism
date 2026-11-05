import { collectForcedColorRules, type ForcedColorRules, forcedColorsCss } from './forced-colors.js';

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

const OVERLAY_STRUCTURE = ':not(:where(.cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

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

/**
 * What the sheet forces on `element`, or on its `::before` or `::after` for `pseudo`: the
 * declarations of every rule that matches it, a later rule over an earlier one. All of them are
 * `!important` at the same weight, which is how the sheet is written, so the order is all there
 * is to the cascade among them.
 */
function forcedOn(css: string, element: Element, pseudo: '' | '::before' | '::after' = ''): Record<string, string> {
    const forced: Record<string, string> = {};

    for (const { selector, values } of parse(css)) {
        // One selector per line, as the sheet writes a list.
        const matches = selector.split(',\n').some((part) => {
            const own = /::(?:before|after)$/.exec(part)?.[0] ?? '';

            return own === pseudo && element.matches(own === '' ? part : part.slice(0, -own.length));
        });

        if (!matches) continue;
        for (const [property, value] of Object.entries(values)) forced[property] = value.replace(/\s*!important$/, '');
    }
    return forced;
}

describe('forcedColorsCss', () => {
    it('forces system colors inside the scope only, minus exempt subtrees', () => {
        const css = forcedColorsCss({ exempt: ['.dot'], gradients: ['.g'] });

        expect(css).toContain('color: CanvasText !important');
        expect(css).toContain('background-color: Canvas !important');
        expect(css).toContain('box-shadow: none !important');
        expect(css).toContain('LinkText');
        expect(css).toContain('ButtonText');
        expect(css).toContain(':not(:where(.dot, .dot *))');
        expect(css).toMatch(/:where\(\.g\)[^{]*\{[^}]*background-image: none !important/);
    });

    it('keeps the layout elements of the CDK overlay out of its grounds, with a selector that weighs nothing', () => {
        const css = forcedColorsCss(NONE);

        expect(css).toContain(OVERLAY_STRUCTURE);
        expect(css).toContain('-webkit-text-fill-color: currentColor !important');
    });

    it('has no exemption in its selectors when none was found', () => {
        expect(forcedColorsCss(NONE).replaceAll(OVERLAY_STRUCTURE, '')).not.toContain(':not(:where(');
        expect(forcedColorsCss(NONE)).not.toContain('background-image');
    });

    it('exempts every selector together with what is inside it', () => {
        expect(forcedColorsCss({ exempt: ['.a', '.b > .c'], gradients: [] })).toContain(':not(:where(.a, .b > .c, .a *, .b > .c *))');
    });

    it('weighs nothing and wins over the author, which is as important', () => {
        for (const { selector, values } of parse(forcedColorsCss({ exempt: ['.dot'], gradients: ['.g', '.b::before'] }))) {
            // Every class, attribute and type name in a selector sits in a `:where()`.
            expect(selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/\*/g, '')).toMatch(/^(?:(?::not\(\)|:before|:after|::before|::after|,|\s)*)$/);
            for (const value of Object.values(values)) expect(value).toMatch(/ !important$/);
        }
    });

    describe('applied to a document', () => {
        let root: HTMLElement;
        const css = forcedColorsCss({ exempt: ['.dot'], gradients: ['.g', '.g::before'] });
        const at = (selector: string): Element => {
            const element = root.querySelector(selector);

            if (!element) throw new Error(`no ${selector}`);
            return element;
        };

        beforeEach(() => {
            root = document.createElement('div');
            root.innerHTML = `
                <div data-prism-sim id="stage">
                    <p id="text">text <a href="#x" id="link">link</a> <a id="anchor">no link</a></p>
                    <input id="field" /> <textarea id="area"></textarea> <select id="select"></select>
                    <button id="button">b</button> <input type="submit" id="submit" />
                    <div class="g" id="gradient"></div>
                    <div class="dot" id="dot"><span id="in-dot"></span><a href="#x" id="dot-link"></a></div>
                    <svg id="svg"><path id="plain"></path><path id="named" fill="#f00" stroke="blue"></path><path id="open" fill="none" stroke="currentColor"></path><path id="served" fill="url(#g)"></path></svg>
                </div>
                <div class="cdk-overlay-container" id="overlay">
                    <div id="pane"><button id="menu-button">m</button></div>
                    <div class="cdk-overlay-backdrop" id="backdrop"></div>
                    <div class="cdk-global-overlay-wrapper" id="wrapper"><div class="cdk-overlay-pane" id="dialog"><p id="dialog-text">t</p></div></div>
                    <div class="cdk-overlay-connected-position-bounding-box" id="bounding-box"><div class="cdk-overlay-pane" id="menu-pane"></div></div>
                </div>
                <div id="shell"><button id="shell-button">s</button></div>`;
            document.body.appendChild(root);
        });

        afterEach(() => root.remove());

        it('forces the colors of what is inside the scope', () => {
            expect(forcedOn(css, at('#text'))).toMatchObject({
                color: 'CanvasText',
                'background-color': 'Canvas',
                'border-color': 'CanvasText',
                'outline-color': 'CanvasText',
                'text-decoration-color': 'CanvasText',
                'text-emphasis-color': 'CanvasText',
                'column-rule-color': 'CanvasText',
                'caret-color': 'CanvasText',
                'box-shadow': 'none',
                'text-shadow': 'none',
                'accent-color': 'auto',
                'scrollbar-color': 'auto'
            });
        });

        it('forces the overlay container and what it holds in the same way', () => {
            expect(forcedOn(css, at('#pane'))).toMatchObject({ color: 'CanvasText', 'background-color': 'Canvas', 'box-shadow': 'none' });
            expect(forcedOn(css, at('#menu-button'))).toMatchObject({ color: 'ButtonText', 'background-color': 'ButtonFace' });
        });

        it('leaves the layout elements of the CDK overlay unpainted, which are as large as the viewport and transparent on purpose', () => {
            for (const selector of ['#wrapper', '#bounding-box', '#backdrop']) {
                const forced = forcedOn(css, at(selector));

                expect(forced['color']).toBe('CanvasText');
                for (const property of ['background-color', 'box-shadow', 'border-color', 'outline-color']) expect(forced).not.toHaveProperty(property);
                for (const pseudo of ['::before', '::after'] as const) expect(forcedOn(css, at(selector), pseudo)).not.toHaveProperty('border-color');
            }
        });

        it('paints the panel inside the wrapper and what is in it', () => {
            for (const selector of ['#dialog', '#menu-pane', '#dialog-text']) {
                expect(forcedOn(css, at(selector))).toMatchObject({
                    color: 'CanvasText',
                    'background-color': 'Canvas',
                    'box-shadow': 'none',
                    'border-color': 'CanvasText'
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
                expect(forcedOn(css, at('#text'), pseudo)).toMatchObject({
                    color: 'CanvasText',
                    'border-color': 'CanvasText',
                    'outline-color': 'CanvasText',
                    'text-decoration-color': 'CanvasText',
                    'text-shadow': 'none'
                });
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
            expect(forcedOn(css, at('#link'))['color']).toBe('LinkText');
            expect(forcedOn(css, at('#text'), '::before')['-webkit-text-fill-color']).toBe('currentColor');
            expect(forcedOn(css, at('#stage'))['-webkit-text-fill-color']).toBe('currentColor');
            expect(forcedOn(css, at('#dot'))).not.toHaveProperty('-webkit-text-fill-color');
            expect(forcedOn(css, at('#shell'))).not.toHaveProperty('-webkit-text-fill-color');
        });

        it('leaves the page outside the scope alone', () => {
            expect(forcedOn(css, at('#shell'))).toEqual({});
            expect(forcedOn(css, at('#shell-button'))).toEqual({});
        });

        it('does not paint the scope roots, which stand in for the page behind them: only what inherits', () => {
            for (const selector of ['#stage', '#overlay']) {
                const forced = forcedOn(css, at(selector));

                expect(forced['color']).toBe('CanvasText');
                for (const property of ['background-color', 'border-color', 'outline-color', 'box-shadow', 'background-image']) {
                    expect(forced).not.toHaveProperty(property);
                }
            }
        });

        it('takes a link to LinkText, but an anchor without href stays text', () => {
            expect(forcedOn(css, at('#link'))['color']).toBe('LinkText');
            expect(forcedOn(css, at('#anchor'))['color']).toBe('CanvasText');
        });

        it('takes buttons to ButtonText on ButtonFace and fields to FieldText on Field', () => {
            for (const selector of ['#button', '#submit']) {
                expect(forcedOn(css, at(selector))).toMatchObject({ color: 'ButtonText', 'background-color': 'ButtonFace' });
            }
            for (const selector of ['#field', '#area', '#select']) {
                expect(forcedOn(css, at(selector))).toMatchObject({ color: 'FieldText', 'background-color': 'Field' });
            }
        });

        it('drops the gradient of the rules it was told about, and no other image', () => {
            expect(forcedOn(css, at('#gradient'))['background-image']).toBe('none');
            expect(forcedOn(css, at('#text'))).not.toHaveProperty('background-image');
        });

        it('leaves an exempt subtree to the author, links in it included', () => {
            for (const selector of ['#dot', '#in-dot', '#dot-link']) expect(forcedOn(css, at(selector))).toEqual({});
        });

        it('forces a color that the markup of an SVG names, and leaves none, currentColor and a paint server', () => {
            expect(forcedOn(css, at('#named'))).toMatchObject({ fill: 'CanvasText', stroke: 'CanvasText' });
            for (const selector of ['#plain', '#open', '#served']) {
                expect(forcedOn(css, at(selector))['fill']).toBeUndefined();
                expect(forcedOn(css, at(selector))['stroke']).toBeUndefined();
            }
        });

        it('forces the stops and floods of an SVG, which have no none to lose', () => {
            const svg = at('#svg');

            expect(forcedOn(css, svg)).toMatchObject({ 'background-color': 'Canvas' });
            expect(forcedOn(css, at('#plain'))).toMatchObject({ 'stop-color': 'CanvasText', 'flood-color': 'CanvasText', 'lighting-color': 'CanvasText' });
        });
    });
});
