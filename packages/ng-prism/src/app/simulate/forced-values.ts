import { escapeEnd, stringEnd } from '../pseudo/pseudo-selector.js';
import { declarationsOf, propertyOf } from './css-rules.js';
import { carriesColor, type ForcedPaletteName, isSystemColor, keepsSystemColor, resolveSystemColors, substituteSystemColors, SYSTEM_COLORS } from './forced-palette.js';
import { splitList } from './scope-selector.js';

/*
 * What Chromium forces in the mode is a replacement of the value a declaration won with. Done on
 * the declarations of a rule, it gives the rule a twin that says the forced value, with the
 * weight and the order of the original, so that the cascade among the twins is the author's.
 * These functions compute the declarations of a twin; where it goes is the media engine's.
 *
 * The forced values read the context that the forced colors sheet sets: `--prism-sim-fg`,
 * `--prism-sim-bg-rgb` and `--prism-sim-outline` (forced-colors.ts).
 */

/** One declaration of a rule, as the twin reads and writes it. `value` is without the `!important`. */
export interface Declaration {
    readonly property: string;
    readonly value: string;
    readonly important: boolean;
}

/** What a twin needs to know of the document beyond the rule it twins. */
export interface TwinContext {
    readonly palette: ForcedPaletteName;
    /** Custom properties (`--name`) whose value is a gradient somewhere in the document and a `url()` nowhere. */
    readonly gradientVars: ReadonlySet<string>;
    /** Custom properties (`--name`) whose value is a background list somewhere in the document ({@link backgroundLayers}). */
    readonly layerVars: ReadonlySet<string>;
    /** Names of the @keyframes that got a twin. */
    readonly keyframes: ReadonlySet<string>;
}

/**
 * The properties whose color Chromium forces: the text color, to the foreground of the context,
 * and the colors of borders, outlines, text decorations and emphasis, column rules and the caret,
 * to the forced color of the element itself.
 *
 * Not among them is the paint of an SVG, `fill`, `stroke`, `stop-color`, `flood-color` and
 * `lighting-color`: Chromium forces none of it, as an attribute or in a stylesheet, inside an
 * `<svg>` or not, and not under `forced-color-adjust: auto` either.
 *
 * `getComputedStyle` in Chromium's mode still reports what the author wrote for
 * `text-decoration-color` and for `-webkit-text-fill-color` (which a twin forces as well, though
 * it is not listed here), where the paint is forced. The simulation follows what is painted, not
 * what is computed.
 */
export const FOREGROUND_PROPERTIES: ReadonlySet<string> = new Set([
    'color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-block-start-color',
    'border-block-end-color',
    'border-inline-start-color',
    'border-inline-end-color',
    'outline-color',
    'text-decoration-color',
    'text-emphasis-color',
    'column-rule-color',
    'caret-color'
]);

const FOREGROUND = 'var(--prism-sim-fg)';
const CURRENT_COLOR = 'currentcolor';
const OUTLINE = `var(--prism-sim-outline, ${CURRENT_COLOR})`;
const GROUND_CHANNELS = 'var(--prism-sim-bg-rgb)';

/**
 * What a property whose color Chromium forces takes. The text color takes the foreground of the
 * context. Every other foreground color takes the color of the element, which is the forced text
 * color (`currentcolor`): a border, an outline or a caret is `Highlight` next to a text of
 * `Highlight`, not the foreground of the context. Only an outline reads the outline of the focus
 * first. The text fill follows the color as well (a transparent fill over a gradient would vanish
 * with the gradient), and `accent-color` and `scrollbar-color` Chromium resets to `auto`.
 */
const COLOR_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
    ...Array.from(FOREGROUND_PROPERTIES, (property): [string, string] => [property, CURRENT_COLOR]),
    ['color', FOREGROUND],
    ['outline-color', OUTLINE],
    ['-webkit-text-fill-color', CURRENT_COLOR],
    ['accent-color', 'auto'],
    ['scrollbar-color', 'auto']
]);

/**
 * The properties whose `currentcolor` Chromium leaves standing, since it is the forced color of the
 * element already: the foreground colors and the text fill. Not the outline, which Chromium takes to
 * `Highlight` on the element with visible focus whatever color it has, its own included.
 */
const FOLLOWS_COLOR: ReadonlySet<string> = new Set([...Array.from(FOREGROUND_PROPERTIES).filter((property) => property !== 'outline-color'), '-webkit-text-fill-color']);

/** Whether Chromium leaves `value` of the foreground property `name` standing: `currentcolor`, and the automatic caret, which has the color of the element. */
function standsForced(name: string, value: string): boolean {
    const keyword = value.toLowerCase();

    return (keyword === CURRENT_COLOR && FOLLOWS_COLOR.has(name)) || (keyword === 'auto' && name === 'caret-color');
}

/** The longhands a color shorthand sets, as far as a twin forces them. `colorOnly`: the whole value of the shorthand is one color. */
interface ColorShorthand {
    readonly colors: readonly string[];
    readonly colorOnly: boolean;
}

const BORDER_SIDES = ['top', 'right', 'bottom', 'left', 'block-start', 'block-end', 'inline-start', 'inline-end'];
const PHYSICAL_BORDER_COLORS = ['top', 'right', 'bottom', 'left'].map((side) => `border-${side}-color`);

/**
 * The shorthands that put a color among other values. A `var()` anywhere in one leaves its
 * longhands without a value ({@link declarationsOfStyle}), and the twin sets the colors it forces
 * on its own.
 */
const COLOR_SHORTHANDS: ReadonlyMap<string, ColorShorthand> = new Map<string, ColorShorthand>([
    ['border', { colors: PHYSICAL_BORDER_COLORS, colorOnly: false }],
    ...BORDER_SIDES.map((side): [string, ColorShorthand] => [`border-${side}`, { colors: [`border-${side}-color`], colorOnly: false }]),
    ['border-block', { colors: ['border-block-start-color', 'border-block-end-color'], colorOnly: false }],
    ['border-inline', { colors: ['border-inline-start-color', 'border-inline-end-color'], colorOnly: false }],
    ['border-color', { colors: PHYSICAL_BORDER_COLORS, colorOnly: true }],
    ['border-block-color', { colors: ['border-block-start-color', 'border-block-end-color'], colorOnly: true }],
    ['border-inline-color', { colors: ['border-inline-start-color', 'border-inline-end-color'], colorOnly: true }],
    ['outline', { colors: ['outline-color'], colorOnly: false }],
    ['text-decoration', { colors: ['text-decoration-color'], colorOnly: false }],
    ['text-emphasis', { colors: ['text-emphasis-color'], colorOnly: false }],
    ['column-rule', { colors: ['column-rule-color'], colorOnly: false }]
]);

/**
 * For each shorthand that a twin reads whole when `var()` leaves its longhands without a value,
 * a longhand of it: the style gives that one no value then.
 */
const PENDING_PROBES: ReadonlyMap<string, string> = new Map([
    ['background', 'background-color'],
    ...Array.from(COLOR_SHORTHANDS, ([name, { colors }]): [string, string] => [name, colors[0]])
]);

/** The properties {@link declarationsOfStyle} always reads: the ones a twin forces, and `animation-name`. */
const READ_PROPERTIES: ReadonlySet<string> = new Set([
    ...COLOR_REPLACEMENTS.keys(),
    'background-color',
    'background-image',
    'box-shadow',
    'text-shadow',
    'animation-name'
]);

/** A name of a system color anywhere in a value: a cheap test before {@link resolveSystemColors} looks closer. */
const NAMES_SYSTEM_COLOR = new RegExp(`\\b(?:${SYSTEM_COLORS.join('|')})\\b`, 'i');

/** A value that takes what the parent or the user agent has, which is forced already. */
const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

const GRADIENT = /-gradient\(/i;
const URL_IMAGE = /\burl\(/i;
const VAR_NAME = String.raw`(--(?:[^\s,()\\]|\\.)+)`;
const WHOLE_VAR = new RegExp(String.raw`^var\(\s*${VAR_NAME}\s*\)$`, 'i');
const VARS = new RegExp(String.raw`var\(\s*${VAR_NAME}`, 'gi');
const VAR = /\bvar\(/i;

/** The name in a value that is nothing but `var(--name)`: `--name`, or `null` for any other value, a `var()` with a fallback too. */
function wholeVar(value: string): string | null {
    return WHOLE_VAR.exec(value)?.[1] ?? null;
}

/** The custom property that carries "this custom property's winning value is a kept system color": `--tok` to `--prism-sim-sys-tok`. */
export function shadowName(customProperty: string): string {
    return `--prism-sim-sys-${customProperty.slice(2)}`;
}

/** The custom property that carries the last layer of the background list that is this custom property's winning value: `--ring` to `--prism-sim-layer-color-ring`. */
export function layerColorName(customProperty: string): string {
    return `--prism-sim-layer-color-${customProperty.slice(2)}`;
}

/** The custom property that carries the images that the mode leaves of the background list that is this custom property's winning value: `--ring` to `--prism-sim-layer-images-ring`. */
export function layerImagesName(customProperty: string): string {
    return `--prism-sim-layer-images-${customProperty.slice(2)}`;
}

/**
 * The layers of a background list, `linear-gradient(…), #8529d5`: two or more, each but the last
 * with an image, and the last where the color of the list is, if it has one. `null` for any other
 * value: a single layer, or a list of fonts or shadows.
 */
export function backgroundLayers(value: string): string[] | null {
    const layers = splitList(value).map((layer) => layer.trim());

    return layers.length > 1 && layers.slice(0, -1).every((layer) => GRADIENT.test(layer) || URL_IMAGE.test(layer)) ? layers : null;
}

/** The name of the copy of a @keyframes that has the forced colors: `pulse` to `pulse-prism-sim`. */
export function keyframesTwinName(name: string): string {
    return `${name}-prism-sim`;
}

/** The property of a declaration in the one case the twin reads it: a custom property keeps its case, any other is lower case. */
function nameOf(property: string): string {
    return property.startsWith('--') ? property : property.toLowerCase();
}

/**
 * The forced declarations of a twin: what Chromium replaces in the value the cascade chose for
 * each of them, as the sheet of the simulation reads it. `[]` when the rule forces nothing.
 *
 * - **The text color** takes the foreground of the context, `transparent` included.
 * - **Every other foreground color** ({@link FOREGROUND_PROPERTIES}) takes the color of the
 *   element, `currentcolor`, as Chromium does; `outline-color` the outline of the focus before it;
 *   `-webkit-text-fill-color` follows the text color; `accent-color` and `scrollbar-color` are
 *   `auto`. A `currentcolor` and the automatic caret are left: they have the forced color of
 *   the element already. Not in an outline, which takes the outline of the focus all the same.
 * - **`background-color`** takes the ground of the context with the alpha of the original,
 *   `rgb(from <original> <ground> / alpha)`, so a transparent surface stays transparent.
 * - **Shadows** become `none`, **a gradient without a `url()`** in `background-image` too, whether
 *   it is written out or a custom property of {@link TwinContext.gradientVars} holds it.
 * - **A system color that Chromium leaves standing** ({@link keepsSystemColor}) stays, as its
 *   value in the palette: `AccentColor` and `AccentColorText` do not, they are forced.
 * - **A color from a custom property** (`var(--x)` and nothing else) stays if the custom property
 *   holds a system color that stays: `var(--prism-sim-sys-x, <forced value>)`, the shadow of the
 *   custom property that the twin of its own declaration sets.
 * - **A custom property** gets a twin that sets its shadow, and the value of a system color in
 *   the palette (a whole value, and not a deprecated name that may be a word). One of
 *   {@link TwinContext.layerVars} also sets the shadows of a background list: its last layer and
 *   what the mode leaves of its images.
 * - **`animation-name`** names the twins of the @keyframes that have one.
 * - **Any other property** gets its system colors in the palette where it can carry a color
 *   ({@link resolveSystemColors}), and is left alone otherwise: the paint of an SVG, `fill`,
 *   `stroke`, `stop-color`, `flood-color` and `lighting-color`, is not forced.
 * - **A shorthand that `var()` left without longhands** ({@link declarationsOfStyle}) gets the
 *   forced values of its color, and of its image for `background`. The color is the one part that
 *   can hold one: a system color that stays, written out or held by a custom property among the
 *   parts, is kept, as in `border: 2px solid var(--accent)` ({@link shorthandTwin}). A `background`
 *   takes the ground with the alpha of its color ({@link backgroundColorOf}): of a color written out,
 *   of the one `var()` among its parts, or of the last layer of a background list a custom property
 *   holds, and a `none` for each of the list's layers. Of several `var()`s it cannot tell which is
 *   the color, and takes the ground, opaque.
 *
 * A CSS-wide keyword (`inherit`, `unset` …) is left: it takes a value that is forced already.
 * The priority of a declaration goes to every declaration of its twin.
 */
export function forcedTwin(declarations: readonly Declaration[], context: TwinContext): Declaration[] {
    return declarations.flatMap((declaration) => twinOf(declaration, context));
}

/**
 * For the elements of an exemption (`forced-color-adjust: none`): every declaration that names a
 * system color, with the value of the palette, and nothing else. The exemption keeps the author's
 * colors, but a keyword would resolve against the page's own palette, not the forced one.
 */
export function exemptTwin(declarations: readonly Declaration[], context: TwinContext): Declaration[] {
    return declarations.flatMap(({ property, value, important }) => {
        const resolved = resolveSystemColors(nameOf(property), value.trim(), context.palette);

        return resolved === value.trim() ? [] : [{ property, value: resolved, important }];
    });
}

/**
 * The declarations of one keyframe with the forced ones replaced, as in {@link forcedTwin}; the
 * others stay, in their place. A custom property stays as well and is followed by its shadow.
 */
export function forcedKeyframe(declarations: readonly Declaration[], context: TwinContext): Declaration[] {
    return declarations.flatMap((declaration) => {
        const twin = twinOf(declaration, context);
        const replaced = twin.some(({ property }) => property === nameOf(declaration.property));

        return replaced ? twin : [declaration, ...twin];
    });
}

/** `a: b !important; c: d`, the text of a block. */
export function serializeDeclarations(declarations: readonly Declaration[]): string {
    return declarations.map(({ property, value, important }) => `${property}: ${value}${important ? ' !important' : ''}`).join('; ');
}

function twinOf({ property, value, important }: Declaration, context: TwinContext): Declaration[] {
    const name = nameOf(property);
    const text = value.trim();
    const set = (target: string, to: string): Declaration => ({ property: target, value: to, important });

    if (name.startsWith('--')) return customPropertyTwin(name, text, important, context);
    // The initial outline color is the text color, but Chromium gives any outline of the element with visible focus its color, and `outline: 2px solid` sets that initial one.
    if (name === 'outline-color' && /^(?:initial|unset)$/i.test(text)) return [set(name, OUTLINE)];
    if (CSS_WIDE.has(text.toLowerCase())) return [];

    const replacement = COLOR_REPLACEMENTS.get(name);

    if (replacement !== undefined) return standsForced(name, text) ? [] : [set(name, forcedColor(text, replacement, context.palette))];

    const shorthand = COLOR_SHORTHANDS.get(name);

    if (shorthand) return shorthandTwin(shorthand, text, context.palette).map(([longhand, to]) => set(longhand, to));

    switch (name) {
        case 'background-color':
            return [set(name, forcedColor(text, groundOf(text), context.palette))];
        case 'background-image':
            return hasGradient(text, context) ? [set(name, 'none')] : [];
        case 'background':
            return backgroundShorthandTwin(text, context).map(([target, to]) => set(target, to));
        case 'box-shadow':
        case 'text-shadow':
            return text.toLowerCase() === 'none' ? [] : [set(name, 'none')];
        case 'animation-name': {
            const names = animationNames(text, context.keyframes);

            return names === null ? [] : [set(name, names)];
        }
        default: {
            const resolved = resolveSystemColors(name, text, context.palette);

            return resolved === text ? [] : [set(name, resolved)];
        }
    }
}

/**
 * A color property's value in a twin: a system color that stays, as its value in the palette; the
 * shadow of a custom property that holds one, before `forced`; otherwise `forced`.
 */
function forcedColor(value: string, forced: string, palette: ForcedPaletteName): string {
    if (keepsSystemColor(value)) return substituteSystemColors(value, palette);

    const custom = wholeVar(value);

    return custom === null ? forced : `var(${shadowName(custom)}, ${forced})`;
}

/** The ground of the context with the alpha of `original`. */
function groundOf(original: string): string {
    return `rgb(from ${original} ${GROUND_CHANNELS} / alpha)`;
}

/** The ground of the context, opaque. */
const GROUND = `rgb(${GROUND_CHANNELS})`;

/**
 * The parts of a value between its white space and its slashes, outside brackets and strings:
 * `2px solid var(--x)` to `2px`, `solid` and `var(--x)`, `center / cover` to `center` and `cover`.
 */
function partsOf(value: string): string[] {
    const parts: string[] = [];
    let part = '';
    let depth = 0;
    let i = 0;

    while (i < value.length) {
        const ch = value[i];
        const end = ch === '\\' ? escapeEnd(value, i) : ch === '"' || ch === "'" ? stringEnd(value, i) : i + 1;

        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        if (depth === 0 && (ch === '/' || /\s/.test(ch))) {
            if (part !== '') parts.push(part);
            part = '';
        } else {
            part += value.slice(i, end);
        }
        i = end;
    }
    if (part !== '') parts.push(part);
    return parts;
}

/** A part that is a `var()` of its own, with or without a fallback. */
const PART_VAR = new RegExp(String.raw`^var\(\s*${VAR_NAME}\s*[,)]`, 'i');

/** The custom properties that are parts of a value of their own (`var(--x)` in `2px solid var(--x)`), and not inside a function. */
function partVars(parts: readonly string[]): string[] {
    return parts.flatMap((part) => PART_VAR.exec(part)?.[1] ?? []);
}

/**
 * `fallback` behind the shadows of the custom properties `names`: a system color that one of them
 * holds and Chromium leaves standing stays, as the shadow of a whole `var()` does in
 * {@link forcedColor}. A shadow holds a system color or nothing, so at most one of them applies where
 * the property takes only one color.
 */
function behindShadows(names: readonly string[], fallback: string): string {
    return names.reduceRight((inner, name) => `var(${shadowName(name)}, ${inner})`, fallback);
}

/** A color written out as a part: a hex color, a color function, `transparent`, `currentcolor` or a system color. Not a named color, which needs a list. */
const WRITTEN_COLOR =
    /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|contrast-color|device-cmyk)\(.*\)|transparent|currentcolor)$/i;

function isWrittenColor(part: string): boolean {
    return WRITTEN_COLOR.test(part) || isSystemColor(part);
}

/**
 * What the twin of a color shorthand that `var()` left whole sets, longhand by longhand.
 *
 * - **A shorthand of colors only** (`border-color`) gives each side its own part, as the browser
 *   does, so that `var(--accent) red` keeps a system color that `--accent` holds on the top and
 *   bottom and forces the sides; a value whose parts do not add up to the sides is one color.
 * - **A shorthand of a color among other values** (`border`, `outline`, `text-decoration`) has its
 *   color in the one part that can hold one: a system color written out stays, and so does one
 *   that a custom property among the parts holds ({@link behindShadows}); anything else is forced.
 *
 * A `currentcolor` that stands ({@link standsForced}) gets no declaration.
 */
function shorthandTwin({ colors, colorOnly }: ColorShorthand, value: string, palette: ForcedPaletteName): [string, string][] {
    const parts = partsOf(value);

    if (colorOnly) {
        const sides = parts.length > 1 ? sidesOf(parts, colors.length) : null;

        return colors.flatMap((longhand, i): [string, string][] => {
            const part = sides ? sides[i] : value;

            return standsForced(longhand, part) ? [] : [[longhand, forcedColor(part, COLOR_REPLACEMENTS.get(longhand) as string, palette)]];
        });
    }

    const written = parts.find((part) => keepsSystemColor(part));

    return colors.map((longhand) => [
        longhand,
        written !== undefined ? substituteSystemColors(written, palette) : behindShadows(partVars(parts), COLOR_REPLACEMENTS.get(longhand) as string)
    ]);
}

/**
 * The part of a value that each side takes: of four sides top, right, bottom and left as for a
 * margin, of two the start and the end. `null` where the parts are too many for the sides.
 */
function sidesOf(parts: readonly string[], sides: number): string[] | null {
    if (sides === 2) return parts.length <= 2 ? [parts[0], parts[1] ?? parts[0]] : null;
    if (parts.length > 4) return null;

    const [top, right = top, bottom = top, left = right] = parts;

    return [top, right, bottom, left];
}

/**
 * A custom property's twin: its value as a system color of the palette, if it is one, and its
 * shadow. One that holds a background list somewhere ({@link TwinContext.layerVars}) gets the
 * shadows of a list as well, from each of its declarations, a list or not, so that the shadows
 * that apply are the ones of the declaration that wins.
 */
function customPropertyTwin(property: string, value: string, important: boolean, context: TwinContext): Declaration[] {
    const resolved = resolveSystemColors(property, value, context.palette);
    const twin: Declaration[] = [];
    const add = (target: string, to: string): void => {
        twin.push({ property: target, value: to, important });
    };

    if (resolved !== value) add(property, resolved);
    add(shadowName(property), shadowValue(value, context.palette));
    if (context.layerVars.has(property)) {
        const layers = backgroundLayers(value);

        add(layerColorName(property), layers ? substituteSystemColors(layers[layers.length - 1], context.palette) : passedOn(value, layerColorName));
        // A list with a URL keeps its images, and there is nothing to read for it.
        if (context.gradientVars.has(property)) add(layerImagesName(property), layers ? layers.map(() => 'none').join(', ') : passedOn(value, layerImagesName));
    }
    return twin;
}

/**
 * What a custom property's shadow holds for a declaration of its value: the system color it is,
 * if Chromium leaves it standing, or else {@link passedOn}. A deprecated name is no color here, it
 * may be a word.
 */
function shadowValue(value: string, palette: ForcedPaletteName): string {
    return keepsSystemColor(value, { deprecated: false }) ? substituteSystemColors(value, palette) : passedOn(value, shadowName);
}

/**
 * What a shadow (`shadow` names it) holds for a declaration that has no value for it: the shadow of
 * the custom property it passes on, or nothing (`initial`, an invalid value, so that the reader
 * falls back to the forced value). A custom property that inherits its value inherits the shadow
 * with it.
 */
function passedOn(value: string, shadow: (customProperty: string) => string): string {
    const custom = wholeVar(value);

    if (custom !== null) return `var(${shadow(custom)})`;

    const keyword = value.toLowerCase();

    return keyword === 'inherit' || keyword === 'unset' ? 'inherit' : 'initial';
}

/** Whether Chromium takes the background image of `value` away: a gradient is among the images, written out or in a custom property of gradients, and no `url()` is. */
function hasGradient(value: string, { gradientVars }: TwinContext): boolean {
    if (URL_IMAGE.test(value)) return false;

    return GRADIENT.test(value) || Array.from(value.matchAll(VARS), (match) => match[1]).some((name) => gradientVars.has(name));
}

/**
 * What a `background` that `var()` left without longhands sets: the color ({@link backgroundColorOf})
 * and no image, if it holds a gradient.
 *
 * A custom property that holds a background list ({@link TwinContext.layerVars}) has its color in
 * its last layer, which `rgb(from <list> …)` cannot read, and loses its gradients one by one, as
 * many `none` as it has layers: the reader takes both from the shadows of the declaration that
 * wins for it, and falls back to the custom property itself where that is no list.
 */
function backgroundShorthandTwin(value: string, context: TwinContext): [string, string][] {
    const color = backgroundColorOf(value, context);
    const twin: [string, string][] = color === null ? [] : [['background-color', color]];
    const custom = wholeVar(value);
    const list = custom !== null && context.layerVars.has(custom);

    if (hasGradient(value, context)) twin.push(['background-image', list ? `var(${layerImagesName(custom)}, none)` : 'none']);
    return twin;
}

/** The words of a `background` besides its colors and images: repeats, attachments, positions, sizes and boxes. Any other word in it is a color. */
const BACKGROUND_WORDS: ReadonlySet<string> = new Set([
    ...['none', 'repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round', 'scroll', 'fixed', 'local'],
    ...['left', 'right', 'top', 'bottom', 'center', 'cover', 'contain', 'auto'],
    ...['border-box', 'padding-box', 'content-box', 'border-area', 'text']
]);

const WORD = /^-?[a-z][a-z0-9-]*$/i;

/** Whether a part of a `background` is its color as written: {@link isWrittenColor}, or a word that is none of {@link BACKGROUND_WORDS}, a named color. */
function isBackgroundColor(part: string): boolean {
    return isWrittenColor(part) || (WORD.test(part) && !BACKGROUND_WORDS.has(part.toLowerCase()));
}

/**
 * The forced color of a `background` that `var()` left without longhands, or `null` where it has
 * none. Its color is a part of the last layer:
 *
 * - **A color written out**: a system color that stays, or else the ground with the color's alpha.
 * - **One `var()` among the parts**, `var(--c)` or `var(--c) no-repeat`: the ground with the alpha of
 *   the custom property, a system color that it holds excepted. Where it holds no color, but an image
 *   or a position, the relative color is invalid and the ground transparent: the browser, where the
 *   background has no color then, gives `Canvas` with the alpha of the initial `transparent`. A
 *   custom property of a background list gives the color of its last layer.
 * - **Several**, `var(--c) var(--pos)`: a system color that one of them holds stays, and else the
 *   ground, with the alpha of the last layer of a background list that one of them holds, and opaque
 *   otherwise: the twin cannot tell which of them is the color, and errs toward the ground.
 * - **None**, `linear-gradient(var(--a), var(--b))`: no color, which the original leaves at the
 *   initial `transparent` already.
 */
function backgroundColorOf(value: string, context: TwinContext): string | null {
    const layers = splitList(value);
    const parts = partsOf(layers[layers.length - 1]);
    const written = parts.find(isBackgroundColor);
    const vars = partVars(parts);
    // The colors of the last layers of the background lists among them, the first that applies, or `last`.
    const layerColors = (last: string): string =>
        vars.filter((name) => context.layerVars.has(name)).reduceRight((inner, name) => `var(${layerColorName(name)}, ${inner})`, last);

    if (written !== undefined) return forcedColor(written, groundOf(written), context.palette);
    if (vars.length === 0) return null;
    if (vars.length === 1) return behindShadows(vars, groundOf(layerColors(parts.find((part) => PART_VAR.test(part)) as string)));

    const lists = layerColors(GROUND);

    return behindShadows(vars, lists === GROUND ? GROUND : groundOf(lists));
}

/** `value`, a list of animation names, with the names that have a twin renamed, or `null` if none has. */
function animationNames(value: string, keyframes: ReadonlySet<string>): string | null {
    let renamed = false;
    const names = splitList(value).map((part) => {
        const item = part.trim();
        const quote = item.length > 1 && (item[0] === '"' || item[0] === "'") && item.endsWith(item[0]) ? item[0] : '';
        const name = quote ? item.slice(1, -1) : item;

        if (!keyframes.has(name)) return item;
        renamed = true;
        return `${quote}${keyframesTwinName(name)}${quote}`;
    });

    return renamed ? names.join(', ') : null;
}

/**
 * The declarations of a rule that a twin reads, from its style as the browser parsed it: the
 * forced longhands ({@link FOREGROUND_PROPERTIES}, `background-color`, `background-image`, the
 * shadows, `-webkit-text-fill-color`, `accent-color`, `scrollbar-color`), `animation-name`, every
 * custom property, and any other longhand whose value names a system color. Priorities come from
 * the style.
 *
 * A shorthand reads as its longhands (`border: 1px solid red` as `border-top-color: red` and the
 * rest), except where `var()` leaves them without a value: then the shorthand is one declaration
 * ({@link COLOR_SHORTHANDS}, `background`), as the style gives it. A longhand set after such a
 * shorthand in the same block hides it from the style, and its other longhands stay unread. A
 * color shorthand that the style lists itself, as an engine that does not expand shorthands does,
 * reads as one declaration too.
 *
 * With `all`, every declaration is read, for a keyframe, whose twin keeps what it does not force
 * ({@link forcedKeyframe}): any other shorthand that `var()` left whole as well.
 */
export function declarationsOfStyle(style: CSSStyleDeclaration, { all = false }: { all?: boolean } = {}): Declaration[] {
    const declarations: Declaration[] = [];
    let pending = false;
    let leftWhole = false;

    for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const custom = property.startsWith('--');
        const read = all || custom || READ_PROPERTIES.has(property) || PENDING_PROBES.has(property);

        if (!read && !carriesColor(property)) continue;

        const value = style.getPropertyValue(property).trim();

        if (!custom && value === '') {
            // Only a color without a value tells of a color shorthand to read whole: a radius or a margin does not.
            if (PROBES.has(property)) pending = true;
            else leftWhole ||= all;
            continue;
        }
        if (!read && !(NAMES_SYSTEM_COLOR.test(value) && resolveSystemColors(property, value, 'light') !== value)) continue;

        declarations.push({ property, value, important: style.getPropertyPriority(property) === 'important' });
    }
    if (pending) declarations.push(...pendingShorthands(style));
    if (leftWhole) declarations.push(...otherShorthandsLeftWhole(style, declarations));
    return declarations;
}

/** The longhands that {@link PENDING_PROBES} look at. */
const PROBES: ReadonlySet<string> = new Set(PENDING_PROBES.values());

/**
 * The shorthands besides those of {@link PENDING_PROBES} that the text of the style holds whole,
 * because `var()` left their longhands without a value. One that the text writes for longhands it
 * has read (`margin: 1px`) holds no `var()`, and is left out.
 */
function otherShorthandsLeftWhole(style: CSSStyleDeclaration, read: readonly Declaration[]): Declaration[] {
    const known = new Set(read.map(({ property }) => property));

    return declarationsOf(style.cssText)
        .map(propertyOf)
        .filter((property) => !known.has(property) && !PENDING_PROBES.has(property))
        .map((property) => ({ property, value: style.getPropertyValue(property).trim(), important: style.getPropertyPriority(property) === 'important' }))
        .filter(({ value }) => VAR.test(value));
}

/** The shorthands of {@link PENDING_PROBES} that the style holds whole, because `var()` left their longhands without a value. */
function pendingShorthands(style: CSSStyleDeclaration): Declaration[] {
    const declarations: Declaration[] = [];

    for (const [shorthand, probe] of PENDING_PROBES) {
        const value = style.getPropertyValue(shorthand).trim();

        if (value !== '' && style.getPropertyValue(probe) === '')
            declarations.push({ property: shorthand, value, important: style.getPropertyPriority(shorthand) === 'important' });
    }
    return declarations;
}
