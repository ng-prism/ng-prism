import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEmphasis } from './emphasis.ts';

test('parseEmphasis splits a caption into plain and emphasised parts', () => {
    assert.deepEqual(parseEmphasis('Every component. **Two files.**'), [
        { text: 'Every component. ', emphasis: false },
        { text: 'Two files.', emphasis: true }
    ]);
});

test('parseEmphasis handles several emphasised parts', () => {
    assert.deepEqual(parseEmphasis('**a** b **c**'), [
        { text: 'a', emphasis: true },
        { text: ' b ', emphasis: false },
        { text: 'c', emphasis: true }
    ]);
});

test('parseEmphasis returns plain text unchanged', () => {
    assert.deepEqual(parseEmphasis('No markup'), [{ text: 'No markup', emphasis: false }]);
});

test('parseEmphasis throws on an unbalanced marker', () => {
    assert.throws(() => parseEmphasis('a **b'), { message: 'Unbalanced ** in "a **b"' });
});
