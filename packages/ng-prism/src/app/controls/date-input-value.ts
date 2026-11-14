import { localDay } from '../../shared/date-value.js';

/** The value of an `<input type="date">`: a year of four digits or more, as the field takes years up to 275760. */
const DAY = /^(\d{4,})-(\d{2})-(\d{2})$/;

/**
 * The value of an `<input type="date">` for `value`: its local day, `''` for anything that is no valid `Date` and for a
 * year before 1, which the field does not take.
 */
export function toDateInputValue(value: unknown): string {
    if (!(value instanceof Date) || Number.isNaN(value.getTime()) || value.getFullYear() < 1) return '';

    // The field writes a year past 9999 without the sign and the padding of ISO 8601.
    return localDay(value).replace(/^\+0*/, '');
}

/** The `Date` of an `<input type="date">`'s value, at local midnight of that day; `null` for an empty field. */
export function fromDateInputValue(text: string): Date | null {
    const match = DAY.exec(text);

    if (!match) return null;

    // Not `new Date(year, …)`, which reads the years 0 to 99 as 1900 to 1999.
    const date = new Date(0);

    date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setHours(0, 0, 0, 0);

    return date;
}
