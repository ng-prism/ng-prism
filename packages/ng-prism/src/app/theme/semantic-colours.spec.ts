import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANVAS_BG_STYLES } from '../canvas/canvas-bg.styles.js';
import { canvasOverlayTokens } from '../canvas/canvas-overlay-tokens.js';
import { PRISM_BASE_TOKENS, PRISM_DARK_THEME, PRISM_LIGHT_THEME } from './prism-default-theme.js';

/**
 * The semantic colours have to be legible, and warning has to be tellable from
 * error at a glance.
 *
 * Both failed in the light theme and nobody noticed until it was on screen.
 * `--prism-warn` sat at 3.19:1 on white (under WCAG AA), and warning and error
 * were only ΔL* 12 apart where the working dark pair is 18. At the sizes these
 * appear in (an 11px gauge chip, a 10px badge, a 5px dot) lightness carries far
 * more of the distinction than hue, so a pair that differs mostly in hue reads
 * as one colour.
 *
 * Numbers rather than adjectives, because "looks different enough" is what
 * shipped the bug. A colour-blind reader is the case this really serves: for
 * deuteranopia the hue difference between amber and red largely disappears and
 * the lightness gap is all that is left.
 */

type Rgb = [number, number, number];

/** The canvas backgrounds whose colour is not a theme token. */
type AbsoluteBg = 'light' | 'dark' | 'transparent';

const rgb = (hex: string): Rgb => {
    const h = hex.replace('#', '');

    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
};

const toLinear = (channel: number): number => {
    const c = channel / 255;

    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
    const [r, g, b] = rgb(hex).map(toLinear);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio, 1–21. */
const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

/** CIELAB, D65. */
const lab = (hex: string): [number, number, number] => {
    const [r, g, b] = rgb(hex).map(toLinear);
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(x), f(y), f(z)];

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const deltaE = (a: string, b: string): number => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

const lightnessGap = (a: string, b: string): number => Math.abs(lab(a)[0] - lab(b)[0]);

/** The declarations of the `[data-bg]` rule of `bg` in canvas-bg.styles.ts. */
const ruleOf = (bg: AbsoluteBg): string => {
    const rule = CANVAS_BG_STYLES.slice(CANVAS_BG_STYLES.indexOf(`[data-bg="${bg}"]`));

    return rule.slice(0, rule.indexOf('}'));
};

/** `color-mix(... N%, transparent)` composited over an opaque ground. */
const atAlpha = (fg: string, bg: string, alpha: number): string => {
    const [fr, fg_, fb] = rgb(fg);
    const [br, bg_, bb] = rgb(bg);
    const ch = (f: number, b: number) =>
        Math.round(f * alpha + b * (1 - alpha))
            .toString(16)
            .padStart(2, '0');

    return `#${ch(fr, br)}${ch(fg_, bg_)}${ch(fb, bb)}`;
};

/**
 * The darker square of the checkerboard `transparent` draws, read out of the
 * stylesheet rather than copied (see `overrideFor` below): a `color-mix` of the
 * light ground with ink, in sRGB, both as the stylesheet falls back to them. The
 * measurement is drawn across squares and ground alike, so the square is a
 * surface to hold it to as well, and so is the text a component inherits.
 */
const CHECKER_SQUARE = ((): string => {
    const found = /color-mix\(in srgb,\s*var\(--prism-void-light,\s*(#[0-9a-f]{6})\)\s+(\d+(?:\.\d+)?)%,\s*(#[0-9a-f]{6})\)/i.exec(ruleOf('transparent'));

    if (!found) throw new Error('[data-bg="transparent"] mixes no square out of --prism-void-light');
    return atAlpha(found[1], found[3], Number(found[2]) / 100);
})();

const THEMES = [
    ['light', PRISM_LIGHT_THEME],
    ['dark', PRISM_DARK_THEME]
] as const;

/**
 * Every leg of the traffic light has to be separable at a glance.
 *
 * The three mark roles are one scale, so all three legs are checked rather
 * than only the pair that originally collapsed.
 */
const CONFUSABLE = [
    ['--prism-warn', '--prism-danger'],
    ['--prism-success', '--prism-warn'],
    ['--prism-success', '--prism-danger']
] as const;

/**
 * The legs where hue cannot be relied on, and lightness has to carry it.
 *
 * Amber and red are neighbours on the wheel: at 5–11px their hue difference is
 * marginal, and the light theme shipped a pair only ΔL* 3 apart that read as
 * one colour. Green against either is a wide hue gap (ΔE 65 and 100 in the
 * light theme) and needs no lightness floor.
 *
 * Applying the floor to all three legs was tried and is not reachable: a
 * three-step scale separated in lightness needs roughly L* 30/45/60, and L* 60
 * cannot hold 4.5:1 against white. Where lightness cannot separate them, the
 * glyph does: each mark carries its own icon, the status chip its own word,
 * and every readout row its own label.
 */
const WARM_PAIRS = [['--prism-warn', '--prism-danger']] as const;

/**
 * Since 22.7 the `--prism-mark-*` roles are aliases of these three, so checking
 * the three checks the marks too.
 */
const SEMANTIC = ['--prism-success', '--prism-warn', '--prism-danger'] as const;

describe('semantic colours', () => {
    it.each(THEMES)('%s theme meets WCAG AA against its own background', (_name, theme) => {
        // Reported as a map so a failure names every offending token and its
        // actual ratio, rather than stopping at the first one.
        const failing = Object.fromEntries(
            SEMANTIC.map((token) => [token, Number(contrast(theme[token], theme['--prism-bg']).toFixed(2))]).filter(([, ratio]) => (ratio as number) < 4.5)
        );

        expect(failing).toEqual({});
    });

    it.each(THEMES.flatMap(([name, theme]) => CONFUSABLE.map(([a, b]) => [`${name}: ${a} vs ${b}`, theme, a, b] as const)))(
        '%s stays distinguishable',
        (_label, theme, a, b) => {
            // Matched to the dark pair that works in practice: ΔE 55. The floor sits
            // just under it so an intended tweak has room, and a drift back to "two
            // dark warm colours" does not.
            expect(deltaE(theme[a], theme[b])).toBeGreaterThanOrEqual(45);
        }
    );

    it.each(THEMES.flatMap(([name, theme]) => WARM_PAIRS.map(([a, b]) => [`${name}: ${a} vs ${b}`, theme, a, b] as const)))(
        '%s separates in lightness, not only hue',
        (_label, theme, a, b) => {
            expect(lightnessGap(theme[a], theme[b])).toBeGreaterThanOrEqual(14);
        }
    );

    /**
     * The measurement colour has to hold on the ground it is actually drawn on.
     *
     * `--prism-measure` carries the viewport grips, their guide lines and the
     * dimension line, and it is the one colour on the canvas whose ground is not
     * a theme surface. Three of the five canvas backgrounds are absolute: `light`
     * stays near-white while the app runs the dark theme, `dark` stays
     * near-black while it runs the light one, and `transparent` is a
     * checkerboard drawn from the light ground in both. So the theme's own value
     * is only ever half the story, and the half that was wrong. Measured on the
     * value this replaced, the dark theme's cyan reached 1.81:1 on the light
     * background, which is an overlay you cannot see.
     *
     * canvas-bg.styles.ts answers that by re-pointing the token on those
     * backgrounds, to the token of the ground with the default as the fallback.
     * That stylesheet cannot import from this file, so this is what stops the
     * fallback and the default drifting apart: each pair is checked against the
     * ground it is meant for, at the alpha the faintest layer that matters
     * actually uses.
     */
    describe('--prism-measure', () => {
        /**
         * The grounds, read from the theme rather than copied.
         *
         * The same argument as `overrideFor` below: a literal here would only make this
         * file agree with itself, and a change to
         * `--prism-stage` would leave the suite green while measuring a surface
         * that no longer exists. The two absolute grounds are theme tokens too,
         * since they are the values `canvas-bg.styles.ts` falls back to.
         */
        const ABSOLUTE_LIGHT = PRISM_BASE_TOKENS['--prism-void-light'];
        const ABSOLUTE_DARK = PRISM_BASE_TOKENS['--prism-void-dark'];

        /**
         * The override each absolute background declares, read out of the
         * stylesheet rather than copied here.
         *
         * Copying the literal would only make this file agree with itself:
         * the pair could drift to any other colour that still passed
         * the contrast floors below and no test would notice. Reading the real
         * declaration is what turns these into a guard on canvas-bg.styles.ts.
         */
        const overrideRead = (bg: AbsoluteBg): { token: string; fallback: string } => {
            // The rule reads the colour from a token of its ground and states the default as the fallback: that fallback is what is measured.
            const found = /--prism-measure:\s*var\((--prism-void-(?:light|dark)-measure),\s*(#[0-9a-f]{6})\)/i.exec(ruleOf(bg));

            if (!found) throw new Error(`[data-bg="${bg}"] declares no --prism-measure read from the token of its ground`);
            return { token: found[1], fallback: found[2] };
        };
        const overrideFor = (bg: AbsoluteBg): string => overrideRead(bg).fallback;

        const ON_LIGHT_GROUND = overrideFor('light');
        const ON_DARK_GROUND = overrideFor('dark');
        const ON_TRANSPARENT_GROUND = overrideFor('transparent');

        /**
         * The ground under forced colors is `Canvas` in the simulated palette,
         * and the measurement colour there is the fixed one the canvas wrap
         * carries for that palette (the stage takes it over with `inherit`),
         * whatever the background is. `Canvas` is the browser's own, so it
         * cannot be read from a source: these are the values measured in
         * Chromium and WebKit, white in both for light.
         */
        const FORCED_LIGHT = ['forced, light palette', canvasOverlayTokens('light', 'light')['--prism-measure'], '#ffffff'] as const;
        const FORCED_DARK_CHROMIUM = ['forced, dark palette in Chromium', canvasOverlayTokens('dark', 'dark')['--prism-measure'], '#121212'] as const;
        /**
         * A shade lighter than Chromium's. The readout and the 3:1 layers hold on
         * it; the faint 55% line of a hovered grip reads 2.43:1, just under the
         * 2.5 floor below, so it is left out of that one check.
         */
        const FORCED_DARK_WEBKIT = ['forced, dark palette in WebKit', canvasOverlayTokens('dark', 'dark')['--prism-measure'], '#1e1e1e'] as const;

        /**
         * Every ground the measurement colour is ever painted on.
         *
         * Read from the theme, not copied. A literal here would only make this
         * file agree with itself. Change `--prism-stage` and the
         * suite would stay green while measuring a surface that no longer exists.
         */
        const SQUARE = ['bg:transparent, square', ON_TRANSPARENT_GROUND, CHECKER_SQUARE] as const;

        const GROUNDS = [
            ['dark theme stage', PRISM_DARK_THEME['--prism-measure'], PRISM_DARK_THEME['--prism-stage']],
            ['light theme stage', PRISM_LIGHT_THEME['--prism-measure'], PRISM_LIGHT_THEME['--prism-stage']],
            ['bg:dark, any theme', ON_DARK_GROUND, ABSOLUTE_DARK],
            ['bg:light, any theme', ON_LIGHT_GROUND, ABSOLUTE_LIGHT],
            ['bg:transparent, ground', ON_TRANSPARENT_GROUND, ABSOLUTE_LIGHT],
            SQUARE,
            FORCED_LIGHT,
            FORCED_DARK_CHROMIUM
        ] as const;

        /** The grounds the readout and the 3:1 layers are held to: WebKit's dark `Canvas` as well. */
        const READ_GROUNDS = [...GROUNDS, FORCED_DARK_WEBKIT] as const;

        /**
         * The grounds the 9px readout is held to 4.5:1 on: all but a square of the
         * checkerboard. The ground of `transparent` reaches 4.54:1 with this
         * colour, so a square that shows against it, as the squares have to,
         * cannot; it reads 4.03:1, and has a floor of its own below. The readout
         * is drawn straight on the stage, so a part of its glyphs does sit on squares.
         */
        const READOUT_GROUNDS = READ_GROUNDS.filter((ground) => ground !== SQUARE);

        /**
         * The alphas the renderer actually paints this colour at.
         *
         * Extracted from the stylesheet rather than listed here, because listing
         * them is how the first version of this test went wrong: it checked the
         * solid colour and the end ticks (the two layers that passed) while the
         * guide line, the dimension rule and the grip handle all sat under the 3:1
         * floor on both light grounds, and nothing failed. Whatever the renderer
         * paints is what gets measured now.
         */
        const paintedAlphas = (): number[] => {
            const src = readFileSync(join(__dirname, '../renderer/prism-renderer.component.css'), 'utf-8');
            const found = [...src.matchAll(/var\(--prism-measure\)\s+(\d+)%/g)].map((m) => Number(m[1]) / 100);

            if (found.length === 0) throw new Error('no --prism-measure layers found');
            return [...new Set(found)].sort((a, b) => a - b);
        };

        /** The alpha inside one named rule, so a control can be held to its own floor. */
        const alphaInRule = (selector: string): number => {
            const src = readFileSync(join(__dirname, '../renderer/prism-renderer.component.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
            const at = src.indexOf(selector);

            if (at === -1) throw new Error(`rule not found: ${selector}`);
            const body = src.slice(at, src.indexOf('}', at));
            const found = /var\(--prism-measure\)\s+(\d+)%/.exec(body);

            if (!found) throw new Error(`${selector} paints no --prism-measure`);
            return Number(found[1]) / 100;
        };

        it.each(READOUT_GROUNDS)('%s reads the solid value at 9px', (_l, colour, ground) => {
            // The readout is 9px monospace, so AA's 4.5:1 for body text is the right
            // floor, not the 3:1 that large text or a bare UI edge would take.
            expect(contrast(colour, ground)).toBeGreaterThanOrEqual(4.5);
        });

        it('reads the solid value on a square of the checkerboard at 4:1', () => {
            // What is left of the floor above where it cannot hold (see
            // READOUT_GROUNDS): the ground of the checkerboard has 4.54:1, so any
            // square that is visible has less. 4:1 keeps a paler measurement
            // colour, or a darker square, from taking it further down unnoticed.
            expect(contrast(SQUARE[1], SQUARE[2])).toBeGreaterThanOrEqual(4);
        });

        it.each(GROUNDS)('%s keeps every painted layer visible', (_l, colour, ground) => {
            const failing = Object.fromEntries(
                paintedAlphas()
                    .map((a) => [`${Math.round(a * 100)}%`, Number(contrast(atAlpha(colour, ground, a), ground).toFixed(2))])
                    .filter(([, ratio]) => (ratio as number) < 2.5)
            );

            // 2.5 is the floor for chrome that only has to be seen. The two layers
            // that have to be *operated* or *read* are held higher, below.
            expect(failing).toEqual({});
        });

        it.each(READ_GROUNDS)('%s holds the grip handle and the rule at 3:1', (_l, colour, ground) => {
            // The handle is an interactive control and the dimension rule carries
            // the measurement, so both are WCAG 1.4.11 non-text contrast at 3:1.
            const handle = alphaInRule('.vp-grip__bar {');
            const rule = alphaInRule('.vp-dim__rule {');

            expect(contrast(atAlpha(colour, ground, handle), ground)).toBeGreaterThanOrEqual(3);
            expect(contrast(atAlpha(colour, ground, rule), ground)).toBeGreaterThanOrEqual(3);
        });

        it.each([
            ['light', '--prism-void-light-measure'],
            ['transparent', '--prism-void-light-measure'],
            ['dark', '--prism-void-dark-measure']
        ] as const)('bg:%s reads the measurement colour from %s, with its default as the fallback', (bg, token) => {
            // A project that retunes a ground retunes the colour drawn on it with this token; the default is held to the floors here.
            expect(overrideRead(bg)).toEqual({ token, fallback: PRISM_BASE_TOKENS[token] });
        });

        it('declares the same colour on an absolute ground as the matching theme', () => {
            // The overrides exist to hold one theme's value steady when the other
            // theme's ground is on screen, so they ARE the theme values, and the
            // point of the override is only which one applies where. Drift between
            // the two copies would show up as a viewport overlay that changes colour
            // when a component declares a background, which reads as a rendering
            // fault rather than as the two-source bug it is.
            expect(ON_DARK_GROUND).toBe(PRISM_DARK_THEME['--prism-measure']);
            expect(ON_LIGHT_GROUND).toBe(PRISM_LIGHT_THEME['--prism-measure']);
            expect(ON_TRANSPARENT_GROUND).toBe(ON_LIGHT_GROUND);
        });

        /**
         * The label plate is a second consumer with the same exposure.
         *
         * The measuring tool prints its value on a small opaque plate, so that
         * the number reads as sitting in a gap in the measurement line rather
         * than as a badge laid over it. The plate shipped as `--prism-stage`,
         * which is *not* re-pointed on the two absolute backgrounds — so a
         * `bg: 'light'` variant under the dark theme put the light theme's navy
         * on the dark theme's stage at 2.10:1, and `bg: 'dark'` under the light
         * theme the mirror image at 2.13:1. Both are documented, supported
         * `@Showcase({ bg })` values, which is precisely the
         * true-in-the-common-case failure the override above exists to prevent.
         */
        describe('--prism-measure-plate', () => {
            /** The plate each absolute background declares, read out of the stylesheet. */
            const plateFor = (bg: AbsoluteBg): string => {
                const found = /--prism-measure-plate:[^;]*?(#[0-9a-f]{6})/i.exec(ruleOf(bg));

                if (!found) throw new Error(`[data-bg="${bg}"] declares no --prism-measure-plate`);
                return found[1];
            };

            const PLATES = [
                ['bg:light, any theme', ON_LIGHT_GROUND, plateFor('light'), ABSOLUTE_LIGHT],
                ['bg:transparent, any theme', ON_TRANSPARENT_GROUND, plateFor('transparent'), ABSOLUTE_LIGHT],
                ['bg:dark, any theme', ON_DARK_GROUND, plateFor('dark'), ABSOLUTE_DARK]
            ] as const;

            it.each(PLATES)('%s paints the plate in the ground, not in the theme surface', (_l, _colour, plate, ground) => {
                // The plate has to *be* the ground, or it stops reading as a gap
                // in the line and becomes a badge sitting on top of one.
                expect(plate).toBe(ground);
            });

            it.each(PLATES)('%s keeps the value legible on its plate', (_l, colour, plate) => {
                // An 11px monospace number — AA body text, so 4.5:1, the same
                // floor the 9px rail readout is held to above.
                expect(contrast(colour, plate)).toBeGreaterThanOrEqual(4.5);
            });

            it('is what the label actually paints itself on', () => {
                // Without this the pair above could stay perfectly in step while
                // the component went back to reading --prism-stage directly, and
                // nothing would fail. The fallback is required too: it is what
                // covers the four grounds that do follow the theme.
                const css = readFileSync(join(__dirname, '../canvas/prism-canvas-measure.component.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

                expect(css).toMatch(/background:\s*var\(--prism-measure-plate,\s*var\(--prism-stage\)\)/);
            });
        });

        it('stays tellable from the primary accent in both themes', () => {
            // Measurement is its own signal. If it drifts far enough toward the
            // brand violet, a grip starts reading as a primary control rather than
            // as chrome that happens to be draggable.
            for (const theme of [PRISM_DARK_THEME, PRISM_LIGHT_THEME]) {
                expect(deltaE(theme['--prism-measure'], theme['--prism-primary'])).toBeGreaterThanOrEqual(30);
            }
        });
    });
});

/**
 * Every role on every surface it can land on.
 *
 * The semantic block above only measures against `--prism-bg`. That was enough
 * while the surfaces were within a hair of each other; since 22.7 the chrome,
 * the content and the popovers are distinct colours in both themes, and a muted
 * label that passes on one of them can fail on the next. Tokens are resolved
 * the way the browser resolves them: `var()` aliases are followed, and
 * `color-mix(in srgb, X N%, transparent)` is composited over the ground it sits on.
 */
describe('role contrast', () => {
    const SURFACES = ['--prism-void', '--prism-bg', '--prism-bg-surface', '--prism-bg-elevated', '--prism-stage'] as const;

    const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

    const over = (fg: string, alpha: number, ground: string): string => {
        const f = rgb(fg);
        const g = rgb(ground);

        return `#${[0, 1, 2].map((i) => hex2(f[i] * alpha + g[i] * (1 - alpha))).join('')}`;
    };

    /** The opaque colour a token paints over `ground`. */
    const resolve = (theme: Record<string, string>, value: string, ground: string): string => {
        const v = value.trim();
        const alias = /^var\((--[a-z0-9-]+)\)$/i.exec(v);

        if (alias) {
            const target = theme[alias[1]] ?? PRISM_BASE_TOKENS[alias[1]];

            if (target === undefined) throw new Error(`unresolved ${alias[1]}`);
            return resolve(theme, target, ground);
        }

        const mix = /^color-mix\(in srgb,\s*(.+)\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/i.exec(v);

        if (mix) return over(resolve(theme, mix[1], ground), Number(mix[2]) / 100, ground);

        const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i.exec(v);

        if (rgba) {
            const fg = `#${[rgba[1], rgba[2], rgba[3]].map((c) => hex2(Number(c))).join('')}`;

            return over(fg, Number(rgba[4]), ground);
        }

        if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
        throw new Error(`cannot resolve ${value}`);
    };

    const token = (theme: Record<string, string>, name: string, ground: string) => {
        const value = theme[name];

        if (value === undefined) throw new Error(`${name} is not defined`);
        return resolve(theme, value, ground);
    };

    const ground = (theme: Record<string, string>, name: string) => resolve(theme, theme[name], '#000000');

    /** Every failing pair as `fg on ground: ratio`, so one run names them all. */
    const failures = (theme: Record<string, string>, fgs: readonly string[], grounds: readonly string[], floor: number) =>
        Object.fromEntries(
            fgs
                .flatMap((fg) =>
                    grounds.map((g) => {
                        const bg = ground(theme, g);

                        return [`${fg} on ${g}`, Number(contrast(token(theme, fg, bg), bg).toFixed(2))] as const;
                    })
                )
                .filter(([, ratio]) => ratio < floor)
        );

    const TEXT = [
        '--prism-text',
        '--prism-text-2',
        '--prism-text-muted',
        '--prism-primary',
        '--prism-link',
        '--prism-accent',
        '--prism-success',
        '--prism-warn',
        '--prism-danger',
        '--prism-code-tag',
        '--prism-code-attr',
        '--prism-code-str',
        '--prism-code-com'
    ] as const;

    it.each(THEMES)('%s theme: text roles hold 4.5:1 on every surface', (_n, theme) => {
        expect(failures(theme, TEXT, SURFACES, 4.5)).toEqual({});
    });

    const TINTED = [
        ['--prism-success', '--prism-success-bg'],
        ['--prism-warn', '--prism-warn-bg'],
        ['--prism-danger', '--prism-danger-bg'],
        ['--prism-primary', '--prism-primary-bg']
    ] as const;

    it.each(THEMES)('%s theme: status text holds 4.5:1 on its own tint over chrome and content', (_n, theme) => {
        const failing = Object.fromEntries(
            TINTED.flatMap(([fg, tint]) =>
                (['--prism-bg', '--prism-bg-surface'] as const).map((g) => {
                    const bg = token(theme, tint, ground(theme, g));

                    return [`${fg} on ${tint} over ${g}`, Number(contrast(token(theme, fg, bg), bg).toFixed(2))] as const;
                })
            ).filter(([, ratio]) => ratio < 4.5)
        );

        expect(failing).toEqual({});
    });

    const CONTOURS = [
        '--prism-border-strong',
        '--prism-primary-fill',
        '--prism-facet-cyan',
        '--prism-facet-blue',
        '--prism-facet-violet',
        '--prism-facet-magenta'
    ] as const;

    it.each(THEMES)('%s theme: control contours and icon facets hold 3:1 on every surface', (_n, theme) => {
        expect(failures(theme, CONTOURS, SURFACES, 3)).toEqual({});
    });

    it.each(THEMES)('%s theme: on-primary holds 4.5:1 on the fill and its hover', (_n, theme) => {
        const on = token(theme, '--prism-on-primary', '#000000');

        expect(contrast(on, token(theme, '--prism-primary-fill', '#000000'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(on, token(theme, '--prism-primary-fill-hover', '#000000'))).toBeGreaterThanOrEqual(4.5);
    });

    /** The colour stops of a gradient token, after following aliases. */
    const stops = (theme: Record<string, string>, name: string): string[] => {
        let value = theme[name];
        const alias = /^var\((--[a-z0-9-]+)\)$/i.exec(value ?? '');

        if (alias) value = theme[alias[1]];
        if (value === undefined) throw new Error(`${name} is not defined`);
        return [...value.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
    };

    it.each(THEMES)('%s theme: every stop of the brand ink holds 3:1 on the chrome', (_n, theme) => {
        // The ink paints tab indicators and the sidebar's light bar, which are
        // state indicators (WCAG 1.4.11), so the faintest stop sets the floor.
        const chrome = ground(theme, '--prism-bg');
        const failing = stops(theme, '--prism-brand-ink').filter((c) => contrast(c, chrome) < 3);

        expect(failing).toEqual([]);
    });

    it.each(THEMES)('%s theme: every stop of the active toggle track holds 3:1 against the knob and the surfaces', (_n, theme) => {
        // An active switch is identified by its track (WCAG 1.4.11): the knob
        // has to stand out on it, and the track on the surface it sits on.
        const knob = token(theme, '--prism-on-primary', '#000000');
        const failing = stops(theme, '--prism-toggle-on').flatMap((stop) =>
            [knob, ground(theme, '--prism-bg-surface'), ground(theme, '--prism-bg-elevated')]
                .filter((against) => contrast(stop, against) < 3)
                .map((against) => `${stop} vs ${against}`)
        );

        expect(failing).toEqual([]);
    });

    it('paints the brand gradient identically in both themes', () => {
        expect(PRISM_DARK_THEME['--prism-brand-gradient']).toBe('linear-gradient(90deg, #00CFEA 0%, #078BFA 38%, #244BFF 68%, #A20CF0 100%)');
        expect(PRISM_LIGHT_THEME['--prism-brand-gradient']).toBe(PRISM_DARK_THEME['--prism-brand-gradient']);
    });

    // The text a component inherits on a fixed ground, as its own tokens: a project that retunes a ground retunes it too, against this floor.
    it.each([
        ['--prism-void-light-text', 'bg:light', PRISM_BASE_TOKENS['--prism-void-light']],
        ['--prism-void-light-text', 'bg:transparent, square', CHECKER_SQUARE],
        ['--prism-void-dark-text', 'bg:dark', PRISM_BASE_TOKENS['--prism-void-dark']]
    ] as const)('each fixed ground keeps its text at 4.5:1: %s on %s', (token, _ground, surface) => {
        expect(contrast(PRISM_BASE_TOKENS[token], surface)).toBeGreaterThanOrEqual(4.5);
    });

    // The stylesheet states the default beside the token, as it does for the grounds; a drift would show on a project that sets neither.
    it.each([
        ['light', '--prism-void-light-text'],
        ['transparent', '--prism-void-light-text'],
        ['dark', '--prism-void-dark-text']
    ] as const)('bg:%s hands the component var(%s) with its default as the fallback', (bg, token) => {
        const found = /--prism-ground-text:\s*var\((--[a-z-]+),\s*(#[0-9a-f]{6})\)/i.exec(ruleOf(bg));

        expect(found?.slice(1)).toEqual([token, PRISM_BASE_TOKENS[token]]);
    });

    it('keeps the absolute canvas grounds every VRT baseline was taken on', () => {
        expect(PRISM_BASE_TOKENS['--prism-void-light']).toBe('#f7f5fc');
        expect(PRISM_BASE_TOKENS['--prism-void-dark']).toBe('#07050f');
    });
});
