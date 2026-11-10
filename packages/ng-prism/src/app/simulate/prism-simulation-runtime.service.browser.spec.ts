import { TestBed } from '@angular/core/testing';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { type ForcedColorRules, forcedColorsCss } from './forced-colors.js';
import { MEDIA_TRUE } from './media-condition.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { PrismSimulationRuntimeService } from './prism-simulation-runtime.service.js';

const NO_FORCED_RULES: ForcedColorRules = { exempt: [], reenabled: [], gradientVars: [] };

/** Lets pending MutationObserver callbacks run. */
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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

function setUp(): { sim: PrismSimulationService; runtime: PrismSimulationRuntimeService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PRISM_CONFIG, useValue: { colorScheme: { dark: { class: 'tl-dark' } } } }] });
    const sim = TestBed.inject(PrismSimulationService);
    const runtime = TestBed.inject(PrismSimulationRuntimeService);

    runtime.init();
    TestBed.tick();
    return { sim, runtime };
}

describe('PrismSimulationRuntimeService', () => {
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
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce' }, null);
        expect(window.matchMedia).not.toBe(browser);
        expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(apply).toHaveBeenLastCalledWith({ 'prefers-reduced-motion': 'reduce', 'prefers-color-scheme': 'dark' }, null);
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

    it('adopts the forced colors sheet while forced colors are simulated and takes it away on reset', () => {
        stubAdoptedSheets();
        const { sim } = setUp();

        sim.set({ forced: 'active' });
        TestBed.tick();
        expect(document.adoptedStyleSheets).toHaveLength(1);

        sim.reset();
        TestBed.tick();
        expect(document.adoptedStyleSheets).toEqual([]);
    });

    it('writes the stylesheets in the forced palette, and again when it changes', () => {
        const { textOf } = stubAdoptedSheets();
        const apply = jest.spyOn(MediaStyleSheets.prototype, 'apply');

        // The system's scheme is light: only `MEDIA_TRUE` matches.
        stubMatchMedia();
        const { sim } = setUp();

        sim.set({ forced: 'active' });
        TestBed.tick();
        expect(apply).toHaveBeenLastCalledWith({ 'forced-colors': 'active' }, { palette: 'light', rules: NO_FORCED_RULES });
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(NO_FORCED_RULES, 'light'));

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(apply).toHaveBeenLastCalledWith({ 'forced-colors': 'active', 'prefers-color-scheme': 'dark' }, { palette: 'dark', rules: NO_FORCED_RULES });
        expect(textOf(document.adoptedStyleSheets[0])).toBe(forcedColorsCss(NO_FORCED_RULES, 'dark'));
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

    describe('overlays that CDK opens as popovers, in the top layer', () => {
        function addOverlay(container: HTMLElement, popover = true): HTMLElement {
            const host = document.createElement('div');

            if (popover) host.setAttribute('popover', 'manual');
            host.className = 'cdk-overlay-popover cdk-global-overlay-wrapper';
            container.appendChild(host);
            return host;
        }

        it('gives the filter to a popover that opens in the container, and nothing else', async () => {
            const container = addOverlayContainer();
            const { sim } = setUp();

            sim.set({ vision: 'blurred', scheme: 'dark' });
            TestBed.tick();
            const popover = addOverlay(container);
            const inline = addOverlay(container, false);

            await flushMutations();
            expect(popover.style.filter).toBe('blur(1.5px)');
            // The rest reaches it through the container.
            expect(popover.hasAttribute('data-prism-sim')).toBe(false);
            expect(popover.classList.contains('tl-dark')).toBe(false);
            expect(popover.style.colorScheme).toBe('');
            // Not in the top layer: the container's filter draws it already.
            expect(inline.hasAttribute('style')).toBe(false);

            sim.reset();
            TestBed.tick();
            expect(popover.hasAttribute('style')).toBe(false);
        });

        it('follows the filter of the simulation and drops it when only the scheme is left', () => {
            const container = addOverlayContainer();
            const popover = addOverlay(container);
            const { sim } = setUp();

            sim.set({ vision: 'blurred' });
            TestBed.tick();
            expect(popover.style.filter).toBe('blur(1.5px)');

            sim.set({ vision: 'none', scheme: 'dark' });
            TestBed.tick();
            expect(container.hasAttribute('data-prism-sim')).toBe(true);
            expect(popover.hasAttribute('style')).toBe(false);
        });

        it('releases a popover that leaves the container and gives back what it had inline', async () => {
            const container = addOverlayContainer();
            const popover = addOverlay(container);
            const { sim } = setUp();

            popover.style.setProperty('filter', 'opacity(0.5)', 'important');
            popover.style.setProperty('top', '8px');
            sim.set({ vision: 'blurred' });
            TestBed.tick();
            expect(popover.style.filter).toBe('blur(1.5px)');

            popover.remove();
            await flushMutations();
            expect(popover.style.filter).toBe('opacity(0.5)');
            expect(popover.style.getPropertyPriority('filter')).toBe('important');
            expect(popover.style.getPropertyValue('top')).toBe('8px');
        });

        it('stops watching the containers once nothing is simulated', async () => {
            const container = addOverlayContainer();
            const { sim } = setUp();

            sim.set({ vision: 'blurred' });
            TestBed.tick();
            sim.reset();
            TestBed.tick();
            const popover = addOverlay(container);

            await flushMutations();
            expect(popover.hasAttribute('style')).toBe(false);
        });

        it('watches a container that appears later for its popovers', async () => {
            const { sim } = setUp();

            sim.set({ vision: 'blurred' });
            TestBed.tick();
            const container = addOverlayContainer();

            await flushMutations();
            const popover = addOverlay(container);

            await flushMutations();
            expect(popover.style.filter).toBe('blur(1.5px)');
        });

        it('takes the filter back when the app is destroyed', () => {
            const container = addOverlayContainer();
            const popover = addOverlay(container);
            const { sim } = setUp();

            sim.set({ vision: 'blurred' });
            TestBed.tick();
            TestBed.resetTestingModule();
            expect(popover.hasAttribute('style')).toBe(false);
            expect(container.hasAttribute('style')).toBe(false);
        });
    });

    it('releases an overlay container whose apply threw', () => {
        const container = addOverlayContainer();
        const { sim } = setUp();

        jest.spyOn(container, 'setAttribute').mockImplementationOnce(() => {
            throw new DOMException('rejected', 'InvalidCharacterError');
        });
        sim.set({ scheme: 'dark' });
        expect(() => TestBed.tick()).toThrow('rejected');
        expect(container.classList.contains('tl-dark')).toBe(true);

        sim.reset();
        TestBed.tick();
        expect(container.attributes).toHaveLength(1);
        expect(container.className).toBe('cdk-overlay-container');
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

    it('stops watching the body when the app is destroyed', async () => {
        const { sim } = setUp();

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        TestBed.resetTestingModule();

        const container = addOverlayContainer();

        await flushMutations();
        expect(container.hasAttribute('data-prism-sim')).toBe(false);
        expect(container.classList.contains('tl-dark')).toBe(false);
    });
});
