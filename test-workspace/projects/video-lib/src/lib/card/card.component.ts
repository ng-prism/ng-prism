import { Component, input } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** A surface that groups a heading and a short text. */
@Showcase({
    title: 'Card',
    category: 'Layout',
    variants: [{ name: 'Default', inputs: { heading: 'Release notes', text: 'What changed in this version.' } }]
})
@Component({
    selector: 'ui-card',
    template: `
        <article class="card">
            <h3>{{ heading() }}</h3>
            <p>{{ text() }}</p>
        </article>
    `,
    styles: `
        .card {
            width: 280px;
            padding: 18px 20px;
            font-family: Inter, system-ui, sans-serif;
            color: #f1f5f9;
            background: #111827;
            border: 1px solid #1f2b3e;
            border-radius: 12px;
        }

        h3 {
            margin: 0 0 6px;
            font-size: 15px;
            font-weight: 600;
        }

        p {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            color: #cbd5e1;
        }
    `
})
export class CardComponent {
    readonly heading = input('Heading');
    readonly text = input('');
}
