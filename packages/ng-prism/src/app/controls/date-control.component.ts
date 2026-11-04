import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { InputMeta } from '../../plugin/plugin.types.js';
import { PrismThemeService } from '../services/prism-theme.service.js';
import { fromDateInputValue, toDateInputValue } from './date-input-value.js';

/**
 * A native `<input type="date">` for a `'date'` input. It shows the local day of the value and writes local midnight
 * of the day picked; an emptied field writes what `emptyValue` allows and, where it allows nothing, keeps the date.
 */
@Component({
    selector: 'prism-date-control',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './date-control.component.html',
    styleUrl: './date-control.component.css'
})
export class DateControlComponent {
    readonly value = input<unknown>(null);
    readonly emptyValue = input<InputMeta['emptyValue']>(undefined);
    readonly valueChange = output<Date | null | undefined>();

    private readonly theme = inject(PrismThemeService);

    /** The browser draws the calendar of the field, so it is told the theme. */
    protected readonly colorScheme = computed(() => (this.theme.isDark() ? 'dark' : 'light'));
    protected readonly text = computed(() => toDateInputValue(this.value()));

    protected onChange(field: HTMLInputElement): void {
        const date = fromDateInputValue(field.value);
        const empty = this.emptyValue();

        // A part of the day cleared by the keyboard: the field reads empty, but nobody emptied it.
        if (!date && field.validity.badInput) return;

        if (date) this.valueChange.emit(date);
        else if (empty) this.valueChange.emit(empty === 'null' ? null : undefined);
        // A date that cannot be emptied: the field shows it again.
        else field.value = this.text();
    }
}
