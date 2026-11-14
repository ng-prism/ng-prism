import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { FORCED_PALETTES } from '../simulate/forced-palette.js';
import { PRISM_BASE_TOKENS } from '../theme/prism-default-theme.js';
import { canvasOverlayTokens, railToggleTitle, toolsTitle, zoomTitle } from './canvas-overlay-tokens.js';

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => {
    const [r, g, b] = rgb(hex).map(lin);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

/** The literal a token is read with: `#……` out of `var(--…, #……)`. */
const fallback = (value: string): string => {
    const found = /^var\(--[a-z0-9-]+,\s*(#[0-9a-f]{6})\)$/i.exec(value);

    if (!found) throw new Error(`not a token read with a literal fallback: ${value}`);
    return found[1];
};

/** The overlay role of each token a fixed ground sets, and the theme token that carries it (`--prism-void-<ground>-<role>`). */
const ROLES = {
    '--prism-canvas-overlay-bg': 'overlay-bg',
    '--prism-canvas-overlay-fg': 'overlay-fg',
    '--prism-canvas-overlay-muted': 'overlay-muted',
    '--prism-canvas-overlay-border': 'overlay-border',
    '--prism-canvas-overlay-primary': 'overlay-primary',
    '--prism-measure': 'measure'
} as const;

/** The colours of a fixed ground as its tokens fall back to them, for the contrast checks. */
const defaults = (bg: 'light' | 'dark') => {
    const tokens = canvasOverlayTokens(bg);

    return {
        bg: fallback(tokens['--prism-canvas-overlay-bg']),
        fg: fallback(tokens['--prism-canvas-overlay-fg']),
        muted: fallback(tokens['--prism-canvas-overlay-muted']),
        border: fallback(tokens['--prism-canvas-overlay-border']),
        primary: fallback(tokens['--prism-canvas-overlay-primary']),
        measure: fallback(tokens['--prism-measure'])
    };
};

describe('canvasOverlayTokens', () => {
    /**
     * The two absolute grounds do not follow the app theme, so the rail and the
     * overlays must not either: a dark rail on a light canvas under the dark
     * theme is the case this exists for.
     */
    it.each(['light', 'dark'] as const)('gives the %s ground overlays of its own', (bg) => {
        const tokens = canvasOverlayTokens(bg);

        expect(Object.keys(tokens).sort()).toEqual(
            [
                '--prism-canvas-overlay-active',
                '--prism-canvas-overlay-bg',
                '--prism-canvas-overlay-border',
                '--prism-canvas-overlay-fg',
                '--prism-canvas-overlay-muted',
                '--prism-canvas-overlay-primary',
                '--prism-measure',
                '--prism-measure-plate'
            ].sort()
        );
    });

    it('paints light overlays on the light ground and dark ones on the dark ground', () => {
        expect(defaults('light').bg).toBe('#ffffff');
        expect(defaults('dark').bg).toBe('#1a2335');
    });

    // A project with a mid-tone ground retunes these; the defaults are the fallback of each read.
    it.each(['light', 'dark', 'transparent'] as const)('reads every colour of the %s ground from its token', (bg) => {
        const ground = bg === 'dark' ? 'dark' : 'light';
        const tokens = canvasOverlayTokens(bg);

        for (const [property, role] of Object.entries(ROLES)) {
            const token = `--prism-void-${ground}-${role}`;

            expect(tokens[property]).toBe(`var(${token}, ${PRISM_BASE_TOKENS[token]})`);
        }
        expect(tokens['--prism-measure-plate']).toBe(`var(--prism-void-${ground}, ${PRISM_BASE_TOKENS[`--prism-void-${ground}`]})`);
    });

    // It is a tint of the primary, so a project that retunes the primary retunes the active tool with it.
    it.each([
        ['light', 10],
        ['dark', 16]
    ] as const)('mixes the active tint of the %s ground from the primary token', (bg, share) => {
        const primary = `var(--prism-void-${bg}-overlay-primary, ${PRISM_BASE_TOKENS[`--prism-void-${bg}-overlay-primary`]})`;

        expect(canvasOverlayTokens(bg)['--prism-canvas-overlay-active']).toBe(`color-mix(in srgb, ${primary} ${share}%, transparent)`);
    });

    // What a project that sets none of the tokens sees: the colours the rail and the pills had before they became tokens.
    it('defaults to the colours of the design', () => {
        const light = {
            measure: '#ca00c1',
            'overlay-bg': '#ffffff',
            'overlay-fg': '#0f172a',
            'overlay-muted': '#334155',
            'overlay-border': '#7b8aa0',
            'overlay-primary': '#1d4ed8'
        };
        const dark = {
            measure: '#f632ff',
            'overlay-bg': '#1a2335',
            'overlay-fg': '#f1f5f9',
            'overlay-muted': '#cbd5e1',
            'overlay-border': '#64748b',
            'overlay-primary': '#60a5fa'
        };

        for (const [ground, roles] of [
            ['light', light],
            ['dark', dark]
        ] as const) {
            for (const [role, value] of Object.entries(roles)) expect(PRISM_BASE_TOKENS[`--prism-void-${ground}-${role}`]).toBe(value);
        }
    });

    it.each(['light', 'dark'] as const)('keeps text 4.5:1 and contours 3:1 on the %s overlay', (bg) => {
        const t = defaults(bg);

        expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.muted, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.border, t.bg)).toBeGreaterThanOrEqual(3);
        expect(contrast(t.primary, t.bg)).toBeGreaterThanOrEqual(4.5);
    });

    // Regression: the pin row sits on the overlay plate, outside the stage that
    // re-points the measurement colour, so its chips kept the theme's measure:
    // 3.1:1 on the light ground under the dark theme.
    it.each(['light', 'dark'] as const)('keeps the measurement colour 4.5:1 on the %s overlay', (bg) => {
        const t = defaults(bg);

        expect(contrast(t.measure, t.bg)).toBeGreaterThanOrEqual(4.5);
    });

    // The checkerboard is light in both themes, so what sits on it follows it
    // and not the theme, like on the light ground it is drawn from.
    it('gives the transparent ground the overlays of the light ground', () => {
        expect(canvasOverlayTokens('transparent')).toEqual(canvasOverlayTokens('light'));
    });

    it.each(['dots', 'plain'] satisfies CanvasBg[])('leaves the theme-following %s ground to the theme', (bg) => {
        expect(canvasOverlayTokens(bg)).toEqual({});
    });

    /**
     * Under forced colors the ground is the palette's `Canvas`, which no token
     * of the project reaches: a project that tunes `--prism-void-dark` to a
     * mid-tone blue has not tuned the black the simulation paints. The values
     * are fixed, and so is the plate: the palette's own `Canvas`, not
     * `--prism-void-*`.
     */
    describe('under forced colors', () => {
        const CASES = [
            ['light', '#ffffff'],
            ['dark', '#000000']
        ] as const;

        it.each(CASES)('paints the overlays of the %s palette in fixed colours', (palette, canvas) => {
            // The background of the variant does not matter: the palette wins.
            for (const bg of ['light', 'dark', 'transparent', 'dots', 'plain'] satisfies CanvasBg[]) {
                const tokens = canvasOverlayTokens(bg, palette);

                expect(Object.values(tokens).filter((value) => value.includes('--prism-void'))).toEqual([]);
                expect(tokens['--prism-measure-plate']).toBe(canvas);
            }
        });

        it('takes the plate from the palette', () => {
            expect(canvasOverlayTokens('light', 'dark')['--prism-measure-plate']).toBe(FORCED_PALETTES.dark.canvas);
            expect(canvasOverlayTokens('dark', 'light')['--prism-measure-plate']).toBe(FORCED_PALETTES.light.canvas);
        });

        it('colours the overlays for the palette and not for the background', () => {
            expect(canvasOverlayTokens('light', 'dark')['--prism-canvas-overlay-bg']).toBe('#1a2335');
            expect(canvasOverlayTokens('dark', 'light')['--prism-canvas-overlay-bg']).toBe('#ffffff');
        });

        it.each(CASES)('keeps text 4.5:1 and contours 3:1 on the %s palette overlay, the measurement 4.5:1 on its plate', (palette) => {
            const t = canvasOverlayTokens('dots', palette);
            const bg = t['--prism-canvas-overlay-bg'];

            expect(contrast(t['--prism-canvas-overlay-fg'], bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(t['--prism-canvas-overlay-muted'], bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(t['--prism-canvas-overlay-primary'], bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(t['--prism-canvas-overlay-border'], bg)).toBeGreaterThanOrEqual(3);
            expect(contrast(t['--prism-measure'], t['--prism-measure-plate'])).toBeGreaterThanOrEqual(4.5);
            expect(contrast(t['--prism-measure'], bg)).toBeGreaterThanOrEqual(4.5);
        });

        it('mixes the active tint from the fixed primary', () => {
            expect(canvasOverlayTokens('dots', 'light')['--prism-canvas-overlay-active']).toBe('color-mix(in srgb, #1d4ed8 10%, transparent)');
            expect(canvasOverlayTokens('dots', 'dark')['--prism-canvas-overlay-active']).toBe('color-mix(in srgb, #60a5fa 16%, transparent)');
        });
    });
});

describe('zoomTitle', () => {
    it('names zoom and width', () => {
        expect(zoomTitle(1, null)).toBe('Zoom 100% · Width auto');
        expect(zoomTitle(1.5, 390)).toBe('Zoom 150% · Width 390px');
    });
});

describe('railToggleTitle', () => {
    it('names the tool and its state', () => {
        expect(railToggleTitle('Guides', true)).toBe('Guides: on');
        expect(railToggleTitle('Rulers', false)).toBe('Rulers: off');
    });
});

describe('toolsTitle', () => {
    it('names the menu alone while nothing is set in it', () => {
        expect(toolsTitle(null, false, false)).toBe('Background, state, zoom, width and simulate');
    });

    it('adds the active state and the toggles', () => {
        expect(toolsTitle('Focus visible', false, false)).toBe('Background, state, zoom, width and simulate (Focus visible active)');
        expect(toolsTitle(null, true, false)).toBe('Background, state, zoom, width and simulate (pseudo states toggled)');
        expect(toolsTitle('Hover', true, false)).toBe('Background, state, zoom, width and simulate (Hover active, pseudo states toggled)');
    });

    it('adds the simulation, last as in the menu', () => {
        expect(toolsTitle(null, false, true)).toBe('Background, state, zoom, width and simulate (simulation on)');
        expect(toolsTitle('Hover', true, true)).toBe('Background, state, zoom, width and simulate (Hover active, pseudo states toggled, simulation on)');
    });
});
