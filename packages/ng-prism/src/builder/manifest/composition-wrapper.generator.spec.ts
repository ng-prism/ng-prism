import { join } from 'node:path';
import ts from 'typescript';
import type { ComponentComposition, ScannedComponent } from '../../plugin/plugin.types.js';
import { COMPOSITION_SUBJECT_ATTR, COMPOSITION_SUBJECT_SLOT } from '../../shared/composition.js';
import { extractTemplate, FRAME } from './__test-utils__/composition-fixtures.js';
import { templateErrors } from './__test-utils__/template-errors.js';
import { compositionClassName, generateCompositionClass } from './composition-wrapper.generator.js';

const SLOT = COMPOSITION_SUBJECT_SLOT;
const HYPHEN = String.fromCharCode(0x2010);

function frame(composition: Partial<ComponentComposition>, subject: Partial<ScannedComponent> = {}): ScannedComponent {
    return { ...FRAME, ...subject, composition: { ...FRAME.composition!, ...composition } };
}

function generate(subject: ScannedComponent, localNames: ReadonlyMap<string, string> = new Map()): string {
    return generateCompositionClass(subject, subject.composition!, localNames);
}

/** The template of `code`, which must parse as an Angular template. */
function template(code: string): string {
    const text = extractTemplate(code);

    expect(text).toBeDefined();
    expect(templateErrors(text!)).toEqual([]);
    return text!;
}

describe('compositionClassName', () => {
    it('names the wrapper after the class', () => {
        expect(compositionClassName('FormFieldComponent')).toBe('FormFieldComponent__PrismComposition');
    });
});

describe('generateCompositionClass', () => {
    it('binds the subject in every case and parses', () => {
        const code = generate(FRAME);
        const text = template(code);

        expect(text).toContain(
            '<lib-form-field data-prism-subject [label]="this.label()" (cleared)="this.cleared.emit($event)"><input libInput type="email" /></lib-form-field>'
        );
        expect(text).toContain(
            '<lib-form-field data-prism-subject [label]="this.label()" (cleared)="this.cleared.emit($event)"><textarea libInput></textarea></lib-form-field>'
        );
        expect(text.match(new RegExp(COMPOSITION_SUBJECT_ATTR, 'g'))).toHaveLength(3);
        expect(text).not.toContain(SLOT);
        expect(code).toContain('label = input<any>("")');
        expect(code).toContain('cleared = output<any>()');
        expect(code).toContain('__prismVariant__ = input(0)');
        expect(code).toContain('protected __prismCase__ = computed(() => [0, 1, 2, 0][this.__prismVariant__()])');
    });

    it('switches on the case, one @case per composition', () => {
        const text = template(generate(FRAME));

        expect(text).toMatch(/^@switch \(__prismCase__\(\)\) \{/);
        expect([...text.matchAll(/@case \((\d+)\) \{/g)].map((match) => match[1])).toEqual(['0', '1', '2']);
    });

    it('declares a standalone wrapper that imports the subject and the classes of the composition', () => {
        const code = generate(FRAME);

        expect(code).toContain('standalone: true,');
        expect(code).toContain('imports: [FormFieldComponent, InputDirective, IconComponent],');
        expect(code).toContain("host: { style: 'display: block' },");
        expect(code).toContain('class FormFieldComponent__PrismComposition {');
        expect(code.startsWith('// FormFieldComponent · src/lib/form-field/form-field.component.ts\n@Component({')).toBe(true);
    });

    it('imports a class under the identifier it has in the manifest', () => {
        const code = generate(FRAME, new Map([['my-lib/icon#IconComponent', 'IconComponent__2']]));

        expect(code).toContain('imports: [FormFieldComponent, InputDirective, IconComponent__2],');
    });

    it('imports a class once, and not the subject twice', () => {
        const subject = frame({
            imports: [
                { name: 'InputDirective', from: 'my-lib' },
                { name: 'InputDirective', from: 'my-lib' },
                { name: 'FormFieldComponent', from: 'my-lib' }
            ]
        });

        expect(generate(subject)).toContain('imports: [FormFieldComponent, InputDirective],');
    });

    it('imports the subject alone when the composition imports nothing', () => {
        expect(generate(frame({ imports: undefined }))).toContain('imports: [FormFieldComponent],');
        expect(generate(frame({ imports: [] }))).toContain('imports: [FormFieldComponent],');
    });

    it('leaves inputs unbound where the case says so', () => {
        const subject = frame(
            {
                cases: [
                    { template: `<lib-form-field${SLOT} />`, unbound: [{ name: 'required', reason: 'template' }] },
                    { template: `<lib-form-field${SLOT} required />`, unbound: [] }
                ],
                variantCases: [0, 1]
            },
            {
                inputs: [
                    { name: 'label', type: 'string', defaultValue: '', required: false },
                    { name: 'required', type: 'boolean', defaultValue: false, required: false }
                ]
            }
        );
        const code = generate(subject);
        const text = template(code);

        expect(text).toContain('@case (0) {\n<lib-form-field data-prism-subject [label]="this.label()" (cleared)="this.cleared.emit($event)" />');
        expect(text).toContain(
            '@case (1) {\n<lib-form-field data-prism-subject [label]="this.label()" [required]="this.required()" (cleared)="this.cleared.emit($event)" required />'
        );
        // Bound in the second case, so the wrapper declares it.
        expect(code).toContain('required = input<any>(false)');
    });

    it('does not declare an input that no case binds', () => {
        const subject = frame(
            {
                cases: [{ template: `<lib-form-field${SLOT} label="Fixed" />`, unbound: [{ name: 'label', reason: 'template' }] }],
                variantCases: [0]
            },
            { outputs: [] }
        );
        const code = generate(subject);

        expect(code).not.toContain('label = ');
        expect(code).not.toContain('[label]');
        expect(template(code)).toContain('<lib-form-field data-prism-subject label="Fixed" />');
    });

    it('leaves out an input with an unreadable default where no variant sets it', () => {
        const subject = frame(
            {
                cases: [
                    { template: `<lib-form-field${SLOT} />`, unbound: [{ name: 'items', reason: 'default' }] },
                    { template: `<lib-form-field${SLOT} />`, unbound: [] }
                ],
                variantCases: [0, 1]
            },
            { inputs: [{ name: 'items', type: 'array', defaultUnreadable: true, required: false }], outputs: [] }
        );
        const text = template(generate(subject));

        expect(text).toContain('@case (0) {\n<lib-form-field data-prism-subject />');
        expect(text).toContain('@case (1) {\n<lib-form-field data-prism-subject [items]="this.items()" />');
    });

    it('declares an input without a default as undefined and a required one as required', () => {
        const subject = frame(
            {},
            {
                inputs: [
                    { name: 'items', type: 'array', required: false },
                    { name: 'label', type: 'string', required: true },
                    { name: 'size', type: 'number', defaultValue: 16, required: false },
                    { name: 'config', type: 'object', defaultValue: { dense: true, tags: ['a'] }, required: false }
                ]
            }
        );
        const code = generate(subject);

        expect(code).toContain('items = input<any>(undefined);');
        expect(code).toContain('label = input.required<any>();');
        expect(code).toContain('size = input<any>(16);');
        expect(code).toContain('config = input<any>({"dense":true,"tags":["a"]});');
    });

    it('declares members under their names and binds the subject by the alias', () => {
        const subject = frame(
            {},
            {
                inputs: [{ name: 'labelText', alias: 'label', type: 'string', defaultValue: '', required: false }],
                outputs: [{ name: 'clearedEvent', alias: 'cleared' }]
            }
        );
        const code = generate(subject);

        expect(code).toContain('labelText = input<any>("")');
        expect(code).toContain('clearedEvent = output<any>()');
        expect(template(code)).toContain('<lib-form-field data-prism-subject [label]="this.labelText()" (cleared)="this.clearedEvent.emit($event)">');
    });

    it('does not read the bindings as replacement patterns', () => {
        const subject = frame({}, { inputs: [{ name: '$input', alias: '$&', type: 'string', defaultValue: '', required: false }], outputs: [] });

        expect(extractTemplate(generate(subject))).toContain('data-prism-subject [$&]="this.$input()"');
    });

    it('generates the one case of a showcase without variants', () => {
        const subject = frame({ variantCases: [0], cases: [FRAME.composition!.cases[0]] });
        const code = generate(subject);

        expect(template(code)).toContain('@case (0) {');
        expect(code).toContain('computed(() => [0][this.__prismVariant__()])');
    });

    it('keeps a variant without a composition out of every case', () => {
        const code = generate(frame({ variantCases: [0, -1, 1, 2] }));

        expect(code).toContain('computed(() => [0, -1, 1, 2][this.__prismVariant__()])');
        expect(extractTemplate(code)).not.toContain('@case (-1)');
    });

    it('says where each case comes from in a comment, without a way out of it', () => {
        const text = template(
            generate(
                frame({
                    cases: [{ template: `<lib-form-field${SLOT} />`, unbound: [], origin: 'variants[0] "a --> b -- c" (src/x.ts:1:2)' }],
                    variantCases: [0]
                })
            )
        );

        expect(text).toContain(`<!-- variants[0] "a ${HYPHEN}${HYPHEN}> b ${HYPHEN}${HYPHEN} c" (src/x.ts:1:2) -->`);
        expect(text).not.toMatch(/<!--(?:(?!-->)[\s\S])*-->(?:(?!<!--)[\s\S])*-->/);
    });

    it('writes no comment for a case without an origin', () => {
        const text = template(generate(frame({ cases: [{ template: `<lib-form-field${SLOT} />`, unbound: [] }], variantCases: [0] })));

        expect(text).not.toContain('<!--');
    });

    it('survives backticks, ${, backslashes and --> in templates and names', () => {
        // The `-->` is in the variant name only: in the markup, it would be the author's own text.
        const nasty = 'a\\b `c` ${d}';
        const subject = frame({
            cases: [
                {
                    template: `<lib-form-field${SLOT} title="${nasty}"><!-- ${nasty} --><input libInput /></lib-form-field>`,
                    unbound: [],
                    origin: `variants[0] "${nasty} --> e" (src/x.ts:1:2)`
                }
            ],
            variantCases: [0]
        });
        const code = generate(subject);
        const { diagnostics } = ts.transpileModule(code, { reportDiagnostics: true });
        const text = template(code);

        expect(diagnostics).toEqual([]);
        expect(text).toContain(`title="${nasty}"><!-- ${nasty} -->`);
        expect(text).toContain(`"${nasty} ${HYPHEN}${HYPHEN}> e"`);
        expect(text).not.toMatch(/<!--(?:(?!-->)[\s\S])*-->(?:(?!<!--)[\s\S])*-->/);
    });

    it('keeps the header on one line', () => {
        const code = generate(frame({}, { filePath: 'src/lib/a\nb.ts' }));

        expect(code.split('\n')[0]).toBe('// FormFieldComponent · src/lib/a b.ts');
    });

    it('names the file in the header relative to the working directory, where the scan holds it absolute', () => {
        const code = generate(frame({}, { filePath: join(process.cwd(), 'src', 'lib', 'form-field', 'form-field.component.ts') }));

        expect(code.split('\n')[0]).toBe(`// FormFieldComponent · ${join('src', 'lib', 'form-field', 'form-field.component.ts')}`);
        expect(code).not.toContain(process.cwd());
    });

    // A variable the author declares around the subject must not take the place of the wrapper's member of that name.
    it.each([
        ['@for', `@for (label of ['a', 'b']; track label) {<lib-form-field${SLOT}>{{ label }}</lib-form-field>}`],
        ['@let', `@let label = 'a';<lib-form-field${SLOT}>{{ label }}</lib-form-field>`],
        ['a template reference', `<p #label>x</p><lib-form-field${SLOT}>{{ label.textContent }}</lib-form-field>`]
    ])('binds the members through this. when the markup declares a variable of the same name with %s', (_name, markup) => {
        const subject = frame({ cases: [{ template: markup, unbound: [] }], variantCases: [0] });
        const text = template(generate(subject));

        expect(text).toContain('<lib-form-field data-prism-subject [label]="this.label()" (cleared)="this.cleared.emit($event)">');
        expect(text).not.toMatch(/[^.]\blabel\(\)/);
        expect(text).not.toMatch(/[^.]\bcleared\.emit/);
    });
});

describe('generateCompositionClass with a model()', () => {
    const MODEL = { name: 'value', alias: 'date', type: 'date' as const, required: false, model: true as const };

    it('passes on the change of a model the case binds, under the name Angular gives it', () => {
        const subject = frame({ cases: [{ template: `<lib-form-field${SLOT} />`, unbound: [] }], variantCases: [0] }, { inputs: [MODEL], outputs: [] });
        const code = generate(subject);

        expect(code).toContain('  valueChange = output<any>();');
        expect(template(code)).toContain('(dateChange)="this.valueChange.emit($event)"');
    });

    it('passes on nothing in a case that leaves the model unbound', () => {
        const subject = frame(
            {
                cases: [
                    { template: `<lib-form-field${SLOT} />`, unbound: [] },
                    { template: `<lib-form-field${SLOT} [date]="d" />`, unbound: [{ name: 'value', reason: 'template' }] }
                ],
                variantCases: [0, 1]
            },
            { inputs: [MODEL], outputs: [] }
        );
        const text = template(generate(subject));

        expect(text.match(/\(dateChange\)/g)).toHaveLength(1);
    });

    it('leaves a change output the component declares itself alone', () => {
        const subject = frame(
            { cases: [{ template: `<lib-form-field${SLOT} />`, unbound: [] }], variantCases: [0] },
            { inputs: [MODEL], outputs: [{ name: 'valueChange', alias: 'dateChange' }] }
        );
        const code = generate(subject);

        expect(code.match(/valueChange = output<any>\(\);/g)).toHaveLength(1);
        expect(template(code).match(/\(dateChange\)/g)).toHaveLength(1);
    });
});
