import type { CanvasBg } from '../../shared/canvas-bg.type.js';
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
        expect(canvasOverlayTokens('light')['--prism-canvas-overlay-bg']).toBe('#ffffff');
        expect(canvasOverlayTokens('dark')['--prism-canvas-overlay-bg']).toBe('#1a2335');
    });

    it.each(['light', 'dark'] as const)('keeps text 4.5:1 and contours 3:1 on the %s overlay', (bg) => {
        const t = canvasOverlayTokens(bg);
        const plate = t['--prism-canvas-overlay-bg'];

        expect(contrast(t['--prism-canvas-overlay-fg'], plate)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['--prism-canvas-overlay-muted'], plate)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['--prism-canvas-overlay-border'], plate)).toBeGreaterThanOrEqual(3);
        expect(contrast(t['--prism-canvas-overlay-primary'], plate)).toBeGreaterThanOrEqual(4.5);
    });

    // Regression: the pin row sits on the overlay plate, outside the stage that
    // re-points the measurement colour, so its chips kept the theme's measure:
    // 3.1:1 on the light ground under the dark theme.
    it.each(['light', 'dark'] as const)('keeps the measurement colour 4.5:1 on the %s overlay', (bg) => {
        const t = canvasOverlayTokens(bg);

        expect(contrast(t['--prism-measure'], t['--prism-canvas-overlay-bg'])).toBeGreaterThanOrEqual(4.5);
    });

    // The checkerboard is light in both themes, so what sits on it follows it
    // and not the theme, like on the light ground it is drawn from.
    it('gives the transparent ground the overlays of the light ground', () => {
        expect(canvasOverlayTokens('transparent')).toEqual(canvasOverlayTokens('light'));
    });

    it.each(['dots', 'plain'] satisfies CanvasBg[])('leaves the theme-following %s ground to the theme', (bg) => {
        expect(canvasOverlayTokens(bg)).toEqual({});
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
