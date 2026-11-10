import {
    backgroundLayers,
    type Declaration,
    declarationsOfStyle,
    exemptTwin,
    forcedKeyframe,
    forcedTwin,
    keyframesTwinName,
    layerColorName,
    layerImagesName,
    serializeDeclarations,
    shadowName,
    type TwinContext
} from './forced-values.js';

// `--ring` holds a background list of gradients, `--photo` one with a URL.
const ctx: TwinContext = { palette: 'dark', gradientVars: new Set(['--ai', '--ring']), layerVars: new Set(['--ring', '--photo']), keyframes: new Set(['pulse']) };

function d(property: string, value: string, important = false): Declaration {
    return { property, value, important };
}

describe('forcedTwin', () => {
    describe('foreground colors', () => {
        it('takes the foreground of the context for the text color, a transparent color included', () => {
            expect(forcedTwin([d('color', 'red')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
            expect(forcedTwin([d('color', 'transparent')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
        });

        it('takes the color of the element itself for every other foreground color, as Chromium does', () => {
            expect(forcedTwin([d('border-top-color', 'transparent')], ctx)).toEqual([d('border-top-color', 'currentcolor')]);
            expect(
                forcedTwin(
                    [
                        d('border-inline-end-color', 'red'),
                        d('text-decoration-color', 'red'),
                        d('text-emphasis-color', 'red'),
                        d('column-rule-color', 'red'),
                        d('caret-color', 'red')
                    ],
                    ctx
                )
            ).toEqual([
                d('border-inline-end-color', 'currentcolor'),
                d('text-decoration-color', 'currentcolor'),
                d('text-emphasis-color', 'currentcolor'),
                d('column-rule-color', 'currentcolor'),
                d('caret-color', 'currentcolor')
            ]);
        });

        it('takes the outline of the focus before the color of the element for an outline', () => {
            expect(forcedTwin([d('outline-color', 'transparent')], ctx)).toEqual([d('outline-color', 'var(--prism-sim-outline, currentcolor)')]);
        });

        it.each(['currentcolor', 'currentColor', 'CURRENTCOLOR'])('leaves %s standing, which is the forced color of the element already', (keyword) => {
            expect(
                forcedTwin(
                    [
                        d('color', keyword),
                        d('border-top-color', keyword),
                        d('text-decoration-color', keyword),
                        d('caret-color', keyword),
                        d('-webkit-text-fill-color', keyword)
                    ],
                    ctx
                )
            ).toEqual([]);
        });

        it('gives an outline in the color of the element the outline of the focus, which Chromium forces on it as on any other', () => {
            expect(forcedTwin([d('outline-color', 'currentColor'), d('outline-color', 'currentcolor', true)], ctx)).toEqual([
                d('outline-color', 'var(--prism-sim-outline, currentcolor)'),
                d('outline-color', 'var(--prism-sim-outline, currentcolor)', true)
            ]);
        });

        it('gives the outline that the browser expands without a color the outline of the focus, which Chromium forces on any outline', () => {
            // `outline: 2px solid` sets `outline-color: initial`.
            expect(forcedTwin([d('outline-color', 'initial'), d('outline-color', 'UNSET', true)], ctx)).toEqual([
                d('outline-color', 'var(--prism-sim-outline, currentcolor)'),
                d('outline-color', 'var(--prism-sim-outline, currentcolor)', true)
            ]);
            expect(forcedTwin([d('outline-color', 'inherit'), d('border-top-color', 'initial'), d('text-decoration-color', 'initial')], ctx)).toEqual([]);
        });

        it('leaves an automatic caret standing, which follows the color of the element', () => {
            expect(forcedTwin([d('caret-color', 'auto'), d('caret-color', 'AUTO', true)], ctx)).toEqual([]);
        });

        it('leaves a system color standing, in the palette, with its priority', () => {
            expect(forcedTwin([d('border-top-color', 'Highlight', true)], ctx)).toEqual([d('border-top-color', 'rgba(0, 230, 255, 0.8)', true)]);
            expect(forcedTwin([d('color', 'light-dark(Highlight, Mark)')], ctx)).toEqual([d('color', 'light-dark(rgba(0, 230, 255, 0.8), #ffff00)')]);
            expect(forcedTwin([d('outline-color', 'Highlight')], ctx)).toEqual([d('outline-color', 'rgba(0, 230, 255, 0.8)')]);
        });

        it('forces the system colors that Chromium forces like any other color', () => {
            expect(forcedTwin([d('color', 'AccentColor')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
            expect(forcedTwin([d('background-color', 'AccentColor')], ctx)).toEqual([d('background-color', 'rgb(from AccentColor var(--prism-sim-bg-rgb) / alpha)')]);
        });

        it('lets the text fill follow the color', () => {
            expect(forcedTwin([d('-webkit-text-fill-color', 'transparent')], ctx)).toEqual([d('-webkit-text-fill-color', 'currentcolor')]);
            expect(forcedTwin([d('-webkit-text-fill-color', 'var(--tok)')], ctx)).toEqual([d('-webkit-text-fill-color', 'var(--prism-sim-sys-tok, currentcolor)')]);
        });

        it('lets a system color stand that a custom property holds', () => {
            expect(forcedTwin([d('color', 'var(--tok)')], ctx)).toEqual([d('color', 'var(--prism-sim-sys-tok, var(--prism-sim-fg))')]);
            expect(forcedTwin([d('outline-color', 'var(--tok)', true)], ctx)).toEqual([
                d('outline-color', 'var(--prism-sim-sys-tok, var(--prism-sim-outline, currentcolor))', true)
            ]);
            expect(forcedTwin([d('border-top-color', 'var(--tok)')], ctx)).toEqual([d('border-top-color', 'var(--prism-sim-sys-tok, currentcolor)')]);
        });

        it('forces a value in which var() is only a part, or has a fallback', () => {
            expect(forcedTwin([d('color', 'color-mix(in srgb, var(--tok), red)')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
            expect(forcedTwin([d('color', 'var(--tok, Highlight)')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
        });

        it('forces accent-color and scrollbar-color to auto, as Chromium does, and lets a system color stand in accent-color', () => {
            expect(forcedTwin([d('accent-color', 'red'), d('scrollbar-color', 'red blue')], ctx)).toEqual([d('accent-color', 'auto'), d('scrollbar-color', 'auto')]);
            expect(forcedTwin([d('accent-color', 'Highlight')], ctx)).toEqual([d('accent-color', 'rgba(0, 230, 255, 0.8)')]);
            expect(forcedTwin([d('accent-color', 'var(--tok)')], ctx)).toEqual([d('accent-color', 'var(--prism-sim-sys-tok, auto)')]);
        });
    });

    describe('background', () => {
        it('takes the ground of the context with the alpha of the original', () => {
            expect(forcedTwin([d('background-color', '#fff')], ctx)).toEqual([d('background-color', 'rgb(from #fff var(--prism-sim-bg-rgb) / alpha)')]);
            expect(forcedTwin([d('background-color', 'transparent', true)], ctx)).toEqual([
                d('background-color', 'rgb(from transparent var(--prism-sim-bg-rgb) / alpha)', true)
            ]);
        });

        it('leaves a system color standing in the palette', () => {
            expect(forcedTwin([d('background-color', 'Highlight')], ctx)).toEqual([d('background-color', 'rgba(0, 230, 255, 0.8)')]);
        });

        it('lets a system color stand that a custom property holds', () => {
            expect(forcedTwin([d('background-color', 'var(--tok)')], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-tok, rgb(from var(--tok) var(--prism-sim-bg-rgb) / alpha))')
            ]);
        });

        it('removes a gradient and keeps an image with a URL', () => {
            expect(forcedTwin([d('background-image', 'linear-gradient(red, blue)')], ctx)).toEqual([d('background-image', 'none')]);
            expect(forcedTwin([d('background-image', 'repeating-conic-gradient(red, blue)')], ctx)).toEqual([d('background-image', 'none')]);
            expect(forcedTwin([d('background-image', 'linear-gradient(red, blue), url(a.png)')], ctx)).toEqual([]);
            expect(forcedTwin([d('background-image', 'url(a.png)'), d('background-image', 'none')], ctx)).toEqual([]);
        });

        it('removes the image that a custom property of gradients holds', () => {
            expect(forcedTwin([d('background-image', 'var(--ai)')], ctx)).toEqual([d('background-image', 'none')]);
            expect(forcedTwin([d('background-image', 'var(--ai), url(a.png)')], ctx)).toEqual([]);
            expect(forcedTwin([d('background-image', 'var(--other)')], ctx)).toEqual([]);
        });

        it('splits a shorthand that var() left whole into color and image', () => {
            expect(forcedTwin([d('background', 'var(--ai)')], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-ai, rgb(from var(--ai) var(--prism-sim-bg-rgb) / alpha))'),
                d('background-image', 'none')
            ]);
            expect(forcedTwin([d('background', 'var(--surface)', true)], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-surface, rgb(from var(--surface) var(--prism-sim-bg-rgb) / alpha))', true)
            ]);
        });

        it('takes the color of the last layer of a background list in a custom property, and drops its gradients layer by layer', () => {
            expect(forcedTwin([d('background', 'var(--ring)', true)], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-ring, rgb(from var(--prism-sim-layer-color-ring, var(--ring)) var(--prism-sim-bg-rgb) / alpha))', true),
                d('background-image', 'var(--prism-sim-layer-images-ring, none)', true)
            ]);
            // A URL keeps the images of the list, as it does in a single one.
            expect(forcedTwin([d('background', 'var(--photo)')], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-photo, rgb(from var(--prism-sim-layer-color-photo, var(--photo)) var(--prism-sim-bg-rgb) / alpha))')
            ]);
        });

        it('reads a background list as a background color or image as it is, which is invalid there, in the real mode too', () => {
            expect(forcedTwin([d('background-color', 'var(--ring)'), d('background-image', 'var(--ring)')], ctx)).toEqual([
                d('background-color', 'var(--prism-sim-sys-ring, rgb(from var(--ring) var(--prism-sim-bg-rgb) / alpha))'),
                d('background-image', 'none')
            ]);
        });

        it('cannot tell the color in a shorthand that holds more than a var(), and leaves it', () => {
            expect(forcedTwin([d('background', 'var(--surface) no-repeat')], ctx)).toEqual([]);
            expect(forcedTwin([d('background', 'linear-gradient(var(--a), var(--b)) no-repeat')], ctx)).toEqual([d('background-image', 'none')]);
            expect(forcedTwin([d('background', 'var(--ai) url(a.png)')], ctx)).toEqual([]);
        });
    });

    describe('shorthands that var() left without longhands', () => {
        it('forces the colors of a border to the color of the element', () => {
            expect(forcedTwin([d('border', '1px solid var(--c)', true)], ctx)).toEqual([
                d('border-top-color', 'currentcolor', true),
                d('border-right-color', 'currentcolor', true),
                d('border-bottom-color', 'currentcolor', true),
                d('border-left-color', 'currentcolor', true)
            ]);
            expect(forcedTwin([d('border-bottom', '1px solid var(--c)')], ctx)).toEqual([d('border-bottom-color', 'currentcolor')]);
            expect(forcedTwin([d('border-block', '1px solid var(--c)')], ctx)).toEqual([
                d('border-block-start-color', 'currentcolor'),
                d('border-block-end-color', 'currentcolor')
            ]);
            expect(forcedTwin([d('border-inline-start', 'var(--b)')], ctx)).toEqual([d('border-inline-start-color', 'currentcolor')]);
        });

        it('lets the system color stand that a custom property of a border color holds', () => {
            expect(forcedTwin([d('border-color', 'var(--tok)')], ctx)).toEqual([
                d('border-top-color', 'var(--prism-sim-sys-tok, currentcolor)'),
                d('border-right-color', 'var(--prism-sim-sys-tok, currentcolor)'),
                d('border-bottom-color', 'var(--prism-sim-sys-tok, currentcolor)'),
                d('border-left-color', 'var(--prism-sim-sys-tok, currentcolor)')
            ]);
        });

        it('forces an outline to the outline of the focus, or else to the color of the element', () => {
            expect(forcedTwin([d('outline', '2px solid var(--c)')], ctx)).toEqual([d('outline-color', 'var(--prism-sim-outline, currentcolor)')]);
        });

        it('forces the color of a text decoration, a text emphasis and a column rule to the color of the element', () => {
            expect(forcedTwin([d('text-decoration', 'underline var(--c)')], ctx)).toEqual([d('text-decoration-color', 'currentcolor')]);
            expect(forcedTwin([d('text-emphasis', 'dot var(--c)')], ctx)).toEqual([d('text-emphasis-color', 'currentcolor')]);
            expect(forcedTwin([d('column-rule', '1px solid var(--c)')], ctx)).toEqual([d('column-rule-color', 'currentcolor')]);
        });
    });

    describe('shadows', () => {
        it('removes them', () => {
            expect(forcedTwin([d('box-shadow', '0 0 0 3px blue'), d('text-shadow', '1px 1px red')], ctx)).toEqual([d('box-shadow', 'none'), d('text-shadow', 'none')]);
            expect(forcedTwin([d('box-shadow', 'var(--shadow)', true)], ctx)).toEqual([d('box-shadow', 'none', true)]);
        });

        it('has nothing to remove from none', () => {
            expect(forcedTwin([d('box-shadow', 'none'), d('text-shadow', 'NONE')], ctx)).toEqual([]);
        });
    });

    describe('what is not forced', () => {
        it('leaves the paint of an SVG and the rest alone, as Chromium does', () => {
            expect(
                forcedTwin([d('fill', 'red'), d('stroke', 'blue'), d('stop-color', 'red'), d('flood-color', 'red'), d('lighting-color', 'red'), d('padding', '2px')], ctx)
            ).toEqual([]);
        });

        it('resolves a system color against the forced palette all the same', () => {
            expect(forcedTwin([d('fill', 'Highlight')], ctx)).toEqual([d('fill', 'rgba(0, 230, 255, 0.8)')]);
            expect(forcedTwin([d('stroke', 'ButtonText', true)], ctx)).toEqual([d('stroke', '#ffffff', true)]);
            expect(forcedTwin([d('stop-color', 'Highlight'), d('flood-color', 'Canvas')], ctx)).toEqual([
                d('stop-color', 'rgba(0, 230, 255, 0.8)'),
                d('flood-color', '#000000')
            ]);
        });

        it('leaves a keyword that is a word where it is no color', () => {
            expect(forcedTwin([d('transition', 'background 0.2s'), d('font', 'menu')], ctx)).toEqual([]);
        });

        it.each(['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'INHERIT'])(
            'leaves the CSS-wide keyword %s: it takes a value that is forced already or none',
            (keyword) => {
                expect(forcedTwin([d('color', keyword), d('background-color', keyword), d('box-shadow', keyword), d('border-top-color', keyword)], ctx)).toEqual([]);
            }
        );

        it('reads a property in any case', () => {
            expect(forcedTwin([d('COLOR', 'red')], ctx)).toEqual([d('color', 'var(--prism-sim-fg)')]);
        });
    });

    describe('custom properties', () => {
        it('writes the palette value of a system color, and the same into the shadow', () => {
            expect(forcedTwin([d('--tok', 'ButtonText')], ctx)).toEqual([d('--tok', '#ffffff'), d('--prism-sim-sys-tok', '#ffffff')]);
            expect(forcedTwin([d('--tok', 'ButtonText', true)], ctx)).toEqual([d('--tok', '#ffffff', true), d('--prism-sim-sys-tok', '#ffffff', true)]);
            expect(forcedTwin([d('--tok', 'light-dark(Highlight, Mark)')], ctx)).toEqual([
                d('--tok', 'light-dark(rgba(0, 230, 255, 0.8), #ffff00)'),
                d('--prism-sim-sys-tok', 'light-dark(rgba(0, 230, 255, 0.8), #ffff00)')
            ]);
        });

        it('hands on the shadow of the custom property it takes its value from', () => {
            expect(forcedTwin([d('--a', 'var(--b)')], ctx)).toEqual([d('--prism-sim-sys-a', 'var(--prism-sim-sys-b)')]);
        });

        it('has no system color for any other value', () => {
            expect(forcedTwin([d('--gap', '4px')], ctx)).toEqual([d('--prism-sim-sys-gap', 'initial')]);
            expect(forcedTwin([d('--a', 'var(--b, red)')], ctx)).toEqual([d('--prism-sim-sys-a', 'initial')]);
            expect(forcedTwin([d('--empty', '')], ctx)).toEqual([d('--prism-sim-sys-empty', 'initial')]);
        });

        it('follows the parent, where the custom property does', () => {
            expect(forcedTwin([d('--tok', 'inherit'), d('--other', 'unset'), d('--reset', 'initial')], ctx)).toEqual([
                d('--prism-sim-sys-tok', 'inherit'),
                d('--prism-sim-sys-other', 'inherit'),
                d('--prism-sim-sys-reset', 'initial')
            ]);
        });

        it('takes a deprecated system color for a word: no substitution, no shadow of a color', () => {
            expect(forcedTwin([d('--word', 'Background')], ctx)).toEqual([d('--prism-sim-sys-word', 'initial')]);
        });

        it('keeps a system color that Chromium forces out of the shadow, but substitutes the value', () => {
            expect(forcedTwin([d('--accent', 'AccentColor')], ctx)).toEqual([d('--accent', '#0075ff'), d('--prism-sim-sys-accent', 'initial')]);
        });

        it('keeps the case of the name', () => {
            expect(forcedTwin([d('--Tok', 'red')], ctx)).toEqual([d('--prism-sim-sys-Tok', 'initial')]);
        });

        it('gives a background list the shadows of its last layer and of its images, with a system color in the palette', () => {
            expect(forcedTwin([d('--ring', 'linear-gradient(red, blue), #8529d5', true)], ctx)).toEqual([
                d('--prism-sim-sys-ring', 'initial', true),
                d('--prism-sim-layer-color-ring', '#8529d5', true),
                d('--prism-sim-layer-images-ring', 'none, none', true)
            ]);
            expect(forcedTwin([d('--ring', 'linear-gradient(red, blue), radial-gradient(red, blue), Mark')], ctx)).toEqual([
                d('--prism-sim-sys-ring', 'initial'),
                d('--prism-sim-layer-color-ring', '#ffff00'),
                d('--prism-sim-layer-images-ring', 'none, none, none')
            ]);
        });

        it('gives the images of a list with a URL no shadow: they stay', () => {
            expect(forcedTwin([d('--photo', 'url(a.png) no-repeat, rgb(0 0 0 / 0.4)')], ctx)).toEqual([
                d('--prism-sim-sys-photo', 'initial'),
                d('--prism-sim-layer-color-photo', 'rgb(0 0 0 / 0.4)')
            ]);
        });

        it('gives the other declarations of a custom property that holds a background list the shadows too, so that the one that wins says what it holds', () => {
            // A single color leaves the reader to `var(--ring)` itself.
            expect(forcedTwin([d('--ring', '#fff')], ctx)).toEqual([
                d('--prism-sim-sys-ring', 'initial'),
                d('--prism-sim-layer-color-ring', 'initial'),
                d('--prism-sim-layer-images-ring', 'initial')
            ]);
            expect(forcedTwin([d('--ring', 'var(--base)')], ctx)).toEqual([
                d('--prism-sim-sys-ring', 'var(--prism-sim-sys-base)'),
                d('--prism-sim-layer-color-ring', 'var(--prism-sim-layer-color-base)'),
                d('--prism-sim-layer-images-ring', 'var(--prism-sim-layer-images-base)')
            ]);
            expect(forcedTwin([d('--ring', 'inherit')], ctx)).toEqual([
                d('--prism-sim-sys-ring', 'inherit'),
                d('--prism-sim-layer-color-ring', 'inherit'),
                d('--prism-sim-layer-images-ring', 'inherit')
            ]);
        });

        it('gives a list the shadows only for a custom property that holds one somewhere', () => {
            expect(forcedTwin([d('--other', 'linear-gradient(red, blue), #8529d5')], ctx)).toEqual([d('--prism-sim-sys-other', 'initial')]);
        });
    });

    describe('animation-name', () => {
        it('names the twin of a @keyframes that has one', () => {
            expect(forcedTwin([d('animation-name', 'pulse, spin')], ctx)).toEqual([d('animation-name', 'pulse-prism-sim, spin')]);
            expect(forcedTwin([d('animation-name', 'pulse', true)], ctx)).toEqual([d('animation-name', 'pulse-prism-sim', true)]);
            expect(forcedTwin([d('animation-name', '"pulse", spin')], ctx)).toEqual([d('animation-name', '"pulse-prism-sim", spin')]);
        });

        it('has nothing to say about the others', () => {
            expect(forcedTwin([d('animation-name', 'spin')], ctx)).toEqual([]);
            expect(forcedTwin([d('animation-name', 'none')], ctx)).toEqual([]);
            expect(forcedTwin([d('animation-name', 'spin, "a,pulse"')], ctx)).toEqual([]);
        });
    });

    it('twins every declaration, in order', () => {
        expect(forcedTwin([d('color', 'red'), d('padding', '2px'), d('background-color', '#fff', true), d('--x', '1')], ctx)).toEqual([
            d('color', 'var(--prism-sim-fg)'),
            d('background-color', 'rgb(from #fff var(--prism-sim-bg-rgb) / alpha)', true),
            d('--prism-sim-sys-x', 'initial')
        ]);
    });

    it('is empty when the rule forces nothing', () => {
        expect(forcedTwin([], ctx)).toEqual([]);
        expect(forcedTwin([d('display', 'flex'), d('width', '10px')], ctx)).toEqual([]);
    });

    it('gives the light palette to the system colors of a light context', () => {
        const light: TwinContext = { ...ctx, palette: 'light' };

        expect(forcedTwin([d('border-top-color', 'Highlight'), d('--tok', 'ButtonText')], light)).toEqual([
            d('border-top-color', 'rgba(5, 0, 73, 0.8)'),
            d('--tok', '#000000'),
            d('--prism-sim-sys-tok', '#000000')
        ]);
    });
});

describe('exemptTwin', () => {
    it('keeps the declarations that name a system color, with the palette value, and nothing else', () => {
        expect(exemptTwin([d('background', 'Highlight'), d('color', 'red')], ctx)).toEqual([d('background', 'rgba(0, 230, 255, 0.8)')]);
    });

    it('takes a system color in any property that takes a color, a deprecated one included, with the priority', () => {
        expect(exemptTwin([d('fill', 'Highlight', true), d('border-top-color', 'window'), d('background-image', 'linear-gradient(Highlight, Canvas)')], ctx)).toEqual([
            d('fill', 'rgba(0, 230, 255, 0.8)', true),
            d('border-top-color', '#000000'),
            d('background-image', 'linear-gradient(rgba(0, 230, 255, 0.8), #000000)')
        ]);
    });

    it('takes a custom property whose whole value is a system color, and no shadow', () => {
        expect(exemptTwin([d('--tok', 'ButtonText'), d('--word', 'Background'), d('--gap', '4px')], ctx)).toEqual([d('--tok', '#ffffff')]);
    });

    it('leaves a keyword that is a word where it is no color', () => {
        expect(exemptTwin([d('transition', 'background 0.2s'), d('font', 'menu')], ctx)).toEqual([]);
    });

    it('is empty when no declaration names a system color', () => {
        expect(exemptTwin([d('color', 'red'), d('padding', '2px')], ctx)).toEqual([]);
        expect(exemptTwin([], ctx)).toEqual([]);
    });
});

describe('forcedKeyframe', () => {
    it('replaces the forced declarations as a twin does and leaves the rest', () => {
        expect(forcedKeyframe([d('background-color', '#c00'), d('transform', 'scale(2)')], ctx)).toEqual([
            d('background-color', 'rgb(from #c00 var(--prism-sim-bg-rgb) / alpha)'),
            d('transform', 'scale(2)')
        ]);
    });

    it('keeps the order and the declaration that a twin leaves alone', () => {
        expect(forcedKeyframe([d('color', 'red'), d('background-image', 'url(a.png)'), d('box-shadow', 'none'), d('opacity', '0')], ctx)).toEqual([
            d('color', 'var(--prism-sim-fg)'),
            d('background-image', 'url(a.png)'),
            d('box-shadow', 'none'),
            d('opacity', '0')
        ]);
    });

    it('keeps a custom property and adds its shadow, or replaces the value of a system color', () => {
        expect(forcedKeyframe([d('--gap', '4px'), d('--tok', 'ButtonText')], ctx)).toEqual([
            d('--gap', '4px'),
            d('--prism-sim-sys-gap', 'initial'),
            d('--tok', '#ffffff'),
            d('--prism-sim-sys-tok', '#ffffff')
        ]);
    });

    it('takes the color of the element for a border, and leaves currentcolor standing', () => {
        expect(forcedKeyframe([d('border-top-color', 'red'), d('text-decoration-color', 'currentcolor'), d('color', 'currentColor')], ctx)).toEqual([
            d('border-top-color', 'currentcolor'),
            d('text-decoration-color', 'currentcolor'),
            d('color', 'currentColor')
        ]);
    });

    it('is empty for a keyframe without declarations', () => {
        expect(forcedKeyframe([], ctx)).toEqual([]);
    });
});

describe('names', () => {
    it('shadows a custom property', () => {
        expect(shadowName('--tok')).toBe('--prism-sim-sys-tok');
        expect(shadowName('--Tok-2')).toBe('--prism-sim-sys-Tok-2');
    });

    it('shadows the last layer and the images of a background list', () => {
        expect(layerColorName('--Ring')).toBe('--prism-sim-layer-color-Ring');
        expect(layerImagesName('--Ring')).toBe('--prism-sim-layer-images-Ring');
    });

    it('names the twin of a @keyframes', () => {
        expect(keyframesTwinName('pulse')).toBe('pulse-prism-sim');
    });
});

describe('backgroundLayers', () => {
    it('splits a background list into its layers', () => {
        expect(backgroundLayers('linear-gradient(110deg, rgba(240, 225, 255, 0.1) 0%, rgba(47, 6, 72, 0.4) 100%), #8529d5')).toEqual([
            'linear-gradient(110deg, rgba(240, 225, 255, 0.1) 0%, rgba(47, 6, 72, 0.4) 100%)',
            '#8529d5'
        ]);
        expect(backgroundLayers(' url("a,b.png") no-repeat , conic-gradient(red, blue) , none')).toEqual([
            'url("a,b.png") no-repeat',
            'conic-gradient(red, blue)',
            'none'
        ]);
    });

    it('finds no list in a single layer, or in a list whose layers are not images', () => {
        expect(backgroundLayers('linear-gradient(red, blue)')).toBeNull();
        expect(backgroundLayers('#8529d5')).toBeNull();
        expect(backgroundLayers('Inter, sans-serif')).toBeNull();
        expect(backgroundLayers('0 1px 2px red, 0 2px 4px blue')).toBeNull();
        expect(backgroundLayers('red, linear-gradient(red, blue)')).toBeNull();
    });
});

describe('serializeDeclarations', () => {
    it('writes the declarations as the text of a block', () => {
        expect(serializeDeclarations([d('a', 'b', true), d('c', 'd')])).toBe('a: b !important; c: d');
        expect(serializeDeclarations([d('--x', 'rgb(from #fff var(--y) / alpha)')])).toBe('--x: rgb(from #fff var(--y) / alpha)');
        expect(serializeDeclarations([])).toBe('');
    });
});

/**
 * A style as an engine lists it: `listed` in order, each with its value and priority, and the
 * shorthands of `whole`, which the style gives a value without listing them. `asked` records every
 * property whose value was read.
 */
function styleOf(listed: readonly [string, string, boolean?][], whole: Record<string, string> = {}): { style: CSSStyleDeclaration; asked: string[] } {
    const asked: string[] = [];
    const values = new Map(listed.map(([property, value, important]) => [property, { value, important: important === true }]));
    const style = Object.assign(
        listed.map(([property]) => property),
        {
            getPropertyValue(property: string): string {
                asked.push(property);
                return values.get(property)?.value ?? whole[property] ?? '';
            },
            getPropertyPriority: (property: string): string => (values.get(property)?.important ? 'important' : '')
        }
    );

    return { style: style as unknown as CSSStyleDeclaration, asked };
}

describe('declarationsOfStyle', () => {
    it('reads a color shorthand that the style lists itself, as an engine that does not expand shorthands does', () => {
        const { style } = styleOf([
            ['border-color', 'blue', true],
            ['padding', '1px']
        ]);

        expect(declarationsOfStyle(style)).toEqual([d('border-color', 'blue', true)]);
    });

    it('reads every declaration for a keyframe, whose twin keeps what it does not force', () => {
        const { style } = styleOf([
            ['background-color', 'red'],
            ['transform', 'scale(2)'],
            ['opacity', '0']
        ]);

        expect(declarationsOfStyle(style, { all: true })).toEqual([d('background-color', 'red'), d('transform', 'scale(2)'), d('opacity', '0')]);
        expect(declarationsOfStyle(style)).toEqual([d('background-color', 'red')]);
    });

    it('looks for a shorthand that var() left whole only when a color it sets has no value', () => {
        // `border-radius: var(--r)` leaves the radii without a value, and no color.
        const radius = styleOf(
            [
                ['border-top-left-radius', ''],
                ['color', 'red']
            ],
            { 'border-radius': 'var(--r)' }
        );

        expect(declarationsOfStyle(radius.style)).toEqual([d('color', 'red')]);
        expect(radius.asked).not.toContain('border');
        expect(radius.asked).not.toContain('background');

        const border = styleOf([['border-top-color', '']], { border: '1px solid var(--c)' });

        expect(declarationsOfStyle(border.style)).toEqual([d('border', '1px solid var(--c)')]);
    });
});
