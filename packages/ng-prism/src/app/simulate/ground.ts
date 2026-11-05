import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { DEFAULT_VARIANT_BG } from '../../shared/variant-bg.js';

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
