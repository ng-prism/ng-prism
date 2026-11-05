import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    Injector,
    input,
    output,
    reflectComponentType,
    signal,
    untracked,
    viewChild,
    ViewContainerRef
} from '@angular/core';
import type { RuntimeComponent } from '../../plugin/plugin.types.js';
import { PRISM_VARIANT_INPUT } from '../../shared/composition.js';
import type { ForcedPseudoStates } from '../../shared/pseudo-state.type.js';
import { declaredVariantBg } from '../../shared/variant-bg.js';
import { CANVAS_BG_STYLES } from '../canvas/canvas-bg.styles.js';
import type { StateFit } from '../pseudo/state-fit.js';
import { activeCase, renderTypeFor } from '../renderer/composition.js';
import { buildInputBindings } from '../renderer/input-bindings.js';
import { parseContentToNodes } from '../renderer/projectable-content.js';
import { PrismPanelService } from '../services/prism-panel.service.js';
import { PrismPseudoStateService } from '../services/prism-pseudo-state.service.js';
import { computeVariantState, PrismRendererService } from '../services/prism-renderer.service.js';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { overviewGround } from '../simulate/ground.js';
import { isPlaygroundCombination, openInPlayground, playgroundLabel } from './open-in-playground.js';

/**
 * One frame of the contact sheet: a stage painting the variant's declared
 * background, with the variant's own instance on it and a caption beneath.
 *
 * It shares none of the Playground's bookkeeping. Output
 * subscriptions, `renderedElement`, the `prism:render:*` marks, the renderer
 * hooks and `data-prism-rendered` all describe *one* rendered thing; n cells
 * writing to any of them would corrupt what they mean. `data-prism-rendered`
 * matters most: it is the selector external screenshot runners key on (see
 * `docs/guide/external-tooling.md`), and this component never emits it.
 *
 * Forced pseudo states are the variant's own, applied by a marker of the
 * cell's own, so a hovered cell never hovers its neighbour. The tools menu's
 * state toggle does not reach here: like every other control, it belongs to
 * the Playground.
 *
 * A cell can combine its variant with one of the component's `states` (the
 * matrix does). When the marker finds that the state does not fit the rendered
 * component, or the variant opted out with `states: false`, the cell shows the
 * a dash in place of the component, with the reason as its tooltip and in its
 * label. Every cell, with or without a state, opens its exact combination in
 * the Playground on click, Enter or Space, and the one the Playground shows is
 * outlined.
 */
@Component({
    selector: 'prism-overview-cell',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'listitem',
        tabindex: '0',
        '[attr.aria-label]': 'label()',
        '[attr.title]': 'unfitReason()',
        '[attr.data-matrix]': "mode() === 'matrix' ? '' : null",
        '[attr.data-current]': "current() ? '' : null",
        // In the matrix the grid spans are the matrix's own. A stretch variant still
        // fills its cell, so `canvasLayout` holds for the whole row.
        '[attr.data-wide]': "mode() === 'sheet' && stretches() ? '' : null",
        '[attr.data-stretch]': "mode() === 'matrix' && stretches() ? '' : null",
        '(click)': 'open()',
        '(keydown)': 'onKeydown($event)'
    },
    templateUrl: './prism-overview-cell.component.html',
    styleUrl: './prism-overview-cell.component.css',
    styles: [CANVAS_BG_STYLES]
})
export class PrismOverviewCellComponent {
    readonly component = input.required<RuntimeComponent>();
    readonly index = input.required<number>();
    /** Position of the component state in `ShowcaseConfig.states`, `null` for the variant alone. */
    readonly state = input<number | null>(null);
    /** `matrix` leaves the caption and the grid span to the matrix around the cell. */
    readonly mode = input<'sheet' | 'matrix'>('sheet');
    /** Whether the state fits the rendered variant. Only emitted while `state` is not `null`. */
    readonly fitChange = output<StateFit>();

    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);
    private readonly renderer = inject(PrismRendererService);
    private readonly panels = inject(PrismPanelService);
    private readonly simulation = inject(PrismSimulationService);
    private readonly pseudoMarker = inject(PrismPseudoStateService).createMarker();
    private readonly outlet = viewChild.required('outlet', {
        read: ViewContainerRef
    });

    /**
     * Never null: without a declaration, the emulated color scheme, or
     * `DEFAULT_VARIANT_BG`. Not `resolveVariantBg`, which the discovery manifest
     * reports and which must not depend on the session.
     */
    protected readonly bg = computed(() => overviewGround(declaredVariantBg(this.component().meta.showcaseConfig, this.index()), this.simulation.schemeGround()));

    protected readonly caption = computed(() => {
        const variant = this.component().meta.showcaseConfig.variants?.[this.index()];
        const number = String(this.index() + 1).padStart(2, '0');

        // Defensive, not reachable today: `Variant.name` is required
        // (decorator/showcase.types.ts) and `prism-overview` only ever creates a
        // cell for an index it just read out of that same `variants` array. A
        // bare `07` would only appear if those two facts stopped lining up, i.e. the
        // grid indexing past the array it iterates, or `name` becoming optional.
        return variant ? `${number} ${variant.name}` : number;
    });

    /** Why the state is not shown on this cell, `null` while the component is. */
    protected readonly unfitReason = signal<string | null>(null);

    protected readonly label = computed(() => {
        const config = this.component().meta.showcaseConfig;
        const variant = config.variants?.[this.index()]?.name ?? this.caption();
        const stateIndex = this.state();
        const state = stateIndex === null ? undefined : config.states?.[stateIndex];

        return playgroundLabel(variant, state?.name, this.unfitReason());
    });

    /** The combination the Playground shows right now. */
    protected readonly current = computed(() => {
        const optedOut = this.component().meta.showcaseConfig.variants?.[this.index()]?.states === false;

        return isPlaygroundCombination(this.renderer, this.index(), this.state(), optedOut);
    });

    protected readonly stretches = computed(() => {
        const config = this.component().meta.showcaseConfig;
        const variant = config.variants?.[this.index()];

        return (variant?.canvasLayout ?? config.canvasLayout ?? 'fit') === 'stretch';
    });

    constructor() {
        effect(() => {
            const component = this.component();
            const index = this.index();
            const state = this.state();

            untracked(() => {
                const fit = this.mount(component, index, state);

                // Outside `mount`'s try: a handler that throws is the parent's
                // doing, not a variant that failed to render.
                if (fit) this.fitChange.emit(fit);
            });
        });

        this.destroyRef.onDestroy(() => {
            this.pseudoMarker.clear();
            this.outlet().clear();
        });
    }

    protected open(): void {
        openInPlayground(this.renderer, this.panels, this.index(), this.state());
    }

    protected onKeydown(event: KeyboardEvent): void {
        // Only for the cell itself: Enter and Space belong to a control inside the
        // component while it has the focus.
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;

        event.preventDefault();
        this.open();
    }

    // The Playground lets a variant that throws on construction propagate: one
    // broken instance, and the user navigates away from it. The Overview
    // fans instantiation out from one instance to n, all mounted in the same
    // change-detection pass. An uncaught throw here would abort the refresh of
    // every cell after it, so one bad variant would take down the whole sheet
    // instead of just its own cell. Hence: contain here, propagate there.
    //
    // Returns the fit of the state on the rendered variant, `null` when the cell
    // has no state or the variant failed to render.
    private mount(component: RuntimeComponent, index: number, stateIndex: number | null): StateFit | null {
        this.unfitReason.set(null);

        try {
            this.outlet().clear();

            const variant = component.meta.showcaseConfig.variants?.[index];

            // The matrix gives such a variant one cell without a state, so this is
            // not asked for today. Nothing to mount, and nothing to evaluate.
            if (stateIndex !== null && variant?.states === false) {
                this.pseudoMarker.clear();
                return this.unfit('states: false');
            }

            // No `onUnknownInput` callback: the Playground already warns once per
            // component, and repeating that warning per cell would say the same thing
            // n times.
            const { values, activeContent } = computeVariantState(component, index);

            const injector = Injector.create({
                providers: component.meta.showcaseConfig.providers ?? [],
                parent: this.injector
            });
            const composed = activeCase(component, index) !== null;
            const type = renderTypeFor(component, index);
            const projectableNodes = activeContent && !composed ? parseContentToNodes(activeContent, reflectComponentType(type)?.ngContentSelectors ?? []) : undefined;

            const ref = this.outlet().createComponent(type, {
                injector,
                projectableNodes
            });

            if (composed) ref.setInput(PRISM_VARIANT_INPUT, index);
            const inputBindings = buildInputBindings(component, index);

            for (const [key, value] of Object.entries(values)) {
                const binding = inputBindings.get(key);

                // None for an unknown input, and none for one the composition of the variant leaves unbound.
                if (binding !== undefined) ref.setInput(binding, value);
            }
            ref.changeDetectorRef.detectChanges();

            const statePseudo: ForcedPseudoStates | null = stateIndex === null ? null : (component.meta.showcaseConfig.states?.[stateIndex]?.pseudo ?? null);

            this.pseudoMarker.apply(ref.location.nativeElement, variant?.pseudo, statePseudo);

            const fit = this.pseudoMarker.applied()?.fit ?? null;

            if (!fit || fit.fits) return fit;
            // The marker keeps a state that does not fit applied and forces nothing of
            // it, the Playground wants that to show why. A cell has no use for the
            // component then: it would be a picture of the variant under a label
            // that says something else.
            this.pseudoMarker.clear();
            this.outlet().clear();
            return this.unfit(fit.reason);
        } catch (error) {
            // `createComponent` attaches the host element and its structural DOM
            // synchronously; a throw almost always comes from `detectChanges` right
            // above, i.e. from a template expression or a lifecycle hook running
            // *after* that attach. So there is usually a half-built subtree sitting
            // in the outlet by the time we get here, and clearing it is what makes
            // a caught cell actually show an empty stage with its caption still in
            // place, which shows "this variant failed" instead of a broken grid
            // with no indication of which cell caused it.
            this.pseudoMarker.clear();
            this.outlet().clear();
            console.error(`[ng-prism] Variant ${index} of ${component.meta.className} failed to render:`, error);
            return null;
        }
    }

    private unfit(reason: string): StateFit {
        this.unfitReason.set(reason);
        return { fits: false, reason };
    }
}
