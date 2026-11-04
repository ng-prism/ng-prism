import ts from 'typescript';
import type { InputMeta, OutputMeta } from '../../plugin/plugin.types.js';
import { evaluateExpression, evaluateStatic, findDecorator, getDecoratorArgument, getJsDocComment, UNEVALUABLE } from './ast-utils.js';
import { type ClassHierarchy, getClassHierarchy } from './class-hierarchy.js';
import { isGlobalDate } from './static-date.js';

/**
 * Extract all @Input(), input() and model() signal metadata from a class
 * declaration and the base classes Angular inherits inputs from. An input the
 * subclass redeclares wins over the one in its base class.
 */
export function extractInputs(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker, hierarchy = getClassHierarchy(classDecl, checker)): InputMeta[] {
    const inputs: InputMeta[] = [];
    const seen = new Set<string>();
    // Fields a more derived class initializes without declaring them an input.
    // Angular keeps the inherited input, but the component starts out with that value.
    const reinitialized = new Map<string, ts.PropertyDeclaration>();

    for (const { classDecl: owner, definesMetadata } of hierarchy.classes) {
        const subclass = owner === classDecl ? undefined : classDecl;

        for (const member of owner.members) {
            if (!ts.isPropertyDeclaration(member) || isStatic(member)) continue;

            const name = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;

            if (!name || seen.has(name)) continue;

            const input = definesMetadata ? readInput(member, name, checker, owner, subclass) : undefined;

            if (!input) {
                if (member.initializer && !reinitialized.has(name)) reinitialized.set(name, member);
                continue;
            }

            const initializedBy = reinitialized.get(name);

            if (initializedBy) {
                delete input.defaultValue;
                delete input.defaultUnreadable;
                Object.assign(input, defaultFields(readInitialValue(initializedBy, checker)));
            }

            seen.add(name);
            inputs.push(input);
        }
    }

    return inputs;
}

/**
 * The declaration Angular takes an input from: the member of that name in the
 * nearest class that defines metadata and declares it an input, the one
 * {@link extractInputs} reads.
 */
export function findInputDeclaration(hierarchy: ClassHierarchy, name: string): { member: ts.PropertyDeclaration; owner: ts.ClassDeclaration } | undefined {
    return findDeclaration(hierarchy, name, (member) => !isStatic(member) && (!!findDecorator(member, 'Input') || !!getInputSignalCall(member)));
}

/** The declaration Angular takes an output from, as {@link findInputDeclaration} for an input. */
export function findOutputDeclaration(hierarchy: ClassHierarchy, name: string): { member: ts.PropertyDeclaration; owner: ts.ClassDeclaration } | undefined {
    return findDeclaration(hierarchy, name, (member) => !!findDecorator(member, 'Output') || isOutputSignal(member));
}

/** Whether an input is a `model()` or `model.required()`, for which Angular adds a change output. */
export function isModelInput(member: ts.PropertyDeclaration): boolean {
    const call = getInputSignalCall(member);
    const callee = call && (ts.isPropertyAccessExpression(call.expression) ? call.expression.expression : call.expression);

    return !!callee && ts.isIdentifier(callee) && callee.text === 'model';
}

function findDeclaration(
    hierarchy: ClassHierarchy,
    name: string,
    declares: (member: ts.PropertyDeclaration) => boolean
): { member: ts.PropertyDeclaration; owner: ts.ClassDeclaration } | undefined {
    for (const { classDecl: owner, definesMetadata } of hierarchy.classes) {
        if (!definesMetadata) continue;

        const member = owner.members.find(
            (m): m is ts.PropertyDeclaration => ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === name && declares(m)
        );

        if (member) return { member, owner };
    }

    return undefined;
}

function isStatic(member: ts.PropertyDeclaration): boolean {
    return !!ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
}

/**
 * What a field starts out with: its initializer, or for `input()` and `model()` the value passed to them. `undefined`
 * when there is none, {@link UNEVALUABLE} when there is one the scan cannot read.
 */
function readInitialValue(member: ts.PropertyDeclaration, checker: ts.TypeChecker): unknown {
    const signalCall = getInputSignalCall(member);

    if (!signalCall) return member.initializer ? evaluateDefault(member.initializer, checker) : undefined;

    return !isSignalInputRequired(signalCall) && signalCall.arguments.length > 0 ? evaluateDefault(signalCall.arguments[0], checker) : undefined;
}

/** How {@link InputMeta} carries what {@link readInitialValue} found: a value, or that there is one that could not be read. */
function defaultFields(initial: unknown): Pick<InputMeta, 'defaultValue' | 'defaultUnreadable'> {
    if (initial === UNEVALUABLE) return { defaultUnreadable: true };

    return initial === undefined ? {} : { defaultValue: initial };
}

/**
 * `owner` declares the member. `subclass` is the showcased class when that is
 * a different one, which decides what the type parameters of `owner` stand for.
 */
function readInput(
    member: ts.PropertyDeclaration,
    name: string,
    checker: ts.TypeChecker,
    owner: ts.ClassDeclaration,
    subclass?: ts.ClassDeclaration
): InputMeta | undefined {
    const inputDecorator = findDecorator(member, 'Input');

    if (inputDecorator) {
        const required = isDecoratorInputRequired(inputDecorator);
        const alias = readAlias(getDecoratorArgument(inputDecorator), name, checker);
        const initial = readInitialValue(member, checker);
        const doc = getJsDocComment(member, checker);
        const instantiated = subclass && usesTypeParameters(member.type ?? member.initializer, owner, checker) ? getInstantiatedType(name, subclass, checker) : undefined;
        const { type, values, rawType, emptyValue } = instantiated ? mapType(instantiated, checker) : resolveDecoratorInputType(member, checker);

        return {
            name,
            ...(alias && { alias }),
            type,
            rawType,
            required,
            ...(values && { values }),
            ...(emptyValue && { emptyValue }),
            ...defaultFields(initial),
            ...(doc && { doc })
        };
    }

    const signalCall = getInputSignalCall(member);

    if (!signalCall) return undefined;

    const required = isSignalInputRequired(signalCall);
    // `input(initial, options)`, but `input.required(options)`.
    const alias = readAlias(signalCall.arguments[required ? 0 : 1], name, checker);
    const initial = readInitialValue(member, checker);
    const doc = getJsDocComment(member, checker);
    const declaredType = signalCall.typeArguments?.[0] ?? signalCall.arguments[0];
    // A signal is a getter function, so its call signature returns the value type.
    const instantiated =
        subclass && usesTypeParameters(declaredType, owner, checker) ? getInstantiatedType(name, subclass, checker)?.getCallSignatures()[0]?.getReturnType() : undefined;
    const { type, values, rawType, emptyValue: written } = instantiated ? mapType(instantiated, checker) : resolveSignalInputType(signalCall, checker);
    // `input<Date>()` is an `InputSignal<Date | undefined>`, which the type argument alone does not say.
    const emptyValue = type === 'date' && !required && signalCall.arguments.length === 0 ? (written ?? 'undefined') : written;

    return {
        name,
        ...(alias && { alias }),
        type,
        rawType,
        required,
        ...(values && { values }),
        ...(emptyValue && { emptyValue }),
        ...defaultFields(initial),
        ...(doc && { doc }),
        ...(isModelInput(member) && { model: true as const })
    };
}

/**
 * The `alias` of an input or output, from a decorator argument (`'x'` or
 * `{ alias: 'x' }`) or the options of `input()`, `model()` and `output()`.
 * It counts when the builder can evaluate it statically to a string (a literal
 * or a constant) that differs from the member name.
 */
function readAlias(arg: ts.Expression | undefined, name: string, checker: ts.TypeChecker): string | undefined {
    const value = arg ? evaluateExpression(arg, checker) : undefined;
    const alias = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['alias'] : value;

    return typeof alias === 'string' && alias !== name ? alias : undefined;
}

/**
 * Extract all @Output() and output() signal metadata from a class declaration
 * and the base classes Angular inherits outputs from.
 */
export function extractOutputs(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker, hierarchy = getClassHierarchy(classDecl, checker)): OutputMeta[] {
    const outputs: OutputMeta[] = [];
    const seen = new Set<string>();

    for (const { classDecl: owner, definesMetadata } of hierarchy.classes) {
        if (!definesMetadata) continue;

        for (const member of owner.members) {
            if (!ts.isPropertyDeclaration(member)) continue;

            const name = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;

            if (!name || seen.has(name)) continue;

            const outputDecorator = findDecorator(member, 'Output');

            if (!outputDecorator && !isOutputSignal(member)) continue;

            const doc = getJsDocComment(member, checker);
            const options = outputDecorator ? getDecoratorArgument(outputDecorator) : (member.initializer as ts.CallExpression).arguments[0];
            const alias = readAlias(options, name, checker);

            seen.add(name);
            outputs.push({ name, ...(alias && { alias }), ...(doc && { doc }) });
        }
    }

    return outputs;
}

/**
 * Whether a declared type, or the expression a type is inferred from,
 * mentions a type parameter of the class that declares it. Only then does the
 * subclass change the type; otherwise the source text stays, alias names included.
 */
export function usesTypeParameters(node: ts.Node | undefined, owner: ts.ClassDeclaration, checker: ts.TypeChecker): boolean {
    const parameters = owner.typeParameters;

    if (!node || !parameters?.length) return false;

    const isOwnParameter = (declaration: ts.Declaration | undefined) => !!declaration && ts.isTypeParameterDeclaration(declaration) && parameters.includes(declaration);
    const visit = (child: ts.Node): boolean => {
        if (ts.isTypeReferenceNode(child) && ts.isIdentifier(child.typeName) && isOwnParameter(checker.getSymbolAtLocation(child.typeName)?.declarations?.[0])) {
            return true;
        }

        return ts.forEachChild(child, visit) ?? false;
    };

    // An inferred type can depend on `T` without the source naming it: `model(this.initial)`.
    return visit(node) || (!ts.isTypeNode(node) && typeMentions(checker.getTypeAtLocation(node), isOwnParameter, checker));
}

function typeMentions(
    type: ts.Type,
    isOwnParameter: (declaration: ts.Declaration | undefined) => boolean,
    checker: ts.TypeChecker,
    visited = new Set<ts.Type>()
): boolean {
    if (visited.has(type)) return false;
    visited.add(type);

    if (type.flags & ts.TypeFlags.TypeParameter) return isOwnParameter(type.symbol?.declarations?.[0]);

    const isReference = type.flags & ts.TypeFlags.Object && (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference;
    const nested = [
        ...(type.isUnionOrIntersection() ? type.types : []),
        ...(type.aliasTypeArguments ?? []),
        ...(isReference ? checker.getTypeArguments(type as ts.TypeReference) : [])
    ];

    return nested.some((t) => typeMentions(t, isOwnParameter, checker, visited));
}

/**
 * The type of a property declared in a generic base class, as the subclass
 * sees it: `items = input.required<T[]>()` in `Field<T>` is an
 * `InputSignal<Country[]>` on `Picker extends Field<Country>`.
 */
export function getInstantiatedType(name: string, subclass: ts.ClassDeclaration, checker: ts.TypeChecker): ts.Type | undefined {
    const property = checker.getPropertyOfType(checker.getTypeAtLocation(subclass), name);

    return property && checker.getTypeOfSymbolAtLocation(property, subclass);
}

/**
 * A default is all or nothing. The renderer applies it to the component, so
 * the part of `{ ...shared, size: 'm' }` that can be read would overwrite the
 * whole default the component actually declares: it is {@link UNEVALUABLE}
 * instead, so that a default the scan could not read stays apart from one that
 * is `undefined`.
 */
function evaluateDefault(node: ts.Expression, checker: ts.TypeChecker): unknown {
    let complete = true;
    const value = evaluateStatic(node, { checker, report: () => (complete = false) });

    return complete ? value : UNEVALUABLE;
}

function getInputSignalCall(member: ts.PropertyDeclaration): ts.CallExpression | null {
    const init = member.initializer;

    if (!init || !ts.isCallExpression(init)) return null;

    const expr = init.expression;

    if (ts.isIdentifier(expr) && (expr.text === 'input' || expr.text === 'model')) return init;

    if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        (expr.expression.text === 'input' || expr.expression.text === 'model') &&
        ts.isIdentifier(expr.name) &&
        expr.name.text === 'required'
    ) {
        return init;
    }

    return null;
}

function isSignalInputRequired(callExpr: ts.CallExpression): boolean {
    const expr = callExpr.expression;

    return ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name) && expr.name.text === 'required';
}

function isOutputSignal(member: ts.PropertyDeclaration): boolean {
    const init = member.initializer;

    if (!init || !ts.isCallExpression(init)) return false;
    const expr = init.expression;

    return ts.isIdentifier(expr) && expr.text === 'output';
}

/** What the type of an input says about it, as {@link InputMeta} carries it. */
interface MappedType {
    type: InputMeta['type'];
    values?: string[];
    rawType: string;
    emptyValue?: InputMeta['emptyValue'];
}

function resolveSignalInputType(callExpr: ts.CallExpression, checker: ts.TypeChecker): MappedType {
    if (callExpr.typeArguments && callExpr.typeArguments.length > 0) {
        const typeNode = callExpr.typeArguments[0];
        const resolved = checker.getTypeFromTypeNode(typeNode);

        return mapType(resolved, checker, normalizeTypeText(typeNode.getText()));
    }

    if (callExpr.arguments.length > 0) {
        const argType = checker.getTypeAtLocation(callExpr.arguments[0]);

        return mapType(argType, checker);
    }

    return { type: 'unknown', rawType: 'unknown' };
}

function isDecoratorInputRequired(decorator: ts.Decorator): boolean {
    const arg = getDecoratorArgument(decorator);

    if (!arg || !ts.isObjectLiteralExpression(arg)) return false;

    for (const prop of arg.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'required') {
            return prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        }
    }
    return false;
}

function resolveDecoratorInputType(member: ts.PropertyDeclaration, checker: ts.TypeChecker): MappedType {
    const tsType = checker.getTypeAtLocation(member);
    const declaredText = member.type ? normalizeTypeText(member.type.getText()) : undefined;

    return mapType(tsType, checker, declaredText);
}

function normalizeTypeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function getRawTypeLabel(tsType: ts.Type, checker: ts.TypeChecker): string {
    if (tsType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLike | ts.TypeFlags.BooleanLiteral)) {
        return 'boolean';
    }

    if (tsType.isUnion()) {
        const meaningful = tsType.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null));

        if (meaningful.length === 0) return checker.typeToString(tsType);
        if (meaningful.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) return 'boolean';
        if (meaningful.length === 1) return checker.typeToString(meaningful[0]);
        if (tsType.aliasSymbol) return tsType.aliasSymbol.getName();
        return meaningful.map((t) => checker.typeToString(t)).join(' | ');
    }
    return checker.typeToString(tsType);
}

function mapType(tsType: ts.Type, checker: ts.TypeChecker, rawTypeOverride?: string): MappedType {
    const rawType = rawTypeOverride ?? getRawTypeLabel(tsType, checker);

    if (tsType.flags & ts.TypeFlags.BooleanLike) {
        return { type: 'boolean', rawType };
    }
    if (tsType.flags & ts.TypeFlags.Boolean) {
        return { type: 'boolean', rawType };
    }

    if (tsType.isUnion()) {
        const filtered = tsType.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null));

        if (filtered.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) {
            return { type: 'boolean', rawType };
        }

        if (filtered.every((t) => t.isStringLiteral())) {
            const values = filtered.map((t) => (t as ts.StringLiteralType).value);

            return { type: 'union', values, rawType };
        }

        if (filtered.length === 1) {
            const mapped = { ...mapType(filtered[0], checker), rawType };

            if (mapped.type !== 'date') return mapped;

            // What the union lets an emptied date control write, `null` first.
            const allows = (flag: ts.TypeFlags) => tsType.types.some((t) => t.flags & flag);
            const emptyValue = allows(ts.TypeFlags.Null) ? 'null' : allows(ts.TypeFlags.Undefined) ? 'undefined' : undefined;

            return emptyValue ? { ...mapped, emptyValue } : mapped;
        }

        return { type: 'unknown', rawType };
    }

    if (tsType.flags & ts.TypeFlags.StringLike) {
        return { type: 'string', rawType };
    }

    if (tsType.flags & ts.TypeFlags.NumberLike) {
        return { type: 'number', rawType };
    }

    if (checker.isArrayType(tsType)) {
        return { type: 'array', rawType };
    }

    if (tsType.flags & ts.TypeFlags.Object && tsType.symbol && isGlobalDate(tsType.symbol, checker)) {
        return { type: 'date', rawType };
    }

    if (tsType.flags & ts.TypeFlags.Object) {
        return { type: 'object', rawType };
    }

    return { type: 'unknown', rawType };
}
