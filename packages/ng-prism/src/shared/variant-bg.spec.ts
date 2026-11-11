import { CANVAS_BGS, type CanvasBg } from './canvas-bg.type.js';
import { declaredVariantBg, DEFAULT_VARIANT_BG, resolveVariantBg } from './variant-bg.js';

/**
 * A variant as `@Showcase` actually declares one.
 *
 * Built through a function because `VariantBgSource` only describes the field
 * this module reads (so nothing here imports `ShowcaseConfig`), and the excess
 * property check would reject a `name` in an inline argument literal. The name
 * keeps "variant A" and "variant B" readable in the assertions below.
 */
function variant(name: string, bg?: CanvasBg) {
    return { name, bg };
}

describe('CANVAS_BGS', () => {
    it('no longer lists the removed checker background', () => {
        expect(CANVAS_BGS).not.toContain('checker');
    });
});

describe('declaredVariantBg', () => {
    it('returns null when neither level declares a bg', () => {
        expect(declaredVariantBg({ variants: [variant('A')] }, 0)).toBeNull();
    });

    it('returns the component bg when the variant declares none', () => {
        expect(declaredVariantBg({ bg: 'dark', variants: [variant('A')] }, 0)).toBe('dark');
    });

    it('lets the variant bg win over the component bg', () => {
        expect(declaredVariantBg({ bg: 'dark', variants: [variant('A', 'light')] }, 0)).toBe('light');
    });

    it('resolves per index, not per component', () => {
        const config = {
            bg: 'dark' as const,
            variants: [variant('A', 'light'), variant('B')]
        };

        expect(declaredVariantBg(config, 0)).toBe('light');
        expect(declaredVariantBg(config, 1)).toBe('dark');
    });

    it('falls back to the component bg for an out-of-range index', () => {
        // The renderer clamps an unknown `?variant=` to index 0, so an index with
        // no variant behind it must still answer with the component's declaration
        // rather than pretending nothing was declared.
        expect(declaredVariantBg({ bg: 'dark', variants: [] }, 7)).toBe('dark');
    });

    it('handles a config with no variants at all', () => {
        expect(declaredVariantBg({ bg: 'plain' }, 0)).toBe('plain');
        expect(declaredVariantBg({}, 0)).toBeNull();
    });
});

describe('resolveVariantBg', () => {
    it('falls back to the default when nothing is declared', () => {
        expect(resolveVariantBg({}, 0)).toBe(DEFAULT_VARIANT_BG);
        expect(resolveVariantBg({}, 0)).toBe('transparent');
    });

    it('returns the declared bg when there is one', () => {
        expect(resolveVariantBg({ bg: 'dark' }, 0)).toBe('dark');
        expect(resolveVariantBg({ bg: 'dark', variants: [variant('A', 'plain')] }, 0)).toBe('plain');
    });
});
