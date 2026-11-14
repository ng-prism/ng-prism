import { applyJsonEdit, followJsonValue, highlightJson, parseForJsonControl, stringifyForJsonControl } from './json-control.component.js';

describe('highlightJson', () => {
    it('wraps JSON tokens in classed spans', () => {
        const html = highlightJson('{"label":"hi","n":2}');

        expect(html).toContain('<span class="jh-key">"label"</span>');
        expect(html).toContain('<span class="jh-string">"hi"</span>');
        expect(html).toContain('<span class="jh-number">2</span>');
    });

    it('returns an empty string for non-string input (defensive)', () => {
        // Regression: JsonControl crashed with `Cannot read properties of undefined
        // (reading 'replace')` when displayText computed to undefined because
        // JSON.stringify(undefined) returns undefined.
        expect(highlightJson(undefined as unknown as string)).toBe('');
        expect(highlightJson(null as unknown as string)).toBe('');
        expect(highlightJson(42 as unknown as string)).toBe('');
    });
});

describe('stringifyForJsonControl', () => {
    it('pretty-prints serializable values', () => {
        expect(stringifyForJsonControl({ a: 1 })).toBe('{\n  "a": 1\n}');
    });

    it('renders null as the literal "null" (matches JSON.stringify)', () => {
        expect(stringifyForJsonControl(null)).toBe('null');
    });

    it('renders undefined as the literal string "undefined"', () => {
        // JSON.stringify(undefined) === undefined (the value, not a string), which
        // upstream callers can't safely feed to a string renderer. We surface it
        // visibly instead so the controls panel doesn't crash.
        expect(stringifyForJsonControl(undefined)).toBe('undefined');
    });

    it('renders functions as the literal string "undefined" (JSON.stringify drops them)', () => {
        expect(stringifyForJsonControl(() => 0)).toBe('undefined');
    });
});

describe('Dates in the JSON control', () => {
    const value = { at: new Date(2026, 3, 28), label: '2026-04-28T00:00:00.000Z' };

    it('shows a Date as local time with its offset, so that the day is the one of the viewer', () => {
        const text = stringifyForJsonControl(value);

        expect(text).toContain('"at": "2026-04-28T00:00:00.000');
        expect(JSON.parse(text).at).not.toMatch(/Z$/);
    });

    it('keeps a Date a Date through an edit that leaves it in place', () => {
        const parsed = parseForJsonControl(stringifyForJsonControl(value), value) as typeof value;

        expect(parsed.at).toBeInstanceOf(Date);
        expect(parsed.at.getTime()).toBe(value.at.getTime());
    });

    it('takes an edited date as the new Date', () => {
        const parsed = parseForJsonControl('{ "at": "2026-05-01T00:00:00.000Z" }', value) as { at: Date };

        expect(parsed.at).toBeInstanceOf(Date);
        expect(parsed.at.getTime()).toBe(Date.UTC(2026, 4, 1));
    });

    it('leaves a string a string where there was no Date before', () => {
        expect((parseForJsonControl(stringifyForJsonControl(value), value) as typeof value).label).toBe('2026-04-28T00:00:00.000Z');
    });

    it('leaves text that is no date where the Date was', () => {
        expect((parseForJsonControl('{ "at": "soon" }', value) as { at: unknown }).at).toBe('soon');
    });

    // V8 reads 'Room 12' as 2001-12-01 and '5' as 2001-05-01.
    it.each([['Room 12'], ['5'], ['Meeting 3']])('leaves %s a string where the Date was', (text) => {
        expect((parseForJsonControl(JSON.stringify({ at: text }), value) as { at: unknown }).at).toBe(text);
    });

    // The text moves up to the slot where the Date was.
    it('leaves the text of an array a string when a Date before it is deleted', () => {
        expect(parseForJsonControl('["Room 12"]', [new Date(2026, 3, 28), 'Room 12'])).toEqual(['Room 12']);
    });

    it('keeps a Date at the root and in arrays', () => {
        const date = new Date(2026, 3, 28);

        expect(parseForJsonControl(stringifyForJsonControl(date), date)).toEqual(date);
        expect((parseForJsonControl(stringifyForJsonControl([date]), [date]) as Date[])[0]).toEqual(date);
    });

    it('throws for text that is no JSON, as the control expects', () => {
        expect(() => parseForJsonControl('{', value)).toThrow();
    });
});

describe('an edit in the JSON control', () => {
    const value = { at: new Date(2026, 3, 28) };
    const text = stringifyForJsonControl(value);
    // One digit of the day deleted: still JSON, but no date, so the control emits it as a string.
    const midway = text.replace('2026-04-28T', '2026-04-2T');

    it('keeps a Date through keystrokes that pass through text that is no date', () => {
        const first = applyJsonEdit(null, midway, value);

        expect(typeof (first.parsed as { at: unknown }).at).toBe('string');

        const second = applyJsonEdit(first.edit, text, first.parsed);

        expect((second.parsed as { at: unknown }).at).toBeInstanceOf(Date);
        expect((second.parsed as typeof value).at.getTime()).toBe(value.at.getTime());
    });

    it('keeps its text while the value is the one it emitted', () => {
        const { edit, parsed } = applyJsonEdit(null, text, value);

        expect(followJsonValue(edit, parsed)).toBe(edit);
    });

    it('lets go of its text when the value comes from elsewhere, as after Reset or a model() change', () => {
        const { edit } = applyJsonEdit(null, text, value);

        expect(followJsonValue(edit, { at: new Date(2026, 4, 1) })).toBeNull();
    });

    // Reset or another variant that hands back the value the edit started from, such as `undefined` again.
    it('lets go of text that does not parse when the inputs of a variant replace the values', () => {
        const { edit } = applyJsonEdit(null, '{', undefined);

        expect(followJsonValue(edit, undefined, true)).toBeNull();
    });

    it('keeps the value it started from when the text does not parse', () => {
        const { edit, error } = applyJsonEdit(null, '{', value);

        expect(error).toBe(true);
        expect(followJsonValue(edit, value)).toBe(edit);
        expect(edit.text).toBe('{');
    });
});
