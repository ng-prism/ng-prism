import { TestBed } from '@angular/core/testing';
import type { RuntimeComponent } from '../../plugin/plugin.types.js';
import type { CanvasBg } from '../../shared/canvas-bg.type.js';
import { DEFAULT_VARIANT_BG, resolveVariantBg } from '../../shared/variant-bg.js';
import { PRISM_CONFIG, PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { PrismCanvasService } from './prism-canvas.service.js';
import { PrismManifestService } from './prism-manifest.service.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { PrismRendererService } from './prism-renderer.service.js';
import { PrismSimulationService } from './prism-simulation.service.js';
import { PrismVariantBgService } from './prism-variant-bg.service.js';

function makeComponent(bg?: CanvasBg, variants?: { name: string; bg?: CanvasBg }[]): RuntimeComponent {
    return {
        type: class {} as unknown as RuntimeComponent['type'],
        meta: {
            className: 'TestComp',
            filePath: '',
            showcaseConfig: { title: 'Test', bg, variants },
            inputs: [],
            outputs: [],
            componentMeta: { selector: 'test', standalone: true, isDirective: false }
        }
    };
}

function activate(manifestService: PrismManifestService, nav: PrismNavigationService, comp: RuntimeComponent): void {
    manifestService.updateManifest({ components: [comp], pages: [] });
    nav.activeItem.set({ kind: 'component', data: comp });
}

describe('PrismVariantBgService', () => {
    let canvas: PrismCanvasService;
    let nav: PrismNavigationService;
    let renderer: PrismRendererService;
    let manifestService: PrismManifestService;
    let service: PrismVariantBgService;

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } }]
        });
        canvas = TestBed.inject(PrismCanvasService);
        nav = TestBed.inject(PrismNavigationService);
        renderer = TestBed.inject(PrismRendererService);
        manifestService = TestBed.inject(PrismManifestService);
        canvas.setBg('dots');
        service = TestBed.inject(PrismVariantBgService);
    });

    it('returns null recommended when no bg is declared', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.recommended()).toBeNull();
        expect(service.effective()).toBe('dots');
    });

    it('returns component-level bg when no variant overrides', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        expect(service.recommended()).toBe('dark');
        expect(service.effective()).toBe('dark');
    });

    it('returns variant-level bg, overriding component-level', () => {
        activate(manifestService, nav, makeComponent('dark', [{ name: 'Light variant', bg: 'light' }]));
        renderer.activeVariantIndex.set(0);
        TestBed.flushEffects();
        expect(service.recommended()).toBe('light');
        expect(service.effective()).toBe('light');
    });

    it('respects override and leaves canvas.bg() untouched', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        service.setOverride('plain');
        expect(service.effective()).toBe('plain');
        expect(canvas.bg()).toBe('dots');
    });

    it('clears override on variant switch', () => {
        const comp = makeComponent(undefined, [
            { name: 'A', bg: 'dark' },
            { name: 'B', bg: 'light' }
        ]);

        activate(manifestService, nav, comp);
        renderer.activeVariantIndex.set(0);
        TestBed.flushEffects();
        service.setOverride('plain');
        expect(service.effective()).toBe('plain');

        renderer.activeVariantIndex.set(1);
        TestBed.flushEffects();
        expect(service.effective()).toBe('light');
    });

    it('clears override on component switch', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        service.setOverride('plain');

        activate(manifestService, nav, makeComponent('light'));
        TestBed.flushEffects();
        expect(service.effective()).toBe('light');
    });

    it('clearOverride() resets override to null', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        service.setOverride('plain');
        service.clearOverride();
        expect(service.effective()).toBe('dark');
    });

    it('isDeviating is true only when override differs from recommended', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();

        expect(service.isDeviating()).toBe(false);

        service.setOverride('dark');
        expect(service.isDeviating()).toBe(false);

        service.setOverride('light');
        expect(service.isDeviating()).toBe(true);

        service.clearOverride();
        expect(service.isDeviating()).toBe(false);
    });
});

describe('PrismVariantBgService with an emulated color scheme', () => {
    let canvas: PrismCanvasService;
    let nav: PrismNavigationService;
    let manifestService: PrismManifestService;
    let sim: PrismSimulationService;
    let service: PrismVariantBgService;

    beforeEach(() => {
        // No `setBg()` here: a picked background is exactly what ends the
        // ground following the scheme, and the stored flag outlives the test.
        localStorage.clear();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } }]
        });
        canvas = TestBed.inject(PrismCanvasService);
        nav = TestBed.inject(PrismNavigationService);
        manifestService = TestBed.inject(PrismManifestService);
        sim = TestBed.inject(PrismSimulationService);
        service = TestBed.inject(PrismVariantBgService);
    });

    afterEach(() => localStorage.clear());

    it('follows the emulated scheme until the user picks', () => {
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('dark');
        canvas.setBg('dots');
        expect(service.effective()).toBe('dots');
    });

    it('follows a change of the scheme and goes back to the canvas background', () => {
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('dark');
        sim.set({ scheme: 'light' });
        expect(service.effective()).toBe('light');
        sim.set({ scheme: 'system' });
        expect(service.effective()).toBe('dots');
    });

    it('keeps a background that was picked before the scheme was emulated', () => {
        canvas.setBg('plain');
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('plain');
    });

    it('keeps what the variant recommends over the scheme', () => {
        activate(manifestService, nav, makeComponent('light'));
        TestBed.flushEffects();
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('light');
    });

    it('keeps the override over the scheme', () => {
        activate(manifestService, nav, makeComponent('light'));
        TestBed.flushEffects();
        service.setOverride('plain');
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('plain');
    });

    it('is not moved by simulations other than the scheme', () => {
        sim.set({ motion: 'reduce', forced: 'active', vision: 'blurred' });
        expect(service.effective()).toBe('dots');
    });
});

describe('PrismVariantBgService with showcaseDefaults', () => {
    let canvas: PrismCanvasService;
    let nav: PrismNavigationService;
    let manifestService: PrismManifestService;
    let sim: PrismSimulationService;
    let service: PrismVariantBgService;

    beforeEach(() => {
        // No `setBg()` here either: a picked background is what ends the fallback.
        localStorage.clear();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                { provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } },
                { provide: PRISM_CONFIG, useValue: { showcaseDefaults: { bg: 'light' } } }
            ]
        });
        canvas = TestBed.inject(PrismCanvasService);
        nav = TestBed.inject(PrismNavigationService);
        manifestService = TestBed.inject(PrismManifestService);
        sim = TestBed.inject(PrismSimulationService);
        service = TestBed.inject(PrismVariantBgService);
    });

    afterEach(() => localStorage.clear());

    it('paints the project background where nothing is declared', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.effective()).toBe('light');
    });

    it('does not recommend it: the pill and the menu mark only what a component declares', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.recommended()).toBeNull();
        expect(service.isDeviating()).toBe(false);
    });

    it('lets the background the user picked win over it, and the pick holds across variants', () => {
        activate(manifestService, nav, makeComponent(undefined, [{ name: 'A' }, { name: 'B' }]));
        TestBed.flushEffects();
        canvas.setBg('dots');
        expect(service.effective()).toBe('dots');

        TestBed.inject(PrismRendererService).activeVariantIndex.set(1);
        TestBed.flushEffects();
        expect(service.effective()).toBe('dots');
    });

    it('lets an emulated scheme win over it', () => {
        sim.set({ scheme: 'dark' });
        expect(service.effective()).toBe('dark');
        sim.set({ scheme: 'system' });
        expect(service.effective()).toBe('light');
    });

    it('lets a declared background win over it', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        expect(service.effective()).toBe('dark');
        expect(service.recommended()).toBe('dark');
    });

    it('lets the override win over it', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        service.setOverride('plain');
        expect(service.effective()).toBe('plain');
        expect(service.isDeviating()).toBe(false);
    });

    it('is not a pick: the canvas background stays what it was', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(canvas.bg()).toBe('dots');
        expect(canvas.bgChosen()).toBe(false);
    });

    it('ignores a value that is no canvas background', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                { provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } },
                { provide: PRISM_CONFIG, useValue: { showcaseDefaults: { bg: 'checker' } } }
            ]
        });
        manifestService = TestBed.inject(PrismManifestService);
        nav = TestBed.inject(PrismNavigationService);
        service = TestBed.inject(PrismVariantBgService);
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.effective()).toBe('dots');
    });
});

describe('PrismVariantBgService in capture mode', () => {
    let nav: PrismNavigationService;
    let manifestService: PrismManifestService;
    let service: PrismVariantBgService;

    beforeEach(() => {
        // The URL has to be set before the injector builds PrismCaptureService,
        // which reads the flag once at construction time.
        window.history.replaceState({}, '', '/?capture=1');
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } }]
        });
        nav = TestBed.inject(PrismNavigationService);
        manifestService = TestBed.inject(PrismManifestService);
        service = TestBed.inject(PrismVariantBgService);
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
        document.documentElement.removeAttribute('data-prism-capture');
        document.getElementById('ng-prism-capture-styles')?.remove();
    });

    it('falls back to the tooling default when no bg is declared', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        // Not the canvas default: `dots` resolves to `--prism-bg-surface`, a theme
        // token, so an undeclared component would be captured on whichever theme
        // the runner's browser started in. `DEFAULT_VARIANT_BG` is the same value
        // the discovery manifest reports, so the two cannot disagree.
        expect(service.effective()).toBe(DEFAULT_VARIANT_BG);
        expect(service.effective()).toBe('transparent');
    });

    it('matches what the discovery manifest reports for the variant', () => {
        // The manifest's promise and the painted surface are the same resolution,
        // reached through one shared function.
        const comp = makeComponent('dark', [{ name: 'A' }, { name: 'B', bg: 'plain' }]);

        activate(manifestService, nav, comp);

        for (const index of [0, 1]) {
            TestBed.inject(PrismRendererService).activeVariantIndex.set(index);
            TestBed.flushEffects();
            expect(service.effective()).toBe(resolveVariantBg(comp.meta.showcaseConfig, index));
        }
    });

    it('keeps a component-level bg', () => {
        // Not `transparent`: that is the default, so declaring it could
        // not tell "honoured the declaration" from "fell through to the default".
        activate(manifestService, nav, makeComponent('plain'));
        TestBed.flushEffects();
        expect(service.effective()).toBe('plain');
    });

    it('keeps a variant-level bg', () => {
        activate(manifestService, nav, makeComponent('dots', [{ name: 'Dark', bg: 'dark' }]));
        TestBed.flushEffects();
        expect(service.effective()).toBe('dark');
    });

    it('ignores a manual user override', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        service.setOverride('light');
        // Session UI state must not decide what a baseline looks like.
        expect(service.effective()).toBe('dark');
    });

    it('still reports the declared recommendation', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        expect(service.recommended()).toBe('dark');
    });

    it('ignores the emulated scheme', () => {
        const sim = TestBed.inject(PrismSimulationService);

        sim.set({ scheme: 'dark' });
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.effective()).toBe(DEFAULT_VARIANT_BG);
    });

    it('keeps a declared background under an emulated scheme', () => {
        const sim = TestBed.inject(PrismSimulationService);

        sim.set({ scheme: 'dark' });
        activate(manifestService, nav, makeComponent('plain'));
        TestBed.flushEffects();
        expect(service.effective()).toBe('plain');
    });
});

describe('PrismVariantBgService in capture mode with showcaseDefaults', () => {
    let nav: PrismNavigationService;
    let manifestService: PrismManifestService;
    let service: PrismVariantBgService;

    beforeEach(() => {
        window.history.replaceState({}, '', '/?capture=1');
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                { provide: PRISM_MANIFEST, useValue: { components: [], pages: [] } },
                { provide: PRISM_CONFIG, useValue: { showcaseDefaults: { bg: 'light' } } }
            ]
        });
        nav = TestBed.inject(PrismNavigationService);
        manifestService = TestBed.inject(PrismManifestService);
        service = TestBed.inject(PrismVariantBgService);
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
        document.documentElement.removeAttribute('data-prism-capture');
        document.getElementById('ng-prism-capture-styles')?.remove();
    });

    it('captures the project background where nothing is declared', () => {
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.effective()).toBe('light');
        expect(service.recommended()).toBeNull();
    });

    it('keeps a declared background', () => {
        activate(manifestService, nav, makeComponent('dark'));
        TestBed.flushEffects();
        expect(service.effective()).toBe('dark');
    });

    it('matches what the discovery manifest reports for the variant', () => {
        const comp = makeComponent(undefined, [{ name: 'A' }, { name: 'B', bg: 'plain' }]);

        activate(manifestService, nav, comp);

        for (const index of [0, 1]) {
            TestBed.inject(PrismRendererService).activeVariantIndex.set(index);
            TestBed.flushEffects();
            expect(service.effective()).toBe(resolveVariantBg(comp.meta.showcaseConfig, index, 'light'));
        }
    });

    it('ignores the emulated scheme', () => {
        TestBed.inject(PrismSimulationService).set({ scheme: 'dark' });
        activate(manifestService, nav, makeComponent());
        TestBed.flushEffects();
        expect(service.effective()).toBe('light');
    });
});
