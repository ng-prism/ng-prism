import { Component, input, output } from '@angular/core';
import { Showcase } from '@ng-prism/core';

@Showcase({
    title: 'Button',
    category: 'Inputs',
    variants: [
        { name: 'Primary', inputs: { label: 'Save' } },
        { name: 'Ghost', inputs: { label: 'Save', variant: 'ghost' } }
    ],
    states: [
        { name: 'Hover', pseudo: { hover: '.btn' } },
        { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } },
        { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } }
    ]
})
@Component({
    selector: 'ui-button',
    templateUrl: './button.component.html',
    styleUrl: './button.component.css'
})
export class ButtonComponent {
    readonly label = input('Button');
    readonly variant = input<'primary' | 'ghost'>('primary');
    readonly clicked = output<void>();
}
