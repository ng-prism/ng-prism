import { relative } from 'node:path';
import type { ComponentComposition, CompositionCase, InputMeta, ScannedComponent } from '../../plugin/plugin.types.js';
import { COMPOSITION_SUBJECT_ATTR, COMPOSITION_SUBJECT_SLOT, PRISM_VARIANT_INPUT } from '../../shared/composition.js';
import { localName } from './manifest-imports.js';
import { inlineValue } from './manifest-value.js';
import { escapeTemplateLiteral } from './template-literal.js';

/** The member the template switches on: the case of the variant the wrapper is set to. */
const CASE_MEMBER = '__prismCase__';

/** The name of the generated wrapper that renders the compositions of `className`. */
export function compositionClassName(className: string): string {
    return `${className}__PrismComposition`;
}

/** `input<any>()`: the wrapper declares every input untyped, as the template of a case binds it to the subject, which checks it. */
function formatInputDeclaration(input: InputMeta): string {
    return input.required ? 'input.required<any>()' : `input<any>(${inlineValue(input.defaultValue)})`;
}

/**
 * What goes where {@link COMPOSITION_SUBJECT_SLOT} stands: the marker of the subject, its inputs this case binds, and
 * every output. The members are read with `this.`, so that a variable the author's markup declares around the subject
 * (`@for (label of …)`, `@let label`, `#label`) cannot take the place of the wrapper's own `label`.
 */
function subjectBindings(comp: ScannedComponent, unbound: ReadonlySet<string>): string {
    const inputs = comp.inputs.filter((input) => !unbound.has(input.name)).map((input) => ` [${input.alias ?? input.name}]="this.${input.name}()"`);
    const outputs = comp.outputs.map((output) => ` (${output.alias ?? output.name})="this.${output.name}.emit($event)"`);

    return ` ${COMPOSITION_SUBJECT_ATTR}${inputs.join('')}${outputs.join('')}`;
}

/** The `@case` of one composition: where it comes from as an HTML comment, then its markup with the subject's bindings in the slot. */
function formatCase(comp: ScannedComponent, composition: CompositionCase, index: number): string {
    const bindings = subjectBindings(comp, new Set(composition.unbound.map(({ name }) => name)));
    // A variant name is free text: `--` could end the comment early, so it becomes two hyphens of another kind.
    const origin = composition.origin === undefined ? '' : `<!-- ${composition.origin.replace(/--/g, '\u2010\u2010')} -->\n`;

    return `@case (${index}) {\n${origin}${composition.template.replace(COMPOSITION_SUBJECT_SLOT, () => bindings)}\n}`;
}

/**
 * The AOT-compiled wrapper that renders the compositions of one showcase: a `@switch` over its cases, the one that
 * `__prismVariant__` selects through `variantCases`. Each case is the author's markup with the subject element
 * bound to the wrapper's own inputs and outputs, which are the subject's re-declared under their member names, as in
 * the host wrapper of a directive. An input is declared when at least one case binds it.
 *
 * `localNames` holds the identifier of each class in `composition.imports` that differs from its name, by
 * `importKey`.
 */
export function generateCompositionClass(comp: ScannedComponent, composition: ComponentComposition, localNames: ReadonlyMap<string, string>): string {
    const { cases, variantCases } = composition;
    const imports = new Set([comp.className, ...(composition.imports ?? []).map(({ name, from }) => localName(localNames, from, name))]);
    const template = `@switch (${CASE_MEMBER}()) {\n${cases.map((entry, index) => formatCase(comp, entry, index)).join('\n')}\n}`;
    const isBound = (input: InputMeta) => cases.some(({ unbound }) => !unbound.some(({ name }) => name === input.name));

    const members = [
        ...comp.inputs.filter(isBound).map((input) => `  ${input.name} = ${formatInputDeclaration(input)};`),
        ...comp.outputs.map((output) => `  ${output.name} = output<any>();`),
        `  ${PRISM_VARIANT_INPUT} = input(0);`,
        `  protected ${CASE_MEMBER} = computed(() => [${variantCases.join(', ')}][this.${PRISM_VARIANT_INPUT}()]);`
    ];

    // The scan holds the absolute path: the comment names it relative to the working directory, and in one line whatever the path holds.
    const header = `${comp.className} · ${relative(process.cwd(), comp.filePath)}`.replace(/\s+/g, ' ');

    return [
        `// ${header}`,
        `@Component({`,
        `  standalone: true,`,
        `  imports: [${[...imports].join(', ')}],`,
        `  host: { style: 'display: block' },`,
        `  template: \`${escapeTemplateLiteral(template)}\`,`,
        `})`,
        `class ${compositionClassName(comp.className)} {`,
        ...members,
        `}`
    ].join('\n');
}
