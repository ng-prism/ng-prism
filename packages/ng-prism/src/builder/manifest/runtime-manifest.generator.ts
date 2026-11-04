import type { DirectiveHost } from '../../decorator/showcase.types.js';
import type { StyleguidePage } from '../../plugin/page.types.js';
import type { ScannedPipe } from '../../plugin/pipe.types.js';
import type { InputMeta, ScannedComponent } from '../../plugin/plugin.types.js';
import type { ScannedService } from '../../plugin/service.types.js';
import { VOID_ELEMENTS } from '../../shared/void-elements.js';
import { compositionClassName, generateCompositionClass } from './composition-wrapper.generator.js';
import { parseHostString } from './host-parser.js';
import { localName, ManifestImports } from './manifest-imports.js';
import { formatArray, formatObject, indent, inlineValue, json } from './manifest-value.js';
import { forwardedModels } from './model-changes.js';
import { firstSelectorAttribute, selectorElement } from './selector-element.js';
import { escapeTemplateLiteral } from './template-literal.js';

type Warn = (message: string) => void;

export interface RuntimeManifestOptions {
    components: ScannedComponent[];
    /** Written as data: a service's class is never imported into the styleguide. */
    services?: ScannedService[];
    /** Written as data too: a pipe's class is never imported into the styleguide. */
    pipes?: ScannedPipe[];
    libraryImportPath: string;
    pages?: StyleguidePage[];
    meta?: Record<string, unknown>;
    /**
     * Where the generator reports a host it cannot render as written. Defaults to `console.warn` under a `⚠ ng-prism:` prefix.
     * Since 22.7.0.
     */
    warn?: Warn;
}

function inputTypeAnnotation(input: InputMeta): string {
    if (input.type === 'union' && input.values) {
        return input.values.map((v) => `'${v}'`).join(' | ');
    }
    if (input.type === 'boolean') return 'boolean';
    if (input.type === 'number') return 'number';
    if (input.type === 'string') return 'string';
    if (input.type === 'array') return 'unknown[]';
    if (input.type === 'object') return 'Record<string, unknown>';
    // As in the composition wrapper: the binding then checks against `Date`, `Date | null` and `Date | undefined` alike.
    if (input.type === 'date') return 'any';
    return 'unknown';
}

function formatInputDeclaration(input: InputMeta): string {
    if (input.required) {
        const typeAnnotation = inputTypeAnnotation(input);

        return `input.required<${typeAnnotation}>()`;
    }

    if (input.type === 'date') return `input<any>(${inlineValue(input.defaultValue)})`;

    const def = input.defaultValue !== undefined ? inlineValue(input.defaultValue) : "''";
    const needsAnnotation = input.type === 'union' && input.values;

    if (needsAnnotation) {
        const typeAnnotation = inputTypeAnnotation(input);

        return `input<${typeAnnotation}>(${def})`;
    }
    return `input(${def})`;
}

function isBindableInput(input: InputMeta): boolean {
    if (input.type === 'string' || input.type === 'number' || input.type === 'boolean' || input.type === 'union') {
        return true;
    }
    // Without a default a date starts out `undefined`, which the wrapper declares; one it could not read stays the directive's.
    if (input.type === 'date') return !input.defaultUnreadable;
    return input.defaultValue !== undefined;
}

/** The class an object host renders, or `undefined` when it names none: a plain-JS config can leave `import` out, which the types would have caught. */
function objectHostImport(host: DirectiveHost): DirectiveHost['import'] | undefined {
    const { import: hostImport } = host as Partial<DirectiveHost>;

    return hostImport?.name && hostImport.from ? hostImport : undefined;
}

function hasContent(content: string | Record<string, string> | undefined): boolean {
    return typeof content === 'string' ? content !== '' : content !== undefined && Object.keys(content).length > 0;
}

/** Every variant renders in the composition wrapper: it is the component's `type`, and nothing renders through `__PrismHost`. */
function isFullyComposed(comp: ScannedComponent): boolean {
    const variantCases = comp.composition?.variantCases;

    return variantCases !== undefined && variantCases.length > 0 && variantCases.every((index) => index >= 0);
}

/** The class an object host renders, `undefined` for a directive without one or one whose variants are all composed. */
function hostWrapperImport(comp: ScannedComponent): DirectiveHost['import'] | undefined {
    const host = comp.showcaseConfig.host;

    return comp.componentMeta.isDirective && !isFullyComposed(comp) && host && typeof host === 'object' && !('template' in host) ? objectHostImport(host) : undefined;
}

function generateWrapperClass(comp: ScannedComponent, warn: Warn, localNames: ReadonlyMap<string, string>): string {
    const wrapperName = `${comp.className}__PrismHost`;
    const host = comp.showcaseConfig.host;
    const selector = comp.componentMeta.selector;
    const bindableInputs = comp.inputs.filter(isBindableInput);

    // `undefined` without a host: the element then comes from the directive's selector.
    let hostTag: string | undefined;
    let attrs = '';
    let importsArray = `[${comp.className}]`;
    let hostContentDefault = '';

    if (typeof host === 'string') {
        const parsed = parseHostString(host);

        hostTag = parsed?.tag ?? 'div';
        attrs = parsed?.attrs ? ` ${parsed.attrs}` : '';
        hostContentDefault = parsed?.content ?? '';
    } else if (host && typeof host === 'object' && !('template' in host)) {
        const hostImport = objectHostImport(host);

        if (hostImport) {
            hostTag = host.selector;
            attrs = Object.entries(host.inputs ?? {})
                .map(([k, v]) => ` ${k}="${String(v)}"`)
                .join('');
            importsArray = `[${comp.className}, ${localName(localNames, hostImport.from, hostImport.name)}]`;
        } else {
            warn(`${comp.className}: the host names no class to import (host.import), so it renders as <div>.`);
            hostTag = 'div';
        }
    }

    const element = selectorElement(selector, hostTag);
    const tag = element?.tag ?? hostTag ?? 'div';

    if (!element) {
        warn(`${comp.className}: no part of the selector "${selector}" fits the host <${tag}>, so only its first attribute is set.`);
    }
    const selectorAttributes = element ? element.attributes : firstSelectorAttribute(selector);

    // The wrapper declares its inputs and outputs under the member names and binds the directive's public ones.
    const inputBindings = bindableInputs.map((i) => ` [${i.alias ?? i.name}]="${i.name}()"`).join('');

    // The change of each `model()` it binds as well, which the scan lists no output for.
    const models = forwardedModels(comp, bindableInputs);
    const outputBindings = [
        ...comp.outputs.map((o) => ` (${o.alias ?? o.name})="${o.name}.emit($event)"`),
        ...models.map(({ member, event }) => ` (${event})="${member}.emit($event)"`)
    ].join('');

    const opening = `<${tag}${attrs}${selectorAttributes ? ` ${selectorAttributes}` : ''}${inputBindings}${outputBindings}`;
    let template: string;

    if (VOID_ELEMENTS.has(tag.toLowerCase())) {
        // A void element has no end tag and no content: Angular rejects `<input></input>` as well as `<input>{{ ... }}`.
        template = `${opening} />`;

        if (hasContent(hostContentDefault) || comp.showcaseConfig.variants?.some((v) => hasContent(v.content))) {
            warn(`${comp.className}: <${tag}> is a void element and takes no content, so the content of the host and of the variants is not rendered.`);
        }
    } else {
        template = `${opening}>{{ __prismContent__() }}</${tag}>`;
    }

    // The runtime sets `__prismContent__` on every directive, void host or not, so the wrapper declares it either way.
    const members: string[] = [];

    for (const i of bindableInputs) {
        members.push(`  ${i.name} = ${formatInputDeclaration(i)};`);
    }
    // `output<any>()`, as in the composition wrapper: the template passes on the directive's payload, whose type may
    // name a library type the manifest does not import, and `output()` alone takes only `void`.
    for (const o of comp.outputs) {
        members.push(`  ${o.name} = output<any>();`);
    }
    for (const { member } of models) {
        members.push(`  ${member} = output<any>();`);
    }
    members.push(`  __prismContent__ = input(${JSON.stringify(hostContentDefault)});`);

    const lines = [
        `@Component({`,
        `  standalone: true,`,
        `  imports: ${importsArray},`,
        `  template: \`${escapeTemplateLiteral(template)}\`,`,
        `})`,
        `class ${wrapperName} {`,
        ...members,
        `}`
    ];

    return lines.join('\n');
}

/**
 * The classes the manifest imports. The showcased components come first, each by its own name, then the classes of
 * the host wrappers and of the composition wrappers, which take an alias where another class has the name.
 */
function collectImports(components: ScannedComponent[], libraryImportPath: string): ManifestImports {
    // What the module declares, imports or writes values with besides the classes: no class may take these identifiers.
    const imports = new ManifestImports(['Component', 'computed', 'input', 'output', 'RuntimeManifest', 'PRISM_RUNTIME_MANIFEST', 'Date']);

    for (const comp of components) {
        imports.keep(comp.importPath ?? libraryImportPath, comp.className);
    }
    for (const comp of components) {
        const hostImport = hostWrapperImport(comp);

        if (hostImport) imports.local(hostImport.from, hostImport.name);
    }
    for (const comp of components) {
        for (const { from, name } of comp.composition?.imports ?? []) {
            imports.local(from, name);
        }
    }
    return imports;
}

const defaultWarn: Warn = (message) => console.warn(`⚠ ng-prism: ${message}`);

export function generateRuntimeManifest(options: RuntimeManifestOptions): string {
    const { components, services, pipes, libraryImportPath, pages, meta, warn = defaultWarn } = options;

    const directives = components.filter((c) => c.componentMeta.isDirective);
    const hostWrapped = directives.filter((c) => !isFullyComposed(c));
    const composed = components.filter((c) => c.composition);
    const hasWrappers = directives.length > 0 || composed.length > 0;

    const lines: string[] = ['// AUTO-GENERATED by ng-prism. Do not edit!', "import type { RuntimeManifest } from '@ng-prism/core/plugin';"];

    if (hasWrappers) {
        lines.push(`import { ${['Component', ...(composed.length > 0 ? ['computed'] : []), 'input', 'output'].join(', ')} } from '@angular/core';`);
    }

    const imports = collectImports(components, libraryImportPath);
    const localNames = imports.names();

    lines.push(...imports.lines());

    if (hasWrappers) {
        lines.push('');
        for (const comp of hostWrapped) {
            lines.push(generateWrapperClass(comp, warn, localNames));
            lines.push('');
        }
        for (const comp of composed) {
            lines.push(generateCompositionClass(comp, comp.composition!, localNames));
            lines.push('');
        }
    }

    lines.push('');
    lines.push('export const PRISM_RUNTIME_MANIFEST: RuntimeManifest = {');
    lines.push('  components: [');

    for (const comp of components) {
        const wrapperName = comp.composition ? compositionClassName(comp.className) : undefined;
        const typeName = isFullyComposed(comp) ? wrapperName : comp.componentMeta.isDirective ? `${comp.className}__PrismHost` : comp.className;

        lines.push('    {');
        lines.push(`      type: ${typeName},`);
        if (wrapperName) lines.push(`      composition: ${wrapperName},`);
        lines.push(`      meta: ${formatMeta(comp, 6)},`);
        if (comp.parts && comp.parts.length > 0) pushParts(lines, comp.parts);
        lines.push('    },');
    }

    lines.push('  ],');

    pushDataEntries(lines, 'services', services);
    pushDataEntries(lines, 'pipes', pipes);

    if (pages && pages.length > 0) {
        lines.push(
            `  pages: ${JSON.stringify(pages, null, 2)
                .split('\n')
                .map((l, i) => (i === 0 ? l : '  ' + l))
                .join('\n')},`
        );
    }

    if (meta && Object.keys(meta).length > 0) {
        // Like every other value: a `Date` a plugin put here reaches the browser as a `Date`.
        lines.push(`  meta: ${formatObject(meta, 2)},`);
    }

    lines.push('};');
    lines.push('');

    return lines.join('\n');
}

/**
 * A part is `{ meta }` and nothing else, like a service or a pipe: the styleguide renders it through the variants of its
 * parent, so it has no `type`, and its class is imported only when a composition of the parent names it.
 */
function pushParts(lines: string[], parts: ScannedComponent[]): void {
    lines.push('      parts: [');

    for (const part of parts) {
        lines.push('        {');
        lines.push(`          meta: ${formatMeta(part, 10)},`);
        lines.push('        },');
    }

    lines.push('      ],');
}

/** A service or a pipe is `{ meta }` and nothing else: the styleguide never imports its class. Writes no line when there is none. */
function pushDataEntries(lines: string[], key: 'services' | 'pipes', items: ScannedService[] | ScannedPipe[] | undefined): void {
    if (!items || items.length === 0) return;

    lines.push(`  ${key}: [`);

    for (const item of items) {
        lines.push('    {');
        lines.push(`      meta: ${formatObject(item as unknown as Record<string, unknown>, 6)},`);
        lines.push('    },');
    }

    lines.push('  ],');
}

function formatMeta(comp: ScannedComponent, baseIndent: number): string {
    const inner = baseIndent + 2;
    const lines = [
        `${indent(inner)}className: ${json(comp.className)},`,
        `${indent(inner)}filePath: ${json(comp.filePath)},`,
        // The entry point the class is imported from; a plugin's API page names it, e.g. in a usage snippet.
        ...(comp.importPath ? [`${indent(inner)}importPath: ${json(comp.importPath)},`] : []),
        `${indent(inner)}showcaseConfig: ${formatObject(comp.showcaseConfig as unknown as Record<string, unknown>, inner)},`,
        `${indent(inner)}inputs: ${formatArray(comp.inputs, inner)},`,
        `${indent(inner)}outputs: ${formatArray(comp.outputs, inner)},`,
        `${indent(inner)}componentMeta: ${formatObject(comp.componentMeta, inner)},`
    ];

    if (comp.api) {
        lines.push(`${indent(inner)}api: ${formatObject(comp.api as unknown as Record<string, unknown>, inner)},`);
    }

    if (comp.composition) {
        // Without `origin`, which only the comments of the generated code use. `imports` stays: a plugin's usage example names them.
        const { variantCases, cases, imports } = comp.composition;
        const data = { variantCases, cases: cases.map(({ template, unbound }) => ({ template, unbound })), imports };

        lines.push(`${indent(inner)}composition: ${formatObject(data, inner)},`);
    }

    if (comp.meta && Object.keys(comp.meta).length > 0) {
        lines.push(`${indent(inner)}meta: ${formatObject(comp.meta as Record<string, unknown>, inner)},`);
    }

    return `{\n${lines.join('\n')}\n${indent(baseIndent)}}`;
}
