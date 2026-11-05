import { DestroyRef, effect, inject, type Signal, untracked } from '@angular/core';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { applyScopeRoot, type ScopeRootState } from './scope-root.js';

/**
 * Keeps the element `element` holds a scope root of the simulation, with
 * {@link PrismSimulationService.scopeRoot}: the host of the shown component in
 * the Playground or in an Overview cell, which a new render replaces.
 *
 * The element it leaves, for the next one or for none, gets back what it had,
 * and so does the last one when the calling component is destroyed. Only an
 * HTML element becomes a scope root: Angular creates a host in another
 * namespace only for an `svg:` or `math:` selector. Call it in an injection
 * context.
 */
export function keepScopeRoot(element: Signal<Element | null>): void {
    const sim = inject(PrismSimulationService);
    let held: HTMLElement | null = null;

    const hold = (next: HTMLElement | null, root: ScopeRootState | null): void => {
        const left = held;

        // Recorded first, so that a release reaches the element even after applying to it threw.
        held = next;
        if (left && left !== next) applyScopeRoot(left, null);
        if (next) applyScopeRoot(next, root);
    };

    effect(() => {
        const next = element();
        const root = sim.scopeRoot();

        untracked(() => hold(next instanceof HTMLElement ? next : null, root));
    });
    inject(DestroyRef).onDestroy(() => hold(null, null));
}
