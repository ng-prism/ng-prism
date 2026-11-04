import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { ControlDefinition, InputMeta, RuntimeComponent } from '../../../plugin/plugin.types.js';
import { BooleanControlComponent } from '../../controls/boolean-control.component.js';
import { DateControlComponent } from '../../controls/date-control.component.js';
import { JsonControlComponent } from '../../controls/json-control.component.js';
import { NumberControlComponent } from '../../controls/number-control.component.js';
import { StringControlComponent } from '../../controls/string-control.component.js';
import { UnionControlComponent } from '../../controls/union-control.component.js';
import { PrismNavigationService } from '../../services/prism-navigation.service.js';
import { PrismPluginService } from '../../services/prism-plugin.service.js';
import { PrismRendererService } from '../../services/prism-renderer.service.js';
import { PrismButtonComponent } from '../../shared/prism-button.component.js';
import { PrismPanelToolbarComponent } from '../../shared/prism-panel-toolbar.component.js';
import { nonEditableReason } from './non-editable-input-types.js';

@Component({
    selector: 'prism-controls-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgComponentOutlet,
        BooleanControlComponent,
        StringControlComponent,
        NumberControlComponent,
        UnionControlComponent,
        DateControlComponent,
        JsonControlComponent,
        PrismPanelToolbarComponent,
        PrismButtonComponent
    ],
    templateUrl: './prism-controls-panel.component.html',
    styleUrl: './prism-controls-panel.component.css'
})
export class PrismControlsPanelComponent {
    protected readonly navigationService = inject(PrismNavigationService);
    protected readonly rendererService = inject(PrismRendererService);
    private readonly pluginService = inject(PrismPluginService);

    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected getCustomControl(input: InputMeta): ControlDefinition | null {
        return this.pluginService.controls().find((ctrl) => ctrl.matchType(input)) ?? null;
    }

    /** Why `input` cannot be edited in the active variant, `null` when it can. */
    protected notEditableReason(input: InputMeta, comp: RuntimeComponent): string | null {
        return nonEditableReason(input, comp, this.rendererService.activeVariantIndex());
    }

    protected asBoolean(val: unknown): boolean {
        return Boolean(val);
    }

    protected asNumber(val: unknown): number {
        return Number(val) || 0;
    }

    protected asString(val: unknown): string {
        return String(val ?? '');
    }
}
