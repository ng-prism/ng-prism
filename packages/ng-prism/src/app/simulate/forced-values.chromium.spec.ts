import type { Browser, Page } from 'playwright';
import type { PrismSim } from './__test-utils__/chromium-entry.js';
import { launchChromium, normalizeColor, pageWithSimulation } from './__test-utils__/chromium.js';
import { type Declaration, forcedTwin, serializeDeclarations, type TwinContext } from './forced-values.js';

function d(property: string, value: string, important = false): Declaration {
    return { property, value, important };
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
    browser = await launchChromium();
    page = await pageWithSimulation(browser);
});

afterAll(async () => {
    await browser?.close();
});

/** What `declarationsOfStyle` makes of the style of each rule in `css`, as Chromium parses it, by selector. */
function declarationsOfRules(css: string): Promise<Record<string, Declaration[]>> {
    return page.evaluate((text) => {
        const { declarationsOfStyle } = (window as unknown as { __prismSim: PrismSim }).__prismSim;
        const sheet = new CSSStyleSheet();
        const found: Record<string, Declaration[]> = {};

        sheet.replaceSync(text);
        for (const rule of Array.from(sheet.cssRules)) found[(rule as CSSStyleRule).selectorText] = declarationsOfStyle((rule as CSSStyleRule).style);
        return found;
    }, css);
}

describe('declarationsOfStyle in Chromium', () => {
    it('reads the longhands of a shorthand, with their priority, and a custom property as written', async () => {
        const { '.a': a } = await declarationsOfRules('.a { background: #fff url(x.png); border: 1px solid red !important; --tok: Highlight }');

        expect(a).toContainEqual(d('background-color', 'rgb(255, 255, 255)'));
        expect(a).toContainEqual(d('background-image', 'url("x.png")'));
        // The style serializes a hex color as `rgb()` and keeps the name of a named one.
        expect(a).toContainEqual(d('border-top-color', 'red', true));
        expect(a).toContainEqual(d('border-left-color', 'red', true));
        expect(a).toContainEqual(d('--tok', 'Highlight'));
        expect(a.filter(({ property }) => property === 'background')).toEqual([]);
    });

    it('hands over a shorthand that var() left without longhands, as one declaration', async () => {
        const found = await declarationsOfRules(`
            .b { background: var(--ai) }
            .c { border: 1px solid var(--c) !important }
            .d { border-bottom: 1px solid var(--c) }
            .e { border-color: var(--c) }
            .f { outline: 2px solid var(--c) }
            .g { text-decoration: underline var(--c) }
        `);

        expect(found['.b']).toEqual([d('background', 'var(--ai)')]);
        expect(found['.c']).toEqual([d('border', '1px solid var(--c)', true)]);
        expect(found['.d']).toEqual([d('border-bottom', '1px solid var(--c)')]);
        expect(found['.e']).toEqual([d('border-color', 'var(--c)')]);
        expect(found['.f']).toEqual([d('outline', '2px solid var(--c)')]);
        expect(found['.g']).toEqual([d('text-decoration', 'underline var(--c)')]);
    });

    it('reads a longhand with var() as its text', async () => {
        const { '.h': h } = await declarationsOfRules('.h { color: var(--tok); background-color: var(--tok); box-shadow: var(--s); animation-name: pulse, spin }');

        expect(h).toEqual([d('color', 'var(--tok)'), d('background-color', 'var(--tok)'), d('box-shadow', 'var(--s)'), d('animation-name', 'pulse, spin')]);
    });

    it('reads the other longhands whose value names a system color, and only those', async () => {
        const { '.i': i } = await declarationsOfRules(
            '.i { fill: Highlight; transition: background 0.2s; font: menu; padding: 1px; stroke: red; accent-color: Highlight }'
        );

        expect(i.map(({ property, value }) => [property, value.toLowerCase()])).toEqual([
            ['fill', 'highlight'],
            ['accent-color', 'highlight']
        ]);
    });

    it('has nothing for a rule that sets no color and names no system color', async () => {
        const { '.j': j } = await declarationsOfRules('.j { padding: 1px; margin: 2px; display: flex; transition: background 0.2s }');

        expect(j).toEqual([]);
    });

    it('reads a custom property in the case it is written in, and an empty one', async () => {
        const { '.k': k } = await declarationsOfRules('.k { --Tok: red; --empty:; --a: var(--b) }');

        expect(k).toEqual([d('--Tok', 'red'), d('--empty', ''), d('--a', 'var(--b)')]);
    });
});

/**
 * The twin of a rule written as the engine writes it, right behind the declarations of the
 * original and with an element that has the context: what that element computes. So the twin
 * is shown to say in Chromium what it is meant to, and not only to parse.
 */
describe('the twin of a rule in Chromium', () => {
    const context: TwinContext = { palette: 'dark', gradientVars: new Set(['--ai']), keyframes: new Set(['pulse']) };
    // A foreground and a ground that no palette has, so that nothing agrees by chance.
    const CONTEXT = '--prism-sim-fg: rgb(1, 2, 3); --prism-sim-bg-rgb: 4 5 6';

    async function computedWithTwin(rule: string, properties: readonly string[]): Promise<Record<string, string>> {
        const { '.t': original } = await declarationsOfRules(rule);
        const css = `${CONTEXT}; ${serializeDeclarations([...original, ...forcedTwin(original, context)])}`;
        const computed = await page.evaluate(
            ({ text, names }) => {
                const el = document.body.appendChild(document.createElement('div'));
                const values: Record<string, string> = {};

                el.style.cssText = text;
                for (const name of names) values[name] = getComputedStyle(el).getPropertyValue(name);
                el.remove();
                return values;
            },
            { text: css, names: properties }
        );

        return Object.fromEntries(Object.entries(computed).map(([name, value]) => [name, normalizeColor(value)]));
    }

    it('forces the colors of the context, keeps the alpha of a background and removes shadows and gradients', async () => {
        const computed = await computedWithTwin(
            '.t { color: red; background: rgba(200, 0, 0, 0.4) linear-gradient(red, blue); border: 2px solid red; outline: 2px solid red; box-shadow: 0 0 3px blue; text-shadow: 1px 1px red }',
            ['color', 'background-color', 'background-image', 'border-top-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-shadow']
        );

        expect(computed).toEqual({
            color: 'rgba(1, 2, 3, 1)',
            'background-color': 'rgba(4, 5, 6, 0.4)',
            'background-image': 'none',
            'border-top-color': 'rgba(1, 2, 3, 1)',
            'border-left-color': 'rgba(1, 2, 3, 1)',
            'outline-color': 'rgba(1, 2, 3, 1)',
            'box-shadow': 'none',
            'text-shadow': 'none'
        });
    });

    it('takes the color of the element for borders, outlines and carets, a system color that stands among them', async () => {
        // Chromium forces them to the element's own color, not to the foreground of the context.
        const computed = await computedWithTwin('.t { color: Highlight; border: 4px solid red; outline: 4px solid red; caret-color: red }', [
            'color',
            'border-top-color',
            'outline-color',
            'caret-color'
        ]);

        expect(computed).toEqual({
            color: 'rgba(0, 230, 255, 0.8)',
            'border-top-color': 'rgba(0, 230, 255, 0.8)',
            'outline-color': 'rgba(0, 230, 255, 0.8)',
            'caret-color': 'rgba(0, 230, 255, 0.8)'
        });
    });

    it('leaves currentcolor and an automatic caret standing: a border without a color has the color of the element', async () => {
        const standing = await computedWithTwin('.t { color: Highlight; border: 2px solid; caret-color: auto }', ['border-top-color', 'caret-color']);
        const forced = await computedWithTwin('.t { color: red; border: 2px solid red }', ['color', 'border-top-color']);

        expect(standing).toEqual({ 'border-top-color': 'rgba(0, 230, 255, 0.8)', 'caret-color': 'rgba(0, 230, 255, 0.8)' });
        // An author color is forced, to the forced text color for both.
        expect(forced).toEqual({ color: 'rgba(1, 2, 3, 1)', 'border-top-color': 'rgba(1, 2, 3, 1)' });
    });

    it('takes the outline of the focus for an outline that has no color of its own', async () => {
        // The context of an element with visible focus, set by the rule so that the outline can be told from the color.
        const computed = await computedWithTwin('.t { --prism-sim-outline: rgb(9, 9, 9); color: Highlight; outline: 2px solid }', ['outline-color']);

        expect(computed).toEqual({ 'outline-color': 'rgba(9, 9, 9, 1)' });
    });

    it('takes the color of the element for a border that var() left whole as well', async () => {
        const computed = await computedWithTwin('.t { --c: red; color: Highlight; border: 2px solid var(--c); outline: 2px solid var(--c) }', [
            'border-left-color',
            'outline-color'
        ]);

        expect(computed).toEqual({ 'border-left-color': 'rgba(0, 230, 255, 0.8)', 'outline-color': 'rgba(0, 230, 255, 0.8)' });
    });

    it('turns a transparent color opaque in the foreground and keeps a transparent ground', async () => {
        const computed = await computedWithTwin('.t { color: red; border-top-color: transparent; background-color: transparent; -webkit-text-fill-color: transparent }', [
            'border-top-color',
            'background-color',
            '-webkit-text-fill-color'
        ]);

        // The text fill is `currentcolor`, the color the twin forces.
        expect(computed).toEqual({ 'border-top-color': 'rgba(1, 2, 3, 1)', 'background-color': 'rgba(0, 0, 0, 0)', '-webkit-text-fill-color': 'rgba(1, 2, 3, 1)' });
    });

    it('lets a system color stand that comes straight or through a custom property, in the palette', async () => {
        const straight = await computedWithTwin('.t { color: Highlight; background-color: ButtonFace; border-top-color: light-dark(Highlight, Mark) }', [
            'color',
            'background-color',
            'border-top-color'
        ]);
        const viaToken = await computedWithTwin('.t { --tok: Highlight; color: var(--tok); background-color: var(--tok); border-color: var(--tok) }', [
            'color',
            'background-color',
            'border-top-color'
        ]);
        const viaPair = await computedWithTwin('.t { --a: var(--b); --b: ButtonText; color: var(--a) }', ['color']);

        // A `light-dark()` of two system colors stands as well; the page here is light, so it is the first of them.
        expect(straight).toEqual({ color: 'rgba(0, 230, 255, 0.8)', 'background-color': 'rgba(0, 0, 0, 1)', 'border-top-color': 'rgba(0, 230, 255, 0.8)' });
        expect(viaToken).toEqual({ color: 'rgba(0, 230, 255, 0.8)', 'background-color': 'rgba(0, 230, 255, 0.8)', 'border-top-color': 'rgba(0, 230, 255, 0.8)' });
        expect(viaPair).toEqual({ color: 'rgba(255, 255, 255, 1)' });
    });

    it('forces what a custom property holds that is no system color', async () => {
        const computed = await computedWithTwin('.t { --tok: red; color: var(--tok); background-color: var(--tok) }', ['color', 'background-color']);

        expect(computed).toEqual({ color: 'rgba(1, 2, 3, 1)', 'background-color': 'rgba(4, 5, 6, 1)' });
    });

    it('removes the image of a custom property of gradients and leaves no color of it', async () => {
        const computed = await computedWithTwin('.t { --ai: linear-gradient(red, blue); background: var(--ai) }', ['background-image', 'background-color']);

        expect(computed).toEqual({ 'background-image': 'none', 'background-color': 'rgba(0, 0, 0, 0)' });
    });
});
