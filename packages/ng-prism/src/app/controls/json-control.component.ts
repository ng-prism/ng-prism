import { ChangeDetectionStrategy, Component, computed, ElementRef, input, linkedSignal, output, viewChild } from '@angular/core';
import { toLocalIsoString } from '../../shared/date-value.js';

export function highlightJson(json: unknown): string {
    if (typeof json !== 'string') return '';
    return json.replace(
        /("(?:\\.|[^"\\])*")\s*(:)|("(?:\\.|[^"\\])*")|(true|false)|(null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
        (match, key, colon, str, bool, nil, num) => {
            if (key && colon) return `<span class="jh-key">${key}</span>${colon}`;
            if (str) return `<span class="jh-string">${str}</span>`;
            if (bool) return `<span class="jh-bool">${bool}</span>`;
            if (nil) return `<span class="jh-null">${nil}</span>`;
            if (num) return `<span class="jh-number">${num}</span>`;
            return match;
        }
    );
}

/** A `Date` as local time with its offset: `toISOString()`, which `JSON.stringify` calls, would show the day of UTC. */
function localDates(this: Record<string, unknown>, key: string, value: unknown): unknown {
    const raw = this[key];

    if (!(raw instanceof Date)) return value;
    return Number.isNaN(raw.getTime()) ? null : toLocalIsoString(raw);
}

export function stringifyForJsonControl(val: unknown): string {
    try {
        const serialized = JSON.stringify(val, localDates, 2);

        // JSON.stringify returns `undefined` (the value, not a string) for
        // `undefined`, functions, and symbols. Surface that as visible text so the
        // textarea + highlighter never see a non-string.
        return serialized ?? 'undefined';
    } catch {
        return String(val);
    }
}

/**
 * The value of the control's text, as `JSON.parse` reads it, which throws for text that is no JSON. JSON has no dates:
 * a string where `previous` holds a `Date` becomes a `Date` again when it reads as one, so an edit elsewhere in the
 * value does not turn the date into text.
 */
export function parseForJsonControl(raw: string, previous: unknown): unknown {
    return reviveDates(JSON.parse(raw), previous);
}

/**
 * A day, optionally with a time and an offset, as the control writes a `Date`: only text in this form becomes a `Date`
 * again, since `new Date()` also reads text such as `'Room 12'` or `'5'` as a day.
 */
const ISO_DATE = /^[+-]?\d{4,6}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function reviveDates(value: unknown, previous: unknown): unknown {
    if (previous instanceof Date) {
        const date = typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : undefined;

        return date && !Number.isNaN(date.getTime()) ? date : value;
    }
    if (Array.isArray(value) && Array.isArray(previous)) return value.map((item, index) => reviveDates(item, previous[index]));
    if (isRecord(value) && isRecord(previous)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveDates(item, Object.hasOwn(previous, key) ? previous[key] : undefined)]));
    }
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What the control keeps while someone types: the text, the value the edit started from, and what it emitted last. */
export interface JsonEdit {
    text: string;
    /** Where its Dates were decides where a string becomes a `Date` again, whatever the keystrokes in between emitted. */
    base: unknown;
    emitted: unknown;
    /** The text does not parse, so it emitted nothing. */
    error: boolean;
}

/** One keystroke on `edit`, `null` when it starts one on `value`: the edit after it, and the value to emit unless the text does not parse. */
export function applyJsonEdit(edit: JsonEdit | null, raw: string, value: unknown): { edit: JsonEdit; parsed?: unknown; error: boolean } {
    const base = edit ? edit.base : value;

    try {
        const parsed = parseForJsonControl(raw, base);

        return { edit: { text: raw, base, emitted: parsed, error: false }, parsed, error: false };
    } catch {
        return { edit: { text: raw, base, emitted: edit ? edit.emitted : value, error: true }, error: true };
    }
}

/**
 * The edit once `value` comes in: kept while it is what the edit emitted, gone for a value from elsewhere, such as Reset,
 * another variant or a `model()` the component set, so that the control shows that value. `replaced` says the inputs of
 * a variant replaced the values, which ends the edit also where they hand back the value it emitted.
 */
export function followJsonValue(edit: JsonEdit | null, value: unknown, replaced = false): JsonEdit | null {
    return edit && !replaced && edit.emitted === value ? edit : null;
}

@Component({
    selector: 'prism-json-control',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './json-control.component.html',
    styleUrl: './json-control.component.css'
})
export class JsonControlComponent {
    readonly value = input<unknown>(null);
    readonly label = input('');
    readonly typeName = input('');
    /** `PrismRendererService.variantApplied`: a change ends the edit, also where the value stays the same. */
    readonly variantApplied = input(0);
    readonly valueChange = output<unknown>();

    private readonly edit = linkedSignal<{ value: unknown; variantApplied: number }, JsonEdit | null>({
        source: () => ({ value: this.value(), variantApplied: this.variantApplied() }),
        computation: ({ value, variantApplied }, previous) =>
            followJsonValue(previous?.value ?? null, value, previous !== undefined && previous.source.variantApplied !== variantApplied)
    });
    readonly parseError = computed(() => this.edit()?.error ?? false);

    private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');
    private readonly preEl = viewChild<ElementRef<HTMLPreElement>>('preEl');

    readonly displayText = computed(() => this.edit()?.text ?? stringifyForJsonControl(this.value()));

    readonly highlightedHtml = computed(() => highlightJson(this.displayText()));

    onInput(raw: string): void {
        const { edit, parsed, error } = applyJsonEdit(this.edit(), raw, this.value());

        this.edit.set(edit);
        if (!error) this.valueChange.emit(parsed);
    }

    syncScroll(): void {
        const textarea = this.textareaEl()?.nativeElement;
        const pre = this.preEl()?.nativeElement;

        if (textarea && pre) {
            pre.scrollTop = textarea.scrollTop;
            pre.scrollLeft = textarea.scrollLeft;
        }
    }
}
