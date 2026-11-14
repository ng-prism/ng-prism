import { formatDateValue } from './date-value.js';

/**
 * A value as the code that sets it writes it, for an input's default: a string in single quotes with its quotes and
 * backslashes escaped, a `Date` as {@link formatDateValue} shows it, also inside an array or an object, which are JSON,
 * and anything else by its `String()`. Since 22.8.0.
 */
export function formatDefaultValue(value: unknown): string {
    if (typeof value === 'string') return `'${value.replace(/[\\']/g, '\\$&')}'`;
    if (value instanceof Date) return formatDateValue(value);
    return typeof value === 'object' && value !== null ? JSON.stringify(value, readableDates) : String(value);
}

/** A `Date` inside a value as its day, not as the UTC time `toISOString()` would give it. */
function readableDates(this: Record<string, unknown>, key: string, value: unknown): unknown {
    const raw = this[key];

    return raw instanceof Date ? formatDateValue(raw) : value;
}
