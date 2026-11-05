import { DEFAULT_VARIANT_BG } from '../../shared/variant-bg.js';
import { overviewGround, playgroundGround } from './ground.js';

describe('playgroundGround', () => {
    const base = { override: null, recommended: null, chosen: false, canvasBg: 'dots' as const, scheme: 'dark' as const };

    it('follows the emulated scheme while nothing else decides', () => {
        expect(playgroundGround(base)).toBe('dark');
        expect(playgroundGround({ ...base, scheme: 'light' })).toBe('light');
    });

    it('keeps a background the user picked over the scheme', () => {
        expect(playgroundGround({ ...base, chosen: true })).toBe('dots');
    });

    it('keeps the canvas background without an emulated scheme', () => {
        expect(playgroundGround({ ...base, scheme: null })).toBe('dots');
        expect(playgroundGround({ ...base, scheme: null, chosen: true, canvasBg: 'plain' })).toBe('plain');
    });

    it('keeps what the variant recommends over the scheme', () => {
        expect(playgroundGround({ ...base, recommended: 'light' })).toBe('light');
        expect(playgroundGround({ ...base, recommended: 'light', chosen: true })).toBe('light');
    });

    it('keeps the override over everything', () => {
        expect(playgroundGround({ ...base, override: 'checker', recommended: 'light' })).toBe('checker');
        expect(playgroundGround({ ...base, override: 'plain', chosen: true })).toBe('plain');
    });
});

describe('overviewGround', () => {
    it('follows the emulated scheme when the variant declares nothing', () => {
        expect(overviewGround(null, 'light')).toBe('light');
        expect(overviewGround(null, 'dark')).toBe('dark');
    });

    it('falls back to the tooling default without a scheme', () => {
        expect(overviewGround(null, null)).toBe(DEFAULT_VARIANT_BG);
    });

    it('keeps a declared background over the scheme', () => {
        expect(overviewGround('dark', 'light')).toBe('dark');
        expect(overviewGround('plain', null)).toBe('plain');
    });
});
