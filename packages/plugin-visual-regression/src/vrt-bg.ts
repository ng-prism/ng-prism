import type { CanvasBg } from '@ng-prism/core/plugin';
import type { VrtVariantResult } from './visual-regression.types.js';

/**
 * Colours the two theme-independent backgrounds resolve to.
 *
 * Mirrors what the canvas paints in capture mode, tokens included, so the
 * frame around a capture is the same colour as the capture's own edge.
 * `--prism-void-light` and `--prism-void-dark` are absolute in both themes;
 * the literals are the tokens' own fallbacks.
 */
const SURFACE: Partial<Record<CanvasBg, string>> = {
    light: 'var(--prism-void-light, #f7f5fc)',
    dark: 'var(--prism-void-dark, #07050f)'
};

/**
 * The checkerboard the canvas draws for `transparent`, as colours only.
 *
 * Keep in step with `CANVAS_BG_STYLES` in `@ng-prism/core`: the plugin cannot
 * import it, since only `@ng-prism/core/plugin` is public. The ground is
 * `--prism-void-light` and the squares are that ground mixed 6% towards
 * `#0f172a`, so a project that retunes the token retunes both boards. The four
 * gradients are the canvas's own; `.vrt-cmp__shot` supplies the size and
 * position (a 12px grid here, 16px on the canvas).
 */
const CHECKER_GROUND = 'var(--prism-void-light, #f7f5fc)';
const CHECKER_SQUARE = `color-mix(in srgb, ${CHECKER_GROUND} 94%, #0f172a)`;
const CHECKER_IMAGE = [
    `linear-gradient(45deg, ${CHECKER_SQUARE} 25%, transparent 25%)`,
    `linear-gradient(-45deg, ${CHECKER_SQUARE} 25%, transparent 25%)`,
    `linear-gradient(45deg, transparent 75%, ${CHECKER_SQUARE} 75%)`,
    `linear-gradient(-45deg, transparent 75%, ${CHECKER_SQUARE} 75%)`
].join(', ');

/**
 * Background declarations for the box that holds a capture.
 *
 * Visible through a diff mask (comparators leave unchanged pixels transparent)
 * and through a `transparent` capture, so it decides whether those images are
 * readable.
 *
 * `light` and `dark` paint their flat surface. `transparent` gets the canvas's
 * fixed light checkerboard, and so does a report without a background: a
 * `transparent` capture has a real alpha channel and inherits dark text from the
 * canvas, which would sit on navy on the theme checkerboard in the dark theme.
 * Everything else keeps the panel's theme checkerboard (an empty result).
 * `dots` and `plain` paint `--prism-bg-surface`, a *theme* token, and the panel
 * cannot know which theme the runner's browser used. A report from before
 * 22.8.0 can still say `checker`, which the type no longer has, and is treated
 * the same way.
 */
export function shotSurfaceStyle(bg: CanvasBg | undefined): Record<string, string> {
    if (bg === undefined || bg === 'transparent') {
        return { 'background-color': CHECKER_GROUND, 'background-image': CHECKER_IMAGE };
    }

    const surface = SURFACE[bg];

    if (!surface) return {};
    return { 'background-color': surface, 'background-image': 'none' };
}

/**
 * The background move between the baseline and this run, or `null`.
 *
 * A variant whose declared `bg` changed compares a capture on one surface
 * against a baseline on another, so the diff is 100% although the component
 * did not change. Naming the change tells a reviewer to re-record the baseline
 * instead of looking for a regression.
 *
 * Needs both values from the runner: `bg` is what this run captured on,
 * `baselineBg` what the stored baseline was captured on. Runners that do not
 * track the second get no note.
 */
export function bgChange(variant: VrtVariantResult): { from: CanvasBg; to: CanvasBg } | null {
    const { baselineBg, bg } = variant;

    if (!baselineBg || !bg || baselineBg === bg) return null;
    return { from: baselineBg, to: bg };
}
