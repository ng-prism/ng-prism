/** `System` leaves the preference alone, `Reduce` emulates `prefers-reduced-motion: reduce`. */
export type MotionSetting = 'system' | 'reduce';

/** `System` leaves `prefers-color-scheme` alone, the others emulate it. */
export type SchemeSetting = 'system' | 'light' | 'dark';

/** `Active` emulates `forced-colors: active`, as an approximation (the browser has no switch for it). */
export type ForcedSetting = 'off' | 'active';

/** A colour-vision deficiency or a blur, drawn as a filter over the component. */
export type VisionSetting = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia' | 'blurred';

/**
 * What the canvas pretends about the user's environment, one field per row of
 * the Simulate group in the tools menu.
 *
 * Every field has a neutral value ({@link DEFAULT_SIMULATION}) that means "do
 * nothing", so a simulation that differs nowhere changes nothing and leaves no
 * trace in the URL or the pills.
 */
export interface Simulation {
    motion: MotionSetting;
    scheme: SchemeSetting;
    forced: ForcedSetting;
    vision: VisionSetting;
}

/** The simulation that changes nothing. */
export const DEFAULT_SIMULATION: Readonly<Simulation> = Object.freeze({
    motion: 'system',
    scheme: 'system',
    forced: 'off',
    vision: 'none'
});

/**
 * The values of {@link Simulation.motion} in menu order, neutral one first.
 *
 * The `*_SETTINGS` arrays are the single source for the tools menu and for
 * validating a value that comes from outside (URL, session storage): a value
 * missing here could be neither shown as active nor restored.
 */
export const MOTION_SETTINGS: readonly MotionSetting[] = ['system', 'reduce'];
/** The values of {@link Simulation.scheme} in menu order. */
export const SCHEME_SETTINGS: readonly SchemeSetting[] = ['system', 'light', 'dark'];
/** The values of {@link Simulation.forced} in menu order. */
export const FORCED_SETTINGS: readonly ForcedSetting[] = ['off', 'active'];
/** The values of {@link Simulation.vision} in menu order. */
export const VISION_SETTINGS: readonly VisionSetting[] = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia', 'blurred'];

/**
 * The media features the canvas answers differently, keyed by feature name. A
 * feature that is not emulated is absent, not set to a neutral value, so the
 * real answer shows through.
 */
export interface EmulatedMedia {
    'prefers-reduced-motion'?: 'reduce';
    'prefers-color-scheme'?: 'light' | 'dark';
    'forced-colors'?: 'active';
}

// Typed as complete records so that a new setting cannot go without a label.
// The neutral value has none: it is not worth a pill.
const MOTION_LABELS: Record<MotionSetting, string | null> = { system: null, reduce: 'Reduced motion' };
const SCHEME_LABELS: Record<SchemeSetting, string | null> = { system: null, light: 'Light scheme', dark: 'Dark scheme' };
const FORCED_LABELS: Record<ForcedSetting, string | null> = { off: null, active: 'Forced colors (approx.)' };
const VISION_LABELS: Record<VisionSetting, string | null> = {
    none: null,
    protanopia: 'Protanopia',
    deuteranopia: 'Deuteranopia',
    tritanopia: 'Tritanopia',
    achromatopsia: 'Achromatopsia',
    blurred: 'Blurred vision'
};

/** Between the parts of a combined label, such as the audit condition ({@link joinLabels}). */
const LABEL_SEPARATOR = ' · ';

/** The URL parameters, named like the fields and in menu order. */
const PARAMS: readonly (keyof Simulation)[] = ['motion', 'scheme', 'forced', 'vision'];

/** Whether anything differs from {@link DEFAULT_SIMULATION}. */
export function isSimulating(s: Simulation): boolean {
    return (
        s.motion !== DEFAULT_SIMULATION.motion ||
        s.scheme !== DEFAULT_SIMULATION.scheme ||
        s.forced !== DEFAULT_SIMULATION.forced ||
        s.vision !== DEFAULT_SIMULATION.vision
    );
}

/**
 * One label per setting that differs from the default, in the order of the
 * menu rows. The pills over the canvas show these, so a reader of a screenshot
 * can tell which environment it was taken in.
 */
export function simulationLabels(s: Simulation): string[] {
    return present([MOTION_LABELS[s.motion], SCHEME_LABELS[s.scheme], FORCED_LABELS[s.forced], VISION_LABELS[s.vision]]);
}

/** Labels as one line of text: the simulation pill's, and the audit condition's, so the two cannot drift apart. */
export function joinLabels(labels: readonly string[]): string {
    return labels.join(LABEL_SEPARATOR);
}

/**
 * The condition an accessibility audit ran under, or `null` when it ran under
 * the real environment.
 *
 * Only what changes *computed styles* counts: colour scheme and forced
 * colours decide which colours axe measures. Motion and vision leave them
 * alone, so an audit under those is still an audit under the real environment.
 * Joined the way the pills are.
 */
export function auditConditionLabel(s: Simulation): string | null {
    const labels = present([SCHEME_LABELS[s.scheme], FORCED_LABELS[s.forced]]);

    return labels.length > 0 ? joinLabels(labels) : null;
}

/** The media features to emulate: only those the simulation sets, so `System`/`Off` keep the real answer. */
export function emulatedMedia(s: Simulation): EmulatedMedia {
    const media: EmulatedMedia = {};

    if (s.motion === 'reduce') media['prefers-reduced-motion'] = 'reduce';
    if (s.scheme !== 'system') media['prefers-color-scheme'] = s.scheme;
    if (s.forced === 'active') media['forced-colors'] = 'active';

    return media;
}

/** Whether two emulations answer every feature the same. */
export function sameMedia(a: EmulatedMedia, b: EmulatedMedia): boolean {
    const features = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof EmulatedMedia>;

    return Array.from(features).every((feature) => a[feature] === b[feature]);
}

/**
 * The scheme the ground behind the component has to take on, or `null` when
 * the real one is fine. Rules in `@media (prefers-color-scheme)` follow the
 * emulation by themselves, a surface the canvas paints does not.
 */
export function schemeGround(s: Simulation): 'light' | 'dark' | null {
    return s.scheme === 'system' ? null : s.scheme;
}

/**
 * The palette forced colours are approximated in, or `null` while they are
 * off. It follows the colour scheme: `Light` gives the light palette, `Dark`
 * and `System` the dark one.
 */
export function forcedPalette(s: Simulation): 'light' | 'dark' | null {
    if (s.forced !== 'active') return null;

    return s.scheme === 'light' ? 'light' : 'dark';
}

/**
 * The simulation a URL describes. Unknown values are dropped field by field
 * rather than discarding the whole link, so a hand-edited or outdated
 * parameter costs only itself.
 */
export function readSimulationParams(params: URLSearchParams): Simulation {
    return {
        motion: pick(params.get('motion'), MOTION_SETTINGS, DEFAULT_SIMULATION.motion),
        scheme: pick(params.get('scheme'), SCHEME_SETTINGS, DEFAULT_SIMULATION.scheme),
        forced: pick(params.get('forced'), FORCED_SETTINGS, DEFAULT_SIMULATION.forced),
        vision: pick(params.get('vision'), VISION_SETTINGS, DEFAULT_SIMULATION.vision)
    };
}

/**
 * Whether the URL says anything about the simulation, valid or not. A link
 * that does is the source of truth and wins over what the session remembers,
 * even when it spells out a default.
 */
export function hasSimulationParams(params: URLSearchParams): boolean {
    return PARAMS.some((name) => params.has(name));
}

/**
 * Makes `params` carry exactly `s`: only the settings that differ from the
 * default become parameters, so a URL without a simulation stays short, and
 * what an earlier simulation left behind is removed. The parameters come last,
 * in menu order.
 */
export function writeSimulationParams(s: Simulation, params: URLSearchParams): void {
    for (const name of PARAMS) params.delete(name);

    if (s.motion !== DEFAULT_SIMULATION.motion) params.set('motion', s.motion);
    if (s.scheme !== DEFAULT_SIMULATION.scheme) params.set('scheme', s.scheme);
    if (s.forced !== DEFAULT_SIMULATION.forced) params.set('forced', s.forced);
    if (s.vision !== DEFAULT_SIMULATION.vision) params.set('vision', s.vision);
}

/**
 * The simulation a stored value describes, for state that went through JSON
 * and may come from an older or a newer version. Anything unusable becomes the
 * default, field by field.
 */
export function parseSimulation(value: unknown): Simulation {
    const stored = isRecord(value) ? value : {};

    return {
        motion: pick(stored['motion'], MOTION_SETTINGS, DEFAULT_SIMULATION.motion),
        scheme: pick(stored['scheme'], SCHEME_SETTINGS, DEFAULT_SIMULATION.scheme),
        forced: pick(stored['forced'], FORCED_SETTINGS, DEFAULT_SIMULATION.forced),
        vision: pick(stored['vision'], VISION_SETTINGS, DEFAULT_SIMULATION.vision)
    };
}

function present(labels: readonly (string | null)[]): string[] {
    return labels.filter((label): label is string => label !== null);
}

/** `value` when it is one of `allowed`, else `fallback`. Finds rather than `includes` to hand back a `T` without a cast. */
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.find((candidate) => candidate === value) ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
