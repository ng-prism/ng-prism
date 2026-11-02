# Coverage

`@ng-prism/plugin-coverage` shows the test coverage of each component from the output of your test runner: it reads an Istanbul `coverage-summary.json` at build time and grades every figure against your thresholds.

## What it does

- Adds a **Coverage** tab (id `coverage`) to the addons panel below the canvas: four metric cards (Lines, Branches, Functions, Statements), each with a bar in the colour of its grade, a tick at the metric's threshold and an **OK**, **Warning** or **Critical** badge. The tooltip of a card has the covered and total counts.
- Shows a **library-wide coverage pill** in the header ("Coverage 53%"), from the summary's `total`, with the four metrics in its tooltip.
- Adds a **Coverage** row to the metrics card of the component head, and a **sidebar marker** on a component that falls short, with its figure and target in the tooltip (`Coverage 53% · target 80%`).
- Works with any test runner that writes an Istanbul summary (Jest, Karma, Vitest, nyc, c8), see [Generate coverage](#generate-coverage).

Components and directives get coverage; services and pipes do not.

## Install

```bash
ng add @ng-prism/plugin-coverage
```

This installs the package and registers `coveragePlugin()` in `ng-prism.config.ts`. To install it by hand, see [Installing Plugins](plugins/overview.md#installing-plugins).

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { coveragePlugin } from '@ng-prism/plugin-coverage';

export default defineConfig({
    plugins: [
        coveragePlugin({
            coveragePath: 'coverage/my-lib/coverage-summary.json',
            thresholds: { lines: 90, branches: 75 }
        })
    ]
});
```

## Options

| Option         | Type                                    | Default                            | Description                                                                                                                               |
| -------------- | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `coveragePath` | `string`                                | `'coverage/coverage-summary.json'` | Path to the Istanbul coverage summary, relative to the workspace root. Read at build time.                                                |
| `thresholds`   | `number \| Partial<CoverageThresholds>` | `80` for every metric              | The target of each metric, as a percentage: one number for all four, or an object with `lines`, `branches`, `functions` and `statements`. |

### Thresholds

The targets every coverage grade is measured against. Defaults to `80` for every metric.

```typescript
// Single value, applied to lines, branches, functions, statements
coveragePlugin({ thresholds: 90 });

// Per-metric: keys you omit keep the default (80)
coveragePlugin({
    thresholds: { lines: 95, branches: 70 }
});
```

The thresholds drive every coverage colour in the styleguide: the header pill, the metrics card in the head, the sidebar marker and the metric cards. See [Grades](#grades).

## Generate coverage

The plugin reads the file that Istanbul's `json-summary` reporter writes. Most runners do not write it by default, so add the reporter to the coverage reporters of your runner, for example:

```javascript
// jest.config.js
module.exports = {
    coverageReporters: ['json-summary', 'text']
};
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: { reporter: ['json-summary', 'text'] }
    }
});
```

For Karma, add `{ type: 'json-summary' }` to the `reporters` of `coverageReporter`. Then run the tests with coverage and point `coveragePath` at the `coverage-summary.json` in the runner's coverage directory.

Start the styleguide afterwards:

```bash
ng run my-lib:prism
```

The plugin reads the summary at build time and matches each entry to its component, see [File Matching](#file-matching). The Coverage tab then shows the figures of the open component.

Run the tests again before you start or rebuild the styleguide. `serve` does not watch the summary: a new one is read on the next rebuild, which a change to a `.ts` file of the library or to the config starts.

## Metrics

The tab displays four coverage categories per component:

| Metric     | Description                                               |
| ---------- | --------------------------------------------------------- |
| Statements | Percentage of statements executed                         |
| Branches   | Percentage of branches (if/else, switch, ternary) covered |
| Functions  | Percentage of functions called                            |
| Lines      | Percentage of lines executed                              |

A component's score (in the head, the sidebar and the header) is the average of all four metrics, rounded to the nearest integer, compared against the average of the four thresholds. The metric cards compare each metric against its own threshold. The Coverage tab carries no badge: a percentage is not a number of open findings, which is what a tab badge means.

## Grades

Every coverage figure is graded by the same rule ([`statusFor`](api/plugin-ui.md#status-grading) from `@ng-prism/core/plugin`), against the configured target:

| Value                     | Grade  | Colour            |
| ------------------------- | ------ | ----------------- |
| at or above the target    | ok     | `--prism-success` |
| from 75% of the target up | warn   | `--prism-warn`    |
| below 75% of the target   | danger | `--prism-danger`  |

With the default target of 80 that is: ok from 80, warn from 60, danger below 60. The sidebar marker appears for warn and danger only.

## File Matching

The plugin matches coverage data to components by the file path the scanner reports for each component, in three steps:

1. **Exact match:** the same path
2. **Suffix match:** one path ends with the other, which handles different workspace roots
3. **Last three segments:** the last three segments of the component's path, as a fallback for diverging path structures

This finds the coverage data even when the test runner and the ng-prism scanner report different absolute paths, as in monorepo setups.

## Parts and compositions

- **Parts:** a [part](guide/parts.md) gets its coverage computed like any component, from its own file, but the styleguide does not show it: a part has no page, and its card in the parent's head has no coverage. The parent's tab, head and sidebar marker cover the parent's file only.
- **Compositions:** coverage belongs to the component's file, so a [composed variant](guide/compositions.md) changes nothing.

## Troubleshooting

- **No coverage data. Run tests with coverage enabled.** The tab says this when there is no summary at `coveragePath`, when it cannot be parsed, or when no entry of it matches the component's file. Check that the runner writes `json-summary`, that `coveragePath` points at the file, and that `collectCoverageFrom` (or your runner's equivalent) includes the component.
- **No header pill:** the summary has no `total` entry, or it was not found.
- **Old figures under `serve`:** the summary is read on a rebuild only, see [Generate coverage](#generate-coverage).

## Related

- [Visual Regression](plugins/visual-regression.md): the same build-time report pattern for screenshot diffs
- [Plugin UI Kit](api/plugin-ui.md): `statusFor` and the metric cards the tab uses
