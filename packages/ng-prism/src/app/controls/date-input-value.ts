const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The value of an `<input type="date">` for `value`: its local day, `''` for anything that is no valid `Date`. */
export function toDateInputValue(value: unknown): string {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';

    const pad = (part: number) => String(part).padStart(2, '0');

    return `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** The `Date` of an `<input type="date">`'s value, at local midnight of that day; `null` for an empty field. */
export function fromDateInputValue(text: string): Date | null {
    const match = DAY.exec(text);

    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}
