import { effect, inject, Injectable, Injector } from '@angular/core';
import type { NgPrismConfig } from '../../plugin/plugin.types.js';
import { A11yPanelStateService, type A11ySubTab } from '../panels/a11y/a11y-panel-state.service.js';
import { type A11yPerspectiveMode, A11yPerspectiveService } from '../panels/a11y/a11y-perspective.service.js';
import { hasSimulationParams, parseSimulation, type Simulation } from '../simulate/simulation.js';
import { PRISM_CONFIG } from '../tokens/prism-tokens.js';
import { parsePersisted, stringifyPersisted } from './persisted-values.js';
import { PrismCaptureService } from './prism-capture.service.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { PrismRendererService } from './prism-renderer.service.js';
import { PrismSimulationService } from './prism-simulation.service.js';

const STORAGE_KEY = 'ng-prism:state';
const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 200;

interface PrismPersistedState {
    version: 1;
    inputs: Record<string, { variantIndex: number; values: Record<string, unknown> }>;
    a11y?: {
        activeTab?: A11ySubTab;
        perspective?: A11yPerspectiveMode;
    };
    /** What the canvas simulates. Absent in a session an earlier version wrote. */
    simulation?: Simulation;
}

@Injectable({ providedIn: 'root' })
export class PrismPersistenceService {
    private readonly config = inject<NgPrismConfig>(PRISM_CONFIG, { optional: true }) ?? {};
    private readonly capture = inject(PrismCaptureService);
    private readonly navigationService = inject(PrismNavigationService);
    private readonly rendererService = inject(PrismRendererService);
    private readonly a11yPanelState = inject(A11yPanelStateService);
    private readonly a11yPerspective = inject(A11yPerspectiveService);
    private readonly simulationService = inject(PrismSimulationService);
    private readonly injector = inject(Injector);

    private suppressSync = false;
    private writeTimer: ReturnType<typeof setTimeout> | null = null;
    private lastSerialized: string | null = null;

    init(): void {
        if (this.config.persistState === false) return;
        // Capture mode must render a variant as the manifest declares it;
        // restoring a previous session's control values would silently change what
        // an external screenshot tool captures.
        if (this.capture.active()) return;
        const { raw } = this.restoreFromStorage();

        if (raw !== null) this.lastSerialized = raw;
        this.setupSyncEffect();
    }

    private restoreFromStorage(): { raw: string | null } {
        let parsed: PrismPersistedState | null = null;
        let raw: string | null = null;

        try {
            raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) parsed = parsePersisted(raw) as PrismPersistedState;
        } catch {
            parsed = null;
            raw = null;
        }
        if (!parsed || parsed.version !== SCHEMA_VERSION) return { raw: null };

        this.suppressSync = true;
        try {
            const a11yTabs: A11ySubTab[] = ['violations', 'keyboard', 'tree', 'sr'];

            if (parsed.a11y?.activeTab && a11yTabs.includes(parsed.a11y.activeTab)) {
                this.a11yPanelState.activeTab.set(parsed.a11y.activeTab);
            }
            if (parsed.a11y?.perspective === 'visual' || parsed.a11y?.perspective === 'screen-reader') {
                this.a11yPerspective.mode.set(parsed.a11y.perspective);
            }
            // A link that names the simulation, valid or not, is the reader's choice of the moment: it wins.
            if (parsed.simulation !== undefined && !hasSimulationParams(new URLSearchParams(window.location.search))) {
                this.simulationService.set(parseSimulation(parsed.simulation));
            }

            const activeComp = this.navigationService.activeComponent();

            if (activeComp && parsed.inputs) {
                const bucket = parsed.inputs[activeComp.meta.className];

                if (bucket && bucket.variantIndex === this.rendererService.activeVariantIndex()) {
                    const validKeys = new Set(activeComp.meta.inputs.map((i) => i.name));
                    const filtered: Record<string, unknown> = {};

                    for (const [k, v] of Object.entries(bucket.values)) {
                        if (validKeys.has(k) || k === '__prismContent__') filtered[k] = v;
                    }
                    if (Object.keys(filtered).length > 0) {
                        this.rendererService.inputValues.set({
                            ...this.rendererService.inputValues(),
                            ...filtered
                        });
                    }
                }
            }
        } finally {
            this.suppressSync = false;
        }
        return { raw };
    }

    private setupSyncEffect(): void {
        effect(
            () => {
                this.navigationService.activeComponent();
                this.rendererService.activeVariantIndex();
                this.rendererService.inputValues();
                this.a11yPanelState.activeTab();
                this.a11yPerspective.mode();
                this.simulationService.state();

                if (this.suppressSync) return;
                this.writeDebounced();
            },
            { injector: this.injector }
        );
    }

    private writeDebounced(): void {
        if (this.writeTimer) clearTimeout(this.writeTimer);
        this.writeTimer = setTimeout(() => {
            this.writeTimer = null;
            const state = this.serialize();
            const next = stringifyPersisted(state);

            if (next === this.lastSerialized) return;
            try {
                sessionStorage.setItem(STORAGE_KEY, next);
                this.lastSerialized = next;
            } catch (err) {
                console.warn('[ng-prism] Failed to persist state:', err);
            }
        }, DEBOUNCE_MS);
    }

    private serialize(): PrismPersistedState {
        const activeComp = this.navigationService.activeComponent();
        const variantIndex = this.rendererService.activeVariantIndex();
        const values = this.rendererService.inputValues();

        let inputs: PrismPersistedState['inputs'] = {};

        if (this.lastSerialized) {
            try {
                const prev = parsePersisted(this.lastSerialized) as PrismPersistedState;

                if (prev.version === SCHEMA_VERSION) inputs = { ...prev.inputs };
            } catch {
                inputs = {};
            }
        }
        if (activeComp) {
            inputs[activeComp.meta.className] = {
                variantIndex,
                values: { ...values }
            };
        }

        return {
            version: SCHEMA_VERSION,
            inputs,
            a11y: {
                activeTab: this.a11yPanelState.activeTab(),
                perspective: this.a11yPerspective.mode()
            },
            simulation: this.simulationService.state()
        };
    }
}
