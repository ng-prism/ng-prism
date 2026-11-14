import path from 'node:path';
import ts from 'typescript';
import type { InputMeta } from '../../plugin/plugin.types.js';
import { resolveEntryPointExports } from './entry-point.scanner.js';
import { extractInputs, extractOutputs } from './input.extractor.js';
import { StaticDate } from './static-date.js';

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true,
    strict: true,
    skipLibCheck: true
};

function getClassDeclaration(exports: ts.Symbol[], className: string, checker: ts.TypeChecker): ts.ClassDeclaration {
    let sym = exports.find((s) => s.name === className)!;

    // Resolve alias symbols (from re-exports)
    if (sym.flags & ts.SymbolFlags.Alias) {
        sym = checker.getAliasedSymbol(sym);
    }
    const decl = sym.declarations!.find(ts.isClassDeclaration)!;

    return decl;
}

describe('extractInputs', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should extract all inputs from ButtonComponent', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);

        expect(inputs).toHaveLength(5);
        const names = inputs.map((i) => i.name);

        expect(names).toEqual(['variant', 'label', 'disabled', 'size', 'items']);
    });

    it('should resolve union type with values', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const variant = inputs.find((i) => i.name === 'variant')!;

        expect(variant.type).toBe('union');
        expect(variant.values).toEqual(['primary', 'secondary', 'danger']);
        expect(variant.defaultValue).toBe('primary');
    });

    it('should resolve string type', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const label = inputs.find((i) => i.name === 'label')!;

        expect(label.type).toBe('string');
        expect(label.defaultValue).toBe('Button');
    });

    it('should resolve boolean type', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const disabled = inputs.find((i) => i.name === 'disabled')!;

        expect(disabled.type).toBe('boolean');
        expect(disabled.defaultValue).toBe(false);
    });

    it('should resolve number type', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const size = inputs.find((i) => i.name === 'size')!;

        expect(size.type).toBe('number');
        expect(size.defaultValue).toBe(16);
    });

    it('should resolve array type', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const items = inputs.find((i) => i.name === 'items')!;

        expect(items.type).toBe('array');
        expect(items.defaultValue).toEqual([]);
    });

    it('should extract JSDoc comments', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const variant = inputs.find((i) => i.name === 'variant')!;

        expect(variant.doc).toBe('Visual appearance of the button');
    });

    it('should mark required as false for standard inputs', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);

        for (const input of inputs) {
            expect(input.required).toBe(false);
        }
    });

    it('should extract inputs from CardComponent', () => {
        const classDecl = getClassDeclaration(exports, 'CardComponent', checker);
        const inputs = extractInputs(classDecl, checker);

        expect(inputs).toHaveLength(2);
        expect(inputs[0].name).toBe('title');
        expect(inputs[0].type).toBe('string');
        expect(inputs[1].name).toBe('bordered');
        expect(inputs[1].type).toBe('boolean');
    });
});

describe('extractInputs (signal-based)', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should extract all signal inputs from SignalButtonComponent', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);

        expect(inputs).toHaveLength(6);
        const names = inputs.map((i) => i.name);

        expect(names).toEqual(['variant', 'label', 'disabled', 'title', 'tabIndex', 'size']);
    });

    it('should resolve union type from signal type argument', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const variant = inputs.find((i) => i.name === 'variant')!;

        expect(variant.type).toBe('union');
        expect(variant.values).toEqual(['primary', 'secondary', 'danger']);
        expect(variant.defaultValue).toBe('primary');
        expect(variant.required).toBe(false);
        expect(variant.rawType).toBe("'primary' | 'secondary' | 'danger'");
    });

    it('should preserve type alias and undefined in rawType for `Alias | undefined`', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const size = inputs.find((i) => i.name === 'size')!;

        expect(size.type).toBe('union');
        expect(size.values).toEqual(['small', 'medium', 'large']);
        expect(size.rawType).toBe('ButtonSize | undefined');
    });

    it('should infer string type from signal default value', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const label = inputs.find((i) => i.name === 'label')!;

        expect(label.type).toBe('string');
        expect(label.defaultValue).toBe('Button');
        expect(label.required).toBe(false);
    });

    it('should infer boolean type from signal default value', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const disabled = inputs.find((i) => i.name === 'disabled')!;

        expect(disabled.type).toBe('boolean');
        expect(disabled.defaultValue).toBe(false);
        expect(disabled.required).toBe(false);
    });

    it('should mark input.required() as required with no defaultValue', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const title = inputs.find((i) => i.name === 'title')!;

        expect(title.type).toBe('string');
        expect(title.required).toBe(true);
        expect(title.defaultValue).toBeUndefined();
    });

    it('should extract model() inputs like signal inputs', () => {
        const classDecl = getClassDeclaration(exports, 'ModelInputComponent', checker);
        const inputs = extractInputs(classDecl, checker);

        expect(inputs).toHaveLength(2);
        expect(inputs[0].name).toBe('value');
        expect(inputs[0].type).toBe('string');
        expect(inputs[0].defaultValue).toBe('');
        expect(inputs[0].required).toBe(false);
        expect(inputs[1].name).toBe('disabled');
        expect(inputs[1].type).toBe('boolean');
        expect(inputs[1].defaultValue).toBe(false);
        expect(inputs[1].required).toBe(false);
    });

    it('marks a model() input, for which Angular adds a change output', () => {
        const model = extractInputs(getClassDeclaration(exports, 'ModelInputComponent', checker), checker);
        const signal = extractInputs(getClassDeclaration(exports, 'SignalButtonComponent', checker), checker);

        expect(model.map((i) => i.model)).toEqual([true, true]);
        expect(signal.filter((i) => 'model' in i)).toEqual([]);
    });

    it('should resolve nullable number type (number | null) as number', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const tabIndex = inputs.find((i) => i.name === 'tabIndex')!;

        expect(tabIndex.type).toBe('number');
        expect(tabIndex.defaultValue).toBeNull();
        expect(tabIndex.required).toBe(false);
    });

    it('should extract JSDoc comments from signal inputs', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const inputs = extractInputs(classDecl, checker);
        const variant = inputs.find((i) => i.name === 'variant')!;

        expect(variant.doc).toBe('Visual appearance of the button');
    });
});

describe('extractOutputs (signal-based)', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should extract all signal outputs from SignalButtonComponent', () => {
        const classDecl = getClassDeclaration(exports, 'SignalButtonComponent', checker);
        const outputs = extractOutputs(classDecl, checker);

        expect(outputs).toHaveLength(2);
        expect(outputs[0].name).toBe('clicked');
        expect(outputs[0].doc).toBe('Click event');
        expect(outputs[1].name).toBe('valueChange');
        expect(outputs[1].doc).toBe('Value change event');
    });
});

describe('extractInputs with defaults beyond literals', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];
    let inputs: Map<string, InputMeta>;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'unevaluable-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
        const classDecl = getClassDeclaration(exports, 'UnevaluableShowcaseComponent', checker);

        inputs = new Map(extractInputs(classDecl, checker).map((input) => [input.name, input]));
    });

    // The renderer applies defaultValue to the component, so the readable
    // part of a default would overwrite the real one.
    it('leaves out a default that is only partly evaluable', () => {
        expect(inputs.get('formats')!.defaultValue).toBeUndefined();
        expect(inputs.get('rules')!.defaultValue).toBeUndefined();
    });

    it('leaves out a default it cannot evaluate at all', () => {
        expect(inputs.get('maxFileSize')!.defaultValue).toBeUndefined();
    });

    it('keeps a literal default', () => {
        expect(inputs.get('label')!.defaultValue).toBe('');
    });

    it('resolves a default from an imported constant', () => {
        const classDecl = getClassDeclaration(exports, 'ConstantShowcaseComponent', checker);
        const maxFiles = extractInputs(classDecl, checker).find((input) => input.name === 'maxFiles')!;

        expect(maxFiles.defaultValue).toBe(3);
        expect(maxFiles.defaultUnreadable).toBeUndefined();
    });

    it('marks a default it cannot evaluate, whole or in part', () => {
        expect(inputs.get('maxFileSize')!.defaultUnreadable).toBe(true);
        expect(inputs.get('formats')!.defaultUnreadable).toBe(true);
        expect(inputs.get('rules')!.defaultUnreadable).toBe(true);
    });

    it('does not mark a default it read', () => {
        expect(inputs.get('label')!.defaultUnreadable).toBeUndefined();
        expect(inputs.get('label')).not.toHaveProperty('defaultUnreadable');
    });
});

describe('extractInputs with a default it cannot read', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'composition-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    function inputsOf(className: string): Map<string, InputMeta> {
        return new Map(extractInputs(getClassDeclaration(exports, className, checker), checker).map((input) => [input.name, input]));
    }

    it('marks a default it cannot evaluate', () => {
        const input = inputsOf('FrameComponent').get('computedDefault')!;

        expect(input.defaultUnreadable).toBe(true);
        expect(input.defaultValue).toBeUndefined();
    });

    it('does not mark an input without an argument', () => {
        expect(inputsOf('FrameComponent').get('plain')).not.toHaveProperty('defaultUnreadable');
    });

    it('does not mark an input with a default it read', () => {
        const label = inputsOf('FrameComponent').get('label')!;

        expect(label.defaultValue).toBe('Label');
        expect(label).not.toHaveProperty('defaultUnreadable');
    });

    it('replaces the mark of an inherited default with the value a subclass assigns it', () => {
        const inputs = inputsOf('ReinitializedComponent');

        expect(inputs.get('size')!.defaultValue).toBe('m');
        expect(inputs.get('size')).not.toHaveProperty('defaultUnreadable');
        expect(inputs.get('tone')!.defaultUnreadable).toBe(true);
    });
});

describe('extractOutputs', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should extract all outputs from ButtonComponent', () => {
        const classDecl = getClassDeclaration(exports, 'ButtonComponent', checker);
        const outputs = extractOutputs(classDecl, checker);

        expect(outputs).toHaveLength(2);
        expect(outputs[0].name).toBe('clicked');
        expect(outputs[0].doc).toBe('Click event');
        expect(outputs[1].name).toBe('doubleClicked');
        expect(outputs[1].doc).toBe('Double click event');
    });

    it('should return empty for components without outputs', () => {
        const classDecl = getClassDeclaration(exports, 'CardComponent', checker);
        const outputs = extractOutputs(classDecl, checker);

        expect(outputs).toHaveLength(0);
    });
});

describe('extractInputs and extractOutputs with base classes', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'inheritance-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    function inputsOf(className: string): Map<string, InputMeta> {
        const classDecl = getClassDeclaration(exports, className, checker);

        return new Map(extractInputs(classDecl, checker).map((input) => [input.name, input]));
    }

    function inputNames(className: string): string[] {
        return [...inputsOf(className).keys()];
    }

    function outputsOf(className: string) {
        return extractOutputs(getClassDeclaration(exports, className, checker), checker);
    }

    it('lists its own inputs first, then those of each base class up the chain', () => {
        expect(inputNames('CountryPickerComponent')).toEqual(['label', 'showFlags', 'options', 'value', 'disabled']);
    });

    it('reads an inherited input like a declared one', () => {
        const options = inputsOf('CountryPickerComponent').get('options')!;

        expect(options).toEqual({ name: 'options', type: 'array', rawType: 'ListboxItem[]', required: true, doc: 'Selectable options' });
    });

    it('reads an inherited model() with its default', () => {
        const value = inputsOf('CountryPickerComponent').get('value')!;

        expect(value.required).toBe(false);
        expect(value.defaultValue).toBeNull();
        expect(value.type).toBe('string');
        expect(value.model).toBe(true);
    });

    it('lets an input redeclared in the subclass win over the base class', () => {
        const label = inputsOf('CountryPickerComponent').get('label')!;

        expect(label.defaultValue).toBe('Country');
        expect(label.doc).toBe('Label of the country picker');
    });

    // Angular keeps the inherited input, but the component starts with the subclass's value.
    it('takes the default of an inherited input from the subclass that assigns it a value', () => {
        expect(inputsOf('LegacyChildComponent').get('title')!.defaultValue).toBe('child');
    });

    it('drops the inherited default when the value the subclass assigns cannot be read', () => {
        const count = inputsOf('LegacyChildComponent').get('count')!;

        expect(count).toBeDefined();
        expect(count.defaultValue).toBeUndefined();
        expect(count.defaultUnreadable).toBe(true);
    });

    it('does not mark an inherited input whose default the subclass assigns', () => {
        const title = inputsOf('LegacyChildComponent').get('title')!;

        expect(title.defaultValue).toBe('child');
        expect(title).not.toHaveProperty('defaultUnreadable');
    });

    it('takes the default from an undecorated class that initializes an input again', () => {
        expect(inputsOf('MiddleChildComponent').get('shared')!.defaultValue).toBe('middle-shared');
    });

    it('ignores a static member with the name of an inherited input', () => {
        expect(inputsOf('StaticShadowComponent').get('label')!.defaultValue).toBe('');
    });

    it('resolves the type parameter of a generic base class to the type argument of the subclass', () => {
        const inputs = inputsOf('ColorPickerComponent');

        expect(inputs.get('items')).toMatchObject({ type: 'array', rawType: 'Color[]', required: true });
        expect(inputs.get('selected')).toMatchObject({ type: 'union', values: ['red', 'green'], defaultValue: null });
    });

    it('keeps the declared type of an input in a generic base class that does not use the type parameter', () => {
        expect(inputsOf('ColorPickerComponent').get('size')).toMatchObject({ type: 'union', values: ['sm', 'md'], rawType: 'Size' });
    });

    it('resolves an inferred type that depends on a type parameter without naming it', () => {
        expect(inputsOf('ColorPickerComponent').get('fromMember')).toMatchObject({ type: 'union', values: ['red', 'green'] });
    });

    it('resolves type parameters through a chain of generic base classes', () => {
        expect(inputsOf('NestedPickerComponent').get('items')).toMatchObject({ type: 'array', rawType: 'Color[][]' });
    });

    it('resolves the type parameter of an @Input() in a generic base class', () => {
        expect(inputsOf('LegacyGenericComponent').get('legacy')).toMatchObject({ type: 'union', values: ['red', 'green'] });
    });

    // Angular only inherits from a class with its own directive definition.
    it('skips inputs and outputs of a base class without @Directive() or @Component()', () => {
        expect(inputNames('UndecoratedChildComponent')).toEqual(['own']);
        expect(outputsOf('UndecoratedChildComponent')).toEqual([]);
    });

    it('reads a decorated base class behind an undecorated one', () => {
        expect(inputNames('MiddleChildComponent')).toEqual(['rootInput', 'shared']);
    });

    it('collects outputs from base classes', () => {
        expect(outputsOf('ParenthesizedComponent')).toEqual([{ name: 'blurred', doc: 'Emits when the field loses focus' }]);
    });

    it('lets an output redeclared in the subclass win over the base class', () => {
        expect(outputsOf('CountryPickerComponent')).toEqual([{ name: 'blurred', doc: 'Emits when the country picker loses focus' }]);
    });

    it('finds a base class through a default export, a renamed re-export and a namespace import', () => {
        expect(inputNames('DefaultBasedComponent')).toEqual(['fromDefault']);
        expect(inputNames('BarrelDefaultComponent')).toEqual(['fromDefault']);
        expect(inputNames('RenamedBaseComponent')).toEqual(['options', 'value', 'label', 'disabled']);
    });

    it('follows a parenthesized base class', () => {
        expect(inputNames('ParenthesizedComponent')).toEqual(['label', 'disabled']);
    });

    it('stops at a base class that only exists as a declaration', () => {
        expect(inputNames('LibraryBackedComponent')).toEqual(['hint']);
        expect(inputNames('AmbientComponent')).toEqual([]);
        expect(inputNames('ModuleAmbientComponent')).toEqual([]);
    });

    it('stops at a mixin', () => {
        expect(inputNames('MixinComponent')).toEqual(['tracked']);
    });
});

describe('extractInputs and extractOutputs with aliases', () => {
    let checker: ts.TypeChecker;
    let classDecl: ts.ClassDeclaration;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'aliased-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);

        checker = result.program.getTypeChecker();
        classDecl = getClassDeclaration(result.entries[0].exports, 'AliasedInputsComponent', checker);
    });

    it('records the alias of signal inputs and models next to the member name', () => {
        const byName = new Map(extractInputs(classDecl, checker).map((i) => [i.name, i]));

        expect(byName.get('size')?.alias).toBe('buttonSize');
        expect(byName.get('label')?.alias).toBe('text');
        expect(byName.get('count')?.alias).toBe('value');
    });

    it('records the alias of @Input() in both forms', () => {
        const byName = new Map(extractInputs(classDecl, checker).map((i) => [i.name, i]));

        expect(byName.get('legacy')?.alias).toBe('legacyName');
        expect(byName.get('legacyObj')?.alias).toBe('legacyObject');
    });

    it('reads an alias from a constant', () => {
        const byName = new Map(extractInputs(classDecl, checker).map((i) => [i.name, i]));

        expect(byName.get('fromConst')?.alias).toBe('constSize');
        expect(byName.get('legacyConst')?.alias).toBe('constLegacy');
    });

    it('leaves out an alias that is missing or equals the member name', () => {
        const byName = new Map(extractInputs(classDecl, checker).map((i) => [i.name, i]));

        expect(byName.get('plain')).not.toHaveProperty('alias');
        expect(byName.get('sameName')).not.toHaveProperty('alias');
    });

    it('records the alias of outputs', () => {
        const outputs = extractOutputs(classDecl, checker);

        expect(outputs).toEqual([{ name: 'closed', alias: 'dismissed' }, { name: 'legacyEmitter', alias: 'legacyChange' }, { name: 'opened' }]);
    });
});

describe('extractInputs with Date inputs', () => {
    let inputs: Map<string, InputMeta>;

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'date-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);
        const checker = result.program.getTypeChecker();
        const classDecl = getClassDeclaration(result.entries[0].exports, 'DateInputsComponent', checker);

        inputs = new Map(extractInputs(classDecl, checker).map((input) => [input.name, input]));
    });

    function pick(name: string): InputMeta {
        return inputs.get(name)!;
    }

    // `input<T>()` without a value is an `InputSignal<T | undefined>`, so an emptied control may write `undefined`.
    it('reads input<Date>() as a date that can be emptied to undefined', () => {
        expect(pick('a')).toMatchObject({ type: 'date', emptyValue: 'undefined' });
    });

    it('gives a required Date no empty value', () => {
        expect(pick('r').type).toBe('date');
        expect(pick('r')).not.toHaveProperty('emptyValue');
    });

    it.each([
        ['Date | null', 'b', 'null'],
        ['Date | undefined', 'c', 'undefined'],
        ['an optional @Input of type Date', 'd', 'undefined'],
        ['an alias for Date | null', 'e', 'null']
    ])('reads %s as a date with its empty value', (_, name, emptyValue) => {
        expect(pick(name)).toMatchObject({ type: 'date', emptyValue });
    });

    it('keeps a union with another type and an object with a Date field apart from dates', () => {
        expect(pick('f').type).toBe('unknown');
        expect(pick('g').type).toBe('object');
    });

    it('reads a Date default with its arguments', () => {
        const { defaultValue } = pick('h');

        expect(defaultValue).toBeInstanceOf(StaticDate);
        expect((defaultValue as StaticDate).args).toEqual([2026, 0, 1]);
    });

    it('reads the type of input(new Date(…)) from its default', () => {
        expect(pick('j').type).toBe('date');
        expect(pick('j')).not.toHaveProperty('emptyValue');
    });

    it('marks new Date() as a default it cannot read', () => {
        expect(pick('i')).toMatchObject({ type: 'date', defaultUnreadable: true });
        expect(pick('i')).not.toHaveProperty('defaultValue');
    });
});
