import { Component, Input, input, model } from '@angular/core';

type MaybeDate = Date | null;

@Component({ selector: 'date-inputs', standalone: true, template: '' })
export class DateInputsComponent {
    a = input<Date>();
    r = input.required<Date>();
    b = input<Date | null>(null);
    c = input<Date | undefined>(undefined);
    @Input() d?: Date;
    e = input<MaybeDate>(null);
    f = input<Date | string>('x');
    g = input<{ at: Date }>();
    h = model<Date>(new Date(2026, 0, 1));
    i = model<Date>(new Date());
    j = input(new Date(2026, 0, 1));
}
