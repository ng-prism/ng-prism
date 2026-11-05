import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { PrismVariantBgService } from '../services/prism-variant-bg.service.js';
import { PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { PrismSimPillComponent } from './prism-sim-pill.component.js';

/**
 * Swaps the real icon for a double with classic `@Input()`s: `name`/`size` are
 * signal inputs there, which this workspace's JIT test compilation cannot
 * render (see the pin row spec, which says why in full).
 */
jest.mock('../icons/prism-icon.component.js', () => {
    const { Component, Input } = require('@angular/core') as typeof import('@angular/core');

    @Component({ selector: 'prism-icon', standalone: true, template: '' })
    class MockPrismIconComponent {
        @Input() name = '';
        @Input() size = 16;
    }

    return { PrismIconComponent: MockPrismIconComponent };
});

describe('PrismSimPillComponent', () => {
    let sim: PrismSimulationService;

    /** Loads `templateUrl` and `styleUrl` off disk before TestBed sees the class (see the background pill spec). */
    beforeAll(async () => {
        await resolveComponentResources((url) => readFile(join(__dirname, url), 'utf8'));
    });

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [{ provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } }] });
        sim = TestBed.inject(PrismSimulationService);
    });

    function render() {
        const fixture = TestBed.createComponent(PrismSimPillComponent);

        fixture.detectChanges();
        return fixture;
    }

    const query = (fixture: ReturnType<typeof render>, selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

    it('renders nothing without a simulation', () => {
        const fixture = render();

        expect(fixture.nativeElement.children).toHaveLength(0);
    });

    it('lists the active conditions and resets only the simulation', () => {
        sim.set({ motion: 'reduce', vision: 'deuteranopia' });

        const fixture = render();

        expect(query(fixture, '.label')?.textContent).toBe('Reduced motion · Deuteranopia');

        query(fixture, 'button.reset')?.click();
        fixture.detectChanges();

        expect(sim.active()).toBe(false);
        expect(fixture.nativeElement.children).toHaveLength(0);
    });

    it('follows the conditions as they change', () => {
        sim.set({ scheme: 'dark' });

        const fixture = render();

        expect(query(fixture, '.label')?.textContent).toBe('Dark scheme');

        sim.set({ forced: 'active' });
        fixture.detectChanges();

        expect(query(fixture, '.label')?.textContent).toBe('Dark scheme · Forced colors (approx.)');
    });

    it('announces the conditions politely and names the reset', () => {
        sim.set({ vision: 'blurred' });

        const fixture = render();
        const reset = query(fixture, 'button.reset');

        expect(query(fixture, '.label')?.getAttribute('role')).toBe('status');
        expect(reset?.getAttribute('aria-label')).toBe('Reset simulation');
        expect(reset?.getAttribute('title')).toBe('Reset the simulated conditions');
        expect(reset?.textContent?.trim()).toBe('Reset');
    });

    it('leaves a background override alone when it resets', () => {
        const variantBg = TestBed.inject(PrismVariantBgService);

        // The service clears the override once, on its first effect run, as the variant counts as changed.
        TestBed.tick();
        variantBg.setOverride('light');
        sim.set({ motion: 'reduce' });

        const fixture = render();

        query(fixture, 'button.reset')?.click();

        expect(sim.active()).toBe(false);
        expect(variantBg.override()).toBe('light');
    });
});
