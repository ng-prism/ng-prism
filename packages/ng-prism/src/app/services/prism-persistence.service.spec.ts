import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { NgPrismConfig, RuntimeComponent, RuntimeManifest } from '../../plugin/plugin.types.js';
import { A11yPanelStateService } from '../panels/a11y/a11y-panel-state.service.js';
import { A11yPerspectiveService } from '../panels/a11y/a11y-perspective.service.js';
import { DEFAULT_SIMULATION } from '../simulate/simulation.js';
import { PRISM_CONFIG, PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { PrismPersistenceService } from './prism-persistence.service.js';
import { PrismRendererService } from './prism-renderer.service.js';
import { PrismSimulationService } from './prism-simulation.service.js';
import { PrismUrlStateService } from './prism-url-state.service.js';

const STORAGE_KEY = 'ng-prism:state';

function setup(manifest: RuntimeManifest, config: NgPrismConfig = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            { provide: PRISM_MANIFEST, useValue: manifest },
            { provide: PRISM_CONFIG, useValue: config }
        ]
    });
    return TestBed.inject(PrismPersistenceService);
}

function createComponent(
    overrides: Partial<{
        className: string;
        inputs: RuntimeComponent['meta']['inputs'];
        variants: { name: string }[];
    }> = {}
): RuntimeComponent {
    return {
        type: class {} as any,
        meta: {
            className: overrides.className ?? 'Comp',
            filePath: '/test.ts',
            showcaseConfig: { title: 'T', variants: overrides.variants },
            inputs: overrides.inputs ?? [],
            outputs: [],
            componentMeta: { selector: 'test', standalone: true, isDirective: false }
        }
    };
}

describe('PrismPersistenceService', () => {
    beforeEach(() => {
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    describe('init - opt-out', () => {
        it('should not read sessionStorage when persistState is false', () => {
            const spy = jest.spyOn(Storage.prototype, 'getItem');
            const service = setup({ components: [] }, { persistState: false });

            service.init();

            expect(spy).not.toHaveBeenCalledWith(STORAGE_KEY);
        });

        it('should read sessionStorage when persistState is not set (default on)', () => {
            const spy = jest.spyOn(Storage.prototype, 'getItem');
            const service = setup({ components: [] });

            service.init();

            expect(spy).toHaveBeenCalledWith(STORAGE_KEY);
        });

        it('should not read sessionStorage in capture mode', () => {
            window.history.replaceState({}, '', '/?capture=1');
            const spy = jest.spyOn(Storage.prototype, 'getItem');
            const service = setup({ components: [] });

            service.init();

            expect(spy).not.toHaveBeenCalledWith(STORAGE_KEY);

            window.history.replaceState({}, '', '/');
            document.documentElement.removeAttribute('data-prism-capture');
            document.getElementById('ng-prism-capture-styles')?.remove();
        });
    });

    describe('restoreFromStorage', () => {
        it('should restore a11y activeTab and perspective from valid state', () => {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: {},
                    a11y: { activeTab: 'keyboard', perspective: 'screen-reader' }
                })
            );
            const service = setup({ components: [] });

            service.init();

            const a11yPanelState = TestBed.inject(A11yPanelStateService);
            const a11yPerspective = TestBed.inject(A11yPerspectiveService);

            expect(a11yPanelState.activeTab()).toBe('keyboard');
            expect(a11yPerspective.mode()).toBe('screen-reader');
        });

        it('should restore input overrides when className and variantIndex match the active component', () => {
            const comp = createComponent({
                className: 'Btn',
                inputs: [{ name: 'size', type: 'string', required: false, defaultValue: 'md' }],
                variants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
            });

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: { Btn: { variantIndex: 2, values: { size: 'large' } } }
                })
            );

            const service = setup({ components: [comp] });
            const nav = TestBed.inject(PrismNavigationService);
            const rendererService = TestBed.inject(PrismRendererService);

            nav.select(comp);
            rendererService.activeVariantIndex.set(2);

            service.init();

            expect(rendererService.inputValues()).toEqual(expect.objectContaining({ size: 'large' }));
        });

        it('should not crash on malformed JSON', () => {
            sessionStorage.setItem(STORAGE_KEY, '{not valid json');
            const service = setup({ components: [] });

            expect(() => service.init()).not.toThrow();
        });

        it('should ignore state with non-matching schema version', () => {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 99,
                    inputs: {},
                    a11y: { activeTab: 'keyboard' }
                })
            );
            const service = setup({ components: [] });

            service.init();

            const a11yPanelState = TestBed.inject(A11yPanelStateService);

            expect(a11yPanelState.activeTab()).toBe('violations');
        });

        it('should not apply input overrides when persisted variantIndex differs from current', () => {
            const comp = createComponent({
                className: 'Btn',
                inputs: [{ name: 'size', type: 'string', required: false, defaultValue: 'md' }],
                variants: [{ name: 'A' }, { name: 'B' }]
            });

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: { Btn: { variantIndex: 1, values: { size: 'large' } } }
                })
            );
            const service = setup({ components: [comp] });
            const nav = TestBed.inject(PrismNavigationService);
            const renderer = TestBed.inject(PrismRendererService);

            nav.select(comp);
            renderer.activeVariantIndex.set(0);

            service.init();

            expect(renderer.inputValues()).not.toEqual(expect.objectContaining({ size: 'large' }));
        });

        it('should filter out unknown input names that are not in the component meta', () => {
            const comp = createComponent({
                className: 'Btn',
                inputs: [{ name: 'size', type: 'string', required: false, defaultValue: 'md' }],
                variants: [{ name: 'A' }]
            });

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: {
                        Btn: {
                            variantIndex: 0,
                            values: { size: 'large', removedProp: 'stale' }
                        }
                    }
                })
            );
            const service = setup({ components: [comp] });
            const nav = TestBed.inject(PrismNavigationService);
            const renderer = TestBed.inject(PrismRendererService);

            nav.select(comp);

            service.init();

            const result = renderer.inputValues();

            expect(result['size']).toBe('large');
            expect(result['removedProp']).toBeUndefined();
        });
    });

    describe('setupSyncEffect', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        it('should write serialized state to sessionStorage after debounce window', () => {
            const comp = createComponent({
                className: 'Btn',
                inputs: [{ name: 'size', type: 'string', required: false, defaultValue: 'md' }],
                variants: [{ name: 'A' }]
            });
            const service = setup({ components: [comp] });
            const nav = TestBed.inject(PrismNavigationService);
            const rendererService = TestBed.inject(PrismRendererService);

            service.init();
            nav.select(comp);
            rendererService.inputValues.set({ size: 'large' });
            TestBed.inject(ApplicationRef).tick();

            jest.advanceTimersByTime(250);

            const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');

            expect(stored.version).toBe(1);
            expect(stored.inputs.Btn).toEqual({
                variantIndex: 0,
                values: { size: 'large' }
            });
        });

        it('should not write while suppressSync is set during restore', () => {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: {},
                    a11y: { activeTab: 'keyboard', perspective: 'visual' },
                    simulation: DEFAULT_SIMULATION
                })
            );
            const setSpy = jest.spyOn(Storage.prototype, 'setItem');
            const service = setup({ components: [] });

            service.init();
            jest.advanceTimersByTime(250);

            expect(setSpy).not.toHaveBeenCalled();
        });

        it('should preserve persisted buckets for components other than the active one', () => {
            const btn = createComponent({
                className: 'Btn',
                inputs: [{ name: 'size', type: 'string', required: false, defaultValue: 'md' }],
                variants: [{ name: 'A' }]
            });

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    inputs: {
                        Btn: { variantIndex: 0, values: { size: 'large' } },
                        Card: { variantIndex: 0, values: { color: 'red' } }
                    }
                })
            );
            const service = setup({ components: [btn] });
            const nav = TestBed.inject(PrismNavigationService);
            const renderer = TestBed.inject(PrismRendererService);

            nav.select(btn);
            renderer.activeVariantIndex.set(0);

            service.init();

            renderer.inputValues.set({ size: 'xl' });
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');

            expect(stored.inputs.Card).toEqual({
                variantIndex: 0,
                values: { color: 'red' }
            });
            expect(stored.inputs.Btn).toEqual({
                variantIndex: 0,
                values: { size: 'xl' }
            });
        });
    });

    describe('storage failure handling', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        it('should warn and continue when sessionStorage.setItem throws (quota)', () => {
            const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const comp = createComponent({ className: 'Btn' });
            const service = setup({ components: [comp] });
            const nav = TestBed.inject(PrismNavigationService);

            service.init();
            nav.select(comp);
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            expect(setSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[ng-prism]'), expect.any(Error));
        });

        it('should silently fall back when sessionStorage.getItem throws', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError');
            });
            const service = setup({ components: [] });

            expect(() => service.init()).not.toThrow();
        });
    });

    describe('simulation', () => {
        beforeEach(() => {
            window.history.replaceState({}, '', '/');
        });

        afterEach(() => {
            jest.useRealTimers();
            window.history.replaceState({}, '', '/');
            document.documentElement.removeAttribute('data-prism-capture');
            document.getElementById('ng-prism-capture-styles')?.remove();
        });

        function store(simulation: unknown): void {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, inputs: {}, simulation }));
        }

        it('keeps the simulation for the session', () => {
            jest.useFakeTimers();
            const service = setup({ components: [] });
            const sim = TestBed.inject(PrismSimulationService);

            service.init();
            sim.set({ scheme: 'dark', vision: 'protanopia' });
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');

            expect(stored.version).toBe(1);
            expect(stored.simulation).toEqual({ ...DEFAULT_SIMULATION, scheme: 'dark', vision: 'protanopia' });

            const reloaded = setup({ components: [] });

            reloaded.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual({ ...DEFAULT_SIMULATION, scheme: 'dark', vision: 'protanopia' });
        });

        it('writes it back when it returns to the default', () => {
            jest.useFakeTimers();
            store({ ...DEFAULT_SIMULATION, motion: 'reduce' });
            const service = setup({ components: [] });
            const sim = TestBed.inject(PrismSimulationService);

            service.init();
            sim.reset();
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null').simulation).toEqual(DEFAULT_SIMULATION);
        });

        it('restores it from the session', () => {
            store({ ...DEFAULT_SIMULATION, forced: 'active' });
            const service = setup({ components: [] });

            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual({ ...DEFAULT_SIMULATION, forced: 'active' });
        });

        it('lets the URL win over the session', () => {
            window.history.replaceState({}, '', '/?vision=deuteranopia');
            store({ scheme: 'dark' });
            const service = setup({ components: [] });

            TestBed.inject(PrismUrlStateService).init();
            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual({ ...DEFAULT_SIMULATION, vision: 'deuteranopia' });
        });

        it('lets a link that names a default win over the session as well', () => {
            window.history.replaceState({}, '', '/?scheme=system');
            store({ scheme: 'dark' });
            const service = setup({ components: [] });

            TestBed.inject(PrismUrlStateService).init();
            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual(DEFAULT_SIMULATION);
        });

        it('restores the session where the URL says nothing about the simulation', () => {
            window.history.replaceState({}, '', '/?panel=a11y');
            store({ scheme: 'dark' });
            const service = setup({ components: [] });

            TestBed.inject(PrismUrlStateService).init();
            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual({ ...DEFAULT_SIMULATION, scheme: 'dark' });
        });

        it('drops what is no setting, field by field', () => {
            store({ motion: 'reduce', scheme: 'sepia', forced: 7, vision: null });
            const service = setup({ components: [] });

            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce' });
        });

        it('leaves the simulation alone when the session has none', () => {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, inputs: {} }));
            const service = setup({ components: [] });
            const sim = TestBed.inject(PrismSimulationService);

            sim.set({ scheme: 'light' });
            service.init();

            expect(sim.state().scheme).toBe('light');
        });

        it('does not restore it when persistState is false', () => {
            store({ scheme: 'dark' });
            const service = setup({ components: [] }, { persistState: false });

            service.init();

            expect(TestBed.inject(PrismSimulationService).state()).toEqual(DEFAULT_SIMULATION);
        });

        it('does not restore or write it in capture mode', () => {
            jest.useFakeTimers();
            window.history.replaceState({}, '', '/?capture=1');
            store({ scheme: 'dark' });
            const setSpy = jest.spyOn(Storage.prototype, 'setItem');
            const service = setup({ components: [] });
            const sim = TestBed.inject(PrismSimulationService);

            service.init();
            sim.set({ motion: 'reduce' });
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            expect(sim.state()).toEqual(DEFAULT_SIMULATION);
            expect(setSpy).not.toHaveBeenCalled();
        });
    });

    describe('Date values', () => {
        const comp = createComponent({
            className: 'DateField',
            inputs: [{ name: 'value', type: 'date', required: false, defaultValue: null }],
            variants: [{ name: 'A' }]
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('restores a stored Date as a Date', () => {
            const date = new Date(2026, 3, 28);

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ version: 1, inputs: { DateField: { variantIndex: 0, values: { value: { $prismDate: date.getTime() } } } } })
            );
            const service = setup({ components: [comp] });
            const rendererService = TestBed.inject(PrismRendererService);

            TestBed.inject(PrismNavigationService).select(comp);
            service.init();

            const value = rendererService.inputValues()['value'];

            expect(value).toBeInstanceOf(Date);
            expect((value as Date).getTime()).toBe(date.getTime());
        });

        it('writes a Date so that it reads back as one', () => {
            jest.useFakeTimers();
            const date = new Date(2026, 3, 28);
            const service = setup({ components: [comp] });
            const rendererService = TestBed.inject(PrismRendererService);

            service.init();
            TestBed.inject(PrismNavigationService).select(comp);
            rendererService.inputValues.set({ value: date });
            TestBed.inject(ApplicationRef).tick();
            jest.advanceTimersByTime(250);

            expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null').inputs.DateField.values).toEqual({ value: { $prismDate: date.getTime() } });
        });
    });
});
