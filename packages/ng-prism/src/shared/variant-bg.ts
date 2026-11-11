import { CANVAS_BGS, type CanvasBg } from './canvas-bg.type.js';

/**
 * The surface a variant is reported to render on when nothing declares one and
 * the project has not set `showcaseDefaults.bg`.
 *
 * `transparent`, because an undeclared variant has no opinion about its
 * surface. A colour from a theme token (`--prism-bg-surface` under `dots` and
 * `plain`) would be kept by capture mode, so the runner's theme would leak into
 * the baseline. Alpha has no such dependency and, unlike a pattern, does not
 * shift when a centred component resizes.
 *
 * A runner must pass `omitBackground: true`, otherwise the capture is opaque
 * over whatever the browser painted. See
 * `docs/guide/visual-regression.md#capturing-transparency`.
 *
 * What to declare:
 *
 * - `light` or `dark` when the component was designed against a surface. Their
 *   colours are absolute, not theme tokens, so they are stable across runners.
 * - `transparent` when the component's own transparency is under test (an
 *   outlined button, an icon, a divider). On an opaque colour a transparent
 *   fill and a painted fill produce the same pixels. While browsing it is a
 *   light checkerboard in both themes, in a capture it is see-through.
 * - `dots` or `plain` for browsing. They follow the active theme, so a baseline
 *   recorded on one is only as stable as the theme.
 */
export const DEFAULT_VARIANT_BG: CanvasBg = 'transparent';

/**
 * The parts of a `ShowcaseConfig` that decide a variant's background.
 *
 * Declared structurally rather than imported: `ShowcaseConfig` itself lives in
 * `decorator/`, which already imports from this folder.
 */
export interface VariantBgSource {
    bg?: CanvasBg;
    variants?: readonly { bg?: CanvasBg }[];
}

/**
 * The background a variant *declares*, or `null` when it declares none.
 *
 * Priority is variant, then component. `null` is a meaningful answer. It is
 * what lets the canvas keep the user's own background choice instead of
 * overwriting it, and what makes the background pill able to say "this is your
 * choice, not the component's".
 *
 * An index with no variant behind it still answers with the component's
 * declaration: the renderer clamps an unknown `?variant=` to index 0 rather
 * than rendering nothing, so reporting `null` here would describe a state that
 * cannot occur.
 */
export function declaredVariantBg(config: VariantBgSource, variantIndex: number): CanvasBg | null {
    return config.variants?.[variantIndex]?.bg ?? config.bg ?? null;
}

/**
 * The background a variant renders on, always resolved to a concrete value.
 *
 * Declared first (see {@link declaredVariantBg}), then `fallback`, which is the
 * project's `showcaseDefaults.bg` (see {@link showcaseDefaultBg}), then
 * {@link DEFAULT_VARIANT_BG}. The fallback only stands in for "nothing declared",
 * it never overrides a declaration.
 *
 * This is the answer external tooling needs, since a screenshot runner cannot act
 * on "nothing declared". It is also what capture mode paints, so the value
 * reported by `__PRISM_MANIFEST__` and the pixels in the capture agree.
 */
export function resolveVariantBg(config: VariantBgSource, variantIndex: number, fallback: CanvasBg | null = null): CanvasBg {
    return declaredVariantBg(config, variantIndex) ?? fallback ?? DEFAULT_VARIANT_BG;
}

/**
 * The project's `showcaseDefaults.bg`, or `null` when it sets none.
 *
 * A value that is no {@link CanvasBg} is `null` as well. The type rules it out
 * at build time, but `ng-prism.config.ts` can be plain JavaScript, and a removed
 * value (`checker`) in an old config must fall back to what an undeclared
 * variant gets anyway, not reach the canvas as `data-bg`. No warning: the builder
 * does not validate the rest of the config either.
 *
 * Takes the config structurally, like {@link VariantBgSource}, so the caller can
 * pass `NgPrismConfig` without this module importing `plugin/`.
 */
export function showcaseDefaultBg(config: { showcaseDefaults?: { bg?: unknown } } | null | undefined): CanvasBg | null {
    const bg = config?.showcaseDefaults?.bg;

    return CANVAS_BGS.find((known) => known === bg) ?? null;
}
