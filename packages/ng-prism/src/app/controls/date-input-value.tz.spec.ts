import { fromDateInputValue, toDateInputValue } from './date-input-value.js';

// Runs once per time zone project of jest.config.cjs.

const OFFSETS: Record<string, number> = { 'America/New_York': 300, 'Europe/Berlin': -60 };

describe('the date control', () => {
    it('runs in the zone of its project', () => {
        const zone = (globalThis as { __PRISM_TIMEZONE__?: string }).__PRISM_TIMEZONE__!;

        expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(OFFSETS[zone]);
    });

    describe('toDateInputValue', () => {
        it.each([
            ['local midnight', new Date(2026, 3, 28), '2026-04-28'],
            ['a time late in the day', new Date(2026, 3, 28, 23, 59), '2026-04-28'],
            ['a day and month below ten', new Date(2026, 0, 5), '2026-01-05']
        ])('shows the local day of %s', (_, value, text) => {
            expect(toDateInputValue(value)).toBe(text);
        });

        // A value kept by a session from before Dates survived a reload, or anything else that is no Date.
        it.each([
            ['an ISO string', '2026-04-27T22:00:00.000Z'],
            ['null', null],
            ['undefined', undefined],
            ['an invalid date', new Date(NaN)],
            // The field takes no year before 1.
            ['a year before 1', new Date(new Date(2026, 0, 1).setFullYear(0))]
        ])('shows an empty field for %s', (_, value) => {
            expect(toDateInputValue(value)).toBe('');
        });
    });

    describe('fromDateInputValue', () => {
        it('makes local midnight of the day', () => {
            const date = fromDateInputValue('2026-04-28')!;

            expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 3, 28, 0, 0]);
        });

        // `new Date(year, …)` reads 0 to 99 as 1900 to 1999.
        it('keeps a year below 100', () => {
            const date = fromDateInputValue('0050-03-01')!;

            expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([50, 2, 1, 0]);
            expect(toDateInputValue(date)).toBe('0050-03-01');
        });

        // The field takes years up to 275760, so a fifth digit typed into the year is a day, not an emptied field.
        it('reads a year of more than four digits', () => {
            const date = fromDateInputValue('20266-04-28')!;

            expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([20266, 3, 28]);
            expect(toDateInputValue(date)).toBe('20266-04-28');
        });

        it.each([
            ['an empty field', ''],
            ['text that is no day', '28.04.2026']
        ])('makes nothing of %s', (_, text) => {
            expect(fromDateInputValue(text)).toBeNull();
        });
    });
});
