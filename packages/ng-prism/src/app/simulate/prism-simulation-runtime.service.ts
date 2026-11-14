import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, Injector, untracked } from '@angular/core';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import type { ForcedPaletteName } from './forced-palette.js';
import { type MatchMediaPatch, patchMatchMedia } from './match-media-patch.js';
import { applyScopeRoot, applyTopLayerFilter, type ScopeRootState } from './scope-root.js';
import { OVERLAY_ROOT } from './scope-selector.js';
import { SimulationStyles } from './simulation-styles.js';
import type { EmulatedMedia } from './simulation.js';

/** An overlay host that CDK opened as a popover, which puts it in the top layer. */
function isPopover(child: Element): child is HTMLElement {
    return child instanceof HTMLElement && child.hasAttribute('popover');
}

/**
 * Carries the simulation from {@link PrismSimulationService} into the page:
 * the stylesheets and the forced colors sheet ({@link SimulationStyles}),
 * `matchMedia` ({@link patchMatchMedia}) and the CDK overlay container as a
 * scope root, with the vision filter on the overlays in it that the browser
 * shows in the top layer. The scope roots in the canvas and the Overview belong
 * to the components that render them.
 *
 * Every part runs only while it has something to do and takes back what it
 * changed when it stops and when the app is destroyed. The shell starts it
 * once, after the URL and the session have restored the simulation.
 */
@Injectable({ providedIn: 'root' })
export class PrismSimulationRuntimeService {
    private readonly sim = inject(PrismSimulationService);
    private readonly doc = inject(DOCUMENT);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);
    private readonly styles = new SimulationStyles(this.doc);

    private started = false;
    private matchMediaPatch: MatchMediaPatch | null = null;
    private bodyObserver: MutationObserver | null = null;
    private containerObserver: MutationObserver | null = null;
    /** The overlay containers made scope roots. */
    private overlays: HTMLElement[] = [];
    /** The overlays in them that carry the filter themselves, see {@link findLayers}. */
    private layers: HTMLElement[] = [];

    /** Starts carrying the simulation into the page. Idempotent. */
    init(): void {
        if (this.started) return;
        this.started = true;

        // The signals are read outside `untracked`, the page is changed inside: a `change`
        // listener that the `matchMedia` patch calls synchronously must not add to the effect.
        effect(
            () => {
                const emulated = this.sim.emulated();
                const palette = this.sim.forcedPalette();

                untracked(() => this.emulate(emulated, palette));
            },
            { injector: this.injector }
        );
        effect(
            () => {
                const root = this.sim.scopeRoot();

                untracked(() => this.scopeOverlays(root));
            },
            { injector: this.injector }
        );

        this.destroyRef.onDestroy(() => {
            this.styles.clear();
            this.patchMatchMedia(null);
            this.scopeOverlays(null);
        });
    }

    private emulate(emulated: EmulatedMedia, palette: ForcedPaletteName | null): void {
        this.styles.apply(emulated, palette);
        this.patchMatchMedia(Object.keys(emulated).length > 0 ? emulated : null);
    }

    private patchMatchMedia(emulated: EmulatedMedia | null): void {
        const win = this.doc.defaultView;

        if (!emulated) {
            this.matchMediaPatch?.uninstall();
            this.matchMediaPatch = null;
        } else if (this.matchMediaPatch) {
            this.matchMediaPatch.update(emulated);
        } else if (win && typeof win.matchMedia === 'function') {
            this.matchMediaPatch = patchMatchMedia(win, emulated);
        }
    }

    /**
     * Makes the CDK overlay containers at the body scope roots with `root`, and
     * watches the body for one that comes later, as long as `root` is not `null`.
     * CDK appends its container to the body when the first overlay opens.
     * The containers are watched as well, for the overlays that open in them.
     */
    private scopeOverlays(root: ScopeRootState | null): void {
        const body = this.doc.body;

        if (!root || !body) {
            this.bodyObserver?.disconnect();
            this.bodyObserver = null;
            this.containerObserver?.disconnect();
            this.containerObserver = null;

            const layers = this.layers;
            const overlays = this.overlays;

            this.layers = [];
            this.overlays = [];
            for (const layer of layers) applyTopLayerFilter(layer, null);
            for (const overlay of overlays) applyScopeRoot(overlay, null);
            return;
        }

        if (!this.bodyObserver && typeof MutationObserver !== 'undefined') {
            this.bodyObserver = new MutationObserver(() => {
                const current = this.sim.scopeRoot();

                if (current) this.findOverlays(body, current);
            });
            this.bodyObserver.observe(body, { childList: true });
            this.containerObserver = new MutationObserver(() => {
                const current = this.sim.scopeRoot();

                if (current) this.findLayers(current);
            });
        }
        this.findOverlays(body, root);
    }

    private findOverlays(body: HTMLElement, root: ScopeRootState): void {
        const found = Array.from(body.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(OVERLAY_ROOT));
        const gone = this.overlays.filter((overlay) => !found.includes(overlay));

        // Recorded before anything is applied, so that a release reaches every container even after an apply threw.
        this.overlays = found;
        this.containerObserver?.disconnect();
        for (const overlay of found) this.containerObserver?.observe(overlay, { childList: true });
        for (const overlay of gone) applyScopeRoot(overlay, null);
        for (const overlay of found) applyScopeRoot(overlay, root);
        this.findLayers(root);
    }

    /**
     * Puts the vision filter on the overlays that CDK opens as popovers in the
     * containers, and takes it off those that left or when there is no filter.
     * A popover is in the top layer, out of the reach of the container's
     * filter; the rest of the scope root reaches it through the container
     * (see {@link applyTopLayerFilter}). Hosts that are no popover are drawn
     * with the container and its filter, and keep none of their own.
     */
    private findLayers(root: ScopeRootState): void {
        const filter = root.filter;
        const found = filter ? this.overlays.flatMap((overlay) => Array.from(overlay.children).filter(isPopover)) : [];
        const gone = this.layers.filter((layer) => !found.includes(layer));

        this.layers = found;
        for (const layer of gone) applyTopLayerFilter(layer, null);
        for (const layer of found) applyTopLayerFilter(layer, filter);
    }
}
