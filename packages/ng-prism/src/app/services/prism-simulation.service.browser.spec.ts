import { TestBed } from '@angular/core/testing';
import type { NgPrismConfig } from '../../plugin/plugin.types.js';
import { DEFAULT_SIMULATION } from '../simulate/simulation.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { PrismSimulationService } from './prism-simulation.service.js';

const CONFIG: NgPrismConfig = {
    colorScheme: {
        dark: { class: 'tl-dark' },
        light: { attributes: { 'data-mode': 'light' } }
    }
};

function setSearch(search: string): void {
    window.history.replaceState({}, '', `/${search}`);
}

function setUp(config: NgPrismConfig = CONFIG): PrismSimulationService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PRISM_CONFIG, useValue: config }] });

    return TestBed.inject(PrismSimulationService);
}

describe('PrismSimulationService', () => {
    afterEach(() => {
        setSearch('');
        document.documentElement.removeAttribute('data-prism-capture');
        document.getElementById('ng-prism-capture-styles')?.remove();
    });

    it('simulates nothing at first', () => {
        const sim = setUp();

        expect(sim.state()).toEqual(DEFAULT_SIMULATION);
        expect(sim.active()).toBe(false);
        expect(sim.labels()).toEqual([]);
        expect(sim.emulated()).toEqual({});
        expect(sim.scopeRoot()).toBeNull();
    });

    it('reports labels and the scope root', () => {
        const sim = setUp();

        sim.set({ scheme: 'dark', vision: 'deuteranopia' });
        expect(sim.active()).toBe(true);
        expect(sim.labels()).toEqual(['Dark scheme', 'Deuteranopia']);
        expect(sim.scopeRoot()).toEqual({ colorScheme: 'dark', filter: 'url(#prism-vision-deuteranopia)', themeClass: 'tl-dark', themeAttributes: {} });
    });

    it('changes only the settings a patch names', () => {
        const sim = setUp();

        sim.set({ motion: 'reduce' });
        sim.set({ vision: 'blurred' });
        expect(sim.state()).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce', vision: 'blurred' });
    });

    it('derives what the engines, the ground and the audit need', () => {
        const sim = setUp();

        sim.set({ motion: 'reduce', scheme: 'light', forced: 'active' });
        expect(sim.emulated()).toEqual({ 'prefers-reduced-motion': 'reduce', 'prefers-color-scheme': 'light', 'forced-colors': 'active' });
        expect(sim.schemeGround()).toBe('light');
        expect(sim.forcedActive()).toBe(true);
        expect(sim.auditCondition()).toBe('Light scheme · Forced colors (approx.)');
    });

    it('puts the light hook on the scope root under a light scheme', () => {
        const sim = setUp();

        sim.set({ scheme: 'light' });
        expect(sim.scopeRoot()).toEqual({ colorScheme: 'light', filter: null, themeClass: null, themeAttributes: { 'data-mode': 'light' } });
    });

    it('sets neither a color scheme nor a theme hook while the scheme is the system one', () => {
        const sim = setUp();

        sim.set({ motion: 'reduce' });
        expect(sim.scopeRoot()).toEqual({ colorScheme: null, filter: null, themeClass: null, themeAttributes: {} });
    });

    it('forced colors pick the palette from the scheme', () => {
        const sim = setUp();

        sim.set({ forced: 'active' });
        expect(sim.scopeRoot()?.colorScheme).toBe('dark');
        // The palette is no scheme of the component's: the hook stays off.
        expect(sim.scopeRoot()?.themeClass).toBeNull();
        sim.set({ scheme: 'light' });
        expect(sim.scopeRoot()?.colorScheme).toBe('light');
    });

    it('emulates the scheme without a hook when the config has none', () => {
        const sim = setUp({});

        sim.set({ scheme: 'dark' });
        expect(sim.scopeRoot()).toEqual({ colorScheme: 'dark', filter: null, themeClass: null, themeAttributes: {} });
    });

    it('leaves out hook attributes a scope root cannot take, with one warning each', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const sim = setUp({
            colorScheme: {
                dark: { class: 'tl-dark', attributes: { 'data mode': 'dark', class: 'x', STYLE: 'color: red', 'data-prism-sim': 'no', 'data-mode': 'dark' } },
                light: { attributes: { 'data mode': 'light', 'data-mode': 'light' } }
            }
        });

        sim.set({ scheme: 'dark' });
        expect(sim.scopeRoot()?.themeAttributes).toEqual({ 'data-mode': 'dark' });
        sim.set({ scheme: 'light' });
        expect(sim.scopeRoot()?.themeAttributes).toEqual({ 'data-mode': 'light' });

        // `data mode` is in both schemes and warned about once.
        expect(warn.mock.calls.map(([message]) => message)).toEqual([
            '[ng-prism] colorScheme: the attribute "data mode" is left out, it is not a valid attribute name.',
            '[ng-prism] colorScheme: the attribute "class" is left out, name a theme class in `class` instead.',
            '[ng-prism] colorScheme: the attribute "STYLE" is left out, the simulation manages it itself.',
            '[ng-prism] colorScheme: the attribute "data-prism-sim" is left out, the simulation manages it itself.'
        ]);
        warn.mockRestore();
    });

    it('keeps the scope root and the emulation while a setting they do not depend on changes', () => {
        const sim = setUp();

        sim.set({ scheme: 'dark' });
        const emulated = sim.emulated();

        sim.set({ vision: 'blurred' });
        expect(sim.emulated()).toBe(emulated);

        const root = sim.scopeRoot();

        sim.set({ motion: 'reduce' });
        expect(sim.scopeRoot()).toBe(root);
    });

    it('simulates nothing in capture mode', () => {
        setSearch('?capture=1');
        const sim = setUp();

        sim.set({ motion: 'reduce', scheme: 'dark' });
        expect(sim.state()).toEqual(DEFAULT_SIMULATION);
        expect(sim.active()).toBe(false);
        expect(sim.labels()).toEqual([]);
        expect(sim.emulated()).toEqual({});
        expect(sim.schemeGround()).toBeNull();
        expect(sim.auditCondition()).toBeNull();
        expect(sim.scopeRoot()).toBeNull();
    });

    it('reset clears every setting', () => {
        const sim = setUp();

        sim.set({ motion: 'reduce', forced: 'active' });
        sim.reset();
        expect(sim.active()).toBe(false);
        expect(sim.state()).toEqual(DEFAULT_SIMULATION);
    });
});
