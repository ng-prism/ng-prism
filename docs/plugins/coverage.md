# Coverage

`@ng-prism/plugin-coverage` displays per-component test coverage metrics from your existing test runner output. It reads Istanbul/v8 `coverage-summary.json` at build time and renders a coverage panel per component.

## What It Does

- Adds a **Coverage** panel to the addon tab bar
- Shows a **library-wide coverage pill** in the header ("Coverage 53%"), graded against your thresholds
- Grades each component in the **component head's gauge** and with a **sidebar marker** when it falls short
- Shows four metric cards (Lines, Branches, Functions, Statements) with a bar in the grade's colour and a tick at the metric's threshold
- Works with any test runner that outputs Istanbul-compatible coverage (Jest, Karma, Vitest, nyc, c8)

## Install

```bash
ng add @ng-prism/plugin-coverage
```

This installs the package and registers `coveragePlugin()` in your `ng-prism.config.ts` automatically. To install manually: `npm install @ng-prism/plugin-coverage`.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
import { coveragePlugin } from '@ng-prism/plugin-coverage';

export default defineConfig({
    plugins: [
        coveragePlugin({
            coveragePath: 'coverage/coverage-summary.json'
        })
    ]
});
```

## Options

| Option         | Default                            | Description                                                                                                                                                                                                                               |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coveragePath` | `'coverage/coverage-summary.json'` | Path to the Istanbul coverage summary file (relative to workspace root)                                                                                                                                                                   |
| `thresholds`   | `80` for all metrics               | Minimum acceptable percentage per metric. Files below the threshold are highlighted in red in the per-file table. Accepts a number (applied to all metrics) or a partial object with `lines`, `branches`, `functions`, `statements` keys. |

### Thresholds

The targets every coverage grade is measured against. Defaults to `80` for every metric.

```typescript
// Single value, applied to lines, branches, functions, statements
coveragePlugin({ thresholds: 90 });

// Per-metric: keys you omit fall back to the default (80)
coveragePlugin({
    thresholds: { lines: 95, branches: 70 }
});
```

The thresholds drive every coverage colour in the styleguide: the header pill, the gauge, the sidebar marker and the metric cards. See [Grades](#grades).

## Usage

### 1. Generate coverage

Run your test suite with coverage enabled:

```bash
# Jest
npx nx test my-lib --coverage

# Karma
ng test my-lib --code-coverage

# Vitest
npx vitest run --coverage
```

This creates a `coverage-summary.json` file in your coverage output directory.

### 2. Start the showcase

```bash
ng run my-lib:prism
```

The plugin reads the coverage summary at build time and maps each file to its corresponding component. The Coverage panel shows the per-component metrics.

### 3. Keep coverage up to date

Run your tests with coverage before starting or rebuilding the showcase. In watch mode, the plugin detects file changes to `coverage-summary.json` and reloads automatically.

## Metrics

The panel displays four coverage categories per component:

| Metric     | Description                                               |
| ---------- | --------------------------------------------------------- |
| Statements | Percentage of statements executed                         |
| Branches   | Percentage of branches (if/else, switch, ternary) covered |
| Functions  | Percentage of functions called                            |
| Lines      | Percentage of lines executed                              |

A component's score (in the gauge, the sidebar and the header) is the average of all four metrics, rounded to the nearest integer, compared against the average of the four thresholds. The metric cards compare each metric against its own threshold. The Coverage tab carries no badge: a percentage is not a number of open findings, which is what a tab badge means.

## Grades

Every coverage figure is graded by the same rule (`statusFor` from `@ng-prism/core/plugin`), against the configured target:

| Value                     | Grade  | Colour            |
| ------------------------- | ------ | ----------------- |
| at or above the target    | ok     | `--prism-success` |
| from 75% of the target up | warn   | `--prism-warn`    |
| below 75% of the target   | danger | `--prism-danger`  |

With the default target of 80 that is: ok from 80, warn from 60, danger below 60.

## File Matching

The plugin matches coverage data to components using the file path from the scanner. It uses a multi-tier matching strategy:

1. **Exact match:** full path comparison
2. **Suffix match:** handles different workspace roots
3. **Last 3 segments:** fallback for divergent path structures

This ensures coverage data is found even when the test runner and the ng-prism scanner report different absolute paths (e.g. in monorepo setups).

A [part](guide/parts.md) gets its coverage computed like any component, from its own file, but the styleguide does not show it yet: a part has no page, and its card in the parent's head has no coverage. The parent's panel, gauge and sidebar marker cover the parent's file only.

## No Coverage Data

If no `coverage-summary.json` exists or no entry matches a component, the panel shows a hint to run tests with coverage enabled.
