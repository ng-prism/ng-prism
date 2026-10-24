import { Component, input } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** A short count or status next to a label. */
@Showcase({
    title: 'Badge',
    category: 'Data Display',
    variants: [
        { name: 'Count', inputs: { value: '3' } },
        { name: 'New', inputs: { value: 'New', tone: 'accent' } }
    ]
})
@Component({
    selector: 'ui-badge',
    template: `<span class="badge" [class.badge--accent]="tone() === 'accent'">{{ value() }}</span>`,
    styles: `
        .badge {
            display: inline-block;
            padding: 3px 8px;
            font:
                600 12px/1 Inter,
                system-ui,
                sans-serif;
            color: #f1f5f9;
            background: #1a2335;
            border-radius: 999px;
        }

        .badge--accent {
            color: #fff;
            background: #7c3aed;
        }
    `
})
export class BadgeComponent {
    readonly value = input('0');
    readonly tone = input<'neutral' | 'accent'>('neutral');
}
