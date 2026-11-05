import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { ShowcaseState } from '../../decorator/showcase.types.js';
import { CANVAS_BGS, type CanvasBg } from '../../shared/canvas-bg.type.js';
import { PSEUDO_STATES, type PseudoState } from '../../shared/pseudo-state.type.js';
import { VIEWPORT_SNAPS } from '../../shared/viewport.type.js';
import { PrismIconComponent } from '../icons/prism-icon.component.js';
import { evaluateStateFit, type StateFit } from '../pseudo/state-fit.js';
import { PrismCanvasService } from '../services/prism-canvas.service.js';
import { PrismMobileLayoutService } from '../services/prism-mobile-layout.service.js';
import { PrismNavigationService } from '../services/prism-navigation.service.js';
import { PrismPseudoStateService } from '../services/prism-pseudo-state.service.js';
import { PrismRendererService } from '../services/prism-renderer.service.js';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PrismVariantBgService } from '../services/prism-variant-bg.service.js';
import { PrismIconButtonComponent } from '../shared/prism-icon-button.component.js';
import { FORCED_SETTINGS, type ForcedSetting, MOTION_SETTINGS, SCHEME_SETTINGS, VISION_SETTINGS } from '../simulate/simulation.js';
import { visionFilter } from '../simulate/vision-filters.js';
import { CANVAS_BG_STYLES } from './canvas-bg.styles.js';
import { railToggleTitle, TOOLS_LABEL, toolsTitle, zoomTitle } from './canvas-overlay-tokens.js';
import { buildStateChips, chipFits, type PseudoSource, type StateChip, toggleTitle } from './state-chips.js';

/** What each pseudo state's chip shows in front of its name: the pointer, the pointer pressing, the focus frame, the keyboard, a dashed frame for the element round the focus. */
const STATE_ICONS: Record<PseudoState, string> = {
    hover: 'mouse-pointer',
    active: 'mouse-pointer-click',
    focus: 'scan',
    'focus-visible': 'keyboard',
    'focus-within': 'box-select'
};

/** The bar over the widest preset, 1024. The others scale down from it, to no less than 6px so 320 still reads as a bar. */
const WIDTH_BAR_MAX = 30;
const WIDTH_BAR_MIN = 6;

/** Forced colors are approximated, the browser has no switch for them; the tooltip says so and where the real mode is. */
const FORCED_ACTIVE_TITLE = 'Forced colors (approx.). The exact mode: Chrome DevTools › Rendering › Emulate CSS media feature forced-colors';

/**
 * The canvas tools, as a rail floating over the canvas.
 *
 * Things you toggle constantly (guides, rulers, the viewport constraint) get
 * their own button; things you set once (background, forced state, zoom,
 * viewport width, the simulated environment) live in the menu. The template is a view rather than a setting and keeps its own
 * button. Zoom is shown as a readout, with the viewport width in its tooltip.
 *
 * The host generates no box. The rail must be a direct child of
 * `.prism-canvas-wrap` outside the stage, because that is what capture mode's
 * structural rule in `prism-capture.service.ts` hides. A rail nested in the
 * renderer or the stage would end up in every screenshot and corrupt
 * visual-regression baselines.
 */
@Component({
    selector: 'prism-canvas-toolbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismIconComponent, PrismIconButtonComponent],
    templateUrl: './prism-canvas-toolbar.component.html',
    styleUrl: './prism-canvas-toolbar.component.css',
    // The background swatches carry data-bg like the stage, so the stage's own rules paint them. Last, see CANVAS_BG_STYLES.
    styles: [CANVAS_BG_STYLES]
})
export class PrismCanvasToolbarComponent {
    protected readonly canvas = inject(PrismCanvasService);
    protected readonly variantBg = inject(PrismVariantBgService);
    protected readonly pseudoState = inject(PrismPseudoStateService);
    private readonly navigation = inject(PrismNavigationService);
    private readonly renderer = inject(PrismRendererService);
    protected readonly mobileLayout = inject(PrismMobileLayoutService);
    protected readonly sim = inject(PrismSimulationService);

    /**
     * The pseudo states the canvas can force, as toggles. Several can be on at
     * once (`:hover` with `:focus-visible`). The active ones carry `is-on`, the
     * ones the variant or the active state declares the `is-rec` edge, as in the
     * Background group.
     */
    protected readonly states = PSEUDO_STATES;

    protected stateTitle(state: PseudoState): string {
        return toggleTitle(state, this.declaredBy(state));
    }

    protected stateIcon(state: PseudoState): string {
        return STATE_ICONS[state];
    }

    /** The variant first. Otherwise the active state, which {@link PrismPseudoStateService.isDeclared} only counts while it fits. */
    private declaredBy(state: PseudoState): PseudoSource | null {
        if (this.pseudoState.declared()?.[state] !== undefined) return { by: 'variant' };

        const active = this.pseudoState.activeState();

        return active !== null && this.pseudoState.isDeclared(state) ? { by: 'state', name: active.name } : null;
    }

    /** The component's declared states, as chips above the toggles. Empty for a component without any, which then shows no row. */
    private readonly declaredStates = computed<readonly ShowcaseState[]>(() => this.navigation.activeComponent()?.meta.showcaseConfig.states ?? []);

    /** Whether the shown variant has `states: false`. `stateExclusion` says so only while a state is active, the chips need it before. */
    private readonly variantOptsOut = computed(
        () => this.navigation.activeComponent()?.meta.showcaseConfig.variants?.[this.renderer.activeVariantIndex()]?.states === false
    );

    /**
     * Whether each declared state fits the rendered component. Measured after
     * the render because the fit depends on the DOM, which a control or a
     * variant change rewrites: a state can lose its target to a toggled input.
     * Equal results keep the old array, so typing into a text control does not
     * re-render the menu for nothing.
     */
    private readonly fits = signal<StateFit[]>([], { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });

    protected readonly chips = computed<StateChip[]>(() => buildStateChips(this.declaredStates(), this.renderer.activeStateIndex(), this.fits()));

    constructor() {
        afterRenderEffect({
            read: () => {
                // Not a value of the fit, but what rewrites the DOM it is measured on.
                this.renderer.inputValues();

                this.fits.set(
                    chipFits(
                        this.declaredStates(),
                        {
                            element: this.renderer.renderedElement(),
                            optedOut: this.variantOptsOut(),
                            activeIndex: this.renderer.activeStateIndex(),
                            canvasFit: this.pseudoState.canvasFit()
                        },
                        evaluateStateFit
                    )
                );
            }
        });
    }

    protected pickState(chip: StateChip): void {
        this.renderer.selectState(chip.active ? null : chip.index);
    }

    protected readonly toolsLabel = TOOLS_LABEL;

    private readonly toggled = computed(() => Object.keys(this.pseudoState.override()).length > 0);

    /**
     * Whether the menu holds something that changes what the canvas shows: an
     * active state, a pseudo state toggled on or off, or a simulation. Marked
     * on the trigger, so it shows with the menu closed. The state and the
     * toggles go with the next variant, the simulation stays.
     */
    protected readonly toolsSet = computed(() => this.pseudoState.activeState() !== null || this.toggled() || this.sim.active());

    protected readonly toolsTitle = computed(() => toolsTitle(this.pseudoState.activeState()?.name ?? null, this.toggled(), this.sim.active()));

    /** Angular templates resolve names against the component, not the global scope. */
    protected readonly Math = Math;

    protected readonly zoomTitle = computed(() => zoomTitle(this.canvas.zoom(), this.canvas.viewportWidth()));

    protected railTitle(label: string, on: boolean): string {
        return railToggleTitle(label, on);
    }

    protected setBg(bg: CanvasBg): void {
        if (this.variantBg.recommended() !== null) {
            this.variantBg.setOverride(bg);
        } else {
            this.canvas.setBg(bg);
        }
    }

    /**
     * Every {@link CanvasBg}, taken from the type's canonical list.
     *
     * The group is also a readout: the active button is `effective()` and the
     * recommended one carries the `is-rec` edge. A value missing from the list
     * cannot be shown, so a variant declaring it would leave nothing active.
     *
     * `checker` and `transparent` paint the same checkerboard here, so their
     * titles explain the difference, which only a capture shows. `checker` is
     * deprecated but stays until 23.0.0 because components can still declare it.
     */
    protected readonly bgs = CANVAS_BGS;

    /**
     * What a background means, where the canvas cannot show the difference.
     *
     * Bound with `[attr.title]`, never `[title]`. A property binding assigns to
     * `HTMLElement.title`, a non-nullable DOMString, so the `null` below would
     * be stringified and every unremarkable button would carry a tooltip
     * reading "null" (four of the six in the common case).
     */
    protected bgTitle(bg: CanvasBg): string | null {
        if (this.variantBg.recommended() === bg) {
            return 'Recommended background for this variant';
        }
        if (bg === 'transparent') {
            return 'Checkerboard here, a real alpha channel in a capture';
        }
        if (bg === 'checker') {
            return 'Deprecated: same look as Transparent, but a capture keeps the themed colour';
        }
        return null;
    }
    protected readonly zooms = [
        { value: 0.75, label: '75%' },
        { value: 1, label: '100%' },
        { value: 1.5, label: '150%' },
        { value: 2, label: '200%' }
    ];

    /**
     * The named widths, offered the same way as the zoom chooser.
     *
     * Plain numbers and no device names: this tool narrows a box and simulates
     * nothing, so calling 390 "iPhone" would promise a fidelity it does not have.
     * A bar over each number shows the width instead, to scale.
     */
    protected readonly viewports = VIEWPORT_SNAPS;

    /** The length of the bar over `width`, in px. */
    protected widthBar(width: number): number {
        return Math.max(WIDTH_BAR_MIN, Math.round((width / 1024) * WIDTH_BAR_MAX));
    }

    /**
     * The Simulate rows, from the lists that also validate the URL and the
     * session, so a setting cannot be restorable without being shown. Each
     * label is its value, capitalized.
     */
    protected readonly motions = MOTION_SETTINGS;
    protected readonly schemes = SCHEME_SETTINGS;
    protected readonly forceds = FORCED_SETTINGS;
    protected readonly visions = VISION_SETTINGS;

    /** The filter the stage gets, for the colour stripe of each Vision tile. */
    protected readonly visionFilter = visionFilter;

    /** Bound with `[attr.title]`, see {@link bgTitle}. */
    protected forcedTitle(forced: ForcedSetting): string | null {
        return forced === 'active' ? FORCED_ACTIVE_TITLE : null;
    }

    protected capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}
