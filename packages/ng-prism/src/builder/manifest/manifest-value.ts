import { StaticDate } from '../scanner/static-date.js';

export function json(value: unknown): string {
    return JSON.stringify(value);
}

export function indent(depth: number): string {
    return ' '.repeat(depth);
}

/** `'aria-label'` and content slots like `'[card-header]'` are only valid keys in quotes. */
export function formatKey(key: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * `new Date(…)` with the arguments of a {@link StaticDate}, as the source wrote them. The manifest is a module the
 * styleguide's build compiles, so the browser makes the `Date` when it loads, in its own time zone, as the source does.
 * Any other `Date`, such as one a plugin made, by its time.
 */
function dateExpression(date: Date): string {
    if (date instanceof StaticDate) return `new Date(${date.args.map((arg) => JSON.stringify(arg)).join(', ')})`;

    const time = date.getTime();

    return `new Date(${Number.isNaN(time) ? 'NaN' : time})`;
}

/** A value on lines of its own, indented from `baseIndent`: objects and arrays one entry per line. */
export function formatValue(value: unknown, baseIndent: number): string {
    if (value instanceof Date) return dateExpression(value);
    if (Array.isArray(value)) return formatArray(value, baseIndent);
    if (typeof value === 'object' && value !== null) return formatObject(value as Record<string, unknown>, baseIndent);
    return json(value);
}

export function formatObject(obj: Record<string, unknown>, baseIndent: number): string {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);

    if (entries.length === 0) return '{}';

    const inner = baseIndent + 2;
    const lines = entries.map(([key, value]) => `${indent(inner)}${formatKey(key)}: ${formatValue(value, inner)},`);

    return `{\n${lines.join('\n')}\n${indent(baseIndent)}}`;
}

export function formatArray(arr: unknown[], baseIndent: number): string {
    if (arr.length === 0) return '[]';

    const inner = baseIndent + 2;
    const items = arr.map((item) => `${indent(inner)}${formatValue(item, inner)},`);

    return `[\n${items.join('\n')}\n${indent(baseIndent)}]`;
}

/** A value on one line, for a member declaration: JSON, with each `Date` as the expression that makes it. */
export function inlineValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value instanceof Date) return dateExpression(value);
    if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? 'null' : inlineValue(item))).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value).filter(([, v]) => v !== undefined);

        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${inlineValue(item)}`).join(',')}}`;
    }
    return json(value);
}
