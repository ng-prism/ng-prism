import type { ThreadGenerator } from '@revideo/core';
import { FONT_MONO, FONT_SANS } from '../brand.ts';

const REQUIRED: ReadonlyArray<readonly [family: string, weight: string]> = [
    [FONT_SANS, '700'],
    [FONT_SANS, '800'],
    [FONT_MONO, '500']
];

/**
 * Loads the brand fonts before the first frame and fails the render when one is missing. `document.fonts.check()`
 * alone would not do: it reports true for a family that has no @font-face at all.
 */
export function* ensureFonts(): ThreadGenerator {
    for (const [family, weight] of REQUIRED) yield document.fonts.load(`${weight} 48px "${family}"`);
    for (const [family, weight] of REQUIRED) {
        const loaded = [...document.fonts].some((face) => face.family.replace(/["']/g, '') === family && face.weight === weight && face.status === 'loaded');
        if (!loaded) throw new Error(`Font not loaded: ${family}`);
    }
}
