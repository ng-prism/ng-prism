import type { CanvasBg } from '@ng-prism/core/plugin';
import type { VrtVariantResult } from './visual-regression.types.js';
import { bgChange, shotSurfaceStyle } from './vrt-bg.js';

function result(patch: Partial<VrtVariantResult> = {}): VrtVariantResult {
    return {
        className: 'ButtonComponent',
        variantIndex: 0,
        status: 'unchanged',
        ...patch
    };
}

describe('shotSurfaceStyle', () => {
    it('paints the declared light surface and drops the checkerboard', () => {
        expect(shotSurfaceStyle('light')).toEqual({
            'background-color': 'var(--prism-void-light, #f7f5fc)',
            'background-image': 'none'
        });
    });

    it('paints the declared dark surface', () => {
        expect(shotSurfaceStyle('dark')).toEqual({
            'background-color': 'var(--prism-void-dark, #07050f)',
            'background-image': 'none'
        });
    });

    it('keeps the theme checkerboard for dots, plain and an older checker report', () => {
        // `dots` and `plain` both paint `--prism-bg-surface`, a theme token. The
        // panel cannot know which theme the runner's browser was in, so claiming
        // a colour here would be a guess painted as fact. A report from before
        // 22.8.0 can still say `checker`, and it is read from disk long after
        // the value left the type.
        expect(shotSurfaceStyle('dots')).toEqual({});
        expect(shotSurfaceStyle('plain')).toEqual({});
        expect(shotSurfaceStyle('checker' as CanvasBg)).toEqual({});
    });

    it('lays a transparent capture on the fixed light checkerboard of the canvas', () => {
        // The capture has a real alpha channel and dark inherited text, so the
        // board behind it has to be the light one in both themes. Only colours
        // come from here; the CSS keeps size and position.
        const style = shotSurfaceStyle('transparent');
        const square = 'color-mix(in srgb, var(--prism-void-light, #f7f5fc) 94%, #0f172a)';

        expect(style['background-color']).toBe('var(--prism-void-light, #f7f5fc)');
        expect(style['background-image'].split(square)).toHaveLength(5);
        expect(Object.keys(style).sort()).toEqual(['background-color', 'background-image']);
    });

    it('lays a capture without a recorded background on the same checkerboard', () => {
        expect(shotSurfaceStyle(undefined)).toEqual(shotSurfaceStyle('transparent'));
        expect(shotSurfaceStyle(undefined)['background-image']).toContain('linear-gradient(45deg');
    });

    it('treats a null or empty bg from a hand-written report as no background', () => {
        // The report is JSON from the runner, not typed data: a runner that
        // writes `"bg": null` or `"bg": ""` for "unknown" must not get the theme
        // checkerboard, which the docs promise only to an empty result.
        expect(shotSurfaceStyle(null as unknown as CanvasBg)).toEqual(shotSurfaceStyle('transparent'));
        expect(shotSurfaceStyle('' as unknown as CanvasBg)).toEqual(shotSurfaceStyle('transparent'));
    });
});

describe('bgChange', () => {
    it('reports a background that moved between baseline and this run', () => {
        expect(bgChange(result({ baselineBg: 'dark', bg: 'light' }))).toEqual({
            from: 'dark',
            to: 'light'
        });
    });

    it('returns null when the background held', () => {
        expect(bgChange(result({ baselineBg: 'dark', bg: 'dark' }))).toBeNull();
    });

    it('returns null unless the runner recorded both', () => {
        // A single value cannot show a change: `bg` is this run, and without the
        // baseline's own there is nothing to compare it against.
        expect(bgChange(result({ bg: 'light' }))).toBeNull();
        expect(bgChange(result({ baselineBg: 'dark' }))).toBeNull();
        expect(bgChange(result())).toBeNull();
    });
});
