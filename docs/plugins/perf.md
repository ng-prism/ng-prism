# Perf

`@ng-prism/plugin-perf` measures what a component costs: the size of its file as it ships, its render times in the browser and the heap around it.

## What it does

- Adds a **Performance** tab (id `perf`) to the addons panel below the canvas, with three views: **Bundle**, **Render** and **Memory**.
- **Bundle:** the size of the component file without `@Showcase` and comments, its gzip estimate, the files behind `templateUrl` and `styleUrl`, the direct imports and the depth of the import tree, measured at build time.
- **Render:** the initial render and the re-renders of the component, from the `prism:render` and `prism:rerender` measures the canvas records, while you profile.
- **Memory:** readings of the JavaScript heap with `performance.memory`, in Chromium-based browsers.
- Grades the initial render and the sizes against built-in [budgets](#budgets).

## Install

```bash
ng add @ng-prism/plugin-perf
```

This installs the package and registers `perfPlugin()` in `ng-prism.config.ts`. To install it by hand, see [Installing Plugins](plugins/overview.md#installing-plugins).

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { perfPlugin } from '@ng-prism/plugin-perf';

export default defineConfig({
    plugins: [
        perfPlugin({
            bundle: { maxTreeDepth: 5 }
        })
    ]
});
```

## Options

| Option                  | Type     | Default | Description                                                                                  |
| ----------------------- | -------- | ------- | -------------------------------------------------------------------------------------------- |
| `bundle.maxTreeDepth`   | `number` | `5`     | How deep the relative imports of a component file are followed for **Tree depth**.           |
| `thresholds`            |          |         | _Deprecated since 22.6.0, removed in 23.0.0._ Never had an effect; the budgets are built in. |
| `bundle.excludeImports` |          |         | _Deprecated since 22.6.0, removed in 23.0.0._ Never had an effect.                           |
| `render`                |          |         | _Deprecated since 22.6.0, removed in 23.0.0._ Never had an effect.                           |
| `memory`                |          |         | _Deprecated since 22.6.0, removed in 23.0.0._ Never had an effect.                           |

Nothing has ever read the four deprecated options, nor the `PERF_PLUGIN_CONFIG` token, which is deprecated since 22.6.0 as well and removed in 23.0.0. While one of the options is set, the build prints [a notice](api/build-warnings.md#a-deprecated-perf-option). Remove them.

## Metrics

The tab opens on **Bundle**.

### Bundle

Measures the component's file at build time, the way it ships. ng-prism strips `@Showcase` from the published build ([`ng-prism-strip`](guide/library-publishing.md)) and comments never reach the bundle, so the source size and the gzip estimate leave out the `@Showcase` decorator, JSDoc and every other comment (since 22.7.0). The whole file is reported too, for comparison.

The cards **Source size** and **Gzip estimate** are graded against the [bundle budget](#budgets) and carry an **OK**, **Warning** or **Critical** badge; their tooltips have the exact bytes. **Size breakdown** draws the source and the gzip estimate against the 20 kb budget ("8.4 / 20 kb"), followed by the template, the styles and the whole file as plain quantities.

| Metric         | Description                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Source size    | Bytes of the component file without `@Showcase` and comments, printed by the TypeScript printer                             |
| Gzip estimate  | Gzip size of that source                                                                                                    |
| Direct imports | Number of `import` statements left after stripping; an import that only served `@Showcase` (`@ng-prism/core`) is gone       |
| Import list    | Those imports, the first ten as chips                                                                                       |
| Tree depth     | Maximum depth of the relative import graph, followed down to `bundle.maxTreeDepth`                                          |
| template       | Bytes of the files behind `templateUrl`; an inline `template` is part of the source size                                    |
| styles         | Bytes of the files behind `styleUrl`/`styleUrls`, uncompiled (SCSS as written); inline `styles` are part of the source size |
| file           | Bytes of the whole file, showcase and comments included, for comparison                                                     |

The source is TypeScript, not the compiled output: Angular's AOT compilation turns the decorators and the template into code of its own, and the published bundle is minified. The figures are meant for comparing components with each other, not as the exact bytes in a consumer's bundle. Template and styles are not added to the source size and have no budget. If a file cannot be stripped, the tab falls back to the whole file and says so ("Size breakdown · whole file").

### Render

**Profile** starts recording and **Pause** stops it; **Clear** drops the samples. Its tooltip says whether it records, how many samples it has and how many change-detection runs it saw. While it records, the view shows:

- **Initial render:** the duration of the last `prism:render` measure, the creation of the component. It is graded against the [render budget](#budgets) and carries an **OK**, **Warning** or **Critical** badge.
- **Avg re-render**, **Slowest**, **P95** and **Last render:** the `prism:rerender` measures, one each time the inputs of the rendered instance change, from the Controls panel or on a switch to a variant that reuses it. The last 50 are kept.
- **Render time trace:** the re-renders as a line, with a mark at the 5 ms warning budget, once there are two or more.

The measures are ordinary entries of the browser's Performance timeline, so the browser's performance tools show them as well.

### Memory

Reads the heap with `performance.memory`, which only Chromium-based browsers have; elsewhere the view says **Memory API not available**.

**Snapshot** takes two readings of the heap 50 ms apart and shows them as **Before create** and **After create**, with a bar for each under **Heap comparison**. When the heap grew, **After create** is marked **Watch**, with the growth in its tooltip. **Clear** drops the readings.

The view also has an **After destroy** card and a **Leak analysis**, which reports a possible leak when the heap after destroying the component is 0.5 MB or more above the reading before. Both need a reading after the component is destroyed, which the plugin does not take at the moment, so they stay empty.

### Budgets

The budgets are built in and cannot be changed:

| Figure                     | Warning above | Critical above             |
| -------------------------- | ------------- | -------------------------- |
| Initial render             | 5 ms          | 16 ms, one frame at 60 fps |
| Source size, gzip estimate | 20 kb         | 50 kb                      |

A figure at or below the warning budget is OK. The other figures of the tab are plain quantities without a grade.

## Parts and compositions

- **Parts:** a [part](guide/parts.md) is left out: the build measures no bundle for it, and it has no page of its own. Its parent's variants render it, so the parent's render times include it.
- **Compositions:** for a variant with a [`template` or a host template](guide/compositions.md), the render marks wrap the creation of the whole composition: the frame and every other part in it count, not only the showcased component. Compare such a variant with another composed variant, not with a plain one. The bundle figures still describe the file of the showcased component; the classes that a composition adds, such as a frame or an `imports` entry, are not part of them.

## Troubleshooting

- **No bundle data available:** the build wrote no bundle figures for the component, for example because it is a part, or because the config that ran the build had no `perfPlugin()`.
- **No profiling data yet:** nothing was recorded. Click **Profile**, then change an input or switch variants.
- **Memory API not available:** the browser has no `performance.memory`. Open the styleguide in a Chromium-based browser.
- **The build prints a notice about a `perfPlugin()` option:** see [A deprecated Perf option](api/build-warnings.md#a-deprecated-perf-option).

## Related

- [Publishing Libraries](guide/library-publishing.md): `ng-prism-strip`, which the bundle figures follow
- [Compositions](guide/compositions.md#what-the-canvas-shows): what a composed variant renders
- [Installing Plugins](plugins/overview.md#installing-plugins)
