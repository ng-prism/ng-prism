import { escapeEnd, identEnd, stringEnd } from '../pseudo/pseudo-selector.js';

/** Chromium's forced colors follow the emulated `prefers-color-scheme`, which gives the two palettes. */
export type ForcedPaletteName = 'light' | 'dark';

/**
 * The system colors Chromium resolves in forced colors mode, in lower case as
 * they are matched: the ones of CSS Color 4, then the deprecated ones
 * ({@link DEPRECATED_SYSTEM_COLORS}). Not among them: `InactiveCaptionText`,
 * which Chromium leaves at its normal value in the mode.
 */
export const SYSTEM_COLORS = [
    'canvas',
    'canvastext',
    'linktext',
    'visitedtext',
    'activetext',
    'buttonface',
    'buttontext',
    'buttonborder',
    'field',
    'fieldtext',
    'highlight',
    'highlighttext',
    'selecteditem',
    'selecteditemtext',
    'mark',
    'marktext',
    'graytext',
    'accentcolor',
    'accentcolortext',
    'activeborder',
    'activecaption',
    'appworkspace',
    'background',
    'buttonhighlight',
    'buttonshadow',
    'captiontext',
    'inactiveborder',
    'inactivecaption',
    'infobackground',
    'infotext',
    'menu',
    'menutext',
    'scrollbar',
    'threeddarkshadow',
    'threedface',
    'threedhighlight',
    'threedlightshadow',
    'threedshadow',
    'window',
    'windowframe',
    'windowtext'
] as const;

export type SystemColor = (typeof SYSTEM_COLORS)[number];

const SYSTEM_COLOR_SET: ReadonlySet<string> = new Set(SYSTEM_COLORS);

/** The system colors that CSS Color 4 deprecates in favor of the ones with a purpose in their name. */
export const DEPRECATED_SYSTEM_COLORS: ReadonlySet<string> = new Set<SystemColor>([
    'activeborder',
    'activecaption',
    'appworkspace',
    'background',
    'buttonhighlight',
    'buttonshadow',
    'captiontext',
    'inactiveborder',
    'inactivecaption',
    'infobackground',
    'infotext',
    'menu',
    'menutext',
    'scrollbar',
    'threeddarkshadow',
    'threedface',
    'threedhighlight',
    'threedlightshadow',
    'threedshadow',
    'window',
    'windowframe',
    'windowtext'
]);

/**
 * The system colors Chromium leaves at the platform's value in forced colors
 * mode, in both palettes: `SelectedItem` is `#b3d7ff` on macOS and `#1967d2` on
 * Linux, so no table can hold them. {@link readPlatformColors} asks the browser.
 */
export type PlatformColor = 'selecteditem' | 'selecteditemtext';

const PLATFORM_COLORS: readonly PlatformColor[] = ['selecteditem', 'selecteditemtext'];

function isPlatformColor(color: SystemColor): color is PlatformColor {
    return (PLATFORM_COLORS as readonly string[]).includes(color);
}

/**
 * What each system color resolves to in Chromium's forced colors mode, as
 * `computed` reports it for an element with `forced-color-adjust: none`, which
 * is where a system color stands as the author wrote it. Opaque values are
 * `#rrggbb`, translucent ones `rgba(r, g, b, a)`; {@link rgbChannels} reads
 * the first.
 *
 * Chromium does not remap every one of them: `Mark`, `MarkText`, `AccentColor`
 * and `AccentColorText` keep their normal value in both palettes, and the
 * {@link PlatformColor}s, which are not in the table, the platform's. A spec
 * measures the table in Chromium, so it cannot drift
 * (forced-palette.chromium.spec.ts).
 */
export const FORCED_PALETTES: Readonly<Record<ForcedPaletteName, Readonly<Record<Exclude<SystemColor, PlatformColor>, string>>>> = {
    light: {
        canvas: '#ffffff',
        canvastext: '#000000',
        linktext: '#00009f',
        visitedtext: '#00009f',
        activetext: '#00009f',
        buttonface: '#ffffff',
        buttontext: '#000000',
        buttonborder: '#000000',
        field: '#ffffff',
        fieldtext: '#000000',
        highlight: 'rgba(5, 0, 73, 0.8)',
        highlighttext: '#ffffff',
        mark: '#ffff00',
        marktext: '#000000',
        graytext: '#600000',
        accentcolor: '#0075ff',
        accentcolortext: '#ffffff',
        activeborder: '#000000',
        activecaption: '#ffffff',
        appworkspace: '#ffffff',
        background: '#ffffff',
        buttonhighlight: '#ffffff',
        buttonshadow: '#ffffff',
        captiontext: '#000000',
        inactiveborder: '#000000',
        inactivecaption: '#ffffff',
        infobackground: '#ffffff',
        infotext: '#000000',
        menu: '#ffffff',
        menutext: '#000000',
        scrollbar: '#ffffff',
        threeddarkshadow: '#000000',
        threedface: '#ffffff',
        threedhighlight: '#000000',
        threedlightshadow: '#000000',
        threedshadow: '#000000',
        window: '#ffffff',
        windowframe: '#000000',
        windowtext: '#000000'
    },
    dark: {
        canvas: '#000000',
        canvastext: '#ffffff',
        linktext: '#ffff00',
        visitedtext: '#ffff00',
        activetext: '#ffff00',
        buttonface: '#000000',
        buttontext: '#ffffff',
        buttonborder: '#ffffff',
        field: '#000000',
        fieldtext: '#ffffff',
        highlight: 'rgba(0, 230, 255, 0.8)',
        highlighttext: '#000000',
        mark: '#ffff00',
        marktext: '#000000',
        graytext: '#3ff23f',
        accentcolor: '#0075ff',
        accentcolortext: '#ffffff',
        activeborder: '#ffffff',
        activecaption: '#000000',
        appworkspace: '#000000',
        background: '#000000',
        buttonhighlight: '#000000',
        buttonshadow: '#000000',
        captiontext: '#ffffff',
        inactiveborder: '#ffffff',
        inactivecaption: '#000000',
        infobackground: '#000000',
        infotext: '#ffffff',
        menu: '#000000',
        menutext: '#ffffff',
        scrollbar: '#000000',
        threeddarkshadow: '#ffffff',
        threedface: '#000000',
        threedhighlight: '#ffffff',
        threedlightshadow: '#ffffff',
        threedshadow: '#ffffff',
        window: '#000000',
        windowframe: '#ffffff',
        windowtext: '#ffffff'
    }
};

/** What the browser resolves each {@link PlatformColor} to, once {@link readPlatformColors} has asked it. */
const platformValues = new Map<PlatformColor, string>();

/**
 * Asks the browser of `doc`, once, what the {@link PlatformColor}s resolve to
 * in a light color scheme: the value Chromium leaves them at in both palettes of
 * a page that sets no `color-scheme`. Not in the scope root's, which is `dark`
 * under the dark palette and gives another blue. A browser that does not
 * resolve them leaves {@link forcedColor} with the keywords.
 */
export function readPlatformColors(doc: Document): void {
    const view = doc.defaultView;

    if (platformValues.size > 0 || !view || !doc.documentElement) return;

    const probe = doc.createElement('span');

    probe.style.setProperty('color-scheme', 'light', 'important');
    probe.style.setProperty('display', 'none', 'important');
    doc.documentElement.append(probe);
    try {
        for (const color of PLATFORM_COLORS) {
            probe.style.setProperty('color', color, 'important');

            const value = view.getComputedStyle(probe).color;

            if (value.startsWith('rgb')) platformValues.set(color, value);
        }
    } finally {
        probe.remove();
    }
}

/** `color` in `palette`: its value in {@link FORCED_PALETTES}, or the browser's for a {@link PlatformColor} ({@link readPlatformColors}). */
export function forcedColor(palette: ForcedPaletteName, color: SystemColor): string {
    return isPlatformColor(color) ? (platformValues.get(color) ?? color) : FORCED_PALETTES[palette][color];
}

/** The system colors Chromium forces like any other color the author sets: to `CanvasText` as a text or border color, to `Canvas` as a background. */
const FORCED_SYSTEM_COLORS: ReadonlySet<string> = new Set<SystemColor>(['accentcolor', 'accentcolortext']);

/**
 * The system colors that stand as the author wrote them under
 * `forced-color-adjust: auto`, with their value in {@link FORCED_PALETTES}:
 * Chromium forces what an author sets but lets all system colors stand except
 * `AccentColor` and `AccentColorText`. A spec measures the set in Chromium.
 */
export const KEPT_SYSTEM_COLORS: ReadonlySet<string> = new Set(SYSTEM_COLORS.filter((color) => !FORCED_SYSTEM_COLORS.has(color)));

export interface SystemColorOptions {
    /** Whether the deprecated system colors count (default). `false` for a value that is to stand for an author's own custom property. */
    deprecated?: boolean;
}

const LIGHT_DARK = /^light-dark\(([^(),]*),([^(),]*)\)$/;

/** Whether `test` holds for `value` as a keyword, or for both of the two of a `light-dark()`. */
function everyKeyword(value: string, test: (keyword: string) => boolean): boolean {
    const normalized = value.trim().toLowerCase();
    const pair = LIGHT_DARK.exec(normalized);

    return pair ? test(pair[1].trim()) && test(pair[2].trim()) : test(normalized);
}

/** Whether `value` is a bare system color keyword in any case, or `light-dark()` of two. */
export function isSystemColor(value: string, { deprecated = true }: SystemColorOptions = {}): boolean {
    return everyKeyword(value, (keyword) => SYSTEM_COLOR_SET.has(keyword) && (deprecated || !DEPRECATED_SYSTEM_COLORS.has(keyword)));
}

/** Whether `value` is a system color ({@link isSystemColor}) that Chromium leaves standing under `forced-color-adjust: auto`. */
export function keepsSystemColor(value: string, { deprecated = true }: SystemColorOptions = {}): boolean {
    return everyKeyword(value, (keyword) => KEPT_SYSTEM_COLORS.has(keyword) && (deprecated || !DEPRECATED_SYSTEM_COLORS.has(keyword)));
}

/** Properties that take a color, besides the families of {@link COLOR_FAMILIES}. */
const COLOR_PROPERTIES: ReadonlySet<string> = new Set([
    'color',
    'box-shadow',
    'text-shadow',
    'caret-color',
    'accent-color',
    'scrollbar-color',
    'fill',
    'stroke',
    'stop-color',
    'flood-color',
    'lighting-color',
    'filter',
    '-webkit-text-fill-color',
    '-webkit-tap-highlight-color'
]);

/** Shorthands that take a color and the longhands that share their prefix. */
const COLOR_FAMILIES = ['background', 'border', 'outline', 'text-decoration', 'text-emphasis', 'column-rule', 'row-rule', '-webkit-text-stroke'];

/**
 * Whether a value of `property` can hold a color, which is where a system
 * color keyword is one. A keyword that doubles as another word, `Background`
 * in `transition: background 0.2s`, is none. Custom properties carry no
 * color of their own.
 */
export function carriesColor(property: string): boolean {
    const name = property.toLowerCase();

    if (name.startsWith('--')) return false;

    return COLOR_PROPERTIES.has(name) || COLOR_FAMILIES.some((family) => name === family || name.startsWith(`${family}-`));
}

/**
 * Every system color keyword in `value` as a whole token, outside strings and
 * `url()`, replaced by its value in `palette` ({@link forcedColor}). A hyphen, a digit and an
 * underscore belong to a name (`--canvas-bg`, `canvas-x`), as do escapes: a
 * name with one is left alone.
 *
 * It works on a value and knows nothing of the property it belongs to:
 * {@link resolveSystemColors} applies it where a system color can be.
 */
export function substituteSystemColors(value: string, palette: ForcedPaletteName): string {
    let out = '';
    let i = 0;

    while (i < value.length) {
        const ch = value[i];
        let end = i + 1;

        if (ch === '"' || ch === "'") {
            end = stringEnd(value, i);
        } else {
            const identifierEnd = identEnd(value, i);

            if (identifierEnd > i) {
                const name = value.slice(i, identifierEnd);
                const keyword = name.toLowerCase();

                if (value[identifierEnd] === '(' && keyword === 'url') {
                    end = urlEnd(value, identifierEnd);
                } else if (SYSTEM_COLOR_SET.has(keyword) && !name.includes('\\')) {
                    out += forcedColor(palette, keyword as SystemColor);
                    i = identifierEnd;
                    continue;
                } else {
                    end = identifierEnd;
                }
            }
        }
        out += value.slice(i, end);
        i = end;
    }
    return out;
}

/**
 * The value of a declaration of `property` with its system colors in
 * `palette` ({@link substituteSystemColors}), where a system color can be one:
 * in a property that takes a color ({@link carriesColor}), and in a custom
 * property whose whole value is a system color that is not deprecated. A
 * custom property is a list of tokens until a property uses it, and
 * `--x: Background` is as likely a word as a color.
 */
export function resolveSystemColors(property: string, value: string, palette: ForcedPaletteName): string {
    const resolves = property.startsWith('--') ? isSystemColor(value, { deprecated: false }) : carriesColor(property);

    return resolves ? substituteSystemColors(value, palette) : value;
}

/** End of the `url(…)` whose `(` is at `open`: past its closing bracket, with strings and escapes inside skipped. */
function urlEnd(s: string, open: number): number {
    let i = open + 1;

    while (i < s.length) {
        if (s[i] === '"' || s[i] === "'") i = stringEnd(s, i);
        else if (s[i] === '\\') i = escapeEnd(s, i);
        else if (s[i] === ')') return i + 1;
        else i++;
    }
    return i;
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** The channels of an opaque color as `r g b`: '0 0 0' for '#000000'. */
export function rgbChannels(color: string): string {
    const match = HEX_COLOR.exec(color);

    if (!match) throw new Error(`Not an opaque #rrggbb color: ${color}`);

    return match
        .slice(1)
        .map((channel) => parseInt(channel, 16))
        .join(' ');
}
