import { NgComponentOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    type ComponentRef,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    Injector,
    reflectComponentType,
    signal,
    type Type,
    untracked,
    viewChild,
    ViewContainerRef
} from '@angular/core';
import type { ComponentPage } from '../../plugin/page.types.js';
import type { PanelDefinition, RuntimeComponent } from '../../plugin/plugin.types.js';
import { PRISM_VARIANT_INPUT } from '../../shared/composition.js';
import { VIEWPORT_MAX, VIEWPORT_MIN } from '../../shared/viewport.type.js';
import { CANVAS_BG_STYLES } from '../canvas/canvas-bg.styles.js';
import { PrismCanvasBgPillComponent } from '../canvas/prism-canvas-bg-pill.component.js';
import { PrismCanvasMeasureComponent } from '../canvas/prism-canvas-measure.component.js';
import { PrismCanvasRulersComponent } from '../canvas/prism-canvas-rulers.component.js';
import { snapViewportWidth } from '../canvas/viewport-snap.js';
import { PrismResizerDirective } from '../directives/prism-resizer.directive.js';
import { BUILTIN_PANELS } from '../panels/builtin-panels.js';
import { appliedStateNames } from '../pseudo/pseudo-state-marker.js';
import { PrismCanvasService } from '../services/prism-canvas.service.js';
import { PrismCaptureService } from '../services/prism-capture.service.js';
import { PrismEventLogService } from '../services/prism-event-log.service.js';
import { PrismManifestService } from '../services/prism-manifest.service.js';
import { PrismMobileLayoutService } from '../services/prism-mobile-layout.service.js';
import { PrismNavigationService } from '../services/prism-navigation.service.js';
import { PrismPanelService } from '../services/prism-panel.service.js';
import { PrismPluginService } from '../services/prism-plugin.service.js';
import { PrismPseudoStateService } from '../services/prism-pseudo-state.service.js';
import { PrismRendererService } from '../services/prism-renderer.service.js';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PrismVariantBgService } from '../services/prism-variant-bg.service.js';
import { pinGroundLayer } from '../simulate/ground-layer.js';
import { groundSimulation } from '../simulate/ground.js';
import { keepScopeRoot } from '../simulate/keep-scope-root.js';
import { PRISM_RENDERER_HOOKS } from '../tokens/prism-tokens.js';
import { activeCase, type RenderSignature, renderSignature, renderTypeFor, sameRender } from './composition.js';
import { buildInputBindings, unboundInputs } from './input-bindings.js';
import { modelChangeSources } from './model-changes.js';
import { resolveOverlay } from './overlay-resolver.js';
import { parseContentToNodes } from './projectable-content.js';
import { resolveExcludedReason, resolveRenderedKey } from './rendered-key.js';

@Component({
    selector: 'prism-renderer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismCanvasRulersComponent, PrismCanvasBgPillComponent, PrismCanvasMeasureComponent, NgComponentOutlet, PrismResizerDirective],
    templateUrl: './prism-renderer.component.html',
    styleUrl: './prism-renderer.component.css',
    styles: [CANVAS_BG_STYLES]
})
export class PrismRendererComponent {
    protected readonly navigationService = inject(PrismNavigationService);
    protected readonly rendererService = inject(PrismRendererService);
    protected readonly canvasService = inject(PrismCanvasService);
    protected readonly capture = inject(PrismCaptureService);
    protected readonly variantBg = inject(PrismVariantBgService);
    private readonly simulation = inject(PrismSimulationService);
    private readonly pseudoState = inject(PrismPseudoStateService);
    private readonly mobileLayout = inject(PrismMobileLayoutService);

    /**
     * Guides, rulers and the measuring tool, which the phone layout leaves out:
     * they need a hovering pointer, and a phone's canvas already is its viewport.
     * The toggles stay as the reader set them, so the desktop layout brings them back.
     */
    protected readonly desktopTools = computed(() => !this.mobileLayout.mobile());

    /**
     * The width the canvas is actually constrained to, `null` for unconstrained.
     *
     * Every viewport binding reads this rather than the service directly, so
     * capture mode cannot be constrained by any route. Previously only the grips
     * and the dimension line sat behind the capture guard while the attributes
     * that change `.demo-wrap`'s box did not. Safe in practice, because capture
     * never restores a persisted width and every setter is suppressed, but safe
     * by reachability argument rather than by construction. A future caller of
     * `setViewportWidth` during a capture run would have recorded every
     * visual-regression baseline at the constrained width with no visible chrome
     * to reveal it. One computed makes the guarantee structural.
     *
     * The phone layout is unconstrained for the same structural reason: the
     * component there is meant to meet the device's own width.
     */
    protected readonly viewportWidth = computed(() => (this.capture.active() || !this.desktopTools() ? null : this.canvasService.viewportWidth()));

    /** How the simulation paints the stage's ground; nothing while nothing is simulated, so capture mode never sees it. */
    protected readonly ground = computed(() => groundSimulation(this.simulation.scopeRoot(), this.simulation.forcedActive()));
    /** Whether the stage draws the vision ground layer; a switch between two settings keeps it. */
    private readonly visionGround = computed(() => this.ground().vision !== null);

    protected readonly VIEWPORT_MIN = VIEWPORT_MIN;
    protected readonly VIEWPORT_MAX = VIEWPORT_MAX;

    /**
     * A drag on either grip, rested on a preset if it came close enough.
     *
     * The snapping lives here and not in `PrismResizerDirective` because the
     * directive also drives the sidebar and the panel, where there is nothing to
     * snap to, and a generic control that knows about viewport presets would be
     * the wrong shape.
     */
    protected onViewportResize(width: number): void {
        this.canvasService.setViewportWidth(snapViewportWidth(width));
    }

    private readonly eventLogService = inject(PrismEventLogService);
    private readonly manifestService = inject(PrismManifestService);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);
    private readonly host = inject(ElementRef<HTMLElement>);
    private readonly rendererHooks = inject(PRISM_RENDERER_HOOKS, {
        optional: true
    });

    private readonly panelService = inject(PrismPanelService);
    private readonly pluginService = inject(PrismPluginService);
    private readonly pseudoMarker = this.pseudoState.createMarker();

    private readonly outlet = viewChild.required('outlet', {
        read: ViewContainerRef
    });
    private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
    private componentRef: ComponentRef<unknown> | null = null;
    private outputSubscriptions: Array<{ unsubscribe(): void }> = [];
    /** What the instance on the canvas renders, `null` without one: a variant switch to another render creates a new instance. */
    private lastRender: RenderSignature | null = null;
    private isRenderPage = false;

    private readonly overlayCache = new Map<string, Type<unknown>>();
    readonly activeOverlay = signal<Type<unknown> | null>(null);
    /**
     * Identifier of the currently rendered component/variant, and of the active state.
     * Held back until the forced pseudo states and the state are in place, see {@link resolveRenderedKey}.
     */
    protected readonly renderedKey = computed(() => {
        const { base, state } = this.pseudoState.layers();

        return resolveRenderedKey({
            component: this.navigationService.activeComponent(),
            variantIndex: this.rendererService.activeVariantIndex(),
            stateIndex: this.rendererService.activeStateIndex(),
            element: this.rendererService.renderedElement(),
            pseudo: base,
            state,
            pseudoApplied: this.pseudoMarker.applied()
        });
    });
    /**
     * Why the active state is not part of what the canvas shows, `null` when it is
     * or none is active. A runner reads it next to `data-prism-rendered` and
     * reports the cell as excluded rather than taking a picture of it.
     */
    protected readonly excludedReason = computed(() =>
        resolveExcludedReason(this.rendererService.activeStateIndex(), this.pseudoState.stateExclusion(), this.pseudoMarker.applied())
    );
    /**
     * The states forced on the canvas, space-separated, `null` for none. Capture
     * mode keys the room it leaves for focus rings on it. The active state's
     * pseudo-classes count only while it fits.
     */
    protected readonly forcedStates = computed(() => {
        const names = appliedStateNames(this.pseudoMarker.applied());

        return names.length > 0 ? names.join(' ') : null;
    });
    /** Resolved canvas layout for the active variant. Variant overrides component config; defaults to 'fit'. */
    protected readonly canvasLayout = computed(() => {
        const comp = this.navigationService.activeComponent();

        if (!comp) return 'fit';
        const variant = comp.meta.showcaseConfig.variants?.[this.rendererService.activeVariantIndex()];

        return variant?.canvasLayout ?? comp.meta.showcaseConfig.canvasLayout ?? 'fit';
    });
    protected readonly overlayInputs = { rendererService: this.rendererService };
    protected readonly overlayInjector = computed(() => {
        const panelInjector = this.panelService.activePanelInjector();

        return panelInjector ?? this.injector;
    });

    constructor() {
        effect(() => {
            const comp = this.navigationService.activeComponent();

            if (!comp) return;
            untracked(() => {
                this.host.nativeElement.scrollTop = 0;
                this.rendererService.reconcileForComponent(comp);
                this.createComponent(comp);
            });
        });

        effect(() => {
            const inputs = this.rendererService.inputValues();
            const content = this.rendererService.activeContent();
            const variantIndex = this.rendererService.activeVariantIndex();
            const ref = this.componentRef;

            if (!ref) return;

            if (this.isRenderPage) {
                ref.changeDetectorRef.detectChanges();
                return;
            }

            const comp = untracked(() => this.navigationService.activeComponent());

            if (!comp) return;

            if (!sameRender(this.lastRender, renderSignature(comp, variantIndex, content))) {
                untracked(() => this.createComponent(comp));
                return;
            }

            performance.mark('prism:rerender:start');
            this.setInputs(ref, comp, variantIndex, inputs);
            ref.changeDetectorRef.detectChanges();
            performance.mark('prism:rerender:end');
            performance.measure('prism:rerender', 'prism:rerender:start', 'prism:rerender:end');
        });

        effect(() => {
            const panelId = this.panelService.activePanelId();
            const allPanels: PanelDefinition[] = [...BUILTIN_PANELS, ...this.pluginService.panels()];
            const resolution = resolveOverlay(allPanels, panelId, {
                captureActive: this.capture.active(),
                measureActive: this.canvasService.measure(),
                cache: this.overlayCache
            });

            if (resolution.kind === 'eager') {
                this.activeOverlay.set(resolution.component);
                return;
            }

            this.activeOverlay.set(null);
            if (resolution.kind !== 'lazy') return;

            const { panelId: requestedPanelId, load } = resolution;

            load().then((c) => {
                this.overlayCache.set(requestedPanelId, c);
                if (this.panelService.activePanelId() === requestedPanelId) {
                    this.activeOverlay.set(c);
                }
            });
        });

        // `renderedKey` waits for what this applies.
        effect(() => {
            const element = this.rendererService.renderedElement();
            const { base, state } = this.pseudoState.layers();

            untracked(() => this.pseudoMarker.apply(element, base, state));
        });

        // The shown component is the scope root of the simulation in the Playground.
        keepScopeRoot(this.rendererService.renderedElement);

        // The vision ground layer stays over the scrolled-to part of the stage, as long as it is drawn.
        effect((onCleanup) => {
            if (!this.visionGround()) return;

            const stage = this.stage().nativeElement;

            onCleanup(untracked(() => pinGroundLayer(stage)));
        });

        // What the layers and the toggles of the tools menu depend on. Written from the marker alone and never
        // read back here: `null` whenever no state layer is applied, so the fit of the previous state cannot linger.
        effect(() => {
            this.pseudoState.canvasFit.set(this.pseudoMarker.applied()?.fit ?? null);
        });

        this.destroyRef.onDestroy(() => {
            this.cleanup();
            this.pseudoMarker.clear();
        });
    }

    private createComponent(comp: RuntimeComponent): void {
        this.cleanup();

        const renderPageTitle = comp.meta.showcaseConfig.renderPage;

        if (renderPageTitle) {
            const page = this.manifestService.manifest().pages?.find((p): p is ComponentPage => p.type === 'component' && p.title === renderPageTitle);

            if (page) {
                this.isRenderPage = true;
                const injector = Injector.create({
                    providers: comp.meta.showcaseConfig.providers ?? [],
                    parent: this.injector
                });

                this.componentRef = this.outlet().createComponent(page.component, {
                    injector
                });
                this.componentRef.changeDetectorRef.detectChanges();
                this.rendererService.renderedElement.set(this.componentRef.location.nativeElement);
                return;
            }
        }

        this.isRenderPage = false;
        const selector = comp.meta.componentMeta.selector;
        const detail = { detail: { selector } };

        this.rendererHooks?.onBeforeCreate?.(selector);
        performance.mark('prism:render:start', detail);

        const injector = Injector.create({
            providers: comp.meta.showcaseConfig.providers ?? [],
            parent: this.injector
        });

        const content = this.rendererService.activeContent();
        const variantIndex = this.rendererService.activeVariantIndex();
        const composed = activeCase(comp, variantIndex) !== null;
        const type = renderTypeFor(comp, variantIndex);

        this.lastRender = renderSignature(comp, variantIndex, content);
        // A composed variant has its content in the template of its case.
        const projectableNodes =
            content && !composed
                ? parseContentToNodes(content, reflectComponentType(type)?.ngContentSelectors ?? [], (key) =>
                      console.warn(`[ng-prism] Variant content "${key}" matches no <ng-content> of ${comp.meta.className}, skipping it.`)
                  )
                : undefined;

        this.componentRef = this.outlet().createComponent(type, {
            injector,
            projectableNodes
        });

        const instance = this.componentRef.instance as Record<string, unknown>;

        for (const output of comp.meta.outputs) {
            this.subscribeTo(instance[output.name], (v) => this.eventLogService.log(output.name, v));
        }
        // A `model()` the component changes itself: the change is an event, and the control follows the value. No loop:
        // the model emits only for `set` and `update`, never for `setInput`.
        for (const source of modelChangeSources(comp, variantIndex)) {
            this.subscribeTo(instance[source.member], (v) => {
                this.eventLogService.log(source.event, v);
                this.rendererService.updateInput(source.input, v);
            });
        }

        if (composed) this.componentRef.setInput(PRISM_VARIANT_INPUT, variantIndex);
        this.setInputs(this.componentRef, comp, variantIndex, this.rendererService.inputValues());
        this.componentRef.changeDetectorRef.detectChanges();

        performance.mark('prism:render:end', detail);
        performance.measure('prism:render', 'prism:render:start', 'prism:render:end');

        this.rendererService.renderedElement.set(this.componentRef.location.nativeElement);
        this.rendererHooks?.onAfterCreate?.(selector);
    }

    /**
     * Sets `values` on the instance by the bindings of the variant. A key that
     * names no input gets a warning, an input the composition of the variant
     * leaves unbound is skipped without one.
     */
    private setInputs(ref: ComponentRef<unknown>, comp: RuntimeComponent, variantIndex: number, values: Record<string, unknown>): void {
        const bindings = buildInputBindings(comp, variantIndex);
        const unbound = unboundInputs(comp, variantIndex);

        for (const [key, value] of Object.entries(values)) {
            const binding = bindings.get(key);

            if (binding !== undefined) {
                ref.setInput(binding, value);
            } else if (!unbound.has(key)) {
                console.warn(`[ng-prism] Unknown input "${key}" on <${comp.meta.componentMeta.selector}>, skipping. Remove it from @Showcase variants.`);
            }
        }
    }

    /** Subscribes `next` to `emitter` when it is an output or a model signal, until the next render cleans up. */
    private subscribeTo(emitter: unknown, next: (v: unknown) => void): void {
        if (emitter && typeof (emitter as { subscribe?: unknown }).subscribe === 'function') {
            this.outputSubscriptions.push((emitter as { subscribe(fn: (v: unknown) => void): { unsubscribe(): void } }).subscribe(next));
        }
    }

    private cleanup(): void {
        const hadComponent = this.componentRef !== null;

        this.rendererService.renderedElement.set(null);
        for (const sub of this.outputSubscriptions) {
            sub.unsubscribe();
        }
        this.outputSubscriptions = [];
        this.outlet().clear();
        this.componentRef = null;
        this.lastRender = null;
        if (hadComponent) {
            this.rendererHooks?.onAfterDestroy?.('');
        }
    }
}
