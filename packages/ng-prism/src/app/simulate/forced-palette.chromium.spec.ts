import type { Browser } from 'playwright';
import type { PrismSim } from './__test-utils__/chromium-entry.js';
import { type Fixture, launchChromium, normalizeColor, pageWithSimulation, renderReal, type Scheme } from './__test-utils__/chromium.js';
import { KEPT_SYSTEM_COLORS, rgbChannels, SYSTEM_COLORS, type SystemColor } from './forced-palette.js';

const SCHEMES: Scheme[] = ['light', 'dark'];

let browser: Browser;
/** Per palette, what the simulation puts in place of each system color in this Chromium, written as `normalizeColor` writes it. */
const simulated: Partial<Record<Scheme, Record<SystemColor, string>>> = {};

beforeAll(async () => {
    browser = await launchChromium();

    const page = await pageWithSimulation(browser);

    for (const scheme of SCHEMES) {
        const values = await page.evaluate(
            ({ palette, colors }) => {
                const { forcedColor, readPlatformColors } = (window as unknown as { __prismSim: PrismSim }).__prismSim;

                // A dark page, as the styleguide's dark theme makes it: the platform's colors are those of a page without a color scheme all the same.
                document.documentElement.style.colorScheme = 'dark';
                readPlatformColors(document);
                return colors.map((color) => forcedColor(palette, color));
            },
            { palette: scheme, colors: [...SYSTEM_COLORS] }
        );

        simulated[scheme] = Object.fromEntries(
            SYSTEM_COLORS.map((color, i) => [color, normalizeColor(values[i].startsWith('#') ? `rgb(${rgbChannels(values[i])})` : values[i])])
        ) as Record<SystemColor, string>;
    }
    await page.close();
});

afterAll(async () => {
    await browser?.close();
});

/** What the simulation puts in place of `color` in the `scheme` palette. */
function inSimulation(scheme: Scheme, color: SystemColor): string {
    return (simulated[scheme] as Record<SystemColor, string>)[color];
}

it.each(SCHEMES)('resolves every system color as Chromium does under forced colors, %s', async (scheme) => {
    // With `forced-color-adjust: none` a system color stands as the author wrote it, so its computed value is the palette's.
    const fixture: Fixture = {
        html: `<div data-prism-sim style="forced-color-adjust: none">${SYSTEM_COLORS.map((color) => `<span data-color="${color}" style="color: ${color}">x</span>`).join('')}</div>`,
        probes: SYSTEM_COLORS.map((color) => ({ name: color, selector: `[data-color="${color}"]`, properties: ['color'] }))
    };
    const computed = await renderReal(browser, fixture, scheme);

    expect(Object.fromEntries(SYSTEM_COLORS.map((color) => [color, computed[color].color]))).toEqual(
        Object.fromEntries(SYSTEM_COLORS.map((color) => [color, inSimulation(scheme, color)]))
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
        SYSTEM_COLORS.filter((color) => computed[`${role} ${color}`][property] === inSimulation(scheme, color));
    const asText = standing('text', 'color');
    const asSurface = standing('surface', 'background-color');

    // A forced color can equal its palette value in one role by chance (`AccentColorText` is white, as are Canvas in light and CanvasText in dark), so a color is kept only if it stands in both.
    expect(SYSTEM_COLORS.filter((color) => asText.includes(color) && asSurface.includes(color))).toEqual(SYSTEM_COLORS.filter((color) => KEPT_SYSTEM_COLORS.has(color)));
});
