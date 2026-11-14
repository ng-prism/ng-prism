import { ChangeDetectionStrategy, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** `YYYY-MM-DD` of the local day of `date`, the value a native date input takes; `''` without one. */
function dayOf(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';

    const pad = (part: number) => String(part).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Field for a single day, on a native `<input type="date">`.
 *
 * `value` is a model at local midnight of the day: bind it with `[(value)]`, or listen to `dateChange`, which emits only
 * when the user picks a day or empties the field. `min` and `max` limit the days the field offers. Content goes below
 * the field as a hint.
 *
 * Write the days as `new Date(2026, 3, 28)`, local midnight. `new Date('2026-04-28')` is midnight in UTC, which west of
 * UTC is still the 27th.
 *
 * @since 1.9.0
 * @example
 * ```html
 * <sg-date-field label="Start" [(value)]="start" [min]="firstDay" />
 * ```
 */
@Showcase<DateFieldComponent>({
    title: 'Date Field',
    category: 'Forms',
    description: 'A day on a native date input, with min and max. The variants set their days as Dates in the local form, new Date(2026, 3, 28).',
    bg: 'light',
    variants: [
        { name: 'Empty', inputs: { label: 'Start' } },
        { name: 'With value', inputs: { label: 'Start', value: new Date(2026, 3, 28) } },
        { name: 'Min and max', inputs: { label: 'Start', value: new Date(2026, 3, 28), min: new Date(2026, 3, 1), max: new Date(2026, 3, 30) } },
        { name: 'With hint', inputs: { label: 'Start', value: new Date(2026, 3, 28) }, template: '<span>Any day in April</span>' }
    ],
    tags: ['form', 'date', 'input']
})
@Component({
    selector: 'sg-date-field',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'sg-date-field' },
    template: `
        <label class="sg-date-field__label">
            {{ label() }}
            <input type="date" class="sg-date-field__input" [value]="day()" [min]="minDay()" [max]="maxDay()" (change)="pick($any($event.target).value)" />
        </label>
        <p class="sg-date-field__picked">{{ picked() }}</p>
        <div class="sg-date-field__hint"><ng-content /></div>
    `,
    styles: `
        .sg-date-field {
            display: inline-flex;
            flex-direction: column;
            gap: 4px;
            font-size: 14px;
            color: #374151;
        }
        .sg-date-field__label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-weight: 500;
        }
        .sg-date-field__input {
            height: 34px;
            padding: 0 10px;
            font: inherit;
            font-weight: 400;
            color: #111827;
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
        }
        .sg-date-field__picked {
            margin: 0;
            font-size: 12px;
            color: #6b7280;
        }
        .sg-date-field__hint:empty {
            display: none;
        }
        .sg-date-field__hint {
            font-size: 12px;
            color: #6b7280;
        }
    `
})
export class DateFieldComponent {
    /** The day, at local midnight, or `null` for none. Two-way bindable with `[(value)]`. */
    readonly value = model<Date | null>(null);

    /** The earliest day the field offers. */
    readonly min = input<Date | null>(null);

    /** The latest day the field offers. */
    readonly max = input<Date | null>(null);

    /** Text above the field. */
    readonly label = input<string>('');

    /** Emits the day the user picked, or `null` when they emptied the field. */
    readonly dateChange = output<Date | null>();

    protected readonly day = computed(() => dayOf(this.value()));
    protected readonly minDay = computed(() => dayOf(this.min()));
    protected readonly maxDay = computed(() => dayOf(this.max()));
    protected readonly picked = computed(() => {
        const value = this.value();

        return value ? value.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'No day picked';
    });

    protected pick(text: string): void {
        const [year, month, day] = text.split('-').map(Number);
        const date = text ? new Date(year, month - 1, day) : null;

        this.value.set(date);
        this.dateChange.emit(date);
    }
}
