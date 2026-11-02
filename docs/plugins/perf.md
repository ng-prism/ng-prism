# Perf

`@ng-prism/plugin-perf` profiles the render and re-render performance of your components using the browser's Performance API and reports timing metrics per variant.

## What It Does

- Adds a **Performance** panel to the view toolbar
- Tracks `prism:render` marks (initial render) and `prism:rerender` marks (subsequent renders after input changes)
- Displays render duration, re-render duration, and frame budget usage
- Analyzes the shipped size of the component file (without `@Showcase` and comments), its template and styles, import tree depth, and dependency count
- Tracks memory allocation per render cycle

## Install

```bash
ng add @ng-prism/plugin-perf
```

This installs the package and registers `perfPlugin()` in your `ng-prism.config.ts` automatically. To install manually: `npm install @ng-prism/plugin-perf`.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
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

### `bundle.maxTreeDepth`

How deep the import tree of a component is followed for the bundle estimate. Default: `5`.

### Deprecated: `thresholds`, `bundle.excludeImports`, `render`, `memory`

> **Deprecated since 22.6.0, removed in 23.0.0.** These options have been on `PerfPluginOptions` since the first release, but nothing has ever read them, so setting them never had an effect; the same goes for the `PERF_PLUGIN_CONFIG` token. While one is set, the build prints `⚠ ng-prism: perfPlugin() option "<option>" is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.` Remove them.

The panel colours its values against these built-in thresholds:

| Threshold      | Value | Meaning                                                  |
| -------------- | ----- | -------------------------------------------------------- |
| `renderWarnMs` | `5`   | Render time warning threshold (ms)                       |
| `renderCritMs` | `16`  | Render time critical threshold (ms), one frame at 60 fps |
| `bundleWarnKb` | `20`  | Bundle size warning threshold (KB)                       |
| `bundleCritKb` | `50`  | Bundle size critical threshold (KB)                      |
| `memoryWarnMb` | `5`   | Memory warning threshold (MB)                            |
| `memoryLeakMb` | `0.5` | Memory leak detection threshold per render (MB)          |

## Metrics

### Render Panel

Shows timing for the last N renders as metric cards and a trace. The initial render is graded against the built-in budget (warning above 5 ms, critical above 16 ms) and carries an "OK", "Warning" or "Critical" badge in that colour; the other figures are plain quantities. **Profile** and **Pause** start and stop recording, **Clear** drops the samples; the number of samples and change-detection runs is in the Profile button's tooltip.

For a variant with a [`template` or a host template](guide/content-projection.md#compiled-content-template), the render marks wrap the creation of the whole composition: the frame and every other part in it count, not only the showcased component. Compare such a variant with another composed variant, not with a plain one.

A [part](guide/showcase-decorator.md#partof) is skipped entirely; its parent's variants render and cover it.

### Bundle Panel

Measures the component's file at build time, the way it ships. ng-prism strips `@Showcase` from the published build ([`ng-prism-strip`](guide/library-publishing.md)) and comments never reach the bundle, so since `22.7.0` the source size and the gzip estimate leave out the `@Showcase` decorator, JSDoc and every other comment. A well-documented component with many variants is no longer graded as large because of its documentation. The whole file is still reported, for comparison.

Source size and gzip estimate are graded against the bundle budget (warning above 20 kb, critical above 50 kb); the size breakdown draws them against the 20 kb budget ("8.4 / 20 kb"), followed by the template, the styles and the whole file as plain quantities.

| Metric         | Description                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Source size    | Bytes of the component file without `@Showcase` and comments, printed by the TypeScript printer                             |
| Gzip estimate  | Gzip size of that source                                                                                                    |
| Direct imports | Number of `import` statements left after stripping; an import that only served `@Showcase` (`@ng-prism/core`) is gone       |
| Import list    | Those imports                                                                                                               |
| Tree depth     | Maximum depth of the relative import graph                                                                                  |
| template       | Bytes of the files behind `templateUrl`; an inline `template` is part of the source size                                    |
| styles         | Bytes of the files behind `styleUrl`/`styleUrls`, uncompiled (SCSS as written); inline `styles` are part of the source size |
| file           | Bytes of the whole file, showcase and comments included, for comparison                                                     |

The source is TypeScript, not the compiled output: Angular's AOT compilation turns the decorators and the template into code of its own, and the published bundle is minified. The figures are meant for comparing components with each other, not as the exact bytes in a consumer's bundle. Template and styles are not added to the source size and have no budget. If a file cannot be stripped, the panel falls back to the whole file and says so ("Size breakdown · whole file").

The budget stayed at 20/50 kb. Measured on a real component library, the change takes the largest component from 77 kb (critical) to 35 kb (warning), and four components that used to warn only because of their showcase and JSDoc are now well below 20 kb.

The bundle figures still describe the file of the showcased component. The classes that a composition adds, such as a frame or an `imports` entry, are not part of them.

### Memory Panel

Measures heap usage before and after rendering the component, using `performance.memory` (Chromium-only). Detects potential memory leaks by tracking heap growth across re-renders. **Snapshot** captures the heap before and after creating the component, **Clear** drops the snapshots.
