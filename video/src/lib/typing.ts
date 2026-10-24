// The typing effect of the code cards: Revideo's insert() fades new code in, so the scenes grow the code in steps.

/** Revideo's CodeHighlighter, restated so this module stays importable in Node. */
export interface Highlighter<T> {
    initialize(): boolean;
    prepare(code: string): T;
    highlight(index: number, cache: T): { color: string | null; skipAhead: number };
    tokenize(code: string): string[];
}

type StepCache<T> = { untyped: { at: number; length: number } } | { plain: T };

/** Where `code` is `finished` with one block not typed yet, or null when it is not. */
function untypedBlock(code: string, finished: string): { at: number; length: number } | null {
    const length = finished.length - code.length;
    let at = 0;
    while (at < code.length && code[at] === finished[at]) at++;
    return length >= 0 && finished.endsWith(code.slice(at)) ? { at, length } : null;
}

/**
 * Colours each typing step as the finished code. A half-typed decorator is not valid code: highlighted on its own,
 * an open bracket or quote recolours everything below it with every step, and the code flickers.
 */
export function highlightAsFinished<T>(base: Highlighter<T>, finished: string): Highlighter<StepCache<T> | null> {
    const finishedCache = base.prepare(finished);
    return {
        initialize: () => base.initialize(),
        prepare(code) {
            const untyped = untypedBlock(code, finished);
            return untyped ? { untyped } : { plain: base.prepare(code) };
        },
        highlight(index, cache) {
            if (!cache) return { color: null, skipAhead: 0 };
            if ('plain' in cache) return base.highlight(index, cache.plain);
            const { at, length } = cache.untyped;
            if (index >= at) return base.highlight(index + length, finishedCache);
            // A run stops at the untyped block: the characters on either side of it are not neighbours when finished.
            const result = base.highlight(index, finishedCache);
            return { ...result, skipAhead: Math.min(result.skipAhead, at - index) };
        },
        tokenize: (code) => base.tokenize(code)
    };
}

/** Where `after` inserts one block into `before`; at a line start when possible, so a new decorator never splits `@`. */
export function insertionOf(before: string, after: string): { at: number; text: string } {
    let prefix = 0;
    while (prefix < before.length && before[prefix] === after[prefix]) prefix++;
    const lineStart = before.lastIndexOf('\n', prefix - 1) + 1;
    for (const at of [lineStart, prefix]) {
        const rest = before.slice(at);
        if (after.length >= before.length && after.startsWith(before.slice(0, at)) && after.endsWith(rest)) {
            return { at, text: after.slice(at, after.length - rest.length) };
        }
    }
    throw new Error('The code after is not the code before with one block inserted');
}

/**
 * The code after each typed token (word, whitespace run or single symbol) of the inserted block; ends on `after`.
 * A block of whole lines keeps its final line break from the first step on, so the code below it never joins the
 * line being typed.
 */
export function typingSteps(before: string, after: string): string[] {
    const { at, text } = insertionOf(before, after);
    const wholeLines = text.endsWith('\n') && (at === 0 || before[at - 1] === '\n');
    const tokens = text.match(/\s+|\w+|[^\s\w]/g) ?? [];
    const steps: string[] = [];
    let typed = '';
    for (const token of tokens) {
        typed += token;
        const step = before.slice(0, at) + typed + (wholeLines && !typed.endsWith('\n') ? '\n' : '') + before.slice(at);
        if (step !== steps.at(-1)) steps.push(step);
    }
    return steps;
}
