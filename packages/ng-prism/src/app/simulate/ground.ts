import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { DEFAULT_VARIANT_BG } from '../../shared/variant-bg.js';
import type { ScopeRootState } from './scope-root.js';
import { forcedPalette, type Simulation } from './simulation.js';

/**
 * The background the Playground paints, with the emulated color scheme in the
 * mix.
 *
 * What someone decided wins, from the most specific to the least: the override
 * they set for this variant, the background the variant recommends, and the
 * background they picked for the whole canvas. Only when nobody decided, the
 * ground follows the emulated scheme, so that a dark scheme does not show a
 * component on the light dot grid. Without an emulated scheme, it is the
 * canvas background as before.
 *
 * `chosen` is what tells a picked `dots` from the default one: the value alone
 * cannot, and a pick made while a scheme is emulated has to hold.
 */
export function playgroundGround(o: {
    override: CanvasBg | null;
    recommended: CanvasBg | null;
    chosen: boolean;
    canvasBg: CanvasBg;
    scheme: 'light' | 'dark' | null;
}): CanvasBg {
    return o.override ?? o.recommended ?? (o.chosen ? o.canvasBg : o.scheme) ?? o.canvasBg;
}

/**
 * The background an overview cell paints: what its variant declares, or the
 * emulated scheme, or {@link DEFAULT_VARIANT_BG}.
 *
 * The cells have no background of the user's own, so there is no pick to
 * respect, and the scheme only takes the place of the default that an
 * undeclared variant would get.
 */
export function overviewGround(declared: CanvasBg | null, scheme: 'light' | 'dark' | null): CanvasBg {
    return declared ?? scheme ?? DEFAULT_VARIANT_BG;
}

/**
 * The ground the overlays on the canvas are coloured for (`canvasOverlayTokens`):
 * the canvas background, or under forced colors their palette. The ground is
 * `Canvas` then, whatever the background, so a `light` background under the
 * dark palette is a dark ground.
 */
export function overlayGround(bg: CanvasBg, sim: Simulation): CanvasBg {
    return forcedPalette(sim) ?? bg;
}

/**
 * How the simulation paints the ground of a stage: the Playground's
 * `.prism-canvas-stage` and an Overview cell's `.cell__stage`. The ground
 * belongs to what is simulated, the overlays on it do not.
 *
 * One stage binding per field, `null` leaves it off, so a stage that simulates
 * nothing is the stage as it was.
 */
export interface GroundSimulation {
    /** `data-sim-forced`: present while forced colors are approximated, which paints the ground `Canvas`. */
    forced: '' | null;
    /** `data-sim-vision`: present while a vision setting filters the ground. */
    vision: '' | null;
    /** `--prism-sim-filter`: the filter the ground layer is drawn with. */
    filter: string | null;
    /** `color-scheme`: the palette of forced colors, so that `Canvas` on the ground is the one the component is forced against. */
    colorScheme: 'light' | 'dark' | null;
}

/** The ground as it is without a simulation. */
export const NO_GROUND_SIMULATION: Readonly<GroundSimulation> = Object.freeze({ forced: null, vision: null, filter: null, colorScheme: null });

/**
 * The ground under the scope root `root` (`PrismSimulationService.scopeRoot`),
 * with forced colors on or off.
 *
 * The stage takes on a `color-scheme` only under forced colors: an emulated
 * scheme alone reaches the ground through `data-bg` (see {@link playgroundGround}),
 * whose colours are literal, and the stage's own scrollbars keep the shell's.
 */
export function groundSimulation(root: ScopeRootState | null, forced: boolean): Readonly<GroundSimulation> {
    const filter = root?.filter ?? null;

    if (!forced && !filter) return NO_GROUND_SIMULATION;

    return {
        forced: forced ? '' : null,
        vision: filter ? '' : null,
        filter,
        colorScheme: forced ? (root?.colorScheme ?? null) : null
    };
}
