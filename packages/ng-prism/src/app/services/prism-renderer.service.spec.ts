import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { RuntimeComponent, RuntimeManifest } from '../../plugin/plugin.types.js';
import { COMPOSITION_SUBJECT_SLOT } from '../../shared/composition.js';
import { openInPlayground } from '../overview/open-in-playground.js';
import { PRISM_MANIFEST } from '../tokens/prism-tokens.js';
import { PrismNavigationService } from './prism-navigation.service.js';
import { computeVariantState, PrismRendererService } from './prism-renderer.service.js';

function createComponent(
    overrides: Partial<{
        inputs: RuntimeComponent['meta']['inputs'];
        variants: RuntimeComponent['meta']['showcaseConfig']['variants'];
        states: RuntimeComponent['meta']['showcaseConfig']['states'];
        isDirective: boolean;
        host: RuntimeComponent['meta']['showcaseConfig']['host'];
        composition: RuntimeComponent['meta']['composition'];
    }> = {}
): RuntimeComponent {
    const type = class {} as any;

    return {
        type,
        ...(overrides.composition && { composition: type }),
        meta: {
            className: 'Comp',
            filePath: '/test.ts',
            showcaseConfig: {
                title: 'Test',
                variants: overrides.variants,
                ...(overrides.states !== undefined && { states: overrides.states }),
                ...(overrides.host !== undefined && { host: overrides.host })
            },
            inputs: overrides.inputs ?? [],
            outputs: [],
            componentMeta: { selector: 'test', standalone: true, isDirective: overrides.isDirective ?? false },
            ...(overrides.composition && { composition: overrides.composition })
        }
    };
}

function setup(manifest: RuntimeManifest) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [{ provide: PRISM_MANIFEST, useValue: manifest }]
    });

    return { renderer: TestBed.inject(PrismRendererService), navigation: TestBed.inject(PrismNavigationService) };
}

/** Runs the root effects, as the change detection after a click does. */
function flush(): void {
    TestBed.inject(ApplicationRef).tick();
}

describe('PrismRendererService', () => {
    it('should have empty inputValues initially', () => {
        const { renderer } = setup({ components: [] });

        expect(renderer.inputValues()).toEqual({});
    });

    it('should update single input via updateInput()', () => {
        const { renderer } = setup({ components: [] });

        renderer.updateInput('label', 'World');
        expect(renderer.inputValues()).toEqual({ label: 'World' });
    });

    it('should merge inputs via updateInput()', () => {
        const { renderer } = setup({ components: [] });

        renderer.updateInput('a', 1);
        renderer.updateInput('b', 2);
        expect(renderer.inputValues()).toEqual({ a: 1, b: 2 });
    });

    it('should reset for component and apply defaults', () => {
        const comp = createComponent({
            inputs: [
                { name: 'label', type: 'string', defaultValue: 'Hello', required: false },
                { name: 'count', type: 'number', defaultValue: 42, required: false }
            ]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);
        renderer.resetForComponent(comp);

        expect(renderer.activeVariantIndex()).toBe(0);
        expect(renderer.inputValues()).toEqual({ label: 'Hello', count: 42 });
    });

    it('should apply variant inputs merged with defaults', () => {
        const comp = createComponent({
            inputs: [
                { name: 'label', type: 'string', defaultValue: 'Default', required: false },
                { name: 'disabled', type: 'boolean', defaultValue: false, required: false }
            ],
            variants: [{ name: 'Default' }, { name: 'Disabled', inputs: { disabled: true } }]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);
        renderer.selectVariant(1);

        expect(renderer.activeVariantIndex()).toBe(1);
        expect(renderer.inputValues()).toEqual({ label: 'Default', disabled: true });
    });

    it('should skip inputs without defaultValue', () => {
        const comp = createComponent({
            inputs: [
                { name: 'label', type: 'string', required: true },
                { name: 'count', type: 'number', defaultValue: 0, required: false }
            ]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);
        renderer.selectVariant(0);

        expect(renderer.inputValues()).toEqual({ count: 0 });
    });

    it('should reset variant-managed inputs when switching back', () => {
        const comp = createComponent({
            inputs: [
                { name: 'label', type: 'string', defaultValue: 'Default', required: false },
                { name: 'disabled', type: 'boolean', defaultValue: false, required: false }
            ],
            variants: [{ name: 'Default' }, { name: 'Disabled', inputs: { disabled: true } }]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);

        renderer.selectVariant(1);
        expect(renderer.inputValues()).toEqual({ label: 'Default', disabled: true });

        renderer.selectVariant(0);
        expect(renderer.inputValues()).toEqual({ label: 'Default', disabled: false });
    });

    it('should reset variant-managed inputs even without scanned defaultValue', () => {
        const comp = createComponent({
            inputs: [
                { name: 'variant', type: 'string', required: false },
                { name: 'disabled', type: 'boolean', required: false }
            ],
            variants: [
                { name: 'Default', inputs: { variant: 'filled' } },
                { name: 'Disabled', inputs: { variant: 'filled', disabled: true } }
            ]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);

        renderer.selectVariant(1);
        expect(renderer.inputValues()).toMatchObject({ disabled: true });

        renderer.selectVariant(0);
        expect(renderer.inputValues()['disabled']).toBeUndefined();
    });

    it('should filter out unknown variant inputs and warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const comp = createComponent({
            inputs: [{ name: 'label', type: 'string', defaultValue: 'Default', required: false }],
            variants: [{ name: 'With Unknown', inputs: { label: 'Test', nonExistent: true } }]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);

        renderer.selectVariant(0);

        expect(renderer.inputValues()).toEqual({ label: 'Test' });
        expect(renderer.inputValues()['nonExistent']).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonExistent'));
        warnSpy.mockRestore();
    });

    it('should not reset required inputs', () => {
        const comp = createComponent({
            inputs: [{ name: 'title', type: 'string', required: true }],
            variants: [{ name: 'Default' }, { name: 'WithTitle', inputs: { title: 'Hello' } }]
        });
        const { renderer, navigation } = setup({ components: [comp] });

        navigation.select(comp);

        renderer.selectVariant(1);
        expect(renderer.inputValues()).toEqual({ title: 'Hello' });

        renderer.selectVariant(0);
        expect(renderer.inputValues()).toEqual({});
    });

    it('should reset variant index on resetForComponent', () => {
        const comp1 = createComponent({
            inputs: [{ name: 'a', type: 'string', defaultValue: 'x', required: false }],
            variants: [{ name: 'V1' }, { name: 'V2' }]
        });
        const comp2 = createComponent({
            inputs: [{ name: 'b', type: 'number', defaultValue: 0, required: false }]
        });
        const { renderer, navigation } = setup({ components: [comp1, comp2] });

        navigation.select(comp1);
        renderer.selectVariant(1);
        expect(renderer.activeVariantIndex()).toBe(1);

        navigation.select(comp2);
        renderer.resetForComponent(comp2);

        expect(renderer.activeVariantIndex()).toBe(0);
        expect(renderer.inputValues()).toEqual({ b: 0 });
    });

    describe('active state', () => {
        const STATES = [
            { name: 'Hover', pseudo: { hover: true } as const },
            { name: 'Focus', pseudo: { 'focus-visible': true } as const }
        ];

        it('starts without an active state, and selects one by its index', () => {
            const { renderer } = setup({ components: [] });

            expect(renderer.activeStateIndex()).toBeNull();

            renderer.selectState(1);
            expect(renderer.activeStateIndex()).toBe(1);

            renderer.selectState(null);
            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('clears the active state when the variant changes', () => {
            const comp = createComponent({ variants: [{ name: 'A' }, { name: 'B' }], states: STATES });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectState(1);
            renderer.selectVariant(1);

            expect(renderer.activeVariantIndex()).toBe(1);
            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('keeps a state selected after the variant', () => {
            const comp = createComponent({ variants: [{ name: 'A' }, { name: 'B' }], states: STATES });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectVariant(1);
            renderer.selectState(1);
            flush();

            expect(renderer.activeVariantIndex()).toBe(1);
            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('clears the active state when the component changes', () => {
            const first = createComponent({ states: STATES });
            const second = createComponent({ states: STATES });

            first.meta.className = 'First';
            second.meta.className = 'Second';
            const { renderer, navigation } = setup({ components: [first, second] });

            navigation.select(first);
            renderer.resetForComponent(first);
            renderer.selectState(0);
            navigation.select(second);
            renderer.resetForComponent(second);
            expect(renderer.activeStateIndex()).toBeNull();

            renderer.selectState(0);
            renderer.reconcileForComponent(first);
            expect(renderer.activeStateIndex()).toBeNull();
        });

        it('keeps a state index the component still has on a refresh', () => {
            const comp = createComponent({ states: STATES });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectState(1);
            renderer.reconcileForComponent(createComponent({ states: STATES }));

            expect(renderer.activeStateIndex()).toBe(1);
        });

        it('drops a state index the component no longer has', () => {
            const comp = createComponent({ states: STATES });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectState(1);
            renderer.reconcileForComponent(createComponent({ states: [STATES[0]] }));
            expect(renderer.activeStateIndex()).toBeNull();

            renderer.selectState(0);
            renderer.reconcileForComponent(createComponent());
            expect(renderer.activeStateIndex()).toBeNull();
        });
    });

    // The shell mounts `<prism-renderer>` in the Playground only. In the Overview, picking another component in the
    // sidebar keeps the view, so no renderer sees the switch; these tests never reconcile on navigation themselves.
    describe('component switch without a mounted renderer', () => {
        const STATES = [
            { name: 'Hover', pseudo: { hover: true } as const },
            { name: 'Focus', pseudo: { 'focus-visible': true } as const }
        ];

        function twoComponents() {
            const a = createComponent({
                variants: [{ name: 'A1' }, { name: 'A2' }],
                states: STATES,
                inputs: [{ name: 'label', type: 'string', defaultValue: 'A', required: false }]
            });
            const b = createComponent({
                variants: [{ name: 'B1', inputs: { title: 'B1' } }, { name: 'B2' }, { name: 'B3', inputs: { title: 'B3' } }],
                states: STATES,
                inputs: [{ name: 'title', type: 'string', required: false }]
            });

            a.meta.className = 'A';
            b.meta.className = 'B';
            return { a, b, ...setup({ components: [a, b] }) };
        }

        it('resets the variant and the state as soon as the component changes', () => {
            const { a, b, renderer, navigation } = twoComponents();

            navigation.select(a);
            renderer.reconcileForComponent(a); // the Playground's renderer mounts A
            flush();
            renderer.selectVariant(1);
            renderer.selectState(1);
            flush();

            // The Overview is open now, and the sidebar picks B.
            navigation.select(b);
            flush();

            expect(renderer.activeVariantIndex()).toBe(0);
            expect(renderer.activeStateIndex()).toBeNull();
            expect(renderer.inputValues()).toEqual({ title: 'B1' });
        });

        it('opens the Overview cell of a component picked in the Overview', () => {
            const { a, b, renderer, navigation } = twoComponents();
            const panels = { activeViewId: signal('renderer') };

            navigation.select(a);
            renderer.reconcileForComponent(a); // the Playground's renderer mounts A
            flush();
            renderer.selectState(1);
            panels.activeViewId.set('overview');
            flush();

            navigation.select(b);
            flush();
            openInPlayground(renderer, panels, 2, 0);
            flush();
            renderer.reconcileForComponent(b); // the Playground's renderer mounts B

            expect(panels.activeViewId()).toBe('renderer');
            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(0);
            expect(renderer.inputValues()).toEqual({ title: 'B3' });
        });

        it('keeps what a restore sets for the component it starts', () => {
            const { a, b, renderer, navigation } = twoComponents();

            navigation.select(a);
            flush();

            // What `PrismUrlStateService` does for `?component=B&variant=2&state=0`: it starts B before setting the cell.
            navigation.select(b);
            renderer.resetForComponent(b);
            renderer.selectVariant(2);
            renderer.selectState(0);
            flush();

            expect(renderer.activeVariantIndex()).toBe(2);
            expect(renderer.activeStateIndex()).toBe(0);
        });
    });

    describe('reconcileForComponent', () => {
        it('should behave like resetForComponent on first call', () => {
            const comp = createComponent({
                inputs: [{ name: 'label', type: 'string', defaultValue: 'Hello', required: false }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);

            renderer.reconcileForComponent(comp);

            expect(renderer.activeVariantIndex()).toBe(0);
            expect(renderer.inputValues()).toEqual({ label: 'Hello' });
        });

        it('should preserve variant index when className is unchanged', () => {
            const comp = createComponent({
                inputs: [{ name: 'label', type: 'string', defaultValue: 'Hi', required: false }],
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectVariant(2);

            const compRefreshed = createComponent({
                inputs: [{ name: 'label', type: 'string', defaultValue: 'Hi', required: false }],
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }]
            });

            renderer.reconcileForComponent(compRefreshed);

            expect(renderer.activeVariantIndex()).toBe(2);
        });

        it('should clamp variant index when variants list shrinks', () => {
            const comp = createComponent({
                inputs: [],
                variants: [{ name: 'V1' }, { name: 'V2' }, { name: 'V3' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.selectVariant(2);

            const compShrunk = createComponent({
                inputs: [],
                variants: [{ name: 'V1' }]
            });

            renderer.reconcileForComponent(compShrunk);

            expect(renderer.activeVariantIndex()).toBe(0);
        });

        it('should preserve input values for inputs that still exist', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'label', type: 'string', defaultValue: 'Default', required: false },
                    { name: 'count', type: 'number', defaultValue: 0, required: false }
                ]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.updateInput('label', 'User Value');
            renderer.updateInput('count', 42);

            renderer.reconcileForComponent(comp);

            expect(renderer.inputValues()['label']).toBe('User Value');
            expect(renderer.inputValues()['count']).toBe(42);
        });

        it('should discard values for inputs that no longer exist', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'label', type: 'string', required: false },
                    { name: 'obsolete', type: 'string', required: false }
                ]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.updateInput('label', 'Keep');
            renderer.updateInput('obsolete', 'Drop');

            const compReduced = createComponent({
                inputs: [{ name: 'label', type: 'string', required: false }]
            });

            renderer.reconcileForComponent(compReduced);

            expect(renderer.inputValues()['label']).toBe('Keep');
            expect(renderer.inputValues()['obsolete']).toBeUndefined();
        });

        it('should merge variant defaults for newly added inputs', () => {
            const comp = createComponent({
                inputs: [{ name: 'label', type: 'string', required: false }],
                variants: [{ name: 'V1', inputs: { label: 'Orig' } }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            const compExpanded = createComponent({
                inputs: [
                    { name: 'label', type: 'string', required: false },
                    { name: 'variant', type: 'string', required: false }
                ],
                variants: [{ name: 'V1', inputs: { label: 'Orig', variant: 'primary' } }]
            });

            renderer.reconcileForComponent(compExpanded);

            expect(renderer.inputValues()['label']).toBe('Orig');
            expect(renderer.inputValues()['variant']).toBe('primary');
        });

        it('should full-reset when className changes', () => {
            const first = createComponent({
                inputs: [{ name: 'label', type: 'string', defaultValue: 'A', required: false }]
            });

            first.meta.className = 'First';

            const { renderer, navigation } = setup({ components: [first] });

            navigation.select(first);
            renderer.resetForComponent(first);
            renderer.updateInput('label', 'Custom');

            const second = createComponent({
                inputs: [{ name: 'title', type: 'string', defaultValue: 'B', required: false }]
            });

            second.meta.className = 'Second';

            renderer.reconcileForComponent(second);

            expect(renderer.inputValues()['label']).toBeUndefined();
            expect(renderer.inputValues()['title']).toBe('B');
        });

        it('should preserve __prismContent__ on same-className reconcile', () => {
            const comp = createComponent({
                isDirective: true,
                host: '<button>',
                inputs: [{ name: 'tooltip', type: 'string', required: false }],
                variants: [{ name: 'V1', content: 'Hover me' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            expect(renderer.inputValues()['__prismContent__']).toBe('Hover me');

            renderer.reconcileForComponent(comp);

            expect(renderer.inputValues()['__prismContent__']).toBe('Hover me');
        });

        it('should preserve pre-set activeVariantIndex on initial mount (no prior className)', () => {
            const comp = createComponent({
                variants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
            });
            const { renderer } = setup({ components: [comp] });

            renderer.activeVariantIndex.set(2);
            renderer.reconcileForComponent(comp);

            expect(renderer.activeVariantIndex()).toBe(2);
        });

        it('should still reset to 0 on a real component switch', () => {
            const compA = createComponent({ variants: [{ name: 'A1' }, { name: 'A2' }] });
            const compB = createComponent({ variants: [{ name: 'B1' }] });

            compB.meta.className = 'Other';
            const { renderer } = setup({ components: [compA, compB] });

            renderer.activeVariantIndex.set(1);
            renderer.reconcileForComponent(compA);
            expect(renderer.activeVariantIndex()).toBe(1);

            renderer.reconcileForComponent(compB);
            expect(renderer.activeVariantIndex()).toBe(0);
        });
    });

    describe('dirtyInputCount + resetInputsToVariantDefaults', () => {
        it('should report 0 dirty inputs immediately after applying a variant', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'label', type: 'string', defaultValue: 'Hello', required: false },
                    { name: 'disabled', type: 'boolean', defaultValue: false, required: false }
                ]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            expect(renderer.dirtyInputCount()).toBe(0);
        });

        it('should count inputs that differ from variant defaults', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'label', type: 'string', defaultValue: 'Hello', required: false },
                    { name: 'disabled', type: 'boolean', defaultValue: false, required: false }
                ]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            renderer.updateInput('label', 'Changed');
            expect(renderer.dirtyInputCount()).toBe(1);

            renderer.updateInput('disabled', true);
            expect(renderer.dirtyInputCount()).toBe(2);
        });

        it('should restore variant defaults via resetInputsToVariantDefaults()', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'label', type: 'string', defaultValue: 'Hello', required: false },
                    { name: 'disabled', type: 'boolean', defaultValue: false, required: false }
                ],
                variants: [{ name: 'Default' }, { name: 'Disabled', inputs: { disabled: true } }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.selectVariant(1);

            renderer.updateInput('label', 'Custom');
            renderer.updateInput('disabled', false);
            expect(renderer.dirtyInputCount()).toBe(2);

            renderer.resetInputsToVariantDefaults();

            expect(renderer.dirtyInputCount()).toBe(0);
            expect(renderer.inputValues()).toEqual({ label: 'Hello', disabled: true });
            expect(renderer.activeVariantIndex()).toBe(1);
        });

        // A model() the component set, on an input no variant sets and without a default: it started out undefined,
        // so Reset has to say so to the component, not just drop the key.
        it('sets an input without a default that no variant sets back to undefined', () => {
            const comp = createComponent({
                inputs: [
                    { name: 'selected', type: 'string', required: false, model: true },
                    { name: 'options', type: 'array', defaultUnreadable: true, required: false }
                ],
                variants: [{ name: 'Default' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);
            renderer.updateInput('selected', 'b');
            renderer.updateInput('options', ['x']);
            expect(renderer.dirtyInputCount()).toBe(2);

            renderer.resetInputsToVariantDefaults();

            expect(renderer.inputValues()).toEqual({ selected: undefined });
            expect('selected' in renderer.inputValues()).toBe(true);
            expect(renderer.dirtyInputCount()).toBe(0);
        });

        it('should treat deep-equal objects as not dirty', () => {
            const comp = createComponent({
                inputs: [{ name: 'data', type: 'object', defaultValue: { a: 1 }, required: false }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            renderer.updateInput('data', { a: 1 });
            expect(renderer.dirtyInputCount()).toBe(0);

            renderer.updateInput('data', { a: 2 });
            expect(renderer.dirtyInputCount()).toBe(1);
        });

        it('should be 0 when no active component', () => {
            const { renderer } = setup({ components: [] });

            expect(renderer.dirtyInputCount()).toBe(0);
        });

        it('should be a no-op when no active component', () => {
            const { renderer } = setup({ components: [] });

            renderer.resetInputsToVariantDefaults();
            expect(renderer.inputValues()).toEqual({});
        });
    });

    describe('directive support', () => {
        it('should set __prismContent__ in inputValues for directive with string content', () => {
            const comp = createComponent({
                isDirective: true,
                host: '<button>',
                inputs: [{ name: 'color', type: 'string', defaultValue: 'red', required: false }],
                variants: [{ name: 'Default', inputs: { color: 'red' }, content: 'Hover me' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            expect(renderer.inputValues()['__prismContent__']).toBe('Hover me');
            expect(renderer.inputValues()['color']).toBe('red');
        });

        it('should set activeContent to undefined for directive variants', () => {
            const comp = createComponent({
                isDirective: true,
                host: '<span>',
                variants: [{ name: 'Default', content: 'Text' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            expect(renderer.activeContent()).toBeUndefined();
        });

        it('should not inject __prismContent__ when directive variant has no content', () => {
            const comp = createComponent({
                isDirective: true,
                host: '<div>',
                inputs: [{ name: 'size', type: 'number', defaultValue: 16, required: false }],
                variants: [{ name: 'Default', inputs: { size: 24 } }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            expect(renderer.inputValues()['__prismContent__']).toBeUndefined();
            expect(renderer.inputValues()['size']).toBe(24);
        });

        it('should set activeContent normally for non-directive components', () => {
            const comp = createComponent({
                isDirective: false,
                variants: [{ name: 'Default', content: 'Projected content' }]
            });
            const { renderer, navigation } = setup({ components: [comp] });

            navigation.select(comp);
            renderer.resetForComponent(comp);

            expect(renderer.activeContent()).toBe('Projected content');
            expect(renderer.inputValues()['__prismContent__']).toBeUndefined();
        });
    });

    describe('compositions', () => {
        const SLOT = COMPOSITION_SUBJECT_SLOT;

        /** A directive whose variant 0 renders its text content in a composition and variant 1 in the host wrapper. */
        function tooltip(): RuntimeComponent {
            return createComponent({
                isDirective: true,
                host: '<button>',
                inputs: [{ name: 'text', type: 'string', defaultValue: 'Tip', required: false }],
                variants: [
                    { name: 'Composed', content: 'Hover me' },
                    { name: 'Hosted', content: 'Hover me' }
                ],
                composition: { variantCases: [0, -1], cases: [{ template: `<button libTooltip${SLOT}>Hover me</button>`, unbound: [] }] }
            });
        }

        it('computes no content and no __prismContent__ for a composed variant', () => {
            const comp = tooltip();

            expect(computeVariantState(comp, 0)).toEqual({ values: { text: 'Tip' }, activeContent: undefined });
            expect(computeVariantState(comp, 0).values).not.toHaveProperty('__prismContent__');
            expect(computeVariantState(comp, 1).values['__prismContent__']).toBe('Hover me');
        });

        it('projects no content into a composed component variant, and keeps it for a plain one', () => {
            const comp = createComponent({
                variants: [
                    { name: 'Composed', content: '<b>Bold</b>' },
                    { name: 'Plain', content: '<b>Bold</b>' }
                ],
                composition: { variantCases: [0, -1], cases: [{ template: `<section><test${SLOT}></test></section>`, unbound: [] }] }
            });

            expect(computeVariantState(comp, 0).activeContent).toBeUndefined();
            expect(computeVariantState(comp, 1).activeContent).toBe('<b>Bold</b>');
        });

        it('adds no __prismContent__ and no content when it reconciles a composed variant', () => {
            const comp = tooltip();
            const { renderer } = setup({ components: [comp] });

            renderer.reconcileForComponent(comp);

            expect(renderer.inputValues()).not.toHaveProperty('__prismContent__');
            expect(renderer.activeContent()).toBeUndefined();
        });
    });
});
