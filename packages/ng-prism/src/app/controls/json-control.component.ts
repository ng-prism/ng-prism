import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
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

function reviveDates(value: unknown, previous: unknown): unknown {
    if (previous instanceof Date) {
        const date = typeof value === 'string' ? new Date(value) : undefined;

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
    readonly valueChange = output<unknown>();

    readonly parseError = signal(false);
    readonly localText = signal<string | null>(null);

    private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');
    private readonly preEl = viewChild<ElementRef<HTMLPreElement>>('preEl');

    readonly displayText = computed(() => {
        const local = this.localText();

        if (local !== null) return local;
        return stringifyForJsonControl(this.value());
    });

    readonly highlightedHtml = computed(() => highlightJson(this.displayText()));

    onInput(raw: string): void {
        this.localText.set(raw);
        try {
            const parsed = parseForJsonControl(raw, this.value());

            this.parseError.set(false);
            this.valueChange.emit(parsed);
        } catch {
            this.parseError.set(true);
        }
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
