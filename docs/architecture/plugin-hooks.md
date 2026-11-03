# Plugin Hooks

The build-time hooks of a plugin are the extension points of the build pipeline. They run inside the Angular builder, in Node.js, between the scan and the writing of the manifest, on every build and on every rescan of `serve`. Plugins use them to read data from the source of a component (the JSDoc plugin reads its comments), to read a report from disk (coverage, visual regression), or to add figures for the whole library to `manifest.meta`.

This page explains how the hooks run and what runs where. The signature of each hook is in [NgPrismPlugin](api/ng-prism-plugin.md), a plugin built step by step in [Writing a Plugin](plugins/writing-plugins.md), and the place of the hooks in the pipeline in [Build Pipeline](architecture/pipeline.md#_5-plugin-hooks).

## Hook Execution Order

For each pipeline run, hooks execute in this sequence:

```
For each component and directive (in scan order), parts included:
  → plugin[0].onComponentScanned(component)
  → plugin[1].onComponentScanned(component)
  → ...

For each service (in scan order, only when a plugin shows services):
  → plugin[0].onServiceScanned(service)
  → plugin[1].onServiceScanned(service)
  → ...

For each pipe (in scan order, only when a plugin shows pipes):
  → plugin[0].onPipeScanned(pipe)
  → plugin[1].onPipeScanned(pipe)
  → ...

For each entry of config.pages (in config order):
  → plugin[0].onPageScanned(page)
  → plugin[1].onPageScanned(page)
  → ...

Then every part moves onto its parent (no hook runs, see "Parts in the Hooks" below).

Once, with the full manifest:
  → plugin[0].onManifestReady(manifest)
  → plugin[1].onManifestReady(manifest)
  → ...
```

Plugins run in the order of [`plugins`](api/ng-prism-config.md#plugins), and each item goes through all of them before the next item starts. The hooks chain: the output of one plugin is the input of the next. A hook that returns nothing keeps the object it received, changed in place or not; a hook that returns an object replaces it for the next plugin. `onManifestReady` receives the manifest built from what the per-item hooks returned.

```typescript
async onComponentScanned(component) {
    if (component.parentClassName) return; // a part: the next plugin gets it unchanged

    const data = await readMyData(component.filePath);

    return {
        ...component,
        showcaseConfig: { ...component.showcaseConfig, meta: { ...component.showcaseConfig.meta, myPlugin: data } }
    };
}
```

`onPageScanned` only receives the entries of [`pages`](api/ng-prism-config.md#pages) in the config: the scan finds no pages, and a component page registered with `providePrism(…, { componentPages })` is added in the browser, after the build, see [Config Pages](architecture/pipeline.md#_4-config-pages).

## Async Hooks

All five hooks may return a `Promise`. The runner awaits each hook before it calls the next one: the pipeline is sequential and does not run the hook calls of a phase in parallel. A slow hook therefore delays every rebuild of `serve`, once for each component it runs on. Keep async hooks light, and cache what does not change between rebuilds, as the visual regression plugin keeps its parsed report until the file changes.

## Error Handling

A hook that throws stops the pipeline. The runner wraps the error with the plugin, the hook and the item, keeps the original stack under `Caused by:`, and rethrows it as `ng-prism: plugin "<name>" failed in <hook> for <target>: <cause>`, where `<target>` is `component "<ClassName>"`, `service "<ClassName>"`, `pipe "<ClassName>"`, `page "<title>"` or `manifest`, see [A plugin hook failed](api/build-warnings.md#a-plugin-hook-failed).

- `build` fails before the Angular build starts.
- `serve` fails on its first run before the dev server starts.
- During a rescan of `serve`, the watcher logs [`ng-prism: Re-scan failed: <message>`](api/build-warnings.md#a-re-scan-failed), and the dev server keeps the previous manifest.

## Services and Pipes

A service and a pipe each have a hook and a list of their own in the manifest (since 22.7.0), rather than being a second kind of component. A service has no inputs, outputs, selector or canvas, and the four official plugins that implement `onComponentScanned` (coverage, jsdoc, perf and visual regression) read exactly those. A pipe is not a service either: it has a template name, a purity and `transform()` signatures instead of members and a provision. The separate lists and hooks keep both away from `onComponentScanned` and from each other, so none of those plugins is ever called with one. The JSDoc plugin needs neither hook: its service and pipe pages read `api` in the browser.

The two hooks may not run at all. Services are only read and put into the manifest when some plugin has a view panel whose `appliesTo` includes `'service'`, and pipes, decided apart, when one includes `'pipe'`. Otherwise the scan only counts them, and neither their hook nor `onManifestReady` sees them. The decision is described under [Services and Pipes Gate](architecture/pipeline.md#_3-services-and-pipes-gate).

Navigation decorations are never called for a service or a pipe: `badge()` takes a component.

## Parts in the Hooks

`onComponentScanned` runs on every [part](guide/parts.md) before anything is nested, so the components it sees are the flat list the scan produced. A resolved part has `parentClassName`, the class name of its parent, and otherwise goes through the hook like any component: the JSDoc plugin gives it the same `meta.jsdoc` as a component, so the API block of a part is as full as the page of its parent. A plugin that works per page, such as perf and visual regression, skips a component with `parentClassName`, since the styleguide shows a part on the page of its parent and there is nothing of its own to build, measure or photograph.

`onManifestReady` gets the manifest after the pipeline has nested the parts (see [Build Pipeline](architecture/pipeline.md#_5-plugin-hooks)):

- A part is **not** in `manifest.components`. Its parent has it in `ScannedComponent.parts`, sorted by `showcaseConfig.title`, so the build-time and the runtime manifest have the same shape (`RuntimeComponent.parts`, see [`RuntimePart`](api/types.md#runtimepart)).
- A part has no entry of its own in `onManifestReady`, so a plugin that counts or walks `manifest.components` sees parents only. One that must include parts reads `component.parts` as well, for example `manifest.components.flatMap((c) => c.parts ?? [])`.
- A parent and its parts are one unit: a filter that drops a component from `manifest.components` drops its parts with it.
- A part is the object `onComponentScanned` returned, `parentClassName` and `showcaseConfig.partOf` included. Which parent it goes to is what the scan resolved, before any hook ran: a hook that rewrites a parent, its selector or class name included, keeps its parts on it, and a part never falls back to a component of its own after the hooks.
- `parts` and `parentClassName` are experimental until 23.0.0: their shape may change in a 22.x minor release.

## Node and Browser

A plugin is loaded twice. The builder transpiles `ng-prism.config.ts` and imports it in Node.js, with every plugin it imports. The styleguide app imports the same file in its `main.ts` and hands it to `providePrism()`, so the plugins are bundled for the browser as well, through the `browser` export condition when a plugin has one.

The build uses these parts of a plugin, from its Node entry:

- `name`, for the warning about a plugin registered twice and in error messages
- the five hooks
- `componentApi`, to decide whether the scan reads the API of the components
- `placement` and `appliesTo` of every panel, for the [services and pipes gate](architecture/pipeline.md#_3-services-and-pipes-gate)
- `wrapComponent` and the `position` of a panel, only to print their deprecation notices

It never calls `loadComponent` and never reads `controls`, `headerWidgets` or `navigationDecorations`. The factory runs in Node.js all the same, so the whole plugin object, the `panels` array included, is built there, and every module a plugin file imports statically is loaded in Node.js too.

The styleguide uses the panels, controls, header widgets and navigation decorations, from the browser entry, and calls `isVisible`, `badge` and `matchType` during change detection. No hook ever runs in the browser.

A hook, in turn, has no browser: no `window`, `document` or `navigator`, nothing from `@angular/platform-browser`, the CDK or any other package that needs one, and no page to render a component in. A plugin with Node.js-only code therefore ships a Node entry and a browser entry, which declare the same panels, see [Node and browser entry points](plugins/writing-plugins.md#node-and-browser-entry-points).

## Navigation Decorations

`NgPrismPlugin.navigationDecorations` lets a plugin mark the sidebar entry of a component with a small icon. The a11y source of the core and the coverage and visual regression plugins use it to flag a component whose latest report needs attention. It is a runtime contribution, since its `badge()` callback runs in the browser, but the verdict it shows has to be decided at build time, in a hook. This section explains why.

### The two-zone principle

Every navigation item of a component has two places a marker can live:

- **The leading icon** carries _lifecycle_: what the author declared with `@Showcase({ status })`. It uses shape only: `box` for a normal component, `circle-dashed` for `'wip'`, a struck-through name for `'deprecated'`. Never colour.
- **The trailing slot** carries _health_: what a report measured. It uses colour only: `warn` (amber) or `danger` (red), via `NavigationDecoration.variant`.

A lifecycle marker in the trailing slot, such as a coloured dot for work in progress, would take the position and colour a health signal uses: a reader could not tell "the author isn't done with this yet" from "the last audit found a problem". With lifecycle in the leading slot as shape and health in the trailing slot as colour, colour in the sidebar only ever means measured quality.

### Why the threshold decision has to happen in a hook

A `NavigationDecorationDefinition.badge()` callback receives one `RuntimeComponent` and nothing else: no injected services, no access to the plugin's configured thresholds, no view of any other component in the library. That is enough to read a verdict but not to decide one: it cannot tell whether 72% coverage is fine or a regression, because "fine" is a library-wide threshold the callback never sees.

That decision is made once, in `onComponentScanned`, which has everything it needs (the plugin's resolved thresholds, closed over from its options, and the raw numbers of the one component) and only runs at build time, in Node.js, never on every change-detection tick. The hook writes its verdict into `component.showcaseConfig.meta` as an already decided `{ variant, label }` pair, by convention under a `summary` field, and `badge()` only reads that field back.

The verdict the coverage and visual regression plugins store has three values (`'ok' | 'warn' | 'danger'`, in their `CoverageSummary` and `VrtStat` types), because their hooks need a way to say "healthy". The `NavigationDecoration` that `badge()` returns has two (`'warn' | 'danger'`): `badge()` returns `null` for `ok` instead of passing it through, so a healthy component has no marker. A plugin can also store no verdict for a healthy component, as the example in Writing a Plugin does.

The three sources of the styleguide follow this split. For a11y the build itself writes the `summary`, from the [a11y report](guide/a11y-reports.md#what-the-build-adds) after the hooks; the sources of the coverage and visual regression plugins show the chain from `onComponentScanned` through `summary` to `badge()`. A complete example is under [Decorate the navigation](plugins/writing-plugins.md#decorate-the-navigation), the fields and the reserved `order` values under [`NavigationDecorationDefinition`](api/ng-prism-plugin.md#navigationdecorationdefinition).
