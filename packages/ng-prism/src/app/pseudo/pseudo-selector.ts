import { PSEUDO_STATES, type PseudoState } from '../../shared/pseudo-state.type.js';

/** Prefix of the classes that stand in for a forced pseudo-class. */
export const PSEUDO_CLASS_PREFIX = 'prism-pseudo--';

/** The class that stands in for `state`, e.g. `prism-pseudo--focus-visible`. */
export function pseudoStateClass(state: PseudoState): string {
    return `${PSEUDO_CLASS_PREFIX}${state}`;
}

const FORCEABLE: ReadonlySet<string> = new Set(PSEUDO_STATES);

/** CSS 2 pseudo-elements, which still parse with a single colon. */
export const LEGACY_PSEUDO_ELEMENTS: ReadonlySet<string> = new Set(['before', 'after', 'first-line', 'first-letter']);

/** CSS whitespace, which is what separates compounds when no other combinator does. */
export const WHITESPACE = /[ \t\n\r\f]/;

const HEX_DIGIT = /[0-9a-f]/i;
const IDENT_CHAR = /[a-z0-9_-]/i;

/**
 * The selector with every forced pseudo-class `:x` widened to
 * `:is(:x, .prism-pseudo--x)` ({@link pseudoStateClass}), or `null` when it
 * uses none or has been widened before.
 *
 * Without the class on any element the widened selector matches exactly what
 * the original matched, with the same specificity: `:is()` takes the highest
 * of its arguments, and a class weighs what a pseudo-class weighs. With the
 * class, an element counts as being in the state whether it is forced or real,
 * which keeps `:not(:hover)` exact in both directions and lets a forced state
 * combine with a real one in the same selector.
 *
 * Tokenised rather than string-replaced. An escaped colon (`.md\:hover`) and an
 * attribute value (`[title=":hover"]`) are left alone, and a state that follows
 * a pseudo-element (`::part(x):hover`) is kept as it is, because `:is()` is not
 * allowed there.
 */
export function rewritePseudoSelector(selectorText: string): string | null {
    const s = selectorText;

    if (s.includes(PSEUDO_CLASS_PREFIX)) return null;

    let out = '';
    let changed = false;
    // One entry per nesting level: whether the compound being read follows a pseudo-element.
    const afterPseudoElement = [false];
    let i = 0;

    while (i < s.length) {
        const ch = s[i];
        const level = afterPseudoElement.length - 1;
        let end = i + 1;

        if (ch === '\\') {
            end = escapeEnd(s, i);
        } else if (ch === '"' || ch === "'") {
            end = stringEnd(s, i);
        } else if (ch === '[') {
            end = attributeEnd(s, i);
        } else if (ch === '(') {
            afterPseudoElement.push(false);
        } else if (ch === ')') {
            if (level > 0) afterPseudoElement.pop();
        } else if (ch === ',' || ch === '>' || ch === '+' || ch === '~' || WHITESPACE.test(ch)) {
            afterPseudoElement[level] = false;
        } else if (ch === ':') {
            const isElement = s[i + 1] === ':';
            const nameStart = i + (isElement ? 2 : 1);

            end = identEnd(s, nameStart);
            const name = s.slice(nameStart, end).toLowerCase();

            if (!isElement && FORCEABLE.has(name) && s[end] !== '(' && !afterPseudoElement[level]) {
                out += `:is(${s.slice(i, end)}, .${PSEUDO_CLASS_PREFIX}${name})`;
                changed = true;
                i = end;
                continue;
            }
            if (isElement || LEGACY_PSEUDO_ELEMENTS.has(name)) afterPseudoElement[level] = true;
        }
        out += s.slice(i, end);
        i = end;
    }

    return changed ? out : null;
}

/** End of the escape starting at `start`: a hex escape takes up to six digits and one whitespace character. */
export function escapeEnd(s: string, start: number): number {
    let i = start + 1;

    if (i >= s.length) return i;
    if (!HEX_DIGIT.test(s[i])) return i + 1;
    while (i < s.length && i < start + 7 && HEX_DIGIT.test(s[i])) i++;
    if (s[i] === '\r' && s[i + 1] === '\n') return i + 2;
    return i < s.length && WHITESPACE.test(s[i]) ? i + 1 : i;
}

/** End of the identifier starting at `start`, escapes included. */
export function identEnd(s: string, start: number): number {
    let i = start;

    while (i < s.length) {
        if (s[i] === '\\') {
            i = escapeEnd(s, i);
        } else if (IDENT_CHAR.test(s[i]) || s.charCodeAt(i) >= 0x80) {
            i++;
        } else {
            break;
        }
    }
    return i;
}

/** End of the string starting at `start`, which is a quote. */
export function stringEnd(s: string, start: number): number {
    const quote = s[start];
    let i = start + 1;

    while (i < s.length) {
        if (s[i] === '\\') i += 2;
        else if (s[i] === quote) return i + 1;
        else i++;
    }
    return i;
}

/** End of the attribute selector starting at `start`, which is its `[`. */
export function attributeEnd(s: string, start: number): number {
    let i = start + 1;

    while (i < s.length) {
        if (s[i] === '\\') i = escapeEnd(s, i);
        else if (s[i] === '"' || s[i] === "'") i = stringEnd(s, i);
        else if (s[i] === ']') return i + 1;
        else i++;
    }
    return i;
}
