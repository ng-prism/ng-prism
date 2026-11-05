import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrismIconComponent } from '../icons/prism-icon.component.js';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { joinLabels } from '../simulate/simulation.js';

/**
 * Says what the canvas simulates, so a screenshot or a glance at the stage
 * tells which environment the component is shown in. Renders nothing while
 * nothing is simulated, and in capture mode, where the service reports no
 * labels.
 *
 * Its reset ends the simulation only. The background override has a pill of its
 * own, `prism-canvas-bg-pill`, which sits above this one in the stage.
 *
 * It has no inputs and is laid out by whoever holds it: the stage stacks it
 * under the background pill, and the overview puts it above its sheet.
 */
@Component({
    selector: 'prism-sim-pill',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismIconComponent],
    templateUrl: './prism-sim-pill.component.html',
    styleUrl: './prism-sim-pill.component.css'
})
export class PrismSimPillComponent {
    private readonly simulation = inject(PrismSimulationService);

    protected readonly conditions = computed(() => joinLabels(this.simulation.labels()));

    protected reset(): void {
        this.simulation.reset();
    }
}
