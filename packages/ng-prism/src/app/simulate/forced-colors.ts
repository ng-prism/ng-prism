import { attributeEnd, escapeEnd, stringEnd } from '../pseudo/pseudo-selector.js';
import { declarationsOf, hasStyle, isImportRule, isRuleGroup, isStyleRule, propertyOf, valueOf } from './css-rules.js';
import { FORCED_PALETTES, type ForcedPaletteName, resolveSystemColors, rgbChannels, type SystemColor } from './forced-palette.js';
import { backgroundLayers } from './forced-values.js';
import { SCOPE_IN_SUFFIX, SCOPE_OUT_SUFFIX, SIM_SCOPE, splitList, splitPseudoElement } from './scope-selector.js';

/** What the author's styles say about forced colors, to be taken into account by the approximation. */
export interface ForcedColorRules {
    /** Selectors of rules that declare `forced-color-adjust: none` or `preserve-parent-color`: they and everything below them keep the author's colors. */
    exempt: string[];
    /** Selectors of rules that declare `forced-color-adjust: auto`: an element below an exemption that matches one has its colors forced again, and so has everything below it. */
    reenabled: string[];
    /** Custom properties that some declaration gives a gradient and none a `url()`: a background image that reads one is dropped like a gradient written out. */
    gradientVars: string[];
    /** Custom properties that some declaration gives a background list, `linear-gradient(…), #8529d5` ({@link backgroundLayers}): a `background` that reads one takes the color of its last layer and drops its gradients layer by layer. */
    layerVars: string[];
}

interface Found {
    exempt: Set<string>;
    reenabled: Set<string>;
    /** The custom properties that a declaration gives a gradient. */
    gradientVars: Set<string>;
    /** The custom properties that a declaration gives a `url()`. */
    urlVars: Set<string>;
    /** The custom properties that a declaration gives a background list. */
    layerVars: Set<string>;
}

const GRADIENT = /-gradient\(/i;
const URL_IMAGE = /url\(/i;

/**
 * The exemptions and the custom properties of gradients and background lists in
 * the document's styles: its stylesheets, the adopted ones and what they import,
 * to any depth of grouping and nesting. A sheet whose rules cannot be read
 * (cross-origin) is skipped; the media engine has already said so.
 *
 * Conditions are not evaluated: an exemption inside `@media (min-width: …)` counts
 * wherever the page is, and one inside `@media (forced-colors: active)`, where
 * authors write most of them, counts although the page is not in the mode.
 *
 * The sheets in `skip` are not read. That is for the simulation's own forced
 * colors sheet: nothing in it is an author's exemption. A sheet the media engine
 * has rewritten reads as it did before, so that the exemptions stay as short as
 * the author wrote them, which every twin carries.
 */
export function collectForcedColorRules(doc: Document, skip: Iterable<CSSStyleSheet> = []): ForcedColorRules {
    return collectForcedColorRulesIn([...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])], skip);
}

/** {@link collectForcedColorRules} for `sheets` and what they import, and no other sheet: for the styles that arrive while forced colors are on. */
export function collectForcedColorRulesIn(sheets: Iterable<CSSStyleSheet>, skip: Iterable<CSSStyleSheet> = []): ForcedColorRules {
    const found: Found = { exempt: new Set(), reenabled: new Set(), gradientVars: new Set(), urlVars: new Set(), layerVars: new Set() };
    // A sheet to skip counts as read already.
    const seen = new Set<object>(skip);

    for (const sheet of sheets) collectSheet(sheet, found, seen);

    return {
        exempt: Array.from(found.exempt),
        reenabled: Array.from(found.reenabled),
        // One declaration with a `url()` is enough to keep the image, wherever the property is given a gradient.
        gradientVars: Array.from(found.gradientVars).filter((name) => !found.urlVars.has(name)),
        layerVars: Array.from(found.layerVars)
    };
}

/** Whether `a` and `b` say the same, in the same order. */
export function sameForcedColorRules(a: ForcedColorRules, b: ForcedColorRules): boolean {
    const same = (x: readonly string[], y: readonly string[]): boolean => x.length === y.length && x.every((item, i) => item === y[i]);

    return same(a.exempt, b.exempt) && same(a.reenabled, b.reenabled) && same(a.gradientVars, b.gradientVars) && same(a.layerVars, b.layerVars);
}

/** `rules` with what `more` adds, each list in the order it was found, once; `rules` itself if `more` adds nothing. */
export function mergeForcedColorRules(rules: ForcedColorRules, more: ForcedColorRules): ForcedColorRules {
    const merged: ForcedColorRules = {
        exempt: Array.from(new Set([...rules.exempt, ...more.exempt])),
        reenabled: Array.from(new Set([...rules.reenabled, ...more.reenabled])),
        gradientVars: Array.from(new Set([...rules.gradientVars, ...more.gradientVars])),
        layerVars: Array.from(new Set([...rules.layerVars, ...more.layerVars]))
    };

    return sameForcedColorRules(merged, rules) ? rules : merged;
}

function collectSheet(sheet: CSSStyleSheet, found: Found, seen: Set<object>): void {
    if (seen.has(sheet)) return;
    seen.add(sheet);

    let rules: CSSRuleList;

    try {
        rules = sheet.cssRules;
    } catch {
        return;
    }
    collectRules(rules, null, found, seen);
}

/** `parent` is the selector list of the style rule that `rules` sit in, resolved to a top-level one. */
function collectRules(rules: CSSRuleList, parent: string | null, found: Found, seen: Set<object>): void {
    for (const rule of Array.from(rules)) {
        if (isImportRule(rule)) {
            if (rule.styleSheet) collectSheet(rule.styleSheet, found, seen);
            continue;
        }

        // A rule nested in a style rule is about that rule's elements, and so are the bare declarations
        // of a `@media` nested there. Outside of one, a rule without selector (`@font-face`) is about none.
        const own = isStyleRule(rule) ? (parent === null ? rule.selectorText : nestedIn(rule.selectorText, parent)) : parent;

        if (own !== null && hasStyle(rule)) record(own, rule.style.cssText, found);
        if (isRuleGroup(rule)) collectRules(rule.cssRules, own, found, seen);
    }
}

/**
 * Notes the selectors of one block under what its declarations say; of a property set twice, the last wins.
 * A custom property is noted by name, from every block it is declared in: which declaration wins is for the cascade.
 */
function record(selectorList: string, cssText: string, found: Found): void {
    let adjust = '';

    for (const declaration of declarationsOf(cssText)) {
        const property = propertyOf(declaration);

        if (property === 'forced-color-adjust') adjust = valueOf(declaration).toLowerCase();
        else if (property.startsWith('--')) {
            const value = valueOf(declaration);

            if (GRADIENT.test(value)) found.gradientVars.add(property);
            if (URL_IMAGE.test(value)) found.urlVars.add(property);
            if (backgroundLayers(value) !== null) found.layerVars.add(property);
        }
    }

    const exempt = adjust === 'none' || adjust === 'preserve-parent-color';
    const reenabled = adjust === 'auto';

    if (!exempt && !reenabled) return;
    for (const part of splitList(selectorList)) {
        // As the author wrote it: the copy of a rule in the scope and the original out of it are one
        // rule, whether the media engine has rewritten the sheet yet or not.
        const selector = part.replaceAll(SCOPE_IN_SUFFIX, '').replaceAll(SCOPE_OUT_SUFFIX, '').trim();

        // A pseudo-element has no subtree to exempt or to take an exemption back for.
        if (selector === '' || splitPseudoElement(selector).pseudoElement !== '') continue;
        if (exempt) found.exempt.add(selector);
        if (reenabled) found.reenabled.add(selector);
    }
}

/**
 * A selector list nested in a rule, as a top-level one: `&` stands for the
 * parent, a selector without `&` for a descendant of it. The parent goes in
 * `:is()`, which keeps a list or a chain whole.
 */
function nestedIn(selectorList: string, parent: string): string {
    const outer = `:is(${parent})`;

    return splitList(selectorList)
        .map((part) => {
            const selector = part.trim();

            return replaceAmpersand(selector, outer) ?? `${outer} ${selector}`;
        })
        .join(', ');
}

/** `selector` with every `&` outside a string, an attribute and an escape replaced, or `null` without one. */
function replaceAmpersand(selector: string, replacement: string): string | null {
    let out = '';
    let replaced = false;
    let i = 0;

    while (i < selector.length) {
        const ch = selector[i];
        const end = ch === '\\' ? escapeEnd(selector, i) : ch === '"' || ch === "'" ? stringEnd(selector, i) : ch === '[' ? attributeEnd(selector, i) : i;

        if (end > i) {
            out += selector.slice(i, end);
            i = end;
        } else {
            if (ch === '&') replaced = true;
            out += ch === '&' ? replacement : ch;
            i++;
        }
    }

    return replaced ? out : null;
}

/**
 * What Chromium's own styles exempt, in front of the author's exemptions: an `<svg>` has
 * `forced-color-adjust: preserve-parent-color`, which keeps the colors the author sets on it and
 * inside it, and a `<foreignObject>` in it has `auto`, which forces what it holds again. Where an
 * element in an SVG sets no color, it inherits the forced one of its parent, which is all that
 * `preserve-parent-color` does beyond `none`.
 */
const USER_AGENT_EXEMPT: readonly string[] = ['svg'];
const USER_AGENT_REENABLED: readonly string[] = ['foreignObject'];

/** The exempt selectors, the user agent's first. */
function exemptOf(rules: ForcedColorRules): string[] {
    return [...USER_AGENT_EXEMPT, ...rules.exempt];
}

/** The elements below an exemption that an `auto` takes it back for, as `:is(<exempt>) :is(<reenabled>)`, the user agent's included. */
function reenabledSelector(rules: ForcedColorRules): string {
    return `:is(${exemptOf(rules).join(', ')}) :is(${[...USER_AGENT_REENABLED, ...rules.reenabled].join(', ')})`;
}

/**
 * What is exempt from the forced colors, as a selector that weighs nothing: an exemption and what is
 * inside it, minus what a `forced-color-adjust: auto` below it takes back, and what is inside that.
 * The user agent's are always among them: an `<svg>` and what is inside it, minus what a
 * `<foreignObject>` holds.
 *
 * One level only: an `auto` is taken back to forcing, and a `none` below that is not exempt again,
 * nor is an `<svg>` in a `<foreignObject>` in an `<svg>`.
 * An `auto` takes back an exemption only from the elements below an exempt one, never from the
 * exempt element it matches itself. Where one element matches both a `none` and an `auto`, the
 * browser lets specificity and order decide, which a selector cannot read. The approximation errs
 * both ways: an `auto` below an exemption always wins, and without an exemption above it the `none` does.
 *
 * A list in `:where()` or `:is()` ignores a selector that the browser rejects, so it does not take
 * the others with it.
 */
export function exemptionSelector(rules: ForcedColorRules): string {
    const exempt = exemptOf(rules);
    const taken = reenabledSelector(rules);

    return `:where(:where(${[...exempt, ...exempt.map((selector) => `${selector} *`)].join(', ')}):not(:where(${taken}, ${taken} *)))`;
}

/**
 * The cascade layer of the forced colors sheet. Declared first in the document
 * (`SimulationStyles`), it is the lowest of all, so that every rule of the
 * author's, in a layer or not, and every twin of one wins against it.
 */
export const FORCED_LAYER = 'prism-sim-forced';

/** The scope roots alone. */
const ROOTS = `:where(${SIM_SCOPE})`;

/** Strictly inside the scope. The roots stand in for the page and are never painted: the overlay container covers the viewport, the shell included. */
const INSIDE = `${ROOTS} *`;

/*
 * The context. Chromium does not force one value for everyone: an element is forced to the color
 * the user agent gives it in the mode, `LinkText` for a link, `GrayText` for a disabled button, and
 * what is inside inherits it. The sheet keeps that context in custom properties, which inherit as
 * well, and the forced colors read it:
 *
 * - `--prism-sim-fg`, the text color. Every other foreground color, a border, an outline or a caret,
 *   is `currentcolor`: Chromium forces it to the color of the element itself, which is the text
 *   color and no other (`Highlight` next to a text of `Highlight`),
 * - `--prism-sim-bg-rgb`, the ground as channels (`r g b`), for a background. Unlike the text
 *   color it stops at the element that sets it: what is inside a `<mark>`, and its generated
 *   content, gets `Canvas`, not `Mark`,
 * - `--prism-sim-outline`, the outline of the element with visible focus, and of no other, not
 *   even its generated content; any other outline is `currentcolor`.
 */

/**
 * What inherits, set where a context starts: on the scope roots, which would inherit it from the
 * shell, and on what an `auto` takes back from an exemption. Below them an element takes it from
 * its parent, as in the browser, where an element without a color of its own inherits the one of
 * its parent, a system color that the author keeps there included.
 *
 * `-webkit-text-fill-color` follows `color`: text that an author filled with a gradient (a transparent
 * fill over `background-clip: text`) would vanish once the gradient is gone. As `currentcolor`, which
 * inherits as the keyword, it keeps a link on `LinkText`.
 */
const INHERITED: readonly string[] = [
    'color: var(--prism-sim-fg)',
    '-webkit-text-fill-color: currentcolor',
    'caret-color: currentcolor',
    'text-shadow: none',
    'accent-color: auto',
    'scrollbar-color: auto'
];

/**
 * Colors that do not inherit, for every element and its generated content: where neither the
 * author nor a user agent sets one, the initial `currentcolor` is the color of the element, and
 * where a user agent does, a field's border for one, its color follows the element's as well.
 */
const COLORS: readonly string[] = [
    'border-color: currentcolor',
    'outline-color: var(--prism-sim-outline, currentcolor)',
    'text-decoration-color: currentcolor',
    'text-emphasis-color: currentcolor',
    'column-rule-color: currentcolor',
    'row-rule-color: currentcolor'
];

// The context of the elements a user agent colors on its own, as Chromium shows them in the mode:
// fields, buttons, links, disabled controls, marks and placeholders, rules, dialogs and popovers,
// and the outline of the element with visible focus. Each sets its color, which the user agent sets
// in the page's normal palette; their borders and outlines follow it.
const TEXT = 'color: var(--prism-sim-fg)';
const FIELD: readonly string[] = ['--prism-sim-fg: FieldText', TEXT, 'background-color: Field'];
const BUTTON: readonly string[] = ['--prism-sim-fg: ButtonText', TEXT, 'background-color: ButtonFace'];
const SURFACE: readonly string[] = [TEXT, 'background-color: Canvas'];
const LINK: readonly string[] = ['--prism-sim-fg: LinkText', TEXT];
const DISABLED: readonly string[] = ['--prism-sim-fg: GrayText', TEXT];
const MARK: readonly string[] = ['--prism-sim-fg: MarkText', TEXT, 'background-color: Mark'];
const PLACEHOLDER: readonly string[] = ['--prism-sim-fg: GrayText', TEXT];
const FOCUSED: readonly string[] = ['--prism-sim-outline: Highlight'];
const INSIDE_FOCUSED: readonly string[] = ['--prism-sim-outline: initial'];

/**
 * The elements the CDK overlay lays out around a panel: the popover that hosts every overlay in the
 * top layer, a wrapper as large as the viewport for a dialog or a toast, a box around a connected
 * panel, a backdrop. All large and positioned, so an opaque ground on one covers the page, the shell
 * included. Without a position strategy the popover is all there is around the panel. The panel
 * inside, where the content is, is painted.
 */
const OVERLAY_STRUCTURE = ':not(:where(.cdk-overlay-popover, .cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

// The tail of a selector for the elements a user agent colors on its own. Nothing but `:where()`
// weighs more than the universal selector, so each of them weighs nothing.
const LINKS = ':where(a:any-link)';
const BUTTONS = ':where(button, input[type=button i], input[type=submit i], input[type=reset i])';
const FIELDS = ':where(input, select, textarea)';
const SURFACES = ':where(dialog, [popover])';
const RULES = ':where(hr)';
const MARKS = ':where(mark)';
const INSIDE_MARKS = ':where(mark *)';
const PLACEHOLDERS = ':where(input, textarea)::placeholder';

// Chromium takes any outline of the focused element to `Highlight`, a transparent one or not, but
// only under `:focus-visible`: a button focused by a click keeps the text color.
const FOCUS = ':where(:focus-visible)';
const INSIDE_FOCUS = ':where(:focus-visible *)';

/**
 * The types of an input that Chromium grays out when it is disabled, as measured. Not among them:
 * an input without a `type` (although `type=text` is), a checkbox, a radio button, a range, a file
 * and a color input.
 */
const GRAYED_TYPES = ['text', 'search', 'tel', 'url', 'email', 'password', 'number', 'date', 'month', 'week', 'time', 'datetime-local', 'button', 'submit', 'reset'];

/** The controls Chromium grays out when they are disabled: buttons, selects, text areas, option groups (a single option stays) and the inputs of {@link GRAYED_TYPES}. */
const DISABLED_CONTROLS = `:where(button:disabled, select:disabled, textarea:disabled, optgroup:disabled, input:is(${GRAYED_TYPES.map((type) => `[type=${type} i]`).join(', ')}):disabled)`;

/**
 * The net for inline styles, which no rule of the author's styles carries and so no twin: for an
 * element whose `style` attribute names a property, the property with the value of the context. A
 * rule can only reach an inline declaration with `!important`, and the attribute is all a selector
 * can see of it, so an inline background loses its alpha and an inline system color is forced too.
 * One rule for each property: an element with an inline `color` gets no ground it does not have in
 * the browser, and a selector the browser rejects takes no other with it.
 */
const INLINE_NET: readonly (readonly [string, string])[] = [
    [':where([style*="color" i])', 'color: var(--prism-sim-fg)'],
    [':where([style*="background" i])', 'background-color: rgb(var(--prism-sim-bg-rgb))'],
    [':where([style*="border" i])', 'border-color: currentcolor'],
    [':where([style*="outline" i])', 'outline-color: var(--prism-sim-outline, currentcolor)'],
    [':where([style*="box-shadow" i])', 'box-shadow: none'],
    [':where([style*="text-shadow" i])', 'text-shadow: none'],
    // A `url()` among the images keeps the whole value, as in the browser.
    [':where([style*="gradient" i]:not([style*="url(" i]))', 'background-image: none']
];

/**
 * The stylesheet that sets the context of the forced colors in the simulation
 * scope ({@link SIM_SCOPE}) and covers what no rule of the author's sets. The
 * author's rules are forced by their twins (forced-values.ts), which the media
 * engine puts right behind them and which read the context of this sheet.
 *
 * The context comes from where it does in the browser: the scope roots set it to
 * `CanvasText` on `Canvas`, a link to `LinkText`, a disabled button to
 * `GrayText`, a `<mark>` to `MarkText` on `Mark`, and the element with visible
 * focus has a `Highlight` outline. The text color of a context is set where the
 * context starts and inherits from there, so an element without a color of its
 * own takes the one of its parent, even a system color the author keeps there.
 * Borders and every other foreground are `currentcolor`, the forced color of
 * their own element.
 *
 * Its rules sit in the cascade layer {@link FORCED_LAYER} at normal importance
 * and weigh nothing (`:where()`): every rule of the author's and every twin wins
 * against them, a transparent button of the author's stays transparent. Equal
 * weights are decided by order, which is why the more special rules for fields,
 * buttons, links, disabled controls and marks come after the general ones. Only
 * the net for inline styles ({@link INLINE_NET}) is outside the layer and
 * `!important`, and keeps off the scope roots, which the simulation gives an
 * inline `color-scheme`, and off the layout elements of the CDK overlay
 * ({@link OVERLAY_STRUCTURE}). `layered: false` writes the same rules without
 * the layer, for a document that does not take its declaration.
 *
 * What an exemption names, `forced-color-adjust: none` and `preserve-parent-color`,
 * is left out together with everything below it ({@link exemptionSelector}), except
 * for what a `forced-color-adjust: auto` takes back: that is forced again and
 * gets the context of the page, `CanvasText` on `Canvas`, and not the one the
 * exemption has inherited, a link's `LinkText` for one. An `<svg>` is exempt as
 * Chromium's own styles make it, and a `<foreignObject>` in it is taken back.
 *
 * The system colors it names are written as their values in `palette`
 * ({@link resolveSystemColors}): the keywords would resolve against the
 * browser's normal palette under the scope root's `color-scheme`, not against
 * the forced one.
 *
 * The paint of an SVG stays the author's, as in the browser, which forces none of it: `fill`,
 * `stroke`, the `stop-color` of a gradient and the `flood-color` and `lighting-color` of a filter.
 */
export function forcedColorsCss(rules: ForcedColorRules, palette: ForcedPaletteName, layered = true): string {
    const exempt = `:not(${exemptionSelector(rules)})`;
    const reenabled = reenabledSelector(rules);
    const inside = `${INSIDE}${exempt}`;
    const block = (selectors: readonly string[], declarations: readonly string[], important = false): string => forcedRule(selectors, declarations, palette, important);
    // The channels of a system color, which `rgb()` and the relative color syntax take as they are.
    const ground = (color: SystemColor): string => `--prism-sim-bg-rgb: ${rgbChannels(FORCED_PALETTES[palette][color])}`;

    const context = [
        block([`${ROOTS}${exempt}`], ['--prism-sim-fg: CanvasText', ground('canvas'), ...INHERITED]),
        // Before the elements a user agent colors, which a link or a mark below sets again.
        block([`${INSIDE}:where(${reenabled})`], ['--prism-sim-fg: CanvasText', ground('canvas'), ...INHERITED]),
        block(withPseudoElements(inside), COLORS),
        block([`${inside}${FIELDS}`], FIELD),
        block([`${inside}${BUTTONS}`], BUTTON),
        block([`${inside}${SURFACES}`], SURFACE),
        block([`${inside}${RULES}`], [TEXT]),
        block([`${inside}${LINKS}`], LINK),
        block([`${inside}${DISABLED_CONTROLS}`], DISABLED),
        // Before the marks, so that a mark inside a mark is one again.
        block([`${inside}${INSIDE_MARKS}`, ...generatedContent(`${inside}${MARKS}`)], [ground('canvas')]),
        block([`${inside}${MARKS}`], [...MARK, ground('mark')]),
        block([`${inside}${PLACEHOLDERS}`], PLACEHOLDER),
        block([`${inside}${FOCUS}`], FOCUSED),
        block([`${inside}${INSIDE_FOCUS}`, ...generatedContent(`${inside}${FOCUS}`)], INSIDE_FOCUSED)
    ].join('\n\n');
    // Not on the roots, which the simulation gives an inline `color-scheme`.
    const net = INLINE_NET.map(([attribute, declaration]) => block([`${inside}${OVERLAY_STRUCTURE}${attribute}`], [declaration], true)).join('\n\n');

    return layered ? `@layer ${FORCED_LAYER} {\n${context}\n}\n\n${net}` : `${context}\n\n${net}`;
}

/** A selector and the generated content in front of and behind it, which `*` does not match. */
function withPseudoElements(selector: string): string[] {
    return [selector, ...generatedContent(selector)];
}

/** The generated content in front of and behind what `selector` matches, which inherits from it. */
function generatedContent(selector: string): string[] {
    return [`${selector}::before`, `${selector}::after`];
}

/** A rule of the sheet, its system colors in `palette`. */
function forcedRule(selectors: readonly string[], declarations: readonly string[], palette: ForcedPaletteName, important: boolean): string {
    const lines = declarations.map((declaration) => {
        const property = propertyOf(declaration);

        return `    ${property}: ${resolveSystemColors(property, valueOf(declaration), palette)}${important ? ' !important' : ''};`;
    });

    return `${selectors.join(',\n')} {\n${lines.join('\n')}\n}`;
}
