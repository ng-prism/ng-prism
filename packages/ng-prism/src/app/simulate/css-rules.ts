import { stringEnd } from '../pseudo/pseudo-selector.js';

/** A stylesheet or a grouping rule: anything rules can be inserted into. */
export interface RuleGroup {
    readonly cssRules: CSSRuleList;
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
}

// Duck-typed rather than `instanceof`, as in pseudo-stylesheets.ts: the
// constructors belong to the window that owns the sheet, and not every engine
// has all of them.
export function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
    return typeof (rule as Partial<CSSStyleRule>).selectorText === 'string' && 'style' in rule;
}

// `@media`, `@supports`, `@layer`, `@container`, and a style rule with nested
// rules. `@keyframes` takes new rules through `appendRule` and holds no selectors.
export function isRuleGroup(rule: CSSRule): rule is CSSRule & RuleGroup {
    return 'cssRules' in rule && typeof (rule as Partial<CSSGroupingRule>).insertRule === 'function';
}

export function isMediaRule(rule: CSSRule): rule is CSSMediaRule {
    return isRuleGroup(rule) && 'media' in rule;
}

export function isImportRule(rule: CSSRule): rule is CSSImportRule {
    return 'styleSheet' in rule && 'href' in rule;
}

/** A rule with declarations: a style rule, `@font-face`, or the bare declarations nested in a style rule (`CSSNestedDeclarations`). */
export function hasStyle(rule: CSSRule): rule is CSSRule & { readonly style: CSSStyleDeclaration } {
    return 'style' in rule;
}

/** What a rule's text says before its block: `@media (…)`, `@keyframes spin`, a selector. */
export function prelude(cssText: string): string {
    const end = cssText.search(/[{;]/);

    return (end < 0 ? cssText : cssText.slice(0, end)).trim();
}

/**
 * The declarations in a block's text, split at the semicolons outside strings
 * and brackets (`url(a;b)`, a custom property's `{…}`), trimmed. Working on the
 * text rather than property by property keeps a shorthand with a `var()`
 * whole: its longhands have no value of their own to set again.
 */
export function declarationsOf(cssText: string): string[] {
    const declarations: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < cssText.length; i++) {
        const ch = cssText[i];

        if (ch === '"' || ch === "'") i = stringEnd(cssText, i) - 1;
        else if (ch === '\\') i++;
        else if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ';' && depth === 0) {
            declarations.push(cssText.slice(start, i));
            start = i + 1;
        }
    }
    declarations.push(cssText.slice(start));
    return declarations.map((declaration) => declaration.trim()).filter((declaration) => declaration !== '');
}

/** The property a declaration sets: `color` for `COLOR: red`. A custom property keeps its case. */
export function propertyOf(declaration: string): string {
    const colon = declaration.indexOf(':');
    const name = (colon < 0 ? declaration : declaration.slice(0, colon)).trim();

    return name.startsWith('--') ? name : name.toLowerCase();
}

const IMPORTANT = /!\s*important$/i;

/**
 * A block's text with only the declarations whose property `keep` accepts
 * (all, without it) and, with `important`, every one of them `!important`.
 */
export function rewriteDeclarations(cssText: string, options: { keep?: (property: string) => boolean; important?: boolean }): string {
    const { keep, important } = options;

    return declarationsOf(cssText)
        .filter((declaration) => !keep || keep(propertyOf(declaration)))
        .map((declaration) => (important && !IMPORTANT.test(declaration) ? `${declaration} !important` : declaration))
        .join('; ');
}

/** Inherited properties that may be set on the scope roots, besides custom properties. */
const INHERITED: ReadonlySet<string> = new Set([
    'color',
    'color-scheme',
    'font',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-align',
    'text-indent',
    'text-transform',
    'text-shadow',
    'white-space',
    'visibility',
    'cursor',
    'direction',
    'quotes',
    'list-style',
    'caret-color',
    'accent-color',
    'tab-size',
    'hyphens',
    'overflow-wrap',
    'word-break',
    '-webkit-font-smoothing'
]);

/** Families of {@link INHERITED} longhands, by prefix. */
const INHERITED_FAMILIES = ['font-', 'list-style-'];

/**
 * Whether a rule on the document root may pass `property` on to the scope
 * roots: a custom property or an inherited one from a fixed list. The scope
 * roots only stand in for the document root as the source of what the scope
 * inherits. A background or a box would paint or lay out the roots themselves,
 * and the overlay container among them covers the viewport, the shell included.
 */
export function isInheritable(property: string): boolean {
    return property.startsWith('--') || INHERITED.has(property) || INHERITED_FAMILIES.some((family) => property.startsWith(family));
}

/**
 * Whether setting `property` sets one of `properties` too, or the other way
 * round: `font` and `font-size` meet, `--bg` and `--bg-hover` do not.
 */
export function overlaps(property: string, properties: ReadonlySet<string>): boolean {
    if (properties.has(property)) return true;
    if (property.startsWith('--')) return false;

    return Array.from(properties).some((other) => !other.startsWith('--') && (other.startsWith(`${property}-`) || property.startsWith(`${other}-`)));
}
