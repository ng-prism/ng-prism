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

/** Per probe, the computed value of each of its properties, colors normalized with {@link normalizeColor}. */
export type Computed = Record<string, Record<string, string>>;

/** Tab presses after which a focus target counts as unreachable. */
const MAX_TABS = 20;

export function launchChromium(): Promise<Browser> {
    return chromium.launch();
}

/** `fixture` in Chromium's own forced colors mode, in the `scheme` palette. */
export function renderReal(browser: Browser, fixture: Fixture, scheme: Scheme): Promise<Computed> {
    return render(browser, fixture, async (page) => {
        await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme });
        await page.setContent(`<!doctype html>${fixture.html}`);
    });
}

/**
 * `fixture` with ng-prism's simulation of forced colors, as the canvas applies
 * it: outside the real mode, the scope root in `scheme`, the media engine
 * emulating `forced-colors: active` and the forced colors sheet adopted.
 */
export function renderSimulated(browser: Browser, fixture: Fixture, scheme: Scheme): Promise<Computed> {
    return render(browser, fixture, async (page) => {
        await page.emulateMedia({ forcedColors: 'none', colorScheme: scheme });
        await page.setContent(`<!doctype html>${fixture.html}`);
        await page.addScriptTag({ content: await simulationBundle() });
        await page.evaluate(simulate, scheme);
    });
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
 * own alphas have three decimals (`0.267`).
 */
export function normalizeColor(value: string): string {
    return value.replace(/\b(rgba?|color)\(([^()]*)\)/gi, (color, name: string, args: string) => {
        const parts = args.trim().split(/[\s,/]+/);
        const srgb = name.toLowerCase() === 'color';

        if (srgb && parts.shift() !== 'srgb') return color;
        if (parts.length < 3 || parts.length > 4) return color;

        const [r, g, b, a = '1'] = parts;
        const channels = [r, g, b].map((channel) => Math.round(numberOf(channel, srgb ? 255 : 1, 255)));
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

async function render(browser: Browser, fixture: Fixture, prepare: (page: Page) => Promise<void>): Promise<Computed> {
    const page = await browser.newPage();

    try {
        await prepare(page);
        if (fixture.focus) await tabTo(page, fixture.focus);
        if (fixture.hover) await page.hover(fixture.hover);

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

/** Makes the fixture's root a scope root in `scheme` and turns the forced colors simulation on. */
function simulate(scheme: Scheme): void {
    const { SimulationStyles, applyScopeRoot } = (window as unknown as { __prismSim: PrismSim }).__prismSim;
    const root = document.querySelector<HTMLElement>('[data-prism-sim]');

    if (!root) throw new Error('The fixture has no [data-prism-sim] scope root.');

    applyScopeRoot(root, { colorScheme: scheme, filter: null, themeClass: null, themeAttributes: {} });
    new SimulationStyles(document).apply({ 'forced-colors': 'active' }, true);
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
