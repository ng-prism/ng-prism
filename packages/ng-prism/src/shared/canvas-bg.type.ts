/**
 * A surface the canvas can paint behind a component.
 *
 * Three groups, and the distinction only matters once a variant is under
 * visual regression. `light` and `dark` are absolute colours. `dots` and
 * `plain` follow the active theme. `transparent` has no colour at all and is
 * the only one whose capture carries an alpha channel.
 */
export type CanvasBg = 'dots' | 'plain' | 'light' | 'dark' | 'transparent';

/**
 * Every value {@link CanvasBg} accepts.
 *
 * Also the list the canvas toolbar renders. The toolbar marks the active
 * background, so a value missing here could not be shown as active. Persisted
 * canvas state is validated against this list too, so a value that no longer
 * exists (a removed one, a typo) is dropped on load instead of reaching the
 * canvas.
 */
export const CANVAS_BGS: readonly CanvasBg[] = ['dots', 'plain', 'light', 'dark', 'transparent'] as const;
