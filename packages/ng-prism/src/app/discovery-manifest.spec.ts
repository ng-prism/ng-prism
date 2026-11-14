import type { Type } from '@angular/core';
import type { ShowcaseConfig } from '../decorator/showcase.types.js';
import type { RuntimePipe } from '../plugin/pipe.types.js';
import type { InputMeta, OutputMeta, RuntimeManifest, ScannedComponent } from '../plugin/plugin.types.js';
import type { RuntimeService } from '../plugin/service.types.js';
import { DEFAULT_VARIANT_BG } from '../shared/variant-bg.js';
import { buildDiscoveryManifest, serializableMeta } from './discovery-manifest.js';

function manifestOf(...components: Array<{ className: string; showcaseConfig: ShowcaseConfig }>): RuntimeManifest {
    return {
        components: components.map((c) => ({
            type: class {} as Type<unknown>,
            meta: {
                className: c.className,
                filePath: `src/${c.className}.ts`,
                showcaseConfig: c.showcaseConfig,
                inputs: [],
                outputs: [],
                componentMeta: {
                    selector: 'x',
                    standalone: true,
                    isDirective: false
                }
            }
        }))
    };
}

function scannedPart(className: string, title: string, overrides: Partial<ScannedComponent> = {}): ScannedComponent {
    return {
        className,
        filePath: `src/${className}.ts`,
        showcaseConfig: { title, partOf: 'x' },
        inputs: [],
        outputs: [],
        componentMeta: { selector: 'x', standalone: true, isDirective: false },
        ...overrides
    };
}

describe('serializableMeta', () => {
    it('returns undefined for absent meta', () => {
        expect(serializableMeta(undefined)).toBeUndefined();
    });

    it('returns undefined for empty meta instead of an empty object', () => {
        expect(serializableMeta({})).toBeUndefined();
    });

    it('keeps primitives', () => {
        expect(serializableMeta({ a: 'x', b: 1, c: true, d: null })).toEqual({
            a: 'x',
            b: 1,
            c: true,
            d: null
        });
    });

    it('keeps nested plain objects and arrays', () => {
        expect(serializableMeta({ vrt: { skip: true, tags: ['a', 'b'] } })).toEqual({
            vrt: { skip: true, tags: ['a', 'b'] }
        });
    });

    it('drops functions', () => {
        expect(serializableMeta({ keep: 1, fn: () => 0 })).toEqual({ keep: 1 });
    });

    it('drops class instances, so an Angular type can never reach the global', () => {
        class SomeComponent {}
        expect(
            serializableMeta({
                keep: 1,
                component: SomeComponent,
                instance: new SomeComponent()
            })
        ).toEqual({ keep: 1 });
    });

    it('drops non-finite numbers, which JSON cannot represent', () => {
        expect(serializableMeta({ keep: 1, nan: NaN, inf: Infinity })).toEqual({
            keep: 1
        });
    });

    it('drops symbols and undefined values', () => {
        expect(serializableMeta({ keep: 1, sym: Symbol('s'), nope: undefined })).toEqual({ keep: 1 });
    });

    it('breaks cycles instead of throwing', () => {
        const cyclic: Record<string, unknown> = { keep: 1 };

        cyclic['self'] = cyclic;
        expect(() => serializableMeta(cyclic)).not.toThrow();
        expect(serializableMeta(cyclic)).toEqual({ keep: 1 });
    });

    it('nulls unrepresentable array entries so indices stay stable', () => {
        expect(serializableMeta({ list: ['a', () => 0, 'c'] })).toEqual({
            list: ['a', null, 'c']
        });
    });

    it('survives a structured clone, which is what the tooling bridge does', () => {
        class SomeComponent {}
        const cyclic: Record<string, unknown> = { component: SomeComponent };

        cyclic['self'] = cyclic;
        const sanitized = serializableMeta({ ...cyclic, figma: 'https://x', n: 1 });

        expect(() => structuredClone(sanitized)).not.toThrow();
    });

    it('does not mutate the input', () => {
        const input = { keep: 1, fn: () => 0 };

        serializableMeta(input);
        expect(typeof input.fn).toBe('function');
    });
});

describe('buildDiscoveryManifest', () => {
    it('leaves services out of the discovery manifest', () => {
        const service: RuntimeService = {
            meta: {
                className: 'ToastService',
                filePath: 'src/toast.service.ts',
                showcaseConfig: { title: 'Toast Service' },
                provision: 'auto',
                api: { tags: {}, properties: [], methods: [], setup: [], types: [] }
            }
        };
        const result = buildDiscoveryManifest({ components: [], services: [service] });

        expect(result.components).toEqual([]);
        expect(result).not.toHaveProperty('services');
    });

    it('leaves pipes out of the discovery manifest', () => {
        const pipe: RuntimePipe = {
            meta: {
                className: 'TimeAgoPipe',
                filePath: 'src/time-ago.pipe.ts',
                showcaseConfig: { title: 'Time ago' },
                pipeName: 'timeAgo',
                pure: true,
                api: { tags: {}, transform: [], setup: [], types: [] }
            }
        };
        const result = buildDiscoveryManifest({ components: [], pipes: [pipe] });

        expect(result.components).toEqual([]);
        expect(result).not.toHaveProperty('pipes');
    });

    it('exposes className, title and variant indices', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    variants: [{ name: 'Primary' }, { name: 'Secondary' }]
                }
            })
        );

        expect(result.components[0]).toEqual({
            className: 'ButtonComponent',
            title: 'Button',
            variants: [
                { name: 'Primary', index: 0, bg: 'transparent' },
                { name: 'Secondary', index: 1, bg: 'transparent' }
            ]
        });
    });

    it('reports a single Default variant when none are declared', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'IconComponent',
                showcaseConfig: { title: 'Icon' }
            })
        );

        expect(result.components[0].variants).toEqual([{ name: 'Default', index: 0, bg: 'transparent' }]);
    });

    it('reports the Default variant for an empty variants array too', () => {
        // The renderer treats `[]` the same as `undefined` (it still instantiates
        // the component at index 0), so a runner must not be told there is nothing
        // to capture.
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'IconComponent',
                showcaseConfig: { title: 'Icon', variants: [] }
            })
        );

        expect(result.components[0].variants).toEqual([{ name: 'Default', index: 0, bg: 'transparent' }]);
    });

    it('reports the background every variant renders on', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    bg: 'dark',
                    variants: [{ name: 'Filled' }, { name: 'Outlined', bg: 'light' }]
                }
            })
        );

        // Inherited from the component, then overridden by the variant. A runner
        // reads one field instead of reimplementing the fallback chain.
        expect(result.components[0].variants).toEqual([
            { name: 'Filled', index: 0, bg: 'dark' },
            { name: 'Outlined', index: 1, bg: 'light' }
        ]);
    });

    it('reports the default background when nothing declares one', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: { title: 'Button', variants: [{ name: 'Filled' }] }
            })
        );

        expect(result.components[0].variants[0].bg).toBe(DEFAULT_VARIANT_BG);
    });

    describe('with a project fallback', () => {
        it('reports it for a variant that declares no bg, and keeps the declared ones', () => {
            const result = buildDiscoveryManifest(
                manifestOf(
                    {
                        className: 'ButtonComponent',
                        showcaseConfig: { title: 'Button', variants: [{ name: 'Filled' }, { name: 'Outlined', bg: 'dark' }] }
                    },
                    { className: 'CardComponent', showcaseConfig: { title: 'Card', bg: 'plain', variants: [{ name: 'Default' }] } }
                ),
                'light'
            );

            expect(result.components[0].variants).toEqual([
                { name: 'Filled', index: 0, bg: 'light' },
                { name: 'Outlined', index: 1, bg: 'dark' }
            ]);
            expect(result.components[1].variants).toEqual([{ name: 'Default', index: 0, bg: 'plain' }]);
        });

        it('reports it for the synthetic Default variant of a component without variants', () => {
            const result = buildDiscoveryManifest(manifestOf({ className: 'IconComponent', showcaseConfig: { title: 'Icon' } }), 'light');

            expect(result.components[0].variants).toEqual([{ name: 'Default', index: 0, bg: 'light' }]);
        });

        it('reports transparent as before without one, and for null', () => {
            const manifest = manifestOf({ className: 'IconComponent', showcaseConfig: { title: 'Icon' } });

            expect(buildDiscoveryManifest(manifest).components[0].variants[0].bg).toBe('transparent');
            expect(buildDiscoveryManifest(manifest, null).components[0].variants[0].bg).toBe('transparent');
        });
    });

    it('gives the synthetic Default variant the component background', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'IconComponent',
                showcaseConfig: { title: 'Icon', bg: 'dark' }
            })
        );

        expect(result.components[0].variants).toEqual([{ name: 'Default', index: 0, bg: 'dark' }]);
    });

    it('does not put bg on the component level', () => {
        // One resolved value per variant is the whole contract. A second,
        // component-level field would only invite a consumer to read the wrong one.
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: { title: 'Button', bg: 'dark' }
            })
        );

        expect('bg' in result.components[0]).toBe(false);
    });

    it('exposes variant meta, so a tool can opt a variant out', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'TooltipDirective',
                showcaseConfig: {
                    title: 'Tooltip',
                    variants: [{ name: 'Top', meta: { vrt: { skip: true } } }, { name: 'Disabled' }]
                }
            })
        );

        expect(result.components[0].variants[0].meta).toEqual({
            vrt: { skip: true }
        });
        expect(result.components[0].variants[1].meta).toBeUndefined();
    });

    it('reports the pseudo states a variant forces, and nothing for one that forces none', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    variants: [{ name: 'Filled' }, { name: 'Focused', pseudo: { 'focus-visible': '.btn', hover: true } }, { name: 'Empty', pseudo: {} }]
                }
            })
        );
        const [filled, focused, empty] = result.components[0].variants;

        expect(focused.pseudo).toEqual({ 'focus-visible': '.btn', hover: true });
        expect('pseudo' in filled).toBe(false);
        expect('pseudo' in empty).toBe(false);
    });

    it('lists the states with their index', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    variants: [{ name: 'Filled' }],
                    states: [
                        { name: 'Hover', pseudo: { hover: true } },
                        { name: 'Focus', pseudo: { 'focus-visible': '.btn', hover: ['.a', '.b'] } }
                    ]
                }
            })
        );

        expect(result.components[0].states).toEqual([
            { name: 'Hover', index: 0, pseudo: { hover: true } },
            { name: 'Focus', index: 1, pseudo: { 'focus-visible': '.btn', hover: ['.a', '.b'] } }
        ]);
    });

    it('omits states when none are declared', () => {
        const none = buildDiscoveryManifest(manifestOf({ className: 'ButtonComponent', showcaseConfig: { title: 'Button', variants: [{ name: 'Filled' }] } }));
        const empty = buildDiscoveryManifest(
            manifestOf({ className: 'ButtonComponent', showcaseConfig: { title: 'Button', variants: [{ name: 'Filled' }], states: [] } })
        );

        expect('states' in none.components[0]).toBe(false);
        expect('states' in empty.components[0]).toBe(false);
        expect('states' in none.components[0].variants[0]).toBe(false);
    });

    it('marks a variant that opts out', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    variants: [{ name: 'Filled' }, { name: 'Static', states: false }],
                    states: [{ name: 'Hover', pseudo: { hover: true } }]
                }
            })
        );
        const [filled, fixed] = result.components[0].variants;

        expect(fixed.states).toBe(false);
        expect('states' in filled).toBe(false);
    });

    it('keeps an empty slot so later indices stay', () => {
        // The scanner keeps a state it cannot use as `{ name, pseudo: {} }`, so
        // the array position is still the `?state=` value of the ones behind it.
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    states: [
                        { name: 'Broken', pseudo: {} },
                        { name: 'Hover', pseudo: { hover: true } }
                    ]
                }
            })
        );

        expect(result.components[0].states).toEqual([
            { name: 'Broken', index: 0, pseudo: {} },
            { name: 'Hover', index: 1, pseudo: { hover: true } }
        ]);
    });

    it('lists the states of a component without variants next to its synthetic Default', () => {
        // The implicit Default row combines with every state, so a runner has to
        // see both. The synthetic variant never opts out.
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'IconComponent',
                showcaseConfig: { title: 'Icon', states: [{ name: 'Hover', pseudo: { hover: true } }] }
            })
        );

        expect(result.components[0].variants).toEqual([{ name: 'Default', index: 0, bg: 'transparent' }]);
        expect(result.components[0].states).toEqual([{ name: 'Hover', index: 0, pseudo: { hover: true } }]);
    });

    it('lists the states of a component with an empty variants array', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'IconComponent',
                showcaseConfig: { title: 'Icon', variants: [], states: [{ name: 'Hover', pseudo: { hover: true } }] }
            })
        );

        expect(result.components[0].states).toHaveLength(1);
    });

    it('exposes component meta, which is where build-time plugins write', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    meta: { figma: 'https://figma.com/x', coverage: { lines: 90 } }
                }
            })
        );

        expect(result.components[0].meta).toEqual({
            figma: 'https://figma.com/x',
            coverage: { lines: 90 }
        });
    });

    it('omits meta entirely when the decorator declares none', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: { title: 'Button' }
            })
        );

        expect('meta' in result.components[0]).toBe(false);
    });

    it('strips a component type placed in meta', () => {
        class Related {}
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: {
                    title: 'Button',
                    meta: { related: Related, tag: 'x' }
                }
            })
        );

        expect(result.components[0].meta).toEqual({ tag: 'x' });
    });

    it('lists parts under their parent with their public input and output names', () => {
        const manifest = manifestOf({ className: 'TabsComponent', showcaseConfig: { title: 'Tabs' } });
        const inputs: InputMeta[] = [
            { name: 'label', type: 'string', required: true },
            { name: 'isDisabled', alias: 'disabled', type: 'boolean', required: false }
        ];
        const outputs: OutputMeta[] = [{ name: 'activated' }, { name: 'closed', alias: 'closeRequested' }];

        manifest.components[0].parts = [
            {
                meta: scannedPart('TabComponent', 'Tab', {
                    inputs,
                    outputs,
                    componentMeta: { selector: 'app-tab', standalone: true, isDirective: false }
                })
            }
        ];

        const result = buildDiscoveryManifest(manifest);

        expect(result.components[0].parts).toEqual([
            {
                className: 'TabComponent',
                title: 'Tab',
                selector: 'app-tab',
                inputs: ['label', 'disabled'],
                outputs: ['activated', 'closeRequested']
            }
        ]);
    });

    it('lists the change output of a model() among the outputs of a part, without a plugin that reads the API', () => {
        const manifest = manifestOf({ className: 'TabsComponent', showcaseConfig: { title: 'Tabs' } });

        manifest.components[0].parts = [
            {
                meta: scannedPart('TabComponent', 'Tab', {
                    inputs: [
                        { name: 'selected', type: 'boolean', required: false, model: true },
                        { name: 'open', alias: 'expanded', type: 'boolean', required: false, model: true }
                    ],
                    outputs: [{ name: 'activated' }]
                })
            }
        ];

        expect(buildDiscoveryManifest(manifest).components[0].parts?.[0].outputs).toEqual(['activated', 'selectedChange', 'expandedChange']);
    });

    it('keeps the order of the parts', () => {
        const manifest = manifestOf({ className: 'TabsComponent', showcaseConfig: { title: 'Tabs' } });

        manifest.components[0].parts = [{ meta: scannedPart('TabComponent', 'Tab') }, { meta: scannedPart('TabPanelComponent', 'Tab panel') }];

        expect(buildDiscoveryManifest(manifest).components[0].parts?.map((part) => part.className)).toEqual(['TabComponent', 'TabPanelComponent']);
    });

    it('omits parts when a component has none', () => {
        const manifest = manifestOf(
            { className: 'ButtonComponent', showcaseConfig: { title: 'Button' } },
            { className: 'TabsComponent', showcaseConfig: { title: 'Tabs' } }
        );

        manifest.components[1].parts = [];

        const result = buildDiscoveryManifest(manifest);

        expect(result.components[0]).not.toHaveProperty('parts');
        expect(result.components[1]).not.toHaveProperty('parts');
    });

    it('maps pages to their titles', () => {
        const manifest = manifestOf({
            className: 'ButtonComponent',
            showcaseConfig: { title: 'Button' }
        });

        manifest.pages = [
            { type: 'custom', title: 'Patterns', data: {} },
            { type: 'custom', title: 'Tokens', data: {} }
        ];
        expect(buildDiscoveryManifest(manifest).pages).toEqual([{ title: 'Patterns' }, { title: 'Tokens' }]);
    });

    it('reports an empty pages array when there are none', () => {
        const result = buildDiscoveryManifest(
            manifestOf({
                className: 'ButtonComponent',
                showcaseConfig: { title: 'Button' }
            })
        );

        expect(result.pages).toEqual([]);
    });

    it('produces a structured-cloneable result for a hostile manifest', () => {
        class SomeComponent {}
        const manifest = manifestOf({
            className: 'ButtonComponent',
            showcaseConfig: {
                title: 'Button',
                meta: { component: SomeComponent, cb: () => 0 },
                variants: [{ name: 'Primary', meta: { el: SomeComponent } }],
                states: [{ name: 'Hostile', pseudo: { hover: () => 0, 'focus-visible': SomeComponent } as never }]
            }
        });

        manifest.components[0].parts = [
            {
                meta: scannedPart('IconComponent', 'Icon', {
                    showcaseConfig: { title: 'Icon', partOf: 'x', meta: { component: SomeComponent, cb: () => 0 } },
                    inputs: [{ name: 'name', type: 'string', required: true, defaultValue: SomeComponent }]
                })
            }
        ];

        const result = buildDiscoveryManifest(manifest);

        expect(() => structuredClone(result)).not.toThrow();
        expect(result.components[0].states).toEqual([{ name: 'Hostile', index: 0, pseudo: {} }]);
        expect(result.components[0].parts).toHaveLength(1);
    });
});
