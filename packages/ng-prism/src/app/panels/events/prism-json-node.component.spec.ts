import { jsonNodeType, summarizeValue } from './prism-json-node.utils.js';

describe('summarizeValue', () => {
    it('renders a string with quotes', () => {
        expect(summarizeValue('hello')).toBe('"hello"');
    });

    it('renders a number as-is', () => {
        expect(summarizeValue(42)).toBe('42');
    });

    it('renders boolean true', () => {
        expect(summarizeValue(true)).toBe('true');
    });

    it('renders null', () => {
        expect(summarizeValue(null)).toBe('null');
    });

    it('renders undefined', () => {
        expect(summarizeValue(undefined)).toBe('undefined');
    });

    it('renders an empty object', () => {
        expect(summarizeValue({})).toBe('{}');
    });

    it('renders an object with one key', () => {
        expect(summarizeValue({ a: 1 })).toBe('{a: 1}');
    });

    it('renders an object with two keys', () => {
        expect(summarizeValue({ a: 1, b: 'x' })).toBe('{a: 1, b: "x"}');
    });

    it('truncates object with more than two keys', () => {
        expect(summarizeValue({ a: 1, b: 2, c: 3 })).toBe('{a: 1, b: 2, …}');
    });

    it('renders an empty array', () => {
        expect(summarizeValue([])).toBe('[]');
    });

    it('renders an array with items (up to 3)', () => {
        expect(summarizeValue([1, 2, 3])).toBe('[1, 2, 3]');
    });

    it('truncates array with more than 3 items', () => {
        expect(summarizeValue([1, 2, 3, 4])).toBe('[1, 2, 3, …]');
    });

    it('nests object values using summarizeValue recursively', () => {
        expect(summarizeValue({ x: { y: 1 } })).toBe('{x: {y: 1}}');
    });

    it('shows a Date as its local day, also inside an object or an array', () => {
        const date = new Date(2026, 3, 28);

        expect(summarizeValue(date)).toBe('2026-04-28');
        expect(summarizeValue({ at: date })).toBe('{at: 2026-04-28}');
        expect(summarizeValue([date])).toBe('[2026-04-28]');
    });
});

describe('jsonNodeType', () => {
    it('tells a Date from other objects, so that it shows as a value and not as {}', () => {
        expect(jsonNodeType(new Date(2026, 3, 28))).toBe('date');
        expect(jsonNodeType({})).toBe('object');
    });
});
