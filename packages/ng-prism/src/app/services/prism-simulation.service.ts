import { computed, inject, Injectable, signal } from '@angular/core';
import { sameScopeRoot, type ScopeRootState } from '../simulate/scope-root.js';
import {
    auditConditionLabel,
    DEFAULT_SIMULATION,
    type EmulatedMedia,
    emulatedMedia,
    forcedPalette,
    type ForcedSetting,
    isSimulating,
    type MotionSetting,
    sameMedia,
    schemeGround,
    type SchemeSetting,
    type Simulation,
    simulationLabels,
    type VisionSetting
} from '../simulate/simulation.js';
import { visionFilter } from '../simulate/vision-filters.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { PrismCaptureService } from './prism-capture.service.js';

/**
 * What the canvas simulates about the user's environment: the Simulate group
 * of the tools menu, and everything derived from it for the engines, the
 * ground, the pills and the audit.
 *
 * Unlike the background override and the pseudo-state toggles, the simulation
 * stays when the variant, the component or the view changes: it describes the
 * environment, not the component.
 *
 * Capture mode never sees it. {@link state} is {@link DEFAULT_SIMULATION}
 * there whatever was set, so nothing derived from it simulates anything: the
 * session's settings must not shape a baseline.
 */
@Injectable({ providedIn: 'root' })
export class PrismSimulationService {
    private readonly capture = inject(PrismCaptureService);
    private readonly colorSchemeHook = inject(PRISM_CONFIG).colorScheme;

    private readonly motion = signal<MotionSetting>(DEFAULT_SIMULATION.motion);
    private readonly scheme = signal<SchemeSetting>(DEFAULT_SIMULATION.scheme);
    private readonly forced = signal<ForcedSetting>(DEFAULT_SIMULATION.forced);
    private readonly vision = signal<VisionSetting>(DEFAULT_SIMULATION.vision);

    /** The simulation in effect: what was set, or {@link DEFAULT_SIMULATION} while capture mode is active. */
    readonly state = computed<Simulation>(() =>
        this.capture.active() ? DEFAULT_SIMULATION : { motion: this.motion(), scheme: this.scheme(), forced: this.forced(), vision: this.vision() }
    );

    /** Whether anything is simulated. */
    readonly active = computed(() => isSimulating(this.state()));

    /** One label per simulated setting, in menu order, for the pills. */
    readonly labels = computed(() => simulationLabels(this.state()));

    /** The media features the stylesheets and `matchMedia` answer differently; the same object while they stay the same. */
    readonly emulated = computed<EmulatedMedia>(() => emulatedMedia(this.state()), { equal: sameMedia });

    /** The scheme the ground behind the component takes on, or `null` for the real one. */
    readonly schemeGround = computed(() => schemeGround(this.state()));

    /** Whether forced colors are approximated. */
    readonly forcedActive = computed(() => this.state().forced === 'active');

    /** The condition a live accessibility audit runs under, or `null` for the real environment. */
    readonly auditCondition = computed(() => auditConditionLabel(this.state()));

    /**
     * What goes on every scope root (see `applyScopeRoot`), or `null`
     * while nothing is simulated.
     *
     * `color-scheme` follows the emulated scheme, so that `light-dark()`,
     * system colors and native controls follow it too; without one, it is the
     * palette of forced colors. The `colorScheme` config hook applies only
     * while a scheme is emulated: forced colors alone are no scheme of the
     * component's.
     */
    readonly scopeRoot = computed<ScopeRootState | null>(
        () => {
            if (!this.active()) return null;

            const state = this.state();
            const scheme = this.emulated()['prefers-color-scheme'] ?? null;
            const hook = scheme ? this.colorSchemeHook?.[scheme] : undefined;

            return {
                colorScheme: scheme ?? forcedPalette(state),
                filter: visionFilter(state.vision),
                themeClass: hook?.class ?? null,
                themeAttributes: hook?.attributes ?? {}
            };
        },
        { equal: sameScopeRoot }
    );

    /** Changes the settings `patch` names and leaves the others. */
    set(patch: Partial<Simulation>): void {
        if (patch.motion !== undefined) this.motion.set(patch.motion);
        if (patch.scheme !== undefined) this.scheme.set(patch.scheme);
        if (patch.forced !== undefined) this.forced.set(patch.forced);
        if (patch.vision !== undefined) this.vision.set(patch.vision);
    }

    /** Back to the real environment: every setting to its default. */
    reset(): void {
        this.set(DEFAULT_SIMULATION);
    }
}
