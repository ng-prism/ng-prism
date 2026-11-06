import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RuntimeComponent } from '../../plugin/plugin.types.js';
import { PrismSimPillComponent } from '../canvas/prism-sim-pill.component.js';
import { PrismOverviewCellComponent } from './prism-overview-cell.component.js';
import { PrismOverviewMatrixComponent } from './prism-overview-matrix.component.js';

/**
 * All variants of one component at once: a contact sheet rather than a
 * viewfinder.
 *
 * No controls of any kind: columns follow the window, and
 * everything else a cell shows is what the variant itself declared.
 *
 * A component that declares `states` gets the matrix instead, variants against
 * states. Without states the sheet stays what it was.
 *
 * What the canvas simulates shows in one pill above either, since every cell
 * is drawn under it.
 */
@Component({
    selector: 'prism-overview',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismOverviewCellComponent, PrismOverviewMatrixComponent, PrismSimPillComponent],
    host: {
        // Hands the panel's height down to the matrix, which scrolls on its own.
        '[attr.data-matrix]': "hasStates() ? '' : null"
    },
    templateUrl: './prism-overview.component.html',
    styleUrl: './prism-overview.component.css'
})
export class PrismOverviewComponent {
    /** Input name fixed by `prism-view-panel-host`, which feeds every view panel. */
    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected readonly variants = computed(() => this.activeComponent()?.meta.showcaseConfig.variants ?? []);

    protected readonly hasStates = computed(() => (this.activeComponent()?.meta.showcaseConfig.states?.length ?? 0) > 0);
}
