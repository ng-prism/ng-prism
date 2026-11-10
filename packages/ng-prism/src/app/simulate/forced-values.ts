import { carriesColor, type ForcedPaletteName, keepsSystemColor, resolveSystemColors, substituteSystemColors, SYSTEM_COLORS } from './forced-palette.js';
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
    /** Names of the @keyframes that got a twin. */
    readonly keyframes: ReadonlySet<string>;
}

/**
 * The properties whose color Chromium forces to the one of the context: the text color, the
 * colors of borders, outlines, text decorations and emphasis, column rules, the caret, and the
 * colors of SVG filters and gradient stops.
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
    'caret-color',
    'stop-color',
    'flood-color',
    'lighting-color'
]);

const FOREGROUND = 'var(--prism-sim-fg)';
const OUTLINE = 'var(--prism-sim-outline, var(--prism-sim-fg))';
const GROUND_CHANNELS = 'var(--prism-sim-bg-rgb)';

/**
 * What the properties that take the color of the context take: the foreground, the outline of the
 * focus for `outline-color`, the color for the text fill (a transparent fill over a gradient
 * would vanish with the gradient), `auto` for the two that Chromium resets to it.
 */
const COLOR_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
    ...Array.from(FOREGROUND_PROPERTIES, (property): [string, string] => [property, FOREGROUND]),
    ['outline-color', OUTLINE],
    ['-webkit-text-fill-color', 'currentcolor'],
    ['accent-color', 'auto'],
    ['scrollbar-color', 'auto']
]);

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

/** The name in a value that is nothing but `var(--name)`: `--name`, or `null` for any other value, a `var()` with a fallback too. */
function wholeVar(value: string): string | null {
    return WHOLE_VAR.exec(value)?.[1] ?? null;
}

/** The custom property that carries "this custom property's winning value is a kept system color": `--tok` to `--prism-sim-sys-tok`. */
export function shadowName(customProperty: string): string {
    return `--prism-sim-sys-${customProperty.slice(2)}`;
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
 * - **Foreground colors** ({@link FOREGROUND_PROPERTIES}) take the foreground of the context,
 *   `transparent` included; `outline-color` the outline of the focus before it;
 *   `-webkit-text-fill-color` the text color; `accent-color` and `scrollbar-color` `auto`.
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
 *   the palette (a whole value, and not a deprecated name that may be a word).
 * - **`animation-name`** names the twins of the @keyframes that have one.
 * - **Any other property** gets its system colors in the palette where it can carry a color
 *   ({@link resolveSystemColors}), and is left alone otherwise: `fill` and `stroke` are not forced.
 * - **A shorthand that `var()` left without longhands** ({@link declarationsOfStyle}) gets the
 *   forced values of its color, and of its image for `background`. A `background` that holds
 *   more than one `var()`, or a `var()` among other values, keeps its color: the twin cannot tell
 *   which of its parts is the color.
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
    if (CSS_WIDE.has(text.toLowerCase())) return [];

    const replacement = COLOR_REPLACEMENTS.get(name);

    if (replacement !== undefined) return [set(name, forcedColor(text, replacement, context.palette))];

    const shorthand = COLOR_SHORTHANDS.get(name);

    if (shorthand) {
        return shorthand.colors.map((longhand) => {
            const forced = COLOR_REPLACEMENTS.get(longhand) as string;

            return set(longhand, shorthand.colorOnly ? forcedColor(text, forced, context.palette) : forced);
        });
    }

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

/** A custom property's twin: its value as a system color of the palette, if it is one, and its shadow. */
function customPropertyTwin(property: string, value: string, important: boolean, context: TwinContext): Declaration[] {
    const resolved = resolveSystemColors(property, value, context.palette);
    const twin: Declaration[] = [];

    if (resolved !== value) twin.push({ property, value: resolved, important });
    twin.push({ property: shadowName(property), value: shadowValue(value, context.palette), important });
    return twin;
}

/**
 * What a custom property's shadow holds for a declaration of its value: the system color it is,
 * if Chromium leaves it standing, the shadow of the custom property it passes on, or nothing
 * (`initial`, an invalid value, so that the reader falls back to the forced value). A deprecated
 * name is no color here, it may be a word. A custom property that inherits its value inherits the
 * shadow with it.
 */
function shadowValue(value: string, palette: ForcedPaletteName): string {
    if (keepsSystemColor(value, { deprecated: false })) return substituteSystemColors(value, palette);

    const custom = wholeVar(value);

    if (custom !== null) return `var(${shadowName(custom)})`;

    const keyword = value.toLowerCase();

    return keyword === 'inherit' || keyword === 'unset' ? 'inherit' : 'initial';
}

/** Whether Chromium takes the background image of `value` away: a gradient is among the images, written out or in a custom property of gradients, and no `url()` is. */
function hasGradient(value: string, { gradientVars }: TwinContext): boolean {
    if (URL_IMAGE.test(value)) return false;

    return GRADIENT.test(value) || Array.from(value.matchAll(VARS), (match) => match[1]).some((name) => gradientVars.has(name));
}

/**
 * What a `background` that `var()` left without longhands sets: the color, if the value is
 * nothing but one `var()` (the color is then all it can be), and no image, if it holds a gradient.
 */
function backgroundShorthandTwin(value: string, context: TwinContext): [string, string][] {
    const twin: [string, string][] = [];

    if (wholeVar(value) !== null) twin.push(['background-color', forcedColor(value, groundOf(value), context.palette)]);
    if (hasGradient(value, context)) twin.push(['background-image', 'none']);
    return twin;
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
 * shorthand in the same block hides it from the style, and its other longhands stay unread.
 */
export function declarationsOfStyle(style: CSSStyleDeclaration): Declaration[] {
    const declarations: Declaration[] = [];
    let pending = false;

    for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const custom = property.startsWith('--');
        const read = custom || READ_PROPERTIES.has(property);

        if (!read && !carriesColor(property)) continue;

        const value = style.getPropertyValue(property).trim();

        if (!custom && value === '') {
            pending = true;
            continue;
        }
        if (!read && !(NAMES_SYSTEM_COLOR.test(value) && resolveSystemColors(property, value, 'light') !== value)) continue;

        declarations.push({ property, value, important: style.getPropertyPriority(property) === 'important' });
    }
    if (pending) declarations.push(...pendingShorthands(style));
    return declarations;
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
