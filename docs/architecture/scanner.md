# Scanner

The ng-prism scanner uses the TypeScript Compiler API to extract `@Showcase` metadata, component structure, and input/output types from library source files at build time, with no runtime reflection.

## Entry

The scanner is created via `createScanner()` in `src/builder/scanner/scanner.ts`:

```typescript
const scanner = createScanner({
    entryPoints: [{ entryFile: 'packages/my-lib/src/public-api.ts', importPath: 'my-lib' }]
});
const { components, services, pipes, unread, diagnostics } = scanner.scan({ componentApi: true, services: true, pipes: false });
```

Each `scan()` call creates a `ts.Program` with every entry file as a root and resolves the exports of each entry point. `findShowcasedClasses()` classifies the `@Showcase` classes among them once, and `scanComponents()`, `scanServices()` and `scanPipes()` each take that list and keep the classes of their kind. A `@Showcase` class goes to exactly one of the three, see [Services](#services) and [Pipes](#pipes).

`ScanOptions` says what the scan reads beyond the components, each `true` when not given:

- **`componentApi`**: [`ScannedComponent.api`](#api-of-a-component-or-directive). Without it the components come without `api` and `extractComponentApi()` never runs.
- **`services`** and **`pipes`**: without them `scanServices()` or `scanPipes()` does not run. The scan only counts the showcased classes of that kind, once each however many entry points export them, in `ScanResult.unread`. Nothing of them is read, so none of their warnings or [diagnostics](#diagnostics) appear.

The pipeline passes what the plugins in the config use: `componentApi` when a plugin sets [`componentApi`](api/ng-prism-plugin.md#componentapi), `services` and `pipes` when a plugin has a view panel that applies to them, see [The Build Pipeline](architecture/pipeline.md).

## Incremental Builds: the `createScanner()` Factory

`createScanner()` is a stateful factory. Between calls it keeps the previous `ts.Program` and a source-file cache (`source-file-cache.ts`), and passes both to `ts.createProgram(files, opts, host, oldProgram)`.

TypeScript only takes a `SourceFile` over from the old program when the compiler host returns the identical object. The default host reads and parses on every call, so an old program on its own saves nothing. The cache's host returns the already parsed `SourceFile` for as long as the file's mtime and size stay the same. A watch rebuild therefore parses only the files that changed, and the binding TypeScript stores on each `SourceFile` carries over with it.

```typescript
export function createScanner(options: CreateScannerOptions): Scanner {
    const sourceFiles = createSourceFileCache(compilerOptions);
    let previousProgram: ts.Program | undefined;

    return {
        scan() {
            const { program, entries } = resolveEntryPointExports(
                options.entryPoints,
                compilerOptions,
                previousProgram,
                sourceFiles.host // ← hands unchanged SourceFiles back to TypeScript
            );
            previousProgram = program;
            sourceFiles.prune(program);
            // ...
        }
    };
}
```

Two rules keep the scan correct:

- **Module resolutions are recomputed on every scan.** The host reports them as invalidated (`hasInvalidatedResolutions`). If they were reused, a file created after an import of it had already failed to resolve would stay invisible, because the importing file itself did not change.
- **The cache only holds files of the latest program.** After each scan it drops every file the new program no longer contains.

An edit that keeps the file size and lands within the file system's mtime resolution goes unseen. APFS and ext4 record nanoseconds, so in practice this does not happen.

Every scan still walks the exports of every entry point. Next to parsing, that walk is cheap, so its result is not cached per entry point.

## Entry Point Discovery

The pipeline accepts either a directory or a file as `entryPoint`. Both lead to the same discovery of secondary entry points; a file is first resolved upward to its containing library. After the secondary entry points comes the primary one: a file `entryPoint` is the primary entry file itself, a directory names it as `lib.entryFile` in its `ng-package.json`. The default for a missing `lib.entryFile` differs between the two: the primary entry point falls back to ng-packagr's `src/public_api.ts` (`findPrimaryEntryFile()`), a secondary one to `public-api.ts` next to its `ng-package.json` (`discoverSecondaryEntryPoints()`), both in `entry-point-discovery.ts`. When neither yields an entry file, the pipeline warns, see [No entry file](api/build-warnings.md#no-entry-file). The option itself, as a user sets it, is under [`entryPoint`](api/builders.md#entrypoint).

### Directory entryPoint

If `entryPoint` is a directory, `discoverSecondaryEntryPoints()` walks it recursively looking for `ng-package.json` files. For each `ng-package.json` that does not have a `dest` field (i.e. a secondary entry point, since `dest` is conventionally only set on the primary), the scanner reads `lib.entryFile` (default: `public-api.ts`, see above) and derives the import path from the relative directory name. It does not descend into a secondary entry point, and it skips `node_modules` and `.git`.

```
packages/my-lib/
  public-api.ts                  ← primary (ng-package.json with `dest`, scanned last)
  atoms/ng-package.json          → 'my-lib/atoms'
  molecules/ng-package.json      → 'my-lib/molecules'
```

All entry points, the primary one included, share one `Scanner` and one `ts.Program`, cached on `PrismPipelineState.scanner`. The scanner is recreated when the set of entry files changes. Every rebuild scans all of them again (see [Incremental Builds](#incremental-builds-the-createscanner-factory)).

The primary entry point is scanned last and marked `primary`. A component it re-exports from a secondary entry point keeps the secondary's import path, without the "exported by multiple entry points" notice that other duplicates get.

### File entryPoint (auto-detected library root)

If `entryPoint` is a `.ts` file, the pipeline walks upward to find the nearest `ng-package.json` and treats that directory as the library root. The same discovery logic then runs, so secondary entry points are still picked up automatically:

```
entryPoint = "projects/my-lib/public-api.ts"
            ↓ walk upward, find ng-package.json
libraryRoot = "projects/my-lib"
            ↓ discoverSecondaryEntryPoints()
[my-lib/atoms, my-lib/molecules, ...]
```

If no `ng-package.json` is found above the file, the file is the only entry point, which keeps non-ng-packagr setups working.

## How Decorators Are Extracted

`findShowcasedClasses()` in `component.scanner.ts` is the common start of the component, service and pipe scans. It resolves each exported symbol to its class declaration, keeps the ones with `@Showcase` (found with `findDecorator()`), and classifies each once with `classifyShowcaseClass()` (see [Telling a service or pipe from a component](#telling-a-service-or-pipe-from-a-component)). The result is a `ShowcasedClass[]`: symbol, class, `@Showcase` decorator, its argument and `kind`. `scanComponents()` then checks the class for `@Component` and `@Directive`.

**`findDecorator(node, name)`** in `ast-utils.ts` walks the node's decorator list and matches by identifier name, in any position. It supports both call-expression decorators (`@Component({...})`) and plain identifier decorators. An aliased import (`import { Showcase as S }`) or a namespace call (`@prism.Showcase()`) does not match.

**`evaluateStatic(node, { report, checker })`** in `ast-utils.ts` folds an AST node into a JavaScript value without running anything. What it folds and what it drops, as a library author sees it, is under [What the Scanner Reads](guide/scanner-reads.md). The parts that are not visible from outside:

- **Operators.** Arithmetic folds on numbers only, and `+` concatenates once either side is a string and the other a primitive; anything JavaScript would coerce beyond that, such as an object to `[object Object]`, is unfoldable. A result JSON cannot carry (`Infinity`, `NaN`) is unfoldable too, since it would reach the manifest as `null`. Conditions, comparisons and logical operators are left out on purpose: the evaluator folds values, it does not interpret code.
- **References.** With the program's `TypeChecker`, which the scanner already holds from `scanComponents(showcased, checker)`, an identifier or shorthand property whose symbol, after following imports with `getAliasedSymbol`, is a `const` with an initializer folds to that initializer. An enum member folds to `checker.getConstantValue()` of its declaration: asking the declaration matters, since for an access like `Size.Medium` the checker only answers for `const enum`s.
- **Accesses.** A property or element access folds by reading from the folded object, unless the access names a declaration of its own, as `tokens.MAX_FILES` on a namespace import does. If folding the object dropped anything the read depends on, the access fails instead of reading a wrong value: the property itself, something a spread might have supplied, or, in an array, an earlier element whose removal moved the later ones and `length`.
- **Literals.** A later property that fails removes the key an earlier spread set, since the source overrides it. Keys are defined as own properties, and `__proto__: x`, which sets a prototype in JavaScript, is dropped. A hole in a sparse array keeps its slot as `undefined`.
- **Constants.** A set of the declarations being folded stops a constant that refers back to itself. Members inside a constant are folded like any others, so a constant costs only its unreadable members, and their issues point into the constant's own file. Each constant is folded once per `evaluateStatic` call; its issues are replayed at every reference's path, and every reference gets its own `structuredClone` of the value, so no two parts of a config share an object.

Whatever it cannot fold costs only the member that holds it: an object keeps its other properties, an array its other elements, and a spread, a shorthand property or an unreadable computed key drops just itself. Each drop goes to `report` as an `UnevaluableIssue`:

- `path`: where the value sat, e.g. `['variants', 3, 'inputs', 'maxFileSize']`, with array indices as written in the source
- `node`: the expression, spread or property that could not be folded
- `reason`: `runtime-value` for functions, classes and instances, which no static evaluation can capture; `unsupported` for everything else
- `cause`: the innermost reference that failed, if one did, with its kind (`let`, `var`, `no-value`, `cycle`, `runtime-value`). Operands and placeholders fold silently, so this is how `5 * MB` can still say that `MB` is a `let`.

Only a root that cannot be folded at all comes back as the `UNEVALUABLE` sentinel, a symbol that keeps it distinct from an `undefined` written on purpose.

All three callers pass the checker. They treat a drop differently:

| Caller                               | Entry point                               | On a dropped value                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Showcase` config                   | `evaluateStatic` with a reporter          | Warns (see [Diagnostics](#diagnostics))                                                                                                                                                           |
| `@Component` / `@Directive` metadata | `evaluateExpression`                      | Nothing. Only the `selector` and `standalone` properties are evaluated, so `imports: [FooComponent]` is never resolved                                                                            |
| Input defaults                       | `evaluateDefault` in `input.extractor.ts` | Nothing, but the whole default goes: the renderer applies `defaultValue` to the component, so the readable part of a default would overwrite the real one. `InputMeta.defaultUnreadable` marks it |

### Diagnostics

`describeUnevaluable()` in `showcase-diagnostics.ts` turns each `@Showcase` issue into a message: the component, the path (a variant or a state is named by its index and its `name`), the source text, and its `file:line:column` relative to the working directory so terminals and editors can link it.

`scanComponents()` prints each message once through `report` and collects it in a `diagnostics` array. The values it rejects after evaluation, in `readShowcaseConfig()`, go through the same channel, and so do the problems of a [composition](#compositions), each worded with the showcase's file, line and variant, the deprecated `providers` field (one message for the whole field), and the diagnostics of a service or a pipe (see [Services](#services) and [Pipes](#pipes)). Those last ones only exist while the scan reads services and pipes at all: when no plugin shows them, it only counts them and reports nothing about them. `createScanner().scan()` shares one array across all entry points, so a component exported from several of them warns once, and returns it as `ScanResult.diagnostics`. The pipeline throws on a non-empty array when [`strictShowcase`](api/ng-prism-config.md#strictshowcase) is on, before plugin hooks run and before a manifest is written.

Next to `report` there is `notify`, for warnings that are not diagnostics: nothing in the `@Showcase` argument was dropped, so `strictShowcase` does not fail over them. A shared `notices` set prints each of them once. Notices come from compositions, base classes (see [Base classes](#base-classes)), decorator inputs, the legacy classification (see [Telling a service or pipe from a component](#telling-a-service-or-pipe-from-a-component)) and an extractor that throws: `describeUnreadableApi()` reports it, since reading an API must not take the scan down. The scan catches the error and goes on with the next class; a component keeps its page without `api`, a service or a pipe has nothing else to show and is left out. A deprecated `bg: 'checker'` goes to `console.warn` directly, without either channel, since nothing is lost.

Every message, with its kind, cause and fix, is in [Build Warnings](api/build-warnings.md).

`readShowcaseStates()` in `showcase-states.ts` reads the component-level `states` list, and it keeps every slot, because a state is identified by its position (see [States & Pseudo States](guide/states.md#order-is-identity)): an entry it cannot use becomes `{ name, pseudo: {} }`, an empty column in the Overview, instead of being removed and shifting the entries behind it. A state's `pseudo` goes through `readPseudoStates()` in `pseudo-states.ts`, as a variant's does, and its messages are worded with the state's name. An entry `evaluateStatic` could not read at all (`states: [a, buildState(), c]`) is gone from the evaluated list, so `component.scanner.ts` notes the position from the issue's path and `readShowcaseStates()` puts an empty `State <position>` slot back there; the unevaluable message already explains it, so it adds none. An empty list reads as no states and reports nothing.

## Compositions

A variant with a `template`, or with a `host: { template }` of its own or from the showcase, is a composition (since 22.7.0), and so is a directive's variant with a `template` in a string or object host. The scan checks each one the way Angular will compile it, so that a mistake is reported where it is written instead of in the generated file. The code is in `builder/scanner/composition/`, and the result is `ScannedComponent.composition`, see [`ComponentComposition`](api/types.md#componentcomposition).

- **Declarable index.** `buildDeclarableIndex()` in `declarables.ts` reads the selector of every component and directive, and the name of every pipe, that any scanned entry point exports, together with the import path of the entry point. Classes without `@Showcase` and `@internal` ones count, and a class an entry point re-exports from a dependency is read from its `.d.ts`. Each entry says whether the class is standalone: it is unless the decorator says `standalone: false`, or a `.d.ts` has `false` as the `IsStandalone` type argument. A class without a selector is left out, and so are a default export, which the manifest cannot import by name, and a class whose selector Angular cannot parse, which `createCompositionContext()` names once in a notice. The index covers all entry points, since a template uses what any of them exports. `createCompositionContext()` builds it once per scan, when the first showcase that composes asks for it, so a library without compositions does not pay for it on any re-scan of `serve`. When building it throws, that is one diagnostic, and no showcase of the scan gets a composition.
- **Imports.** `resolveShowcaseImports()` looks up each `{ name, from }` of `ShowcaseImport` without a program. It resolves the module with `moduleResolution: Bundler`, because the default `Node10` does not find a package that only has `exports`, such as `@angular/cdk/text-field`. It reads the class from the file it lands in and follows `export … from` up to five modules. The selector or pipe name comes from the decorator, or, in a `.d.ts`, from the `ɵcmp`, `ɵdir` or `ɵpipe` member the compiler left (`ɵɵDirectiveDeclaration<CdkTextareaAutosize, "textarea[cdkTextareaAutosize]", …>`). An entry it cannot find or read, such as an NgModule or a service, comes back unresolved.
- **Composing.** `composeTemplate()` in `compose-template.ts` puts the pieces together. Without a host template the subject is written from its selector (`selectorElement()` takes the element and attributes of the first fitting part) with the variant's template inside. In a host template the subject is the element that `SelectorMatcher` matches, or the one marked `prism-subject`, found in the parsed template, and a template replaces what it holds. The host template, and then the composed template, are parsed again inside a `@case`, as the generated wrapper holds them: at the top level Angular closes an element left open at the end, in a block it fails. A private-use character, `COMPOSITION_SUBJECT_SLOT`, marks the end of its start tag: the generator turns it into bindings, snippets into the current attributes. The inputs the host template sets on the subject (an attribute with a value, or a property binding) are returned as `ownedInputs`.
- **Matching.** `matchDeclarables()` in `match-declarables.ts` walks the parsed template with Angular's own AST visitors, matches every element and `<ng-template>` against the index and the resolved imports with `SelectorMatcher`, and collects the pipes the expressions call. A library class is imported when its selector matches and the matching part names something the author wrote: an element with a `-`, or an attribute that `DomElementSchemaRegistry` does not know as a property of that element. What it leaves out because of that comes back as `skipped`, for the notice. A library class that is not standalone is never imported, as Angular takes only standalone classes in `imports`, and declares nothing: it comes back as `notStandalone`, for a notice, and its element counts as unknown unless an import of the showcase, its NgModule, may declare it. Elements that are neither standard HTML (`DomElementSchemaRegistry`, which also catches a typo like `<inptu>`) nor matched, pipes nobody declares, and elements two components match are the `unknownElements`, `unknownPipes` and `ambiguous` that become diagnostics.
- **Reading.** `readComposition()` in `read-composition.ts` drives it for one showcase. A variant is composed when it has a `template` or a host template. Variants with the same markup and the same `unbound` inputs share a case. An input is `unbound` for `'template'` when `ownedInputs` has it, and for `'default'` when its `InputMeta.defaultUnreadable` is set and the variant gives it no value. The `imports` are the library classes the templates matched, the showcase's own entries, and the class of an object host, and they go to the generator. A subject that is not standalone has no composition, with one diagnostic, since the generated wrapper is standalone and can only import a standalone class.

Each problem is reported against the field it comes from, with the showcase's file, line and variant, and leaves that variant out of the composition. It renders as it would without `template` and `host`. A problem is a diagnostic, and so a `strictShowcase` failure, when ng-prism is sure the template cannot compile, such as a syntax error from `parseTemplate` or an unknown element while every import was read. It is a notice when Angular may still accept the template, such as when an import could not be read: an unknown element or pipe is then only a notice too. Every message is under [Build Warnings › Compositions and hosts](api/build-warnings.md#compositions-and-hosts). A string or object `host` on a component is dropped by `scanComponents()` with a notice, as a component ignores it, and a `host` with a `template` that is no string is reported and dropped. `readShowcaseConfig()` checks the types of `template`, `host` and `imports` the way it checks the other fields: a value of the wrong type is reported and dropped, and an entry of `imports` that is not a `{ name, from }` of non-empty strings goes too, as does one, or an object host's `import`, whose `name` is not an identifier: the generated manifest imports it by that name. Where it dropped an entry, the messages of the later ones keep the position the source gives them.

The compiler APIs in use are `parseTemplate`, `CssSelector`, `SelectorMatcher`, `DomElementSchemaRegistry` and the R3 template AST, exported from `@angular/compiler`, a peer dependency of `@ng-prism/core` that the config loader already imports. Only the builder imports them. If one throws, the scan reports one diagnostic for the showcase, leaves all of its compositions out and goes on, so a change in the compiler does not break the build.

## Parts

A showcase with `partOf` is a part of another component or directive (since 22.7.0), and has no page of its own. `readShowcaseConfig()` keeps `partOf` as a trimmed non-empty string, reports anything else, and `scanComponents()` records the `@Showcase` argument of each class that kept it in `ScanComponentsOptions.partOrigins`. A service or a pipe with `partOf` is reported by its own scan (`describePartOfOnServiceOrPipe()`) and loses the field.

`resolveParts()` in `resolve-parts.ts` resolves `partOf` once, at the end of `createScanner().scan()`, after every entry point is scanned and the components are deduplicated: the parent may be exported by another entry point than the part, and a class that two entry points export is one candidate, not two. It matches on `selectorList()`, the `selector` of a component or directive split on the commas outside brackets, parentheses and quotes (an attribute value such as `[data-mode="a,b"]` can hold one) and trimmed, and checks each part in this order:

1. **Itself.** One of its own selectors is the one it names.
2. **Candidates.** The other scanned components whose `selectorList()` contains it. None is "not found"; more than one is "ambiguous", naming the classes in scan order.
3. **Chain.** The one candidate declares `partOf` as well. That is judged on the declaration, not on how the candidate resolved, so a part whose parent could not be resolved is no parent either, and the result does not depend on the order of the scan.

A part that fails one of them is a diagnostic through `report`, so it counts for `strictShowcase` and lands in `ScanResult.diagnostics`. It loses `partOf` and stays a component exactly as the scan read it, with its variants and composition: a part must not vanish over a wrong selector. The messages are under [Build Warnings › Parts](api/build-warnings.md#parts), and what a part looks like in the styleguide under [Parts](guide/parts.md).

A resolved part gets `ScannedComponent.parentClassName`, the public marker that plugins skip by. It keeps `showcaseConfig.partOf`, which only a resolved part still has. Every field of `PART_IGNORED_FIELDS` that it sets (`variants`, `states`, the navigation and canvas fields, `host`, `imports`, `renderPage`) is deleted, each with a notice through `notify`: nothing the styleguide could show is lost, so `strictShowcase` does not fail over the field. `host` counts only as a host template (`isHostTemplate()`). The string or object host of a directive part stays, since the usage line of the jsdoc plugin is written on its element, and `scanComponents()` has already dropped any other host of a component. The list holds only what reaches a component's `showcaseConfig`: `providers` and `setup` never do, and keep the diagnostics every component gets (`describeDeprecatedProviders()`, `describeSetupOnComponent()`). Its `composition` goes too, since the variants that it was read from are gone. Neither step undoes what the scan said before it knew the class was a part: `scanComponents()` reads and composes a part's variants like any other component's, so a malformed value or an error in a variant template stays a diagnostic. An unresolved part must keep its variants and composition, which is why the scan does not skip them. Title, description, tags, status, inputs, outputs, `meta` and `api` stay.

## Services

A service is a class with `@Showcase` and `@Injectable` or `@Service`. `component.scanner.ts` and `service.scanner.ts` split the classified `@Showcase` classes between them by `kind`, so a service is in `ScanResult.services` and never in `components`: the component list, `onComponentScanned` and the discovery manifest hold components and directives only. The code is in `builder/scanner/api/`. `scanServices()` only runs with `ScanOptions.services`; without it the services are only counted (see [Entry](#entry)).

### Telling a service or pipe from a component

`classifyShowcaseClass()` in `api/angular-decorators.ts` returns one of four kinds. It looks at the decorators in this order, `@Component` or `@Directive`, then `@Pipe`, then `@Service` or `@Injectable`, and the first it finds decides, so a class with `@Pipe` and `@Injectable` is a pipe:

| Kind               | When                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component`        | The class has `@Component` or `@Directive` (found by name, as everywhere), or none of `@Pipe`, `@Injectable` and `@Service`                                                                                                              |
| `pipe`             | `@Pipe` from `@angular/core` and none of the component-only fields below, also with `@Injectable`. Whether the pipe can be shown is for `scanPipes()` to decide                                                                          |
| `legacy-component` | `@Pipe`, `@Injectable` or `@Service` and a `@Showcase` argument that declares a field only a component can use: `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports`, `renderPage`. Carries which decorator it was |
| `service`          | `@Injectable` or `@Service`, and none of those fields                                                                                                                                                                                    |

`findAngularCoreDecorator()` finds `Injectable`, `Service` and `Pipe` by the name they have in `@angular/core`, not in the file: through the checker it follows a decorator's identifier to its import specifier and takes the imported name, or follows `ng` in `@ng.Pipe()` to a namespace import (`import * as ng from '@angular/core'`) and takes the member. So `import { Injectable as Service }` makes `@Service` Angular's `Injectable`: the class is a service, and `readProvision()`, which reads the decorator by the same name, takes its `providedIn`. TypeDI and other libraries have a `@Service()` of their own, and it makes no service. The scanner never imports `Service` from `@angular/core`: the decorator is recognised in the source alone, so the builder does not depend on an Angular version that exports it.

The `@Showcase` argument is read from the literal and from the evaluated value, since a constant or a spread can bring in a component-only field and a field the evaluator cannot read is still in the literal. A `legacy-component` is scanned as a component, and `scanComponents()` prints a notice through `notify`, not `report`, so it is not a [diagnostic](#diagnostics) and `strictShowcase` does not fail over it. The notice for a pipe has two wordings, depending on whether the pipe is declared with `standalone: false`, see [Pipes](#pipes). The exception is deprecated since 22.7.0 and ends in 23.0.0.

### Provision

`readProvision()` evaluates the options of the decorator and answers `auto` or `manual`. `@Service()` is `auto` unless it has `autoProvided: false`; `@Injectable` is `auto` for `providedIn` of `'root'`, `'platform'` or `'any'`. A module class, no `providedIn` and a value the evaluator cannot read are `manual`, without a warning. The `factory` of `@Service({ factory })` is a function the evaluator drops, which leaves the provision alone.

### `setup`

`setup.reader.ts` reads `setup: () => [a, b]` from the `@Showcase` object literal. The evaluator cannot fold functions, so `extractShowcaseConfig()` swallows the issue it raises for `setup`, and the reader takes over:

- The value has to be an arrow function whose body is an array literal, as an expression or as the only `return` of a block. Anything else, `as const` included, reports `describeInvalidSetup` and drops the whole field.
- Each element is resolved to its declaration through the checker, with an import followed to its source. A name or a property access qualifies; a call or a spread does not. The declaration has to be a function declaration or a `const` arrow or function expression (kind `function`), or a `const` whose type is `InjectionToken` (kind `token`). Otherwise `describeSetupEntryNotSupported` drops the entry.
- The symbol is looked up in the export index. An entry no scanned entry point exports has no import path for the usage snippet and is dropped with `describeSetupEntryNotExported`.
- Only the literal is searched. A `setup` that arrives through a spread or a constant is not found and dropped without a word.

On a component, `scanComponents()` reports `describeSetupOnComponent` and ignores the field. Its text says that `setup` only applies to services and pipes. On a `legacy-component`, an `@Injectable`, `@Service` or `@Pipe` class that its component-only fields keep a component, it reports `describeSetupOnLegacyComponent` instead, which names those fields as the reason. The messages are under [Build Warnings › Services and pipes](api/build-warnings.md#services-and-pipes).

### The export index

`buildExportIndex()` in `api/export-index.ts` maps every symbol the entry points export, resolved through aliases, to the import path of the first entry point that exports it. It is built from all entry points once per scan, because a setup function or a type is often exported by another entry point than the service. The same index decides which types get a card.

### Members, tags and types

`extractServiceApi()` builds the `ServiceApi` of one service from three modules:

- **`member.extractor.ts`** walks the class and its base classes, nearest first, and collects public instance properties, accessors and methods with their signatures. A member the subclass declares hides the inherited one, including an `@internal` override. Left out: `private`, `protected`, `#private`, `_`-prefixed names, lifecycle hooks, the constructor, statics and `@internal`. The constructor's parameter properties (`public`, `readonly` or `override`, neither `private` nor `protected`) are properties, taken where the constructor stands and described by its `@param`. Methods are listed with or without JSDoc, which differs from the component scan. A getter and its setter are one entry, the doc block on either of them. A method goes through `extractOverloads()`, shared with the pipe scan: every overload signature (a declaration without a body) becomes one `ApiMethod` and the implementation is dropped, without overloads the one declaration is the entry. A signature without a doc block of its own takes the implementation's, then the first documented signature's, then the inherited one of the nearest base class. The implementation's block and a base class's are taken whole, since they document the method; from another signature only the description and the `@param` texts are, since its tags, such as `@deprecated`, are about that signature alone. The methods of an interface in a type card are read the same way. A type is the annotation as written, else `checker.typeToString`.
- **`doc-tags.ts`** reads description and tags. The doc block is the last one above the node and has to sit directly on it, line comments in between allowed; a floating banner and a ruler (`/** ===== */`) are not read. `@default`, `@since`, `@version`, `@deprecated`, `@see`, `@example`, `@param` and `@internal` are understood. An override without a doc block of its own takes the doc block of the nearest base class member that has one.
- **`type-collector.ts`** documents the types the signatures reach. A reference is documented when it resolves to an interface, class, type alias or enum that the export index knows and that is not `@internal`; otherwise it stays text. Each type gets one entry, recursively through the types of its members and type arguments, and a type that refers to itself ends there. Its id is its name, or `name@importPath` when two reachable types share a name, and `reachedFrom` records where it was first met. A type imported under another name is documented under its declared name, and the local name in the text stays unlinked.

`service-api.extractor.ts` adds the setup entries: the signature and docs of a function, the type of a token, and a config table made of the properties of the first parameter's object type, or of a token's type argument, looked at through `Partial`, `Required` and `Readonly`. A class, an array or a primitive gets no table.

The shape of all of this, `ServiceApi` and the `Api*` types, is experimental until 23.0.0, see [`ServiceApi`](api/types.md#serviceapi).

## Pipes

A pipe is a class with `@Showcase` and `@Pipe`. `pipe.scanner.ts` runs like `scanServices()`, only with `ScanOptions.pipes`, and shares its export index, the dedupe across entry points and the `report` and `notify` channels, so a pipe is in `ScanResult.pipes` and never in `components` or `services`. `scanComponents()` and `scanServices()` skip it. The pieces a service already has are reused: `readSetupRefs()` for `setup`, the doc-tag reader, `extractOverloads()` for signatures and the type collector.

`readPipeOptions()` in `api/angular-decorators.ts` reads `name`, `pure` and `standalone` from the `@Pipe` metadata through the static evaluator, and guesses nothing that is not there:

- **`name`** is the template name. A source that does not give it as a string constant leaves it out, and `scanPipes()` reports `describePipeNameUnreadable` and drops the pipe.
- **`standalone`** is only `false` when the metadata says exactly that, since `true` is the default. A pipe with `standalone: false` is reported with `describePipeNotStandalone` and dropped: the usage snippet imports a pipe into a component, which an NgModule pipe does not allow, and finding the module is not attempted.
- **`pure`** is `true` when the metadata does not say. One that cannot be read (a `let`, a call, a spread that fails) is left out of `ScannedPipe`, which removes the Pure / Impure chip and warns about nothing.

The legacy rule is checked first, before anything is said about the pipe itself: a `@Pipe` class with a component-only field, whatever its `standalone` and `name`, is a `legacy-component` and keeps the page it has today. Only the wording of its notice depends on `standalone`.

`pipe-api.extractor.ts` builds the `PipeApi`. The class's own description and tags come from its doc block, and no description is inherited. The signatures of `transform()` come from the nearest class in the chain that declares one. `getClassChain()` in `class-hierarchy.ts` provides that chain, base classes that only exist as a `.d.ts` included: unlike inputs, whose initializers a declaration has lost, signatures and doc blocks are complete there, so `class LocalDatePipe extends DatePipe {}` shows the `transform()` of `DatePipe`. Within that class, `extractOverloads()` lists the signatures as it does for a service's methods (see [Members, tags and types](#members-tags-and-types)): one `ApiMethod` per overload signature, without the implementation, each with the doc fallback described there, the last step being the first documented `transform()` of the nearest base class that has one. No other member is read and none starts the type collector, which begins at the `transform()` signatures and the setup entries.

The shape of `PipeApi` is experimental until 23.0.0, see [`PipeApi`](api/types.md#pipeapi).

## Input and Output Extraction

`extractInputs()` and `extractOutputs()` in `input.extractor.ts` walk the members of the class and of every base class it extends.

### Base classes

`getClassHierarchy()` in `class-hierarchy.ts` follows the `extends` clause through the checker, so a base class in the same file, in another file or in another library behind a path mapping is found the same way, through default exports, renamed re-exports, namespace imports and parentheses as well. It returns the class itself first and then each base class with source, nearest first, and marks which of them Angular takes inputs and outputs from: the class itself and every base class with `@Directive()` or `@Component()`. Angular passes over an undecorated base class, and the extractors skip its inputs and outputs too.

The extractors keep the first input or output they see under a name, which lets a subclass that redeclares an input win over its base class. Static members are skipped, since an input is always an instance field. A field a more derived class initializes without declaring it an input (`override title = 'child'`, or an `input()` in an undecorated class in between) leaves the inherited input in place, as Angular does, but the component starts out with the value of the most derived initializer. That value becomes `defaultValue`, read the same way as a default (`input()` and `model()` contribute the value passed to them); if it cannot be read, the input has no default rather than the base class's.

A generic base class declares some inputs in terms of its type parameters. For an input whose type argument, declared type or default mentions one of them, the type comes from the property as the showcased class sees it: the signal's call signature returns the instantiated value type, `Country[]` where the source says `T[]`, and an `@Input()` property has that type directly. Without a type argument the type of the default counts as well, so `model(this.initial)` with `initial: T` resolves too. `rawType` is then the printed type. Every other input is resolved as for a class without a base: from the source text of its type argument, type alias names included, or from the type of its default.

The hierarchy is computed once per component and passed to both extractors. `scanComponents()` also records the base classes with source on `ScannedComponent.baseClasses` (class name and file, nearest first) for plugins that need to read what a component inherits, such as plugin-jsdoc for the tags of inherited members. The field only exists at build time; the manifest does not carry it.

Two kinds of base class are not read:

- **Declarations.** A base class from an npm package only exists as a `.d.ts`, where `options = input.required<…>()` has turned into `readonly options: InputSignal<…>`. No call is left to read `required` or a default from. The same goes for a `declare class` in a `.ts` file and for a class inside `declare module` or `declare namespace`. If such a class declares inputs, `scanComponents()` prints a notice with their names and the location, see [Inputs from a base class without source](api/build-warnings.md#inputs-from-a-base-class-without-source). The names come from the input map the Angular compiler writes into `ɵdir` or `ɵcmp`, which covers `@Input()` inputs and gives the public name of an aliased one. The compiler writes that field for every decorated class, so a `.d.ts` class without it is undecorated, Angular inherits nothing from it, and there is no warning. A `declare class` written by hand has no such map either, so there the properties whose type resolves to `InputSignal`, `InputSignalWithTransform` or `ModelSignal` stand in for it, import types and aliases included. The walk continues past the class, and each such class up the chain gets its own warning.
- **Mixins.** In `extends withTracking(Base)` the base is a call, and what it returns has no class declaration to read members from. The walk ends there.

These notices, and the one about `@Input()` decorators, which names the base class a decorator comes from, are not [diagnostics](#diagnostics), so `strictShowcase` does not fail the build over a class the component's author cannot change. A `notices` set shared across entry points prints each of them once. What this means for a library author, and the watch gap for a base class outside the watched directory, is under [What the Scanner Reads](guide/scanner-reads.md#base-classes-and-mixins).

### Signal inputs: `input()` and `model()`

Detected by checking whether the property initializer is a call expression whose callee is `input`, `input.required`, `model`, or `model.required`.

- **Required check:** `isSignalInputRequired()` looks for the `.required` property access.
- **Model check:** `isModelInput()` sets `InputMeta.model` on a `model()` or `model.required()` (since 22.7.0). Angular adds a change output `${alias ?? name}Change` for it, which `outputs` does not list; the part cards of the head and `DiscoveryPart.outputs` add it from this flag.
- **Type resolution:** If the call has a type argument (`input<string>()`), `checker.getTypeFromTypeNode()` resolves it. If there is a default value argument (`input('hello')`), `checker.getTypeAtLocation()` infers the type from the argument.

### Decorator inputs: `@Input()`

Detected by `findDecorator(member, 'Input')` on a property declaration. `readInput()` reads the same `InputMeta` as for a signal input:

- **Required:** `true` only for `@Input({ required: true })` with the literal `true` in an object literal.
- **Type:** the property's type through `checker.getTypeAtLocation()`, with the annotation's source text as `rawType` where there is one, or the instantiated type for an input that uses a type parameter of its base class.
- **Default:** the property's initializer, evaluated as an input default.
- **Alias and JSDoc:** as for a signal input, see [Aliases](#aliases).

`extractOutputs()` takes an `@Output()` property the same way, with its name, alias and JSDoc; its payload type is read only for the API, see [API of a Component or Directive](#api-of-a-component-or-directive). Only property declarations are read: a setter input (`@Input() set value(v)`) and the `inputs` and `outputs` arrays of the class decorator are not. `scanComponents()` prints one notice for the first class in the hierarchy that declares an `@Input()`, `uses` or `inherits … from`, through `notify`. What works and what does not, as a library author sees it, is under [Decorator inputs and outputs](guide/inputs-and-controls.md#decorator-inputs-and-outputs).

### Aliases

An input or output declared with an alias keeps its member name as `name` and gets the alias as `alias`. The extractor reads it from the options of `input()`, `input.required()`, `model()`, `model.required()` and `output()` (`{ alias: 'x' }`), and from `@Input('x')`, `@Input({ alias: 'x' })` and `@Output('x')`. The value is evaluated statically, so a string literal or a constant counts; an alias the builder can't evaluate, or one equal to the member name, is left out. Variants and controls keep using `name`; the renderer binds `alias ?? name` with `setInput`, and the directive wrapper binds the alias on the host element.

### Type mapping

`mapType()` converts a `ts.Type` to the `InputMeta.type` enum:

| TypeScript type                     | Normalized `type` | Notes                                |
| ----------------------------------- | ----------------- | ------------------------------------ |
| `string` / string literal           | `'string'`        |                                      |
| `number`                            | `'number'`        |                                      |
| `boolean`                           | `'boolean'`       | Includes `true \| false` union       |
| `'a' \| 'b'` (string literals only) | `'union'`         | `values` array populated             |
| Array types                         | `'array'`         | Detected via `checker.isArrayType()` |
| Object / interface                  | `'object'`        | `ts.TypeFlags.Object`                |
| Everything else                     | `'unknown'`       |                                      |

In a union, `undefined` and `null` are filtered out first: `'a' | 'b' | undefined` is a `'union'`, a union that keeps one member maps as that member, and any other mixed union is `'unknown'`. Which control the Controls panel renders for each `type` is under [Input types and controls](guide/inputs-and-controls.md#input-types-and-controls).

`rawType` is the type as a string, used by the Controls panel's labels and by plugins: the source text of the type argument or the annotation where there is one, otherwise what `checker.typeToString()` prints, without `undefined` and `null` in a union. The API page of the JSDoc plugin shows `api.inputTypes[name].text`, the type as written with its links, and falls back to `rawType` for a component without `api`.

### Directive detection

A class is considered a directive (`isDirective: true`) if it has `@Directive` but not `@Component`.

## API of a Component or Directive

`scanComponents()` runs `extractComponentApi()` (`api/component-api.extractor.ts`) for every component and directive once its inputs and outputs are read, and stores the result as `ScannedComponent.api` (since 22.7.0). It does so only when its `api` option is on, which `createScanner().scan()` passes from `ScanOptions.componentApi`: the build reads the API only for a plugin that sets [`componentApi`](api/ng-prism-plugin.md#componentapi). An extractor that throws leaves the component without `api` and prints a notice, see [Diagnostics](#diagnostics). `InputMeta` only has a normalized type category and a plain string, so this adds what the API page of the JSDoc plugin needs and `inputs` and `outputs` cannot hold. It takes the same export index as `scanServices()` and `scanPipes()`, and the same type collector and member walk. The pieces:

- **Input types.** Each input is found through `findInputDeclaration()`: the member of that name in the nearest class that defines metadata and declares it an input, the one `extractInputs()` reads. Its type is what is written: the type argument of `input<T>()`, `input.required<T>()` or `model<T>()`, or the annotation of an `@Input()`. Without one, the type the checker infers for the value. The result is an `ApiTypeRef`, the text with `links` to the types it names. A type is reached as `type of <public name>`.
- **Inherited inputs of a generic base.** An input whose declared type, or default, names a type parameter of its base class (`model<T>()` in `Field<T>`) has no useful annotation: `T` means nothing on the page of `NumberField extends Field<number>`. For these, and only these (`usesTypeParameters()` decides, as it does for `rawType` above), the type is taken from the property as the showcased class sees it. Only its text is not as written: the checker prints it (`Country[]` where the source says `T[]`). The links still come from the named, exported types the checker finds in it, as for any input without an annotation. Every other inherited input keeps its annotation as written, with its links.
- **Output payloads.** `findOutputDeclaration()` finds the member the same way. The payload is the type argument of `output<T>()` or `new EventEmitter<T>()`, else the one of the annotation (`OutputEmitterRef<T>`, `EventEmitter<T>`, `Observable<T>`), else the first type argument of the member's type, and `unknown` when it has none. An `output()` without a type argument is `void`. A payload is reached as `payload of <public name>`.
- **`model()` change events.** Every `model()` and `model.required()` input adds `{ input, event, type }` to `modelChanges`, where `event` is `${alias ?? name}Change` and `type` the type of the model. `outputs` gets no entry for it: the Events panel and the directive wrapper work from `outputs`, and the change output Angular adds has no class member to read.
- **Methods.** `extractDocumentedMethods()` in `member.extractor.ts` walks the members as `extractServiceApi()` does, hierarchy, exclusions and inherited docs included, and keeps only the methods with a doc block of their own or an inherited one, one entry per overload signature. A component's public methods are often there for its own template only. Properties are not read: `inputs` and `outputs` cover what a template binds.
- **Description and tags.** `readDescription()` and `readDocTags()` read the class's doc block. The description keeps its `{@link}` tags: the plugin's own extractor loses the target of a link, which is why the page takes the description from `api`.
- **Types.** The collector documents what the input types, output payloads and signatures reach, with the rules of a service: exported by any scanned entry point, not `@internal`, ids by name or `name@importPath`, `reachedFrom` saying where a type was first met (`type of variant`, `payload of tabChanged`, `parameter of focus()`). The order of first reach is inputs, outputs, methods.

`InputMeta.doc` and `OutputMeta.doc` are read by `getJsDocComment()` in `ast-utils.ts`, which joins the parts of the comment the way `ts.displayPartsToString` does except for one thing: a `{@link X | text}` keeps the bar between target and text. TypeScript drops it for a target it resolves to a symbol, which would turn `{@link TabItem | the item}` into `{@link TabItemthe item}`, and the page could not tell where the target ends.

Without an export index (`scanComponents()` called on its own) the API has the text of every type but no links and no `types`. The runtime manifest writes `api`, when the component has one, with the other data, and `importPath` as well, so the browser can name the entry point in a usage snippet; `baseClasses` stays out of it. The shape is experimental until 23.0.0, see [`ComponentApi`](api/types.md#componentapi).

## Output

`scanComponents()` returns an array of `ScannedComponent` objects. Each includes:

- `className`, `filePath`
- `showcaseConfig`: the evaluated `@Showcase` argument
- `inputs`, `outputs`: extracted metadata arrays
- `componentMeta`: `{ selector, standalone, isDirective }`
- `importPath`: the import path of the entry point that exports it, set by `createScanner()` for every entry point, the primary one included
- `api`: the extracted `ComponentApi`, see [API of a Component or Directive](#api-of-a-component-or-directive). Missing when the scan was told not to read it or could not
- `composition`: the compositions of the showcase, see [Compositions](#compositions). Missing when no variant has a `template` or a host template, and when a compiler failure left them out

`scanServices()` returns an array of `ScannedService` objects, in `ScanResult.services` (empty without `ScanOptions.services`, which counts them in `ScanResult.unread.services` instead):

- `className`, `filePath`, `importPath`
- `showcaseConfig`: the evaluated `@Showcase` argument, reduced to the fields that apply to services
- `provision`: `'auto'` or `'manual'`
- `api`: the extracted `ServiceApi`

`scanPipes()` returns `ScannedPipe` objects, in `ScanResult.pipes` (empty without `ScanOptions.pipes`, which counts them in `ScanResult.unread.pipes` instead):

- `className`, `filePath`, `importPath`
- `showcaseConfig`: reduced to the same fields as a service's
- `pipeName`, and `pure` when it is known
- `api`: the extracted `PipeApi`
