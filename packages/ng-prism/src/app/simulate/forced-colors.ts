import { attributeEnd, escapeEnd, stringEnd } from '../pseudo/pseudo-selector.js';
import { declarationsOf, hasStyle, isImportRule, isRuleGroup, isStyleRule, propertyOf, valueOf } from './css-rules.js';
import { FORCED_PALETTES, type ForcedPaletteName, resolveSystemColors, rgbChannels, type SystemColor } from './forced-palette.js';
import { SCOPE_IN_SUFFIX, SIM_SCOPE, splitList, splitPseudoElement } from './scope-selector.js';

/** What the author's styles say about forced colors, to be taken into account by the approximation. */
export interface ForcedColorRules {
    /** Selectors of rules that declare `forced-color-adjust: none` or `preserve-parent-color`: they and everything below them keep the author's colors. */
    exempt: string[];
    /** Selectors of rules that paint a gradient and no URL image: the browser drops such a background image in forced colors mode. */
    gradients: string[];
}

interface Found {
    exempt: Set<string>;
    gradients: Set<string>;
}

/**
 * The exemptions and gradients in the document's styles: its stylesheets, the
 * adopted ones and what they import, to any depth of grouping and nesting. A
 * sheet whose rules cannot be read (cross-origin) is skipped; the media engine
 * has already said so.
 *
 * Conditions are not evaluated: an exemption inside `@media (min-width: …)` counts
 * wherever the page is, and one inside `@media (forced-colors: active)`, where
 * authors write most of them, counts although the page is not in the mode.
 *
 * The sheets in `skip` are not read. That is for the simulation's own forced
 * colors sheet: nothing in it is an author's exemption or gradient.
 */
export function collectForcedColorRules(doc: Document, skip: Iterable<CSSStyleSheet> = []): ForcedColorRules {
    const found: Found = { exempt: new Set(), gradients: new Set() };
    // A sheet to skip counts as read already.
    const seen = new Set<object>(skip);

    for (const sheet of [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])]) collectSheet(sheet, found, seen);

    return { exempt: Array.from(found.exempt), gradients: Array.from(found.gradients) };
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

/** Notes the selectors of one block under what its declarations say; of a property set twice, the last wins. */
function record(selectorList: string, cssText: string, found: Found): void {
    let adjust = '';
    let background = '';

    for (const declaration of declarationsOf(cssText)) {
        const property = propertyOf(declaration);

        if (property === 'forced-color-adjust') adjust = valueOf(declaration).toLowerCase();
        else if (property === 'background' || property === 'background-image') background = valueOf(declaration);
    }

    const exempt = adjust === 'none' || adjust === 'preserve-parent-color';
    // A `url()` among the images keeps the whole value, as in the browser.
    const gradient = /-gradient\(/i.test(background) && !/url\(/i.test(background);

    if (!exempt && !gradient) return;
    for (const part of splitList(selectorList)) {
        const selector = part.trim();

        if (selector === '') continue;
        // A pseudo-element has no subtree to exempt.
        if (exempt && splitPseudoElement(selector).pseudoElement === '') found.exempt.add(selector);
        if (gradient) found.gradients.add(selector);
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

/** The scope roots alone. */
const ROOTS = `:where(${SIM_SCOPE})`;

/** Strictly inside the scope. The roots stand in for the page and are never painted: the overlay container covers the viewport, the shell included. */
const INSIDE = `${ROOTS} *`;

/** The roots and everything inside, for what inherits. */
const ROOTS_AND_INSIDE = `*${SCOPE_IN_SUFFIX}`;

/*
 * The context. Chromium does not force one value for everyone: an element is forced to the color
 * the user agent gives it in the mode, `LinkText` for a link, `GrayText` for a disabled button, and
 * what is inside inherits it. The sheet keeps that context in custom properties, which inherit as
 * well, and the forced colors read it:
 *
 * - `--prism-sim-fg`, the text color, for the text and every foreground color,
 * - `--prism-sim-bg-rgb`, the ground as channels (`r g b`), for a background. Unlike the text
 *   color it stops at the element that sets it: what is inside a `<mark>`, and its generated
 *   content, gets `Canvas`, not `Mark`,
 * - `--prism-sim-outline`, the outline of the element with visible focus, and of no other, not
 *   even its generated content.
 */

// The properties of CSS Color Adjust 1, "Properties Affected by Forced Colors Mode", and the
// ones it lists beside them: what the browser forces for a page in the mode.

/**
 * Inherited, so the roots take them too and the ground of a text without element of its own is right.
 *
 * `-webkit-text-fill-color` follows `color`: text that an author filled with a gradient (a transparent
 * fill over `background-clip: text`) would vanish once the gradient is gone. As `currentColor` it
 * keeps a link on `LinkText`.
 */
const INHERITED: readonly string[] = [
    'color: var(--prism-sim-fg)',
    '-webkit-text-fill-color: currentColor',
    'caret-color: var(--prism-sim-fg)',
    'text-shadow: none',
    'accent-color: auto',
    'scrollbar-color: auto'
];

/** Colors that nothing can hide behind: they are set on the generated content too. */
const COLORS: readonly string[] = [
    'border-color: var(--prism-sim-fg)',
    'outline-color: var(--prism-sim-outline, var(--prism-sim-fg))',
    'text-decoration-color: var(--prism-sim-fg)',
    'text-emphasis-color: var(--prism-sim-fg)',
    'column-rule-color: var(--prism-sim-fg)',
    'row-rule-color: var(--prism-sim-fg)',
    'stop-color: var(--prism-sim-fg)',
    'flood-color: var(--prism-sim-fg)',
    'lighting-color: var(--prism-sim-fg)'
];

/**
 * What covers an element: a ground and a shadow. `background-color` loses its alpha, since the CSS cannot
 * read what the author set, so a transparent element is `Canvas` here and in the browser it stays
 * transparent. Where that matters is an element that lies over another, which it hides: it is
 * kept off the generated content, where scrims, ripples and focus layers are made, and off the
 * structure of the CDK overlay ({@link OVERLAY_STRUCTURE}).
 */
const GROUND: readonly string[] = ['background-color: Canvas', 'box-shadow: none'];

// The context of the elements a user agent colors on its own, as Chromium shows them in the mode:
// fields, buttons, links, disabled controls, marks and placeholders, and the outline of the
// element with visible focus. Their borders and outlines follow the text color.
const FIELD: readonly string[] = ['--prism-sim-fg: FieldText', 'background-color: Field'];
const BUTTON: readonly string[] = ['--prism-sim-fg: ButtonText', 'background-color: ButtonFace'];
const LINK: readonly string[] = ['--prism-sim-fg: LinkText'];
const DISABLED: readonly string[] = ['--prism-sim-fg: GrayText'];
const MARK: readonly string[] = ['--prism-sim-fg: MarkText', 'background-color: Mark'];
const PLACEHOLDER: readonly string[] = ['--prism-sim-fg: GrayText', 'color: var(--prism-sim-fg)'];
const FOCUSED: readonly string[] = ['--prism-sim-outline: Highlight'];
const INSIDE_FOCUSED: readonly string[] = ['--prism-sim-outline: initial'];

const NO_GRADIENT: readonly string[] = ['background-image: none'];

// The net for inline styles, which no rule of the author's styles carries: one property each, so
// that an element with an inline `color` does not get a ground it does not have in the browser.
// An inline background loses its alpha, which a selector cannot read.
const INLINE_COLOR: readonly string[] = ['color: var(--prism-sim-fg)'];
const INLINE_BACKGROUND: readonly string[] = ['background-color: rgb(var(--prism-sim-bg-rgb))'];
const INLINE_BORDER: readonly string[] = ['border-color: var(--prism-sim-fg)'];

/**
 * Every property the sheet forces. A copy of the author's own `@media (forced-colors: active)`
 * rules has to win on these, and only on these: the media engine makes them `!important` there
 * ({@link isForced}), and everything else keeps the cascade it has in the real mode. The custom
 * properties of the context are none of them: no author sets them.
 */
export const FORCED_PROPERTIES: ReadonlySet<string> = new Set(
    [INHERITED, COLORS, GROUND, FIELD, BUTTON, MARK, PLACEHOLDER, NO_GRADIENT, INLINE_COLOR, INLINE_BACKGROUND, INLINE_BORDER]
        .flat()
        .map(propertyOf)
        .filter((property) => !property.startsWith('--'))
);

// The side or the axis in the name of a longhand: `border-left-color` is a `border-color`, `border-block-start` a `border`.
const SIDE = /-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?(?=-|$)/g;

/**
 * Whether a declaration of `property` sets something the sheet forces: one of
 * {@link FORCED_PROPERTIES}, the longhand of one for a side (`border-left-color`),
 * or a shorthand that sets one (`border`, `background`, `outline`), whose other
 * parts go with it.
 */
export function isForced(property: string): boolean {
    const base = property.replace(SIDE, '');

    return FORCED_PROPERTIES.has(base) || Array.from(FORCED_PROPERTIES).some((forced) => forced.startsWith(`${base}-`));
}

/**
 * The elements the CDK overlay lays out around a panel: the popover that hosts every overlay in the
 * top layer, a wrapper as large as the viewport for a dialog or a toast, a box around a connected
 * panel, a backdrop. All transparent on purpose, and all large and positioned, so a ground on one
 * covers the page, the shell included. Without a position strategy the popover is all there is
 * around the panel. The panel inside, where the content is, is painted.
 */
const OVERLAY_STRUCTURE = ':not(:where(.cdk-overlay-popover, .cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

// The tail of a selector for the elements a user agent colors on its own. Nothing but `:where()`
// weighs more than the universal selector, so each of them weighs nothing.
const LINKS = ':where(a:any-link)';
const BUTTONS = ':where(button, input[type=button i], input[type=submit i], input[type=reset i])';
const FIELDS = ':where(input, select, textarea)';
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

// An element whose `style` attribute names one of the properties. A rule can only reach an inline
// declaration with `!important`, and the attribute is all a selector can see of it.
const INLINE_COLORS = ':where([style*="color" i])';
const INLINE_BACKGROUNDS = ':where([style*="background" i])';
const INLINE_BORDERS = ':where([style*="border" i])';

/**
 * The stylesheet that approximates forced colors mode in the simulation scope
 * ({@link SIM_SCOPE}): system colors for what the author painted, no shadows,
 * no gradients.
 *
 * The colors come from a context, as in the browser: the scope roots set it to
 * `CanvasText` on `Canvas`, a link to `LinkText`, a disabled button to
 * `GrayText`, a `<mark>` to `MarkText` on `Mark`, and the element with visible
 * focus has a `Highlight` outline. The text color of a context reaches what is
 * inside; text, borders and every other foreground read it.
 *
 * Every rule weighs nothing (`:where()`) and every declaration is `!important`.
 * So the author's normal declarations lose, as the browser overrides them, and
 * the copies of the author's own `@media (forced-colors: active)` rules (their
 * {@link FORCED_PROPERTIES} made `!important` by the media engine, and with the
 * weight of the original) win, as in the mode. Equal weights are decided by
 * order, which is why the more special rules for fields, buttons, links,
 * disabled controls and marks come after the general ones. Inline styles get a
 * net of their own: the colors of the context for an element whose `style`
 * names a color, a background or a border.
 *
 * What an exemption names, `forced-color-adjust: none` and `preserve-parent-color`,
 * is left out together with everything below it.
 *
 * Grounds are `Canvas` only where nothing can be hidden behind them by mistake: not on
 * `::before` and `::after`, not on the layout elements of the CDK overlay.
 *
 * The system colors it names are written as their values in `palette`
 * ({@link resolveSystemColors}): the keywords would resolve against the
 * browser's normal palette under the scope root's `color-scheme`, not against
 * the forced one.
 *
 * `fill` and `stroke` stay the author's, as in the browser, which forces neither.
 *
 * What it cannot do: an author's `!important` outside `@media (forced-colors)`
 * weighs more and wins, where the browser forces the color anyway. So does a
 * color in the author's own forced-colors rules that is not a system color,
 * which the browser forces as well.
 */
export function forcedColorsCss(rules: ForcedColorRules, palette: ForcedPaletteName): string {
    const exempt = rules.exempt.length === 0 ? '' : `:not(:where(${[...rules.exempt, ...rules.exempt.map((selector) => `${selector} *`)].join(', ')}))`;
    const inside = `${INSIDE}${exempt}`;
    const roots = `${ROOTS_AND_INSIDE}${exempt}`;

    const painted = `${inside}${OVERLAY_STRUCTURE}`;
    const block = (selectors: readonly string[], declarations: readonly string[]): string => forcedRule(selectors, declarations, palette);
    // The channels of a system color, which `rgb()` and the relative color syntax take as they are.
    const ground = (color: SystemColor): string => `--prism-sim-bg-rgb: ${rgbChannels(FORCED_PALETTES[palette][color])}`;

    const css = [
        block([`${ROOTS}${exempt}`], ['--prism-sim-fg: CanvasText', ground('canvas')]),
        block(withPseudoElements(roots), INHERITED),
        block(withPseudoElements(painted), COLORS),
        block([painted], GROUND),
        block([`${inside}${FIELDS}`], FIELD),
        block([`${inside}${BUTTONS}`], BUTTON),
        block([`${inside}${LINKS}`], LINK),
        block([`${inside}${DISABLED_CONTROLS}`], DISABLED),
        // Before the marks, so that a mark inside a mark is one again.
        block([`${inside}${INSIDE_MARKS}`, ...generatedContent(`${inside}${MARKS}`)], [ground('canvas')]),
        block([`${inside}${MARKS}`], [...MARK, ground('mark')]),
        block([`${inside}${PLACEHOLDERS}`], PLACEHOLDER),
        block([`${inside}${FOCUS}`], FOCUSED),
        block([`${inside}${INSIDE_FOCUS}`, ...generatedContent(`${inside}${FOCUS}`)], INSIDE_FOCUSED)
    ];

    // One rule each: a selector that the browser rejects takes the whole list of a rule with it.
    for (const gradient of rules.gradients) {
        const { element, pseudoElement } = splitPseudoElement(gradient);

        css.push(block([`${roots}:where(${element === '' ? '*' : element})${pseudoElement}`], NO_GRADIENT));
    }

    // Not on the roots, which the simulation gives an inline `color-scheme`.
    css.push(
        block([`${inside}${INLINE_COLORS}`], INLINE_COLOR),
        block([`${inside}${INLINE_BACKGROUNDS}`], INLINE_BACKGROUND),
        block([`${inside}${INLINE_BORDERS}`], INLINE_BORDER)
    );

    return css.join('\n\n');
}

/** A selector and the generated content in front of and behind it, which `*` does not match. */
function withPseudoElements(selector: string): string[] {
    return [selector, ...generatedContent(selector)];
}

/** The generated content in front of and behind what `selector` matches, which inherits from it. */
function generatedContent(selector: string): string[] {
    return [`${selector}::before`, `${selector}::after`];
}

/** A rule of the sheet: every declaration `!important`, its system colors in `palette`. */
function forcedRule(selectors: readonly string[], declarations: readonly string[], palette: ForcedPaletteName): string {
    const lines = declarations.map((declaration) => {
        const property = propertyOf(declaration);

        return `    ${property}: ${resolveSystemColors(property, valueOf(declaration), palette)} !important;`;
    });

    return `${selectors.join(',\n')} {\n${lines.join('\n')}\n}`;
}
