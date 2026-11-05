import { attributeEnd, escapeEnd, stringEnd } from '../pseudo/pseudo-selector.js';
import { declarationsOf, hasStyle, isImportRule, isRuleGroup, isStyleRule, propertyOf, valueOf } from './css-rules.js';
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

/** Strictly inside the scope. The roots stand in for the page and are never painted: the overlay container covers the viewport, the shell included. */
const INSIDE = `:where(${SIM_SCOPE}) *`;

/** The roots and everything inside, for what inherits. */
const ROOTS_AND_INSIDE = `*${SCOPE_IN_SUFFIX}`;

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
    'color: CanvasText',
    '-webkit-text-fill-color: currentColor',
    'caret-color: CanvasText',
    'text-shadow: none',
    'accent-color: auto',
    'scrollbar-color: auto'
];

/** Colors that nothing can hide behind: they are set on the generated content too. */
const COLORS: readonly string[] = [
    'border-color: CanvasText',
    'outline-color: CanvasText',
    'text-decoration-color: CanvasText',
    'text-emphasis-color: CanvasText',
    'column-rule-color: CanvasText',
    'row-rule-color: CanvasText',
    'stop-color: CanvasText',
    'flood-color: CanvasText',
    'lighting-color: CanvasText'
];

/**
 * What covers an element: a ground and a shadow. `background-color` loses its alpha, since the CSS cannot
 * read what the author set, so a transparent element is `Canvas` here and in the browser it stays
 * transparent. Where that matters is an element that lies over another, which it hides: it is
 * kept off the generated content, where scrims, ripples and focus layers are made, and off the
 * structure of the CDK overlay ({@link OVERLAY_STRUCTURE}).
 */
const GROUND: readonly string[] = ['background-color: Canvas', 'box-shadow: none'];

/**
 * The elements the CDK overlay lays out around a panel: a wrapper as large as the viewport for a
 * dialog or a toast, a box around a connected panel, a backdrop. All transparent on purpose, and all
 * large and positioned, so a ground on one covers the page, the shell included. The panel inside,
 * where the content is, is painted.
 */
const OVERLAY_STRUCTURE = ':not(:where(.cdk-global-overlay-wrapper, .cdk-overlay-connected-position-bounding-box, .cdk-overlay-backdrop))';

// The tail of a selector for the elements a user agent colors on its own. Nothing but `:where()`
// weighs more than the universal selector, so each of them weighs nothing.
const LINKS = ':where(a:any-link)';
const BUTTONS = ':where(button, input[type=button i], input[type=submit i], input[type=reset i])';
const FIELDS = ':where(input, select, textarea)';

/** An attribute of an SVG element that names a color. `none`, `currentColor` and a paint server are not colors, and stay as they are. */
const colored = (attribute: string): string =>
    `:where(svg, svg *):where([${attribute}]:not([${attribute}=none i], [${attribute}=currentColor i], [${attribute}^=url i], [${attribute}=""]))`;

/**
 * The stylesheet that approximates forced colors mode in the simulation scope
 * ({@link SIM_SCOPE}): system colors for what the author painted, no shadows,
 * no gradients.
 *
 * Every rule weighs nothing (`:where()`) and every declaration is `!important`.
 * So the author's normal declarations lose, as the browser overrides them, and
 * the copies of the author's own `@media (forced-colors: active)` rules (made
 * `!important` by the media engine, and with the weight of the original) win,
 * as in the mode. Equal weights are decided by order, which is why the more
 * special rules for links, buttons and fields come after the general ones.
 *
 * What an exemption names, `forced-color-adjust: none` and `preserve-parent-color`,
 * is left out together with everything below it.
 *
 * Grounds are `Canvas` only where nothing can be hidden behind them by mistake: not on
 * `::before` and `::after`, not on the layout elements of the CDK overlay.
 *
 * What it cannot do: an author's `!important` outside `@media (forced-colors)`
 * weighs more and wins, where the browser forces the color anyway. Colors an SVG
 * takes from a stylesheet rather than from an attribute stay, because `fill: none`
 * must not become a fill. Neither is `color-scheme` set, the palette is the
 * caller's to choose.
 */
export function forcedColorsCss(rules: ForcedColorRules): string {
    const exempt = rules.exempt.length === 0 ? '' : `:not(:where(${[...rules.exempt, ...rules.exempt.map((selector) => `${selector} *`)].join(', ')}))`;
    const inside = `${INSIDE}${exempt}`;
    const roots = `${ROOTS_AND_INSIDE}${exempt}`;

    const painted = `${inside}${OVERLAY_STRUCTURE}`;

    const css = [
        block(withPseudoElements(roots), INHERITED),
        block(withPseudoElements(painted), COLORS),
        block([painted], GROUND),
        block([`${inside}${colored('fill')}`], ['fill: CanvasText']),
        block([`${inside}${colored('stroke')}`], ['stroke: CanvasText']),
        block([`${inside}${FIELDS}`], ['color: FieldText', 'background-color: Field', 'border-color: ButtonBorder']),
        block([`${inside}${BUTTONS}`], ['color: ButtonText', 'background-color: ButtonFace', 'border-color: ButtonBorder']),
        block([`${inside}${LINKS}`], ['color: LinkText', 'text-decoration-color: LinkText'])
    ];

    // One rule each: a selector that the browser rejects takes the whole list of a rule with it.
    for (const gradient of rules.gradients) {
        const { element, pseudoElement } = splitPseudoElement(gradient);

        css.push(block([`${roots}:where(${element === '' ? '*' : element})${pseudoElement}`], ['background-image: none']));
    }

    return css.join('\n\n');
}

/** A selector and the generated content in front of and behind it, which `*` does not match. */
function withPseudoElements(selector: string): string[] {
    return [selector, `${selector}::before`, `${selector}::after`];
}

function block(selectors: readonly string[], declarations: readonly string[]): string {
    return `${selectors.join(',\n')} {\n${declarations.map((declaration) => `    ${declaration} !important;`).join('\n')}\n}`;
}
