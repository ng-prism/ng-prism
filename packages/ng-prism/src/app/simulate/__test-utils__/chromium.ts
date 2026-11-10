import { join } from 'node:path';
import { build, type Plugin } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright';
import type { PrismSim } from './chromium-entry.js';

/** The palette: Chromium's forced colors follow the emulated `prefers-color-scheme`. */
export type Scheme = 'light' | 'dark';

/** An element, or one of its pseudo-elements, and the properties read from its computed style. */
export interface Probe {
    /** The key of its values in {@link Computed}. */
    name: string;
    selector: string;
    pseudo?: '::before' | '::after' | '::placeholder';
    properties: readonly string[];
}

export interface Fixture {
    /** Markup with exactly one `[data-prism-sim]` scope root; styles in a <style> inside. */
    html: string;
    probes: readonly Probe[];
    /** Reached with Tab before reading, for focus cases. */
    focus?: string;
    /** Hovered with page.hover before reading. */
    hover?: string;
}

/** How {@link renderSimulated} gets to the state it reads, as the canvas would. */
export interface SimulatedOptions {
    /**
     * Forces the fixture's `focus` and `hover` as the canvas forces the states Focus visible and
     * Hover: with the stand-in classes of the pseudo engine (`PseudoStyleSheets`), and not with Tab
     * and the pointer. `before` forced colors are turned on, or `after`.
     */
    standIn?: 'before' | 'after';
    /** The palette forced colors are turned on in first, before they switch to the one of the render. */
    from?: Scheme;
}

/** Per probe, the computed value of each of its properties, colors normalized with {@link normalizeColor}. */
export type Computed = Record<string, Record<string, string>>;

/** Tab presses after which a focus target counts as unreachable. */
const MAX_TABS = 20;

export function launchChromium(): Promise<Browser> {
    return chromium.launch();
}

/** `fixture` in Chromium's own forced colors mode, in the `scheme` palette. */
export function renderReal(browser: Browser, fixture: Fixture, scheme: Scheme): Promise<Computed> {
    return render(browser, fixture, true, async (page) => {
        await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme });
        await page.setContent(`<!doctype html>${fixture.html}`);
    });
}

/**
 * `fixture` with ng-prism's simulation of forced colors, as the canvas applies
 * it: outside the real mode, the scope root in `scheme`, the media engine
 * emulating `forced-colors: active` and the forced colors sheet adopted, both
 * in the palette of `scheme`; `options` say how it gets there.
 */
export function renderSimulated(browser: Browser, fixture: Fixture, scheme: Scheme, options: SimulatedOptions = {}): Promise<Computed> {
    return render(browser, fixture, !options.standIn, async (page) => {
        await page.emulateMedia({ forcedColors: 'none', colorScheme: scheme });
        await page.setContent(`<!doctype html>${fixture.html}`);
        await page.addScriptTag({ content: await simulationBundle() });
        await page.evaluate(simulate, {
            scheme,
            from: options.from ?? null,
            standIn: options.standIn ?? null,
            focus: fixture.focus ?? null,
            hover: fixture.hover ?? null
        });
    });
}

/** A blank page with the simulation's bundle on `window.__prismSim`, for a spec that calls a function of it on what Chromium makes of a stylesheet. */
export async function pageWithSimulation(browser: Browser): Promise<Page> {
    const page = await browser.newPage();

    await page.setContent('<!doctype html><body></body>');
    await page.addScriptTag({ content: await simulationBundle() });
    return page;
}

/**
 * Every `rgb()`, `rgba()` and `color(srgb …)` in `value` as `rgba(r, g, b, a)`:
 * channels as integers 0–255, alpha rounded to two decimals. A color whose
 * alpha rounds to 0 shows nothing, whatever its channels, and becomes
 * `rgba(0, 0, 0, 0)`: Chromium's real mode turns an author's transparent
 * surface into Canvas with alpha 0, `rgba(255, 255, 255, 0)` in the light
 * palette, which looks the same as `transparent`. Anything else unchanged, so
 * a shadow or a gradient keeps the rest of its value.
 *
 * Chromium serializes a color by how it was written, not by what it is: a
 * relative color (`rgb(from …)`) comes out as `color(srgb 0 0 0 / 0.501961)`,
 * the same color written plain as `rgba(0, 0, 0, 0.5)`, and the real mode's
 * own alphas have three decimals (`0.267`). An animation between two relative
 * colors interpolates in Oklab and comes out as `oklab(…)`, where the real
 * mode's legacy colors come out as `rgb()`.
 */
export function normalizeColor(value: string): string {
    return value.replace(/\b(rgba?|color|oklab)\(([^()]*)\)/gi, (color, name: string, args: string) => {
        const parts = args.trim().split(/[\s,/]+/);
        const space = name.toLowerCase();
        const srgb = space === 'color';

        if (srgb && parts.shift() !== 'srgb') return color;
        if (parts.length < 3 || parts.length > 4) return color;

        const [r, g, b, a = '1'] = parts;
        const channels =
            space === 'oklab'
                ? oklabToSrgb(numberOf(r, 1, 1), numberOf(g, 1, 0.4), numberOf(b, 1, 0.4)).map((channel) => Math.round(channel * 255))
                : [r, g, b].map((channel) => Math.round(numberOf(channel, srgb ? 255 : 1, 255)));
        const alpha = numberOf(a, 1, 1);

        if ([...channels, alpha].some(Number.isNaN)) return color;

        const rounded = Math.round(alpha * 100) / 100;

        return rounded === 0 ? 'rgba(0, 0, 0, 0)' : `rgba(${channels.join(', ')}, ${rounded})`;
    });
}

/** A number, or a percentage of `full`; `NaN` for anything else (`none`). */
function numberOf(token: string, scale: number, full: number): number {
    return token.endsWith('%') ? (Number(token.slice(0, -1)) / 100) * full : Number(token) * scale;
}

/** An Oklab color as sRGB channels from 0 to 1, clipped to the gamut (CSS Color 4, "Converting Oklab colors to sRGB"). */
function oklabToSrgb(lightness: number, a: number, b: number): number[] {
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];

    return linear.map((channel) => {
        const gamma = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

        return Math.min(1, Math.max(0, gamma));
    });
}

/** Renders `fixture` on a fresh page that `prepare` sets up, and reads its probes; `drive`: reaching `focus` with Tab and `hover` with the pointer first. */
async function render(browser: Browser, fixture: Fixture, drive: boolean, prepare: (page: Page) => Promise<void>): Promise<Computed> {
    const page = await browser.newPage();

    try {
        await prepare(page);
        if (drive && fixture.focus) await tabTo(page, fixture.focus);
        if (drive && fixture.hover) await page.hover(fixture.hover);

        const computed = await page.evaluate(readProbes, fixture.probes);

        return Object.fromEntries(
            Object.entries(computed).map(([name, values]) => [
                name,
                Object.fromEntries(Object.entries(values).map(([property, value]) => [property, normalizeColor(value)]))
            ])
        );
    } finally {
        await page.close();
    }
}

/** Presses Tab until `selector` has the focus, so that it matches `:focus-visible` as it does for a keyboard user. */
async function tabTo(page: Page, selector: string): Promise<void> {
    const target = page.locator(selector);

    for (let presses = 0; presses < MAX_TABS; presses++) {
        await page.keyboard.press('Tab');
        if (await target.evaluate((el) => el === document.activeElement)) return;
    }
    throw new Error(`Tab does not reach ${selector}.`);
}

/*
 * The two functions below run in the page: Playwright sends their source, so
 * they must not use anything SWC compiles to a helper (object spread, for one).
 */

function readProbes(probes: readonly Probe[]): Computed {
    const computed: Computed = {};

    for (const probe of probes) {
        const el = document.querySelector(probe.selector);

        if (!el) throw new Error(`No element matches ${probe.selector}.`);

        const style = getComputedStyle(el, probe.pseudo);
        const values: Record<string, string> = {};

        for (const property of probe.properties) values[property] = style.getPropertyValue(property);
        computed[probe.name] = values;
    }
    return computed;
}

/** What {@link simulate} is told, a plain object that crosses into the page. */
interface SimulateArgs {
    scheme: Scheme;
    from: Scheme | null;
    standIn: 'before' | 'after' | null;
    focus: string | null;
    hover: string | null;
}

/**
 * Makes the fixture's root a scope root and turns the forced colors simulation on, in the palette
 * of `from` first if there is one and then in the one of `scheme`. With `standIn`, forces `focus`
 * and `hover` with the stand-in classes, as the canvas does, before or after.
 */
function simulate({ scheme, from, standIn, focus, hover }: SimulateArgs): void {
    const { SimulationStyles, applyScopeRoot, PseudoStyleSheets, pseudoStateClass } = (window as unknown as { __prismSim: PrismSim }).__prismSim;
    const root = document.querySelector<HTMLElement>('[data-prism-sim]');

    if (!root) throw new Error('The fixture has no [data-prism-sim] scope root.');

    const styles = new SimulationStyles(document);
    const turnOn = (palette: Scheme): void => {
        applyScopeRoot(root, { colorScheme: palette, filter: null, themeClass: null, themeAttributes: {} });
        styles.apply({ 'forced-colors': 'active' }, palette);
    };
    const forceStates = (): void => {
        if (focus) document.querySelectorAll(focus).forEach((el) => el.classList.add(pseudoStateClass('focus-visible')));
        if (hover) document.querySelectorAll(hover).forEach((el) => el.classList.add(pseudoStateClass('hover')));
        new PseudoStyleSheets(document).acquire();
    };

    if (standIn === 'before') forceStates();
    turnOn(from ?? scheme);
    if (standIn === 'after') forceStates();
    if (from) turnOn(scheme);
}

let bundle: Promise<string> | undefined;

/** The simulation as one script for the page, built once per test process. */
function simulationBundle(): Promise<string> {
    bundle ??= build({
        entryPoints: [join(__dirname, 'chromium-entry.ts')],
        bundle: true,
        format: 'iife',
        write: false,
        plugins: [angularCoreShim]
    }).then(({ outputFiles }) => outputFiles[0].text);
    return bundle;
}

/** Points `@angular/core` at the shim: the simulation takes only `isDevMode` from it, and the page has no Angular. */
const angularCoreShim: Plugin = {
    name: 'angular-core-shim',
    setup(esbuild) {
        esbuild.onResolve({ filter: /^@angular\/core$/ }, () => ({ path: join(__dirname, 'angular-core-shim.ts') }));
    }
};
