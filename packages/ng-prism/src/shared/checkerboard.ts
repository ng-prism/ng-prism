/** The ground of the checkerboard `transparent` draws: the light ground, in both themes. */
export const CHECKERBOARD_GROUND = 'var(--prism-void-light, #f7f5fc)';

/** Its squares: the ground mixed 6% towards ink in sRGB, `#e9e8ef` by default, so that retuning the ground retunes them. */
export const CHECKERBOARD_SQUARE = `color-mix(in srgb, ${CHECKERBOARD_GROUND} 94%, #0f172a)`;

const SQUARE = 'var(--prism-checker-square)';

/**
 * The four gradients of the checkerboard, with squares in `--prism-checker-square`, which the canvas sets to
 * {@link CHECKERBOARD_SQUARE} on the rule. The element gives them their size and position. A constant rather than a
 * function, since the compiler evaluates the canvas styles that use it.
 */
export const CHECKERBOARD_IMAGE = `linear-gradient(45deg, ${SQUARE} 25%, transparent 25%), linear-gradient(-45deg, ${SQUARE} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${SQUARE} 75%), linear-gradient(-45deg, transparent 75%, ${SQUARE} 75%)`;

/**
 * The checkerboard the canvas draws for `transparent` while browsing, as `background-color` and `background-image`,
 * for a plugin that shows something on it, as the visual regression panel shows a capture. Size and position are the
 * caller's (16px squares on the canvas). Since 22.8.0.
 */
export function checkerboardStyle(): { 'background-color': string; 'background-image': string } {
    return { 'background-color': CHECKERBOARD_GROUND, 'background-image': CHECKERBOARD_IMAGE.replaceAll(SQUARE, CHECKERBOARD_SQUARE) };
}
