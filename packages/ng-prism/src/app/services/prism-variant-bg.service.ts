import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { declaredVariantBg, DEFAULT_VARIANT_BG, showcaseDefaultBg } from '../../shared/variant-bg.js';
import { playgroundGround } from '../simulate/ground.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { PrismCanvasService } from './prism-canvas.service.js';
import { PrismCaptureService } from './prism-capture.service.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { PrismRendererService } from './prism-renderer.service.js';
import { PrismSimulationService } from './prism-simulation.service.js';

@Injectable({ providedIn: 'root' })
export class PrismVariantBgService {
    private readonly canvas = inject(PrismCanvasService);
    private readonly navigation = inject(PrismNavigationService);
    private readonly renderer = inject(PrismRendererService);
    private readonly capture = inject(PrismCaptureService);
    private readonly simulation = inject(PrismSimulationService);

    /** `showcaseDefaults.bg`: what an undeclared variant gets where nobody decided. Read once, the config does not change. */
    private readonly fallback = showcaseDefaultBg(inject(PRISM_CONFIG));

    /** What the variant declares. The project's `showcaseDefaults.bg` is not part of it: it is no recommendation. */
    readonly recommended = computed<CanvasBg | null>(() => {
        const comp = this.navigation.activeComponent();

        if (!comp) return null;
        return declaredVariantBg(comp.meta.showcaseConfig, this.renderer.activeVariantIndex());
    });

    private readonly _override = signal<CanvasBg | null>(null);
    readonly override = this._override.asReadonly();

    /**
     * The background the stage actually paints.
     *
     * Capture mode uses the declared background, since a component must be
     * judged on the surface it was designed for, and ignores the user override,
     * which is session UI state and must not shape a baseline. Patterns are
     * stripped separately in `CAPTURE_STYLES`.
     *
     * With nothing declared, capture uses the project's `showcaseDefaults.bg` or,
     * without one, {@link DEFAULT_VARIANT_BG}, not the canvas default: `dots`
     * paints a theme token, so the baseline would depend on the runner's theme.
     * It is also what the discovery manifest reports, so the reported and the
     * captured background cannot drift apart.
     *
     * Interactive mode keeps `canvas.bg()`, `dots` while nobody picked one: browsing wants the themed dot grid,
     * and forcing `light` would break dark-theme browsing, unless the project
     * set `showcaseDefaults.bg`. While a color scheme is emulated, a background
     * nobody picked follows it instead ({@link playgroundGround}); capture mode
     * never sees an emulation.
     */
    readonly effective = computed<CanvasBg>(() =>
        this.capture.active()
            ? (this.recommended() ?? this.fallback ?? DEFAULT_VARIANT_BG)
            : playgroundGround({
                  override: this._override(),
                  recommended: this.recommended(),
                  picked: this.canvas.bg(),
                  scheme: this.simulation.schemeGround(),
                  fallback: this.fallback
              })
    );

    /** True when the user's override differs from the (non-null) recommended bg. */
    readonly isDeviating = computed<boolean>(() => {
        const override = this._override();
        const recommended = this.recommended();

        return override !== null && recommended !== null && override !== recommended;
    });

    constructor() {
        effect(() => {
            this.navigation.activeComponent();
            this.renderer.activeVariantIndex();
            this._override.set(null);
        });
    }

    setOverride(bg: CanvasBg): void {
        this._override.set(bg);
    }

    clearOverride(): void {
        this._override.set(null);
    }
}
