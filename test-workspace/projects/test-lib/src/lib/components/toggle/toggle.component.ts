import { ChangeDetectionStrategy, Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/**
 * Switch for a setting that takes effect right away.
 *
 * Use it where flipping the switch applies the change on the spot, like turning notifications on.
 * In a form that is submitted later, a checkbox is the clearer choice.
 *
 * The track is a `<button role="switch">` with `aria-checked`, so it is reachable with the keyboard and announces its state.
 * `checked` is a model: bind it with `[(checked)]`, or listen to `changed`.
 *
 * In forced colors mode the browser replaces the fills of the track and the thumb with its own palette, so the track
 * gets an outline in `Highlight` and the thumb the text colour, which stand out in any palette.
 *
 * @since 1.0.0
 * @example
 * ```html
 * <sg-toggle label="Notifications" [(checked)]="notify" />
 * ```
 * @example
 * ```html
 * <sg-toggle label="Dark mode" [checked]="dark()" (changed)="setDark($event)" />
 * ```
 */
@Showcase({
    title: 'Toggle',
    status: 'stable',
    category: 'Inputs',
    description: 'Binary toggle switch with optional label and disabled state.',
    variants: [
        { name: 'Default Off', inputs: { checked: false, label: 'Notifications' } },
        { name: 'Default On', inputs: { checked: true, label: 'Dark Mode' } },
        { name: 'Disabled Off', inputs: { checked: false, label: 'Locked', disabled: true } },
        { name: 'Disabled On', inputs: { checked: true, label: 'Locked On', disabled: true } },
        { name: 'No Label', inputs: { checked: false } }
    ],
    tags: ['form', 'toggle', 'switch', 'input']
})
@Component({
    selector: 'sg-toggle',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        class: 'sg-toggle',
        '[class.sg-toggle--checked]': 'checked()',
        '[class.sg-toggle--disabled]': 'disabled()'
    },
    template: `
        <button class="sg-toggle__track" role="switch" [attr.aria-checked]="checked()" [disabled]="disabled()" (click)="toggle()">
            <span class="sg-toggle__thumb"></span>
        </button>
        @if (label()) {
            <span class="sg-toggle__label">{{ label() }}</span>
        }
    `,
    styles: `
        .sg-toggle {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }
        .sg-toggle--disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .sg-toggle__track {
            position: relative;
            width: 40px;
            height: 22px;
            border-radius: 11px;
            background: #d1d5db;
            border: none;
            cursor: inherit;
            padding: 0;
            transition: background 0.2s;
        }
        .sg-toggle--checked .sg-toggle__track {
            background: #6366f1;
        }
        .sg-toggle__thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #fff;
            transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .sg-toggle--checked .sg-toggle__thumb {
            transform: translateX(18px);
        }
        .sg-toggle__label {
            font-size: 14px;
            color: #374151;
            user-select: none;
        }
        @media (forced-colors: active) {
            .sg-toggle__track {
                outline: 2px solid Highlight;
                outline-offset: 1px;
            }
            .sg-toggle__thumb {
                background: CanvasText;
            }
        }
    `
})
export class ToggleComponent {
    /** Whether the switch is on. Two-way bindable with `[(checked)]`. */
    readonly checked = model<boolean>(false);

    /** Disables the switch and dims it. `toggle()` does nothing while it is set. */
    readonly disabled = input<boolean>(false);

    /** Text next to the switch. Left out when empty. */
    readonly label = input<string>('');

    /** Emits the new state when the switch is flipped, by a click or by `toggle()`. */
    readonly changed = output<boolean>();

    /** Flips the switch as a click would and emits `changed`. Ignored while `disabled`. */
    toggle(): void {
        if (this.disabled()) return;
        this.checked.set(!this.checked());
        this.changed.emit(this.checked());
    }
}
