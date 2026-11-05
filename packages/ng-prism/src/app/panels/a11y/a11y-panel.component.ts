import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { RuntimeComponent } from '../../../plugin/plugin.types.js';
import { PrismPanelToolbarComponent } from '../../shared/prism-panel-toolbar.component.js';
import { type PrismTabItem, PrismTabsComponent } from '../../shared/prism-tabs.component.js';
import { a11yViolationBadge, normalizePanelBadge } from '../panel-host/panel-badge.js';
import { A11yAuditService } from './a11y-audit.service.js';
import { A11yKeyboardComponent } from './a11y-keyboard.component.js';
import { A11yPanelStateService } from './a11y-panel-state.service.js';
import { A11ySrComponent } from './a11y-sr.component.js';
import { A11yTreeComponent } from './a11y-tree.component.js';
import { A11yViolationsComponent } from './a11y-violations.component.js';
import type { A11yCoreConfig } from './a11y.types.js';

@Component({
    selector: 'prism-a11y-panel',
    standalone: true,
    imports: [A11yViolationsComponent, A11yKeyboardComponent, A11yTreeComponent, A11ySrComponent, PrismPanelToolbarComponent, PrismTabsComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './a11y-panel.component.html',
    styleUrl: './a11y-panel.component.css'
})
export class A11yPanelComponent {
    private readonly auditService = inject(A11yAuditService);
    protected readonly state = inject(A11yPanelStateService);

    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected readonly disabled = computed(() => {
        const comp = this.activeComponent();
        const config = comp?.meta.showcaseConfig.meta?.['a11y'] as A11yCoreConfig | undefined;

        return config?.disable === true;
    });

    /** The sub-tabs; Violations carries the same open-findings badge as the panel's own tab. */
    protected readonly tabs = computed<PrismTabItem[]>(() => [
        { id: 'violations', label: 'Violations', badge: normalizePanelBadge(a11yViolationBadge(this.auditService.scoreResult(), this.auditService.condition())) },
        { id: 'keyboard', label: 'Keyboard' },
        { id: 'tree', label: 'ARIA Tree' },
        { id: 'sr', label: 'Screen Reader' }
    ]);

    protected selectTab(id: string | null): void {
        if (id === 'violations' || id === 'keyboard' || id === 'tree' || id === 'sr') this.state.activeTab.set(id);
    }
}
