import ts from 'typescript';
import { type DateArguments, isGlobalDate, StaticDate } from './static-date.js';

/**
 * What {@link evaluateStatic} returns for a root it cannot evaluate. A symbol,
 * so that it stays distinct from an `undefined` written on purpose.
 */
export const UNEVALUABLE: unique symbol = Symbol('ng-prism.unevaluable');

export type EvaluationPath = ReadonlyArray<string | number>;

/** A reference in the source whose declaration has no value the evaluator can use, or a `Date` that has none. */
export interface UnresolvedReference {
    /** The identifier, shorthand property or property access that did not resolve, or the `new Date(…)`. */
    node: ts.Node;
    /**
     * `let` and `var` are not constants. `no-value` is a declaration without an
     * initializer: `declare const`, a compiled package's `.d.ts`, or a global
     * of the JavaScript runtime such as `Math`. `cycle` is a constant that refers back to itself, and
     * `runtime-value` a function or class. `current-time` is `new Date()` without arguments, and `invalid-date` a
     * `new Date(…)` whose arguments make no valid date.
     */
    kind: 'let' | 'var' | 'no-value' | 'cycle' | 'runtime-value' | 'current-time' | 'invalid-date';
}

export interface UnevaluableIssue {
    /** Where the dropped part sat in the evaluated value, with array indices as written in the source. */
    path: EvaluationPath;
    /** The expression, spread or property that could not be evaluated. */
    node: ts.Node;
    /**
     * `runtime-value` marks functions, classes and instances, which no static evaluation can ever capture.
     * `current-time` and `invalid-date` mark a `new Date(…)` that is the dropped part itself, as in {@link UnresolvedReference}.
     */
    reason: 'unsupported' | 'runtime-value' | 'current-time' | 'invalid-date';
    /** The innermost reference that failed, when one is what made `node` unevaluable. */
    cause?: UnresolvedReference;
}

export type UnevaluableReporter = (issue: UnevaluableIssue) => void;

export interface EvaluateOptions {
    /** Called for every property, element or spread that is dropped. */
    report?: UnevaluableReporter;
    /** Resolves constants, enum members and imports. Without it, every reference is unevaluable. */
    checker?: ts.TypeChecker;
}

interface Resolved {
    value: unknown;
    /** Relative to the constant, so that each reference reports them at its own path. */
    issues: UnevaluableIssue[];
    /** Why the constant as a whole could not be folded, if it could not. */
    cause?: UnresolvedReference;
}

interface Context {
    readonly report: UnevaluableReporter;
    readonly checker: ts.TypeChecker | undefined;
    /** Declarations being evaluated right now, to stop at a constant that refers back to itself. */
    readonly resolving: Set<ts.VariableDeclaration>;
    /** Constants folded so far in this evaluation, so that a shared one is folded once. */
    readonly resolved: Map<ts.VariableDeclaration, Resolved>;
    /** Shared with {@link silent} copies, so that a failing operand can still name its cause. */
    readonly trace: { cause?: UnresolvedReference };
}

const ignore: UnevaluableReporter = () => undefined;

const ARITHMETIC: Partial<Record<ts.SyntaxKind, (left: number, right: number) => number>> = {
    [ts.SyntaxKind.PlusToken]: (left, right) => left + right,
    [ts.SyntaxKind.MinusToken]: (left, right) => left - right,
    [ts.SyntaxKind.AsteriskToken]: (left, right) => left * right,
    [ts.SyntaxKind.SlashToken]: (left, right) => left / right,
    [ts.SyntaxKind.PercentToken]: (left, right) => left % right,
    [ts.SyntaxKind.AsteriskAsteriskToken]: (left, right) => left ** right
};

/** Symbols that name a declaration of their own, as opposed to a property inside a constant's value. */
const DECLARATION_SYMBOLS = ts.SymbolFlags.Variable | ts.SymbolFlags.EnumMember | ts.SymbolFlags.Function | ts.SymbolFlags.Class | ts.SymbolFlags.Method;

/**
 * Statically evaluate an AST expression node.
 *
 * Inside an object or array literal, whatever cannot be evaluated costs only
 * that property or element: it is reported and left out, never the container
 * around it. Only the root itself can come back as {@link UNEVALUABLE}.
 */
export function evaluateStatic(node: ts.Expression, options: EvaluateOptions = {}): unknown {
    return evaluateMember(node, [], { report: options.report ?? ignore, checker: options.checker, resolving: new Set(), resolved: new Map(), trace: {} });
}

/**
 * {@link evaluateStatic} for callers that read a few known fields and have no
 * use for diagnostics, such as `@Component` metadata: what cannot be evaluated
 * is left out silently, and an unevaluable root becomes `undefined`.
 */
export function evaluateExpression(node: ts.Expression, checker?: ts.TypeChecker): unknown {
    const value = evaluateStatic(node, { checker });

    return value === UNEVALUABLE ? undefined : value;
}

function evaluateMember(node: ts.Expression, path: EvaluationPath, context: Context): unknown {
    return guard(node, path, context, () => evaluateNode(node, path, context));
}

/** Runs `evaluate` for the member `node` and, if it fails, reports it with the cause the trace picked up on the way. */
function guard(node: ts.Node, path: EvaluationPath, context: Context, evaluate: () => unknown): unknown {
    const { trace } = context;
    const outer = trace.cause;

    trace.cause = undefined;
    const value = evaluate();

    if (value === UNEVALUABLE) {
        // Set by `evaluate`, which the compiler does not see after the reset above.
        const cause = trace.cause as UnresolvedReference | undefined;

        if (cause && (cause.kind === 'current-time' || cause.kind === 'invalid-date') && cause.node === skipParentheses(node)) {
            // The `Date` is the member itself: naming it again as its own cause would only repeat it.
            context.report({ path, node, reason: cause.kind });
        } else {
            context.report({ path, node, reason: isRuntimeValue(node, context.checker) ? 'runtime-value' : 'unsupported', cause });
        }
    }
    trace.cause = outer;
    return value;
}

/** For operands and keys: what fails inside them is the failure of the member around them, not a drop of its own. */
function silent(context: Context): Context {
    return { ...context, report: ignore };
}

/**
 * Reports only what an array or object literal drops. An operand that fails
 * makes the whole expression around it {@link UNEVALUABLE}, so the member
 * holding it reports `limit * 2`, not just `limit`.
 */
function evaluateNode(node: ts.Expression, path: EvaluationPath, context: Context): unknown {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }

    if (ts.isNumericLiteral(node)) {
        return finite(Number(node.text));
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;

    if (ts.isIdentifier(node)) {
        // In expression position `undefined` parses as an identifier, not a keyword.
        if (node.text === 'undefined') return undefined;
        return evaluateReference(context.checker?.getSymbolAtLocation(node), node, path, context);
    }

    // Types only: the value is the expression inside.
    if (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isTypeAssertionExpression(node)
    ) {
        return evaluateNode(node.expression, path, context);
    }

    if (ts.isPrefixUnaryExpression(node)) {
        return evaluatePrefixUnary(node, context);
    }

    if (ts.isBinaryExpression(node)) {
        return evaluateBinary(node, context);
    }

    if (ts.isTemplateExpression(node)) {
        return evaluateTemplate(node, context);
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return evaluateAccess(node, path, context);
    }

    if (ts.isArrayLiteralExpression(node)) {
        return evaluateArray(node, path, context);
    }

    if (ts.isObjectLiteralExpression(node)) {
        return evaluateObject(node, path, context);
    }

    if (ts.isNewExpression(node) && isDateConstruction(node, context.checker)) {
        return evaluateDate(node, context);
    }

    return UNEVALUABLE;
}

/** `new Date(…)` with the runtime's `Date`, not a class of the project by that name. */
function isDateConstruction(node: ts.NewExpression, checker: ts.TypeChecker | undefined): boolean {
    return ts.isIdentifier(node.expression) && node.expression.text === 'Date' && isGlobalDate(checker?.getSymbolAtLocation(node.expression), checker);
}

/**
 * A {@link StaticDate} from arguments the evaluator can read: one string, number or other such `Date`, or two to
 * seven numbers, as the year, the month and the rest. Without arguments it is the current time, which would differ in
 * every build.
 */
function evaluateDate(node: ts.NewExpression, context: Context): unknown {
    const written = node.arguments ?? [];

    if (written.length === 0) return fail(node, 'current-time', context);

    const values = written.map((argument) => evaluateNode(argument, [], silent(context)));

    if (values.includes(UNEVALUABLE)) return UNEVALUABLE;

    const [first] = values;
    let args: DateArguments;

    if (values.length === 1 && first instanceof StaticDate) args = first.args;
    else if (values.length === 1 && (typeof first === 'string' || typeof first === 'number')) args = [first];
    else if (values.length >= 2 && values.length <= 7 && values.every((value): value is number => typeof value === 'number')) args = values;
    else return UNEVALUABLE;

    const date = new StaticDate(args);

    return Number.isNaN(date.getTime()) ? fail(node, 'invalid-date', context) : date;
}

/**
 * The value of the declaration a reference points to: the initializer of a
 * `const`, or the value of an enum member. Imports are followed to their
 * source, and what the initializer drops is reported where it is written.
 */
function evaluateReference(symbol: ts.Symbol | undefined, reference: ts.Node, path: EvaluationPath, context: Context): unknown {
    const { checker } = context;

    if (!symbol || !checker) return UNEVALUABLE;

    const target = resolveAlias(symbol, checker);
    const declaration = target.valueDeclaration;

    if (target.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class | ts.SymbolFlags.Method)) {
        return fail(reference, 'runtime-value', context);
    }

    if (declaration && ts.isEnumMember(declaration)) {
        // Asked of the member, not of `Size.Medium`: for an access the checker only answers for const enums.
        return checker.getConstantValue(declaration) ?? UNEVALUABLE;
    }

    if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) return UNEVALUABLE;
    // Before let and var: an ambient `declare var Math` is a declaration without a value, not a variable the user chose.
    if (!declaration.initializer) return fail(reference, 'no-value', context);

    const scope = ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.BlockScoped;

    if (scope === ts.NodeFlags.Let) return fail(reference, 'let', context);
    if (scope === 0) return fail(reference, 'var', context);
    if (scope !== ts.NodeFlags.Const) return UNEVALUABLE;

    const resolved = context.resolved.get(declaration) ?? resolveConstant(declaration, declaration.initializer, context);

    if (!resolved) return fail(reference, 'cycle', context);

    for (const issue of resolved.issues) context.report({ ...issue, path: [...path, ...issue.path] });

    if (resolved.value === UNEVALUABLE) {
        context.trace.cause ??= resolved.cause;
        return UNEVALUABLE;
    }
    // A copy per reference, so that two of them never share an object a plugin could change through either.
    return copy(resolved.value);
}

/**
 * A deep copy of an evaluated value, which holds primitives, arrays, plain objects and {@link StaticDate}s.
 * `structuredClone` would turn a `StaticDate` into a plain `Date` without its arguments.
 */
function copy(value: unknown): unknown {
    if (value instanceof StaticDate) return new StaticDate(value.args);
    if (Array.isArray(value)) return value.map(copy);
    if (!isRecord(value)) return value;

    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) setOwn(result, key, copy(item));
    return result;
}

/**
 * Folds a constant once per evaluation, recording its issues relative to the
 * constant itself. `undefined` while the same constant is still being folded
 * further up, which is a cycle.
 */
function resolveConstant(declaration: ts.VariableDeclaration, initializer: ts.Expression, context: Context): Resolved | undefined {
    if (context.resolving.has(declaration)) return undefined;

    const issues: UnevaluableIssue[] = [];
    const trace: Context['trace'] = {};

    context.resolving.add(declaration);
    try {
        const value = evaluateNode(initializer, [], { ...context, report: (issue) => issues.push(issue), trace });
        const resolved: Resolved = { value, issues, cause: trace.cause };

        context.resolved.set(declaration, resolved);
        return resolved;
    } finally {
        context.resolving.delete(declaration);
    }
}

function resolveAlias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function fail(reference: ts.Node, kind: UnresolvedReference['kind'], context: Context): typeof UNEVALUABLE {
    context.trace.cause ??= { node: reference, kind };
    return UNEVALUABLE;
}

/**
 * `tokens.MAX_FILES` and `Size.Medium` name a declaration of their own.
 * `TOKENS.size.m` and `SIZES[1]` read a property from a constant's value.
 */
function evaluateAccess(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, path: EvaluationPath, context: Context): unknown {
    const { checker } = context;
    const symbol = checker?.getSymbolAtLocation(node);

    if (symbol && checker && resolveAlias(symbol, checker).flags & DECLARATION_SYMBOLS) {
        return evaluateReference(symbol, node, path, context);
    }

    const dropped: UnevaluableIssue[] = [];
    const object = evaluateNode(node.expression, [], { ...context, report: (issue) => dropped.push(issue) });
    const key = ts.isPropertyAccessExpression(node) ? node.name.text : evaluateNode(node.argumentExpression, [], silent(context));

    if (typeof object !== 'object' || object === null || (typeof key !== 'string' && typeof key !== 'number')) return UNEVALUABLE;

    const lost = dropped.find((issue) => touches(issue.path, key, Array.isArray(object)));

    if (lost) {
        context.trace.cause ??= lost.cause;
        return UNEVALUABLE;
    }
    return Object.hasOwn(object, key) ? (object as Record<string | number, unknown>)[key] : UNEVALUABLE;
}

/**
 * Whether a part dropped from an object or array could change what `[key]`
 * reads from it: the part itself, something a spread might have supplied, or,
 * in an array, an element whose removal moved the later ones up.
 */
function touches(dropped: EvaluationPath, key: string | number, array: boolean): boolean {
    if (dropped.length === 0) return true;

    const [head] = dropped;

    if (!array) return String(head) === String(key);

    const index = Number(key);
    const moved = dropped.length === 1 && (key === 'length' || (typeof head === 'number' && head < index));

    return head === index || moved;
}

function evaluatePrefixUnary(node: ts.PrefixUnaryExpression, context: Context): unknown {
    const operand = evaluateNode(node.operand, [], silent(context));

    switch (node.operator) {
        case ts.SyntaxKind.MinusToken:
            return typeof operand === 'number' ? -operand : UNEVALUABLE;
        case ts.SyntaxKind.PlusToken:
            return typeof operand === 'number' ? operand : UNEVALUABLE;
        case ts.SyntaxKind.ExclamationToken:
            return operand === UNEVALUABLE ? UNEVALUABLE : !operand;
        default:
            return UNEVALUABLE;
    }
}

/**
 * Arithmetic on numbers, and `+` as concatenation once either side is a
 * string. Anything JavaScript would coerce beyond that, such as an object to
 * `[object Object]`, is not what anybody meant to put into a showcase.
 */
function evaluateBinary(node: ts.BinaryExpression, context: Context): unknown {
    const operator = node.operatorToken.kind;
    const left = evaluateNode(node.left, [], silent(context));
    const right = evaluateNode(node.right, [], silent(context));

    if (operator === ts.SyntaxKind.PlusToken && (typeof left === 'string' || typeof right === 'string')) {
        return isPrimitive(left) && isPrimitive(right) ? String(left) + String(right) : UNEVALUABLE;
    }

    const apply = ARITHMETIC[operator];

    return apply && typeof left === 'number' && typeof right === 'number' ? finite(apply(left, right)) : UNEVALUABLE;
}

function evaluateTemplate(node: ts.TemplateExpression, context: Context): unknown {
    let text = node.head.text;

    for (const span of node.templateSpans) {
        const value = evaluateNode(span.expression, [], silent(context));

        if (!isPrimitive(value)) return UNEVALUABLE;
        text += String(value) + span.literal.text;
    }
    return text;
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
    return value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Infinity` and `NaN` would reach the manifest as `null`. */
function finite(value: number): number | typeof UNEVALUABLE {
    return Number.isFinite(value) ? value : UNEVALUABLE;
}

function evaluateArray(node: ts.ArrayLiteralExpression, path: EvaluationPath, context: Context): unknown[] {
    const result: unknown[] = [];

    node.elements.forEach((element, index) => {
        const elementPath = [...path, index];

        if (ts.isOmittedExpression(element)) {
            // A hole is a position, not a value that went missing.
            result.push(undefined);
            return;
        }

        if (ts.isSpreadElement(element)) {
            const spread = guard(element, elementPath, context, () => {
                const value = evaluateNode(element.expression, elementPath, context);

                return Array.isArray(value) ? value : UNEVALUABLE;
            });

            if (Array.isArray(spread)) result.push(...spread);
            return;
        }

        const value = evaluateMember(element, elementPath, context);

        if (value !== UNEVALUABLE) result.push(value);
    });
    return result;
}

function evaluateObject(node: ts.ObjectLiteralExpression, path: EvaluationPath, context: Context): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const prop of node.properties) {
        if (ts.isSpreadAssignment(prop)) {
            const spread = guard(prop, path, context, () => {
                const value = evaluateNode(prop.expression, path, context);

                return isRecord(value) ? value : UNEVALUABLE;
            });

            if (isRecord(spread)) {
                for (const [key, value] of Object.entries(spread)) setOwn(result, key, value);
            }
            continue;
        }

        if (ts.isShorthandPropertyAssignment(prop)) {
            const keyPath = [...path, prop.name.text];
            const value = guard(prop, keyPath, context, () => evaluateReference(context.checker?.getShorthandAssignmentValueSymbol(prop), prop.name, keyPath, context));

            assign(result, prop.name.text, value);
            continue;
        }

        const key = propertyKey(prop, path, context);

        if (key === undefined) continue;

        if (key === '__proto__' && !ts.isComputedPropertyName(prop.name)) {
            // In a literal, `__proto__: x` sets the prototype instead of creating a property.
            context.report({ path: [...path, key], node: prop, reason: 'unsupported' });
            continue;
        }

        if (!ts.isPropertyAssignment(prop)) {
            // Methods and accessors: functions, whatever their syntax.
            context.report({ path: [...path, key], node: prop, reason: 'runtime-value' });
            assign(result, key, UNEVALUABLE);
            continue;
        }

        assign(result, key, evaluateMember(prop.initializer, [...path, key], context));
    }
    return result;
}

/** The key of `prop`, or `undefined` once it is reported as unreadable, with the reason if a reference is to blame. */
function propertyKey(prop: ts.PropertyAssignment | ts.MethodDeclaration | ts.AccessorDeclaration, path: EvaluationPath, context: Context): string | undefined {
    const key = guard(prop, path, context, () => {
        const { name } = prop;

        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
        if (ts.isNumericLiteral(name)) return String(Number(name.text));
        if (!ts.isComputedPropertyName(name)) return UNEVALUABLE;

        const value = evaluateNode(name.expression, [], silent(context));

        return typeof value === 'string' || typeof value === 'number' ? String(value) : UNEVALUABLE;
    });

    return typeof key === 'string' ? key : undefined;
}

/**
 * Sets `key`, or removes it when its value could not be evaluated: the source
 * overrides whatever an earlier spread put there, so keeping that would show
 * a value the source replaces.
 */
function assign(target: Record<string, unknown>, key: string, value: unknown): void {
    if (value === UNEVALUABLE) {
        Reflect.deleteProperty(target, key);
        return;
    }
    setOwn(target, key, value);
}

/** An own property even for `__proto__`, which plain assignment would turn into the prototype. */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function isRuntimeValue(node: ts.Node, checker: ts.TypeChecker | undefined): boolean {
    const inner = skipParentheses(node);

    if (ts.isNewExpression(inner)) return !isDateConstruction(inner, checker);

    return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner) || ts.isClassExpression(inner);
}

function skipParentheses(node: ts.Node): ts.Node {
    return ts.isParenthesizedExpression(node) ? skipParentheses(node.expression) : node;
}

/**
 * Find a decorator by name on a class or property declaration.
 */
export function findDecorator(node: ts.ClassDeclaration | ts.PropertyDeclaration, name: string): ts.Decorator | undefined {
    const decorators = ts.getDecorators(node);

    if (!decorators) return undefined;

    return decorators.find((d) => {
        const expr = d.expression;

        // @Name
        if (ts.isIdentifier(expr)) return expr.text === name;
        // @Name(...)
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
            return expr.expression.text === name;
        }
        return false;
    });
}

/**
 * Extract the first argument of a decorator call expression.
 * Returns undefined if the decorator is not a call or has no arguments.
 */
export function getDecoratorArgument(decorator: ts.Decorator): ts.Expression | undefined {
    const expr = decorator.expression;

    if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
        return expr.arguments[0];
    }
    return undefined;
}

/**
 * One field of `@Component`/`@Directive`/`@Pipe` metadata, read from its own
 * property where the literal has one, so that `imports`, `providers` and the
 * rest are not resolved only to be thrown away. A spread or a shorthand could
 * supply the field from elsewhere, so then the whole argument is evaluated.
 * Without a `checker`, only what the literal itself says can be read.
 */
export function readDecoratorField(arg: ts.Expression, key: string, checker?: ts.TypeChecker): unknown {
    if (ts.isObjectLiteralExpression(arg) && !arg.properties.some(ts.isSpreadAssignment)) {
        const prop = arg.properties.find((p) => p.name !== undefined && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key);

        if (!prop) return undefined;
        if (ts.isPropertyAssignment(prop)) return evaluateExpression(prop.initializer, checker);
    }

    const raw = evaluateExpression(arg, checker);

    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
}

/**
 * Get the JSDoc comment for a node.
 */
export function getJsDocComment(node: ts.Node, checker: ts.TypeChecker): string | undefined {
    const symbol = checker.getSymbolAtLocation(ts.isClassDeclaration(node) || ts.isPropertyDeclaration(node) ? (node.name ?? node) : node);

    if (!symbol) return undefined;

    const doc = joinDocParts(symbol.getDocumentationComment(checker)).trim();

    return doc || undefined;
}

/**
 * Joins the parts of a comment like `ts.displayPartsToString`, except that a
 * link keeps the separator between its target and its text. TypeScript drops
 * it, and `{@link Item | the item}` would read `{@link Itemthe item}`. It only
 * splits a link into a `linkName` and a `linkText` when the target resolves to a
 * symbol. Any other target comes as one `linkText` that still ends in the blank
 * before the closing brace, which is trimmed here.
 */
function joinDocParts(parts: ts.SymbolDisplayPart[]): string {
    return parts
        .map((part, index) => {
            if (part.kind !== 'linkText') return part.text;

            const text = parts[index + 1]?.kind === 'link' ? part.text.trimEnd() : part.text;

            return parts[index - 1]?.kind === 'linkName' ? ` | ${text}` : text;
        })
        .join('');
}
