import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ApplicationRef, signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { ShowcaseState } from '../../decorator/showcase.types.js';
import type { RuntimeComponent } from '../../plugin/plugin.types.js';
import { CANVAS_BGS } from '../../shared/canvas-bg.type.js';
import { PrismCanvasService } from '../services/prism-canvas.service.js';
import { PrismMobileLayoutService } from '../services/prism-mobile-layout.service.js';
import { PrismNavigationService } from '../services/prism-navigation.service.js';
import { PrismPseudoStateService } from '../services/prism-pseudo-state.service.js';
import { PrismRendererService } from '../services/prism-renderer.service.js';
import { PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { PrismCanvasToolbarComponent } from './prism-canvas-toolbar.component.js';

/**
 * Classic-decorator doubles for the rail's children, whose signal inputs the
 * JIT compiler of these specs cannot see (see `project_jit_test_limitation`
 * and `prism-canvas-pin-row.component.browser.spec.ts`). `jest.mock` is hoisted
 * above the imports, so the factories `require` what they need.
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

jest.mock('../shared/prism-icon-button.component.js', () => {
    const { Component, Input } = require('@angular/core') as typeof import('@angular/core');

    @Component({ selector: 'button[prismIconButton]', standalone: true, template: '<ng-content />' })
    class MockPrismIconButtonComponent {
        @Input() size = 'md';
        @Input() pressed: boolean | null = null;
    }

    return { PrismIconButtonComponent: MockPrismIconButtonComponent };
});

/** Finds a `templateUrl`/`styleUrl` anywhere under `src/app`, since each component resolves it against its own folder. */
async function readAppResource(url: string): Promise<string> {
    const name = basename(url);
    const appRoot = join(__dirname, '..');
    const entries = await readdir(appRoot, { recursive: true });
    const match = entries.find((entry) => basename(entry) === name);

    if (!match) throw new Error(`Resource not found under ${appRoot}: ${url}`);
    return readFile(join(appRoot, match), 'utf-8');
}

const STATES: ShowcaseState[] = [
    { name: 'Hover', pseudo: { hover: true } },
    { name: 'Focus visible', pseudo: { 'focus-visible': '.x' } }
];

const COMP: RuntimeComponent = {
    type: class {} as unknown as RuntimeComponent['type'],
    meta: {
        className: 'Comp',
        filePath: '/test.ts',
        showcaseConfig: { title: 'Test', variants: [{ name: 'Primary' }, { name: 'Secondary' }], states: STATES },
        inputs: [],
        outputs: [],
        componentMeta: { selector: 'test', standalone: true, isDirective: false }
    }
};

describe('PrismCanvasToolbarComponent: tools menu trigger', () => {
    let fixture: ComponentFixture<PrismCanvasToolbarComponent>;
    let renderer: PrismRendererService;
    let pseudoState: PrismPseudoStateService;

    beforeEach(async () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [{ provide: PRISM_MANIFEST, useValue: { components: [COMP] } }] });
        await resolveComponentResources(readAppResource);
        renderer = TestBed.inject(PrismRendererService);
        pseudoState = TestBed.inject(PrismPseudoStateService);
        TestBed.inject(PrismNavigationService).select(COMP);
        TestBed.inject(ApplicationRef).tick();

        fixture = TestBed.createComponent(PrismCanvasToolbarComponent);
        fixture.detectChanges();
    });

    /** Runs the effects too: the pseudo-state service clears its toggles in one. */
    function settle(): void {
        TestBed.inject(ApplicationRef).tick();
        fixture.detectChanges();
    }

    function trigger(): HTMLButtonElement {
        return fixture.nativeElement.querySelector('button[popovertarget="prism-tools"]');
    }

    function dot(): Element | null {
        return trigger().querySelector('.prism-toolrail__dot');
    }

    it('carries no indicator while the menu holds nothing', () => {
        expect(dot()).toBeNull();
        expect(trigger().getAttribute('aria-label')).toBe('Canvas, state, zoom and width');
        expect(trigger().getAttribute('title')).toBe('Canvas, state, zoom and width');
    });

    it('marks an active state, and names it', () => {
        renderer.selectState(1);
        settle();

        expect(dot()).not.toBeNull();
        expect(trigger().getAttribute('aria-label')).toBe('Canvas, state, zoom and width (Focus visible active)');
    });

    it('marks a forced pseudo state', () => {
        pseudoState.toggle('hover');
        settle();

        expect(dot()).not.toBeNull();
        expect(trigger().getAttribute('aria-label')).toBe('Canvas, state, zoom and width (pseudo states toggled)');
    });

    it('names both when a state and a toggle are set', () => {
        renderer.selectState(0);
        settle();
        pseudoState.toggle('active');
        settle();

        expect(trigger().getAttribute('aria-label')).toBe('Canvas, state, zoom and width (Hover active, pseudo states toggled)');
    });

    it('drops the indicator when the variant change clears the state and the toggles', () => {
        renderer.selectState(1);
        settle();
        pseudoState.toggle('hover');
        settle();
        expect(dot()).not.toBeNull();

        renderer.selectVariant(1);
        settle();

        expect(dot()).toBeNull();
        expect(trigger().getAttribute('aria-label')).toBe('Canvas, state, zoom and width');
    });
});

describe('PrismCanvasToolbarComponent: phone layout', () => {
    const DESKTOP_TOOLS = ['Guides', 'Rulers', 'Viewport width', 'Measure'];

    async function render(mobile: boolean, rulers = false): Promise<ComponentFixture<PrismCanvasToolbarComponent>> {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                { provide: PRISM_MANIFEST, useValue: { components: [COMP] } },
                { provide: PrismMobileLayoutService, useValue: { mobile: signal(mobile) } }
            ]
        });
        await resolveComponentResources(readAppResource);
        TestBed.inject(PrismNavigationService).select(COMP);
        TestBed.inject(PrismCanvasService).rulers.set(rulers);
        TestBed.inject(ApplicationRef).tick();

        const fixture = TestBed.createComponent(PrismCanvasToolbarComponent);

        fixture.detectChanges();
        return fixture;
    }

    function labels(fixture: ComponentFixture<PrismCanvasToolbarComponent>): string[] {
        return [...fixture.nativeElement.querySelectorAll('.prism-toolrail button')].map((b: Element) => b.getAttribute('aria-label') ?? '');
    }

    function sections(fixture: ComponentFixture<PrismCanvasToolbarComponent>): string[] {
        return [...fixture.nativeElement.querySelectorAll('.prism-toolmenu__lbl')].map((l: Element) => l.textContent?.trim() ?? '');
    }

    afterEach(() => localStorage.clear());

    it('keeps every tool on the desktop layout', async () => {
        const fixture = await render(false);

        expect(labels(fixture)).toEqual(expect.arrayContaining([...DESKTOP_TOOLS, 'Angular template']));
        expect(sections(fixture)).toEqual(expect.arrayContaining(['Background', 'State', 'Zoom', 'Width']));
    });

    it('leaves the measuring tools and the width out on a phone', async () => {
        const fixture = await render(true);

        for (const tool of DESKTOP_TOOLS) expect(labels(fixture)).not.toContain(tool);
        expect(labels(fixture)).toContain('Angular template');
        expect(sections(fixture)).toEqual(expect.arrayContaining(['Background', 'State', 'Zoom']));
        expect(sections(fixture)).not.toContain('Width');
        expect(fixture.nativeElement.querySelector('#prism-tools .bar')).toBeNull();
    });

    it('does not make room for rulers a desktop session switched on', async () => {
        const fixture = await render(true, true);

        expect(fixture.nativeElement.querySelector('.prism-toolrail').classList.contains('has-rulers')).toBe(false);
    });
});

describe('PrismCanvasToolbarComponent: tools menu', () => {
    /** COMP, but its first variant was designed against the dark ground. */
    const DARK_COMP: RuntimeComponent = {
        ...COMP,
        meta: { ...COMP.meta, showcaseConfig: { ...COMP.meta.showcaseConfig, variants: [{ name: 'Primary', bg: 'dark' }, { name: 'Secondary' }] } }
    };

    let fixture: ComponentFixture<PrismCanvasToolbarComponent>;

    async function render(comp: RuntimeComponent = COMP): Promise<void> {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [{ provide: PRISM_MANIFEST, useValue: { components: [comp] } }] });
        await resolveComponentResources(readAppResource);
        TestBed.inject(PrismNavigationService).select(comp);
        TestBed.inject(ApplicationRef).tick();

        fixture = TestBed.createComponent(PrismCanvasToolbarComponent);
        fixture.detectChanges();
    }

    function settle(): void {
        TestBed.inject(ApplicationRef).tick();
        fixture.detectChanges();
    }

    function menu(): HTMLElement {
        return fixture.nativeElement.querySelector('#prism-tools');
    }

    function choice(value: string): HTMLButtonElement {
        const button = menu().querySelector<HTMLButtonElement>(`[data-choice="${value}"]`);

        if (!button) throw new Error(`No choice "${value}" in the tools menu`);
        return button;
    }

    /** A segment by its visible label; the width bar above the number adds no text. */
    function segment(label: string): HTMLButtonElement {
        const button = [...menu().querySelectorAll<HTMLButtonElement>('.seg button')].find((b) => b.textContent?.trim() === label);

        if (!button) throw new Error(`No segment "${label}" in the tools menu`);
        return button;
    }

    function pressedSegments(): string[] {
        return [...menu().querySelectorAll('.seg button[aria-pressed="true"]')].map((b) => b.textContent?.trim() ?? '');
    }

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('shows each background as a swatch painted by the stage styles', async () => {
        await render();

        const swatch = menu().querySelector('[data-choice="light"] .swatch')!;

        expect(swatch.getAttribute('data-bg')).toBe('light');
        for (const bg of CANVAS_BGS) {
            expect(choice(bg).querySelector('.swatch')?.getAttribute('data-bg')).toBe(bg);
            expect(choice(bg).textContent?.trim()).toBe(bg.charAt(0).toUpperCase() + bg.slice(1));
        }
    });

    it('keeps is-on and is-rec on background chips', async () => {
        await render(DARK_COMP);

        expect(choice('dark').classList).toContain('is-rec');
        expect(choice('dark').classList).toContain('is-on');
        expect(choice('dark').getAttribute('aria-pressed')).toBe('true');
        expect(choice('dark').getAttribute('title')).toBe('Recommended background for this variant');

        choice('light').click();
        settle();

        expect(choice('light').classList).toContain('is-on');
        expect(choice('light').getAttribute('aria-pressed')).toBe('true');
        expect(choice('dark').classList).not.toContain('is-on');
        expect(choice('dark').classList).toContain('is-rec');
        expect(choice('light').classList).not.toContain('is-rec');
    });

    it('zoom and width are segmented controls with aria-pressed', async () => {
        await render();

        expect(pressedSegments()).toEqual(['100%', 'Auto']);

        segment('150%').click();
        segment('390').click();
        settle();

        expect(pressedSegments()).toEqual(['150%', '390']);
        expect(TestBed.inject(PrismCanvasService).zoom()).toBe(1.5);
        expect(TestBed.inject(PrismCanvasService).viewportWidth()).toBe(390);
    });

    it('gives each width a bar proportional to it', async () => {
        await render();

        const bar = (label: string): HTMLElement => segment(label).querySelector<HTMLElement>('.bar')!;

        expect(bar('320').style.width).toBe('9px');
        expect(bar('768').style.width).toBe('23px');
        expect(bar('1024').style.width).toBe('30px');
        expect(bar('Auto').classList).toContain('bar--auto');
        expect(bar('320').classList).not.toContain('bar--auto');
    });

    it('gives each pseudo state its icon', async () => {
        await render();

        const icons: Record<string, string> = {
            hover: 'mouse-pointer',
            active: 'mouse-pointer-click',
            focus: 'scan',
            'focus-visible': 'keyboard',
            'focus-within': 'box-select'
        };

        for (const [state, icon] of Object.entries(icons)) {
            const glyph = fixture.debugElement.query(By.css(`[data-choice="${state}"] prism-icon`));

            expect(glyph?.componentInstance.name).toBe(icon);
            expect(choice(state).textContent?.trim()).toBe(`:${state}`);
        }
    });

    it('lists the declared states before the pseudo states, as recommendations', async () => {
        await render();

        const bgs = new Set<string>(CANVAS_BGS);
        const states = [...menu().querySelectorAll<HTMLButtonElement>('.chip')].filter((b) => !bgs.has(b.dataset['choice'] ?? ''));

        expect(states.slice(0, 3).map((b) => b.textContent?.trim())).toEqual(['Hover', 'Focus visible', ':hover']);
        expect(states[0].classList).toContain('is-rec');
        expect(states[0].getAttribute('aria-pressed')).toBe('false');
    });
});
