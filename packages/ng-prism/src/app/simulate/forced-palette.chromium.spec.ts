import type { Browser } from 'playwright';
import { type Fixture, launchChromium, normalizeColor, renderReal, type Scheme } from './__test-utils__/chromium.js';
import { FORCED_PALETTES, KEPT_SYSTEM_COLORS, rgbChannels, SYSTEM_COLORS, type SystemColor } from './forced-palette.js';

const SCHEMES: Scheme[] = ['light', 'dark'];

/** What `color` of the palette computes to in Chromium, written as `normalizeColor` writes it. */
function inChromium(scheme: Scheme, color: SystemColor): string {
    const value = FORCED_PALETTES[scheme][color];

    return normalizeColor(value.startsWith('#') ? `rgb(${rgbChannels(value)})` : value);
}

let browser: Browser;

beforeAll(async () => {
    browser = await launchChromium();
});

afterAll(async () => {
    await browser?.close();
});

it.each(SCHEMES)('resolves every system color as Chromium does under forced colors, %s', async (scheme) => {
    // With `forced-color-adjust: none` a system color stands as the author wrote it, so its computed value is the palette's.
    const fixture: Fixture = {
        html: `<div data-prism-sim style="forced-color-adjust: none">${SYSTEM_COLORS.map((color) => `<span data-color="${color}" style="color: ${color}">x</span>`).join('')}</div>`,
        probes: SYSTEM_COLORS.map((color) => ({ name: color, selector: `[data-color="${color}"]`, properties: ['color'] }))
    };
    const computed = await renderReal(browser, fixture, scheme);

    expect(Object.fromEntries(SYSTEM_COLORS.map((color) => [color, computed[color].color]))).toEqual(
        Object.fromEntries(SYSTEM_COLORS.map((color) => [color, inChromium(scheme, color)]))
    );
});

it.each(SCHEMES)('leaves standing exactly the kept system colors under forced-color-adjust: auto, %s', async (scheme) => {
    // Without the exemption Chromium forces what an author sets, a system color excepted.
    const fixture: Fixture = {
        html: `<div data-prism-sim>${SYSTEM_COLORS.map(
            (color) => `<span data-text="${color}" style="color: ${color}">x</span><span data-surface="${color}" style="background-color: ${color}">x</span>`
        ).join('')}</div>`,
        probes: SYSTEM_COLORS.flatMap((color) => [
            { name: `text ${color}`, selector: `[data-text="${color}"]`, properties: ['color'] },
            { name: `surface ${color}`, selector: `[data-surface="${color}"]`, properties: ['background-color'] }
        ])
    };
    const computed = await renderReal(browser, fixture, scheme);
    const standing = (role: 'text' | 'surface', property: 'color' | 'background-color'): SystemColor[] =>
        SYSTEM_COLORS.filter((color) => computed[`${role} ${color}`][property] === inChromium(scheme, color));
    const asText = standing('text', 'color');
    const asSurface = standing('surface', 'background-color');

    // A forced color can equal its palette value in one role by chance (`AccentColorText` is white, as are Canvas in light and CanvasText in dark), so a color is kept only if it stands in both.
    expect(SYSTEM_COLORS.filter((color) => asText.includes(color) && asSurface.includes(color))).toEqual(SYSTEM_COLORS.filter((color) => KEPT_SYSTEM_COLORS.has(color)));
});
