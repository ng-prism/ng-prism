---
name: prism-scanner-module
description: Creates or extends scanner modules in packages/ng-prism/src/builder/scanner/. Triggers on "add scanner", "new extractor", "extend scanner", "add extraction", "scanner module".
---

# Scanner Module — Development Guide

Add or extend TypeScript Compiler API scanner modules under `packages/ng-prism/src/builder/scanner/`.

## Architecture

The scanner pipeline:

```
entry-point.scanner  →  component.scanner  →  manifest.generator
        ↓                      ↓
  resolves exports      uses input.extractor
  from the entry file   uses ast-utils
  (builder option       uses api/component-api.extractor
   `entryPoint`, e.g.   (API of a component or directive)
   public-api.ts)
        ↓
  service.scanner, pipe.scanner
        ↓
  use api/ (decorators, setup, members, types,
  export index; the API extractors of services,
  pipes and components/directives)
```

**Orchestrator:** `scanner.ts` connects everything. It exports `createScanner(options: CreateScannerOptions): Scanner` — a factory that returns the scanner, not a bare `scan()` function. Per entry point it calls `findShowcasedClasses(exports, checker)` (in `component.scanner.ts`) once, which resolves each export to its class, keeps the `@Showcase` ones and classifies each with `classifyShowcaseClass` (`@Component`/`@Directive` first, then `@Pipe`, then `@Injectable`/`@Service`, Angular's decorators found by their name in `@angular/core`, aliased or namespace imports included). `scanComponents`, `scanServices` and `scanPipes` take that `ShowcasedClass[]` and keep the classes of their `kind`, so the three never claim the same class and none classifies again. All three take an export index built from every entry point first, since a setup function or a type is often exported by another entry point than the class that names it. `scanComponents(showcased, checker, { diagnostics, notices, exportIndex, api, composition })` takes an options object. `composition` is the `CompositionContext` of the scan, which `createScanner` makes once per scan with `createCompositionContext(() => buildDeclarableIndex(entries, checker), …)`: the declarable index is built lazily, for the first showcase that composes, so a library without compositions never pays for it, and a throw there becomes one diagnostic. `scan(options?: ScanOptions)` reads `componentApi`, `services` and `pipes` (each `true` when not given): without `services` or `pipes` the scan only counts that kind, and without `componentApi` the components come without `api`. It returns `{ components, services, pipes, unread, diagnostics }`, `unread` counting what the options left unread. An extractor that throws must not take the scan down: catch it and `notify` with `describeUnreadableApi`, as the three scanners do.

## Existing Modules

| Module                             | Purpose                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ast-utils.ts`                     | Static AST evaluation utilities                                                                                                                                                  |
| `static-date.ts`                   | `StaticDate`, the `Date` a `new Date(…)` folds to, with its arguments for the manifest, and `isGlobalDate` for the runtime's `Date` as a value or a type                         |
| `class-hierarchy.ts`               | Walk a class's `extends` chain so inherited inputs are found (`getClassHierarchy`)                                                                                               |
| `entry-point.scanner.ts`           | Resolve exports from entry point                                                                                                                                                 |
| `component.scanner.ts`             | Find @Showcase components, extract config                                                                                                                                        |
| `input.extractor.ts`               | Extract `input()`/`output()`/`model()` metadata (and legacy `@Input()`/`@Output()`)                                                                                              |
| `manifest.generator.ts`            | Generate prism-manifest.ts source code                                                                                                                                           |
| `pseudo-states.ts`                 | Read and validate a variant's forced pseudo states (`readPseudoStates`)                                                                                                          |
| `showcase-diagnostics.ts`          | Word the warnings for `@Showcase` values the scan had to drop                                                                                                                    |
| `showcase-states.ts`               | Read and validate the component-level `states` list, keeping every slot (`readShowcaseStates`)                                                                                   |
| `entry-point-discovery.ts`         | Find a library's secondary entry points and its primary entry file (`discoverSecondaryEntryPoints`, `findPrimaryEntryFile`)                                                      |
| `service.scanner.ts`               | Find @Showcase services (`@Injectable`/`@Service` from `@angular/core`), read provision, `setup` and API (`scanServices`)                                                        |
| `api/`                             | API extraction for services, pipes, components and directives: decorators, `setup` reader, export index, doc tags, members, types                                                |
| `pipe.scanner.ts`                  | Find @Showcase pipes (`@Pipe` from `@angular/core`), read name, purity and standalone, extract `transform` (`scanPipes`)                                                         |
| `api/pipe-api.extractor.ts`        | `PipeApi` of one pipe: `transform` overloads (`extractOverloads` from `member.extractor.ts`, shared with service methods), also from a `.d.ts` base, setup and types             |
| `api/component-api.extractor.ts`   | `ComponentApi` of a component or directive, run for each by `scanComponents`: input types, output payloads, `model()` changes, documented methods, types (`extractComponentApi`) |
| `composition/read-composition.ts`  | Read the compositions of one showcase (`readComposition`) against the scan's `CompositionContext` (`createCompositionContext`, lazy declarable index)                            |
| `composition/compose-template.ts`  | Write the template of a composition: the subject in its host template or from its selector, with the slot, checked inside a `@case` (`composeTemplate`)                          |
| `composition/declarables.ts`       | Index the library's components, directives and pipes (`buildDeclarableIndex`), look up a showcase's `imports` without a program (`resolveShowcaseImports`), `readDeclarable`     |
| `composition/match-declarables.ts` | Decide what a composed template imports, and find unknown elements and pipes, ambiguous and non-standalone matches (`matchDeclarables`)                                          |
| `composition/template-elements.ts` | Shared helpers for template elements: `elementSelector`, `isInputBinding`, `localName`                                                                                           |
| `resolve-parts.ts`                 | Resolve `partOf` to a parent once all entry points are scanned, dropping the page-only fields of a part (`resolveParts`, `selectorList`, `PART_IGNORED_FIELDS`)                  |
| `scanner.ts`                       | Orchestrator — exports `createScanner(options)`, which returns a `Scanner` with components, services and pipes; runs `resolveParts` after the last entry point                   |
| `index.ts`                         | Public surface of the scanner (re-exports the functions and their types)                                                                                                         |

## Module Template

```typescript
// packages/ng-prism/src/builder/scanner/my-feature.ts
import ts from 'typescript';

export function myFeature(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker): MyResult[] {
    const results: MyResult[] = [];

    for (const member of classDecl.members) {
        if (!ts.isPropertyDeclaration(member)) continue;
        // ... extraction logic
    }

    return results;
}
```

## Test Template

```typescript
// packages/ng-prism/src/builder/scanner/my-feature.spec.ts
import path from 'node:path';
import ts from 'typescript';
import { resolveEntryPointExports } from './entry-point.scanner.js';
import { myFeature } from './my-feature.js';

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true,
    strict: true,
    skipLibCheck: true
};

describe('myFeature', () => {
    let checker: ts.TypeChecker;
    let exports: ts.Symbol[];

    beforeAll(() => {
        const entryFile = path.join(FIXTURES_DIR, 'public-api.ts');
        const result = resolveEntryPointExports([{ entryFile, importPath: 'fixture' }], compilerOptions);
        checker = result.program.getTypeChecker();
        exports = result.entries[0].exports;
    });

    it('should ...', () => {
        // resolve alias → get class declaration → call myFeature
    });
});
```

## Key Patterns

### Resolve alias symbols

```typescript
let sym = exports.find((s) => s.name === className)!;
if (sym.flags & ts.SymbolFlags.Alias) {
    sym = checker.getAliasedSymbol(sym);
}
const classDecl = sym.declarations!.find(ts.isClassDeclaration)!;
```

### Use ast-utils

```typescript
import { findDecorator, getDecoratorArgument, evaluateExpression, getJsDocComment } from './ast-utils.js';

const decorator = findDecorator(classDecl, 'Input');
const arg = getDecoratorArgument(decorator);
const value = evaluateExpression(arg);
const doc = getJsDocComment(member, checker);
```

### Type mapping

```typescript
const tsType = checker.getTypeAtLocation(member);

if (tsType.flags & ts.TypeFlags.StringLike) {
    /* string */
}
if (tsType.flags & ts.TypeFlags.NumberLike) {
    /* number */
}
if (tsType.flags & ts.TypeFlags.BooleanLike) {
    /* boolean */
}
if (tsType.isUnion()) {
    /* union — check for string literals */
}
if (checker.isArrayType(tsType)) {
    /* array */
}
```

## Conventions

- Use `.js` extensions in imports
- Test fixtures in `__fixtures__/`
- Export new modules from `index.ts`
- Add types to `plugin.types.ts` if they're part of the public API
- Tests use shared compiler options and shared fixture files
- Run tests: `npx nx test ng-prism -- --testPathPatterns=<module>`

## Checklist

- [ ] Module file created with clear, single-purpose function
- [ ] Spec file with comprehensive tests
- [ ] Fixtures added/updated if needed
- [ ] Exported from `index.ts`
- [ ] Types added to `plugin.types.ts` if public
- [ ] Tests pass: `npx nx test ng-prism`
- [ ] Build passes: `npx nx build ng-prism`
- [ ] Lint passes: `npx nx run-many -t lint` (runs with `--max-warnings 0`, so a warning fails it)
