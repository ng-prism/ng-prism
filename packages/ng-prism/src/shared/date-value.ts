function pad(value: number, length = 2): string {
    return String(Math.abs(value)).padStart(length, '0');
}

/** A year as ISO 8601 and `toISOString()` write it: four digits from 0 to 9999, else a sign and six. `new Date()` reads no other form back. */
function isoYear(year: number): string {
    return year >= 0 && year <= 9999 ? pad(year, 4) : `${year < 0 ? '-' : '+'}${pad(year, 6)}`;
}

/** The local day of `date`, as `2026-04-28`, its year in the form of {@link isoYear}. */
export function localDay(date: Date): string {
    return `${isoYear(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A `Date` as the styleguide shows it, in the local time of the viewer: the day alone at local midnight, as
 * `2026-04-28`, else with the time, as `2026-04-28 14:30`, and seconds and milliseconds only when there are some.
 * Since 22.8.0.
 */
export function formatDateValue(date: Date): string {
    if (Number.isNaN(date.getTime())) return 'Invalid Date';

    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    const day = localDay(date);

    if (date.getHours() === 0 && date.getMinutes() === 0 && seconds === 0 && milliseconds === 0) return day;

    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (milliseconds !== 0) return `${day} ${time}:${pad(seconds)}.${pad(milliseconds, 3)}`;
    return seconds !== 0 ? `${day} ${time}:${pad(seconds)}` : `${day} ${time}`;
}

/**
 * A `Date` as ISO 8601 in local time with the offset of the zone, `2026-04-28T00:00:00.000+02:00`: the day reads as
 * the viewer's, unlike `toISOString()` in UTC, and `new Date()` reads the text back as the same time. Since 22.8.0.
 */
export function toLocalIsoString(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const sign = offset < 0 ? '-' : '+';
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

    return `${localDay(date)}T${time}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}
