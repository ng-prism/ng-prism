import { formatDefaultValue } from './default-value.js';

describe('formatDefaultValue', () => {
    it.each([
        ['a string in single quotes', 'primary', "'primary'"],
        ['its quotes and backslashes escaped', "it's a\\b", "'it\\'s a\\\\b'"],
        ['a number', 3, '3'],
        ['a boolean', false, 'false'],
        ['null', null, 'null'],
        ['an array as JSON', ['a', 'b'], '["a","b"]'],
        ['an object as JSON', { size: 'sm' }, '{"size":"sm"}'],
        ['a Date as its day', new Date(2026, 0, 1), '2026-01-01'],
        ['a Date inside an object as its day', { from: new Date(2026, 0, 1) }, '{"from":"2026-01-01"}'],
        ['a Date inside an array as its day', [new Date(2026, 0, 1)], '["2026-01-01"]']
    ])('writes %s', (_, value, text) => {
        expect(formatDefaultValue(value)).toBe(text);
    });
});
