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
 * Background declarations for the box that holds a capture.
 *
 * Visible through a diff mask (comparators leave unchanged pixels transparent)
 * and through a `transparent` capture, so it decides whether those images are
 * readable.
 *
 * Only `light` and `dark` produce a colour; everything else keeps the
 * checkerboard. `dots` and `plain` paint `--prism-bg-surface`, a *theme*
 * token, and the panel cannot know which theme the runner's browser used. A
 * `transparent` capture has a real alpha channel, which the checkerboard shows.
 * A report without a background is treated the same way.
 */
export function shotSurfaceStyle(bg: CanvasBg | undefined): Record<string, string> {
    const surface = bg ? SURFACE[bg] : undefined;

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
