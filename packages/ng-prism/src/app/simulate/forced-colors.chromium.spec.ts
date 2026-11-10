import type { Browser } from 'playwright';
import { type Fixture, launchChromium, normalizeColor, renderReal, renderSimulated, type Scheme, type SimulatedOptions } from './__test-utils__/chromium.js';

/** `CanvasText` of Chromium's forced palettes. */
const CANVAS_TEXT: Record<Scheme, string> = { light: 'rgba(0, 0, 0, 1)', dark: 'rgba(255, 255, 255, 1)' };

/** A scope root, the `.host` of a component, that holds `css` and `body`. */
function scope(css: string, body: string): string {
    return `<div class="host" data-prism-sim><style>${css}</style>${body}</div>`;
}

/** The elements of the fixture `background-var-among-values`, by class. */
const BACKGROUNDS = [
    'chip',
    'on',
    'kept',
    'kept-fallback',
    'two-vars',
    'written',
    'last-layer',
    'mix',
    'mix-system',
    'fallback',
    'ring',
    'translucent',
    'image',
    'named',
    'no-color'
];

/** A check mark, as a mask. */
const CHECK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8l3 3 7-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E")`;

let browser: Browser;

beforeAll(async () => {
    browser = await launchChromium();
});

afterAll(async () => {
    await browser?.close();
});

// The comparisons below rest on it: the real mode and the simulation write the same color differently.
it('normalizes the colors Chromium serializes differently', () => {
    expect(normalizeColor('color(srgb 0 0 0 / 0.501961)')).toBe(normalizeColor('rgba(0, 0, 0, 0.5)'));
    expect(normalizeColor('color(srgb 1 1 1 / 0.266667)')).toBe('rgba(255, 255, 255, 0.27)');
    expect(normalizeColor('rgb(0, 0, 0)')).toBe('rgba(0, 0, 0, 1)');
    expect(normalizeColor('rgba(0, 0, 0, 0.267) 0px 1px 2px 0px')).toBe('rgba(0, 0, 0, 0.27) 0px 1px 2px 0px');
    expect(normalizeColor('rgba(255, 255, 255, 0)')).toBe('rgba(0, 0, 0, 0)');
    expect(normalizeColor('color(srgb 1 1 1 / 0)')).toBe('rgba(0, 0, 0, 0)');
    // `transparent`, as Chromium computes it in every property, gradients and shadows included.
    expect(normalizeColor('rgba(0, 0, 0, 0)')).toBe('rgba(0, 0, 0, 0)');
    expect(normalizeColor('rgba(204, 0, 0, 0.004)')).toBe('rgba(0, 0, 0, 0)');
    expect(normalizeColor('linear-gradient(rgba(255, 255, 255, 0), rgb(0, 0, 0))')).toBe('linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 1))');
    // An animation between relative colors, in Oklab.
    expect(normalizeColor('oklab(0 0 0)')).toBe('rgba(0, 0, 0, 1)');
    expect(normalizeColor('oklab(0.999994 0.0000455678 0.0000200868)')).toBe('rgba(255, 255, 255, 1)');
    expect(normalizeColor('oklab(0.627955 0.224863 0.125846 / 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
    expect(normalizeColor('none')).toBe('none');
    expect(normalizeColor('color(display-p3 1 0 0)')).toBe('color(display-p3 1 0 0)');
});

/**
 * Each fixture renders twice, in Chromium's real forced colors mode and with
 * the simulation, and the simulation has to compute what Chromium computes, in
 * both palettes. A fixture for a divergence fails first and passes with its
 * fix; a divergence the simulation keeps on purpose is listed in the guide
 * (styleguide-ui.md › Forced colors › Where it differs), not parked here.
 */
describe.each<Scheme>(['light', 'dark'])('forced colors in the %s palette', (scheme) => {
    async function expectSimulationToMatch(fixture: Fixture): Promise<void> {
        expect(await renderSimulated(browser, fixture, scheme)).toEqual(await renderReal(browser, fixture, scheme));
    }

    // Without it, every comparison below could hold with forced colors off in both renders.
    it('harness: the real mode forces colors', async () => {
        const fixture: Fixture = {
            html: scope('', '<p style="color: red">Text</p>'),
            probes: [{ name: 'p', selector: 'p', properties: ['color'] }]
        };

        expect(await renderReal(browser, fixture, scheme)).toEqual({ p: { color: CANVAS_TEXT[scheme] } });
    });

    it('calibration: plain text', () =>
        expectSimulationToMatch({
            html: scope('', '<p>Text</p>'),
            probes: [{ name: 'p', selector: 'p', properties: ['color'] }]
        }));

    it('own-system-colors', () =>
        expectSimulationToMatch({
            html: scope(
                '@media (forced-colors: active) { .sel { background: Highlight; color: HighlightText; forced-color-adjust: none } }',
                '<span class="sel">Selected</span>'
            ),
            probes: [{ name: 'sel', selector: '.sel', properties: ['color', 'background-color'] }]
        }));

    it('hover-and-forced', () =>
        expectSimulationToMatch({
            html: scope('@media (hover: hover) and (forced-colors: active) { .h:hover { border: 2px solid Highlight } }', '<div class="h">Hover</div>'),
            probes: [{ name: 'h', selector: '.h', properties: ['border-top-color'] }],
            hover: '.h'
        }));

    it('svg-colors', () =>
        expectSimulationToMatch({
            html: scope(
                'rect.css { fill: red; stroke: blue }',
                '<svg width="40" height="20"><rect class="attr" width="10" height="10" fill="#c00" /><rect class="css" x="20" width="10" height="10" /></svg>'
            ),
            probes: [
                { name: 'attribute', selector: 'rect.attr', properties: ['fill', 'stroke'] },
                { name: 'css', selector: 'rect.css', properties: ['fill', 'stroke'] }
            ]
        }));

    // Chromium leaves the paint servers of an SVG to the author as it leaves fill and stroke, as attributes and in a
    // stylesheet: the stops of a gradient and the colors of a filter, even under forced-color-adjust: auto. A system
    // color in one resolves against the palette.
    it('svg-gradient-stops', () =>
        expectSimulationToMatch({
            html: scope(
                `.stop-css { stop-color: #c00 } .stop-system { stop-color: Highlight } .stop-auto { stop-color: #0c0; forced-color-adjust: auto }
                .flood-css { flood-color: #c00 } .light-css { lighting-color: #c00 }`,
                `<svg width="40" height="20">
                    <linearGradient id="g">
                        <stop class="stop-attr" stop-color="#c00" /><stop class="stop-css" offset="0.4" /><stop class="stop-system" offset="0.7" /><stop class="stop-auto" offset="1" />
                    </linearGradient>
                    <filter id="f">
                        <feFlood class="flood-attr" flood-color="#c00" /><feFlood class="flood-css" />
                        <feDiffuseLighting class="light-attr" lighting-color="#c00"><feDistantLight /></feDiffuseLighting>
                        <feDiffuseLighting class="light-css"><feDistantLight /></feDiffuseLighting>
                    </filter>
                    <rect width="40" height="20" fill="url(#g)" />
                </svg>`
            ),
            probes: [
                { name: 'stop-attr', selector: '.stop-attr', properties: ['stop-color'] },
                { name: 'stop-css', selector: '.stop-css', properties: ['stop-color'] },
                { name: 'stop-system', selector: '.stop-system', properties: ['stop-color'] },
                { name: 'stop-auto', selector: '.stop-auto', properties: ['stop-color'] },
                { name: 'flood-attr', selector: '.flood-attr', properties: ['flood-color'] },
                { name: 'flood-css', selector: '.flood-css', properties: ['flood-color'] },
                { name: 'light-attr', selector: '.light-attr', properties: ['lighting-color'] },
                { name: 'light-css', selector: '.light-css', properties: ['lighting-color'] }
            ]
        }));

    // Chromium's own styles give an <svg> forced-color-adjust: preserve-parent-color: the colors the author sets on it and
    // inside it stay, a system color in the palette, and one without a color of its own takes the forced color of its
    // parent, LinkText in a link. A <foreignObject> is auto again, and so is an element below the svg that the author
    // gives auto.
    it('svg-author-colors', () =>
        expectSimulationToMatch({
            html: scope(
                `.icon { color: #0af }
                .box { color: #c00; background-color: #0c0; border: 2px solid #00c; outline: 2px solid #c0c; box-shadow: 0 0 2px red }
                rect.r { fill: #c00; stroke: Highlight }
                g.auto { color: #c00; forced-color-adjust: auto }
                .fo { color: blue; background-color: #ff0; border: 1px solid red }`,
                `<svg class="icon" width="20" height="20"><path class="icon-path" d="M0 0h10v10z" fill="currentColor" /></svg>
                <svg class="box" width="40" height="20">
                    <rect class="r" width="10" height="10" /><g class="auto"><rect x="10" width="10" height="10" /></g>
                    <foreignObject class="fob" x="20" width="20" height="20"><div class="fo">fo</div></foreignObject>
                </svg>
                <a href="#x"><svg class="in-link" width="20" height="20"><path class="in-link-path" d="M0 0h10v10z" fill="currentColor" /></svg></a>`
            ),
            probes: [
                { name: 'icon', selector: 'svg.icon', properties: ['color'] },
                { name: 'icon-path', selector: '.icon-path', properties: ['fill'] },
                { name: 'box', selector: 'svg.box', properties: ['color', 'background-color', 'border-top-color', 'outline-color', 'box-shadow'] },
                { name: 'rect', selector: 'rect.r', properties: ['fill', 'stroke'] },
                { name: 'auto', selector: 'g.auto', properties: ['color'] },
                { name: 'foreignObject', selector: '.fob', properties: ['color'] },
                { name: 'fo', selector: '.fo', properties: ['color', 'background-color', 'border-top-color'] },
                { name: 'in-link', selector: 'svg.in-link', properties: ['color'] },
                { name: 'in-link-path', selector: '.in-link-path', properties: ['fill'] }
            ]
        }));

    // An author's forced-color-adjust: auto on the <svg> itself wins against Chromium's own preserve-parent-color: the
    // svg and what is inside it are forced, under an exemption of the author's too. Not probed: the fill of currentColor
    // inside it, which Chromium resolves against the color before it was forced (a limit in the guide).
    it('svg-auto-on-svg', () =>
        expectSimulationToMatch({
            html: scope(
                `svg.self { forced-color-adjust: auto; color: #c00; background-color: #0c0; border: 2px solid #00c } svg.self rect { color: #0af }
                .opt { forced-color-adjust: none } .opt svg.below { forced-color-adjust: auto; color: #c00 }`,
                `<svg class="self" width="20" height="20"><rect class="in-self" width="10" height="10" /></svg>
                <div class="opt"><svg class="below" width="20" height="20"><rect class="in-below" width="10" height="10" /></svg></div>`
            ),
            probes: [
                { name: 'self', selector: 'svg.self', properties: ['color', 'background-color', 'border-top-color'] },
                { name: 'in-self', selector: '.in-self', properties: ['color'] },
                { name: 'below', selector: 'svg.below', properties: ['color'] },
                { name: 'in-below', selector: '.in-below', properties: ['color'] }
            ]
        }));

    it('link', () =>
        expectSimulationToMatch({
            html: scope('a { color: red; border-bottom: 1px solid red }', '<a href="#target">Link <span>inside</span></a>'),
            probes: [
                { name: 'a', selector: 'a', properties: ['color', 'border-bottom-color'] },
                { name: 'span', selector: 'a span', properties: ['color', 'border-bottom-color'] }
            ]
        }));

    it('disabled-native', () =>
        expectSimulationToMatch({
            html: scope('', '<button disabled>Button</button><input type="search" disabled /><input type="text" disabled />'),
            probes: [
                { name: 'button', selector: 'button', properties: ['color', 'border-top-color'] },
                { name: 'search', selector: 'input[type=search]', properties: ['color', 'border-top-color'] },
                { name: 'text', selector: 'input[type=text]', properties: ['color', 'border-top-color'] }
            ]
        }));

    // Which controls Chromium grays out: not an input without a type, nor a checkbox; an option group and what is in it.
    it('disabled-controls', () =>
        expectSimulationToMatch({
            html: scope(
                '',
                `<input class="plain" disabled /><input type="email" disabled /><input type="checkbox" disabled /><textarea disabled></textarea>
                <select disabled><option>o</option></select><select><optgroup label="g" disabled><option class="in-group">o</option></optgroup></select>
                <button disabled>Button <span class="in-button">inside</span></button>`
            ),
            probes: [
                { name: 'plain', selector: 'input.plain', properties: ['color', 'border-top-color'] },
                { name: 'email', selector: 'input[type=email]', properties: ['color', 'border-top-color'] },
                { name: 'checkbox', selector: 'input[type=checkbox]', properties: ['color'] },
                { name: 'textarea', selector: 'textarea', properties: ['color', 'border-top-color'] },
                { name: 'select', selector: 'select[disabled]', properties: ['color', 'border-top-color'] },
                { name: 'in-group', selector: '.in-group', properties: ['color'] },
                { name: 'in-button', selector: '.in-button', properties: ['color'] }
            ]
        }));

    it('placeholder', () =>
        expectSimulationToMatch({
            html: scope('', '<input placeholder="x" />'),
            probes: [{ name: 'placeholder', selector: 'input', pseudo: '::placeholder', properties: ['color'] }]
        }));

    it('mark', () =>
        expectSimulationToMatch({
            html: scope('', '<p><mark>x</mark></p>'),
            probes: [{ name: 'mark', selector: 'mark', properties: ['color', 'background-color'] }]
        }));

    // The text color of a mark reaches its content, the ground does not: an inline background there is the page's.
    // A mark inside a mark is one again.
    it('mark-content', () =>
        expectSimulationToMatch({
            html: scope('', '<p><mark>Mark <span style="background: #c00">inside</span> <mark class="nested" style="background: #c00">nested</mark></mark></p>'),
            probes: [
                { name: 'span', selector: 'mark span', properties: ['color', 'background-color'] },
                { name: 'nested', selector: 'mark.nested', properties: ['color', 'background-color'] }
            ]
        }));

    // The generated content of a mark gets the page's ground as well, Canvas and not Mark.
    it('mark-generated-content', () =>
        expectSimulationToMatch({
            html: scope('mark::before { content: "b"; background: #c00 }', '<p><mark>Mark</mark></p>'),
            probes: [{ name: 'mark::before', selector: 'mark', pseudo: '::before', properties: ['color', 'background-color'] }]
        }));

    // Any outline of the element with visible focus becomes Highlight, not only a transparent one; not the outline inside
    // it, nor the one of its generated content.
    it('focus-visible-outline', () =>
        expectSimulationToMatch({
            html: scope(
                `.x:focus-visible, .x:focus-visible .k { outline: 2px solid red }
                .x:focus-visible::before { content: "b"; outline: 2px solid transparent }
                .x:focus-visible::after { content: "a"; outline: 2px solid red }`,
                '<button class="x">Button <span class="k">inside</span></button>'
            ),
            probes: [
                { name: 'x', selector: '.x', properties: ['outline-color'] },
                { name: 'k', selector: '.k', properties: ['outline-color'] },
                { name: 'x::before', selector: '.x', pseudo: '::before', properties: ['outline-color'] },
                { name: 'x::after', selector: '.x', pseudo: '::after', properties: ['outline-color'] }
            ],
            focus: '.x'
        }));

    // The canvas forces Focus visible with the stand-in class of the pseudo engine, not with Tab. The forced colors
    // sheet matches the class as it matches :focus-visible, whether the state is forced before forced colors are on or
    // after, and after a switch of the palette, which writes the sheet anew; the author's rules match it through the
    // pseudo engine.
    describe('focus-visible-stand-in', () => {
        const fixture: Fixture = {
            html: scope(
                `.f { outline: 2px solid red }
                .f:focus-visible { box-shadow: 0 0 0 3px #005fe360 }
                .f:focus-visible .k { outline: 2px solid red }
                .f:focus-visible::after { content: "a"; outline: 2px solid red }`,
                '<button class="f">Button <span class="k">inside</span></button>'
            ),
            probes: [
                { name: 'f', selector: '.f', properties: ['outline-color', 'box-shadow'] },
                { name: 'k', selector: '.k', properties: ['outline-color'] },
                { name: 'f::after', selector: '.f', pseudo: '::after', properties: ['outline-color'] }
            ],
            focus: '.f'
        };
        const other: Scheme = scheme === 'light' ? 'dark' : 'light';

        it('with Tab', () => expectSimulationToMatch(fixture));

        it.each<[NonNullable<SimulatedOptions['standIn']>, string, Scheme | undefined]>([
            ['before', 'on in this palette', undefined],
            ['after', 'on in this palette', undefined],
            ['before', 'switched to this palette', other],
            ['after', 'switched to this palette', other]
        ])('forced %s forced colors, %s', async (standIn, _how, from) => {
            expect(await renderSimulated(browser, fixture, scheme, { standIn, from })).toEqual(await renderReal(browser, fixture, scheme));
        });
    });

    // The net of the forced colors sheet for inline styles, `!important`, beats them.
    it('inline-style', () =>
        expectSimulationToMatch({
            html: scope('', '<div class="inline" style="background: red; color: blue; border: 1px solid green">Inline</div>'),
            probes: [{ name: 'inline', selector: '.inline', properties: ['background-color', 'color', 'border-top-color'] }]
        }));

    // Only an inline declaration of a forced property is forced, not one whose name merely contains it: a custom
    // property, `background-size`, `border-radius`, a transition of `color`. The colors from the rules stay.
    it('inline-style-names', () =>
        expectSimulationToMatch({
            html: scope(
                `.sel { color: HighlightText; background: Highlight } .chip { border: 2px solid Highlight } .ol { outline: 2px solid Highlight }`,
                `<span class="sel custom" style="--sel-color: red; --sel-background: red; --sel-border: 1px solid red">a</span>
                <span class="sel size" style="background-size: 2px; background-image: none">b</span>
                <span class="sel transition" style="transition: color 0s, background-color 0s, border-color 0s">c</span>
                <span class="chip radius" style="border-radius: 2px; border-width: 3px; border-top-style: dashed">d</span>
                <span class="ol offset" style="outline-offset: 2px; outline-width: 3px">e</span>`
            ),
            probes: [
                { name: 'custom', selector: '.custom', properties: ['color', 'background-color'] },
                { name: 'size', selector: '.size', properties: ['color', 'background-color'] },
                { name: 'transition', selector: '.transition', properties: ['color', 'background-color'] },
                { name: 'radius', selector: '.radius', properties: ['border-top-color'] },
                { name: 'offset', selector: '.offset', properties: ['outline-color'] }
            ]
        }));

    // An inline declaration as an author writes it by hand: without spaces, in capitals, on a line of its own.
    it('inline-style-forms', () =>
        expectSimulationToMatch({
            html: scope(
                '',
                `<span class="tight" style="color:red;BACKGROUND:blue;Border-Top:1px solid red">a</span>
                <span class="lines" style="
color: red;
	background-color: blue;
    outline: 1px solid red">b</span>
                <span class="rest" style="box-shadow:0 0 2px red; text-shadow: 1px 1px red; background-image: linear-gradient(red, blue)">c</span>`
            ),
            probes: [
                { name: 'tight', selector: '.tight', properties: ['color', 'background-color', 'border-top-color'] },
                { name: 'lines', selector: '.lines', properties: ['color', 'background-color', 'outline-color'] },
                { name: 'rest', selector: '.rest', properties: ['box-shadow', 'text-shadow', 'background-image'] }
            ]
        }));

    it('toggle', () =>
        expectSimulationToMatch({
            html: scope(
                `.track { position: relative; display: inline-block; width: 40px; height: 20px; border-radius: 10px; background: #8a8a8a }
                .track.on { background: #005fe3 }
                .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0004 }
                .track.on::after { left: 22px }`,
                '<span class="track off"></span><span class="track on"></span>'
            ),
            probes: [
                { name: 'off', selector: '.track.off', properties: ['background-color'] },
                { name: 'off::after', selector: '.track.off', pseudo: '::after', properties: ['background-color', 'box-shadow'] },
                { name: 'on', selector: '.track.on', properties: ['background-color'] },
                { name: 'on::after', selector: '.track.on', pseudo: '::after', properties: ['background-color', 'box-shadow'] }
            ]
        }));

    it('checkbox-mask', () =>
        expectSimulationToMatch({
            html: scope(
                `.box { position: relative; display: inline-block; width: 16px; height: 16px }
                .box::before { content: ''; position: absolute; inset: 0; border-radius: 3px; background: #005fe3 }
                .box::after { content: ''; position: absolute; inset: 0; background: #fff; mask-image: ${CHECK} }`,
                '<span class="box"></span>'
            ),
            probes: [
                { name: 'box::before', selector: '.box', pseudo: '::before', properties: ['background-color'] },
                { name: 'box::after', selector: '.box', pseudo: '::after', properties: ['background-color'] }
            ]
        }));

    // Chromium turns the dot into Canvas, as white as the author's dot in the light palette and black in the dark one.
    it('radio-dark', () =>
        expectSimulationToMatch({
            html: scope(
                `.dot { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 1px solid #8a8a8a; border-radius: 50% }
                .dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: transparent }
                .dot.on::after { background: #fff }`,
                '<span class="dot off"></span><span class="dot on"></span>'
            ),
            probes: [
                { name: 'off::after', selector: '.dot.off', pseudo: '::after', properties: ['background-color'] },
                { name: 'on::after', selector: '.dot.on', pseudo: '::after', properties: ['background-color'] }
            ]
        }));

    it('focus-fallback', () =>
        expectSimulationToMatch({
            html: scope(
                `.f:focus-visible { box-shadow: 0 0 0 3px #005fe360 }
                .f:focus-visible + .g { box-shadow: 0 0 0 3px #005fe360 }
                @media (forced-colors: active) {
                    .f:focus-visible { outline: 3px solid transparent }
                    .f:focus-visible + .g { outline: 3px solid transparent }
                }`,
                '<input class="f" /><span class="g">Next</span>'
            ),
            probes: [
                { name: 'f', selector: '.f', properties: ['outline-color', 'box-shadow'] },
                { name: 'g', selector: '.g', properties: ['outline-color', 'box-shadow'] }
            ],
            focus: '.f'
        }));

    // An outline in the color of the element is forced too, to Highlight on the element with visible focus.
    it('focus-outline-currentcolor', () =>
        expectSimulationToMatch({
            html: scope('.f:focus-visible { outline: 2px solid currentcolor }', '<button class="f">Button</button>'),
            probes: [{ name: 'f', selector: '.f', properties: ['outline-color'] }],
            focus: '.f'
        }));

    // An element without a color of its own inherits the system color its parent keeps.
    it('inherited-kept-color', () =>
        expectSimulationToMatch({
            html: scope('.k { color: GrayText }', '<div class="k">Kept <span class="child">child</span></div>'),
            probes: [{ name: 'child', selector: '.k .child', properties: ['color', 'border-top-color'] }]
        }));

    // A color of its own is forced to the foreground of the context, not to the system color its parent keeps.
    it('author-color-under-kept', () =>
        expectSimulationToMatch({
            html: scope('.k { color: GrayText } .k .c { color: red }', '<div class="k">Kept <span class="c">own</span></div>'),
            probes: [{ name: 'c', selector: '.c', properties: ['color'] }]
        }));

    it('exempt-with-auto', () =>
        expectSimulationToMatch({
            html: scope(
                `.opt { forced-color-adjust: none; background: Highlight; color: HighlightText }
                .opt .slot { forced-color-adjust: auto; background: #fff; color: #333 }`,
                '<div class="opt">Option <span class="slot">slot</span></div>'
            ),
            probes: [
                { name: 'opt', selector: '.opt', properties: ['color', 'background-color'] },
                { name: 'slot', selector: '.slot', properties: ['color', 'background-color'] }
            ]
        }));

    it('transparent-surface', () =>
        expectSimulationToMatch({
            html: scope(
                `.o { background: transparent; border: 1px solid #005fe3; color: #005fe3 }
                .pill { background: #c00; color: #fff; border-radius: 999px; padding: 2px 8px }`,
                '<button class="o">Outline</button><span class="pill"><span class="label">Pill</span></span>'
            ),
            probes: [
                { name: 'button', selector: '.o', properties: ['background-color', 'color', 'border-top-color'] },
                { name: 'span', selector: '.pill .label', properties: ['background-color'] }
            ]
        }));

    it('disabled-author', () =>
        expectSimulationToMatch({
            html: scope('button.d:disabled { color: #aaa; border-color: #aaa }', '<button class="d" disabled>Disabled</button>'),
            probes: [{ name: 'button', selector: 'button.d', properties: ['color', 'border-top-color'] }]
        }));

    it('host-background', () =>
        expectSimulationToMatch({
            html: scope('.host { display: block; background: #c00; color: #fff }', 'Label'),
            probes: [{ name: 'root', selector: '[data-prism-sim]', properties: ['background-color'] }]
        }));

    // A theme written for the document root and for a class at once: the element with the class is forced whole.
    it('mixed-root-list', () =>
        expectSimulationToMatch({
            html: scope(
                ':root, .theme-dark { color: #eee; background-color: #111; border-color: red } .box { border-style: solid; border-width: 2px }',
                '<div class="theme-dark box">Themed</div>'
            ),
            probes: [{ name: 'themed', selector: '.theme-dark', properties: ['color', 'background-color', 'border-top-color'] }]
        }));

    // The same with the theme on the scope root itself, where the `colorScheme` config puts its attribute.
    it('mixed-root-list-on-scope-root', () =>
        expectSimulationToMatch({
            html: `<div class="host" data-prism-sim data-theme="dark"><style>:root, [data-theme=dark] { color: #eee; background-color: #111; border-color: red } .host { border-style: solid; border-width: 2px }</style>Label</div>`,
            probes: [{ name: 'root', selector: '[data-prism-sim]', properties: ['color', 'background-color', 'border-top-color'] }]
        }));

    it('gradient-var', () =>
        expectSimulationToMatch({
            html: scope(':root { --ai: linear-gradient(90deg, #a0f, #0af) } .b { background: var(--ai) }', '<div class="b">Gradient</div>'),
            probes: [{ name: 'b', selector: '.b', properties: ['background-image', 'background-color'] }]
        }));

    // A background list in a custom property loses its gradients layer by layer, and the color of its last layer
    // becomes Canvas with its alpha: on each element the one of the declaration that wins there. Read as a
    // background-color, the list is invalid, in the real mode too.
    it('background-list-var', () =>
        expectSimulationToMatch({
            html: scope(
                `.r { position: relative; display: inline-block; width: 40px; height: 10px; --ring: linear-gradient(90deg, #a0f, #0af), #8529d5 }
                .r.translucent { --ring: linear-gradient(90deg, #a0f, #0af), rgb(133 41 213 / 0.4) }
                .r::before { content: ''; position: absolute; inset: 0; background: var(--ring) }
                .r.as-color::before { background: none; background-color: var(--ring) }`,
                '<span class="r opaque"></span><span class="r translucent"></span><span class="r as-color"></span>'
            ),
            probes: [
                { name: 'opaque::before', selector: '.r.opaque', pseudo: '::before', properties: ['background-color', 'background-image'] },
                { name: 'translucent::before', selector: '.r.translucent', pseudo: '::before', properties: ['background-color', 'background-image'] },
                { name: 'as-color::before', selector: '.r.as-color', pseudo: '::before', properties: ['background-color', 'background-image'] }
            ]
        }));

    it('token-var', () =>
        expectSimulationToMatch({
            html: scope(
                '@media (forced-colors: active) { :root { --tok: ButtonText } } .t { background-color: var(--tok); color: var(--tok) }',
                '<div class="t">Token</div>'
            ),
            probes: [{ name: 't', selector: '.t', properties: ['background-color', 'color'] }]
        }));

    // A system color that stays in a color shorthand among other values, from a token or written out: the color is
    // the one part of a border, an outline or a decoration that can hold one. Every other color is forced.
    it('shorthand-var-color', () =>
        expectSimulationToMatch({
            html: scope(
                `@media (forced-colors: active) { :root { --accent: Highlight; --muted: GrayText; --w: 3px } }
                :root { --red: #c00 }
                .card { border: 2px solid var(--accent); outline: 2px solid var(--muted); text-decoration: underline var(--accent); text-emphasis: dot var(--accent); column-rule: 1px solid var(--accent); column-count: 2 }
                .written { border: var(--w) solid Highlight; outline: var(--w) solid GrayText; text-decoration: underline var(--w) Highlight }
                .red { border: 2px solid var(--red); outline: 2px solid var(--red) }
                .sides { border-top: 2px solid var(--accent); border-inline-start: 2px solid var(--muted); border-bottom: 2px solid var(--red) }
                .two { border: var(--w) solid var(--accent) }
                .colors { border-style: solid; border-color: var(--accent) var(--red) var(--muted) }
                .f:focus-visible { outline: 2px solid var(--muted) }`,
                `<div class="card">Card</div><div class="written">Written</div><div class="red">Red</div><div class="sides">Sides</div>
                <div class="two">Two</div><div class="colors">Colors</div><button class="f">Focus</button>`
            ),
            probes: [
                {
                    name: 'card',
                    selector: '.card',
                    properties: ['border-top-color', 'outline-color', 'text-decoration-color', 'text-emphasis-color', 'column-rule-color']
                },
                { name: 'written', selector: '.written', properties: ['border-top-color', 'outline-color', 'text-decoration-color'] },
                { name: 'red', selector: '.red', properties: ['border-top-color', 'outline-color'] },
                { name: 'sides', selector: '.sides', properties: ['border-top-color', 'border-left-color', 'border-bottom-color'] },
                { name: 'two', selector: '.two', properties: ['border-top-color'] },
                { name: 'colors', selector: '.colors', properties: ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'] },
                { name: 'focused', selector: '.f', properties: ['outline-color'] }
            ],
            focus: '.f'
        }));

    // A background with a var() among other values, or in a function, becomes Canvas with the alpha of its color, and
    // keeps a system color that a token holds. One that holds an image leaves the background without a color, and
    // transparent. Of several var()s the simulation cannot tell which is the color, and takes Canvas.
    it('background-var-among-values', () =>
        expectSimulationToMatch({
            html: scope(
                `@media (forced-colors: active) { :root { --tok: Highlight; --hl: Highlight } }
                .b { display: inline-block; width: 20px; height: 10px }
                .chip { --chip-bg: #c00; background: var(--chip-bg) no-repeat }
                .on { --on: #005fe3; background: var(--on) center / cover }
                .kept { background: var(--tok) no-repeat }
                .kept-fallback { background: var(--tok, red) }
                .two-vars { --pos: center; --c: #0c0; background: var(--c) var(--pos) no-repeat }
                .written { --img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"); background: var(--img) rgb(0 200 0 / 0.5) }
                .last-layer { --c: rgb(0 200 0 / 0.3); background: linear-gradient(red, blue), var(--c) }
                .mix { --p: #6366f1; background: color-mix(in srgb, var(--p) 6%, transparent) }
                .mix-system { background: color-mix(in srgb, var(--hl) 50%, transparent) }
                .fallback { background: var(--undefined, rgb(200 0 0 / 0.4)) }
                .ring { --ring: linear-gradient(90deg, #a0f, #0af), rgb(133 41 213 / 0.4); background: var(--ring) no-repeat }
                .translucent { --t: rgb(200 0 0 / 0.4); background: var(--t) no-repeat }
                .image { --img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"); background: var(--img) no-repeat center }
                .named { --img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"); background: var(--img) no-repeat rebeccapurple }
                .no-color { background: linear-gradient(var(--undefined, red), blue) no-repeat }`,
                BACKGROUNDS.map((name) => `<span class="b ${name}"></span>`).join('')
            ),
            probes: BACKGROUNDS.map((name) => ({
                name,
                selector: `.${name}`,
                properties: ['background-color']
            }))
        }));

    // The twin of the rule names the twin of the @keyframes, whose colors are forced.
    it('keyframes', () =>
        expectSimulationToMatch({
            html: scope('@keyframes p { from { background-color: #c00 } to { background-color: #0c0 } } .k { animation: p 1s paused }', '<div class="k">Animated</div>'),
            probes: [{ name: 'k', selector: '.k', properties: ['background-color'] }]
        }));

    it('author-layers', () =>
        expectSimulationToMatch({
            html: scope(
                '@layer base { button.l { background: transparent } } @layer base { .x { color: Highlight } } @layer theme { .x { color: red } }',
                '<button class="l">Layered</button><span class="x">Text</span>'
            ),
            probes: [
                { name: 'button', selector: 'button.l', properties: ['background-color'] },
                { name: 'x', selector: '.x', properties: ['color'] }
            ]
        }));
});
