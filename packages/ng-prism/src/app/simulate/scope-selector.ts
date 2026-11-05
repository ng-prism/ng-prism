import { attributeEnd, escapeEnd, identEnd, LEGACY_PSEUDO_ELEMENTS, stringEnd, WHITESPACE } from '../pseudo/pseudo-selector.js';

/** The attribute on the element the simulation is applied to. */
export const SIM_SCOPE_ATTR = 'data-prism-sim';

/**
 * What a simulation reaches: the simulated element and the CDK overlay
 * container, because overlays (menus, dialogs, tooltips) render outside the
 * component's own subtree and still belong to it.
 */
export const SIM_SCOPE = `[${SIM_SCOPE_ATTR}], .cdk-overlay-container`;

/** The scope as a selector of zero specificity, so that a rewritten selector weighs what the original did. */
const SCOPE = `:where(${SIM_SCOPE})`;

/**
 * Appended to a selector, it stops matching inside the scope or at its root.
 * `:not()` weighs as its most specific argument, and every argument here weighs
 * nothing, so the selector keeps its specificity.
 */
export const SCOPE_OUT_SUFFIX = `:not(${SCOPE} *, ${SCOPE})`;

/** A leading `:root`, `html` or `body`, and not a longer name that starts like one. */
const ROOT_COMPOUND = /^(?::root|html|body)(?![\w\\-])/i;

/** A descendant combinator: whitespace that no other combinator follows. */
const DESCENDANT = /^[ \t\n\r\f]+(?![ \t\n\r\f>+~])/;

/**
 * The selector list as it applies inside the scope, in two forms per selector:
 * below a scope root, and at one, for a selector whose subject is the scope
 * root itself. Both keep the specificity of the original, as {@link SCOPE} has
 * none, and a trailing pseudo-element stays at the end, where it has to be.
 *
 * The document root has no place inside the scope, so the scope root stands in
 * for it: `html .card` becomes `:where(…) .card`, and what else the root
 * compound says goes on applying, to the scope root (`:root:not(.light)` becomes
 * `:where(…):not(.light)`).
 *
 * The result is one list of selectors joined with `, `, whatever whitespace
 * the input used.
 */
export function scopeIn(selectorList: string): string {
    return splitList(selectorList)
        .map((part) => part.trim())
        .filter((selector) => selector !== '')
        .flatMap(scopeInSelector)
        .join(', ');
}

/**
 * The selector list as it applies outside the scope: each selector gets
 * {@link SCOPE_OUT_SUFFIX}, in front of a trailing pseudo-element. Used on the
 * original of a rule whose copy answers inside the scope, so that the original
 * keeps answering everywhere else.
 *
 * A selector whose subject is the document root (`:root`, `html`, `body`) is
 * left alone: it never matches inside the scope anyway, and the exclusion
 * would only be noise.
 *
 * Only the suffix is inserted, so {@link unscopeOut} can take it out again
 * without knowing what the list looked like: `unscopeOut(scopeOut(x))` is `x`.
 */
export function scopeOut(selectorList: string): string {
    return splitList(selectorList)
        .map((part) => {
            const at = exclusionPoint(part);

            return at === null ? part : part.slice(0, at) + SCOPE_OUT_SUFFIX + part.slice(at);
        })
        .join(',');
}

/** The selector list as it was before {@link scopeOut}; a list that was not scoped out comes back unchanged. */
export function unscopeOut(selectorList: string): string {
    return splitList(selectorList)
        .map((part) => {
            const at = exclusionPoint(part);

            return at !== null && part.slice(0, at).endsWith(SCOPE_OUT_SUFFIX) ? part.slice(0, at - SCOPE_OUT_SUFFIX.length) + part.slice(at) : part;
        })
        .join(',');
}

function scopeInSelector(selector: string): string[] {
    const { firstEnd, pseudoStart } = shapeOf(selector);
    const head = selector.slice(0, pseudoStart);
    const tail = selector.slice(pseudoStart);
    const root = ROOT_COMPOUND.exec(head);

    if (root === null) return [`${SCOPE} ${head}${tail}`, `${head}${SCOPE}${tail}`];

    const compoundEnd = Math.min(firstEnd, head.length);
    const qualifiers = head.slice(root[0].length, compoundEnd);
    const rest = head.slice(compoundEnd);
    const inside = `${SCOPE}${qualifiers}${rest}${tail}`;

    // Everything is a descendant of the root, so the subject may be the scope root itself. That does not
    // hold for a child or a sibling, nor once the root compound has conditions the scope root may not meet.
    if (qualifiers !== '' || !DESCENDANT.test(rest)) return [inside];

    return [inside, `${rest.trimStart()}${SCOPE}${tail}`];
}

/**
 * Where {@link SCOPE_OUT_SUFFIX} sits in `part` (a selector with the whitespace
 * around it), or `null` where it does not belong: in a blank part and in a
 * selector that only targets the document root.
 */
function exclusionPoint(part: string): number | null {
    const selector = part.trim();

    if (selector === '') return null;

    const { lastStart, pseudoStart } = shapeOf(selector);

    if (ROOT_COMPOUND.test(selector.slice(lastStart))) return null;

    return part.length - part.trimStart().length + pseudoStart;
}

interface SelectorShape {
    /** Where the first compound ends: at the first whitespace or combinator on the top level, else at the end. */
    firstEnd: number;
    /** Where the last compound, the subject, starts. */
    lastStart: number;
    /** Where the trailing pseudo-element starts, else the end. */
    pseudoStart: number;
}

/**
 * Where the compounds of a complex selector begin and end, on the top level
 * only: a combinator, a comma or a pseudo-element inside `:is()`, `:not()`, an
 * attribute value, a string or an escape does not count. Takes a trimmed
 * selector, one of a list.
 *
 * A pseudo-element runs to the end of the selector, `::part(x):hover` included.
 * A single colon makes one only for the four that CSS 2 wrote that way.
 */
function shapeOf(selector: string): SelectorShape {
    let firstEnd = -1;
    let lastStart = 0;
    let pseudoStart = -1;
    let i = 0;

    while (i < selector.length) {
        const skipped = opaqueEnd(selector, i);

        if (skipped > i) {
            i = skipped;
        } else if (isSeparator(selector[i])) {
            if (firstEnd < 0) firstEnd = i;
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

    return {
        firstEnd: firstEnd < 0 ? selector.length : firstEnd,
        lastStart,
        pseudoStart: pseudoStart < 0 ? selector.length : pseudoStart
    };
}

/**
 * The parts of the list between its top-level commas. They are not trimmed and
 * nothing is dropped, so the parts joined with `,` are the list again.
 */
function splitList(list: string): string[] {
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
