import { formatDateValue, toLocalIsoString } from './date-value.js';

// Runs once per time zone project of jest.config.cjs.

const ZONES: Record<string, { offset: number; suffix: string }> = {
    'America/New_York': { offset: 300, suffix: '-04:00' },
    'Europe/Berlin': { offset: -60, suffix: '+02:00' }
};
const zone = ZONES[(globalThis as { __PRISM_TIMEZONE__?: string }).__PRISM_TIMEZONE__!];

describe('formatDateValue', () => {
    it('runs in the zone of its project', () => {
        expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(zone.offset);
    });

    it.each([
        ['local midnight as the day', new Date(2026, 3, 28), '2026-04-28'],
        ['a time as hours and minutes', new Date(2026, 3, 28, 14, 30), '2026-04-28 14:30'],
        ['seconds and milliseconds when there are some', new Date(2026, 3, 28, 14, 30, 5, 7), '2026-04-28 14:30:05.007'],
        ['seconds without milliseconds', new Date(2026, 3, 28, 9, 5, 30), '2026-04-28 09:05:30'],
        ['an invalid date as such', new Date(NaN), 'Invalid Date']
    ])('shows %s', (_, date, text) => {
        expect(formatDateValue(date)).toBe(text);
    });

    it('shows a UTC midnight in the local time of the zone', () => {
        expect(formatDateValue(new Date('2026-04-28'))).toBe(zone.offset > 0 ? '2026-04-27 20:00' : '2026-04-28 02:00');
    });
});

describe('toLocalIsoString', () => {
    it('writes the local time with the offset of the zone', () => {
        expect(toLocalIsoString(new Date(2026, 3, 28))).toBe(`2026-04-28T00:00:00.000${zone.suffix}`);
    });

    it('keeps milliseconds and pads every part', () => {
        expect(toLocalIsoString(new Date(2026, 0, 2, 3, 4, 5, 6))).toBe(`2026-01-02T03:04:05.006${zone.offset > 0 ? '-05:00' : '+01:00'}`);
    });

    it('reads back as the same time', () => {
        const date = new Date(2026, 3, 28, 14, 30);

        expect(new Date(toLocalIsoString(date)).getTime()).toBe(date.getTime());
    });
});
