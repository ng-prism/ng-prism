const DATE_KEY = '$prismDate';

/**
 * JSON of what the session keeps, with each `Date` as `{ "$prismDate": <time> }`: JSON has no dates, and
 * `JSON.stringify` alone would bring one back as a string. The same browser reads it, so the time is all to keep.
 */
export function stringifyPersisted(value: unknown): string {
    return JSON.stringify(value, function (this: Record<string, unknown>, key: string, item: unknown) {
        const raw = this[key];

        return raw instanceof Date ? { [DATE_KEY]: raw.getTime() } : item;
    });
}

/** What {@link stringifyPersisted} wrote, its dates `Date`s again. Only an object of the one key with a time is one. */
export function parsePersisted(raw: string): unknown {
    return JSON.parse(raw, (_key, item: unknown) => (isStoredDate(item) ? new Date(item[DATE_KEY]) : item));
}

function isStoredDate(item: unknown): item is { [DATE_KEY]: number } {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;

    const keys = Object.keys(item);

    return keys.length === 1 && keys[0] === DATE_KEY && typeof (item as Record<string, unknown>)[DATE_KEY] === 'number';
}
