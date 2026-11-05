import { ChangeDetectionStrategy, Component, input, output, ViewEncapsulation } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/**
 * Surface that groups a title, a short text and an optional image.
 *
 * ## Modes
 *
 * - **Elevated** (default): a soft shadow lifts the card off the page
 * - **Outlined**: `[elevated]="false"` swaps the shadow for a border
 * - **Clickable**: `clickable` adds a hover style, a pointer cursor and the `clicked` output
 *
 * A clickable card listens for clicks on its host element. It is not a button, so keyboard users
 * still need a real link or button inside it.
 *
 * ## Dark scheme
 *
 * The card follows a dark scheme in the three ways libraries usually do, one per part:
 *
 * - **Surface:** the library token `--tl-card-bg` from `styles/tokens.css`, which switches on `:root` under
 *   `@media (prefers-color-scheme: dark)`
 * - **Text and border:** `light-dark()`, which follows the `color-scheme` the card inherits or is given
 * - **Image placeholder:** a theme class, `:host-context(.tl-dark)`, that an app sets on the card or an ancestor
 *
 * The shadow of an elevated card deepens in a `prefers-color-scheme` query nested in its rule.
 *
 * @since 1.0.0
 * @example
 * ```html
 * <sg-card title="Quarterly report" subtitle="Updated 2 hours ago" />
 * ```
 * @example
 * ```html
 * <sg-card
 *   title="Open project"
 *   subtitle="Last edited by Jane"
 *   [clickable]="true"
 *   (clicked)="open()" />
 * ```
 */
@Showcase({
    title: 'Card',
    status: 'stable',
    category: 'Layout',
    description: 'Content card with optional title, subtitle, image placeholder, and interactive state.',
    // The hover style hangs off .sg-card--clickable, which only clickable cards carry.
    states: [{ name: 'Hover', pseudo: { hover: '.sg-card--clickable' } }],
    variants: [
        { name: 'Basic', inputs: { title: 'Card Title', subtitle: 'A brief description of the content.' } },
        { name: 'With Image', inputs: { title: 'Featured', subtitle: 'Image card variant.', showImage: true } },
        { name: 'Clickable', inputs: { title: 'Interactive Card', subtitle: 'Click me.', clickable: true } },
        { name: 'Elevated', inputs: { title: 'Elevated Card', subtitle: 'With shadow.', elevated: true } },
        { name: 'Outlined', inputs: { title: 'Outlined', subtitle: 'Border only.', elevated: false } }
    ],
    tags: ['layout', 'card', 'container', 'surface']
})
@Component({
    selector: 'sg-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    // Emulated, unlike the other components of test-lib: :host-context() needs it.
    encapsulation: ViewEncapsulation.Emulated,
    host: {
        class: 'sg-card',
        '[class.sg-card--clickable]': 'clickable()',
        '[class.sg-card--elevated]': 'elevated()',
        '(click)': 'onClick()'
    },
    template: `
        @if (showImage()) {
            <div class="sg-card__image">
                <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect class="sg-card__image-ground" width="400" height="200" />
                    <path class="sg-card__image-shape" d="M170 110l30-40 30 40z" />
                    <circle class="sg-card__image-shape" cx="180" cy="80" r="12" />
                </svg>
            </div>
        }
        <div class="sg-card__body">
            @if (title()) {
                <h3 class="sg-card__title">{{ title() }}</h3>
            }
            @if (subtitle()) {
                <p class="sg-card__subtitle">{{ subtitle() }}</p>
            }
        </div>
    `,
    styles: `
        :host {
            display: block;
            overflow: hidden;
            max-width: 320px;
            border: 1px solid light-dark(#e5e7eb, #374151);
            border-radius: 12px;
            background: var(--tl-card-bg, #fff);
            transition: box-shadow 0.2s;
            color-scheme: light dark;
        }
        :host(.sg-card--elevated) {
            border-color: transparent;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

            @media (prefers-color-scheme: dark) {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            }
        }
        :host(.sg-card--clickable) {
            cursor: pointer;
        }
        :host(.sg-card--clickable:hover) {
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        }
        .sg-card__image {
            svg {
                display: block;
                width: 100%;
                height: auto;
            }
        }
        .sg-card__image-ground {
            fill: #e5e7eb;
        }
        .sg-card__image-shape {
            fill: #9ca3af;
        }
        :host-context(.tl-dark) .sg-card__image-ground {
            fill: #374151;
        }
        :host-context(.tl-dark) .sg-card__image-shape {
            fill: #6b7280;
        }
        .sg-card__body {
            padding: 16px;
        }
        .sg-card__title {
            margin: 0 0 4px;
            font-size: 16px;
            font-weight: 600;
            color: light-dark(#111827, #f9fafb);
        }
        .sg-card__subtitle {
            margin: 0;
            font-size: 13px;
            color: light-dark(#6b7280, #9ca3af);
            line-height: 1.5;
        }
    `
})
export class CardComponent {
    /** Makes the whole card react to clicks: hover style, pointer cursor and the `clicked` output. */
    readonly clickable = input<boolean>(false);

    /** Lifts the card with a shadow. `false` draws a border instead. */
    readonly elevated = input<boolean>(true);

    /** Adds an image area above the text, filled with a placeholder graphic. */
    readonly showImage = input<boolean>(false);

    /** Short text below the title. Left out when empty. */
    readonly subtitle = input<string>('');

    /** Heading of the card. Left out when empty. */
    readonly title = input<string>('');

    /** Emits when a `clickable` card is clicked. Never emits otherwise. */
    readonly clicked = output<void>();

    /** Handles a click on the host and emits `clicked` while the card is `clickable`. */
    onClick(): void {
        if (this.clickable()) {
            this.clicked.emit();
        }
    }
}
