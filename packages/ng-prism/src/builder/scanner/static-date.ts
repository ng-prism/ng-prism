import ts from 'typescript';

/** What `new Date(…)` takes: one string or number, or the year, the month and the rest as numbers. */
export type DateArguments = readonly (string | number)[];

/**
 * A `Date` the scan read from `new Date(…)` in the source. Plugins that see the scan get a `Date` like any other, in
 * the time zone of the build. `args` are the arguments as the source writes them, and the manifest writes them again:
 * the browser then makes the `Date` the source makes, so `new Date(2026, 3, 28)` is local midnight where the
 * styleguide is open, not where it was built. Since 22.8.0.
 */
export class StaticDate extends Date {
    readonly args: DateArguments;

    constructor(args: DateArguments) {
        // `Date`'s overloads take no spread of mixed arguments; the time of the `Date` they make is the same.
        super((Reflect.construct(Date, args) as Date).getTime());
        this.args = args;
    }
}

/**
 * Whether `symbol` is the global `Date` of the JavaScript runtime rather than a class or type of the project that has
 * the name: it is declared in a declaration file of global scope, such as TypeScript's own libraries. Without a
 * checker, or for a name that resolves to nothing, there is nothing else it could be.
 */
export function isGlobalDate(symbol: ts.Symbol | undefined, checker: ts.TypeChecker | undefined): boolean {
    if (!symbol || !checker) return true;

    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

    return (
        target.name === 'Date' &&
        (target.declarations ?? []).some((declaration) => {
            const sourceFile = declaration.getSourceFile();

            return sourceFile.isDeclarationFile && !ts.isExternalModule(sourceFile);
        })
    );
}
