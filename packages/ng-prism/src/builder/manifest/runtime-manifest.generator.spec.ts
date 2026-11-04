import ts from 'typescript';
import type { DirectiveHost, Variant } from '../../decorator/showcase.types.js';
import type { ScannedPipe } from '../../plugin/pipe.types.js';
import type { InputMeta, ScannedComponent } from '../../plugin/plugin.types.js';
import type { ScannedService } from '../../plugin/service.types.js';
import { COMPOSITION_SUBJECT_SLOT } from '../../shared/composition.js';
import { StaticDate } from '../scanner/static-date.js';
import { evaluateManifest, extractTemplate, FRAME, manifestMeta } from './__test-utils__/composition-fixtures.js';
import { templateErrors } from './__test-utils__/template-errors.js';
import { generateRuntimeManifest } from './runtime-manifest.generator.js';

const BUTTON: ScannedComponent = {
    className: 'ButtonComponent',
    filePath: 'src/lib/button/button.component.ts',
    showcaseConfig: {
        title: 'Button',
        category: 'Inputs',
        variants: [{ name: 'Primary', inputs: { variant: 'primary', label: 'Click me' } }]
    },
    inputs: [
        {
            name: 'variant',
            type: 'union',
            values: ['primary', 'secondary'],
            defaultValue: 'primary',
            required: false
        },
        { name: 'label', type: 'string', defaultValue: 'Button', required: false }
    ],
    outputs: [{ name: 'clicked', doc: 'Click event' }],
    componentMeta: {
        selector: 'my-button',
        standalone: true,
        isDirective: false
    }
};

const CARD: ScannedComponent = {
    className: 'CardComponent',
    filePath: 'src/lib/card/card.component.ts',
    showcaseConfig: { title: 'Card', category: 'Layout' },
    inputs: [{ name: 'title', type: 'string', defaultValue: '', required: false }],
    outputs: [],
    componentMeta: { selector: 'my-card', standalone: true, isDirective: false }
};

const HIGHLIGHT: ScannedComponent = {
    className: 'HighlightDirective',
    filePath: 'src/lib/highlight/highlight.directive.ts',
    showcaseConfig: {
        title: 'Highlight',
        category: 'Utility',
        host: '<span class="demo-text">',
        variants: [
            {
                name: 'Yellow',
                inputs: { highlightColor: 'yellow' },
                content: 'Hover me'
            }
        ]
    },
    inputs: [
        {
            name: 'highlightColor',
            type: 'string',
            defaultValue: 'yellow',
            required: false
        }
    ],
    outputs: [{ name: 'highlighted' }],
    componentMeta: {
        selector: '[appHighlight]',
        standalone: true,
        isDirective: true
    }
};

const TOOLTIP_WITH_HOST_COMPONENT: ScannedComponent = {
    className: 'TooltipDirective',
    filePath: 'src/lib/tooltip/tooltip.directive.ts',
    showcaseConfig: {
        title: 'Tooltip',
        host: {
            selector: 'my-button',
            import: { name: 'ButtonComponent', from: 'my-lib' },
            inputs: { label: 'Click me' }
        }
    },
    inputs: [{ name: 'tooltipText', type: 'string', required: false }],
    outputs: [],
    componentMeta: {
        selector: '[appTooltip]',
        standalone: true,
        isDirective: true
    }
};

const THEMED_DIRECTIVE: ScannedComponent = {
    className: 'ThemedDirective',
    filePath: 'src/lib/themed/themed.directive.ts',
    showcaseConfig: {
        title: 'Themed',
        host: '<div>'
    },
    inputs: [
        {
            name: 'theme',
            type: 'union',
            values: ['light', 'dark'],
            defaultValue: 'light',
            required: false
        },
        { name: 'size', type: 'number', defaultValue: 16, required: false },
        { name: 'label', type: 'string', required: true }
    ],
    outputs: [],
    componentMeta: {
        selector: '[appThemed]',
        standalone: true,
        isDirective: true
    }
};

describe('generateRuntimeManifest', () => {
    it('should generate the type import from @ng-prism/core/plugin', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain("import type { RuntimeManifest } from '@ng-prism/core/plugin';");
    });

    it('should generate named imports from the library', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON, CARD],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('import { ButtonComponent, CardComponent } from "my-lib";');
    });

    it('should export PRISM_RUNTIME_MANIFEST with RuntimeManifest type', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('export const PRISM_RUNTIME_MANIFEST: RuntimeManifest');
    });

    it('should reference the component class as type (not a string)', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('type: ButtonComponent,');
        expect(source).not.toContain('type: "ButtonComponent"');
    });

    it('should serialize meta with className, filePath, inputs, outputs, componentMeta', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('className: "ButtonComponent"');
        expect(source).toContain('filePath: "src/lib/button/button.component.ts"');
        expect(source).toContain('selector: "my-button"');
        expect(source).toContain('name: "variant"');
        expect(source).toContain('name: "clicked"');
    });

    it('quotes keys that are not identifiers, so that the manifest still parses', () => {
        const slotted: ScannedComponent = {
            ...CARD,
            showcaseConfig: {
                title: 'Card',
                variants: [{ name: 'Slots', content: { '[card-header]': '<h3>Title</h3>' }, inputs: { 'aria-label': 'Close' } }]
            }
        };
        const source = generateRuntimeManifest({ components: [slotted], libraryImportPath: 'my-lib' });
        const { diagnostics } = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ES2022 } });

        expect(diagnostics!.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
        expect(source).toContain('"[card-header]": "<h3>Title</h3>"');
        expect(source).toContain('"aria-label": "Close"');
        expect(source).toContain('name: "Slots"');
    });

    it("writes component states and a variant's states: false", () => {
        const stateful: ScannedComponent = {
            ...CARD,
            showcaseConfig: {
                title: 'Card',
                states: [{ name: 'Hover', pseudo: { hover: '.card' } }],
                variants: [{ name: 'A', states: false }]
            }
        };
        const source = generateRuntimeManifest({ components: [stateful], libraryImportPath: 'my-lib' });

        expect(source).toMatch(/states: \[\s+\{\s+name: "Hover",\s+pseudo: \{\s+hover: "\.card"/);
        expect(source).toContain('states: false');
    });

    it('should handle empty components array', () => {
        const source = generateRuntimeManifest({
            components: [],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('components: [');
        expect(source).not.toContain('type:');
        expect(source).not.toContain('import {');
    });

    it('should include the auto-generated comment', () => {
        const source = generateRuntimeManifest({
            components: [],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('// AUTO-GENERATED by ng-prism');
    });

    it('should serialize manifest-level meta into the runtime export', () => {
        const source = generateRuntimeManifest({
            components: [],
            libraryImportPath: 'my-lib',
            meta: {
                coverage: {
                    total: { score: 87, found: true },
                    thresholds: { lines: 80 }
                }
            }
        });

        expect(source).toContain('meta:');
        expect(source).toContain('"coverage"');
        expect(source).toContain('"score": 87');
    });

    it('should omit meta when empty', () => {
        const source = generateRuntimeManifest({
            components: [],
            libraryImportPath: 'my-lib',
            meta: {}
        });

        expect(source).not.toContain('meta:');
    });

    it('should use the provided libraryImportPath for the import', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: '@my-org/components'
        });

        expect(source).toContain('from "@my-org/components"');
    });

    it('should generate grouped imports when components have different importPaths', () => {
        const pill: ScannedComponent = {
            ...BUTTON,
            className: 'PillComponent',
            importPath: 'sgui-lib/atoms/pill'
        };
        const tooltip: ScannedComponent = {
            ...CARD,
            className: 'TooltipComponent',
            importPath: 'sgui-lib/overlay/tooltip'
        };

        const source = generateRuntimeManifest({
            components: [pill, tooltip],
            libraryImportPath: 'sgui-lib'
        });

        expect(source).toContain('import { PillComponent } from "sgui-lib/atoms/pill";');
        expect(source).toContain('import { TooltipComponent } from "sgui-lib/overlay/tooltip";');
        expect(source).not.toContain('from "sgui-lib";');
    });

    it('should group multiple components from the same importPath', () => {
        const pill: ScannedComponent = {
            ...BUTTON,
            className: 'PillComponent',
            importPath: 'sgui-lib/atoms/pill'
        };
        const pillModel: ScannedComponent = {
            ...CARD,
            className: 'PillModelComponent',
            importPath: 'sgui-lib/atoms/pill'
        };

        const source = generateRuntimeManifest({
            components: [pill, pillModel],
            libraryImportPath: 'sgui-lib'
        });

        expect(source).toContain('import { PillComponent, PillModelComponent } from "sgui-lib/atoms/pill";');
    });

    it('should fall back to libraryImportPath when component has no importPath', () => {
        const withPath: ScannedComponent = {
            ...BUTTON,
            className: 'PillComponent',
            importPath: 'sgui-lib/atoms/pill'
        };
        const withoutPath: ScannedComponent = { ...CARD };

        const source = generateRuntimeManifest({
            components: [withPath, withoutPath],
            libraryImportPath: 'sgui-lib'
        });

        expect(source).toContain('import { PillComponent } from "sgui-lib/atoms/pill";');
        expect(source).toContain('import { CardComponent } from "sgui-lib";');
    });
});

describe('generateRuntimeManifest component import path', () => {
    it("carries a component's importPath into its meta", () => {
        const source = generateRuntimeManifest({ components: [{ ...BUTTON, importPath: 'my-lib/atoms' }], libraryImportPath: 'my-lib' });

        expect(source).toMatch(/meta: \{\n {8}className: "ButtonComponent",\n {8}filePath: "[^"]*",\n {8}importPath: "my-lib\/atoms",/);
    });

    it('writes no importPath for a component the scanner could not place', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], libraryImportPath: 'my-lib' });

        expect(source).not.toContain('importPath:');
    });
});

describe('generateRuntimeManifest component API', () => {
    it('writes the API of a component', () => {
        const withApi: ScannedComponent = {
            ...BUTTON,
            api: {
                tags: {},
                inputTypes: { variant: { text: 'Variant', links: ['Variant'] } },
                outputTypes: {},
                modelChanges: [],
                methods: [],
                types: []
            }
        };
        const source = generateRuntimeManifest({ components: [withApi], libraryImportPath: 'my-lib' });

        expect(source).toContain('api: {');
        expect(source).toContain('links: [');
        expect(source).toContain('"Variant"');
    });

    it('leaves out a missing API', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], libraryImportPath: 'my-lib' });

        expect(source).not.toContain('api:');
    });
});

const TOAST: ScannedService = {
    className: 'ToastService',
    filePath: 'src/lib/toast/toast.service.ts',
    importPath: 'my-lib/toast',
    showcaseConfig: { title: 'Toast Service', category: 'Feedback', tags: ['overlay'] },
    provision: 'auto',
    api: {
        description: 'Shows short messages.',
        tags: { since: '1.2.0' },
        properties: [{ name: 'count', type: { text: 'Signal<number>' }, readonly: true, tags: {} }],
        methods: [
            {
                name: 'show',
                params: [{ name: 'options', type: { text: 'ToastOptions', links: ['ToastOptions'] }, optional: false }],
                returnType: { text: 'void' },
                tags: {}
            }
        ],
        setup: [{ name: 'provideToast', kind: 'function', importPath: 'my-lib/toast', tags: {} }],
        types: [{ id: 'ToastOptions', name: 'ToastOptions', kind: 'interface', importPath: 'my-lib/toast', tags: {} }]
    }
};

describe('generateRuntimeManifest services', () => {
    it('writes services as data without importing the class', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], services: [TOAST], libraryImportPath: 'my-lib' });

        expect(source).toContain('services: [');
        expect(source).toContain('className: "ToastService"');
        expect(source).toContain('importPath: "my-lib/toast"');
        expect(source).toContain('provision: "auto"');
        expect(source).not.toMatch(/import \{[^}]*ToastService/);
        expect(source).not.toContain('from "my-lib/toast"');
    });

    it('writes the whole service as the meta of its entry, next to the components', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], services: [TOAST], libraryImportPath: 'my-lib' });

        expect(source.indexOf('components: [')).toBeLessThan(source.indexOf('services: ['));
        expect(source).toMatch(/services: \[\n {4}\{\n {6}meta: \{\n {8}className: "ToastService",/);
        expect(source).toContain('title: "Toast Service"');
        expect(source).toContain('since: "1.2.0"');
        expect(source).toContain('name: "provideToast"');
        expect(source).toContain('links: [\n');
    });

    it('is a module that parses', () => {
        const source = generateRuntimeManifest({ components: [], services: [TOAST], libraryImportPath: 'my-lib' });
        const { diagnostics } = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ES2022 } });

        expect(diagnostics!.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    });

    it('writes no services line when there are none', () => {
        expect(generateRuntimeManifest({ components: [BUTTON], services: [], libraryImportPath: 'my-lib' })).not.toContain('services:');
        expect(generateRuntimeManifest({ components: [BUTTON], libraryImportPath: 'my-lib' })).not.toContain('services:');
    });

    it('imports nothing for a library that has services only', () => {
        const source = generateRuntimeManifest({ components: [], services: [TOAST], libraryImportPath: 'my-lib' });

        expect(source.split('\n').filter((line) => line.startsWith('import '))).toEqual(["import type { RuntimeManifest } from '@ng-prism/core/plugin';"]);
    });
});

const TIME_AGO: ScannedPipe = {
    className: 'TimeAgoPipe',
    filePath: 'src/lib/time-ago/time-ago.pipe.ts',
    importPath: 'my-lib/time-ago',
    showcaseConfig: { title: 'Time ago', category: 'Formatting' },
    pipeName: 'timeAgo',
    pure: true,
    api: {
        description: 'Says how long ago a moment was.',
        tags: { since: '2.0.0' },
        transform: [
            {
                name: 'transform',
                params: [{ name: 'value', type: { text: 'Date | number' }, optional: false }],
                returnType: { text: 'string' },
                tags: {}
            }
        ],
        setup: [{ name: 'provideTimeAgo', kind: 'function', importPath: 'my-lib/time-ago', tags: {} }],
        types: []
    }
};

describe('generateRuntimeManifest pipes', () => {
    it('writes pipes as data without importing the class', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], pipes: [TIME_AGO], libraryImportPath: 'my-lib' });

        expect(source).toContain('pipes: [');
        expect(source).toContain('className: "TimeAgoPipe"');
        expect(source).toContain('pipeName: "timeAgo"');
        expect(source).toContain('pure: true');
        expect(source).toContain('importPath: "my-lib/time-ago"');
        expect(source).not.toMatch(/import \{[^}]*TimeAgoPipe/);
        expect(source).not.toContain('from "my-lib/time-ago"');
    });

    it('writes the whole pipe as the meta of its entry, after the components and the services', () => {
        const source = generateRuntimeManifest({ components: [BUTTON], services: [TOAST], pipes: [TIME_AGO], libraryImportPath: 'my-lib' });

        expect(source.indexOf('services: [')).toBeLessThan(source.indexOf('pipes: ['));
        expect(source).toMatch(/pipes: \[\n {4}\{\n {6}meta: \{\n {8}className: "TimeAgoPipe",/);
        expect(source).toContain('title: "Time ago"');
        expect(source).toContain('since: "2.0.0"');
        expect(source).toContain('name: "provideTimeAgo"');
    });

    it('is a module that parses', () => {
        const source = generateRuntimeManifest({ components: [], services: [TOAST], pipes: [TIME_AGO], libraryImportPath: 'my-lib' });
        const { diagnostics } = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ES2022 } });

        expect(diagnostics!.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    });

    it('writes no pipes line when there are none', () => {
        expect(generateRuntimeManifest({ components: [BUTTON], pipes: [], libraryImportPath: 'my-lib' })).not.toContain('pipes:');
        expect(generateRuntimeManifest({ components: [BUTTON], libraryImportPath: 'my-lib' })).not.toContain('pipes:');
    });

    it('imports nothing for a library that has pipes only', () => {
        const source = generateRuntimeManifest({ components: [], pipes: [TIME_AGO], libraryImportPath: 'my-lib' });

        expect(source.split('\n').filter((line) => line.startsWith('import '))).toEqual(["import type { RuntimeManifest } from '@ng-prism/core/plugin';"]);
    });
});

describe('directive wrapper generation', () => {
    it('should generate a wrapper component class for directives with string host', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('class HighlightDirective__PrismHost');
        expect(source).toContain('@Component');
        expect(source).toContain('imports: [HighlightDirective]');
    });

    it('should generate template with host element and directive selector', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('appHighlight');
        expect(source).toContain('<span');
        expect(source).toContain('class="demo-text"');
    });

    it('should generate input bindings in the template for each directive input', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('[highlightColor]="highlightColor()"');
    });

    it('should generate output bindings in the template for each directive output', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('(highlighted)="highlighted.emit($event)"');
    });

    it('declares each directive output as output<any>(), so that it passes on a payload of any type', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('highlighted = output<any>();');
    });

    it('binds aliased directive inputs and outputs by their public names, keeping the wrapper members', () => {
        const aliased: ScannedComponent = {
            ...HIGHLIGHT,
            inputs: [{ name: 'highlightColor', alias: 'appHighlightColor', type: 'string', defaultValue: 'yellow', required: false }],
            outputs: [{ name: 'highlighted', alias: 'appHighlighted' }]
        };

        const source = generateRuntimeManifest({ components: [aliased], libraryImportPath: 'my-lib' });

        expect(source).toContain('[appHighlightColor]="highlightColor()"');
        expect(source).toContain('(appHighlighted)="highlighted.emit($event)"');
        expect(source).toContain('highlightColor = input(');
        expect(source).toContain('highlighted = output<any>();');
        expect(source).not.toContain('[highlightColor]=');
    });

    it('should generate signal input declarations on the wrapper class', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('highlightColor = input');
    });

    it('should generate __prismContent__ input on the wrapper class', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('__prismContent__ = input("")');
    });

    it('should reference the wrapper class as type in the manifest entry', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('type: HighlightDirective__PrismHost,');
        expect(source).not.toContain('type: HighlightDirective,');
    });

    it('should generate wrapper with Angular component import for object host', () => {
        const source = generateRuntimeManifest({
            components: [TOOLTIP_WITH_HOST_COMPONENT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('imports: [TooltipDirective, ButtonComponent]');
        expect(source).toContain('ButtonComponent } from "my-lib";');
        expect(source).toContain('<my-button');
        expect(source).toContain('appTooltip');
        expect(source).toContain('label="Click me"');
    });

    it('should generate both components and directive wrappers in the same manifest', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON, HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('type: ButtonComponent,');
        expect(source).toContain('type: HighlightDirective__PrismHost,');
        expect(source).toContain('class HighlightDirective__PrismHost');
    });

    it('should import Component, input, output from @angular/core for wrapper classes', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain("import { Component, input, output } from '@angular/core';");
    });

    it('should not generate Angular imports when there are no directives', () => {
        const source = generateRuntimeManifest({
            components: [BUTTON],
            libraryImportPath: 'my-lib'
        });

        expect(source).not.toContain("from '@angular/core'");
    });

    it('should serialize isDirective in componentMeta', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('isDirective: true');
    });

    it('should serialize host in showcaseConfig', () => {
        const source = generateRuntimeManifest({
            components: [HIGHLIGHT],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('host:');
    });

    it('should generate typed input for union types', () => {
        const source = generateRuntimeManifest({
            components: [THEMED_DIRECTIVE],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain("theme = input<'light' | 'dark'>(\"light\")");
    });

    it('should generate input.required with type annotation for required inputs', () => {
        const source = generateRuntimeManifest({
            components: [THEMED_DIRECTIVE],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('label = input.required<string>()');
    });

    it('should keep simple types without explicit annotation', () => {
        const source = generateRuntimeManifest({
            components: [THEMED_DIRECTIVE],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('size = input(16)');
    });

    it('should generate type annotation for union inputs', () => {
        const directive: ScannedComponent = {
            ...HIGHLIGHT,
            inputs: [
                {
                    name: 'theme',
                    type: 'union',
                    values: ['light', 'dark'],
                    defaultValue: 'light',
                    required: false
                }
            ]
        };
        const source = generateRuntimeManifest({
            components: [directive],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain("theme = input<'light' | 'dark'>(\"light\")");
    });

    it('should not generate type annotation for simple string inputs', () => {
        const directive: ScannedComponent = {
            ...HIGHLIGHT,
            inputs: [
                {
                    name: 'label',
                    type: 'string',
                    defaultValue: 'Hello',
                    required: false
                }
            ]
        };
        const source = generateRuntimeManifest({
            components: [directive],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('label = input("Hello")');
        expect(source).not.toContain('input<');
    });

    it('should skip non-bindable inputs (object/unknown without default)', () => {
        const directive: ScannedComponent = {
            ...HIGHLIGHT,
            inputs: [
                {
                    name: 'highlightColor',
                    type: 'string',
                    defaultValue: 'yellow',
                    required: false
                },
                {
                    name: 'contentTemplate',
                    type: 'object',
                    rawType: 'TemplateRef<any>',
                    required: false
                },
                { name: 'config', type: 'unknown', required: false }
            ]
        };
        const source = generateRuntimeManifest({
            components: [directive],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('highlightColor = input');
        expect(source).not.toContain('contentTemplate = input');
        expect(source).not.toContain('[contentTemplate]');
        expect(source).not.toContain('config = input');
        expect(source).not.toContain('[config]');
    });

    it('should default __prismContent__ from host-string text content', () => {
        const directive: ScannedComponent = {
            ...HIGHLIGHT,
            showcaseConfig: {
                ...HIGHLIGHT.showcaseConfig,
                host: '<button class="demo">Hover me</button>'
            }
        };
        const source = generateRuntimeManifest({
            components: [directive],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('<button');
        expect(source).toContain('class="demo"');
        expect(source).toContain('__prismContent__ = input("Hover me")');
    });

    it('should include object inputs that have a default value', () => {
        const directive: ScannedComponent = {
            ...HIGHLIGHT,
            inputs: [
                {
                    name: 'offset',
                    type: 'object',
                    rawType: 'TooltipOffset',
                    defaultValue: { x: 0, y: 0 },
                    required: false
                }
            ]
        };
        const source = generateRuntimeManifest({
            components: [directive],
            libraryImportPath: 'my-lib'
        });

        expect(source).toContain('offset = input');
    });
});

/** A directive named after the selector it carries; `host` and `variants` default to none. */
function directive(options: { selector: string; host?: ScannedComponent['showcaseConfig']['host']; variants?: Variant[] }): ScannedComponent {
    return {
        className: 'InputDirective',
        filePath: 'src/lib/input/input.directive.ts',
        showcaseConfig: { title: 'Input', host: options.host, variants: options.variants },
        inputs: [],
        outputs: [],
        componentMeta: { selector: options.selector, standalone: true, isDirective: true }
    };
}

/** The template of the one wrapper `component` generates, as Angular's compiler sees it: without the literal's escapes. */
function wrapperTemplate(component: ScannedComponent): string {
    const source = generateRuntimeManifest({ components: [component], libraryImportPath: 'lib', warn: () => undefined });
    const literal = source.match(/template: `((?:\\[\s\S]|[^`\\])*)`,/);

    return literal ? literal[1].replace(/\\([\s\S])/g, '$1') : '';
}

describe('directive hosts', () => {
    it.each(['<input type="text">', '<input type="text" />', '<img src="x.png">'])('closes no void host %s and drops content', (host) => {
        const template = wrapperTemplate(directive({ host, selector: '[libInput]' }));

        expect(templateErrors(template)).toEqual([]);
        expect(template).not.toContain('__prismContent__');
    });

    it('binds the inputs and outputs of a void host', () => {
        const input: ScannedComponent = {
            ...directive({ host: '<input>', selector: '[libInput]' }),
            inputs: [{ name: 'size', type: 'string', defaultValue: 'm', required: false }],
            outputs: [{ name: 'changed' }]
        };
        const template = wrapperTemplate(input);

        expect(template).toBe('<input libInput [size]="size()" (changed)="changed.emit($event)" />');
        expect(templateErrors(template)).toEqual([]);
    });

    it('still declares __prismContent__ on a void host, since the runtime sets it for every directive', () => {
        const source = generateRuntimeManifest({ components: [directive({ host: '<input>', selector: '[libInput]' })], libraryImportPath: 'lib' });

        expect(source).toContain('__prismContent__ = input("")');
    });

    it('puts input[libInput], textarea[libInput] on a textarea as libInput', () => {
        const template = wrapperTemplate(directive({ host: '<textarea>', selector: 'input[libInput], textarea[libInput]' }));

        expect(template).toMatch(/^<textarea libInput[ >]/);
        expect(templateErrors(template)).toEqual([]);
    });

    it('keeps the attributes of the host and adds the ones of the selector', () => {
        const template = wrapperTemplate(directive({ host: '<button class="demo">', selector: 'button[libBtn][type=submit]' }));

        expect(template).toMatch(/^<button class="demo" libBtn type="submit">/);
        expect(templateErrors(template)).toEqual([]);
    });

    it('renders a directive without host on the element its selector names', () => {
        expect(wrapperTemplate(directive({ selector: 'input[libInput]' }))).toMatch(/^<input libInput /);
    });

    it('renders a directive without host on a div when its selector names no element', () => {
        expect(wrapperTemplate(directive({ selector: '[libTooltip]' }))).toMatch(/^<div libTooltip>/);
    });

    it('warns when the selector fits no part of the host', () => {
        const warn = jest.fn();

        generateRuntimeManifest({ components: [directive({ host: '<div>', selector: 'input[libInput]' })], libraryImportPath: 'lib', warn });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('InputDirective'));
    });

    it('sets the first attribute of the selector when it fits no part of the host', () => {
        const template = wrapperTemplate(directive({ host: '<div>', selector: 'input[libInput]' }));

        expect(template).toMatch(/^<div libInput>/);
        expect(templateErrors(template)).toEqual([]);
    });

    it('warns about content on a void host', () => {
        const warn = jest.fn();
        const input = directive({
            host: '<input>',
            selector: 'input[libInput]',
            variants: [
                { name: 'Filled', content: 'x' },
                { name: 'Other', content: 'y' }
            ]
        });

        generateRuntimeManifest({ components: [input], libraryImportPath: 'lib', warn });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('InputDirective'));
    });

    it('does not warn about a void host without content', () => {
        const warn = jest.fn();

        generateRuntimeManifest({
            components: [directive({ host: '<input>', selector: 'input[libInput]', variants: [{ name: 'Plain' }] })],
            libraryImportPath: 'lib',
            warn
        });

        expect(warn).not.toHaveBeenCalled();
    });

    it('warns with the default writer under a ⚠ ng-prism: prefix', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            generateRuntimeManifest({ components: [directive({ host: '<div>', selector: 'input[libInput]' })], libraryImportPath: 'lib' });

            expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^⚠ ng-prism: .*InputDirective/));
        } finally {
            spy.mockRestore();
        }
    });

    it('escapes a backtick in a string host', () => {
        const source = generateRuntimeManifest({ components: [directive({ host: '<button title="`">', selector: '[libBtn]' })], libraryImportPath: 'lib' });
        const { diagnostics } = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ES2022 } });

        expect(diagnostics!.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
        expect(wrapperTemplate(directive({ host: '<button title="`">', selector: '[libBtn]' }))).toContain('title="`"');
    });

    it('escapes ${ and a backslash in a string host', () => {
        const template = wrapperTemplate(directive({ host: '<button title="${a}\\b">', selector: '[libBtn]' }));

        expect(template).toContain('title="${a}\\b"');
    });

    it('warns and treats an object host without import as a div instead of throwing', () => {
        const warn = jest.fn();
        const host = { selector: 'lib-button' } as unknown as DirectiveHost;
        const source = generateRuntimeManifest({ components: [directive({ host, selector: '[libTooltip]' })], libraryImportPath: 'lib', warn });

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('InputDirective'));
        expect(source).toContain('imports: [InputDirective],');
        expect(source).toMatch(/template: `<div libTooltip>/);
    });
});

describe('compositions', () => {
    const SLOT = COMPOSITION_SUBJECT_SLOT;
    const HYPHEN = String.fromCharCode(0x2010);

    /** `FRAME` with other imports. */
    function frameImporting(imports: { name: string; from: string }[]): ScannedComponent {
        return { ...FRAME, composition: { ...FRAME.composition!, imports } };
    }

    /** A directive whose host template is its one composition: no variant needs the wrapper that renders the host as a string. */
    const COMPOSED_DIRECTIVE: ScannedComponent = {
        ...HIGHLIGHT,
        showcaseConfig: { title: 'Highlight', host: { template: '<span appHighlight>Hover</span>' } },
        composition: {
            variantCases: [0],
            cases: [{ template: `<span appHighlight${SLOT}>Hover</span>`, unbound: [], origin: 'host (src/lib/highlight/highlight.directive.ts:9:5)' }],
            imports: []
        }
    };

    function manifest(components: ScannedComponent[]): string {
        return generateRuntimeManifest({ components, libraryImportPath: 'my-lib', warn: () => undefined });
    }

    it('generates one wrapper per composed showcase and renders the composition through it', () => {
        const source = manifest([FRAME, BUTTON]);

        expect(source.match(/class \w+__PrismComposition/g)).toEqual(['class FormFieldComponent__PrismComposition']);
        expect(extractTemplate(source)).toContain('@switch (__prismCase__()) {');
        expect(templateErrors(extractTemplate(source)!)).toEqual([]);
    });

    it('imports computed only when a wrapper needs it', () => {
        expect(manifest([FRAME])).toContain("import { Component, computed, input, output } from '@angular/core';");
        expect(manifest([HIGHLIGHT])).toContain("import { Component, input, output } from '@angular/core';");
        expect(manifest([BUTTON])).not.toContain('computed');
        expect(manifest([BUTTON])).not.toContain('composition');
    });

    it('imports the composition classes', () => {
        const source = manifest([FRAME]);

        expect(source).toContain('import { FormFieldComponent, InputDirective } from "my-lib";');
        expect(source).toContain('import { IconComponent } from "my-lib/icon";');
        expect(source).toContain('imports: [FormFieldComponent, InputDirective, IconComponent],');
    });

    it('aliases a class whose name another module already took', () => {
        const source = manifest([
            frameImporting([
                { name: 'IconComponent', from: 'my-lib/icon' },
                { name: 'IconComponent', from: 'other-lib' }
            ])
        ]);

        expect(ts.transpileModule(source, { reportDiagnostics: true }).diagnostics).toEqual([]);
        expect(source).toContain('import { IconComponent } from "my-lib/icon";');
        expect(source).toContain('import { IconComponent as IconComponent__2 } from "other-lib";');
        expect(source).toContain('imports: [FormFieldComponent, IconComponent, IconComponent__2],');
    });

    it("aliases a class that has the subject's name", () => {
        const source = manifest([frameImporting([{ name: 'FormFieldComponent', from: 'other-lib' }])]);

        expect(source).toContain('import { FormFieldComponent } from "my-lib";');
        expect(source).toContain('import { FormFieldComponent as FormFieldComponent__2 } from "other-lib";');
        expect(source).toContain('imports: [FormFieldComponent, FormFieldComponent__2],');
    });

    it('aliases a class that has the name of another component in the manifest, and reuses that component from its own module', () => {
        const icon: ScannedComponent = { ...CARD, className: 'IconComponent', importPath: 'my-lib/icon' };
        const source = manifest([
            frameImporting([
                { name: 'IconComponent', from: 'my-lib/icon' },
                { name: 'IconComponent', from: 'other-lib' }
            ]),
            icon
        ]);

        expect(source).toContain('import { IconComponent } from "my-lib/icon";');
        expect(source).toContain('import { IconComponent as IconComponent__2 } from "other-lib";');
        expect(source.match(/import \{[^}]*\bIconComponent\b[^}]*\} from/g)).toHaveLength(2);
        expect(source).toContain('imports: [FormFieldComponent, IconComponent, IconComponent__2],');
    });

    it('does not take an identifier the module imports from Angular for a class', () => {
        const source = manifest([frameImporting([{ name: 'input', from: 'other-lib' }])]);

        expect(source).toContain('import { input as input__2 } from "other-lib";');
    });

    it('writes a module that holds quotes as a valid string', () => {
        const source = manifest([frameImporting([{ name: 'QuotedDirective', from: `it's "quoted"` }])]);
        const { diagnostics = [] } = ts.transpileModule(source, { reportDiagnostics: true });

        expect(diagnostics.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, ' '))).toEqual([]);
        expect(source).toContain(`import { QuotedDirective } from "it's \\"quoted\\"";`);
    });

    it('writes composition data with its imports and without the origin of a case', () => {
        const meta = manifestMeta(manifest([FRAME]));

        expect(meta.composition).toEqual({
            variantCases: [0, 1, 2, 0],
            cases: FRAME.composition!.cases.map(({ template }) => ({ template, unbound: [] })),
            imports: FRAME.composition!.imports
        });
        expect(meta.composition!.cases[0]).not.toHaveProperty('origin');
        expect(meta.composition!.cases[0].template).toContain(SLOT);
    });

    it('writes no imports for a composition that has none', () => {
        const subject: ScannedComponent = { ...FRAME, composition: { ...FRAME.composition!, imports: undefined } };

        expect(manifestMeta(manifest([subject])).composition).not.toHaveProperty('imports');
    });

    it('writes the unbound inputs of a case', () => {
        const unbound = [{ name: 'label', reason: 'template' as const }];
        const subject: ScannedComponent = {
            ...FRAME,
            composition: { variantCases: [0], cases: [{ ...FRAME.composition!.cases[0], unbound }], imports: [] }
        };

        expect(manifestMeta(manifest([subject])).composition!.cases[0].unbound).toEqual(unbound);
    });

    it('writes no composition into the meta of a component without one', () => {
        expect(manifest([BUTTON])).not.toContain('composition');
    });

    it('uses the wrapper as type and as composition when every variant is composed', () => {
        const source = manifest([FRAME]);

        expect(source).toMatch(/type: FormFieldComponent__PrismComposition,\n {6}composition: FormFieldComponent__PrismComposition,\n {6}meta: \{/);
        expect(source).not.toContain('type: FormFieldComponent,');
    });

    it('drops __PrismHost when the wrapper is the type', () => {
        const source = manifest([COMPOSED_DIRECTIVE]);

        expect(source).toContain('type: HighlightDirective__PrismComposition,');
        expect(source).toContain('composition: HighlightDirective__PrismComposition,');
        expect(source).not.toContain('__PrismHost');
        expect(templateErrors(extractTemplate(source)!)).toEqual([]);
        expect(extractTemplate(source)).toContain(
            '<span appHighlight data-prism-subject [highlightColor]="this.highlightColor()" (highlighted)="this.highlighted.emit($event)">Hover</span>'
        );
    });

    it('does not import the class of an object host that no wrapper renders', () => {
        const source = manifest([{ ...TOOLTIP_WITH_HOST_COMPONENT, composition: { ...COMPOSED_DIRECTIVE.composition! } }]);

        expect(source).toContain('type: TooltipDirective__PrismComposition,');
        expect(source).not.toMatch(/import \{[^}]*ButtonComponent/);
    });

    it('imports the class of an object host through the composition that renders it', () => {
        const tooltip: ScannedComponent = {
            ...TOOLTIP_WITH_HOST_COMPONENT,
            composition: {
                variantCases: [0],
                cases: [{ template: `<my-button appTooltip${SLOT}></my-button>`, unbound: [] }],
                imports: [{ name: 'ButtonComponent', from: 'my-lib' }]
            }
        };
        const source = manifest([tooltip]);

        expect(source).toContain('import { TooltipDirective, ButtonComponent } from "my-lib";');
        expect(source).toContain('imports: [TooltipDirective, ButtonComponent],');
    });

    it('keeps type and adds composition when only some variants are composed', () => {
        const partial: ScannedComponent = { ...FRAME, composition: { ...FRAME.composition!, variantCases: [0, -1, 1, 2] } };
        const source = manifest([partial]);

        expect(source).toMatch(/type: FormFieldComponent,\n {6}composition: FormFieldComponent__PrismComposition,/);
        expect(source).toContain('computed(() => [0, -1, 1, 2][this.__prismVariant__()])');
    });

    it('keeps __PrismHost for a directive with variants that are not composed', () => {
        const partial: ScannedComponent = { ...COMPOSED_DIRECTIVE, composition: { ...COMPOSED_DIRECTIVE.composition!, variantCases: [-1, 0] } };
        const source = manifest([partial]);

        expect(source).toMatch(/type: HighlightDirective__PrismHost,\n {6}composition: HighlightDirective__PrismComposition,/);
        expect(source).toContain('class HighlightDirective__PrismHost');
        expect(source).toContain('class HighlightDirective__PrismComposition');
    });

    it('keeps the host wrapper of a directive that is not composed next to one that is', () => {
        const source = manifest([HIGHLIGHT, { ...COMPOSED_DIRECTIVE, className: 'MarkDirective' }]);

        expect(source).toContain('class HighlightDirective__PrismHost');
        expect(source).not.toContain('MarkDirective__PrismHost');
        expect(source).toContain('class MarkDirective__PrismComposition');
    });

    it('generates the wrapper of a showcase without variants', () => {
        const source = manifest([COMPOSED_DIRECTIVE]);

        expect(source).toContain('computed(() => [0][this.__prismVariant__()])');
        expect(manifestMeta(source).composition!.variantCases).toEqual([0]);
    });

    it('survives backticks, ${, backslashes and --> in templates and names', () => {
        // The `-->` is in the variant name only: in the markup, it would be the author's own text.
        const nasty = 'a\\b `c` ${d}';
        const subject: ScannedComponent = {
            ...FRAME,
            showcaseConfig: { title: nasty, variants: [{ name: `${nasty} --> e`, template: '<input libInput />' }] },
            composition: {
                variantCases: [0],
                cases: [
                    {
                        template: `<lib-form-field${SLOT} title="${nasty}"><!-- ${nasty} --><input libInput /></lib-form-field>`,
                        unbound: [],
                        origin: `variants[0] "${nasty} --> e" (src/x.ts:1:2)`
                    }
                ],
                imports: []
            }
        };
        const source = manifest([subject]);
        const template = extractTemplate(source)!;

        expect(ts.transpileModule(source, { reportDiagnostics: true }).diagnostics).toEqual([]);
        expect(templateErrors(template)).toEqual([]);
        expect(template).toContain(`title="${nasty}"`);
        expect(template).toContain(`${nasty} ${HYPHEN}${HYPHEN}> e`);
        expect(template).not.toMatch(/<!--(?:(?!-->)[\s\S])*-->(?:(?!<!--)[\s\S])*-->/);
        expect(manifestMeta(source).composition!.cases[0].template).toContain(`title="${nasty}"`);
        expect(manifestMeta(source).showcaseConfig.variants![0].name).toBe(`${nasty} --> e`);
    });

    it('aliases the class of an object host that another module took', () => {
        const button: ScannedComponent = { ...BUTTON, importPath: 'other-lib' };
        const source = manifest([button, TOOLTIP_WITH_HOST_COMPONENT]);

        expect(source).toContain('import { ButtonComponent } from "other-lib";');
        expect(source).toContain('import { TooltipDirective, ButtonComponent as ButtonComponent__2 } from "my-lib";');
        expect(source).toContain('imports: [TooltipDirective, ButtonComponent__2],');
    });
});

describe('parts', () => {
    const SELECT: ScannedComponent = {
        className: 'SelectComponent',
        filePath: 'src/lib/select/select.component.ts',
        showcaseConfig: { title: 'Select' },
        inputs: [],
        outputs: [],
        componentMeta: { selector: 'lib-select', standalone: true, isDirective: false }
    };

    const OPTION: ScannedComponent = {
        className: 'OptionComponent',
        filePath: 'src/lib/select/option.component.ts',
        importPath: 'my-lib/option',
        showcaseConfig: { title: 'Option', partOf: 'lib-select', meta: { note: 'kept' } },
        inputs: [{ name: 'value', type: 'string', required: true }],
        outputs: [{ name: 'removed' }],
        componentMeta: { selector: 'lib-option', standalone: true, isDirective: false },
        parentClassName: 'SelectComponent'
    };

    const OPTGROUP_DIRECTIVE: ScannedComponent = {
        className: 'OptgroupDirective',
        filePath: 'src/lib/select/optgroup.directive.ts',
        showcaseConfig: { title: 'Option Group', partOf: 'lib-select' },
        inputs: [],
        outputs: [],
        componentMeta: { selector: '[libOptgroup]', standalone: true, isDirective: true },
        parentClassName: 'SelectComponent'
    };

    /** A composition whose template uses the part. */
    const SELECT_COMPOSED: ScannedComponent = {
        ...SELECT,
        showcaseConfig: { title: 'Select', variants: [{ name: 'Default', template: '<lib-option value="a" />' }] },
        composition: {
            variantCases: [0],
            cases: [
                {
                    template: `<lib-select${COMPOSITION_SUBJECT_SLOT}><lib-option value="a" /></lib-select>`,
                    unbound: [],
                    origin: 'variants[0] "Default" (select.showcase.ts:1:1)'
                }
            ],
            imports: [{ name: 'OptionComponent', from: 'my-lib/option' }]
        }
    };

    function manifest(components: ScannedComponent[]): string {
        return generateRuntimeManifest({ components, libraryImportPath: 'my-lib', warn: () => undefined });
    }

    it('emits parts as meta only, without importing the part class', () => {
        const out = manifest([{ ...SELECT, parts: [OPTION] }]);

        expect(out).toMatch(/parts: \[\s*\{\s*meta: \{\s*className: "OptionComponent"/);
        expect(out).not.toMatch(/import \{[^}]*\bOptionComponent\b/);
        expect(out).not.toContain('from "my-lib/option"');
    });

    it('writes parts after the meta of the parent, at the indent of its other keys', () => {
        const out = manifest([{ ...SELECT, parts: [OPTION] }]);

        expect(out).toMatch(/ {6}meta: \{[\s\S]*?\n {6}\},\n {6}parts: \[\n {8}\{\n {10}meta: \{\n {12}className: "OptionComponent",/);
        expect(out).toMatch(/\n {10}\},\n {8}\},\n {6}\],\n {4}\},\n {2}\],/);
    });

    it('writes valid code that evaluates to the parts of the parent, each with its meta and no class', () => {
        const out = manifest([
            { ...SELECT, parts: [OPTION, OPTGROUP_DIRECTIVE] },
            { ...SELECT, className: 'OtherComponent' }
        ]);
        const [select, other] = evaluateManifest(out).components;

        expect(ts.transpileModule(out, { reportDiagnostics: true }).diagnostics).toEqual([]);
        expect(select.parts!.map((p) => p.meta.className)).toEqual(['OptionComponent', 'OptgroupDirective']);
        expect(select.parts![0]).not.toHaveProperty('type');
        expect(select.parts![0].meta).toMatchObject({
            filePath: 'src/lib/select/option.component.ts',
            importPath: 'my-lib/option',
            showcaseConfig: { title: 'Option', partOf: 'lib-select', meta: { note: 'kept' } },
            inputs: [{ name: 'value', type: 'string', required: true }],
            outputs: [{ name: 'removed' }],
            componentMeta: { selector: 'lib-option', standalone: true, isDirective: false }
        });
        expect(other).not.toHaveProperty('parts');
    });

    it('does not write parts into the meta of a component or of a part', () => {
        const [select] = evaluateManifest(manifest([{ ...SELECT, parts: [{ ...OPTION, parts: [OPTGROUP_DIRECTIVE] }] }])).components;

        expect(select.meta).not.toHaveProperty('parts');
        expect(select.parts![0].meta).not.toHaveProperty('parts');
    });

    it('generates no wrapper for a part that is a directive', () => {
        const out = manifest([{ ...SELECT, parts: [OPTGROUP_DIRECTIVE] }]);

        expect(out).not.toContain('OptgroupDirective__PrismHost');
        expect(out).not.toContain('@Component');
        expect(out).not.toMatch(/import \{[^}]*\bOptgroupDirective\b/);
    });

    it("still imports a part the parent's composition template uses", () => {
        const out = manifest([{ ...SELECT_COMPOSED, parts: [OPTION] }]);

        expect(out).toMatch(/import \{[^}]*\bOptionComponent\b[^}]*\} from "my-lib\/option"/);
        expect(out).toContain('imports: [SelectComponent, OptionComponent],');
        expect(out).toMatch(/parts: \[\s*\{\s*meta: \{\s*className: "OptionComponent"/);
    });

    it('writes nothing new for a component without parts', () => {
        expect(manifest([SELECT, BUTTON])).not.toContain('parts:');
        expect(manifest([{ ...SELECT, parts: [] }])).not.toContain('parts:');
    });
});

describe('Date values', () => {
    const local = () => new StaticDate([2026, 3, 28]);

    function withValues(inputs: Record<string, unknown>, meta?: Record<string, unknown>): ScannedComponent {
        return { ...BUTTON, showcaseConfig: { ...BUTTON.showcaseConfig, meta, variants: [{ name: 'Dated', inputs }] } };
    }

    function manifest(components: ScannedComponent[]): string {
        return generateRuntimeManifest({ components, libraryImportPath: 'my-lib', warn: () => undefined });
    }

    function variantInputs(source: string): Record<string, unknown> {
        return manifestMeta(source).showcaseConfig.variants![0].inputs!;
    }

    it('writes a Date with the arguments the source gave it', () => {
        const source = manifest([withValues({ local: local(), utc: new StaticDate(['2026-04-28']) })]);

        expect(source).toContain('local: new Date(2026, 3, 28),');
        expect(source).toContain('utc: new Date("2026-04-28"),');
    });

    it('makes a real Date of it when the manifest runs', () => {
        const { local: value } = variantInputs(manifest([withValues({ local: local() })])) as { local: Date };

        expect(value).toBeInstanceOf(Date);
        expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2026, 3, 28]);
    });

    it('writes a Date nested in objects, arrays, arrays in arrays and meta', () => {
        const source = manifest([withValues({ range: { from: local() }, days: [local()], ranges: [[local(), local()]] }, { released: local() })]);
        const inputs = variantInputs(source) as { range: { from: Date }; days: Date[]; ranges: Date[][] };

        expect(inputs.range.from).toBeInstanceOf(Date);
        expect(inputs.days[0]).toBeInstanceOf(Date);
        expect(inputs.ranges[0][1]).toBeInstanceOf(Date);
        expect(manifestMeta(source).showcaseConfig.meta!['released']).toBeInstanceOf(Date);
    });

    it('writes a Date a plugin made by its time', () => {
        expect(manifest([withValues({ at: new Date(0) })])).toContain('at: new Date(0),');
    });

    it('declares a Date default in the composition wrapper', () => {
        const composed: ScannedComponent = { ...FRAME, inputs: [{ name: 'since', type: 'date', defaultValue: new StaticDate([2026, 0, 1]), required: false }] };

        expect(manifest([composed])).toContain('since = input<any>(new Date(2026, 0, 1));');
    });

    it('does not let a class named Date take the name the manifest writes Dates with', () => {
        const composed: ScannedComponent = { ...FRAME, composition: { ...FRAME.composition!, imports: [{ name: 'Date', from: 'my-lib/calendar' }] } };

        expect(manifest([composed])).toContain('import { Date as Date__2 } from "my-lib/calendar";');
    });
});

describe('Date inputs of a directive host', () => {
    function hostWith(input: Partial<InputMeta>): string {
        const directive: ScannedComponent = { ...HIGHLIGHT, inputs: [{ name: 'value', type: 'date', required: false, ...input }] };

        return generateRuntimeManifest({ components: [directive], libraryImportPath: 'my-lib', warn: () => undefined });
    }

    // `input<any>`, as in the composition wrapper, so that the binding checks against Date, Date | null and Date | undefined.
    it('declares a Date input without a default as undefined and binds it', () => {
        const source = hostWith({});

        expect(source).toContain('value = input<any>(undefined);');
        expect(source).toContain('[value]="value()"');
    });

    it('declares a Date default with its arguments', () => {
        expect(hostWith({ defaultValue: new StaticDate([2026, 0, 1]) })).toContain('value = input<any>(new Date(2026, 0, 1));');
    });

    it('declares a required Date input', () => {
        expect(hostWith({ required: true })).toContain('value = input.required<any>();');
    });

    it('leaves a Date input with a default it could not read to the directive', () => {
        const source = hostWith({ defaultUnreadable: true });

        expect(source).not.toContain('value = input');
        expect(source).not.toContain('[value]');
    });
});

describe('model() inputs of a directive host', () => {
    function hostWith(input: Partial<InputMeta>): string {
        const directive: ScannedComponent = { ...HIGHLIGHT, inputs: [{ name: 'value', type: 'date', required: false, model: true, ...input }] };

        return generateRuntimeManifest({ components: [directive], libraryImportPath: 'my-lib', warn: () => undefined });
    }

    it('passes on the change of a model it binds', () => {
        const source = hostWith({});

        expect(source).toContain('  valueChange = output<any>();');
        expect(extractTemplate(source)).toContain('(valueChange)="valueChange.emit($event)"');
    });

    it('listens under the alias Angular gives the change output', () => {
        expect(extractTemplate(hostWith({ alias: 'date' }))).toContain('(dateChange)="valueChange.emit($event)"');
    });

    it('passes on nothing for a model it leaves to the directive', () => {
        expect(hostWith({ defaultUnreadable: true })).not.toContain('valueChange');
    });
});
