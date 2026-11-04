import { parsePersisted, stringifyPersisted } from './persisted-values.js';

describe('stringifyPersisted and parsePersisted', () => {
    it('bring a Date back as a Date with the same time, wherever it sits', () => {
        const a = new Date(2026, 3, 28);
        const b = new Date(0);
        const restored = parsePersisted(stringifyPersisted({ a, list: [b], nested: { at: a } })) as { a: Date; list: Date[]; nested: { at: Date } };

        expect(restored.a).toBeInstanceOf(Date);
        expect(restored.a.getTime()).toBe(a.getTime());
        expect(restored.list[0].getTime()).toBe(0);
        expect(restored.nested.at.getTime()).toBe(a.getTime());
    });

    it('leave an object alone that only looks like a stored Date', () => {
        const restored = parsePersisted(stringifyPersisted({ c: { $prismDate: 'x' }, d: { $prismDate: 1, other: true } })) as Record<string, unknown>;

        expect(restored['c']).toEqual({ $prismDate: 'x' });
        expect(restored['d']).toEqual({ $prismDate: 1, other: true });
    });

    it('write everything else as JSON does', () => {
        const value = { size: 'large', count: 2, on: true, none: null, list: [1, 'a'] };

        expect(stringifyPersisted(value)).toBe(JSON.stringify(value));
        expect(parsePersisted(JSON.stringify(value))).toEqual(value);
    });
});
