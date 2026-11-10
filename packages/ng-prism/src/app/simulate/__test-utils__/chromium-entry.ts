import { applyScopeRoot } from '../scope-root.js';
import { SimulationStyles } from '../simulation-styles.js';

/** The part of the simulation the Chromium specs drive in a page, as the bundle puts it on `window.__prismSim`. */
export interface PrismSim {
    SimulationStyles: typeof SimulationStyles;
    applyScopeRoot: typeof applyScopeRoot;
}

Object.assign(window, { __prismSim: { SimulationStyles, applyScopeRoot } satisfies PrismSim });
