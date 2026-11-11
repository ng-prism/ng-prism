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

    it('keeps the checkerboard for theme-dependent backgrounds', () => {
        // `dots` and `plain` both paint `--prism-bg-surface`, a theme token. The
        // panel cannot know which theme the runner's browser was in, so claiming
        // a colour here would be a guess painted as fact.
        expect(shotSurfaceStyle('dots')).toEqual({});
        expect(shotSurfaceStyle('plain')).toEqual({});
    });

    it('keeps the checkerboard for a background that no longer exists', () => {
        // A report from before 22.8.0 can still say `checker`, and it is read
        // from disk long after the value left the type.
        expect(shotSurfaceStyle('checker' as CanvasBg)).toEqual({});
    });

    it('keeps the checkerboard when the report recorded no background', () => {
        expect(shotSurfaceStyle(undefined)).toEqual({});
    });

    it('declares no background at all for a transparent capture', () => {
        // This works by omission: `SURFACE` has no `transparent` entry, so the
        // lookup falls through. Making `SURFACE` a total record or adding a
        // default would paint over every transparent capture, and the panel
        // would still look plausible.
        expect(shotSurfaceStyle('transparent')).toEqual({});
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
