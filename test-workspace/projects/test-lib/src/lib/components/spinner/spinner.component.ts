import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** Diameter of a spinner: `sm` 16px, `md` 24px, `lg` 36px. */
export type SpinnerSizeType = 'sm' | 'md' | 'lg';

/**
 * Circular loading indicator for a wait of unknown length.
 *
 * ## Sizes
 *
 * - `sm` (16px): inline, next to text or inside a button
 * - `md` (24px): inside cards and panels
 * - `lg` (36px): for a whole section or page
 *
 * The host carries `role="status"`. A `label` is shown next to the spinner and gives screen readers something to announce.
 *
 * Under `prefers-reduced-motion: reduce` the spinner turns three times slower instead of stopping: it still shows that
 * something is loading, with less movement.
 *
 * @since 1.0.0
 * @see ProgressBarComponent
 * @example
 * ```html
 * <sg-spinner size="sm" />
 * ```
 * @example
 * ```html
 * <sg-spinner size="lg" label="Loading projects" />
 * ```
 */
@Showcase({
    title: 'Spinner',
    status: 'wip',
    category: 'Feedback',
    description: 'Animated circular spinner for loading states in various sizes.',
    variants: [
        { name: 'Small', inputs: { size: 'sm' } },
        { name: 'Medium', inputs: { size: 'md' } },
        { name: 'Large', inputs: { size: 'lg' } },
        { name: 'With Label', inputs: { size: 'md', label: 'Loading...' } },
        { name: 'Custom Color', inputs: { size: 'md', color: '#ef4444' } }
    ],
    tags: ['feedback', 'spinner', 'loading', 'indicator']
})
@Component({
    selector: 'sg-spinner',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        class: 'sg-spinner',
        '[attr.data-size]': 'size()',
        '[attr.role]': '"status"'
    },
    template: `
        <svg class="sg-spinner__svg" viewBox="0 0 24 24" fill="none" [style.color]="color()">
            <circle class="sg-spinner__track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.2" />
            <path class="sg-spinner__arc" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        @if (label()) {
            <span class="sg-spinner__label">{{ label() }}</span>
        }
    `,
    styles: `
        .sg-spinner {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .sg-spinner__svg {
            animation: sg-spin 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
            .sg-spinner__svg {
                animation-duration: 2.4s;
            }
        }
        .sg-spinner[data-size='sm'] .sg-spinner__svg {
            width: 16px;
            height: 16px;
        }
        .sg-spinner[data-size='md'] .sg-spinner__svg {
            width: 24px;
            height: 24px;
        }
        .sg-spinner[data-size='lg'] .sg-spinner__svg {
            width: 36px;
            height: 36px;
        }
        .sg-spinner__label {
            font-size: 13px;
            color: #6b7280;
        }
        @keyframes sg-spin {
            to {
                transform: rotate(360deg);
            }
        }
    `
})
export class SpinnerComponent {
    /**
     * Colour of the arc, any CSS colour. The track is drawn in the same colour at 20% opacity.
     * @since 1.1.0
     */
    readonly color = input<string>('#6366f1');

    /** Text next to the spinner. Left out when empty. */
    readonly label = input<string>('');

    /** Diameter of the spinner, see {@link SpinnerSizeType}. */
    readonly size = input<SpinnerSizeType>('md');
}
