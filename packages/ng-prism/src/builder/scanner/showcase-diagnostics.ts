import { relative } from 'node:path';
import ts from 'typescript';
import { evaluateExpression, type EvaluationPath, getDecoratorArgument, type UnevaluableIssue, type UnresolvedReference } from './ast-utils.js';
import type { UnreadableBase } from './class-hierarchy.js';

const MAX_EXCERPT_LENGTH = 60;

const CAUSES: Record<UnresolvedReference['kind'], string> = {
    let: 'is declared with let; only const declarations can be read',
    var: 'is declared with var; only const declarations can be read',
    'no-value': 'is declared without a value, as in a .d.ts file or with declare',
    cycle: 'refers back to itself',
    'runtime-value': 'is a function or class, which only exists at runtime',
    'current-time': 'is the current time, which differs in every build',
    'invalid-date': 'is an invalid date'
};
const CONSEQUENCES: Record<UnevaluableIssue['reason'], string> = {
    unsupported: 'cannot be evaluated statically and was dropped',
    'runtime-value': 'is a runtime value (function, class or instance) and cannot be part of the static manifest; it was dropped',
    'current-time':
        'is the current time, which differs in every build and every visual regression run, so it was dropped; write the date out instead, such as new Date(2026, 3, 28)',
    'invalid-date': 'is an invalid date and was dropped'
};
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Describe one value the scanner had to drop from a `@Showcase` config:
 * which component, where in the config, what the source said and where.
 *
 * `SguiFileInputComponent › variants[3] "Auto hint" › inputs.maxFileSize — "megabytes(5)" (src/file-input.component.ts:27:22) cannot be evaluated statically and was dropped.`
 */
export function describeUnevaluable(className: string, config: ts.Expression, issue: UnevaluableIssue): string {
    const isRoot = issue.node === config;
    const where = issue.path.length === 0 ? '@Showcase' : formatShowcasePath(issue.path, config);
    const consequence = isRoot ? 'cannot be evaluated statically, so the component is skipped' : CONSEQUENCES[issue.reason];

    const cause = issue.cause ? `: ${excerpt(issue.cause.node)} ${CAUSES[issue.cause.kind]}` : '';

    return `${className} › ${where} — "${excerpt(issue.node)}" (${location(issue.node)}) ${consequence}${cause}.`;
}

/**
 * Describe a value of a `@Showcase` config that is valid to the evaluator but not to the scan: which component, where
 * in the config, what is wrong and where. `path` is read as in {@link describeUnevaluable}, with array indices as
 * written in the source. The location is the node at `path` when the literal has one, else the whole config.
 *
 * `FormFieldComponent › variants[2] "Both" › content — set together with template; template wins and content was dropped (src/form-field.component.ts:31:9)`
 */
export function describeShowcaseIssue(className: string, config: ts.Expression, path: EvaluationPath, text: string): string {
    return `${className} › ${formatShowcasePath(path, config)} — ${text} (${location(nodeAtPath(config, path) ?? config)})`;
}

/**
 * Name the places of a `@Showcase` config that something comes from, and where the first of them is written, read as
 * in {@link describeShowcaseIssue}.
 *
 * `variants[0] "Default", variants[3] "Again" (src/form-field.component.ts:20:9)`
 */
export function describeShowcaseOrigin(config: ts.Expression, paths: readonly EvaluationPath[]): string {
    return `${paths.map((path) => formatShowcasePath(path, config)).join(', ')} (${location((paths[0] && nodeAtPath(config, paths[0])) ?? config)})`;
}

/**
 * A service or a pipe that declares `partOf`: the styleguide shows parts on the page of a component or directive, so
 * there is nothing for it to be a part of or to have parts. Points at the `partOf` property.
 *
 * `OptionPipe › partOf — only a component or directive can be part of another; it was dropped (src/option.pipe.ts:5:36)`
 */
export function describePartOfOnServiceOrPipe(className: string, config: ts.Expression): string {
    return describeShowcaseIssue(className, config, ['partOf'], 'only a component or directive can be part of another; it was dropped');
}

/**
 * `providers` never reached the manifest: classes, factories and instances
 * cannot be written into static data. One message for the field, not one per
 * provider, because none of them could have been kept. It points at the
 * literal property if there is one, else at `found`, a provider the scan came
 * across through a spread or a constant, else at the whole config.
 */
export function describeDeprecatedProviders(className: string, config: ts.Expression, found?: ts.Node): string {
    const literal = ts.isObjectLiteralExpression(config) ? findProperty(config, 'providers') : undefined;

    return (
        `${className} declares @Showcase providers (${location(literal ?? found ?? config)}), which are deprecated and will be removed in 23.0.0; ` +
        `the manifest is static and cannot hold them, so they never reach the styleguide. Use defineConfig({ appProviders }) instead.`
    );
}

/**
 * A base class from a package only ships its declarations: no `input()`
 * call, no required flag, no default. Its inputs are named so the reader
 * knows which variant values will not reach the component.
 */
export function describeUnreadableBase(className: string, base: UnreadableBase): string {
    const baseName = base.classDecl.name?.text ?? 'an anonymous class';

    return (
        `${className} inherits ${base.inputs.join(', ')} from ${baseName}, which only exists as a declaration (${location(base.classDecl)}); ` +
        `without its source these inputs cannot be read, so they are missing from the manifest and variants cannot set them.`
    );
}

/**
 * A class with `@Injectable` or `@Service` that still declares fields only a
 * component can use. Shown as a component for now, so nothing is lost, but
 * the service page will not have these fields, which is why it is said early.
 */
export function describeLegacyServiceComponent(className: string, fields: string[]): string {
    return (
        `${className} is an @Injectable/@Service with @Showcase and declares ${fields.join(', ')}, so it is still treated as a component. ` +
        `From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.`
    );
}

/**
 * A class with `@Pipe` that still declares fields only a component can use:
 * the pipe counterpart of {@link describeLegacyServiceComponent}. A pipe declared
 * in an NgModule (`standalone: false`) has more to lose, since ng-prism will not
 * show it at all.
 */
export function describeLegacyPipeComponent(className: string, fields: string[], standalone: boolean): string {
    const lead = `${className} is a @Pipe with @Showcase and declares ${fields.join(', ')}, so it is still treated as a component. `;

    return standalone
        ? `${lead}From 23.0.0 it will be shown as a pipe and these fields will be dropped; remove them, or move the page to a componentPage.`
        : `${lead}From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.`;
}

/** A pipe declared in an NgModule cannot be called from a template the styleguide builds, so it is not shown. */
export function describePipeNotStandalone(className: string, node: ts.Node): string {
    return `${className} › @Pipe (${location(node)}) is declared with standalone: false; ng-prism shows standalone pipes only, so it was dropped.`;
}

/**
 * The name is what a template calls the pipe by; without it the pipe has no
 * usage to show. It points at the `name` property of the `@Pipe({ … })`
 * literal if there is one, else at the decorator.
 */
export function describePipeNameUnreadable(className: string, decorator: ts.Decorator): string {
    const arg = getDecoratorArgument(decorator);
    const name = arg && ts.isObjectLiteralExpression(arg) ? findProperty(arg, 'name') : undefined;

    return `${className} › @Pipe name (${location(name ?? decorator)}) cannot be evaluated statically, so the pipe was dropped.`;
}

/** `setup` lists what configures a service or a pipe; a component has no use for it, and says so instead of silently ignoring it. */
export function describeSetupOnComponent(className: string, node: ts.Node): string {
    return `${className} › setup (${location(node)}) only applies to services and pipes (@Injectable, @Service or @Pipe); it was dropped.`;
}

/**
 * {@link describeSetupOnComponent} for a service or pipe that its component-only `fields` still keep a component:
 * the class has the decorator the generic message names, so it says why that is not enough.
 */
export function describeSetupOnLegacyComponent(className: string, node: ts.Node, fields: string[]): string {
    return `${className} › setup (${location(node)}) was dropped: setup only applies to services and pipes, and the class is still a component because it declares ${fields.join(', ')}.`;
}

/**
 * The notice for an API the extractor could not read. A notice, not a diagnostic: no `@Showcase` value was dropped,
 * so strictShowcase does not fail over it. A component keeps its page, which falls back to its inputs and outputs;
 * a service or a pipe has nothing else to show and is left out.
 */
export function describeUnreadableApi(className: string, error: unknown, kind: 'component' | 'service' | 'pipe'): string {
    const reason = error instanceof Error ? error.message : String(error);

    return kind === 'component'
        ? `${className}: could not read its API for the API page (${reason}); the page falls back to its inputs and outputs.`
        : `${className}: could not read its API (${reason}); the ${kind} is left out of the styleguide.`;
}

/**
 * `setup` has to be readable without running anything: an arrow function whose
 * body is an array literal. Anything else drops the whole field, since there is
 * no telling which entries it would have listed.
 */
export function describeInvalidSetup(className: string, node: ts.Node): string {
    return (
        `${className} › setup — "${excerpt(node)}" (${location(node)}) must be an arrow function returning an array literal, ` +
        `e.g. setup: () => [provideX]; setup was dropped.`
    );
}

/** The styleguide shows where to import a `setup` entry from, which it only knows for what a library entry point exports. */
export function describeSetupEntryNotExported(className: string, index: number, node: ts.Node): string {
    return (
        `${className} › setup[${index}] — "${excerpt(node)}" (${location(node)}) is not exported from any library entry point, ` +
        `so the styleguide cannot show where to import it from; it was dropped.`
    );
}

/** A `setup` entry stands for a provider function or an InjectionToken; a class, a plain value or a call is neither. */
export function describeSetupEntryNotSupported(className: string, index: number, node: ts.Node): string {
    return `${className} › setup[${index}] — "${excerpt(node)}" (${location(node)}) is neither a function nor an InjectionToken; it was dropped.`;
}

/** A variant or a state is named by its `name` as well as its index, since that is what the styleguide shows. */
function formatShowcasePath(path: EvaluationPath, config: ts.Expression): string {
    const [head, index, ...rest] = path;

    if ((head !== 'variants' && head !== 'states') || typeof index !== 'number') return formatPath(path);

    const name = elementName(config, head, index);
    const element = name === undefined ? `${head}[${index}]` : `${head}[${index}] ${JSON.stringify(name)}`;

    return rest.length === 0 ? element : `${element} › ${formatPath(rest)}`;
}

function formatPath(path: EvaluationPath): string {
    return path
        .map((segment, i) => {
            if (typeof segment === 'number') return `[${segment}]`;
            if (!IDENTIFIER.test(segment)) return `[${JSON.stringify(segment)}]`;
            return i === 0 ? segment : `.${segment}`;
        })
        .join('');
}

/** Read from the source, because the evaluated array has already lost the elements before the index. */
function elementName(config: ts.Expression, key: 'variants' | 'states', index: number): string | undefined {
    const elements = ts.isObjectLiteralExpression(config) ? findInitializer(config, key) : undefined;
    const element = elements && ts.isArrayLiteralExpression(elements) ? elements.elements[index] : undefined;
    const name = element && ts.isObjectLiteralExpression(element) ? findInitializer(element, 'name') : undefined;
    const value = name && evaluateExpression(name);

    return typeof value === 'string' ? value : undefined;
}

/** The property or element the literal has at `path`, or `undefined` as soon as the literal stops spelling the path out, as with a spread or a constant. */
function nodeAtPath(config: ts.Expression, path: EvaluationPath): ts.Node | undefined {
    let container: ts.Node = config;
    let found: ts.Node | undefined;

    for (const segment of path) {
        const member: ts.Node | undefined =
            typeof segment === 'number'
                ? ts.isArrayLiteralExpression(container)
                    ? container.elements[segment]
                    : undefined
                : ts.isObjectLiteralExpression(container)
                  ? findProperty(container, segment)
                  : undefined;

        if (!member) return undefined;
        found = member;
        container = ts.isPropertyAssignment(member) ? member.initializer : member;
    }

    return found;
}

function findProperty(object: ts.ObjectLiteralExpression, key: string): ts.ObjectLiteralElementLike | undefined {
    return object.properties.find((prop) => prop.name !== undefined && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) && prop.name.text === key);
}

function findInitializer(object: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined {
    const prop = findProperty(object, key);

    return prop && ts.isPropertyAssignment(prop) ? prop.initializer : undefined;
}

function excerpt(node: ts.Node): string {
    const text = node.getText().replace(/\s+/g, ' ');

    return text.length > MAX_EXCERPT_LENGTH ? `${text.slice(0, MAX_EXCERPT_LENGTH - 1)}…` : text;
}

/** Relative to the working directory and with line and column, so that terminals and editors can link it. */
function location(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return `${relative(process.cwd(), sourceFile.fileName)}:${line + 1}:${character + 1}`;
}
