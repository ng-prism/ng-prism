import { TestBed } from '@angular/core/testing';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { collectForcedColorRules, forcedColorsCss } from './forced-colors.js';
import { MEDIA_TRUE } from './media-condition.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { PrismSimulationRuntime } from './prism-simulation-runtime.service.js';

/** Lets pending MutationObserver callbacks run. */
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function addStyle(css: string): void {
    const style = document.createElement('style');

    style.textContent = css;
    document.head.appendChild(style);
}

function addOverlayContainer(): HTMLElement {
    const container = document.createElement('div');

    container.className = 'cdk-overlay-container';
    document.body.appendChild(container);
    return container;
}

/** The browser's `matchMedia`, which jsdom lacks: only `MEDIA_TRUE` matches. */
function stubMatchMedia(): (query: string) => MediaQueryList {
    const matchMedia = (query: string): MediaQueryList =>
        ({ media: query, matches: query === MEDIA_TRUE, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList;

    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
    return matchMedia;
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

function setUp(): { sim: PrismSimulationService; runtime: PrismSimulationRuntime } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PRISM_CONFIG, useValue: { colorScheme: { dark: { class: 'tl-dark' } } } }] });
    const sim = TestBed.inject(PrismSimulationService);
    const runtime = TestBed.inject(PrismSimulationRuntime);

    runtime.init();
    TestBed.tick();
    return { sim, runtime };
}

describe('PrismSimulationRuntime', () => {
    afterEach(() => {
        TestBed.resetTestingModule();
        jest.restoreAllMocks();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        delete (window as { matchMedia?: unknown }).matchMedia;
        delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
        delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync;
    });

    it('drives the engines from the service', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const browser = stubMatchMedia();
        const { sim } = setUp();

        sim.set({ motion: 'reduce' });
        TestBed.tick();
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce' });
        expect(window.matchMedia).not.toBe(browser);
        expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce', 'prefers-color-scheme': 'dark' });
        expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);

        clear.mockClear();
        sim.reset();
        TestBed.tick();
        expect(clear).toHaveBeenCalled();
        expect(window.matchMedia).toBe(browser);
    });

    it('leaves the engines alone for a simulation that emulates no media feature', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const browser = stubMatchMedia();
        const { sim } = setUp();

        sim.set({ vision: 'protanopia' });
        TestBed.tick();
        expect(apply).not.toHaveBeenCalled();
        expect(window.matchMedia).toBe(browser);
    });

    it('adopts the forced colors sheet, ignored by the media engine, and removes it on reset', () => {
        const { adopt, textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const ignore = jest.spyOn(MediaStyleSheets.prototype, 'ignore');
        const { sim } = setUp();

        addStyle('.dot { forced-color-adjust: none }');
        sim.set({ forced: 'active' });
        TestBed.tick();

        const [sheet] = document.adoptedStyleSheets;

        expect(document.adoptedStyleSheets).toHaveLength(1);
        expect(textOf(sheet)).toBe(forcedColorsCss({ exempt: ['.dot'], gradients: [] }));
        expect(ignore).toHaveBeenCalledWith(sheet);
        // The engine has rewritten the sheets before the forced one arrives, and never gets to see it unignored.
        expect(apply.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);
        expect(ignore.mock.invocationCallOrder[0]).toBeLessThan(adopt.mock.invocationCallOrder[0]);

        sim.reset();
        TestBed.tick();
        expect(document.adoptedStyleSheets).toEqual([]);
    });

    it('collects the exemptions anew each time forced colors turn on', () => {
        const { textOf } = stubAdoptedSheets();
        const { sim } = setUp();

        sim.set({ forced: 'active' });
        TestBed.tick();
        sim.reset();
        TestBed.tick();

        addStyle('.late { forced-color-adjust: none }');
        sim.set({ forced: 'active' });
        TestBed.tick();
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(collectForcedColorRules(document)));
        expect(textOf(document.adoptedStyleSheets[0])).toContain('.late');
    });

    it('keeps the other adopted sheets', () => {
        stubAdoptedSheets();
        const own = new CSSStyleSheet();

        document.adoptedStyleSheets = [own];
        const { sim } = setUp();

        sim.set({ forced: 'active' });
        TestBed.tick();
        expect(document.adoptedStyleSheets).toHaveLength(2);
        expect(document.adoptedStyleSheets[0]).toBe(own);
        sim.reset();
        TestBed.tick();
        expect(document.adoptedStyleSheets).toEqual([own]);
    });

    it('goes without the forced colors sheet where the document cannot adopt one', () => {
        const { sim } = setUp();

        sim.set({ forced: 'active' });
        expect(() => TestBed.tick()).not.toThrow();
    });

    it('treats a .cdk-overlay-container that is there already as a scope root and follows the simulation', () => {
        const container = addOverlayContainer();
        const { sim } = setUp();

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(container.hasAttribute('data-prism-sim')).toBe(true);
        expect(container.style.colorScheme).toBe('dark');
        expect(container.classList.contains('tl-dark')).toBe(true);

        sim.set({ vision: 'blurred' });
        TestBed.tick();
        expect(container.style.filter).toBe('blur(1.5px)');

        sim.reset();
        TestBed.tick();
        expect(container.hasAttribute('data-prism-sim')).toBe(false);
        expect(container.classList.contains('tl-dark')).toBe(false);
        expect(container.style.filter).toBe('');
    });

    it('treats a .cdk-overlay-container that appears later as a scope root', async () => {
        const { sim } = setUp();

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        const container = addOverlayContainer();

        await flushMutations();
        expect(container.hasAttribute('data-prism-sim')).toBe(true);
        expect(container.style.colorScheme).toBe('dark');
        expect(container.classList.contains('tl-dark')).toBe(true);
    });

    it('stops watching the body once nothing is simulated', async () => {
        const { sim } = setUp();

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        sim.reset();
        TestBed.tick();
        const container = addOverlayContainer();

        await flushMutations();
        expect(container.hasAttribute('data-prism-sim')).toBe(false);
    });

    it('only takes containers that are children of the body', async () => {
        const { sim } = setUp();

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        const nested = document.createElement('div');

        nested.className = 'cdk-overlay-container';
        document.body.appendChild(document.createElement('section')).appendChild(nested);

        await flushMutations();
        expect(nested.hasAttribute('data-prism-sim')).toBe(false);
    });

    it('starts once however often init is called', () => {
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');
        const { sim, runtime } = setUp();

        runtime.init();
        sim.set({ motion: 'reduce' });
        TestBed.tick();
        expect(apply).toHaveBeenCalledTimes(1);
    });

    it('takes everything back when the app is destroyed', () => {
        const clear = jest.spyOn(MediaStyleSheets.prototype, 'clear');
        const browser = stubMatchMedia();

        stubAdoptedSheets();
        const container = addOverlayContainer();
        const { sim } = setUp();

        sim.set({ motion: 'reduce', scheme: 'dark', forced: 'active' });
        TestBed.tick();
        clear.mockClear();

        TestBed.resetTestingModule();
        expect(clear).toHaveBeenCalled();
        expect(window.matchMedia).toBe(browser);
        expect(document.adoptedStyleSheets).toEqual([]);
        expect(container.hasAttribute('data-prism-sim')).toBe(false);
        expect(container.classList.contains('tl-dark')).toBe(false);
    });
});
