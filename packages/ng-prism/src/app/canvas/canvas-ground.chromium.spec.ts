import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright';
import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { CAPTURE_ATTRIBUTE, CAPTURE_STYLES } from '../services/prism-capture.service.js';
import { launchChromium, normalizeColor } from '../simulate/__test-utils__/chromium.js';
import { resolveThemeTokens } from '../theme/resolve-theme-tokens.js';
import { CANVAS_BG_STYLES } from './canvas-bg.styles.js';

/**
 * What the grounds paint in Chromium, with the cascade and `var()` that jsdom
 * does not have. The three surfaces that paint a `data-bg` are the Playground's
 * stage, an Overview cell's stage and a swatch of the tools menu: each gets its
 * component's stylesheet and then `CANVAS_BG_STYLES`, in the order of the app.
 */

type Theme = 'dark' | 'light';

/** The paint of one surface, colours as `normalizeColor` writes them. */
interface Styles {
    backgroundColor: string;
    backgroundImage: string;
}

/** What {@link renderGround} reads: the three surfaces, and the colour a component's text inherits. */
interface GroundProbe {
    stage: Styles;
    cell: Styles;
    swatch: Styles;
    text: {
        /** A child of the Playground's `.demo-wrap`. */
        wrap: string;
        /** A child of an Overview cell's `.cell__mount`. */
        mount: string;
        /** A child of the Playground's stage that is not in `.demo-wrap`, where the overlays sit. */
        onStage: string;
    };
}

interface GroundOptions {
    theme: Theme;
    bg: CanvasBg;
    /** The page is a capture (`?capture`): `data-prism-capture` on `<html>` and `CAPTURE_STYLES`. */
    capture?: boolean;
    /** Theme tokens a project overrides, as `defineConfig({ theme })` does. */
    tokens?: Record<string, string>;
}

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

/** The stylesheets that paint the three surfaces, as the components inline them. */
const COMPONENT_STYLES = [
    read('../renderer/prism-renderer.component.css'),
    read('../overview/prism-overview-cell.component.css'),
    read('./prism-canvas-toolbar.component.css')
];

const escapeAttribute = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** The paint of the three surfaces on a page that holds the theme tokens and the component styles, `bg` on each. */
async function renderGround(page: Page, o: GroundOptions): Promise<GroundProbe> {
    const { tokens } = resolveThemeTokens(o.theme, { theme: o.tokens });
    const custom = Object.entries(tokens)
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ');
    const capture = o.capture ? ` ${CAPTURE_ATTRIBUTE}` : '';

    await page.setContent(
        `<!doctype html><html style="${escapeAttribute(custom)}"${capture}><head><style>${[...COMPONENT_STYLES, CANVAS_BG_STYLES, ...(o.capture ? [CAPTURE_STYLES] : [])].join('\n')}</style></head><body>` +
            `<div class="prism-canvas-stage" data-bg="${o.bg}"><span class="on-stage">x</span><div class="demo-wrap"><span class="probe">Aa</span></div></div>` +
            `<div class="cell__stage" data-bg="${o.bg}"><div class="cell__mount"><span class="probe">Aa</span></div></div>` +
            `<span class="swatch" data-bg="${o.bg}"></span>` +
            `</body></html>`
    );

    const probe = await page.evaluate(() => {
        const style = (selector: string): CSSStyleDeclaration => {
            const el = document.querySelector(selector);

            if (!el) throw new Error(`No element matches ${selector}.`);
            return getComputedStyle(el);
        };
        const paint = (selector: string) => ({
            backgroundColor: style(selector).backgroundColor,
            backgroundImage: style(selector).backgroundImage
        });

        return {
            stage: paint('.prism-canvas-stage'),
            cell: paint('.cell__stage'),
            swatch: paint('.swatch'),
            text: {
                wrap: style('.demo-wrap .probe').color,
                mount: style('.cell__mount .probe').color,
                onStage: style('.on-stage').color
            }
        };
    });
    const paint = (styles: Styles): Styles => ({ backgroundColor: normalizeColor(styles.backgroundColor), backgroundImage: normalizeColor(styles.backgroundImage) });

    return {
        stage: paint(probe.stage),
        cell: paint(probe.cell),
        swatch: paint(probe.swatch),
        text: { wrap: normalizeColor(probe.text.wrap), mount: normalizeColor(probe.text.mount), onStage: normalizeColor(probe.text.onStage) }
    };
}

/** What a theme token resolves to, as the page paints it. */
async function tokenColour(page: Page, theme: Theme, token: string): Promise<string> {
    const { tokens } = resolveThemeTokens(theme, {});

    await page.setContent(`<!doctype html><html style="${escapeAttribute(`${token}: ${tokens[token]}`)}"><body><i style="color: var(${token})">x</i></body></html>`);
    return normalizeColor(await page.evaluate(() => getComputedStyle(document.querySelector('i') as Element).color));
}

const THEMES: Theme[] = ['dark', 'light'];
const SURFACES = ['stage', 'cell', 'swatch'] as const;

let browser: Browser;
let page: Page;

beforeAll(async () => {
    browser = await launchChromium();
    page = await browser.newPage();
});

afterAll(async () => {
    await browser?.close();
});

describe('the transparent ground', () => {
    it('paints transparent the same in the dark and the light theme', async () => {
        const dark = await renderGround(page, { theme: 'dark', bg: 'transparent' });
        const light = await renderGround(page, { theme: 'light', bg: 'transparent' });

        for (const surface of SURFACES) {
            expect({ surface, ...dark[surface] }).toEqual({ surface, ...light[surface] });
            expect(dark[surface].backgroundColor).toBe('rgba(247, 245, 252, 1)');
            expect(dark[surface].backgroundImage).toContain('linear-gradient');
        }
    });

    it.each(THEMES)('draws the squares in a fixed colour, not --prism-border, in the %s theme', async (theme) => {
        const probe = await renderGround(page, { theme, bg: 'transparent' });
        const border = await tokenColour(page, theme, '--prism-border');

        for (const surface of SURFACES) {
            expect(probe[surface].backgroundImage).toContain('rgba(233, 232, 239, 1)');
            expect(probe[surface].backgroundImage).not.toContain(border);
        }
    });

    it.each(THEMES)("follows a project's --prism-void-light in the %s theme", async (theme) => {
        const probe = await renderGround(page, { theme, bg: 'transparent', tokens: { '--prism-void-light': '#fcfcfd' } });

        for (const surface of SURFACES) {
            expect(probe[surface].backgroundColor).toBe('rgba(252, 252, 253, 1)');
            // The squares are the ground with 6 % ink in it, so they move with it.
            expect(probe[surface].backgroundImage).toContain('rgba(238, 238, 240, 1)');
        }
    });

    it('keeps transparent see-through in a capture', async () => {
        for (const theme of THEMES) {
            const probe = await renderGround(page, { theme, bg: 'transparent', capture: true });

            expect(probe.stage.backgroundColor).toBe('rgba(0, 0, 0, 0)');
            expect(probe.stage.backgroundImage).toBe('none');
        }
    });

    it.each(['dots', 'plain'] satisfies CanvasBg[])('leaves %s on the theme stage', async (bg) => {
        const dark = await renderGround(page, { theme: 'dark', bg });
        const light = await renderGround(page, { theme: 'light', bg });

        for (const surface of SURFACES) expect(dark[surface].backgroundColor).not.toBe(light[surface].backgroundColor);
    });
});
