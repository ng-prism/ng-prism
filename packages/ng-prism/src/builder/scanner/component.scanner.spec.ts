import path from 'node:path';
import ts from 'typescript';
import type { ScannedComponent } from '../../plugin/plugin.types.js';
import { extractComponentApi } from './api/component-api.extractor.js';
import { buildExportIndex } from './api/export-index.js';
import { createReporters, findShowcasedClasses, scanComponents, type ScanComponentsOptions } from './component.scanner.js';
import { buildDeclarableIndex } from './composition/declarables.js';
import { createCompositionContext } from './composition/read-composition.js';
import { type ResolvedEntryPoint, resolveEntryPointExports } from './entry-point.scanner.js';

// The real extractor with a seam: a test makes it throw for one class and leaves the others alone.
jest.mock('./api/component-api.extractor.js', () => {
    const actual = jest.requireActual('./api/component-api.extractor.js');

    return { ...actual, extractComponentApi: jest.fn(actual.extractComponentApi) };
});

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true,
    strict: true,
    skipLibCheck: true
};

describe('scanComponents', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should find only @Showcase-annotated components', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const names = components.map((c) => c.className);

        expect(names).toContain('ButtonComponent');
        expect(names).toContain('CardComponent');
        expect(names).toContain('SignalButtonComponent');
        expect(names).toContain('ModelInputComponent');
        expect(names).toContain('HighlightDirective');
        expect(names).toContain('InvalidBgComponent');
        expect(names).toContain('InvalidStatusComponent');
        expect(names).toContain('SectionedComponent');
        expect(names).not.toContain('NoShowcaseComponent');
        expect(components).toHaveLength(9);
    });

    it('should extract showcase config for ButtonComponent', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.title).toBe('Button');
        expect(button.showcaseConfig.category).toBe('Inputs');
        expect(button.showcaseConfig.description).toBe('A versatile button component');
        expect(button.showcaseConfig.tags).toEqual(['form', 'action']);
    });

    it('should extract variants', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.variants).toHaveLength(2);
        expect(button.showcaseConfig.variants![0].name).toBe('Primary');
        expect(button.showcaseConfig.variants![0].inputs).toEqual({
            variant: 'primary',
            label: 'Click me'
        });
        expect(button.showcaseConfig.variants![1].name).toBe('Danger');
        expect(button.showcaseConfig.variants![1].inputs).toEqual({
            variant: 'danger',
            disabled: true
        });
    });

    it('should extract variant-level meta', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.variants![0].meta).toEqual({
            figma: 'https://www.figma.com/design/abc123/DS?node-id=12-34'
        });
        expect(button.showcaseConfig.variants![1].meta).toBeUndefined();
    });

    it('should extract component metadata (selector, standalone)', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.componentMeta.selector).toBe('my-button');
        expect(button.componentMeta.standalone).toBe(true);
    });

    it('should extract inputs and outputs', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.inputs.length).toBe(5);
        expect(button.outputs.length).toBe(2);
        expect(button.inputs[0].name).toBe('variant');
        expect(button.outputs[0].name).toBe('clicked');
    });

    it('should set filePath', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.filePath).toContain('button.component.ts');
    });

    it('should handle CardComponent with minimal config', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const card = components.find((c) => c.className === 'CardComponent')!;

        expect(card.showcaseConfig.title).toBe('Card');
        expect(card.showcaseConfig.category).toBe('Layout');
        expect(card.showcaseConfig.variants).toBeUndefined();
        expect(card.showcaseConfig.tags).toBeUndefined();
        expect(card.inputs).toHaveLength(2);
        expect(card.outputs).toHaveLength(0);
    });

    it('should set isDirective true for directives', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const highlight = components.find((c) => c.className === 'HighlightDirective')!;

        expect(highlight.componentMeta.isDirective).toBe(true);
        expect(highlight.componentMeta.selector).toBe('[appHighlight]');
        expect(highlight.componentMeta.standalone).toBe(true);
    });

    it('should set isDirective false for components', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.componentMeta.isDirective).toBe(false);
    });

    it('should extract inputs and outputs from directives', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const highlight = components.find((c) => c.className === 'HighlightDirective')!;

        expect(highlight.inputs).toHaveLength(1);
        expect(highlight.inputs[0].name).toBe('highlightColor');
        expect(highlight.inputs[0].type).toBe('string');
        expect(highlight.inputs[0].defaultValue).toBe('yellow');

        expect(highlight.outputs).toHaveLength(1);
        expect(highlight.outputs[0].name).toBe('highlighted');
    });

    it('should extract host config from directive showcase', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const highlight = components.find((c) => c.className === 'HighlightDirective')!;

        expect(highlight.showcaseConfig.host).toBe('<span class="demo-text">');
    });

    it('should warn when @Showcase class uses @Input() decorators', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ButtonComponent uses @Input() decorators'));

        warnSpy.mockRestore();
    });

    it('should warn and skip @Showcase classes without a title', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(components.find((c) => c.className === 'MissingTitleComponent')).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('MissingTitleComponent has @Showcase without a "title" field'));

        warnSpy.mockRestore();
    });

    it('should warn that a checker background is deprecated', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        scanComponents(findShowcasedClasses(exports, checker), checker);

        // Once for the component and once for the variant that declares its own:
        // a reviewer fixing this has to find both, and only the variant warning
        // says which variant.
        const messages = warnSpy.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('DeprecatedBgComponent'));

        expect(messages.filter((m) => m.includes('deprecated'))).toHaveLength(2);
        expect(messages.some((m) => m.includes('Also checker'))).toBe(true);

        warnSpy.mockRestore();
    });

    it('should keep a checker background despite deprecating it', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const deprecated = components.find((c) => c.className === 'DeprecatedBgComponent')!;

        // Deprecated is not invalid. Dropping the value would change what the
        // component renders on, which is a break dressed up as a warning.
        expect(deprecated.showcaseConfig.bg).toBe('checker');
        expect(deprecated.showcaseConfig.variants?.[0].bg).toBe('checker');

        warnSpy.mockRestore();
    });

    it('should not warn for signal-based components', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('SignalButtonComponent'));
        expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('HighlightDirective'));

        warnSpy.mockRestore();
    });

    it('should extract component-level bg', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.bg).toBe('dark');
    });

    it('should extract variant-level bg', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.variants![0].bg).toBe('light');
        expect(button.showcaseConfig.variants![1].bg).toBeUndefined();
    });

    it('should leave bg undefined when not declared', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const card = components.find((c) => c.className === 'CardComponent')!;

        expect(card.showcaseConfig.bg).toBeUndefined();
    });

    it('should warn and skip invalid bg values', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);

        const invalid = components.find((c) => c.className === 'InvalidBgComponent')!;

        expect(invalid.showcaseConfig.bg).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('InvalidBgComponent declares invalid bg "rainbow"'));

        warnSpy.mockRestore();
    });

    it('should extract status from showcase config', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.status).toBe('beta');
    });

    it('should leave status undefined when not declared', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const card = components.find((c) => c.className === 'CardComponent')!;

        expect(card.showcaseConfig.status).toBeUndefined();
    });

    it('should warn and skip invalid status values', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);

        const invalid = components.find((c) => c.className === 'InvalidStatusComponent')!;

        expect(invalid.showcaseConfig.status).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('InvalidStatusComponent declares invalid status "banana"'));

        warnSpy.mockRestore();
    });

    it('extracts section and sectionOrder from showcaseConfig', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const sectioned = components.find((c) => c.className === 'SectionedComponent')!;

        expect(sectioned.showcaseConfig.section).toBe('Pipes');
        expect(sectioned.showcaseConfig.sectionOrder).toBe(5);
    });

    it('extracts categoryOrder and componentOrder from showcaseConfig', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const sectioned = components.find((c) => c.className === 'SectionedComponent')!;

        expect(sectioned.showcaseConfig.categoryOrder).toBe(3);
        expect(sectioned.showcaseConfig.componentOrder).toBe(2);
    });

    it('counts the values it rejects as diagnostics, but not deprecations or @Input() hints', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const diagnostics: string[] = [];

        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        expect(diagnostics).toEqual([
            expect.stringContaining('MissingTitleComponent has @Showcase without a "title" field'),
            expect.stringContaining('InvalidBgComponent declares invalid bg "rainbow"'),
            expect.stringContaining('InvalidStatusComponent declares invalid status "banana"')
        ]);

        warnSpy.mockRestore();
    });

    it('omits section and sectionOrder when not declared', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const button = components.find((c) => c.className === 'ButtonComponent')!;

        expect(button.showcaseConfig.section).toBeUndefined();
        expect(button.showcaseConfig.sectionOrder).toBeUndefined();
    });
});

describe('scanComponents with forced pseudo states', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'pseudo-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const [component] = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });
        const pseudoOf = (name: string) => component.showcaseConfig.variants!.find((v) => v.name === name)!.pseudo;

        return { diagnostics, pseudoOf };
    }

    it('reads true, a selector and a list of selectors', () => {
        const { pseudoOf } = scan();

        expect(pseudoOf('Hovered')).toEqual({ hover: true });
        expect(pseudoOf('Pressed')).toEqual({ active: ['.btn', '.btn__icon'], focus: '.btn' });
    });

    it('resolves a selector from a constant', () => {
        expect(scan().pseudoOf('Focused')).toEqual({ 'focus-visible': '.btn' });
    });

    it('leaves a variant without pseudo states without the field', () => {
        expect(scan().pseudoOf('Plain')).toBeUndefined();
    });

    it('drops an unknown state and keeps the others', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('Unknown state')).toEqual({ hover: true });
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Unknown state" declares unknown pseudo state "checked", expected one of: hover, active, focus, focus-visible, focus-within. Skipping.'
        );
    });

    it('drops a target that is neither true nor selectors, and the field once nothing is left', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('Wrong targets')).toBeUndefined();
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Wrong targets" declares pseudo state "focus" with invalid target 42, expected true, a selector or a list of selectors. Skipping.'
        );
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Wrong targets" declares pseudo state "hover" with invalid target false, expected true, a selector or a list of selectors. Skipping.'
        );
    });

    it('drops the entries of a selector list that are no selectors', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('Mixed list')).toEqual({ 'focus-within': ['.field'] });
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Mixed list" declares pseudo state "focus-within" with 7, "" in its selector list, expected non-empty strings. Skipping them.'
        );
    });

    it('drops empty selectors and empty lists', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('Empty')).toBeUndefined();
        expect(diagnostics).toContainEqual('PseudoStatesComponent variant "Empty" declares pseudo state "focus" with an empty selector. Skipping.');
        expect(diagnostics).toContainEqual('PseudoStatesComponent variant "Empty" declares pseudo state "active" with an empty selector list. Skipping.');
    });

    it('drops a pseudo field that is no object', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('Not an object')).toBeUndefined();
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Not an object" declares invalid pseudo "hover", expected an object mapping pseudo states to true or selectors. Skipping.'
        );
    });

    it('quotes an array or an object it rejects, so the message shows what was written', () => {
        const { diagnostics, pseudoOf } = scan();

        expect(pseudoOf('A list')).toBeUndefined();
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "A list" declares invalid pseudo ["hover","focus"], expected an object mapping pseudo states to true or selectors. Skipping.'
        );
        expect(diagnostics).toContainEqual(
            'PseudoStatesComponent variant "Object target" declares pseudo state "hover" with invalid target {}, expected true, a selector or a list of selectors. Skipping.'
        );
    });

    it('reports nothing about the valid variants', () => {
        const { diagnostics } = scan();

        expect(diagnostics.filter((d) => /"(Plain|Focused|Hovered|Pressed)"/.test(d))).toEqual([]);
        expect(diagnostics).toHaveLength(9);
    });
});

describe('scanComponents with component states', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'showcase-states-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });
        const config = (className: string) => components.find((c) => c.className === className)!.showcaseConfig;

        return { diagnostics, config };
    }

    it('keeps every state slot so later indices stay put', () => {
        const { states } = scan().config('ShowcaseStatesComponent');

        expect(states!.map((s) => s.name)).toEqual(['Hover', 'Pressed', 'State 3', 'State 4', 'Hover', 'Empty', 'Bad', 'Blank']);
        expect(states![0].pseudo).toEqual({ hover: '.btn' });
        expect(states![1].pseudo).toEqual({ hover: '.btn', active: '.btn' });
        expect(states![2].pseudo).toEqual({});
        expect(states![3].pseudo).toEqual({ focus: '.btn' });
        expect(states![4].pseudo).toEqual({});
        expect(states![5].pseudo).toEqual({});
        expect(states![6].pseudo).toEqual({});
        expect(states![7].pseudo).toEqual({});
    });

    it('reports each unusable state', () => {
        const { diagnostics } = scan();
        const className = 'ShowcaseStatesComponent';

        expect(diagnostics).toContainEqual(`${className} states[2] is "oops", expected { name, pseudo }. Its column stays empty.`);
        expect(diagnostics).toContainEqual(`${className} states[3] has no name, expected a non-empty string. Calling it "State 4".`);
        expect(diagnostics).toContainEqual(`${className} state "Hover" repeats the name of states[0]; only the first one is used. Its column stays empty.`);
        expect(diagnostics).toContainEqual(`${className} state "Empty" declares no pseudo states. Its column stays empty.`);
        expect(diagnostics).toContainEqual(`${className} state "Blank" declares no pseudo states. Its column stays empty.`);
        expect(diagnostics).toContainEqual(
            `${className} state "Bad" declares unknown pseudo state "checked", expected one of: hover, active, focus, focus-visible, focus-within. Skipping.`
        );
    });

    it('keeps states: false on a variant and drops anything else', () => {
        const { diagnostics, config } = scan();
        const variants = config('ShowcaseStatesComponent').variants!;

        expect(variants.find((v) => v.name === 'Plain')!.states).toBeUndefined();
        expect(variants.find((v) => v.name === 'Opted out')!.states).toBe(false);
        expect(variants.find((v) => v.name === 'Wrong')).not.toHaveProperty('states');
        expect(diagnostics).toContainEqual('ShowcaseStatesComponent variant "Wrong" declares invalid states true, expected false. Skipping.');
        expect(diagnostics.filter((d) => d.includes('variant "Plain"') || d.includes('variant "Opted out"'))).toEqual([]);
    });

    it('drops states on a renderPage component', () => {
        const { diagnostics, config } = scan();

        expect(config('PageStatesComponent').states).toBeUndefined();
        expect(diagnostics).toContainEqual(
            'PageStatesComponent declares states together with renderPage; a component page has no Overview to show them in. Skipping states.'
        );
    });

    it('keeps the slot of a state the evaluator could not read', () => {
        const { diagnostics, config } = scan();
        const states = config('GapStatesComponent').states!;

        expect(states.map((s) => s.name)).toEqual(['A', 'State 2', 'C']);
        expect(states[1].pseudo).toEqual({});
        expect(states[2].pseudo).toEqual({ hover: '.c' });
        expect(diagnostics.filter((d) => d.startsWith('GapStatesComponent'))).toEqual([expect.stringContaining('GapStatesComponent › states[1] — "makeState()" (')]);
    });

    it('names a state by its name in a diagnostic path', () => {
        const { diagnostics, config } = scan();
        const message = diagnostics.find((d) => d.startsWith('UnevaluableStateComponent'))!;

        expect(message).toContain('UnevaluableStateComponent › states[1] "Pressed" › pseudo.hover — "pickTarget()" (');
        expect(message).toContain('cannot be evaluated statically and was dropped.');
        expect(config('UnevaluableStateComponent').states!.map((s) => s.pseudo)).toEqual([{ hover: '.btn' }, {}]);
    });
});

describe('scanComponents with @Showcase values it cannot evaluate', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'unevaluable-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        return { components, diagnostics };
    }

    it('warns with the component, the path in the config and the source location', () => {
        const message = scan().diagnostics.find((d) => d.includes('maxFileSize'))!;

        expect(message).toContain('UnevaluableShowcaseComponent › variants[1] "Auto hint" › inputs.maxFileSize — "megabytes(5)" (');
        expect(message).toContain('src/builder/scanner/__fixtures__/unevaluable-showcase.component.ts:31:73) cannot be evaluated statically and was dropped.');
        expect(message).not.toContain(FIXTURES_DIR);
        expect(warnSpy).toHaveBeenCalledWith(`⚠ ng-prism: ${message}`);
    });

    it('reports exactly the @Showcase values it drops, nothing from @Component or input defaults', () => {
        const where = scan().diagnostics.map((d) => d.split(' — ')[0]);

        expect(where).toEqual([
            'UnevaluableShowcaseComponent › meta',
            'UnevaluableShowcaseComponent › variants[0] "Plain" › inputs.validator',
            'UnevaluableShowcaseComponent › variants[1] "Auto hint" › inputs.maxFileSize',
            'UnevaluableShowcaseComponent › variants[2]',
            'TopLevelSpreadComponent › @Showcase',
            'UnevaluableRootComponent › @Showcase',
            expect.stringMatching(/^DeprecatedProvidersComponent declares @Showcase providers/),
            'ConstantShowcaseComponent › variants[1] "Retry" › inputs.retries',
            expect.stringMatching(/^ConstConfigProvidersComponent declares @Showcase providers \(.*indirect-providers\.component\.ts:17:11\)/),
            expect.stringMatching(/^SpreadProvidersComponent declares @Showcase providers \(.*indirect-providers\.component\.ts:9:\d+\)/)
        ]);
    });

    it('resolves constants, enum members and spread constants, also from other files', () => {
        const component = scan().components.find((c) => c.className === 'ConstantShowcaseComponent')!;

        expect(component.showcaseConfig.meta).toEqual({ a11y: { accept: ['color-contrast'] }, figma: 'https://www.figma.com/design/abc123/DS' });
        expect(component.showcaseConfig.variants![0].inputs).toEqual({ maxFileSize: 5242880, maxFiles: 3, size: 'm' });
    });

    it('names the reference behind a value it had to drop', () => {
        const message = scan().diagnostics.find((d) => d.includes('inputs.retries'))!;

        expect(message).toContain(
            'constant-showcase.component.ts:21:36) cannot be evaluated statically and was dropped: retries is declared with let; only const declarations can be read.'
        );
    });

    it('does not resolve @Component fields it never reads', () => {
        const looked: string[] = [];
        const recording = new Proxy(checker, {
            get(target, property, receiver) {
                if (property === 'getSymbolAtLocation') {
                    return (node: ts.Node) => {
                        looked.push(node.getText());
                        return target.getSymbolAtLocation(node);
                    };
                }
                const member = Reflect.get(target, property, receiver);

                return typeof member === 'function' ? member.bind(target) : member;
            }
        });

        scanComponents(findShowcasedClasses(exports, recording), recording, { diagnostics: [] });

        expect(looked).not.toContain('ChildComponent');
        expect(looked).toContain('SELECTOR');
    });

    it('resolves a constant selector in @Component', () => {
        const component = scan().components.find((c) => c.className === 'ConstantShowcaseComponent')!;

        expect(component.componentMeta.selector).toBe('constant-showcase');
    });

    it('warns once about deprecated providers instead of once per provider', () => {
        const messages = scan().diagnostics.filter((d) => d.startsWith('DeprecatedProvidersComponent'));

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain('deprecated-providers.component.ts:17:5), which are deprecated and will be removed in 23.0.0');
        expect(messages[0]).toContain('defineConfig({ appProviders })');
    });

    it('drops only the value it cannot evaluate', () => {
        const component = scan().components.find((c) => c.className === 'UnevaluableShowcaseComponent')!;

        expect(component.showcaseConfig.meta).toEqual({ figma: 'https://www.figma.com/design/abc123/DS' });
        expect(component.showcaseConfig.variants!.map((v) => v.inputs)).toEqual([{ label: 'Plain' }, { label: 'Auto hint' }]);
    });

    it('says when a value is a function that can never reach the manifest', () => {
        const message = scan().diagnostics.find((d) => d.includes('validator'))!;

        expect(message).toContain('"(value: string) => value.length > 0" (');
        expect(message).toContain(':30:63) is a runtime value (function, class or instance) and cannot be part of the static manifest; it was dropped.');
    });

    it('keeps a component whose @Showcase spreads at the top level', () => {
        const { components, diagnostics } = scan();
        const component = components.find((c) => c.className === 'TopLevelSpreadComponent')!;

        expect(component.showcaseConfig.title).toBe('Top-level spread');
        expect(diagnostics).toContainEqual(expect.stringContaining('TopLevelSpreadComponent › @Showcase — "...sharedShowcase()" ('));
    });

    it('skips a component whose whole @Showcase argument cannot be evaluated, and says so', () => {
        const { components, diagnostics } = scan();

        expect(components.find((c) => c.className === 'UnevaluableRootComponent')).toBeUndefined();
        expect(diagnostics).toContainEqual(
            expect.stringMatching(
                /UnevaluableRootComponent › @Showcase — "buildShowcase\(\)" \(.*:11:11\) cannot be evaluated statically, so the component is skipped\.$/
            )
        );
    });

    it('reports a loss once when a component is scanned from several entry points', () => {
        const diagnostics: string[] = [];

        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });
        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        expect(diagnostics).toHaveLength(10);
        expect(warnSpy.mock.calls.filter(([message]) => String(message).includes('megabytes(5)'))).toHaveLength(1);
    });
});

describe('scanComponents with Date values', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'date-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const [component] = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        return { component, diagnostics };
    }

    it('keeps a Date with static arguments in a variant, with the arguments as written', () => {
        const variants = scan().component.showcaseConfig.variants!;
        const args = (name: string, input = 'value') => (variants.find((v) => v.name === name)!.inputs![input] as { args: unknown }).args;

        expect(args('Local')).toEqual([2026, 3, 28]);
        expect(args('UTC string')).toEqual(['2026-04-28']);
        expect(args('Timestamp')).toEqual([1777334400000]);
        expect(args('Constant')).toEqual([2026, 3, 28]);
        expect(args('Constant', 'min')).toEqual([2026, 3, 28]);
    });

    it('drops new Date() as the current time and says how to write it instead', () => {
        const { component, diagnostics } = scan();

        expect(component.showcaseConfig.variants!.find((v) => v.name === 'Now')!.inputs).toEqual({});
        expect(diagnostics).toEqual([
            expect.stringMatching(
                /^DateValuesComponent › variants\[4\] "Now" › inputs\.value — "new Date\(\)" \(.*date-values\.component\.ts:16:41\) is the current time, which differs in every build and every visual regression run, so it was dropped; write the date out instead, such as new Date\(2026, 3, 28\)\.$/
            )
        ]);
    });
});

describe('scanComponents with base classes', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'inheritance-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function warnings(): string[] {
        return warnSpy.mock.calls.map((call) => String(call[0]));
    }

    function warningsAbout(className: string): string[] {
        return warnings().filter((message) => message.includes(`ng-prism: ${className} `));
    }

    function scanned(className: string) {
        return scanComponents(findShowcasedClasses(exports, checker), checker).find((c) => c.className === className)!;
    }

    it('records inherited inputs on the scanned component', () => {
        const picker = scanned('CountryPickerComponent');

        expect(picker.inputs.map((input) => input.name)).toEqual(['label', 'showFlags', 'options', 'value', 'disabled']);
        expect(picker.outputs.map((output) => output.name)).toEqual(['blurred']);
    });

    it('records the base classes with source, nearest first', () => {
        expect(scanned('CountryPickerComponent').baseClasses).toEqual([
            { className: 'ListboxField', filePath: expect.stringMatching(/field-base\.directive\.ts$/) },
            { className: 'FieldBase', filePath: expect.stringMatching(/field-base\.directive\.ts$/) }
        ]);
    });

    // Angular does not read their inputs, but their methods are still inherited.
    it('records undecorated base classes as well', () => {
        expect(scanned('UndecoratedChildComponent').baseClasses).toEqual([{ className: 'UndecoratedBase', filePath: expect.any(String) }]);
    });

    it('leaves base classes that only exist as a declaration out of the recorded base classes', () => {
        expect(scanned('LibraryBackedComponent').baseClasses).toEqual([]);
    });

    it('warns about the inputs of a base class that only exists in a declaration file, by their public names', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('LibraryBackedComponent')).toEqual([
            expect.stringMatching(/LibraryBackedComponent inherits placeholder, maxlength from LibraryField, .*library-field\.d\.ts/)
        ]);
    });

    it('warns once for each such base class up the chain', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('LabelledLibraryComponent')).toEqual([
            expect.stringContaining('LabelledLibraryComponent inherits label from LibraryLabelledField'),
            expect.stringContaining('LabelledLibraryComponent inherits placeholder, maxlength from LibraryField')
        ]);
    });

    it('warns about an ambient base class in a .ts file like about a declaration file', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('AmbientComponent')).toEqual([
            expect.stringMatching(/AmbientComponent inherits ambientLabel, importTyped, aliased from AmbientField, .*ambient-field\.ts/)
        ]);
        expect(warningsAbout('ModuleAmbientComponent')).toEqual([expect.stringContaining('ModuleAmbientComponent inherits moduleLabel from ModuleField')]);
    });

    it('does not warn about a declaration-file base class without inputs', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('LoggingComponent')).toEqual([]);
    });

    // The Angular compiler writes ɵdir for every decorated class, so a compiled class without it is undecorated.
    it('does not warn about a compiled base class without a directive definition', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('UndecoratedLibraryComponent')).toEqual([]);
    });

    it('does not warn about base classes it can read, or about mixins', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        for (const className of ['CountryPickerComponent', 'ColorPickerComponent', 'UndecoratedChildComponent', 'MiddleChildComponent', 'MixinComponent']) {
            expect(warningsAbout(className)).toEqual([]);
        }
    });

    it('names the base class an @Input() decorator comes from', () => {
        scanComponents(findShowcasedClasses(exports, checker), checker);

        expect(warningsAbout('LegacyChildComponent')).toEqual([expect.stringContaining('LegacyChildComponent inherits @Input() decorators from LegacyBase')]);
    });

    it('warns once per base class, however many entry points export the component', () => {
        const notices = new Set<string>();

        scanComponents(findShowcasedClasses(exports, checker), checker, { notices });
        scanComponents(findShowcasedClasses(exports, checker), checker, { notices });

        expect(warningsAbout('LibraryBackedComponent')).toHaveLength(1);
        expect(warningsAbout('LegacyChildComponent')).toHaveLength(1);
    });

    // strictShowcase fails the build on diagnostics, and a base class in a
    // package is nothing the author of the component can fix.
    it('keeps the warnings out of the diagnostics', () => {
        const diagnostics: string[] = [];

        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        expect(diagnostics).toEqual([]);
    });
});

describe('scanComponents with services in the entry point', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'services', 'services-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture/toast' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const notices = new Set<string>();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices });

        return { components, diagnostics, notices };
    }

    it('leaves the services to the service scan', () => {
        const names = scan().components.map((c) => c.className);

        expect(names).not.toContain('AutoService');
        expect(names).not.toContain('OptOutService');
        expect(names).not.toContain('RootService');
        expect(names).not.toContain('PlatformService');
        expect(names).not.toContain('ManualService');
        expect(names).not.toContain('DynamicService');
    });

    it('keeps a @Service from another package and a service with a component page as components', () => {
        const names = scan().components.map((c) => c.className);

        expect(names).toContain('TypeDiService');
        expect(names).toContain('LegacyPageService');
        expect(names).toContain('SetupOnComponent');
    });

    it('notices a service that is kept a component, without counting it as a diagnostic', () => {
        const { diagnostics, notices } = scan();

        expect(notices).toContain(
            'LegacyPageService is an @Injectable/@Service with @Showcase and declares renderPage, so it is still treated as a component. ' +
                'From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.'
        );
        expect(diagnostics.filter((d) => d.startsWith('LegacyPageService'))).toEqual([]);
    });

    it('says that setup only applies to services and pipes, once per component', () => {
        const { components, diagnostics } = scan();
        const file = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'services', 'setup-on-component.component.ts'));

        expect(components.find((c) => c.className === 'SetupOnComponent')!.showcaseConfig).toEqual({ title: 'Setup on component' });
        expect(diagnostics.filter((d) => d.startsWith('SetupOnComponent'))).toEqual([
            `SetupOnComponent › setup (${file}:4:42) only applies to services and pipes (@Injectable, @Service or @Pipe); it was dropped.`
        ]);
    });

    it('says why setup is dropped from a service that its component-only fields keep a component', () => {
        const { diagnostics } = scan();
        const file = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'services', 'legacy.service.ts'));

        expect(diagnostics.filter((d) => d.startsWith('LegacySetupService › setup'))).toEqual([
            `LegacySetupService › setup (${file}:8:72) was dropped: setup only applies to services and pipes, and the class is still a component because it declares renderPage.`
        ]);
    });

    it('does not report the setup function as a runtime value', () => {
        expect(scan().diagnostics.filter((d) => d.includes('runtime value'))).toEqual([]);
    });
});

describe('scanComponents with pipes in the entry point', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'pipes', 'pipes-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture/pipes' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const notices = new Set<string>();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices });

        return { components, diagnostics, notices };
    }

    it('leaves the pipes to the pipe scan', () => {
        const names = scan().components.map((c) => c.className);

        for (const pipe of ['StandalonePipe', 'ImpurePipe', 'NgModulePipe', 'InjectablePipe', 'DynamicNamePipe', 'DynamicPurePipe']) {
            expect(names).not.toContain(pipe);
        }
    });

    it('keeps a pipe with component-only fields as a component', () => {
        const names = scan().components.map((c) => c.className);

        expect(names.sort()).toEqual(['LegacyPagePipe', 'NgModulePagePipe']);
    });

    it('notices a pipe that is kept a component, without counting it as a diagnostic', () => {
        const { diagnostics, notices } = scan();

        expect(notices).toContain(
            'LegacyPagePipe is a @Pipe with @Showcase and declares renderPage, so it is still treated as a component. ' +
                'From 23.0.0 it will be shown as a pipe and these fields will be dropped; remove them, or move the page to a componentPage.'
        );
        expect(notices).toContain(
            'NgModulePagePipe is a @Pipe with @Showcase and declares renderPage, so it is still treated as a component. ' +
                'From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.'
        );
        expect(diagnostics).toEqual([]);
    });
});

describe('scanComponents with an export index', () => {
    let checker: ts.TypeChecker;
    let entries: ResolvedEntryPoint[];

    beforeAll(() => {
        const dir = path.join(FIXTURES_DIR, 'component-api');
        const result = resolveEntryPointExports(
            [
                { entryFile: path.join(dir, 'component-api.ts'), importPath: 'fixture/components' },
                { entryFile: path.join(dir, 'component-api-types.ts'), importPath: 'fixture/types' }
            ],
            compilerOptions
        );

        checker = result.program.getTypeChecker();
        entries = result.entries;
    });

    it('sets the API of a component', () => {
        const tabsOf = (components: ScannedComponent[]) => components.find((c) => c.className === 'FixtureTabsComponent')!;
        const indexed = tabsOf(scanComponents(findShowcasedClasses(entries[0].exports, checker), checker, { exportIndex: buildExportIndex(entries, checker) }));
        const plain = tabsOf(scanComponents(findShowcasedClasses(entries[0].exports, checker), checker));

        expect(indexed.api!.types.map((t) => t.name)).toEqual(['FixtureVariant', 'FixtureTab', 'FixtureSize', 'FixtureBadge']);
        expect(indexed.api!.inputTypes['items']).toEqual({ text: 'FixtureTab[]', links: ['FixtureTab'] });
        expect(plain.api!.types).toEqual([]);
        expect(plain.api!.inputTypes['items']).toEqual({ text: 'FixtureTab[]' });
    });

    it('leaves the API out when told to', () => {
        const extract = jest.mocked(extractComponentApi);

        extract.mockClear();

        const components = scanComponents(findShowcasedClasses(entries[0].exports, checker), checker, { api: false });

        expect(components.length).toBeGreaterThan(0);
        expect(components.every((c) => c.api === undefined)).toBe(true);
        expect(extract).not.toHaveBeenCalled();
    });
});

describe('scanComponents when the API of a component cannot be read', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;
    const extract = jest.mocked(extractComponentApi);
    const realExtract = extract.getMockImplementation()!;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'component-api', 'component-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture/components' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        extract.mockImplementation((classDecl, ...rest) => {
            if (classDecl.name?.text === 'FixtureTabsComponent') throw new Error('boom');
            return realExtract(classDecl, ...rest);
        });
    });

    afterEach(() => {
        warnSpy.mockRestore();
        extract.mockImplementation(realExtract);
    });

    it('keeps scanning the component, without an API, and the others with theirs', () => {
        const components = scanComponents(findShowcasedClasses(exports, checker), checker);
        const tabs = components.find((c) => c.className === 'FixtureTabsComponent')!;

        expect(tabs).toBeDefined();
        expect(tabs.api).toBeUndefined();
        expect(tabs.inputs.map((i) => i.name)).toContain('items');
        expect(components.filter((c) => c !== tabs).every((c) => c.api !== undefined)).toBe(true);
    });

    it('says so once, however often the component is scanned, and does not count it as a diagnostic', () => {
        const diagnostics: string[] = [];
        const notices = new Set<string>();

        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices });
        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices });

        const messages = warnSpy.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('FixtureTabsComponent'));

        expect(messages).toEqual(['⚠ ng-prism: FixtureTabsComponent: could not read its API for the API page (boom); the page falls back to its inputs and outputs.']);
        expect(diagnostics).toEqual([]);
    });
});

describe('scanComponents with composition fields', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'composition-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan() {
        const diagnostics: string[] = [];
        const notices = new Set<string>();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices });
        const config = (className: string) => components.find((c) => c.className === className)!.showcaseConfig;
        const variant = (index: number) => config('FrameComponent').variants![index];

        return { diagnostics, notices, config, variant };
    }

    it('keeps template, variant host and imports', () => {
        const { config, variant } = scan();

        expect(config('FrameComponent').imports).toEqual([{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }]);
        expect(variant(0).template).toBe('<input libInput />');
        expect(variant(1).host).toEqual({ template: '<lib-frame><lib-thing /></lib-frame>' });
    });

    it('reports content and template in one variant and keeps template', () => {
        const { diagnostics, variant } = scan();

        expect(diagnostics).toContainEqual(
            expect.stringMatching(/^FrameComponent › variants\[2\] "Both" › content — .*template wins.*\(.*composition-fields\.component\.ts:\d+:\d+\)$/)
        );
        expect(variant(2).content).toBeUndefined();
        expect(variant(2).template).toBe('<input libInput />');
    });

    it('points a diagnostic at the property it is about', () => {
        const message = scan().diagnostics.find((d) => d.includes('variants[2] "Both" › content'))!;

        expect(message).toContain('(src/builder/scanner/__fixtures__/composition-fields.component.ts:17:25)');
        expect(message).not.toContain(FIXTURES_DIR);
    });

    it('reports an import that is not { name, from } strings, and drops it', () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(expect.stringMatching(/^FrameComponent › imports\[1\] — .*\(.*composition-fields\.component\.ts:13:\d+\)$/));
        expect(diagnostics).toContainEqual(expect.stringContaining('FrameComponent › imports[2] — '));
        expect(diagnostics).toContainEqual(expect.stringContaining('FrameComponent › imports[3] — '));
        expect(config('FrameComponent').imports).toHaveLength(1);
    });

    it('reports a variant host that is not { template }, and drops it', () => {
        const { diagnostics, variant } = scan();

        expect(diagnostics).toContainEqual(expect.stringMatching(/^FrameComponent › variants\[3\] "Bad host" › host — /));
        expect(diagnostics).toContainEqual(expect.stringMatching(/^FrameComponent › variants\[5\] "No template" › host — /));
        expect(variant(3)).not.toHaveProperty('host');
        expect(variant(5)).not.toHaveProperty('host');
    });

    it('reports a template that is not a string, and drops it but not the content', () => {
        const { diagnostics, variant } = scan();

        expect(diagnostics).toContainEqual(expect.stringMatching(/^FrameComponent › variants\[4\] "Bad template" › template — /));
        expect(variant(4)).not.toHaveProperty('template');
        expect(variant(4).content).toBe('Kept');
        expect(diagnostics.filter((d) => d.includes('"Bad template"'))).toHaveLength(1);
    });

    it('names an element by its position in the source when the evaluator dropped an earlier one', () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(expect.stringMatching(/^GapComponent › variants\[1\] "After gap" › content — .*template wins/));
        expect(diagnostics).toContainEqual(expect.stringMatching(/^GapComponent › imports\[2\] — /));
        expect(config('GapComponent').imports).toEqual([{ name: 'Listed', from: 'lib' }]);
    });

    it('reports exactly the invalid values and nothing about the valid ones', () => {
        const where = scan().diagnostics.map((d) => d.split(' — ')[0]);

        expect(where).toEqual([
            'FrameComponent › imports[1]',
            'FrameComponent › imports[2]',
            'FrameComponent › imports[3]',
            'FrameComponent › variants[2] "Both" › content',
            'FrameComponent › variants[3] "Bad host" › host',
            'FrameComponent › variants[4] "Bad template" › template',
            'FrameComponent › variants[5] "No template" › host',
            'GapComponent › imports[0]',
            'GapComponent › variants[0]',
            'GapComponent › imports[2]',
            'GapComponent › variants[1] "After gap" › content',
            'HostImportDirective › host.import',
            'ImportNamesComponent › imports[0]',
            'ImportNamesComponent › imports[1]',
            'ImportNamesComponent › imports[2]',
            'NoStringHostDirective › host'
        ]);
    });

    // The generated manifest imports each of them by name: anything else is a syntax error there.
    it('reports an import whose name is not a name a class is exported under, and drops it', () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(
            expect.stringMatching(
                /^ImportNamesComponent › imports\[0\] — expected the name a class is exported under, got "@angular\/cdk\/text-field"; it was dropped \(.*host-on-component\.component\.ts:\d+:\d+\)$/
            )
        );
        expect(diagnostics).toContainEqual(
            expect.stringContaining('ImportNamesComponent › imports[1] — expected the name a class is exported under, got "Cdk.TextareaAutosize"')
        );
        expect(diagnostics).toContainEqual(expect.stringContaining('ImportNamesComponent › imports[2] — expected the name a class is exported under, got "default"'));
        expect(config('ImportNamesComponent').imports).toEqual([{ name: 'QuotedDirective', from: "it's" }]);
    });

    it("reports an object host's import whose name is not a name a class is exported under, and drops the import", () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(
            expect.stringMatching(/^HostImportDirective › host\.import — expected the name a class is exported under, got "lib-frame"; it was dropped/)
        );
        expect(config('HostImportDirective').host).toEqual({ selector: 'lib-frame' });
    });

    it('reports a host whose template is no string, and drops it', () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(
            expect.stringMatching(
                /^NoStringHostDirective › host — expected \{ template: string \}, got \{"template":42\}; it was dropped \(.*host-on-component\.component\.ts:19:\d+\)$/
            )
        );
        expect(config('NoStringHostDirective')).not.toHaveProperty('host');
    });

    it('names the variants and imports of a composition by their position in the source', () => {
        const diagnostics: string[] = [];
        const notices = new Set<string>();
        const entries = [{ exports, importPath: 'fixture' }];
        const composition = createCompositionContext(() => buildDeclarableIndex(entries, checker), compilerOptions, createReporters(diagnostics, notices));
        const gap = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices, composition }).find((c) => c.className === 'GapComponent')!;

        expect(gap.composition?.variantCases).toEqual([0]);
        expect(gap.composition?.cases[0].origin).toBe('variants[1] "After gap" (src/builder/scanner/__fixtures__/composition-fields.component.ts:63:31)');
        expect([...notices]).toContainEqual(expect.stringMatching(/^GapComponent › imports\[1\] — "Listed" from "lib" is not a component, directive or pipe/));
    });

    // A notice: a component has always ignored it, so it loses nothing, and strictShowcase must not start failing over it.
    it('warns that a string or object host has no effect on a component, and drops it', () => {
        const { diagnostics, notices, config } = scan();

        expect([...notices]).toContainEqual(
            expect.stringMatching(/^HostOnComponent › host — .*has no effect on a component.*host: \{ template \}.*\(.*host-on-component\.component\.ts:7:\d+\)$/)
        );
        expect([...notices]).toContainEqual(expect.stringMatching(/^ObjectHostComponent › host — .*has no effect on a component/));
        expect(diagnostics.filter((d) => d.includes('has no effect on a component'))).toEqual([]);
        expect(config('HostOnComponent')).not.toHaveProperty('host');
        expect(config('ObjectHostComponent')).not.toHaveProperty('host');
    });

    it('keeps a host template on a component without a diagnostic', () => {
        const { diagnostics, config } = scan();

        expect(config('TemplateHostComponent').host).toEqual({ template: '<lib-frame><lib-template-host /></lib-frame>' });
        expect(diagnostics.filter((d) => d.startsWith('TemplateHostComponent'))).toEqual([]);
    });

    it('prints a diagnostic once, however often the component is scanned', () => {
        const diagnostics: string[] = [];

        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });
        scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics });

        expect(warnSpy.mock.calls.filter(([message]) => String(message).includes('FrameComponent › imports[1]'))).toHaveLength(1);
    });
});

describe('scanComponents with a string host on a directive', () => {
    it('keeps it without a diagnostic', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = resolveEntryPointExports([{ entryFile: path.join(FIXTURES_DIR, 'public-api.ts'), importPath: 'fixture' }], compilerOptions);
        const checker = result.program.getTypeChecker();
        const diagnostics: string[] = [];
        const components = scanComponents(findShowcasedClasses(result.entries[0].exports, checker), checker, { diagnostics });

        expect(components.find((c) => c.className === 'HighlightDirective')!.showcaseConfig.host).toBe('<span class="demo-text">');
        expect(diagnostics.filter((d) => d.includes('HighlightDirective'))).toEqual([]);

        warnSpy.mockRestore();
    });
});

describe('scanComponents with partOf', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'parts-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    function scan(options: ScanComponentsOptions = {}) {
        const diagnostics: string[] = [];
        const notices = new Set<string>();
        const components = scanComponents(findShowcasedClasses(exports, checker), checker, { diagnostics, notices, ...options });
        const config = (className: string) => components.find((c) => c.className === className)!.showcaseConfig;

        return { components, diagnostics, notices, config };
    }

    it('keeps a selector string, trimmed', () => {
        const { config } = scan();

        expect(config('OptionComponent').partOf).toBe('lib-select');
        expect(config('OptgroupComponent').partOf).toBe('[libSelect]');
    });

    it('drops a partOf that is not a string, as a diagnostic', () => {
        const { diagnostics, config } = scan();

        expect(diagnostics).toContainEqual(
            expect.stringMatching(
                /^NumberPartOfComponent › partOf — expected the selector of a showcased component or directive as a string, got 42; it was dropped \(.*parts-select\.component\.ts:\d+:\d+\)$/
            )
        );
        expect(config('NumberPartOfComponent')).not.toHaveProperty('partOf');
    });

    it('leaves a component without partOf as it was', () => {
        const { diagnostics, config } = scan();

        expect(config('SelectComponent')).not.toHaveProperty('partOf');
        expect(diagnostics.filter((d) => d.startsWith('SelectComponent'))).toEqual([]);
    });

    it('records where each partOf was declared', () => {
        const partOrigins = new Map<ScannedComponent, ts.Expression>();
        const { components } = scan({ partOrigins });

        expect([...partOrigins.keys()].map((c) => c.className).sort()).toEqual(
            ['ChainComponent', 'OptgroupComponent', 'OptionComponent', 'OrphanComponent', 'SelfComponent', 'TwinPartComponent'].sort()
        );
        expect(partOrigins.get(components.find((c) => c.className === 'OptionComponent')!)!.getText()).toContain("partOf: 'lib-select'");
    });
});
