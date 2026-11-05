import { attributeEnd, escapeEnd, identEnd, LEGACY_PSEUDO_ELEMENTS, stringEnd, WHITESPACE } from '../pseudo/pseudo-selector.js';

/** The attribute on the element the simulation is applied to. */
export const SIM_SCOPE_ATTR = 'data-prism-sim';

const SCOPE_ROOT_ATTR = `[${SIM_SCOPE_ATTR}]`;

/** The CDK overlay container, a scope root by its class alone. */
export const OVERLAY_ROOT = '.cdk-overlay-container';

/**
 * What a simulation reaches: the simulated element and the CDK overlay
 * container, because overlays (menus, dialogs, tooltips) render outside the
 * component's own subtree and still belong to it.
 */
export const SIM_SCOPE = `${SCOPE_ROOT_ATTR}, ${OVERLAY_ROOT}`;

/** The scope roots as a selector that weighs nothing. */
const SCOPE = `:where(${SIM_SCOPE})`;

/**
 * Appended to a selector, it stops matching inside the scope and at its roots.
 * `:not()` weighs as its most specific argument and every argument here weighs
 * nothing, so the selector keeps its specificity.
 */
export const SCOPE_OUT_SUFFIX = `:not(${SCOPE} *, ${SCOPE})`;

/**
 * Appended to a selector, it matches only inside the scope and at its roots:
 * the exact complement of {@link SCOPE_OUT_SUFFIX}, and as light, since
 * `:where()` weighs nothing.
 */
export const SCOPE_IN_SUFFIX = `:where(${SCOPE_ROOT_ATTR} *, ${OVERLAY_ROOT} *, ${SIM_SCOPE})`;

/** A leading `:root`, `html` or `body`, and not a longer name that starts like one. */
const ROOT_COMPOUND = /^(?::root|html|body)(?![\w\\-])/i;

/**
 * The selector list as it applies inside the scope: each selector gets
 * {@link SCOPE_IN_SUFFIX}, in front of a trailing pseudo-element, at the point
 * where {@link scopeOut} puts its own. A copy of a rule scoped this way matches
 * exactly what the scoped-out original no longer does, whatever the rest of the
 * selector says. A chain that crosses the scope boundary stays whole:
 * `.theme .b` with `.theme` outside, `.wrap .b` with `.wrap` as the scope root
 * and `.cdk-overlay-container .item` all match their `.b` or `.item` inside.
 *
 * A selector whose subject is the document root (`:root`, `html`, `body`, with
 * or without qualifiers such as `.dark`) cannot match inside the scope. Its
 * copy goes to the scope roots instead, as `<original> :where(…)`: the
 * original is evaluated on the real document root, so a `:root.dark` rule
 * reaches the scope roots only while the document is `.dark`, and the
 * specificity is the original's.
 *
 * `parentIsRoot` says that the list is nested in a rule whose subject is the
 * document root. `&` stands for the root there, so `&.dark` in `:root { … }`
 * counts as a selector on the root.
 *
 * Only text is inserted, nothing is trimmed or reshaped, so the result keeps
 * the list's own whitespace.
 */
export function scopeIn(selectorList: string, parentIsRoot = false): string {
    return splitList(selectorList)
        .map((part) => {
            const point = insertionPoint(part, parentIsRoot);

            if (point === null) return part;

            return part.slice(0, point.at) + (point.root ? ` ${SCOPE}` : SCOPE_IN_SUFFIX) + part.slice(point.at);
        })
        .join(',');
}

/**
 * The selector list as it applies outside the scope: each selector gets
 * {@link SCOPE_OUT_SUFFIX}, in front of a trailing pseudo-element. Used on the
 * original of a rule whose copy answers inside the scope, so that the original
 * keeps answering everywhere else.
 *
 * A selector whose subject is the document root (`:root`, `html`, `body`) is
 * left alone: it never matches inside the scope anyway, and the exclusion
 * would only be noise. `parentIsRoot` is as for {@link scopeIn}.
 *
 * Only the suffix is inserted, so {@link unscopeOut} can take it out again
 * without knowing what the list looked like: `unscopeOut(scopeOut(x))` is `x`.
 */
export function scopeOut(selectorList: string, parentIsRoot = false): string {
    return splitList(selectorList)
        .map((part) => {
            const point = insertionPoint(part, parentIsRoot);

            return point === null || point.root ? part : part.slice(0, point.at) + SCOPE_OUT_SUFFIX + part.slice(point.at);
        })
        .join(',');
}

/**
 * The selector list as it was before {@link scopeOut}; a list that was not
 * scoped out comes back unchanged. `suffix` is what to take out, for a list
 * whose suffix the browser has written differently than {@link SCOPE_OUT_SUFFIX}
 * after the list went through a stylesheet.
 */
export function unscopeOut(selectorList: string, suffix: string = SCOPE_OUT_SUFFIX): string {
    return splitList(selectorList)
        .map((part) => {
            const point = insertionPoint(part, false);

            if (point === null || point.root || !part.slice(0, point.at).endsWith(suffix)) return part;

            return part.slice(0, point.at - suffix.length) + part.slice(point.at);
        })
        .join(',');
}

/**
 * Whether a selector of the list has the document root (`:root`, `html`,
 * `body`) as its subject. `parentIsRoot` is as for {@link scopeIn}.
 */
export function targetsRoot(selectorList: string, parentIsRoot = false): boolean {
    return splitList(selectorList).some((part) => insertionPoint(part, parentIsRoot)?.root === true);
}

/**
 * Where a scope suffix goes in `part` (a selector with the whitespace around
 * it): behind the subject, in front of a trailing pseudo-element. `root` says
 * whether the subject is the document root, or `&` for a rule nested in one
 * (`parentIsRoot`). `null` for a blank part.
 */
function insertionPoint(part: string, parentIsRoot: boolean): { at: number; root: boolean } | null {
    const selector = part.trim();

    if (selector === '') return null;

    const { lastStart, pseudoStart } = shapeOf(selector);
    const subject = selector.slice(lastStart);

    return {
        at: part.length - part.trimStart().length + pseudoStart,
        root: ROOT_COMPOUND.test(subject) || (parentIsRoot && subject.startsWith('&'))
    };
}

/**
 * A selector as the element it is about and the pseudo-element it ends in, as
 * {@link scopeIn} finds it: `.btn:hover` and `::before` for `.btn:hover::before`,
 * an empty `pseudoElement` for a selector without one. For one selector of a
 * list, trimmed.
 */
export function splitPseudoElement(selector: string): { element: string; pseudoElement: string } {
    const trimmed = selector.trim();
    const { pseudoStart } = shapeOf(trimmed);

    return { element: trimmed.slice(0, pseudoStart), pseudoElement: trimmed.slice(pseudoStart) };
}

interface SelectorShape {
    /** Where the last compound, the subject, starts. */
    lastStart: number;
    /** Where the trailing pseudo-element starts, else the end. */
    pseudoStart: number;
}

/**
 * Where the subject of a complex selector starts and where its trailing
 * pseudo-element does, on the top level only: a combinator, a comma or a
 * pseudo-element inside `:is()`, `:not()`, an attribute value, a string or an
 * escape does not count. Takes a trimmed selector, one of a list.
 *
 * A pseudo-element runs to the end of the selector, `::part(x):hover` included.
 * A single colon makes one only for the four that CSS 2 wrote that way.
 */
function shapeOf(selector: string): SelectorShape {
    let lastStart = 0;
    let pseudoStart = -1;
    let i = 0;

    while (i < selector.length) {
        const skipped = opaqueEnd(selector, i);

        if (skipped > i) {
            i = skipped;
        } else if (isSeparator(selector[i])) {
            while (i < selector.length && isSeparator(selector[i])) i++;
            lastStart = i;
            pseudoStart = -1;
        } else if (selector[i] === ':') {
            const isElement = selector[i + 1] === ':';
            const nameStart = i + (isElement ? 2 : 1);
            const nameEnd = identEnd(selector, nameStart);

            if (pseudoStart < 0 && (isElement || LEGACY_PSEUDO_ELEMENTS.has(selector.slice(nameStart, nameEnd).toLowerCase()))) pseudoStart = i;
            i = nameEnd;
        } else {
            i++;
        }
    }

    return { lastStart, pseudoStart: pseudoStart < 0 ? selector.length : pseudoStart };
}

/**
 * The parts of the list between its top-level commas. They are not trimmed and
 * nothing is dropped, so the parts joined with `,` are the list again.
 */
export function splitList(list: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let i = 0;

    while (i < list.length) {
        const skipped = opaqueEnd(list, i);

        if (skipped > i) {
            i = skipped;
            continue;
        }
        if (list[i] === ',') {
            parts.push(list.slice(start, i));
            start = i + 1;
        }
        i++;
    }
    parts.push(list.slice(start));

    return parts;
}

function isSeparator(ch: string): boolean {
    return ch === '>' || ch === '+' || ch === '~' || WHITESPACE.test(ch);
}

/**
 * End of the escape, string, attribute selector or parenthesised group that
 * starts at `i`, all of which may hold a comma, a space or a colon that means
 * nothing to the selector around them. `i` itself when none starts there.
 */
function opaqueEnd(s: string, i: number): number {
    const ch = s[i];

    if (ch === '\\') return escapeEnd(s, i);
    if (ch === '"' || ch === "'") return stringEnd(s, i);
    if (ch === '[') return attributeEnd(s, i);
    if (ch === '(') return groupEnd(s, i);

    return i;
}

/** End of the parenthesised group starting at `start`, nested groups included. */
function groupEnd(s: string, start: number): number {
    let i = start + 1;

    while (i < s.length && s[i] !== ')') {
        const skipped = opaqueEnd(s, i);

        i = skipped > i ? skipped : i + 1;
    }

    return i < s.length ? i + 1 : i;
}
