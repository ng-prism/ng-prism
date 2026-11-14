import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ShowcaseConfig {
    title: string;
    description?: string;
    category?: string;
    variants?: {
        name: string;
        inputs?: Record<string, unknown>;
        description?: string;
        meta?: Record<string, unknown>;
        bg?: 'dots' | 'plain' | 'light' | 'dark' | 'transparent';
    }[];
    tags?: string[];
    bg?: 'dots' | 'plain' | 'light' | 'dark' | 'transparent';
    status?: 'stable' | 'beta' | 'wip' | 'deprecated' | string;
}

function Showcase(config: ShowcaseConfig): ClassDecorator {
    return () => {};
}

@Showcase({
    title: 'Button',
    category: 'Inputs',
    description: 'A versatile button component',
    bg: 'dark',
    variants: [
        {
            name: 'Primary',
            inputs: { variant: 'primary', label: 'Click me' },
            bg: 'light',
            meta: { figma: 'https://www.figma.com/design/abc123/DS?node-id=12-34' }
        },
        { name: 'Danger', inputs: { variant: 'danger', disabled: true } }
    ],
    tags: ['form', 'action'],
    status: 'beta'
})
@Component({
    selector: 'my-button',
    standalone: true,
    template: `<button>{{ label }}</button>`
})
export class ButtonComponent {
    /** Visual appearance of the button */
    @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';

    /** Button label text */
    @Input() label = 'Button';

    /** Whether the button is disabled */
    @Input() disabled = false;

    /** Size of the button */
    @Input() size: number = 16;

    /** Items list */
    @Input() items: string[] = [];

    /** Click event */
    @Output() clicked = new EventEmitter<void>();

    /** Double click event */
    @Output() doubleClicked = new EventEmitter<MouseEvent>();
}
