import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { DEFAULT_VARIANT_BG } from '../../shared/variant-bg.js';
import { FORCED_PALETTES, type ForcedPaletteName } from './forced-palette.js';
import type { ScopeRootState } from './scope-root.js';

/**
 * The background the Playground paints, with the emulated color scheme in the
 * mix.
 *
 * What someone decided wins, from the most specific to the least: the override
 * they set for this variant, the background the variant recommends, and the
 * background they picked for the whole canvas. Only when nobody decided, the
 * ground follows the emulated scheme, so that a dark scheme does not show a
 * component on the light dot grid. Without an emulated scheme, it is the
 * canvas's own `dots`.
 *
 * `picked` is the background picked for the whole canvas, `null` while nobody
 * did: a picked `dots` holds while a scheme is emulated, the default one does
 * not.
 *
 * `fallback` is the project's `showcaseDefaults.bg`. It only replaces `dots`
 * where nobody decided, so the emulated scheme beats it too: a dark scheme
 * should not leave the component on the light ground the project set for the
 * default case. It is no decision of the variant, which is why it is not
 * `recommended`.
 */
export function playgroundGround(o: {
    override: CanvasBg | null;
    recommended: CanvasBg | null;
    picked: CanvasBg | null;
    scheme: 'light' | 'dark' | null;
    fallback: CanvasBg | null;
}): CanvasBg {
    return o.override ?? o.recommended ?? o.picked ?? o.scheme ?? o.fallback ?? 'dots';
}

/**
 * The background an overview cell paints: what its variant declares, or the
 * emulated scheme, or the project's `showcaseDefaults.bg` (`fallback`), or
 * {@link DEFAULT_VARIANT_BG}.
 *
 * The cells have no background of the user's own, so there is no pick to
 * respect, and the scheme and the fallback only take the place of the default
 * that an undeclared variant would get.
 */
export function overviewGround(declared: CanvasBg | null, scheme: 'light' | 'dark' | null, fallback: CanvasBg | null = null): CanvasBg {
    return declared ?? scheme ?? fallback ?? DEFAULT_VARIANT_BG;
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
    /** `data-sim-forced`: present while forced colors are approximated, which paints the ground {@link canvas}. */
    forced: '' | null;
    /** `data-sim-vision`: present while a vision setting filters the ground. */
    vision: '' | null;
    /** `--prism-sim-filter`: the filter the ground layer is drawn with. */
    filter: string | null;
    /** `color-scheme`: the palette of forced colors, for the stage's own scrollbars. */
    colorScheme: ForcedPaletteName | null;
    /**
     * `--prism-sim-canvas`: the palette's `Canvas`, the ground under forced
     * colors. A value, since the keyword resolves against the browser's normal
     * palette: a dark `Canvas` is `#121212` there and `#000000` in Chromium's
     * forced one.
     */
    canvas: string | null;
}

/** The ground as it is without a simulation. */
export const NO_GROUND_SIMULATION: Readonly<GroundSimulation> = Object.freeze({ forced: null, vision: null, filter: null, colorScheme: null, canvas: null });

/**
 * The ground under the scope root `root` (`PrismSimulationService.scopeRoot`),
 * in the palette of forced colors or, while they are off, `null`.
 *
 * The stage takes on a `color-scheme` only under forced colors: an emulated
 * scheme alone reaches the ground through `data-bg` (see {@link playgroundGround}),
 * whose colours are literal, and the stage's own scrollbars keep the shell's.
 */
export function groundSimulation(root: ScopeRootState | null, palette: ForcedPaletteName | null): Readonly<GroundSimulation> {
    const filter = root?.filter ?? null;

    if (!palette && !filter) return NO_GROUND_SIMULATION;

    return {
        forced: palette ? '' : null,
        vision: filter ? '' : null,
        filter,
        colorScheme: palette,
        canvas: palette ? FORCED_PALETTES[palette].canvas : null
    };
}
