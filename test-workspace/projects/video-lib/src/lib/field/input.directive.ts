import { Directive, inject } from '@angular/core';
import { FieldComponent } from './field.component';

/** A native `<input>` inside a `ui-field`. It reads the field around it and turns red while the field shows an error. */
@Directive({
    selector: 'input[uiInput]',
    host: {
        class: 'ui-input',
        '[class.ui-input--invalid]': 'invalid()',
        '[attr.aria-invalid]': 'invalid()'
    }
})
export class InputDirective {
    private readonly field = inject(FieldComponent, { optional: true });

    protected invalid(): boolean {
        return !!this.field?.error();
    }
}
