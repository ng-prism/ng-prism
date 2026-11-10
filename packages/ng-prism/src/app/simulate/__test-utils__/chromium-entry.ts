import { pseudoStateClass } from '../../pseudo/pseudo-selector.js';
import { PseudoStyleSheets } from '../../pseudo/pseudo-stylesheets.js';
import { declarationsOfStyle } from '../forced-values.js';
import { applyScopeRoot } from '../scope-root.js';
import { SimulationStyles } from '../simulation-styles.js';

/** The part of the simulation the Chromium specs drive in a page, as the bundle puts it on `window.__prismSim`. */
export interface PrismSim {
    SimulationStyles: typeof SimulationStyles;
    applyScopeRoot: typeof applyScopeRoot;
    declarationsOfStyle: typeof declarationsOfStyle;
    PseudoStyleSheets: typeof PseudoStyleSheets;
    pseudoStateClass: typeof pseudoStateClass;
}

Object.assign(window, { __prismSim: { SimulationStyles, applyScopeRoot, declarationsOfStyle, PseudoStyleSheets, pseudoStateClass } satisfies PrismSim });
