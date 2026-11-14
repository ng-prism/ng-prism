#!/usr/bin/env node
// Screenshot one @Showcase variant, optionally in one of the component's `states`, or the API page of a showcased
// service or pipe, in a running ng-prism styleguide. Ships with the `showcase` skill of the ng-prism Claude Code
// plugin; ng-prism's own repo runs it too (skill prism-test-workspace).
//
//   node <skill dir>/scripts/screenshot.mjs --component ButtonComponent [--variant 1] [--state 0] [--shell]
//        [--url http://localhost:4400] [--out file.png] [--timeout 30000]
//   node <skill dir>/scripts/screenshot.mjs --service NotificationService [--url …] [--out …] [--timeout …]
//   node <skill dir>/scripts/screenshot.mjs --pipe TimeAgoPipe [--url …] [--out …] [--timeout …]
//
// --service, --pipe: a service or pipe has no canvas; its page is what @ng-prism/plugin-jsdoc renders from its JSDoc.
// The script opens `?service=<ClassName>&view=jsdoc` (`?pipe=…` for a pipe), waits for
// `[data-prism-service-rendered="<ClassName>"]` (`data-prism-pipe-rendered` for a pipe) and its code blocks, and
// screenshots that page at its full length, without the sidebar and header. Neither can be combined with the other,
// --component, --variant, --state or --shell. Services and pipes aren't listed in `__PRISM_MANIFEST__`, so an unknown
// class name only shows as the marker never appearing.
//
// --component looks the class up in `__PRISM_MANIFEST__`. A part (`@Showcase({ partOf })`) is listed only under its
// parent, in `components[].parts`, and has no page of its own: for its class name the script names the parent and the
// URL of the part's block on the parent's API tab, and exits 1 as for an unknown component.
//
// Run it from the project root. Playwright comes from that project (`playwright`, else `@playwright/test`),
// resolved from the current directory, never from where this file lives (a plugin cache has no node_modules).
//
// Default: capture mode (`capture=1`), element screenshot of `.demo-wrap` with `omitBackground`, so a
// transparent variant background (also the default when a variant declares no `bg`, unless the config sets
// `showcaseDefaults.bg`) keeps its alpha.
// --shell: the full window without capture mode, for the styleguide UI around the component.
// --state <index>: the 0-based index into the component's `states` (`@Showcase({ states })`), in source order.
// Without it no state is active. A state does not fit every variant: when the styleguide marks the cell with
// `data-prism-excluded`, the script prints the reason, takes no screenshot and exits 4.
//
// Exit codes: 0 saved · 1 styleguide unreachable, component (or a part, which has no page), variant or state unknown,
// the variant or the service or pipe page never rendered, or the screenshot failed · 2 invalid arguments · 3 Playwright
// or its Chromium missing · 4 the requested state does not fit the variant (the styleguide marked the cell as excluded).
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const INSTALL_HINT = 'npm i -D playwright && npx playwright install chromium';
const LINUX_DEPS_HINT = 'npx playwright install --with-deps chromium';

function exitWith(code, message) {
    console.error(message);
    process.exit(code);
}

function firstLine(error) {
    return String(error?.message ?? error).split('\n')[0];
}

let values;
try {
    ({ values } = parseArgs({
        options: {
            component: { type: 'string' },
            service: { type: 'string' },
            pipe: { type: 'string' },
            // No default here: --service and --pipe must be able to tell an explicit --variant from none.
            variant: { type: 'string' },
            state: { type: 'string' },
            url: { type: 'string', default: 'http://localhost:4400' },
            shell: { type: 'boolean', default: false },
            out: { type: 'string' },
            timeout: { type: 'string', default: '30000' }
        }
    }));
} catch (error) {
    exitWith(2, firstLine(error));
}

// A service and a pipe each have an API page instead of a canvas; `apiPage` says which one is asked for.
const API_PAGE_KINDS = {
    service: { example: 'NotificationService', noun: 'Service' },
    pipe: { example: 'TimeAgoPipe', noun: 'Pipe' }
};
const { component, shell } = values;
const apiPageKinds = Object.keys(API_PAGE_KINDS).filter((kind) => values[kind] !== undefined);
let apiPage;

if (apiPageKinds.length > 1) {
    exitWith(2, "--service and --pipe each take a whole API page and can't be combined with each other");
} else if (apiPageKinds.length === 1) {
    const [kind] = apiPageKinds;
    const className = values[kind];

    if (!className) exitWith(2, `Missing class name after --${kind}, e.g. --${kind} ${API_PAGE_KINDS[kind].example}`);
    const clashing = ['component', 'variant', 'state'].filter((name) => values[name] !== undefined).concat(shell ? ['shell'] : []);

    if (clashing.length > 0) exitWith(2, `--${kind} takes the whole API page and can't be combined with ${clashing.map((name) => `--${name}`).join(', ')}`);
    apiPage = { kind, className, noun: API_PAGE_KINDS[kind].noun };
} else if (!component) {
    exitWith(2, 'Missing --component <ClassName>, --service <ClassName> or --pipe <ClassName>, e.g. --component ButtonComponent');
}
const variantArg = values.variant ?? '0';
if (!/^\d+$/.test(variantArg)) exitWith(2, `--variant must be a 0-based index, got "${variantArg}"`);
const variant = Number(variantArg);
if (values.state !== undefined && !/^\d+$/.test(values.state)) exitWith(2, `--state must be a 0-based index, got "${values.state}"`);
const state = values.state === undefined ? undefined : Number(values.state);
const timeout = Number(values.timeout);
if (!Number.isInteger(timeout) || timeout <= 0) exitWith(2, `--timeout must be a positive number of milliseconds, got "${values.timeout}"`);

let base;
try {
    base = new URL(values.url);
} catch {
    base = undefined;
}
if (!base || !['http:', 'https:'].includes(base.protocol)) exitWith(2, `--url must be an http(s) URL such as http://localhost:4400, got "${values.url}"`);

const out =
    values.out ??
    join(
        tmpdir(),
        apiPage ? `prism-${apiPage.kind}-${apiPage.className}.png` : `prism-${component}-${variant}${state === undefined ? '' : `-s${state}`}${shell ? '-shell' : ''}.png`
    );
const target = new URL(base);
if (apiPage) {
    target.searchParams.set(apiPage.kind, apiPage.className);
    // The API page is the JSDoc plugin's view panel, whose id is `jsdoc`.
    target.searchParams.set('view', 'jsdoc');
} else {
    target.searchParams.set('component', component);
    target.searchParams.set('variant', String(variant));
    if (state !== undefined) target.searchParams.set('state', String(state));
    if (!shell) target.searchParams.set('capture', '1');
}
const url = target.href;
const marker = apiPage
    ? `[data-prism-${apiPage.kind}-rendered="${apiPage.className}"]`
    : `.demo-wrap[data-prism-rendered="${component}:${variant}${state === undefined ? '' : `:${state}`}"]`;

// An API page longer than this is cut there; Chromium can't capture much more in one image.
const MAX_API_PAGE_HEIGHT = 15000;

async function loadChromium() {
    const requireFromProject = createRequire(join(process.cwd(), 'package.json'));
    for (const name of ['playwright', '@playwright/test']) {
        let entry;
        try {
            entry = requireFromProject.resolve(name);
        } catch {
            continue;
        }
        // Playwright's entry is CommonJS: imported as ESM, its API sits on `default`.
        const playwright = await import(pathToFileURL(entry).href);
        return playwright.chromium ?? playwright.default?.chromium;
    }
    return undefined;
}

async function saveDiagnosis(page) {
    try {
        await page.screenshot({ path: out });
        console.error(`Saved the full window for diagnosis: ${out}`);
    } catch (error) {
        console.error(`Could not save the window for diagnosis either: ${firstLine(error)}`);
    }
}

// What has to be true for a service or pipe to get a page. The jsDocPlugin() requirement is the same for both.
const API_PAGE_HINTS = {
    service: 'A service is shown only with @Showcase on an @Injectable or @Service class',
    pipe: 'A pipe is shown only with @Showcase on a standalone @Pipe class'
};

async function captureApiPage(page) {
    try {
        await page.waitForSelector(marker, { state: 'attached', timeout });
    } catch {
        console.error(`${apiPage.noun} page never rendered: no ${marker} within ${timeout} ms at ${url}`);
        await saveDiagnosis(page);
        console.error(
            `Check the class name. ${API_PAGE_HINTS[apiPage.kind]} and with jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer. ` +
                `If ng-prism.config.ts sets urlState: false, the styleguide ignores the URL parameters this script selects the ${apiPage.kind} with.`
        );
        return 1;
    }

    // Highlight.js gives a code block the class `hljs` once it is highlighted; a page caught earlier shows plain code.
    // Best effort: a block that never gets highlighted is no reason to lose the screenshot.
    await page
        .waitForFunction((selector) => [...globalThis.document.querySelectorAll(`${selector} pre code`)].every((code) => code.classList.contains('hljs')), marker, {
            timeout: Math.min(timeout, 5000)
        })
        .catch(() => {});

    // The page is its own scroll container, as high as the window. Growing the window to the page's full height lets
    // one element screenshot hold all of it, the type cards at the bottom included.
    const size = await page.evaluate((selector) => {
        const element = globalThis.document.querySelector(selector);

        return { top: element.getBoundingClientRect().top, height: element.scrollHeight };
    }, marker);
    const viewport = page.viewportSize();
    const fullHeight = Math.ceil(size.top + size.height);

    if (fullHeight > MAX_API_PAGE_HEIGHT) console.error(`The page is ${fullHeight} px high; the screenshot is cut at ${MAX_API_PAGE_HEIGHT} px.`);
    await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, Math.min(fullHeight, MAX_API_PAGE_HEIGHT)) });
    await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));

    try {
        await page.locator(marker).screenshot({ path: out, timeout });
    } catch (error) {
        console.error(`Could not save the screenshot at ${url} (${firstLine(error).replace(/\.$/, '')}).`);
        return 1;
    }
    console.log(`${url}\n${out}`);
    return 0;
}

async function capture(page) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
        console.error(`No styleguide answers at ${base.href} (${firstLine(error)}). Start it first, e.g. ng run <lib>:prism, and pass --url when it runs elsewhere.`);
        return 1;
    }

    let manifest;
    try {
        await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined, undefined, { timeout });
        manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);
    } catch {
        console.error(`${base.href} answers, but window.__PRISM_MANIFEST__ never appeared within ${timeout} ms; is this an ng-prism styleguide?`);
        await saveDiagnosis(page);
        return 1;
    }

    if (apiPage) return captureApiPage(page);

    const entry = manifest.components.find((c) => c.className === component);
    // A part (`@Showcase({ partOf })`) is listed under its parent only: it has no page, no variant and no marker.
    const parent = entry ? undefined : manifest.components.find((c) => c.parts?.some((p) => p.className === component));
    if (parent) {
        console.error(
            `${component} is a part of ${parent.className} and has no page of its own. Screenshot ${parent.className}, or open ` +
                `?component=${parent.className}&view=jsdoc&part=${component} for the part's block on its API tab.`
        );
        return 1;
    }
    if (!entry) {
        const known = manifest.components.map((c) => `  ${c.className}`).join('\n');
        console.error(`No component "${component}" in this styleguide. Known components:\n${known}`);
        return 1;
    }
    if (variant >= entry.variants.length) {
        const variants = entry.variants.map((v) => `  ${v.index}  ${v.name}`).join('\n');
        console.error(`${component} has ${entry.variants.length} variant(s); --variant ${variant} does not exist:\n${variants}`);
        return 1;
    }
    if (state !== undefined && !entry.states?.[state]) {
        console.error(`${component} has no state ${state} (it declares ${entry.states?.length ?? 0}).`);
        return 1;
    }

    try {
        // Attached, not visible: the marker says the variant rendered. A component without a visible size
        // still renders; the element screenshot below reports that case.
        await page.waitForSelector(marker, { state: 'attached', timeout });
    } catch {
        console.error(`Variant never rendered: no ${marker} within ${timeout} ms at ${url}`);
        await saveDiagnosis(page);
        console.error('If ng-prism.config.ts sets urlState: false, the styleguide ignores the URL parameters this script selects the variant with.');
        return 1;
    }

    if (state !== undefined) {
        // The marker is set even when the state does not fit the variant; the attribute says why nothing is forced.
        const excluded = await page.getAttribute(marker, 'data-prism-excluded', { timeout });
        if (excluded !== null) {
            console.error(`${component} variant ${variant} × state ${state} is excluded: ${excluded}`);
            return 4;
        }
    }

    try {
        if (shell) {
            await page.screenshot({ path: out, timeout });
        } else {
            // The capture-mode contract: the page clears every background for `bg: 'transparent'`, but the
            // browser's own backdrop behind <html> only goes with omitBackground. An opaque `bg` is unaffected.
            await page.locator('.demo-wrap').screenshot({ path: out, omitBackground: true, timeout });
        }
    } catch (error) {
        const hint = shell ? '' : " A component without a visible size can't be captured on its own; --shell takes the whole window.";
        console.error(`Could not save the screenshot at ${url} (${firstLine(error).replace(/\.$/, '')}).${hint}`);
        return 1;
    }
    console.log(`${url}\n${out}`);
    return 0;
}

const chromium = await loadChromium();
if (!chromium) exitWith(3, `Playwright is not installed in ${process.cwd()}. Run this from the project root, or install it:\n  ${INSTALL_HINT}`);

let browser;
try {
    browser = await chromium.launch();
} catch (error) {
    exitWith(
        3,
        `Playwright could not start Chromium: ${firstLine(error)}\nInstall the browser with:\n  ${INSTALL_HINT}\nOn Linux, if system libraries are missing:\n  ${LINUX_DEPS_HINT}`
    );
}

const errors = [];
let exitCode = 1;

try {
    // A local styleguide may run on a self-signed certificate (ng serve --ssl).
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(error.message));
    exitCode = await capture(page);
} catch (error) {
    console.error(`Capture failed: ${firstLine(error)}`);
} finally {
    await browser.close().catch(() => {});
}

if (errors.length > 0) {
    console.error(`Browser console errors (${errors.length}):\n${errors.map((e) => `  ${e}`).join('\n')}`);
}

process.exit(exitCode);
