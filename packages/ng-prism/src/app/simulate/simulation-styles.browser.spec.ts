import { collectForcedColorRules, forcedColorsCss } from './forced-colors.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { SimulationStyles } from './simulation-styles.js';

/** Lets pending MutationObserver callbacks run. */
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function addStyle(css: string): void {
    const style = document.createElement('style');

    style.textContent = css;
    document.head.appendChild(style);
}

/**
 * What jsdom lacks for constructable sheets: `document.adoptedStyleSheets`, with
 * a spy on its setter, and `replaceSync`, which only remembers the text.
 */
function stubAdoptedSheets(): { adopt: jest.Mock; textOf: (sheet: CSSStyleSheet) => string | undefined } {
    const texts = new WeakMap<CSSStyleSheet, string>();
    let sheets: CSSStyleSheet[] = [];
    const adopt = jest.fn((next: CSSStyleSheet[]) => {
        sheets = next;
    });

    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, get: () => sheets, set: adopt });
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
        configurable: true,
        writable: true,
        value(this: CSSStyleSheet, text: string) {
            texts.set(this, text);
        }
    });
    return { adopt, textOf: (sheet) => texts.get(sheet) };
}

describe('SimulationStyles', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
        delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync;
    });

    it('adopts the forced colors sheet, ignored by the media engine, and removes it on clear', () => {
        const { adopt, textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const ignore = jest.spyOn(MediaStyleSheets.prototype, 'ignore');
        const styles = new SimulationStyles(document);

        addStyle('.dot { forced-color-adjust: none }');
        styles.apply({ 'forced-colors': 'active' }, 'dark');

        const [sheet] = document.adoptedStyleSheets;

        expect(document.adoptedStyleSheets).toHaveLength(1);
        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: ['.dot'], reenabled: [], gradients: [], gradientVars: [] }, 'dark'));
        expect(ignore).toHaveBeenCalledWith(sheet);
        // The engine has rewritten the sheets before the forced one arrives, and never gets to see it unignored.
        expect(apply.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);
        expect(ignore.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);

        styles.clear();
        expect(document.adoptedStyleSheets).toEqual([]);
    });

    it('is idempotent', () => {
        stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(apply).toHaveBeenCalledTimes(2);
    });

    it('collects the exemptions anew each time forced colors turn on', () => {
        const { textOf } = stubAdoptedSheets();
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        styles.clear();

        addStyle('.late { forced-color-adjust: none }');
        styles.apply({ 'forced-colors': 'active' }, 'dark');
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(collectForcedColorRules(document), 'dark'));
        expect(textOf(document.adoptedStyleSheets[0])).toContain('.late');
    });

    it('rewrites the forced colors sheet in place for another palette, once, and hands the palette to the media engine', () => {
        const { adopt, textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = new SimulationStyles(document);

        addStyle('@media (forced-colors: active) { .t { color: Highlight } } .dot { forced-color-adjust: none }');
        styles.apply({ 'forced-colors': 'active' }, 'dark');
        const [sheet] = document.adoptedStyleSheets;
        const replaceSync = jest.spyOn(sheet, 'replaceSync');

        styles.apply({ 'forced-colors': 'active' }, 'light');
        expect(apply).toHaveBeenLastCalledWith({ 'forced-colors': 'active' }, 'light');
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(adopt).toHaveBeenCalledTimes(1);
        // The media engine builds its copies anew and calls back, which writes the sheet; nothing writes it twice.
        expect(replaceSync).toHaveBeenCalledTimes(1);
        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: ['.dot'], reenabled: [], gradients: [], gradientVars: [] }, 'light'));

        styles.clear();
    });

    it('writes the sheet for another palette without styles that would make the media engine call back', () => {
        const { textOf } = stubAdoptedSheets();
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        styles.apply({ 'forced-colors': 'active' }, 'light');
        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: [], reenabled: [], gradients: [], gradientVars: [] }, 'light'));
        styles.clear();
    });

    it('keeps the other adopted sheets', () => {
        stubAdoptedSheets();
        const own = new CSSStyleSheet();

        document.adoptedStyleSheets = [own];
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        expect(document.adoptedStyleSheets).toHaveLength(2);
        expect(document.adoptedStyleSheets[0]).toBe(own);
        styles.clear();
        expect(document.adoptedStyleSheets).toEqual([own]);
    });

    it('goes without the forced colors sheet where the document cannot adopt one, and emulates the rest', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const styles = new SimulationStyles(document);

        expect(() => styles.apply({ 'forced-colors': 'active' }, 'dark')).not.toThrow();
        expect(apply).toHaveBeenLastCalledWith({ 'forced-colors': 'active' }, 'dark');
    });

    it('takes the forced colors sheet away and keeps emulating the scheme when only forced colors go', () => {
        stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active', 'prefers-color-scheme': 'dark' }, 'dark');
        expect(document.adoptedStyleSheets).toHaveLength(1);
        clear.mockClear();

        styles.apply({ 'prefers-color-scheme': 'dark' }, null);
        expect(document.adoptedStyleSheets).toEqual([]);
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-color-scheme': 'dark' }, null);
        expect(clear).not.toHaveBeenCalled();
    });

    it('clears the media engine for an emulation of nothing', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const styles = new SimulationStyles(document);

        styles.apply({}, null);
        expect(clear).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();

        styles.apply({ 'prefers-reduced-motion': 'reduce' }, null);
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce' }, null);

        clear.mockClear();
        styles.clear();
        expect(clear).toHaveBeenCalledTimes(1);
    });

    it('collects the exemptions of styles that arrive while forced colors are on', async () => {
        const { textOf } = stubAdoptedSheets();
        const styles = new SimulationStyles(document);

        styles.apply({ 'forced-colors': 'active' }, 'dark');
        const [sheet] = document.adoptedStyleSheets;

        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: [], reenabled: [], gradients: [], gradientVars: [] }, 'dark'));

        addStyle('.dot { forced-color-adjust: none }');
        await flushMutations();
        // Rewritten in place: the same sheet, still the only one adopted.
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: ['.dot'], reenabled: [], gradients: [], gradientVars: [] }, 'dark'));

        styles.clear();
    });
});
