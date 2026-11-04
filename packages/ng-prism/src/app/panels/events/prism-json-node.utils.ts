import { formatDateValue } from '../../../shared/date-value.js';

export type JsonNodeType = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'date' | 'object' | 'array';

/** How a node shows `val`: a `Date` is a value of its own, which as an object would show as `{}`. */
export function jsonNodeType(val: unknown): JsonNodeType {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (Array.isArray(val)) return 'array';
    if (val instanceof Date) return 'date';
    return typeof val as JsonNodeType;
}

export function summarizeValue(val: unknown, depth = 0, visited = new WeakSet<object>()): string {
    if (depth > 3) return '…';
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return formatDateValue(val);
    if (typeof val === 'object') {
        if (visited.has(val)) return '[Circular]';
        visited.add(val);
        if (Array.isArray(val)) {
            if (val.length === 0) return '[]';
            const items = val.slice(0, 3).map((item) => summarizeValue(item, depth + 1, visited));

            return val.length > 3 ? `[${items.join(', ')}, …]` : `[${items.join(', ')}]`;
        }
        const proto = Object.getPrototypeOf(val);

        if (proto !== Object.prototype && proto !== null) {
            const name = (val as { constructor?: { name?: string } }).constructor?.name;

            return name ? `[${name}]` : '[Object]';
        }
        try {
            const keys = Object.keys(val as object);

            if (keys.length === 0) return '{}';
            const obj = val as Record<string, unknown>;
            const pairs = keys.slice(0, 2).map((k) => `${k}: ${summarizeValue(obj[k], depth + 1, visited)}`);

            return keys.length > 2 ? `{${pairs.join(', ')}, …}` : `{${pairs.join(', ')}}`;
        } catch {
            return '[Object]';
        }
    }
    return String(val);
}

/**
 * True for an output that was emitted without a value (`emit()` on a void
 * output). The events log shows a muted dash for it instead of the word
 * "undefined", which reads like a bug in the component.
 */
export function isEmptyPayload(value: unknown): boolean {
    return value === undefined;
}
