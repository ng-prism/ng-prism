import type { Browser } from 'playwright';
import { type Fixture, launchChromium, normalizeColor, renderReal, renderSimulated, type Scheme } from './__test-utils__/chromium.js';

/** `CanvasText` of Chromium's forced palettes. */
const CANVAS_TEXT: Record<Scheme, string> = { light: 'rgba(0, 0, 0, 1)', dark: 'rgba(255, 255, 255, 1)' };

/** A scope root, the `.host` of a component, that holds `css` and `body`. */
function scope(css: string, body: string): string {
    return `<div class="host" data-prism-sim><style>${css}</style>${body}</div>`;
}

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
 * the simulation, and the simulation has to compute what Chromium computes.
 * `it.failing` marks a divergence the simulation still has: it fails once the
 * simulation matches, and then becomes an `it`.
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

    // The net of the forced colors sheet for inline styles, `!important`, beats them.
    it('inline-style', () =>
        expectSimulationToMatch({
            html: scope('', '<div class="inline" style="background: red; color: blue; border: 1px solid green">Inline</div>'),
            probes: [{ name: 'inline', selector: '.inline', properties: ['background-color', 'color', 'border-top-color'] }]
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

    it('gradient-var', () =>
        expectSimulationToMatch({
            html: scope(':root { --ai: linear-gradient(90deg, #a0f, #0af) } .b { background: var(--ai) }', '<div class="b">Gradient</div>'),
            probes: [{ name: 'b', selector: '.b', properties: ['background-image', 'background-color'] }]
        }));

    it('token-var', () =>
        expectSimulationToMatch({
            html: scope(
                '@media (forced-colors: active) { :root { --tok: ButtonText } } .t { background-color: var(--tok); color: var(--tok) }',
                '<div class="t">Token</div>'
            ),
            probes: [{ name: 't', selector: '.t', properties: ['background-color', 'color'] }]
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
