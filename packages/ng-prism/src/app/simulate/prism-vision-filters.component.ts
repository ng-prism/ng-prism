import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VISION_MATRICES, visionFilterId, type VisionMatrix } from './vision-filters.js';

/**
 * The SVG filters that `filter: url(#prism-vision-…)` on the simulated canvas
 * refers to, rendered once in the shell: a reference finds its filter by `id` in
 * the document, so they have to be there for every scope element, the overview's
 * tiles included.
 *
 * Hidden the way an SVG of definitions has to be. `display: none` would take the
 * filters out with it in some engines, so it has no size and no place in the
 * layout instead.
 */
@Component({
    selector: 'prism-vision-filters',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { style: 'display: contents' },
    templateUrl: './prism-vision-filters.component.html'
})
export class PrismVisionFiltersComponent {
    protected readonly filters = (Object.keys(VISION_MATRICES) as VisionMatrix[]).map((matrix) => ({
        id: visionFilterId(matrix),
        values: VISION_MATRICES[matrix]
    }));
}
