import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightAsFinished, insertionOf, typingSteps, type Highlighter } from './typing.ts';

/** Colours quoted text; an unclosed quote colours everything after it, as an unterminated string does in a parser. */
const quotes: Highlighter<string> = {
    initialize: () => true,
    prepare: (code) => code,
    highlight(index, code) {
        const open = (code.slice(0, index).match(/'/g) ?? []).length % 2 === 1;
        if (!open && code[index] !== "'") return { color: null, skipAhead: 1 };
        const close = code.indexOf("'", open ? index : index + 1);
        return { color: 'str', skipAhead: (close === -1 ? code.length : close + 1) - index };
    },
    tokenize: (code) => [code]
};

/** The colour of every character, walked run by run the way Revideo's Code node draws them. */
function colours<T>(highlighter: Highlighter<T>, code: string): (string | null)[] {
    const cache = highlighter.prepare(code);
    const result: (string | null)[] = [];
    while (result.length < code.length) {
        const { color, skipAhead } = highlighter.highlight(result.length, cache);
        for (let n = Math.max(1, skipAhead); n > 0 && result.length < code.length; n--) result.push(color);
    }
    return result;
}

test('insertionOf finds the one inserted block', () => {
    assert.deepEqual(insertionOf('@Component\nclass X {}', '@Showcase({})\n@Component\nclass X {}'), { at: 0, text: '@Showcase({})\n' });
    assert.deepEqual(insertionOf('ab', 'aXYb'), { at: 1, text: 'XY' });
});

test('insertionOf rejects code that is more than one insertion away', () => {
    assert.throws(() => insertionOf('abc', 'aXc'), { message: 'The code after is not the code before with one block inserted' });
});

test('typingSteps grows the code token by token and ends on the code after', () => {
    assert.deepEqual(typingSteps('ab', 'aXY Z.b'), ['aXYb', 'aXY b', 'aXY Zb', 'aXY Z.b']);
});

test('typingSteps keeps the code below a new block on its own line while typing', () => {
    assert.deepEqual(typingSteps('X', 'a b\nX'), ['a\nX', 'a \nX', 'a b\nX']);
});

test('typingSteps keeps an indentation run in one step', () => {
    assert.deepEqual(typingSteps('', 'a\n    b'), ['a', 'a\n    ', 'a\n    b']);
});

test('highlightAsFinished colours every typing step as the finished code, with the untyped block left out', () => {
    const before = "a\nb = 'x'\n";
    const after = "a\ntitle: 'Button',\nb = 'x'\n";
    const finished = colours(quotes, after);
    const highlighter = highlightAsFinished(quotes, after);
    for (const step of typingSteps(before, after)) {
        const untyped = after.length - step.length;
        let at = 0;
        while (at < step.length && step[at] === after[at]) at++;
        assert.deepEqual(colours(highlighter, step), [...finished.slice(0, at), ...finished.slice(at + untyped)], JSON.stringify(step));
    }
});

test('highlightAsFinished falls back to the plain colours for code that is not a step towards the finished code', () => {
    assert.deepEqual(colours(highlightAsFinished(quotes, "x = 'a'"), "'b"), colours(quotes, "'b"));
});
