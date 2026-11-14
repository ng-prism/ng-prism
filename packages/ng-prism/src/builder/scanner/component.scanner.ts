import ts from 'typescript';
import type { ComponentStatus, DirectiveHost, HostTemplate, ShowcaseConfig, ShowcaseImport } from '../../decorator/showcase.types.js';
import type { ScannedComponent } from '../../plugin/plugin.types.js';
import { CANVAS_BGS, type CanvasBg } from '../../shared/canvas-bg.type.js';
import { CANVAS_LAYOUTS, type CanvasLayout } from '../../shared/canvas-layout.type.js';
import { isImportableName } from '../manifest/manifest-imports.js';
import { classifyShowcaseClass, type ShowcaseClassKind } from './api/angular-decorators.js';
import { extractComponentApi } from './api/component-api.extractor.js';
import type { ExportIndex } from './api/export-index.js';
import { findSetupProperty } from './api/setup.reader.js';
import { evaluateStatic, findDecorator, getDecoratorArgument, readDecoratorField, UNEVALUABLE } from './ast-utils.js';
import { getClassHierarchy } from './class-hierarchy.js';
import { type CompositionContext, readComposition } from './composition/read-composition.js';
import { extractInputs, extractOutputs } from './input.extractor.js';
import { describeValue, readPseudoStates } from './pseudo-states.js';
import {
    describeDeprecatedProviders,
    describeLegacyPipeComponent,
    describeLegacyServiceComponent,
    describeSetupOnComponent,
    describeSetupOnLegacyComponent,
    describeShowcaseIssue,
    describeUnevaluable,
    describeUnreadableApi,
    describeUnreadableBase
} from './showcase-diagnostics.js';
import { readShowcaseStates } from './showcase-states.js';

const COMPONENT_STATUSES = ['stable', 'beta', 'wip', 'deprecated'] as const;

function isComponentStatus(value: unknown): value is ComponentStatus {
    return typeof value === 'string' && (COMPONENT_STATUSES as readonly string[]).includes(value);
}

/**
 * What a `bg` the scanner cannot take says about itself.
 *
 * `checker` gets its own message: it was a valid background until 22.8.0, so a
 * decorator that still declares it is outdated, not mistyped, and the fix is
 * one word (or `ng update`) rather than a look through the list of values.
 */
function invalidBgMessage(where: string, value: unknown): string {
    if (value === 'checker') {
        return `${where} declares bg "checker", which was removed in 22.8.0; use 'transparent' (a checkerboard while browsing, light in both themes, see-through in a capture), or run ng update @ng-prism/core to rewrite it. Skipping.`;
    }
    return `${where} declares invalid bg "${String(value)}", expected one of: ${CANVAS_BGS.join(', ')}. Skipping.`;
}

function isCanvasBg(value: unknown): value is CanvasBg {
    return typeof value === 'string' && (CANVAS_BGS as readonly string[]).includes(value);
}

function isCanvasLayout(value: unknown): value is CanvasLayout {
    return typeof value === 'string' && (CANVAS_LAYOUTS as readonly string[]).includes(value);
}

function isShowcaseImport(value: unknown): value is ShowcaseImport {
    const { name, from } = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

    return typeof name === 'string' && name !== '' && typeof from === 'string' && from !== '';
}

/**
 * What is wrong with an import the generated manifest would write as `import { name } from 'from'`, `undefined` when
 * nothing is: anything but an identifier there, `default` or a module path, is a syntax error in the whole manifest.
 */
function importProblem(entry: ShowcaseImport): string | undefined {
    return isImportableName(entry.name) ? undefined : `expected the name a class is exported under, got ${JSON.stringify(entry.name)}; it was dropped`;
}

/** Whether a `host` is a host template, `{ template }`, rather than the string or object host of a directive. */
export function isHostTemplate(value: unknown): value is HostTemplate {
    return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)['template'] === 'string';
}

/** The position an element has in the source, given the positions before it that the evaluator dropped: the evaluated list is shorter by those. */
function sourceIndex(index: number, dropped: ReadonlySet<number>): number {
    return [...dropped].sort((a, b) => a - b).reduce((position, gap) => (gap <= position ? position + 1 : position), index);
}

export type Report = (message: string) => void;

/**
 * The two ways a scan warns, each printing a message once however often it is
 * raised: `report` for a dropped value, which is also collected in
 * `diagnostics` and fails the build under `strictShowcase`, and `notify` for
 * anything else worth saying.
 */
export function createReporters(diagnostics: string[], notices: Set<string>): { report: Report; notify: Report } {
    return {
        report: (message) => {
            if (diagnostics.includes(message)) return;
            diagnostics.push(message);
            console.warn(`⚠ ng-prism: ${message}`);
        },
        notify: (message) => {
            if (notices.has(message)) return;
            notices.add(message);
            console.warn(`⚠ ng-prism: ${message}`);
        }
    };
}

export interface ScanComponentsOptions {
    /**
     * Shared across entry points, and with {@link scanServices} and {@link scanPipes}, so that a class exported from
     * several of them does not repeat its warnings.
     */
    diagnostics?: string[];
    notices?: Set<string>;
    /**
     * Tells the API of a component which of the types it names a consumer can import; without one the API has their
     * text, but no links and no `types`.
     */
    exportIndex?: ExportIndex;
    /** Whether to read {@link ScannedComponent.api}: only a plugin with `componentApi` reads it, so the build leaves it out without one. */
    api?: boolean;
    /** What {@link ScannedComponent.composition} is read against; without it, no composition is read. */
    composition?: CompositionContext;
    /**
     * Filled by the scan with the `@Showcase` argument of every component whose config kept `partOf`, which is what the
     * messages about a part that cannot be resolved point at.
     */
    partOrigins?: Map<ScannedComponent, ts.Expression>;
}

/**
 * Read the Angular components among the showcased classes of an entry point.
 * A class with `@Injectable` or `@Service` is a service and one with `@Pipe` a
 * pipe, each left to its own scan, unless it declares fields only a component
 * can use.
 *
 * Every @Showcase value the scan has to drop is printed and collected in
 * `diagnostics`, once. `notices` does the same for warnings about what a
 * component inherits, which are not diagnostics.
 */
export function scanComponents(showcased: ShowcasedClass[], checker: ts.TypeChecker, options: ScanComponentsOptions = {}): ScannedComponent[] {
    const { diagnostics = [], notices = new Set<string>(), exportIndex = new Map(), api: readApi = true, composition: compositionContext } = options;
    const components: ScannedComponent[] = [];
    const { report, notify } = createReporters(diagnostics, notices);

    for (const { classDecl, decorator: showcaseDecorator, argument: showcaseArg, kind: classKind } of showcased) {
        if (classKind.kind === 'service' || classKind.kind === 'pipe') continue;

        const className = classDecl.name?.text ?? 'Anonymous';
        const read = readShowcaseConfig(showcaseDecorator, className, report, checker);

        if (!read || !showcaseArg) continue;

        const { config: showcaseConfig, sources } = read;

        // Not a diagnostic: the component still works, and strictShowcase must not fail the build over a notice about 23.0.0.
        if (classKind.kind === 'legacy-component') {
            notify(
                classKind.source === 'pipe'
                    ? describeLegacyPipeComponent(className, classKind.fields, classKind.standalone !== false)
                    : describeLegacyServiceComponent(className, classKind.fields)
            );
        }

        const setup = findSetupProperty(showcaseArg);

        if (setup)
            report(
                classKind.kind === 'legacy-component' ? describeSetupOnLegacyComponent(className, setup, classKind.fields) : describeSetupOnComponent(className, setup)
            );

        const componentMeta = extractComponentMeta(classDecl, checker);

        // A string or an object host puts a directive on an element. A component has ignored it so far and keeps doing so, so that what a library renders stays as it is.
        // Not a diagnostic: nothing is lost, and strictShowcase must not start failing a build over it.
        if (!componentMeta.isDirective && showcaseConfig.host !== undefined && !isHostTemplate(showcaseConfig.host)) {
            notify(
                describeShowcaseIssue(
                    className,
                    showcaseArg,
                    ['host'],
                    'a string or object host has no effect on a component; use host: { template } to render it inside other markup. It was dropped.'
                )
            );
            delete showcaseConfig.host;
        }

        const host = showcaseConfig.host;

        // The manifest imports the class of a directive's object host, as an import of the showcase.
        if (componentMeta.isDirective && typeof host === 'object' && host !== null && !isHostTemplate(host) && host.import !== undefined) {
            const hostImport: unknown = host.import;
            const problem = isShowcaseImport(hostImport)
                ? importProblem(hostImport)
                : `expected { name, from } with a non-empty string each, got ${describeValue(hostImport)}; it was dropped`;

            if (problem) {
                report(describeShowcaseIssue(className, showcaseArg, ['host', 'import'], problem));
                delete (host as Partial<DirectiveHost>).import;
            }
        }

        const hierarchy = getClassHierarchy(classDecl, checker);
        const inputs = extractInputs(classDecl, checker, hierarchy);
        const outputs = extractOutputs(classDecl, checker, hierarchy);

        const filePath = classDecl.getSourceFile().fileName;
        const decoratorInputs = hierarchy.classes.find((c) => c.definesMetadata && hasDecoratorInputs(c.classDecl))?.classDecl;

        if (decoratorInputs) {
            const where =
                decoratorInputs === classDecl ? 'uses @Input() decorators' : `inherits @Input() decorators from ${decoratorInputs.name?.text ?? 'an anonymous class'},`;

            notify(`${className} ${where} which are not fully supported. Migrate to input() signals for full ng-prism support.`);
        }

        // Not diagnostics: strictShowcase would fail the build over a base
        // class in a package, which the component's author cannot change.
        for (const base of hierarchy.unreadable) {
            notify(describeUnreadableBase(className, base));
        }

        // The API only feeds the API page, which has a fallback for a component without one: a class the extractor
        // cannot read must not take the scan down. A notice, not a diagnostic, so strictShowcase does not fail over it.
        let api: ScannedComponent['api'];

        try {
            if (readApi) api = extractComponentApi(classDecl, inputs, outputs, hierarchy, checker, exportIndex);
        } catch (error) {
            notify(describeUnreadableApi(className, error, 'component'));
        }

        const composition =
            compositionContext &&
            readComposition(
                {
                    className,
                    filePath,
                    selector: componentMeta.selector,
                    isDirective: componentMeta.isDirective,
                    standalone: componentMeta.standalone,
                    inputs,
                    config: showcaseConfig,
                    configNode: showcaseArg,
                    sources
                },
                compositionContext,
                { report, notify }
            );

        const component: ScannedComponent = {
            className,
            filePath,
            showcaseConfig,
            inputs,
            outputs,
            componentMeta,
            // Plugins look a base class up by name, so an anonymous one is of no use to them.
            baseClasses: hierarchy.classes
                .slice(1)
                .flatMap(({ classDecl: base }) => (base.name ? [{ className: base.name.text, filePath: base.getSourceFile().fileName }] : [])),
            api,
            ...(composition && { composition })
        };

        components.push(component);

        if (showcaseConfig.partOf !== undefined) options.partOrigins?.set(component, showcaseArg);
    }

    return components;
}

/** An exported class with `@Showcase`, and which scan it belongs to. */
export interface ShowcasedClass {
    symbol: ts.Symbol;
    classDecl: ts.ClassDeclaration;
    decorator: ts.Decorator;
    argument: ts.Expression | undefined;
    kind: ShowcaseClassKind;
}

/**
 * The classes with `@Showcase` among the exports of an entry point, each
 * classified once: the component, the service and the pipe scan each keep
 * the classes of their own kind.
 */
export function findShowcasedClasses(exports: ts.Symbol[], checker: ts.TypeChecker): ShowcasedClass[] {
    return exports.flatMap((sym) => {
        const showcased = findShowcasedClass(sym, checker);

        return showcased ? [{ ...showcased, kind: classifyShowcaseClass(showcased.classDecl, showcased.argument, checker) }] : [];
    });
}

/** The class an export resolves to, when it carries `@Showcase`. */
function findShowcasedClass(sym: ts.Symbol, checker: ts.TypeChecker): Omit<ShowcasedClass, 'kind'> | undefined {
    const symbol = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
    const classDecl = symbol.declarations?.find(ts.isClassDeclaration);

    if (!classDecl) return undefined;

    // Perf: cheap pre-filter that skips the full decorator walk for files that don't
    // mention Showcase at all. False positives (string-literal containing "@Showcase")
    // just lose the optimization for that file; correctness is unaffected.
    if (!classDecl.getSourceFile().text.includes('@Showcase')) return undefined;

    const decorator = findDecorator(classDecl, 'Showcase');

    return decorator && { symbol, classDecl, decorator, argument: getDecoratorArgument(decorator) };
}

function hasDecoratorInputs(classDecl: ts.ClassDeclaration): boolean {
    for (const member of classDecl.members) {
        if (!ts.isPropertyDeclaration(member)) continue;
        if (findDecorator(member, 'Input')) return true;
    }
    return false;
}

/**
 * `setup` is read for services and pipes only, so a component's is never
 * part of the config: the issue the evaluator raises for its function is
 * swallowed here, and {@link scanComponents} says what is wrong with it instead.
 */
export function extractShowcaseConfig(decorator: ts.Decorator, className: string, report: Report, checker: ts.TypeChecker): ShowcaseConfig | undefined {
    return readShowcaseConfig(decorator, className, report, checker)?.config;
}

/** Where each kept entry of `variants` and `imports` is written in the `@Showcase` argument, which the scan's later messages name it by. */
interface ShowcaseSources {
    variants: number[];
    imports: number[];
}

/** {@link extractShowcaseConfig}, and where the entries it kept are written. */
function readShowcaseConfig(
    decorator: ts.Decorator,
    className: string,
    report: Report,
    checker: ts.TypeChecker
): { config: ShowcaseConfig; sources: ShowcaseSources } | undefined {
    const arg = getDecoratorArgument(decorator);

    if (!arg) return undefined;

    // Reported once for the whole field below, wherever it came from: the literal, a spread or a constant.
    let providers: ts.Node | undefined;
    // A state the evaluator dropped whole leaves no element behind, so its position is noted to keep the later states where the source has them.
    const unevaluableStates = new Set<number>();
    // The same for the elements of `imports` and `variants`, which are not put back but named by the position the source gives them.
    const unevaluableElements = { imports: new Set<number>(), variants: new Set<number>() };
    const raw = evaluateStatic(arg, {
        checker,
        report: (issue) => {
            if (issue.path[0] === 'setup') return;
            if (issue.path[0] === 'providers') {
                providers ??= issue.node;
                return;
            }
            if (issue.path[0] === 'states' && issue.path.length === 2 && typeof issue.path[1] === 'number') unevaluableStates.add(issue.path[1]);
            const [field, index] = issue.path;
            // A spread that fails inside an element leaves the element behind, and one in the list leaves no telling how many.
            const isElement = issue.path.length === 2 && !ts.isSpreadAssignment(issue.node) && !ts.isSpreadElement(issue.node);

            if (isElement && (field === 'imports' || field === 'variants') && typeof index === 'number') unevaluableElements[field].add(index);
            report(describeUnevaluable(className, arg, issue));
        }
    });

    if (providers || (typeof raw === 'object' && raw !== null && 'providers' in raw)) {
        report(describeDeprecatedProviders(className, arg, providers));
    }

    if (raw === UNEVALUABLE || !raw || typeof raw !== 'object') return undefined;

    if (!('title' in raw)) {
        report(`${className} has @Showcase without a "title" field, skipping. ` + `Add a title so it can appear in the styleguide.`);
        return undefined;
    }

    const obj = raw as Record<string, unknown>;
    const config: ShowcaseConfig = {
        title: obj['title'] as string
    };
    const sources: ShowcaseSources = { variants: [], imports: [] };

    if (obj['description']) config.description = obj['description'] as string;
    if (obj['category']) config.category = obj['category'] as string;
    if (obj['section']) config.section = obj['section'] as string;
    if (typeof obj['sectionOrder'] === 'number') {
        config.sectionOrder = obj['sectionOrder'];
    }
    if (typeof obj['categoryOrder'] === 'number') {
        config.categoryOrder = obj['categoryOrder'];
    }
    if (typeof obj['componentOrder'] === 'number') {
        config.componentOrder = obj['componentOrder'];
    }
    if (obj['tags']) config.tags = obj['tags'] as string[];
    if (obj['meta']) config.meta = obj['meta'] as Record<string, unknown>;
    if (obj['host'] !== undefined) {
        // An object with a `template` is meant as a host template, so one that is no string is not a host of another kind.
        if (typeof obj['host'] === 'object' && obj['host'] !== null && 'template' in obj['host'] && !isHostTemplate(obj['host'])) {
            report(describeShowcaseIssue(className, arg, ['host'], `expected { template: string }, got ${describeValue(obj['host'])}; it was dropped`));
        } else {
            config.host = obj['host'] as ShowcaseConfig['host'];
        }
    }
    if (obj['renderPage']) config.renderPage = obj['renderPage'] as string;

    if (obj['partOf'] !== undefined) {
        const partOf = typeof obj['partOf'] === 'string' ? obj['partOf'].trim() : '';

        if (partOf) {
            config.partOf = partOf;
        } else {
            report(
                describeShowcaseIssue(
                    className,
                    arg,
                    ['partOf'],
                    `expected the selector of a showcased component or directive as a string, got ${describeValue(obj['partOf'])}; it was dropped`
                )
            );
        }
    }

    if (obj['states'] !== undefined) {
        if (config.renderPage) {
            report(`${className} declares states together with renderPage; a component page has no Overview to show them in. Skipping states.`);
        } else {
            const states = readShowcaseStates(obj['states'], className, report, unevaluableStates);

            if (states) config.states = states;
        }
    }

    if (obj['status'] !== undefined) {
        if (isComponentStatus(obj['status'])) {
            config.status = obj['status'];
        } else {
            report(`${className} declares invalid status "${String(obj['status'])}", ` + `expected one of: ${COMPONENT_STATUSES.join(', ')}. Skipping.`);
        }
    }

    if (obj['bg'] !== undefined) {
        if (isCanvasBg(obj['bg'])) {
            config.bg = obj['bg'];
        } else {
            report(invalidBgMessage(className, obj['bg']));
        }
    }

    if (obj['canvasLayout'] !== undefined) {
        if (isCanvasLayout(obj['canvasLayout'])) {
            config.canvasLayout = obj['canvasLayout'];
        } else {
            report(`${className} declares invalid canvasLayout "${String(obj['canvasLayout'])}", ` + `expected one of: ${CANVAS_LAYOUTS.join(', ')}. Skipping.`);
        }
    }

    if (obj['imports'] !== undefined) {
        const imports = readShowcaseImports(obj['imports'], className, arg, report, unevaluableElements.imports);

        if (imports.length > 0) {
            config.imports = imports.map(({ entry }) => entry);
            sources.imports = imports.map(({ source }) => source);
        }
    }

    if (Array.isArray(obj['variants'])) {
        config.variants = (obj['variants'] as Array<Record<string, unknown>>).map((variant, index) => {
            const cleaned: Record<string, unknown> = { ...variant };
            const reportVariant = (field: 'template' | 'host' | 'content', text: string) =>
                report(describeShowcaseIssue(className, arg, ['variants', sourceIndex(index, unevaluableElements.variants), field], text));

            if (variant['bg'] !== undefined && !isCanvasBg(variant['bg'])) {
                report(invalidBgMessage(`${className} variant "${String(variant['name'])}"`, variant['bg']));
                delete cleaned['bg'];
            }
            if (variant['canvasLayout'] !== undefined && !isCanvasLayout(variant['canvasLayout'])) {
                report(
                    `${className} variant "${String(variant['name'])}" declares ` +
                        `invalid canvasLayout "${String(variant['canvasLayout'])}", expected one of: ${CANVAS_LAYOUTS.join(', ')}. Skipping.`
                );
                delete cleaned['canvasLayout'];
            }
            if (variant['pseudo'] !== undefined) {
                const pseudo = readPseudoStates(variant['pseudo'], `${className} variant "${String(variant['name'])}"`, report);

                if (pseudo) cleaned['pseudo'] = pseudo;
                else delete cleaned['pseudo'];
            }
            if (variant['states'] !== undefined && variant['states'] !== false) {
                report(`${className} variant "${String(variant['name'])}" declares invalid states ${describeValue(variant['states'])}, expected false. Skipping.`);
                delete cleaned['states'];
            }
            if (variant['template'] !== undefined && typeof variant['template'] !== 'string') {
                reportVariant('template', `expected a string, got ${describeValue(variant['template'])}; it was dropped`);
                delete cleaned['template'];
            }
            if (cleaned['template'] !== undefined && variant['content'] !== undefined) {
                reportVariant('content', 'set together with template; template wins and content was dropped');
                delete cleaned['content'];
            }
            if (variant['host'] !== undefined && !isHostTemplate(variant['host'])) {
                reportVariant('host', `expected { template: string }, got ${describeValue(variant['host'])}; it was dropped`);
                delete cleaned['host'];
            }
            return cleaned;
        }) as unknown as ShowcaseConfig['variants'];
        sources.variants = (config.variants ?? []).map((_, index) => sourceIndex(index, unevaluableElements.variants));
    }

    return { config, sources };
}

/**
 * `ShowcaseConfig.imports` as the scanner evaluated it, with every entry that is not a `{ name, from }` pair of
 * non-empty strings reported and dropped. `unevaluable` holds the source positions the evaluator dropped, which keep
 * the later entries named by the position they have in the source; `source` is that position for each kept entry.
 */
function readShowcaseImports(
    value: unknown,
    className: string,
    config: ts.Expression,
    report: Report,
    unevaluable: ReadonlySet<number>
): { entry: ShowcaseImport; source: number }[] {
    if (!Array.isArray(value)) {
        report(describeShowcaseIssue(className, config, ['imports'], `expected a list of { name, from }, got ${describeValue(value)}; it was dropped`));
        return [];
    }

    return value.flatMap((entry, index) => {
        const source = sourceIndex(index, unevaluable);
        const text = isShowcaseImport(entry) ? importProblem(entry) : `expected { name, from } with a non-empty string each, got ${describeValue(entry)}; it was dropped`;

        if (!text) return [{ entry: { name: entry.name, from: entry.from }, source }];

        report(describeShowcaseIssue(className, config, ['imports', source], text));
        return [];
    });
}

function extractComponentMeta(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker): ScannedComponent['componentMeta'] {
    const componentDecorator = findDecorator(classDecl, 'Component');
    const decorator = componentDecorator ?? findDecorator(classDecl, 'Directive');
    const isDirective = !componentDecorator && decorator !== undefined;
    const arg = decorator && getDecoratorArgument(decorator);

    if (!arg) return { selector: '', standalone: true, isDirective };

    const selector = readDecoratorField(arg, 'selector', checker);

    return {
        selector: typeof selector === 'string' ? selector : '',
        standalone: readDecoratorField(arg, 'standalone', checker) !== false,
        isDirective
    };
}
