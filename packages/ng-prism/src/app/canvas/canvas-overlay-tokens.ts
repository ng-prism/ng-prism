import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { FORCED_PALETTES, type ForcedPaletteName } from '../simulate/forced-palette.js';

/**
 * The colours of one fixed ground: the measurement, and the overlays (the tool
 * rail, the pills, the pin row and the rulers) that sit on it. Each is a theme
 * token, `--prism-void-<ground>-<role>`, with the value here as its default;
 * the same values are the colours under forced colors, which no token reaches.
 */
interface GroundColours {
    measure: string;
    'overlay-bg': string;
    'overlay-fg': string;
    'overlay-muted': string;
    'overlay-border': string;
    'overlay-primary': string;
}

/**
 * The defaults of the light ground. They are the values in `PRISM_BASE_TOKENS`,
 * held to 4.5:1 for text and measurement and 3:1 for contours by the spec next
 * to this, and the measurement colours repeat the ones in `CANVAS_BG_STYLES`:
 * `canvas-overlay-tokens.spec.ts` and `semantic-colours.spec.ts` fail if they
 * drift. They are the theme surfaces of the matching theme.
 */
const LIGHT: GroundColours = {
    measure: '#ca00c1',
    'overlay-bg': '#ffffff',
    'overlay-fg': '#0f172a',
    'overlay-muted': '#334155',
    'overlay-border': '#7b8aa0',
    'overlay-primary': '#1d4ed8'
};

const DARK: GroundColours = {
    measure: '#f632ff',
    'overlay-bg': '#1a2335',
    'overlay-fg': '#f1f5f9',
    'overlay-muted': '#cbd5e1',
    'overlay-border': '#64748b',
    'overlay-primary': '#60a5fa'
};

/** How much of the primary the active tool's tint is: the dark ground needs more of it to show. */
const ACTIVE_SHARE = { light: 10, dark: 16 } as const;

/**
 * The overlay tokens of a ground. `read` turns a role into the value the token
 * takes: a token with its default as the fallback, or the default alone.
 * `plate` is the surface the measurement's value label is drawn on.
 */
function overlayTokens(ground: 'light' | 'dark', read: (role: keyof GroundColours) => string, plate: string): Record<string, string> {
    return {
        '--prism-canvas-overlay-bg': read('overlay-bg'),
        '--prism-canvas-overlay-fg': read('overlay-fg'),
        '--prism-canvas-overlay-muted': read('overlay-muted'),
        '--prism-canvas-overlay-border': read('overlay-border'),
        '--prism-canvas-overlay-primary': read('overlay-primary'),
        '--prism-canvas-overlay-active': `color-mix(in srgb, ${read('overlay-primary')} ${ACTIVE_SHARE[ground]}%, transparent)`,
        // The pin row sits on the plate outside the stage, so it needs the
        // ground's measurement colour too, not only the stage that re-points it.
        '--prism-measure': read('measure'),
        '--prism-measure-plate': plate
    };
}

const reads =
    (ground: 'light' | 'dark', defaults: GroundColours) =>
    (role: keyof GroundColours): string =>
        `var(--prism-void-${ground}-${role}, ${defaults[role]})`;

const ON_LIGHT = overlayTokens('light', reads('light', LIGHT), 'var(--prism-void-light, #f7f5fc)');
const ON_DARK = overlayTokens('dark', reads('dark', DARK), 'var(--prism-void-dark, #07050f)');

/**
 * Under forced colors the ground is the palette's `Canvas`, which is not
 * `--prism-void-*`: a project that tunes `--prism-void-dark` to a mid-tone blue
 * has not tuned the black the simulation paints, and its tokens for that blue
 * would put a light overlay on `Canvas` black. So the overlays take the
 * defaults, fixed, and the plate is the palette's `Canvas` itself, as a value
 * (the keyword would resolve against the browser's normal palette).
 */
const FORCED_ON_LIGHT = overlayTokens('light', (role) => LIGHT[role], FORCED_PALETTES.light.canvas);
const FORCED_ON_DARK = overlayTokens('dark', (role) => DARK[role], FORCED_PALETTES.dark.canvas);

/**
 * The overlay tokens for a ground, bound on `.prism-canvas-wrap`. The two
 * theme-following grounds (`dots` and `plain`) get none: there the defaults in
 * the stylesheet, which point at the theme, apply. `transparent` gets those of
 * `light`, the ground its checkerboard is drawn from.
 *
 * `light` and `dark` paint the same colour whatever the app theme is, and so
 * does the checkerboard, so the rail, the pills and the pin row on top of them
 * follow the ground, not the theme: a dark rail on a light canvas under the
 * dark theme is the case this exists for. Each colour is read from a theme token
 * of the ground (`--prism-void-light-overlay-bg` and so on), so that a project
 * with a mid-tone ground can set the ones that hold on it.
 *
 * Under forced colors `palette` wins over `bg`, and the values are fixed, see
 * {@link FORCED_ON_LIGHT}: the ground is the palette's `Canvas` then, whatever
 * the background is, so a `light` background under the dark palette is a dark
 * ground.
 */
export function canvasOverlayTokens(bg: CanvasBg, palette: ForcedPaletteName | null = null): Record<string, string> {
    if (palette) return palette === 'light' ? FORCED_ON_LIGHT : FORCED_ON_DARK;
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
