import { Component, input, output } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/** An on/off switch with a visible label. */
@Showcase({
    title: 'Toggle',
    category: 'Inputs',
    variants: [
        { name: 'Off', inputs: { label: 'Notifications' } },
        { name: 'On', inputs: { label: 'Notifications', checked: true } }
    ]
})
@Component({
    selector: 'ui-toggle',
    template: `
        <label class="toggle">
            <input type="checkbox" role="switch" [checked]="checked()" (change)="changed.emit(!checked())" />
            <span class="track"><span class="thumb"></span></span>
            {{ label() }}
        </label>
    `,
    styles: `
        .toggle {
            display: inline-flex;
            gap: 10px;
            align-items: center;
            font:
                500 14px/1 Inter,
                system-ui,
                sans-serif;
            color: #f1f5f9;
            cursor: pointer;
        }

        input {
            position: absolute;
            opacity: 0;
        }

        .track {
            position: relative;
            width: 36px;
            height: 20px;
            background: #334155;
            border-radius: 999px;
            transition: background 120ms ease;
        }

        .thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            transition: transform 120ms ease;
        }

        input:checked + .track {
            background: #0ea5e9;
        }

        input:checked + .track .thumb {
            transform: translateX(16px);
        }

        input:focus-visible + .track {
            outline: 2px solid #60a5fa;
            outline-offset: 2px;
        }
    `
})
export class ToggleComponent {
    readonly label = input('Toggle');
    readonly checked = input(false);
    readonly changed = output<boolean>();
}
