import { Component, computed, input } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** A day as a calendar tile: month and year, the day, the weekday. */
@Showcase({
    title: 'Date',
    category: 'Data Display',
    variants: [
        { name: 'Empty' },
        {
            name: 'With value',
            inputs: { value: new Date('2026-04-28T00:00') }
        }
    ]
})
@Component({
    selector: 'ui-date',
    template: `
        <time class="date" [attr.datetime]="iso()">
            @if (value()) {
                <span class="month">{{ month() }}</span>
                <span class="day">{{ day() }}</span>
                <span class="weekday">{{ weekday() }}</span>
            } @else {
                <span class="none">No date</span>
            }
        </time>
    `,
    styles: `
        .date {
            display: grid;
            gap: 2px;
            place-items: center;
            align-content: center;
            width: 148px;
            height: 148px;
            font-family: Inter, system-ui, sans-serif;
            color: #f1f5f9;
            background: #111827;
            border: 1px solid #1f2b3e;
            border-radius: 14px;
        }

        .month {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.08em;
            color: #38bdf8;
            text-transform: uppercase;
        }

        .day {
            font-size: 52px;
            font-weight: 700;
            line-height: 1.05;
        }

        .weekday,
        .none {
            font-size: 13px;
            color: #94a3b8;
        }
    `
})
export class DateComponent {
    readonly value = input<Date | null>(null);

    protected readonly iso = computed(() => {
        const value = this.value();

        return value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : null;
    });
    protected readonly month = computed(() => this.value()?.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    protected readonly day = computed(() => this.value()?.getDate());
    protected readonly weekday = computed(() => this.value()?.toLocaleDateString('en-GB', { weekday: 'long' }));
}
