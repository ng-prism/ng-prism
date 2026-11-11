import type { CanvasBg } from '../../shared/canvas-bg.type.js';

/**
 * Overlay colours for the absolute canvas grounds.
 *
 * `light` and `dark` paint the same colour whatever the app theme is, and so
 * does the checkerboard of `transparent`, which is drawn from the light ground.
 * The tool rail, the background pill and the pin row on top of them have to
 * follow the ground, not the theme: a dark rail on a light canvas under the dark
 * theme is the case this exists for. The values are the theme surfaces of the
 * matching theme, held to 4.5:1 for text and 3:1 for contours by the spec next
 * to this. The measurement colours repeat the ground's from `CANVAS_BG_STYLES`.
 */
const ON_LIGHT: Record<string, string> = {
    '--prism-canvas-overlay-bg': '#ffffff',
    '--prism-canvas-overlay-fg': '#0f172a',
    '--prism-canvas-overlay-muted': '#334155',
    '--prism-canvas-overlay-border': '#7b8aa0',
    '--prism-canvas-overlay-primary': '#1d4ed8',
    '--prism-canvas-overlay-active': 'color-mix(in srgb, #2563eb 10%, transparent)',
    // The pin row sits on the plate outside the stage, so it needs the ground's
    // measurement colour too. Same literals as CANVAS_BG_STYLES.
    '--prism-measure': '#ca00c1',
    '--prism-measure-plate': 'var(--prism-void-light, #f7f5fc)'
};

const ON_DARK: Record<string, string> = {
    '--prism-canvas-overlay-bg': '#1a2335',
    '--prism-canvas-overlay-fg': '#f1f5f9',
    '--prism-canvas-overlay-muted': '#cbd5e1',
    '--prism-canvas-overlay-border': '#64748b',
    '--prism-canvas-overlay-primary': '#60a5fa',
    '--prism-canvas-overlay-active': 'color-mix(in srgb, #60a5fa 16%, transparent)',
    '--prism-measure': '#f632ff',
    '--prism-measure-plate': 'var(--prism-void-dark, #07050f)'
};

/**
 * The overlay tokens for a ground, bound on `.prism-canvas-wrap`. The two
 * theme-following grounds (`dots` and `plain`) get none: there the defaults in
 * the stylesheet, which point at the theme, apply. `transparent` gets those of
 * `light`, the ground its checkerboard is drawn from.
 */
export function canvasOverlayTokens(bg: CanvasBg): Record<string, string> {
    if (bg === 'light' || bg === 'transparent') return ON_LIGHT;
    if (bg === 'dark') return ON_DARK;
    return {};
}

/** The zoom readout's tooltip, which also carries the viewport width the rail no longer prints. */
export function zoomTitle(zoom: number, viewportWidth: number | null): string {
    return `Zoom ${Math.round(zoom * 100)}% · Width ${viewportWidth === null ? 'auto' : `${viewportWidth}px`}`;
}

/** A rail toggle's tooltip: the tool and whether it is on. */
export function railToggleTitle(label: string, on: boolean): string {
    return `${label}: ${on ? 'on' : 'off'}`;
}

/** What the tools menu holds, the name of the menu and of its trigger: its groups, in menu order. */
export const TOOLS_LABEL = 'Background, state, zoom, width and simulate';

/**
 * The tools trigger's name and tooltip: the menu, plus what is set in it, an
 * active state (`stateName`), a toggled pseudo state or a simulation. The dot
 * on the trigger marks the same while the menu is closed.
 */
export function toolsTitle(stateName: string | null, toggled: boolean, simulating: boolean): string {
    const set = [stateName === null ? null : `${stateName} active`, toggled ? 'pseudo states toggled' : null, simulating ? 'simulation on' : null].filter(
        (part) => part !== null
    );

    return set.length === 0 ? TOOLS_LABEL : `${TOOLS_LABEL} (${set.join(', ')})`;
}
