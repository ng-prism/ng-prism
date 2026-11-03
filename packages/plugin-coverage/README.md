# @ng-prism/plugin-coverage

Test coverage plugin for [@ng-prism/core](https://github.com/ng-prism/ng-prism). Reads Istanbul/v8 coverage reports at build time and displays per-component test coverage metrics in a panel and a library-wide figure in the header.

> **Full documentation:** [ng-prism Docs: Coverage Plugin](https://ng-prism.github.io/ng-prism/#/plugins/coverage)

## Installation

```bash
npm install @ng-prism/plugin-coverage
```

### Peer Dependencies

| Package          | Version               |
| ---------------- | --------------------- |
| `@ng-prism/core` | `^<plugin version>-0` |
| `@angular/core`  | `>=20.0.0`            |

Each release requires the `@ng-prism/core` of its own version (`^22.7.0-0` for 22.7.0), so keep the core and the plugin on the same version.

## Setup

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { coveragePlugin } from '@ng-prism/plugin-coverage';

export default defineConfig({
    plugins: [
        coveragePlugin({
            coveragePath: 'coverage/coverage-summary.json'
        })
    ]
});
```

## What It Does

- Adds a **Coverage** panel to the addon tab bar
- Shows the four metrics, Statements, Branches, Functions and Lines, as cards with a bar and a tick at the threshold
- Grades each against its threshold: ok at the target, warn from 75% of it, danger below, the same rule the header pill, the component head and the sidebar use
- Shows a **Coverage** pill in the header with the library-wide figure
- Works with any test runner that outputs Istanbul-compatible coverage (Jest, Karma, Vitest, nyc, c8)

## Options

| Option         | Default                            | Description                                                                                                                                                                                              |
| -------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coveragePath` | `'coverage/coverage-summary.json'` | Path to the Istanbul coverage summary file (relative to workspace root)                                                                                                                                  |
| `thresholds`   | `80` for all metrics               | Minimum acceptable percentage per metric. Files below the threshold are highlighted in red in the per-file table. A number applies to all metrics; in a partial object, keys you omit fall back to `80`. |

```typescript
// Single value, applied to lines, branches, functions, statements
coveragePlugin({ thresholds: 90 });

// Per-metric; the others fall back to 80
coveragePlugin({
    thresholds: { lines: 95, branches: 70 }
});
```

## Example

Generate coverage with your test runner, then start the showcase:

```bash
npx nx test my-lib --coverage
ng run my-lib:prism
```

Each component's Coverage tab shows its statement, branch, function and line coverage. The tab carries no badge (since 22.7); the figures are in the panel, the component head and the header.

## How It Works

**Build time:** The `onComponentScanned` hook reads `coverage-summary.json` (cached per build run, with mtime-based invalidation) and matches entries to components by file path. Coverage data is injected into `showcaseConfig.meta.coverage`.

**Runtime:** The `CoveragePanelComponent` reads the metadata and renders the metric cards with `PrismMetricCardComponent` from `@ng-prism/core`. The panel component is lazy-loaded via `loadComponent`.

## License

MIT
