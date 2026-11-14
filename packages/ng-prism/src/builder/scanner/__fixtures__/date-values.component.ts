import { Component, input, model } from '@angular/core';

function Showcase(config: unknown): ClassDecorator {
    return () => {};
}

const RELEASE = new Date(2026, 3, 28);

@Showcase({
    title: 'Date values',
    variants: [
        { name: 'Local', inputs: { value: new Date(2026, 3, 28) } },
        { name: 'UTC string', inputs: { value: new Date('2026-04-28') } },
        { name: 'Timestamp', inputs: { value: new Date(1777334400000) } },
        { name: 'Constant', inputs: { value: RELEASE, min: RELEASE } },
        { name: 'Now', inputs: { value: new Date() } }
    ]
})
@Component({ selector: 'date-values', standalone: true, template: '' })
export class DateValuesComponent {
    value = model<Date | null>(null);
    min = input<Date | null>(null);
}
