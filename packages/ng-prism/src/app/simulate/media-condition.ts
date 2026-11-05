import type { EmulatedMedia } from './simulation.js';

/** A feature test that is always true. */
export const MEDIA_TRUE = '(min-width: 0px)';

/**
 * A feature test that is never true: no width is at most 0px and at least 1px.
 * The parentheses around the pair make it read as one test, so it stands
 * wherever a `(feature: value)` stood, behind `not` and `and` as well.
 */
export const MEDIA_FALSE = '((max-width: 0px) and (min-width: 1px))';

const FEATURES: readonly (keyof EmulatedMedia)[] = ['prefers-reduced-motion', 'prefers-color-scheme', 'forced-colors'];

/**
 * One parenthesised test of an emulated feature, `(feature)` or
 * `(feature: value)`: the name in group 1, the value, when there is one, in
 * group 2. Case-insensitive and tolerant of whitespace, since the text may be
 * hand-written or the browser's serialisation of it.
 */
const FEATURE_TEST = new RegExp(String.raw`\(\s*(${FEATURES.join('|')})\s*(?::\s*([^)]*?))?\s*\)`, 'gi');

/** Values that mean a feature is not active, so its boolean context `(feature)` is false. */
const INACTIVE_VALUES: ReadonlySet<string> = new Set(['no-preference', 'none']);

/** Whether the media query list tests a feature that `emulated` answers. */
export function mentionsEmulated(mediaText: string, emulated: EmulatedMedia): boolean {
    return Array.from(mediaText.matchAll(FEATURE_TEST)).some((test) => emulatedValue(test[1], emulated) !== undefined);
}

/**
 * The media query list with every test of an emulated feature settled:
 * {@link MEDIA_TRUE} where the emulated value satisfies it, {@link MEDIA_FALSE}
 * where it does not. Everything else, from the media type to the tests of other
 * features, stays as written and keeps being answered by the browser.
 *
 * The result is a valid media query list, so the browser can evaluate it, which
 * is how `matchMedia` answers for a query that mixes an emulated test with a live
 * one. A bare `(feature)` asks whether the feature is active at all: true, as no
 * emulation takes an inactive value.
 */
export function substituteMedia(mediaText: string, emulated: EmulatedMedia): string {
    return mediaText.replace(FEATURE_TEST, (test: string, name: string, value: string | undefined) => {
        const actual = emulatedValue(name, emulated);

        if (actual === undefined) return test;

        const holds = value === undefined ? !INACTIVE_VALUES.has(actual) : value.trim().toLowerCase() === actual;

        return holds ? MEDIA_TRUE : MEDIA_FALSE;
    });
}

/** What `emulated` says for the feature `name` (in any case), or `undefined` when it leaves it to the browser. */
function emulatedValue(name: string, emulated: EmulatedMedia): string | undefined {
    const lower = name.toLowerCase();
    const feature = FEATURES.find((candidate) => candidate === lower);

    return feature === undefined ? undefined : emulated[feature];
}
