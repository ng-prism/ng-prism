import type { DirEntry, Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import ts from 'typescript';

const OLD_BG = 'checker';
const NEW_BG = 'transparent';

/**
 * Directories that hold no source of the workspace's own. Skipping them at the
 * directory level (instead of filtering every path) keeps the walk away from
 * `node_modules`, which a real workspace fills with tens of thousands of files.
 */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.angular', '.nx', '.git', 'ng-prism-cache']);

interface ShowcaseBindings {
    /** Local names of the decorator: `Showcase`, or `Demo` after `import { Showcase as Demo }`. */
    names: Set<string>;
    /** Local names of a namespace import of `@ng-prism/core`, for `@prism.Showcase(...)`. */
    namespaces: Set<string>;
}

interface Range {
    start: number;
    length: number;
}

function isPrismCore(specifier: string): boolean {
    return specifier === '@ng-prism/core' || specifier.startsWith('@ng-prism/core/');
}

/**
 * How the file spells the decorator. A file without an `@ng-prism/core` import
 * of `Showcase` (a re-export from a barrel, a path alias) keeps the plain
 * name: the library's own decorator is called `Showcase` almost everywhere.
 */
function findShowcaseBindings(sourceFile: ts.SourceFile): ShowcaseBindings {
    const names = new Set<string>();
    const namespaces = new Set<string>();

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !isPrismCore(statement.moduleSpecifier.text)) continue;

        const bindings = statement.importClause?.namedBindings;

        if (!bindings) continue;
        if (ts.isNamespaceImport(bindings)) {
            namespaces.add(bindings.name.text);
            continue;
        }
        for (const element of bindings.elements) {
            if ((element.propertyName ?? element.name).text === 'Showcase') names.add(element.name.text);
        }
    }
    if (names.size === 0) names.add('Showcase');
    return { names, namespaces };
}

function isShowcaseCallee(expression: ts.Expression, bindings: ShowcaseBindings): boolean {
    if (ts.isIdentifier(expression)) return bindings.names.has(expression.text);
    return (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        bindings.namespaces.has(expression.expression.text) &&
        expression.name.text === 'Showcase'
    );
}

/**
 * The expression inside parentheses, `as`, `satisfies`, `<T>` and `!`, which
 * the rewrite keeps: `bg: 'checker' as const` no longer compiles either.
 */
function unwrap(expression: ts.Expression): ts.Expression {
    while (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isNonNullExpression(expression)
    ) {
        expression = expression.expression;
    }
    return expression;
}

function propertyNameOf(name: ts.PropertyName): string | undefined {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

/**
 * The range between the quotes of a `'checker'` literal, so the replacement
 * keeps whichever quote style the author used. The raw text is compared, not
 * the cooked value: an escaped spelling like `'chec\x6Ber'` is left alone
 * because its length would not match.
 */
function checkerRange(expression: ts.Expression, sourceFile: ts.SourceFile): Range | undefined {
    if (!ts.isStringLiteral(expression) && !ts.isNoSubstitutionTemplateLiteral(expression)) return undefined;

    const start = expression.getStart(sourceFile);

    if (expression.getText(sourceFile).slice(1, -1) !== OLD_BG) return undefined;
    return { start: start + 1, length: OLD_BG.length };
}

function collectBgRanges(object: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, ranges: Range[]): void {
    for (const property of object.properties) {
        if (!ts.isPropertyAssignment(property) || propertyNameOf(property.name) !== 'bg') continue;

        const range = checkerRange(unwrap(property.initializer), sourceFile);

        if (range) ranges.push(range);
    }
}

/**
 * The `bg` of the decorator's config and of each inline variant. Only these two
 * places take a `CanvasBg`; a `bg` somewhere else in the config (a plugin's
 * `meta`, say) is not ours to touch.
 */
function collectFromConfig(config: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, ranges: Range[]): void {
    collectBgRanges(config, sourceFile, ranges);

    for (const property of config.properties) {
        if (!ts.isPropertyAssignment(property) || propertyNameOf(property.name) !== 'variants') continue;

        const variants = unwrap(property.initializer);

        if (!ts.isArrayLiteralExpression(variants)) continue;
        for (const element of variants.elements) {
            const variant = unwrap(element);

            if (ts.isObjectLiteralExpression(variant)) collectBgRanges(variant, sourceFile, ranges);
        }
    }
}

function findCheckerRanges(path: string, text: string): Range[] {
    const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const bindings = findShowcaseBindings(sourceFile);
    const ranges: Range[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isDecorator(node) && ts.isCallExpression(node.expression) && isShowcaseCallee(node.expression.expression, bindings)) {
            const config = node.expression.arguments[0] && unwrap(node.expression.arguments[0]);

            if (config && ts.isObjectLiteralExpression(config)) collectFromConfig(config, sourceFile, ranges);
        }
        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return ranges;
}

function collectTsFiles(dir: DirEntry, paths: string[]): void {
    for (const name of dir.subdirs) {
        if (!SKIPPED_DIRS.has(name)) collectTsFiles(dir.dir(name), paths);
    }
    for (const name of dir.subfiles) {
        if (name.endsWith('.ts')) paths.push(dir.file(name)!.path);
    }
}

/**
 * `bg: 'checker'` was removed from `CanvasBg` in 22.8.0. `'transparent'` is the
 * nearest value: a checkerboard while browsing, but a light one in both themes
 * (`checker` drew the theme's own), and see-through in a capture (`checker`
 * captured as the theme's surface colour). The rewrite keeps the intent, a
 * checkerboard, and the migration says what moved.
 */
export function migrate(): Rule {
    return (tree: Tree, context: SchematicContext) => {
        const paths: string[] = [];
        let rewritten = 0;

        collectTsFiles(tree.getDir('/'), paths);

        for (const path of paths) {
            const buffer = tree.read(path);

            if (!buffer) continue;
            // Decoded like the update recorder does it, so a byte order mark does not shift the offsets.
            const text = new TextDecoder().decode(buffer);

            if (!text.includes(OLD_BG) || !text.includes('Showcase')) continue;

            const ranges = findCheckerRanges(path, text);

            if (ranges.length === 0) continue;

            const recorder = tree.beginUpdate(path);

            for (const { start, length } of ranges) {
                recorder.remove(start, length);
                recorder.insertLeft(start, NEW_BG);
            }
            tree.commitUpdate(recorder);
            rewritten += ranges.length;
            context.logger.info(`${path}: bg '${OLD_BG}' → '${NEW_BG}' (${ranges.length}×)`);
        }

        if (rewritten > 0) {
            context.logger.warn(
                `ng-prism migration: 'transparent' is a light checkerboard in both themes, where 'checker' followed the theme, and a capture on it is see-through. Record the visual regression baselines again, or pick 'light' or 'dark' for an absolute background.`
            );
        }

        return tree;
    };
}
