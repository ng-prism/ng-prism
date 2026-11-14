import { DEFAULT_VARIANT_BG } from '../../shared/variant-bg.js';
import { groundSimulation, NO_GROUND_SIMULATION, overviewGround, playgroundGround } from './ground.js';
import type { ScopeRootState } from './scope-root.js';

describe('playgroundGround', () => {
    const base = { override: null, recommended: null, picked: null, scheme: 'dark' as const, fallback: null };

    it('follows the emulated scheme while nothing else decides', () => {
        expect(playgroundGround(base)).toBe('dark');
        expect(playgroundGround({ ...base, scheme: 'light' })).toBe('light');
    });

    it('keeps a background the user picked over the scheme', () => {
        expect(playgroundGround({ ...base, picked: 'dots' })).toBe('dots');
    });

    it('keeps the canvas background without an emulated scheme', () => {
        expect(playgroundGround({ ...base, scheme: null })).toBe('dots');
        expect(playgroundGround({ ...base, scheme: null, picked: 'plain' })).toBe('plain');
    });

    it('keeps what the variant recommends over the scheme', () => {
        expect(playgroundGround({ ...base, recommended: 'light' })).toBe('light');
        expect(playgroundGround({ ...base, recommended: 'light', picked: 'dots' })).toBe('light');
    });

    it('keeps the override over everything', () => {
        expect(playgroundGround({ ...base, override: 'transparent', recommended: 'light' })).toBe('transparent');
        expect(playgroundGround({ ...base, override: 'plain', picked: 'dots' })).toBe('plain');
    });
});

describe('playgroundGround with a project fallback', () => {
    const base = { override: null, recommended: null, picked: null, scheme: null, fallback: 'light' as const };

    it('paints the fallback where nobody decided', () => {
        expect(playgroundGround(base)).toBe('light');
    });

    it('lets an emulated scheme win over it', () => {
        expect(playgroundGround({ ...base, scheme: 'dark' })).toBe('dark');
    });

    it('lets the background the user picked win over it, a picked dots included', () => {
        expect(playgroundGround({ ...base, picked: 'dots' })).toBe('dots');
        expect(playgroundGround({ ...base, picked: 'plain', scheme: 'dark' })).toBe('plain');
    });

    it('lets a declared background and the override win over it', () => {
        expect(playgroundGround({ ...base, recommended: 'dark' })).toBe('dark');
        expect(playgroundGround({ ...base, override: 'plain', recommended: 'dark' })).toBe('plain');
    });

    it('is the canvas background as before without a fallback', () => {
        expect(playgroundGround({ ...base, fallback: null })).toBe('dots');
        expect(playgroundGround({ ...base, fallback: null, scheme: 'dark' })).toBe('dark');
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

    describe('with a project fallback', () => {
        it('paints the fallback instead of the tooling default', () => {
            expect(overviewGround(null, null, 'light')).toBe('light');
        });

        it('lets the emulated scheme win over it', () => {
            expect(overviewGround(null, 'dark', 'light')).toBe('dark');
        });

        it('lets a declared background win over it', () => {
            expect(overviewGround('plain', null, 'light')).toBe('plain');
            expect(overviewGround('dark', 'light', 'light')).toBe('dark');
        });

        it('is the tooling default for a null fallback', () => {
            expect(overviewGround(null, null, null)).toBe(DEFAULT_VARIANT_BG);
        });
    });
});

describe('groundSimulation', () => {
    const root = (o: Partial<ScopeRootState>): ScopeRootState => ({ colorScheme: null, filter: null, themeClass: null, themeAttributes: {}, ...o });

    it('changes nothing about the stage while nothing is simulated', () => {
        expect(groundSimulation(null, null)).toEqual({ forced: null, vision: null, filter: null, colorScheme: null, canvas: null });
        expect(groundSimulation(null, null)).toBe(NO_GROUND_SIMULATION);
    });

    it('leaves the scheme of the stage alone while only a scheme is emulated', () => {
        // The ground follows the scheme through `data-bg` then; nothing on it resolves a system colour.
        expect(groundSimulation(root({ colorScheme: 'dark', themeClass: 'tl-dark' }), null)).toEqual(NO_GROUND_SIMULATION);
    });

    it("paints the ground the palette's Canvas under forced colors, and gives the stage the palette's scrollbars", () => {
        expect(groundSimulation(null, 'dark').canvas).toBe('#000000');
        expect(groundSimulation(root({ colorScheme: 'dark' }), 'dark')).toEqual({ forced: '', vision: null, filter: null, colorScheme: 'dark', canvas: '#000000' });
        expect(groundSimulation(root({ colorScheme: 'light' }), 'light')).toEqual({ forced: '', vision: null, filter: null, colorScheme: 'light', canvas: '#ffffff' });
    });

    it('filters the ground with the vision setting', () => {
        expect(groundSimulation(root({ filter: 'url(#prism-vision-protanopia)' }), null)).toEqual({
            forced: null,
            vision: '',
            filter: 'url(#prism-vision-protanopia)',
            colorScheme: null,
            canvas: null
        });
    });

    it('combines forced colors and vision', () => {
        expect(groundSimulation(root({ colorScheme: 'light', filter: 'blur(1.5px)' }), 'light')).toEqual({
            forced: '',
            vision: '',
            filter: 'blur(1.5px)',
            colorScheme: 'light',
            canvas: '#ffffff'
        });
    });
});
