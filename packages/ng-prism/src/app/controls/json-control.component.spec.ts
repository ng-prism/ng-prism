import { highlightJson, parseForJsonControl, stringifyForJsonControl } from './json-control.component.js';

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

    it('keeps a Date at the root and in arrays', () => {
        const date = new Date(2026, 3, 28);

        expect(parseForJsonControl(stringifyForJsonControl(date), date)).toEqual(date);
        expect((parseForJsonControl(stringifyForJsonControl([date]), [date]) as Date[])[0]).toEqual(date);
    });

    it('throws for text that is no JSON, as the control expects', () => {
        expect(() => parseForJsonControl('{', value)).toThrow();
    });
});
