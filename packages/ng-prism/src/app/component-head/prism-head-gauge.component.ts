import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toneForStatus } from '../shared/badge.types.js';
import { PrismBadgeComponent } from '../shared/prism-badge.component.js';
import { chipMarker, chipTitle, gaugeChip, type HeadMetric } from './head-metrics.js';
import { PrismStatComponent } from './prism-stat.component.js';

/**
 * Measurement disclosure for the component head, right behind the status.
 *
 * One soft badge in the tone of the worst metric ("VRT diff 10.26%"), or of the
 * first measured one when everything is fine. How many metrics were measured
 * is in the tooltip, not on the chip. The readout behind it lists every metric
 * with its threshold.
 */
@Component({
    selector: 'prism-head-gauge',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgTemplateOutlet, PrismBadgeComponent, PrismStatComponent],
    templateUrl: './prism-head-gauge.component.html',
    styleUrl: './prism-head-gauge.component.css'
})
export class PrismHeadGaugeComponent {
    readonly metrics = input.required<readonly HeadMetric[]>();
    /** Only the readout's rows, without the chip and its popover: how a compact head shows the metrics inside the ⓘ card. */
    readonly inline = input(false, { transform: booleanAttribute });
    protected readonly chip = computed(() => gaugeChip(this.metrics()));
    protected readonly tone = computed(() => {
        const chip = this.chip();

        return chip ? toneForStatus(chip.variant) : 'neutral';
    });
    protected readonly marker = computed(() => {
        const chip = this.chip();

        return chip ? chipMarker(chip) : null;
    });
    protected readonly title = computed(() => {
        const chip = this.chip();

        return chip ? chipTitle(chip) : '';
    });
}
