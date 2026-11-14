import { ApplicationRef, effect, untracked } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ShowcaseState } from '../../decorator/showcase.types.js';
import type { RuntimePipe } from '../../plugin/pipe.types.js';
import type { NgPrismConfig, PanelDefinition, RuntimeComponent, RuntimeManifest } from '../../plugin/plugin.types.js';
import type { RuntimeService } from '../../plugin/service.types.js';
import { DEFAULT_SIMULATION } from '../simulate/simulation.js';
import { PRISM_CONFIG, PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { CAPTURE_PARAM } from './prism-capture.service.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { PrismPanelService } from './prism-panel.service.js';
import { PrismRendererService } from './prism-renderer.service.js';
import { PrismSimulationService } from './prism-simulation.service.js';
import { PrismUrlStateService } from './prism-url-state.service.js';

function createComponent(
    overrides: Partial<{
        className: string;
        title: string;
        variants: { name: string; states?: false }[];
        states: ShowcaseState[];
        inputs: RuntimeComponent['meta']['inputs'];
        /** Class names of the parts the component has. */
        parts: string[];
    }> = {}
): RuntimeComponent {
    return {
        type: class {} as any,
        meta: {
            className: overrides.className ?? 'Comp',
            filePath: '/test.ts',
            showcaseConfig: {
                title: overrides.title ?? 'Default',
                variants: overrides.variants,
                states: overrides.states
            },
            inputs: overrides.inputs ?? [],
            outputs: [],
            componentMeta: { selector: 'test', standalone: true, isDirective: false }
        },
        ...(overrides.parts ? { parts: overrides.parts.map((className) => ({ meta: createComponent({ className }).meta })) } : {})
    };
}

function createService(className = 'ToastService'): RuntimeService {
    return {
        meta: {
            className,
            filePath: '/test.service.ts',
            showcaseConfig: { title: className },
            provision: 'auto',
            api: { tags: {}, properties: [], methods: [], setup: [], types: [] }
        }
    };
}

function createPipe(className = 'TruncatePipe'): RuntimePipe {
    return {
        meta: {
            className,
            filePath: '/test.pipe.ts',
            showcaseConfig: { title: className },
            pipeName: 'truncate',
            api: { tags: {}, transform: [], setup: [], types: [] }
        }
    };
}

function setUrl(search: string): void {
    window.history.replaceState({}, '', `/${search}`);
}

const STATES: ShowcaseState[] = [
    { name: 'Hover', pseudo: { hover: true } },
    { name: 'Focus', pseudo: { 'focus-visible': true } }
];

function flush(): void {
    TestBed.inject(ApplicationRef).tick();
}

/**
 * What a mounted `PrismRendererComponent` (the Playground) does when the active
 * component changes: it reconciles the renderer service with it, on top of the
 * service's own reconcile on navigation. The URL service restores the variant
 * and the state in the same tick, so this runs on top of them. Specs for a view
 * without a renderer leave it out.
 */
function mirrorRendererComponent(): void {
    const nav = TestBed.inject(PrismNavigationService);
    const renderer = TestBed.inject(PrismRendererService);

    TestBed.runInInjectionContext(() =>
        effect(() => {
            const comp = nav.activeComponent();

            if (!comp) return;
            untracked(() => renderer.reconcileForComponent(comp));
        })
    );
}

/** A real history traversal: jsdom fires `popstate` asynchronously, after the entry has changed. */
function goBack(): Promise<void> {
    return new Promise((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
        window.history.back();
    });
}

function setup(
    manifest: RuntimeManifest,
    config: NgPrismConfig = {}
): {
    url: PrismUrlStateService;
    nav: PrismNavigationService;
    renderer: PrismRendererService;
    panel: PrismPanelService;
    sim: PrismSimulationService;
} {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            { provide: PRISM_MANIFEST, useValue: manifest },
            { provide: PRISM_CONFIG, useValue: config }
        ]
    });
    return {
        url: TestBed.inject(PrismUrlStateService),
        nav: TestBed.inject(PrismNavigationService),
        renderer: TestBed.inject(PrismRendererService),
        panel: TestBed.inject(PrismPanelService),
        sim: TestBed.inject(PrismSimulationService)
    };
}

describe('PrismUrlStateService', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        jest.restoreAllMocks();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    describe('init - restore from URL', () => {
        it('should do nothing when URL has no params', () => {
            const comp = createComponent({ className: 'Foo' });
            const { url, nav } = setup({ components: [comp] });

            url.init();

            expect(nav.activeItem()).toBeNull();
        });

        it('should restore component by className', () => {
            const comp = createComponent({ className: 'SguiButton' });

            setUrl('?component=SguiButton');
            const { url, nav } = setup({ components: [comp] });

            url.init();

            expect(nav.activeComponent()).toBe(comp);
        });

        it('should restore variant index', () => {
            const comp = createComponent({
                className: 'SguiButton',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }]
            });

            setUrl('?component=SguiButton&variant=2');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeVariantIndex()).toBe(2);
        });

        it('should restore page by title', () => {
            const page = {
                type: 'component' as const,
                title: 'ButtonPatterns',
                category: 'Docs',
                component: class {} as any
            };

            setUrl('?page=ButtonPatterns');
            const { url, nav } = setup({ components: [], pages: [page] });

            url.init();

            expect(nav.activePage()).toBe(page);
        });

        it('should restore view id', () => {
            setUrl('?view=api');
            const { url, panel } = setup({ components: [] });

            url.init();

            expect(panel.activeViewId()).toBe('api');
        });

        it('should ignore unknown component className without crashing', () => {
            const comp = createComponent({ className: 'Real' });

            setUrl('?component=Unknown');
            const { url, nav } = setup({ components: [comp] });

            url.init();

            expect(nav.activeComponent()).toBeNull();
        });

        it('should ignore out-of-range variant index', () => {
            const comp = createComponent({
                className: 'SguiButton',
                variants: [{ name: 'V1' }]
            });

            setUrl('?component=SguiButton&variant=99');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeVariantIndex()).toBe(0);
        });

        it('should ignore NaN variant value', () => {
            const comp = createComponent({
                className: 'SguiButton',
                variants: [{ name: 'V1' }, { name: 'V2' }]
            });

            setUrl('?component=SguiButton&variant=abc');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeVariantIndex()).toBe(0);
        });
    });

    describe('init - write to URL', () => {
        it('should write component className to URL on select', () => {
            const comp = createComponent({ className: 'SguiButton' });
            const { url, nav } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();

            expect(window.location.search).toBe('?component=SguiButton');
        });

        it('should write variant only when > 0', () => {
            const comp = createComponent({
                className: 'SguiButton',
                variants: [{ name: 'V1' }, { name: 'V2' }]
            });
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();
            expect(window.location.search).toBe('?component=SguiButton');

            renderer.activeVariantIndex.set(1);
            flush();
            expect(window.location.search).toBe('?component=SguiButton&variant=1');

            renderer.activeVariantIndex.set(0);
            flush();
            expect(window.location.search).toBe('?component=SguiButton');
        });

        it('should write view only when != renderer', () => {
            const comp = createComponent({ className: 'SguiButton' });
            const { url, nav, panel } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            panel.activeViewId.set('api');
            flush();

            expect(window.location.search).toBe('?component=SguiButton&view=api');
        });

        it('should write page title instead of component', () => {
            const page = {
                type: 'component' as const,
                title: 'Patterns',
                category: 'Docs',
                component: class {} as any
            };
            const { url, nav } = setup({ components: [], pages: [page] });

            url.init();
            nav.selectPage(page);
            flush();

            expect(window.location.search).toBe('?page=Patterns');
        });
    });

    describe('history API behavior', () => {
        it('should use pushState when component changes', () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const { url, nav } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            flush();
            pushSpy.mockClear();

            nav.select(b);
            flush();

            expect(pushSpy).toHaveBeenCalledTimes(1);
        });

        it('should use replaceState when variant changes', () => {
            const comp = createComponent({
                className: 'A',
                variants: [{ name: 'V1' }, { name: 'V2' }]
            });
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();
            replaceSpy.mockClear();

            renderer.activeVariantIndex.set(1);
            flush();

            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('should use replaceState when view changes', () => {
            const comp = createComponent({ className: 'A' });
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, panel } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();
            replaceSpy.mockClear();

            panel.activeViewId.set('api');
            flush();

            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('should open the next component on the Playground and go back to the view the entry holds', async () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const { url, nav, panel } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            panel.activeViewId.set('api');
            flush();
            expect(window.location.search).toBe('?component=A&view=api');

            nav.select(b);
            flush();
            expect(panel.activeViewId()).toBe('renderer');
            expect(window.location.search).toBe('?component=B');

            await goBack();

            expect(nav.activeComponent()).toBe(a);
            expect(panel.activeViewId()).toBe('api');
        });
    });

    describe('popstate handling', () => {
        it('should re-read URL on popstate event', () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const { url, nav } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            flush();

            setUrl('?component=B');
            window.dispatchEvent(new PopStateEvent('popstate'));

            expect(nav.activeComponent()).toBe(b);
        });
    });

    describe('opt-out via config', () => {
        it('should not register effect when config.urlState is false', () => {
            const comp = createComponent({ className: 'A' });
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const { url, nav } = setup({ components: [comp] }, { urlState: false });

            url.init();
            nav.select(comp);
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(window.location.search).toBe('');
        });

        it('should not restore from URL when config.urlState is false', () => {
            const comp = createComponent({ className: 'A' });

            setUrl('?component=A');
            const { url, nav } = setup({ components: [comp] }, { urlState: false });

            url.init();

            expect(nav.activeComponent()).toBeNull();
        });
    });

    describe('suppressSync', () => {
        it('should not re-write URL during restoreFromUrl', () => {
            const comp = createComponent({ className: 'A' });

            setUrl('?component=A');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url } = setup({ components: [comp] });

            url.init();
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).not.toHaveBeenCalled();
        });
    });

    describe('panel param', () => {
        it('should restore panel from URL', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&panel=events');
            const { url, panel } = setup({ components: [comp] });

            url.init();

            expect(panel.activePanelId()).toBe('events');
        });

        it('should write panel to URL when changed (non-default)', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo');
            const { url, panel, nav } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            panel.activePanelId.set('a11y');
            flush();

            expect(window.location.search).toContain('panel=a11y');
        });

        it('should omit panel from URL when value is default (controls)', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&panel=a11y');
            const { url, panel, nav } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            panel.activePanelId.set('controls');
            flush();

            expect(window.location.search).not.toContain('panel=');
        });
    });

    describe('state param', () => {
        it('should restore the state from the URL', () => {
            const comp = createComponent({ className: 'Foo', states: STATES });

            setUrl('?component=Foo&state=1');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeStateIndex()).toBe(1);
        });

        it.each(['2', '99', '-1', 'abc', '1.5', '1abc', ''])('should ignore the state "%s", which is no index into the states', (value) => {
            const comp = createComponent({ className: 'Foo', states: STATES });

            setUrl(`?component=Foo&state=${value}`);
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('should ignore a state on a component without states', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&state=0');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('should ignore a state on a page', () => {
            const page = {
                type: 'component' as const,
                title: 'Patterns',
                category: 'Docs',
                component: class {} as any
            };

            setUrl('?page=Patterns&state=0');
            const { url, renderer } = setup({ components: [], pages: [page] });

            url.init();

            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('should restore the variant and the state together', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });

            setUrl('?component=Foo&variant=2&state=1');
            const { url, renderer } = setup({ components: [comp] });

            url.init();

            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('should write the active state', () => {
            const comp = createComponent({ className: 'Foo', states: STATES });
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();
            expect(window.location.search).toBe('?component=Foo');

            renderer.selectState(1);
            flush();
            expect(window.location.search).toBe('?component=Foo&state=1');

            renderer.selectState(0);
            flush();
            expect(window.location.search).toBe('?component=Foo&state=0');

            renderer.selectState(null);
            flush();
            expect(window.location.search).toBe('?component=Foo');
        });

        it('should write the state after the variant', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }],
                states: STATES
            });
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            renderer.activeVariantIndex.set(1);
            renderer.selectState(1);
            flush();

            expect(window.location.search).toBe('?component=Foo&variant=1&state=1');
        });

        it('should drop the state from the URL when the variant changes', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });

            setUrl('?component=Foo&variant=1&state=1');
            const { url, renderer } = setup({ components: [comp] });

            url.init();
            flush();
            expect(window.location.search).toBe('?component=Foo&variant=1&state=1');

            renderer.selectVariant(2);
            flush();

            expect(renderer.activeStateIndex()).toBeNull();
            expect(window.location.search).toBe('?component=Foo&variant=2');
        });

        it('should use replaceState when only the state changes', () => {
            const comp = createComponent({ className: 'Foo', states: STATES });
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();
            pushSpy.mockClear();
            replaceSpy.mockClear();

            renderer.selectState(1);
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('should not write the state next to a page', () => {
            const page = {
                type: 'component' as const,
                title: 'Patterns',
                category: 'Docs',
                component: class {} as any
            };
            const { url, nav, renderer } = setup({ components: [], pages: [page] });

            url.init();
            renderer.selectState(1);
            nav.selectPage(page);
            flush();

            expect(window.location.search).toBe('?page=Patterns');
        });

        it('should drop the state when the component changes', () => {
            const a = createComponent({ className: 'A', states: STATES });
            const b = createComponent({ className: 'B', states: STATES });
            const { url, nav, renderer } = setup({ components: [a, b] });

            mirrorRendererComponent();
            url.init();
            nav.select(a);
            renderer.selectState(1);
            flush();
            expect(window.location.search).toBe('?component=A&state=1');

            nav.select(b);
            flush();

            expect(renderer.activeStateIndex()).toBeNull();
            expect(window.location.search).toBe('?component=B');
        });

        // No `mirrorRendererComponent()`: the switch is made from the Overview, where no renderer is mounted to see it.
        it('should drop the variant and the state when the component changes from outside the Playground', () => {
            const a = createComponent({
                className: 'A',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });
            const b = createComponent({ className: 'B' });
            const { url, nav, renderer, panel } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            panel.activeViewId.set('overview');
            renderer.selectVariant(2);
            renderer.selectState(1);
            flush();
            expect(window.location.search).toBe('?component=A&variant=2&state=1&view=overview');

            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');

            nav.select(b);
            flush();

            expect(renderer.activeVariantIndex()).toBe(0);
            expect(renderer.activeStateIndex()).toBeNull();
            expect(panel.activeViewId()).toBe('renderer');
            expect(window.location.search).toBe('?component=B');
            // Not even for one write: a pushed entry with them would come back on the next back button.
            const written = [...pushSpy.mock.calls, ...replaceSpy.mock.calls].map(([, , href]) => String(href));

            expect(written).toEqual(['/?component=B']);
        });

        it('should restore a cell of the component before in the Overview on popstate', async () => {
            const a = createComponent({
                className: 'A',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });
            const b = createComponent({ className: 'B' });
            const { url, nav, renderer, panel } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            panel.activeViewId.set('overview');
            renderer.selectVariant(2);
            renderer.selectState(1);
            flush();
            nav.select(b);
            flush();
            expect(window.location.search).toBe('?component=B');

            await goBack();
            flush();

            expect(nav.activeComponent()).toBe(a);
            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);
            expect(window.location.search).toBe('?component=A&variant=2&state=1&view=overview');
        });

        it('should restore the variant and the state on popstate', async () => {
            const a = createComponent({
                className: 'A',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });
            const b = createComponent({ className: 'B', states: STATES });
            const { url, nav, renderer } = setup({ components: [a, b] });

            mirrorRendererComponent();
            url.init();
            nav.select(a);
            flush();
            renderer.activeVariantIndex.set(2);
            renderer.selectState(1);
            flush();
            expect(window.location.search).toBe('?component=A&variant=2&state=1');

            nav.select(b);
            flush();
            expect(window.location.search).toBe('?component=B');

            await goBack();
            flush();

            expect(nav.activeComponent()).toBe(a);
            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);
            expect(window.location.search).toBe('?component=A&variant=2&state=1');
        });

        it('should clear the state on popstate to a URL without one', async () => {
            const a = createComponent({ className: 'A', states: STATES });
            const b = createComponent({ className: 'B', states: STATES });
            const { url, nav, renderer } = setup({ components: [a, b] });

            mirrorRendererComponent();
            url.init();
            nav.select(a);
            flush();
            nav.select(b);
            flush();
            renderer.selectState(1);
            flush();
            expect(window.location.search).toBe('?component=B&state=1');

            await goBack();
            flush();

            expect(nav.activeComponent()).toBe(a);
            expect(renderer.activeStateIndex()).toBeNull();
            expect(window.location.search).toBe('?component=A');
        });

        it('should keep control overrides when popstate addresses the active cell', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES,
                inputs: [{ name: 'label', type: 'string', required: false }]
            });

            setUrl('?component=Foo&variant=1&state=1');
            const { url, nav, renderer } = setup({ components: [comp] });

            mirrorRendererComponent();
            url.init();
            flush();
            renderer.updateInput('label', 'Custom');
            flush();

            const resetSpy = jest.spyOn(renderer, 'resetForComponent');
            const selectVariantSpy = jest.spyOn(renderer, 'selectVariant');

            // What a click on a `<a href="#">` inside the component does: popstate to the address on screen.
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(resetSpy).not.toHaveBeenCalled();
            expect(selectVariantSpy).not.toHaveBeenCalled();
            expect(renderer.inputValues()['label']).toBe('Custom');
            expect(nav.activeComponent()).toBe(comp);
            expect(renderer.activeVariantIndex()).toBe(1);
            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('should bring the variant and the state back on popstate to the same component without them', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });

            setUrl('?component=Foo&variant=2&state=1');
            const { url, renderer } = setup({ components: [comp] });

            mirrorRendererComponent();
            url.init();
            flush();
            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);

            setUrl('?component=Foo');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(renderer.activeVariantIndex()).toBe(0);
            expect(renderer.activeStateIndex()).toBeNull();
            expect(window.location.search).toBe('?component=Foo');
        });

        it('should keep the state on a variant that opts out', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'Plain', states: false }],
                states: STATES
            });

            setUrl('?component=Foo&variant=1&state=1');
            const { url, nav, renderer } = setup({ components: [comp] });

            mirrorRendererComponent();
            url.init();
            flush();

            expect(renderer.activeVariantIndex()).toBe(1);
            expect(renderer.activeStateIndex()).toBe(1);
            expect(nav.activeComponent()).toBe(comp);
            expect(window.location.search).toBe('?component=Foo&variant=1&state=1');
        });
    });

    describe('simulation params', () => {
        it('writes the simulation with replaceState, after the other parameters, in menu order', () => {
            const comp = createComponent({ className: 'Foo' });
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, panel, sim } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            panel.activePanelId.set('a11y');
            flush();
            pushSpy.mockClear();
            replaceSpy.mockClear();
            const entries = window.history.length;

            sim.set({ vision: 'deuteranopia' });
            flush();

            expect(window.location.search).toBe('?component=Foo&panel=a11y&vision=deuteranopia');
            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).toHaveBeenCalledTimes(1);
            expect(window.history.length).toBe(entries);

            sim.set({ motion: 'reduce', scheme: 'dark', forced: 'active', vision: 'blurred' });
            flush();

            expect(window.location.search).toBe('?component=Foo&panel=a11y&motion=reduce&scheme=dark&forced=active&vision=blurred');
        });

        it('drops the parameter of a setting that is back to its default', () => {
            const comp = createComponent({ className: 'Foo' });
            const { url, nav, sim } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            sim.set({ motion: 'reduce', scheme: 'light' });
            flush();
            expect(window.location.search).toBe('?component=Foo&motion=reduce&scheme=light');

            sim.set({ motion: 'system' });
            flush();
            expect(window.location.search).toBe('?component=Foo&scheme=light');

            sim.reset();
            flush();
            expect(window.location.search).toBe('?component=Foo');
        });

        it('keeps the simulation when the component changes', () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const { url, nav, sim } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            sim.set({ scheme: 'dark' });
            flush();

            nav.select(b);
            flush();

            expect(window.location.search).toBe('?component=B&scheme=dark');
        });

        it('restores them from a deep link', () => {
            setUrl('?component=Foo&motion=reduce&vision=blurred');
            const { url, sim } = setup({ components: [createComponent({ className: 'Foo' })] });

            url.init();
            flush();

            expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce', vision: 'blurred' });
            expect(window.location.search).toBe('?component=Foo&motion=reduce&vision=blurred');
        });

        it('restores them without writing the URL back', () => {
            setUrl('?component=Foo&scheme=dark');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url } = setup({ components: [createComponent({ className: 'Foo' })] });

            url.init();
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).not.toHaveBeenCalled();
        });

        it('drops a value that is no setting and keeps the rest of the link', () => {
            setUrl('?component=Foo&scheme=sepia&forced=active');
            const { url, sim } = setup({ components: [createComponent({ className: 'Foo' })] });

            url.init();
            flush();

            expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, forced: 'active' });
            expect(window.location.search).toBe('?component=Foo&forced=active');
        });

        it('restores them next to a service', () => {
            const toast = createService('ToastService');

            setUrl('?service=ToastService&scheme=light');
            const { url, nav, sim } = setup({ components: [], services: [toast] });

            url.init();
            flush();

            expect(nav.activeService()).toBe(toast);
            expect(sim.state().scheme).toBe('light');
        });

        it('keeps what is set when the link says nothing about the simulation', () => {
            setUrl('?component=Foo');
            const { url, sim } = setup({ components: [createComponent({ className: 'Foo' })] });

            sim.set({ scheme: 'dark' });
            url.init();
            flush();

            expect(sim.state().scheme).toBe('dark');
            expect(window.location.search).toBe('?component=Foo&scheme=dark');
        });

        it('lets a link that names a default override what is set', () => {
            setUrl('?component=Foo&scheme=system');
            const { url, sim } = setup({ components: [createComponent({ className: 'Foo' })] });

            sim.set({ scheme: 'dark' });
            url.init();
            flush();

            expect(sim.state()).toEqual(DEFAULT_SIMULATION);
            expect(window.location.search).toBe('?component=Foo');
        });

        // The simulation is a condition the reader looks under, not a place: it stays across components, so moving
        // through the history keeps it as well, and the entry takes it on.
        it('keeps the simulation on popstate and writes it into the entry', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&motion=reduce');
            const { url, nav, sim } = setup({ components: [comp] });

            url.init();
            flush();
            expect(sim.state().motion).toBe('reduce');

            setUrl('?component=Foo&scheme=dark');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();
            expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce' });
            expect(window.location.search).toBe('?component=Foo&motion=reduce');

            setUrl('?component=Foo');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();
            expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce' });
            expect(nav.activeComponent()).toBe(comp);
            expect(window.location.search).toBe('?component=Foo&motion=reduce');
        });

        it('does not bring back a simulation turned off since on back', async () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const { url, nav, sim } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            sim.set({ vision: 'tritanopia' });
            flush();
            nav.select(b);
            flush();
            expect(window.location.search).toBe('?component=B&vision=tritanopia');
            sim.set({ vision: 'none' });
            flush();
            expect(window.location.search).toBe('?component=B');

            await goBack();
            flush();

            expect(nav.activeComponent()).toBe(a);
            expect(sim.state().vision).toBe('none');
            expect(window.location.search).toBe('?component=A');
        });

        it('rewrites the entry on back without adding one', async () => {
            const a = createComponent({ className: 'A' });
            const b = createComponent({ className: 'B' });
            const { url, nav, sim } = setup({ components: [a, b] });

            url.init();
            nav.select(a);
            flush();
            nav.select(b);
            sim.set({ scheme: 'dark' });
            flush();
            const length = window.history.length;

            await goBack();
            flush();

            expect(window.location.search).toBe('?component=A&scheme=dark');
            expect(window.history.length).toBe(length);
        });

        it('ignores them with urlState: false', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&motion=reduce');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, sim } = setup({ components: [comp] }, { urlState: false });

            url.init();
            sim.set({ vision: 'blurred' });
            flush();

            expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, vision: 'blurred' });
            expect(replaceSpy).not.toHaveBeenCalled();
            expect(window.location.search).toBe('?component=Foo&motion=reduce');
        });

        it('rewrites the URL of a part with the simulation of the link', () => {
            const select = createComponent({ className: 'SelectComponent', parts: ['OptionComponent'] });
            const jsdoc: PanelDefinition = { id: 'jsdoc', label: 'API', placement: 'view', listsParts: true };

            setUrl('?component=OptionComponent&view=jsdoc&scheme=dark');
            const { url, sim } = setup({ components: [select] }, { plugins: [{ name: 'parts-lister', panels: [jsdoc] }] });

            url.init();
            flush();

            expect(sim.state().scheme).toBe('dark');
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent&scheme=dark');
        });
    });

    describe('capture flag', () => {
        afterEach(() => {
            document.documentElement.removeAttribute('data-prism-capture');
            document.getElementById('ng-prism-capture-styles')?.remove();
        });

        it('should never write the capture flag back to the URL', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&capture=1');
            const { url, nav } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            flush();

            expect(window.location.search).not.toContain(CAPTURE_PARAM);
        });

        it('should never see a simulation, neither to restore nor to write it', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?capture=1&component=Foo&motion=reduce&scheme=dark');
            const { url, nav, sim } = setup({ components: [comp] });

            url.init();
            nav.select(comp);
            sim.set({ vision: 'blurred' });
            flush();

            expect(sim.state()).toEqual(DEFAULT_SIMULATION);
            expect(window.location.search).toBe('?component=Foo');
        });

        it('should still restore navigation state alongside the capture flag', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }]
            });

            setUrl('?capture=1&component=Foo&variant=2');
            const { url, nav, renderer } = setup({ components: [comp] });

            url.init();

            expect(nav.activeComponent()).toBe(comp);
            expect(renderer.activeVariantIndex()).toBe(2);
        });

        // A screenshot runner addresses every cell this way; the variant change must not take the state with it.
        it('should restore the variant and the state alongside the capture flag', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });

            setUrl('?capture=1&component=Foo&variant=2&state=1');
            const { url, renderer } = setup({ components: [comp] });

            mirrorRendererComponent();
            url.init();
            flush();

            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('should move a runner from cell to cell of one component on popstate', () => {
            const comp = createComponent({
                className: 'Foo',
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }],
                states: STATES
            });

            setUrl('?capture=1&component=Foo&variant=1&state=0');
            const { url, renderer } = setup({ components: [comp] });

            mirrorRendererComponent();
            url.init();
            flush();

            setUrl('?capture=1&component=Foo&variant=2&state=1');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('should not reintroduce the capture flag on popstate', () => {
            const comp = createComponent({ className: 'Foo' });

            setUrl('?component=Foo&capture=1');
            const { url, nav } = setup({ components: [comp] });

            url.init();
            window.dispatchEvent(new PopStateEvent('popstate'));
            nav.select(comp);
            flush();

            expect(window.location.search).not.toContain(CAPTURE_PARAM);
        });
    });

    describe('service param', () => {
        it('restores ?service=', () => {
            const toast = createService('ToastService');

            setUrl('?service=ToastService');
            const { url, nav } = setup({ components: [], services: [toast] });

            url.init();

            expect(nav.activeService()?.meta.className).toBe('ToastService');
            expect(nav.activeService()).toBe(toast);
            expect(nav.activeComponent()).toBeNull();
        });

        it('restores the service before a page', () => {
            const toast = createService('ToastService');
            const page = { type: 'component' as const, title: 'Intro', component: class {} as any };

            setUrl('?service=ToastService&page=Intro');
            const { url, nav } = setup({ components: [], services: [toast], pages: [page] });

            url.init();

            expect(nav.activeService()).toBe(toast);
            expect(nav.activePage()).toBeNull();
        });

        it('selects nothing for an unknown service className', () => {
            const toast = createService('ToastService');

            setUrl('?service=Gone');
            const { url, nav } = setup({ components: [], services: [toast] });

            url.init();

            expect(nav.activeItem()).toBeNull();
        });

        it('writes service=<className> without variant or state', () => {
            const comp = createComponent({ className: 'Btn', variants: [{ name: 'V1' }, { name: 'V2' }], states: STATES });
            const toast = createService('ToastService');
            const { url, nav, renderer } = setup({ components: [comp], services: [toast] });

            url.init();
            nav.select(comp);
            renderer.activeVariantIndex.set(1);
            renderer.selectState(0);
            flush();
            expect(window.location.search).toBe('?component=Btn&variant=1&state=0');

            nav.selectService(toast);
            flush();

            expect(window.location.search).toBe('?service=ToastService');
        });

        it('writes the view and the panel next to the service', () => {
            const toast = createService('ToastService');
            const { url, nav, panel } = setup({ components: [], services: [toast] });

            url.init();
            nav.selectService(toast);
            panel.activeViewId.set('api');
            panel.activePanelId.set('jsdoc');
            flush();

            expect(window.location.search).toBe('?service=ToastService&view=api&panel=jsdoc');
        });

        it('pushes history when switching from a component to a service', () => {
            const comp = createComponent({ className: 'Btn' });
            const toast = createService('ToastService');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const { url, nav } = setup({ components: [comp], services: [toast] });

            url.init();
            nav.select(comp);
            flush();
            pushSpy.mockClear();

            nav.selectService(toast);
            flush();

            expect(pushSpy).toHaveBeenCalledTimes(1);
        });

        it('pushes history when switching between two services and replaces it for a view change', () => {
            const a = createService('A');
            const b = createService('B');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, panel } = setup({ components: [], services: [a, b] });

            url.init();
            nav.selectService(a);
            flush();
            pushSpy.mockClear();
            replaceSpy.mockClear();

            nav.selectService(b);
            flush();
            expect(pushSpy).toHaveBeenCalledTimes(1);

            pushSpy.mockClear();
            panel.activeViewId.set('api');
            flush();
            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('re-reads a service on popstate', () => {
            const comp = createComponent({ className: 'Btn' });
            const toast = createService('ToastService');
            const { url, nav } = setup({ components: [comp], services: [toast] });

            url.init();
            nav.select(comp);
            flush();

            setUrl('?service=ToastService');
            window.dispatchEvent(new PopStateEvent('popstate'));

            expect(nav.activeService()).toBe(toast);
        });

        it('starts the component that follows a service on the Playground, and writes no view', () => {
            const btn = createComponent({ className: 'Btn' });
            const card = createComponent({ className: 'Card' });
            const toast = createService('ToastService');
            const { url, nav, panel } = setup({ components: [btn, card], services: [toast] });

            url.init();
            nav.select(btn);
            flush();
            nav.selectService(toast);
            panel.activeViewId.set('api');
            flush();
            expect(window.location.search).toBe('?service=ToastService&view=api');

            nav.select(card);
            flush();

            expect(panel.activeViewId()).toBe('renderer');
            expect(window.location.search).toBe('?component=Card');
        });

        it('goes back from a service to the view the entry of the component holds', async () => {
            const btn = createComponent({ className: 'Btn' });
            const toast = createService('ToastService');
            const { url, nav, panel } = setup({ components: [btn], services: [toast] });

            url.init();
            nav.select(btn);
            panel.activeViewId.set('api');
            flush();
            nav.selectService(toast);
            flush();
            expect(window.location.search).toBe('?service=ToastService&view=api');

            await goBack();

            expect(nav.activeComponent()).toBe(btn);
            expect(panel.activeViewId()).toBe('api');
        });

        it('goes back from a service to the Playground of a component entry without a view', async () => {
            const btn = createComponent({ className: 'Btn' });
            const toast = createService('ToastService');
            const { url, nav, panel } = setup({ components: [btn], services: [toast] });

            url.init();
            nav.select(btn);
            flush();
            nav.selectService(toast);
            panel.activeViewId.set('api');
            flush();

            await goBack();

            expect(nav.activeComponent()).toBe(btn);
            expect(panel.activeViewId()).toBe('renderer');
        });
    });

    describe('pipe param', () => {
        it('restores ?pipe=', () => {
            const truncate = createPipe('TruncatePipe');

            setUrl('?pipe=TruncatePipe');
            const { url, nav } = setup({ components: [], pipes: [truncate] });

            url.init();

            expect(nav.activePipe()).toBe(truncate);
            expect(nav.activeComponent()).toBeNull();
            expect(nav.activeService()).toBeNull();
        });

        it('restores the pipe before a page', () => {
            const truncate = createPipe('TruncatePipe');
            const page = { type: 'component' as const, title: 'Intro', component: class {} as any };

            setUrl('?pipe=TruncatePipe&page=Intro');
            const { url, nav } = setup({ components: [], pipes: [truncate], pages: [page] });

            url.init();

            expect(nav.activePipe()).toBe(truncate);
            expect(nav.activePage()).toBeNull();
        });

        it('restores ?service= before ?pipe=', () => {
            const toast = createService('ToastService');
            const truncate = createPipe('TruncatePipe');

            setUrl('?pipe=TruncatePipe&service=ToastService');
            const { url, nav } = setup({ components: [], services: [toast], pipes: [truncate] });

            url.init();

            expect(nav.activeService()).toBe(toast);
            expect(nav.activePipe()).toBeNull();
        });

        it('selects nothing for an unknown pipe className', () => {
            const truncate = createPipe('TruncatePipe');

            setUrl('?pipe=Gone');
            const { url, nav } = setup({ components: [], pipes: [truncate] });

            url.init();

            expect(nav.activeItem()).toBeNull();
        });

        it('writes pipe=<className> without variant or state, next to the view and the panel', () => {
            const comp = createComponent({ className: 'Btn', variants: [{ name: 'V1' }, { name: 'V2' }], states: STATES });
            const truncate = createPipe('TruncatePipe');
            const { url, nav, renderer, panel } = setup({ components: [comp], pipes: [truncate] });

            url.init();
            nav.select(comp);
            renderer.activeVariantIndex.set(1);
            renderer.selectState(0);
            flush();
            expect(window.location.search).toBe('?component=Btn&variant=1&state=0');

            nav.selectPipe(truncate);
            flush();
            expect(window.location.search).toBe('?pipe=TruncatePipe');

            panel.activeViewId.set('api');
            panel.activePanelId.set('jsdoc');
            flush();
            expect(window.location.search).toBe('?pipe=TruncatePipe&view=api&panel=jsdoc');
        });

        it('keeps ?pipe=X and ?service=X apart', () => {
            const toast = createService('Shared');
            const truncate = createPipe('Shared');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const { url, nav } = setup({ components: [], services: [toast], pipes: [truncate] });

            url.init();
            nav.selectService(toast);
            flush();
            expect(window.location.search).toBe('?service=Shared');
            pushSpy.mockClear();

            nav.selectPipe(truncate);
            flush();
            expect(window.location.search).toBe('?pipe=Shared');
            expect(pushSpy).toHaveBeenCalledTimes(1);

            pushSpy.mockClear();
            nav.selectService(toast);
            flush();
            expect(window.location.search).toBe('?service=Shared');
            expect(pushSpy).toHaveBeenCalledTimes(1);
        });

        it('pushes history when switching between two pipes and replaces it for a view change', () => {
            const a = createPipe('A');
            const b = createPipe('B');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, panel } = setup({ components: [], pipes: [a, b] });

            url.init();
            nav.selectPipe(a);
            flush();
            pushSpy.mockClear();
            replaceSpy.mockClear();

            nav.selectPipe(b);
            flush();
            expect(pushSpy).toHaveBeenCalledTimes(1);

            pushSpy.mockClear();
            panel.activeViewId.set('api');
            flush();
            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('re-reads a pipe on popstate', () => {
            const comp = createComponent({ className: 'Btn' });
            const truncate = createPipe('TruncatePipe');
            const { url, nav } = setup({ components: [comp], pipes: [truncate] });

            url.init();
            nav.select(comp);
            flush();

            setUrl('?pipe=TruncatePipe');
            window.dispatchEvent(new PopStateEvent('popstate'));

            expect(nav.activePipe()).toBe(truncate);
        });
    });

    describe('part param', () => {
        const SELECT_PARTS = ['OptionComponent', 'GroupComponent'];
        const jsdocPanel: PanelDefinition = { id: 'jsdoc', label: 'API', placement: 'view', listsParts: true };

        /** A plugin whose view panel lists the parts, the way the jsdoc plugin's API panel does. */
        function withPartsPanel(panel: PanelDefinition = jsdocPanel): NgPrismConfig {
            return { plugins: [{ name: 'parts-lister', panels: [panel] }] };
        }

        function createSelect(): RuntimeComponent {
            return createComponent({ className: 'SelectComponent', variants: [{ name: 'V1' }, { name: 'V2' }], states: STATES, parts: SELECT_PARTS });
        }

        it('opens the parent for the URL of a part, on the part in the requested view', () => {
            setUrl('?component=OptionComponent&view=jsdoc');
            const { url, nav, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(nav.activeComponent()?.meta.className).toBe('SelectComponent');
            expect(panel.activePart()).toBe('OptionComponent');
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent');
        });

        it('opens the parent without a part when the URL names no view', () => {
            setUrl('?component=OptionComponent');
            const { url, nav, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(nav.activeComponent()?.meta.className).toBe('SelectComponent');
            expect(panel.activePart()).toBeNull();
            expect(window.location.search).toBe('?component=SelectComponent');
        });

        it('opens the parent on the default variant and state, which the URL of a part cannot address', () => {
            setUrl('?component=OptionComponent&variant=1&state=1');
            const { url, renderer } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(renderer.activeVariantIndex()).toBe(0);
            expect(renderer.activeStateIndex()).toBeNull();
            expect(window.location.search).toBe('?component=SelectComponent');
        });

        it('rewrites the URL of a part in place, so back does not return to it', () => {
            setUrl('?component=OptionComponent&view=jsdoc');
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const { url } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent');
        });

        it('restores part from its own param', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=GroupComponent');
            const { url, nav, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(nav.activeComponent()?.meta.className).toBe('SelectComponent');
            expect(panel.activeViewId()).toBe('jsdoc');
            expect(panel.activePart()).toBe('GroupComponent');
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=GroupComponent');
        });

        it('keeps the variant and the state next to the part', () => {
            setUrl('?component=SelectComponent&variant=1&state=0&view=jsdoc&part=OptionComponent');
            const { url } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(window.location.search).toBe('?component=SelectComponent&variant=1&state=0&view=jsdoc&part=OptionComponent');
        });

        it('drops the part when the requested view is not there', () => {
            setUrl('?component=OptionComponent&view=jsdoc');
            const { url, nav, panel } = setup({ components: [createSelect()] });

            url.init();
            flush();

            expect(nav.activeComponent()?.meta.className).toBe('SelectComponent');
            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');
        });

        it('drops the part when the panel that lists parts is not visible for the component', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel({ ...jsdocPanel, isVisible: () => false }));

            url.init();
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');
        });

        it('drops the part when the view is not the one that lists parts', () => {
            setUrl('?component=SelectComponent&view=other&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(panel.activeViewId()).toBe('other');
            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');
        });

        it('drops a part the component does not have', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=Unknown');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc');
        });

        it('drops a part next to a page, which has none', () => {
            const page = { type: 'component' as const, title: 'Patterns', category: 'Docs', component: class {} as any };

            setUrl('?page=Patterns&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()], pages: [page] }, withPartsPanel());

            url.init();
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');
        });

        it('writes the part a panel shows, next to the view', () => {
            const select = createSelect();
            const { url, nav, panel } = setup({ components: [select] }, withPartsPanel());

            url.init();
            nav.select(select);
            flush();
            panel.showPart('OptionComponent', 'jsdoc');
            flush();

            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent');
        });

        it('replaces history when a part is shown', () => {
            const select = createSelect();
            const pushSpy = jest.spyOn(window.history, 'pushState');
            const replaceSpy = jest.spyOn(window.history, 'replaceState');
            const { url, nav, panel } = setup({ components: [select] }, withPartsPanel());

            url.init();
            nav.select(select);
            flush();
            pushSpy.mockClear();
            replaceSpy.mockClear();

            panel.showPart('OptionComponent', 'jsdoc');
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(replaceSpy).toHaveBeenCalledTimes(1);
        });

        it('adds no history entry when the active part is shown again', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();
            const pushSpy = jest.spyOn(window.history, 'pushState');

            panel.showPart('OptionComponent', 'jsdoc');
            flush();

            expect(pushSpy).not.toHaveBeenCalled();
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent');
        });

        it('drops part when the component changes', () => {
            const select = createSelect();
            const other = createComponent({ className: 'ButtonComponent' });

            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, nav, panel } = setup({ components: [select, other] }, withPartsPanel());

            url.init();
            flush();
            expect(window.location.search).toContain('part=OptionComponent');

            nav.select(other);
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');

            nav.select(select);
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).not.toContain('part=');
        });

        it('drops part when the view changes', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();

            panel.activeViewId.set('renderer');
            flush();

            expect(window.location.search).toBe('?component=SelectComponent');
        });

        it('shows the part after a popstate to its URL', () => {
            setUrl('?component=SelectComponent&view=jsdoc');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();
            expect(panel.activePart()).toBeNull();

            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(panel.activePart()).toBe('OptionComponent');
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc&part=OptionComponent');
        });

        /** A hash link inside the page fires a popstate to the same URL; the reader must not be sent back to the part. */
        it('does not show the part again on a popstate to the URL it is shown at', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());
            const seen: (string | null)[] = [];

            url.init();
            flush();
            TestBed.runInInjectionContext(() => effect(() => seen.push(panel.activePart())));
            flush();

            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent#usage');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(seen).toEqual(['OptionComponent']);
        });

        it('forgets the part on a popstate to the URL of its view without one', () => {
            setUrl('?component=SelectComponent&view=jsdoc&part=OptionComponent');
            const { url, panel } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();
            flush();
            expect(panel.activePart()).toBe('OptionComponent');

            setUrl('?component=SelectComponent&view=jsdoc');
            window.dispatchEvent(new PopStateEvent('popstate'));
            flush();

            expect(panel.activePart()).toBeNull();
            expect(window.location.search).toBe('?component=SelectComponent&view=jsdoc');
        });

        it('does not redirect a class name that is neither a component nor a part', () => {
            setUrl('?component=Unknown&view=jsdoc');
            const { url, nav } = setup({ components: [createSelect()] }, withPartsPanel());

            url.init();

            expect(nav.activeComponent()).toBeNull();
        });
    });
});
