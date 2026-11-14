import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { keepScopeRoot } from './keep-scope-root.js';

function setUp(): { sim: PrismSimulationService; element: WritableSignal<Element | null>; context: EnvironmentInjector } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PRISM_CONFIG, useValue: { colorScheme: { dark: { class: 'tl-dark' } } } }] });

    const sim = TestBed.inject(PrismSimulationService);
    const element = signal<Element | null>(null);
    // A context of its own, so that a test can destroy it the way a component is destroyed.
    const context = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

    runInInjectionContext(context, () => keepScopeRoot(element));
    return { sim, element, context };
}

/** Whether `el` carries nothing of a scope root. */
function untouched(el: Element): boolean {
    return el.attributes.length === 0;
}

describe('keepScopeRoot', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('makes the element a scope root while something is simulated', () => {
        const { sim, element } = setUp();
        const host = document.createElement('lib-button');

        element.set(host);
        TestBed.tick();
        expect(untouched(host)).toBe(true);

        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(host.hasAttribute('data-prism-sim')).toBe(true);
        expect(host.style.colorScheme).toBe('dark');
        expect(host.classList.contains('tl-dark')).toBe(true);

        sim.reset();
        TestBed.tick();
        expect(untouched(host)).toBe(true);
    });

    it('releases the element a new render replaces, and the last one when it goes', () => {
        const { sim, element } = setUp();
        const first = document.createElement('lib-button');
        const second = document.createElement('lib-button');

        sim.set({ vision: 'blurred' });
        element.set(first);
        TestBed.tick();
        expect(first.style.filter).toBe('blur(1.5px)');

        element.set(second);
        TestBed.tick();
        expect(untouched(first)).toBe(true);
        expect(second.style.filter).toBe('blur(1.5px)');

        element.set(null);
        TestBed.tick();
        expect(untouched(second)).toBe(true);
    });

    it('releases the element when the component is destroyed', () => {
        const { sim, element, context } = setUp();
        const host = document.createElement('lib-button');

        sim.set({ forced: 'active' });
        element.set(host);
        TestBed.tick();
        expect(host.hasAttribute('data-prism-sim')).toBe(true);

        context.destroy();
        expect(untouched(host)).toBe(true);

        // Nothing follows the simulation any more.
        sim.set({ scheme: 'dark' });
        TestBed.tick();
        expect(untouched(host)).toBe(true);
    });

    it('leaves a host outside the HTML namespace alone', () => {
        const { sim, element } = setUp();
        const host = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        sim.set({ scheme: 'dark' });
        element.set(host);
        TestBed.tick();
        expect(untouched(host)).toBe(true);
    });
});
