# Build Pipeline

The ng-prism build pipeline transforms library source files into a TypeScript `prism-manifest.ts` file that the styleguide app imports at bootstrap. Everything runs inside the Angular builder process (Node.js). The builders that run it, their options and their watcher are under [Builders](api/builders.md), every message it prints under [Build Warnings](api/build-warnings.md).

## Pipeline Steps

`runPrismPipeline()` in `src/builder/shared/prism-pipeline.ts` executes these steps in order:

```
Config load
    ↓
Entry point scan  (TypeScript Compiler API; reads what the plugins use; strictShowcase stops here)
    ↓
Services and pipes gate  (keep each kind only if a panel shows it)
    ↓
Config pages
    ↓
Plugin hooks  (onComponentScanned, onServiceScanned, onPipeScanned, onPageScanned, onManifestReady), then the a11y report
    ↓
Runtime manifest generation  (TypeScript source string, with the wrappers)
    ↓
Write in place  (skip if unchanged)
```

### 1. Config Load

`loadConfig()` uses `ts.transpileModule()` to compile `ng-prism.config.ts` to a temporary `.mjs` file next to the config (`ng-prism.config.<timestamp>-<random>.tmp.mjs`), imports it via `import(pathToFileURL(...))`, and deletes the temp file afterwards, also when the import fails. Because the file sits next to the config, the config's imports resolve from the config's own directory. This avoids spawning a separate `tsc` process and works with TypeScript config syntax. A config file that does not exist is an empty config, one outside the workspace an error. Right after loading, `describeDeprecatedOptions()` checks the config and its plugins for options that are deprecated, and the pipeline prints one `⚠ ng-prism:` notice for each, see [Build Warnings](api/build-warnings.md#config).

### 2. Entry Point Scan

`scanEntryPoints()` resolves the library root and then dispatches to `discoverSecondaryEntryPoints()`:

- **Directory:** used as the library root directly; its `ng-package.json` names the primary entry file (`findPrimaryEntryFile()`)
- **File:** `findLibraryRoot()` walks upward to the nearest `ng-package.json` and uses that directory as the library root. The file itself is the primary entry file. Without an `ng-package.json` above it, it is the only entry point (back-compat for non-ng-packagr setups).

The scan returns the components, the services, the pipes and the diagnostics of one run. A `@Showcase` class with `@Injectable` or `@Service` is a service and one with `@Pipe` is a pipe: each goes into its own list, never into `components`, see [Services](architecture/scanner.md#services) and [Pipes](architecture/scanner.md#pipes).

The scan also reads the [compositions](architecture/scanner.md#compositions) of every showcase that has a `template` or a host template, against an index of every component, directive and pipe the entry points export, which it builds only when a showcase composes. What it finds wrong is a diagnostic, and the variant is then left out of the composition, so a template error does not stop the build, unless [`strictShowcase`](api/ng-prism-config.md#strictshowcase) is on.

Once every entry point is scanned, it resolves each [`partOf`](architecture/scanner.md#parts) to its parent. A part that cannot be resolved is a diagnostic and stays a component of its own.

When [`strictShowcase`](api/ng-prism-config.md#strictshowcase) is on and the scan returned any diagnostic, the pipeline throws right after the scan, before the plugin hooks and before a manifest is written, see [Build Warnings](api/build-warnings.md#strictshowcase-stopped-the-build).

Before scanning, the pipeline looks at the plugins of the loaded config and passes the scan [`ScanOptions`](architecture/scanner.md#entry) for what they use. Reading more costs time on every rebuild of `serve` and makes the manifest bigger:

- **`componentApi`** when some plugin sets [`componentApi`](api/ng-prism-plugin.md#componentapi) (`jsDocPlugin()` does). Without one the components come without `ScannedComponent.api`, and the manifest carries none.
- **`services`** and **`pipes`** when some plugin has a view panel that applies to them, see the next step. Without one the scan only counts that kind: no API, no `setup`, no `@Pipe` metadata is read, so none of their warnings or diagnostics appear and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) cannot fail over them.

Discovery returns one entry per `ng-package.json` (excluding the primary `dest`-rooted one), and the primary entry point is appended last, marked `primary`. A component the primary re-exports from a secondary entry point keeps the secondary's import path. When the list stays empty, the pipeline warns that `entryPoint` resolves to no entry file, see [Build Warnings](api/build-warnings.md#no-entry-file). All entry points are fed into a single `Scanner` instance that is cached on `PrismPipelineState.scanner`. The import path attached to each scanned component (`my-lib`, `my-lib/atoms`, ...) is derived from the entry-point's relative directory.

On rebuild, the same `Scanner` instance is reused. It passes the previous `ts.Program` to `ts.createProgram()` as `oldProgram`, together with a compiler host that returns the already parsed `SourceFile` of every unchanged file, so only changed files are re-parsed (see [How the Scanner Works](architecture/scanner.md#incremental-builds-the-createscanner-factory)). See [PrismPipelineState](#prismpipelinestate-scanner-reuse-across-rebuilds) below for how the cached scanner is invalidated when the entry-point set itself changes.

### 3. Services and Pipes Gate

A service page is made by a plugin's view panel that applies to services (`placement: 'view'` and `PanelDefinition.appliesTo` includes `'service'`, which `jsDocPlugin()` declares since 22.7.0). An addon panel does not count: a service page has no addon area. The pipeline reads that from the panels of the loaded config, whose Node side carries them along, before the scan:

- **Some plugin has one:** the scan reads the services, and they go on, into the plugin hooks and the manifest.
- **None has:** nothing could show the services, so the scan only counts them (`ScanResult.unread.services`). The manifest gets no `services`, no `onServiceScanned` runs, and the pipeline logs one hint instead, through the builder logger and without the `⚠`, see [No plugin shows services](api/build-warnings.md#no-plugin-shows-services).

The hint names the plugin version because only `@ng-prism/plugin-jsdoc` 22.7.0 or newer has such a panel, so a config with `jsDocPlugin()` can still get it. The hint is not a diagnostic, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) does not fail over it. It is logged once per builder run: `PrismPipelineState.hints` remembers it, so `serve` does not repeat it on every rebuild. `PrismPipelineResult.serviceCount` is the number of services in the manifest, `0` when they were only counted however many the scan found.

Pipes go through the same gate, decided on their own: it keeps the pipes when some plugin has a view panel whose `appliesTo` includes `'pipe'` (`jsDocPlugin()` declares it since 22.7.0), and a panel for services alone does not count for them. When none has one, the scan only counts the pipes, the manifest gets no `pipes`, no `onPipeScanned` runs, and the pipeline logs the hint for pipes through the same logger, also without the `⚠`, see [No plugin shows pipes](api/build-warnings.md#no-plugin-shows-pipes).

The reasoning, the fact that the hint is no diagnostic and that it is logged once per builder run, are the same as for services. `PrismPipelineResult.pipeCount` is the number of pipes in the manifest, `0` when they were only counted.

### 4. Config Pages

The scan finds no pages: the page list is a copy of [`config.pages`](api/ng-prism-config.md#pages), and it goes through `onPageScanned` like any other item. The generator writes it into the manifest as JSON, so only a `CustomPage` survives there. A `ComponentPage` holds a component class, which does not survive `JSON.stringify`; `main.ts` registers it with `providePrism(manifest, config, { componentPages })`, which appends it to the manifest's pages in the browser.

### 5. Plugin Hooks

`runPluginHooks()` iterates over registered plugins in registration order:

1. `onComponentScanned` called once per component, every [part](architecture/scanner.md#parts) included
2. `onServiceScanned` called once per service
3. `onPipeScanned` called once per pipe
4. `onPageScanned` called once per page
5. `onManifestReady` called once with the full `PrismManifest`

All hooks are awaited, so async plugins are fully supported.

**Parts are nested between 4 and 5.** The per-item hooks see a part as a component of its own, so a plugin that reads each component, such as the JSDoc plugin, reads a part exactly like one. Before `onManifestReady`, `nestParts()` moves every part onto its parent: the parent becomes a new object with [`ScannedComponent.parts`](api/types.md#scannedcomponent), sorted by `showcaseConfig.title`, and the part leaves `manifest.components`. The parent is the one the scan resolved: `nestParts()` gets the list from before the hooks next to the one they returned, and since the per-item hooks keep the order and the number of the components, it pairs them by position. A hook that rewrites a parent, its selector or class name included, therefore keeps its parts on it, and a part never falls back to a component of its own after the hooks. The manifest the hook receives therefore has the shape of the runtime manifest, see [Plugin Hooks](architecture/plugin-hooks.md#parts-in-the-hooks).

The nesting also decides what the pipeline counts: the `Generated manifest with N component(s)` message and `PrismPipelineResult.componentCount` count the entries of `manifest.components`, so parents, not parts. The [a11y](api/ng-prism-config.md#a11y) merge runs over the same list, so a part gets no a11y entry of its own: the variants of its parent render it, and the checks run there.

**The a11y report comes after the hooks.** When the file at `a11y.reportPath` has a `total`, the pipeline checks it against the gate (`a11y.gate`, or `a11y.thresholds` while `gate` is not set, nothing for `gate: false`). A total that breaks it is an error for `build` and a warning for `serve`, which passes `a11yGate: 'warn'`, see [Build Warnings](api/build-warnings.md#the-a11y-gate-failed). Then it adds each component's entry (`found`, `score`, `summary`) to its `showcaseConfig.meta.a11y`, next to the component's own keys, and the total with the resolved thresholds to `manifest.meta.a11y`. The hooks never see these entries. Without a report, nothing is added and nothing is checked. The report's shape is under [A11y Reports](guide/a11y-reports.md#report-schema).

### 6. Runtime Manifest Generation

`generateRuntimeManifest()` converts the `PrismManifest` (plain JSON-safe data) into a TypeScript source string that the styleguide app can import. The generated file contains real `import` statements:

```typescript
// ng-prism-cache/<prism-project>/prism-manifest.ts (generated)
import type { RuntimeManifest } from '@ng-prism/core/plugin';
import { ButtonComponent } from "my-lib";
import { CardComponent } from "my-lib/molecules";

export const PRISM_RUNTIME_MANIFEST: RuntimeManifest = {
  components: [
    { type: ButtonComponent, meta: { className: 'ButtonComponent', ... } },
    { type: CardComponent, meta: { className: 'CardComponent', ... } },
  ],
};
```

This avoids JSON serialization of Angular class references and keeps tree-shaking intact. The manifest is a named export, `PRISM_RUNTIME_MANIFEST`, which `main.ts` passes to `providePrism()`.

**Wrappers.** Two kinds of showcase need a class that the library does not have, so the manifest declares one next to the imports. Both are standalone components that Angular compiles with the Prism app, ahead of time, which is why their templates are real Angular templates and not strings parsed in the browser.

- **`<Class>__PrismHost`** for every directive that has a variant without a composition. It renders the directive on the element of its host, or of its selector when it has no host: `<tag attrs dirAttr [inputs] (outputs)>{{ __prismContent__() }}</tag>`, and a void element as `<input … />` without content. Its outputs are `output<any>()`, as in the composition wrapper: the template passes on the directive's payload, whose type the manifest does not import. The class is the `type` of the directive's entry.
- **`<Class>__PrismComposition`** for a showcase with at least one composed variant, a `template` or a host template. There is one per showcase, with a `@switch` over its distinct compositions. It declares the inputs and outputs of the subject under their member names, so the renderer binds them like those of a directive, plus `__prismVariant__`, the index of the variant, which a `computed` maps onto a case. Variants with the same markup share a case. The entry carries the wrapper as `composition`, and the renderer creates it for a composed variant and `type` for any other. When every variant is composed, `type` is the wrapper as well.

```typescript
// FormFieldComponent · projects/my-lib/src/lib/form-field/form-field.component.ts
@Component({
    standalone: true,
    imports: [FormFieldComponent, InputDirective, IconComponent],
    host: { style: 'display: block' },
    template: `@switch (__prismCase__()) {
        @case (0) {
            <!-- variants[0] "Default" (projects/my-lib/src/lib/form-field/form-field.component.ts:45:9) -->
            <lib-form-field data-prism-subject [label]="this.label()" [hint]="this.hint()"><input libInput type="email" /></lib-form-field>
        }
        @case (1) {
            <!-- variants[3] "With icon" (projects/my-lib/src/lib/form-field/form-field.component.ts:48:9) -->
            <lib-form-field data-prism-subject [label]="this.label()" [hint]="this.hint()"><lib-icon libPrefix name="search" /><input libInput /></lib-form-field>
        }
    }`
})
class FormFieldComponent__PrismComposition {
    label = input<any>('');
    hint = input<any>('');
    __prismVariant__ = input(0);
    protected __prismCase__ = computed(() => [0, 1][this.__prismVariant__()]);
}
```

What the generator does with a composition:

- The subject element carries `data-prism-subject`, every input is bound as `[alias]="this.member()"` and every output as `(alias)="this.member.emit($event)"`. The members are read with `this.`, so that a variable the author's markup declares, such as `@for (label of …)`, cannot shadow a binding. An input the template sets on the subject, and one whose default could not be read and that the variant does not set, is not bound in that case.
- Inputs are `input<any>(default)`, so that `strictTemplates` accepts any value, arrays and objects included, and `input.required<any>()` for a required one. The wrapper is declared once per showcase, so an input that no case binds is not declared at all.
- The classes the templates use are imported from the entry point the scan found them in, from the showcase's `imports`, or from the module of a directive's object host. Two classes of one name from different modules are told apart with an alias, `Name__2`.
- The host element of the wrapper is `display: block`. The wrapper of a directive without a composition, `__PrismHost`, stays inline.
- Every template goes into the generated file as a template literal with backslash, backtick and `${` escaped, so that no template can break the file.
- Errors point back to the showcase. A TypeScript comment above each wrapper names the showcase file, and an HTML comment before each `@case` names the variants and the position in the source (`--` in a variant name becomes two Unicode hyphens, since `-->` would end the comment). What Angular still finds in the generated file, such as a binding to an input the subject does not have, is reported at a line in `prism-manifest.ts` right under such a comment, see [Build Warnings](api/build-warnings.md#an-angular-error-in-the-generated-manifest). Angular drops the comments from the compiled template, so they cost nothing at runtime.

The manifest also carries the data a composition needs in the browser: `meta.composition` has `variantCases` and each case's `template` (the markup as written, for the code snippet) and `unbound` list, and the `imports` of the wrapper, which a plugin's usage example names. It does not have the `origin` of a case, which only the comments of the generated code use.

Services are written as data, in a `services` list next to `components`, and the service class is **not imported**. A service page is documentation, so an import would only add bundle size and possible side effects:

```typescript
export const PRISM_RUNTIME_MANIFEST: RuntimeManifest = {
    components: [/* ... */],
    services: [{ meta: { className: 'NotificationService', provision: 'auto', api: {/* ... */} } }]
};
```

Pipes are written the same way, in a `pipes` list, with the `meta` of each pipe and no import of its class. A list is only written when there is something in it: a library without services or pipes gets neither list.

Parts (since `22.7.0`) are written the same way, in a `parts` list on the entry of their parent, right after its `meta`. Each is `{ meta }`, the part as `formatMeta()` writes any component, and has no `type`:

```typescript
export const PRISM_RUNTIME_MANIFEST: RuntimeManifest = {
    components: [
        {
            type: SelectComponent,
            meta: { className: 'SelectComponent', ... },
            parts: [{ meta: { className: 'OptionComponent', ... } }]
        }
    ]
};
```

The styleguide renders a part through the variants of its parent, so the manifest does not import its class. The one exception is a class that a composition of the parent names in its `imports`: it is imported for the wrapper, like any class a template uses. `meta` does not carry `parts` itself, since the list is the entry's own. A component without parts gets no `parts` line, so the manifest of a library without `partOf` has none.

### 7. Write in Place (Skip If Unchanged)

`writeManifestIfChanged()` reads the existing manifest and compares it string-for-string with the new content. If identical, the write is skipped and `result.written` is `false`.

When the file must be written, it is overwritten in place: truncated and written again, with the same inode. A temporary file that is renamed over the manifest would create a new inode every time, and Vite's watcher loses a file that lives in a cache directory outside the project's source root, so a change to a `@Showcase` would stop triggering HMR. The manifest is a few kilobytes, so a bundler that sees a partial write is unlikely.

### Manifest Output Location

The generated `prism-manifest.ts` is written to `<workspaceRoot>/ng-prism-cache/<prism-project>/prism-manifest.ts`. It is a build artifact only: `main.ts` imports it through a wildcard path mapping, with the prism project name in the import specifier (`from 'prism-manifest/<prism-project>'`), and the config through a second one (`from 'ng-prism.config'`). `ng add` adds both to the root `tsconfig.json`, or `tsconfig.base.json` in an Nx workspace:

```jsonc
{
    "compilerOptions": {
        "paths": {
            "ng-prism.config": ["./ng-prism.config.ts"],
            "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
        }
    }
}
```

The `./` matters: without a `baseUrl`, TypeScript rejects a path in `paths` that does not start with `./` or `../` (TS5090). The `tsconfig.app.json` of the styleguide app includes `ng-prism-cache/<prism-project>/**/*.ts` as well. The file stays out of the source tree, needs no per-project `.gitignore` entry (`ng add` adds one workspace-wide `ng-prism-cache/`), and multi-project workspaces resolve without collisions. The builder option [`cacheDir`](api/builders.md#cachedir) moves the cache root, for CI sandboxes or unusual setups; the `prism-manifest/*` mapping has to follow it.

## PrismPipelineState: Scanner Reuse Across Rebuilds

```typescript
export interface PrismPipelineState {
    scanner: Scanner | undefined;
    lastEntrySetKey: string | undefined;
    hints: Set<string>;
}
```

The builder creates one `PrismPipelineState` per builder run (not per file change). It is passed into every `runPrismPipeline()` call and caches three things:

- **`scanner`:** a single `Scanner` instance that owns the underlying `ts.Program`. When it is reused across rebuilds, the previous program is passed in as `oldProgram` and the scanner's source-file cache hands TypeScript every unchanged `SourceFile`, so only changed files are re-parsed.
- **`lastEntrySetKey`:** the sorted-and-joined list of entry-file paths from the previous run. It acts as a fingerprint of the entry-point set.
- **`hints`:** the hints already logged, such as the one about services no plugin shows, so that each appears once per builder run.

Before each scan the pipeline computes a fresh entry-set key. If it differs from `lastEntrySetKey` (for example because a new secondary entry point was added or removed), the cached `scanner` is discarded (`state.scanner = undefined`) so the next call constructs a fresh one with the new entry set. Otherwise the existing scanner is reused, preserving its incremental-compilation state for fast rebuilds.

## Serve Builder

The serve builder orchestrates the full dev experience. Its options and what it watches are under [Builders](api/builders.md#serve).

1. Creates `PrismPipelineState`
2. Runs `runPrismPipeline()` once before starting the Angular dev server, with `a11yGate: 'warn'`, so that a report that breaks the gate logs a warning instead of stopping the server. An error here rejects the builder, and the dev server never starts
3. Starts a chokidar file watcher via `startWatcher()` on the entry point's directory, the config file and the a11y report the run read; after every rebuild `setFiles()` points it at the report the new run read
4. Calls `context.scheduleTarget()` to delegate to the `serve` target of the prism project, with the builder's `port`
5. **Subscribes to `run.output`** (Observable), not `run.result` (Promise). `run.result` resolves on the first output event, which is long before the server stops. The builder must stay alive until `run.output` completes.

### Watch Mode with chokidar

`startWatcher()` uses chokidar (not `fs.watch`) because `fs.watch({ recursive: true })` does not fire events reliably on macOS.

`createChangeHandler()` wraps the rebuild callback with:

- **50 ms debounce:** rapid saves (e.g. auto-format on save) trigger only one rebuild. The serve builder passes `debounceMs: 50`, and the handler's own default, which a caller that passes nothing gets, is 300 ms
- **`isRebuilding` guard:** prevents overlapping rebuild runs. A change that arrives during a rebuild runs one more afterwards
- **Extension filter:** only `.ts` changes trigger rebuilds, and a change to one of the single files the watcher was given, the a11y report. Style and template files are the Angular dev server's business and do not set off a scan

A rebuild that throws is caught and logged (`ng-prism: Re-scan failed: …`), and since the pipeline throws before it writes, the previous manifest stays in place. After a successful rebuild, if the manifest content changed, the Angular dev server picks up the file write, rebuilds the app and, with `liveReload`, reloads the page. The `main.ts` that `ng add` generates also accepts the manifest module through `import.meta.hot` and would hand a new manifest to `enablePrismHmr()` (`src/app/hmr.ts`), which swaps it in `PrismManifestService` without a reload. That path needs a module update for the manifest, and Angular 22's dev server sends one only when every changed file is a stylesheet (`@angular/build`, `dev-server/vite/hmr.js`, `handleUpdate`), otherwise a full reload, so it does not run there.

A showcase is a `.ts` file, so a change to one is a rescan like any other, and so is a change to a library class: a new selector is picked up by the compositions that use it. What this means for a user, edit by edit, is under [Builders › Watching and reloading](api/builders.md#watching-and-reloading).

## Build Builder

The build builder runs a single `runPrismPipeline()` call, then delegates to `context.scheduleTarget()` for the `build` target of the prism project in its default configuration, with `{ outputPath: { base, browser: '' } }` when the builder has an `outputPath`. It awaits `run.result` (Promise) since it only needs the final outcome. The pipeline runs with the default `a11yGate: 'fail'`, so a report that breaks the gate fails the build. Its options are under [Builders](api/builders.md#build).
