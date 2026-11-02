# Visual Regression

`@ng-prism/plugin-visual-regression` renders a visual regression report inside the styleguide, so per-variant screenshot diffs live next to the component they belong to instead of in a CI log.

## What It Does

- Adds a **Visual Regression** panel to the addon tab bar, shown only for components that have results
- Puts a **count on that tab** of the variants waiting on a decision: red once something changed, amber while the only open items are ones that could not be compared, and absent entirely when the component is clean
- Shows a **library-wide VRT pill** in the header ("VRT 96%", the share of unchanged variants), graded against your thresholds: ok at the target, warn from 75% of it, danger below
- Adds a **VRT diff** row to the component head's gauge readout: the worst diff among that component's variants. The gauge chip in the head only names it while it deviates, and only when nothing else deviates more
- Carries a **per-component summary** in the tooltip of the list headings: every status present with its count, plus the worst diff (`1 changed · 2 new · 7 unchanged · max diff 10.26%`). There is no summary strip, so the list and the comparison keep the whole height of the dock
- **Groups the variant list by what needs you**, with the clean variants collapsed out of the way (see below)
- Per variant, and per variant and state when the component declares [`states`](guide/variants.md#states): status, diff percentage, and a baseline / current / diff comparison. The list and the comparison scroll independently, so choosing a variant never scrolls the image you chose it for out of view
- Three comparison modes: **Wipe**, **Side by side**, and **Diff** (the last only when the report records a distinct diff mask alongside a current capture)
- **Zoom** at `Fit`, `1×`, `2×`, `4×`, with pixels kept as pixels. A diff is never drawn below 1:1, because a downscaled diff is unreliable
- Treats a variant with no baseline yet (`new`) as a neutral state, never as a failure
- A `size-mismatch` variant opens in side-by-side, since wiping between two differently sized images overlays pixels that do not correspond

The plugin only renders a report produced elsewhere and does no image comparison of its own. Comparison belongs to the runner, which has the baselines and the pinned container. See [Visual Regression Testing](guide/visual-regression.md) for how to capture and compare.

> Not to be confused with the [Figma plugin](plugins/figma.md)'s Design Diff, which compares a live component against a Figma design in the browser. That is a separate feature with a similar presentation.

## Install

```bash
ng add @ng-prism/plugin-visual-regression
```

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
import { visualRegressionPlugin } from '@ng-prism/plugin-visual-regression';

export default defineConfig({
    plugins: [
        visualRegressionPlugin({
            reportPath: 'coverage/my-lib/vrt-report.json',
            assetBaseUrl: 'assets/'
        })
    ]
});
```

## Options

| Option         | Default             | Description                                                                                                                         |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `reportPath`   | `'vrt-report.json'` | Path to the report JSON, relative to the workspace root. Read at build time.                                                        |
| `assetBaseUrl` | `''`                | Prefix applied to the image paths in the report to resolve them against the served styleguide. Empty means paths are used as given. |
| `thresholds`   | `{ score: 100 }`    | Target for the share of unchanged variants: below it the header pill is warn, below 75% of it danger.                               |

### Serving the images

The report references images by path. Those files must be reachable from the built styleguide, which means copying them in via the `assets` array of your Prism app's `angular.json` target, the same way you already surface `coverage-summary.json` or `a11y-report.json`.

```jsonc
// angular.json: my-lib-prism build target
"assets": [
  { "glob": "**/*", "input": "vrt", "output": "assets/vrt" }
]
```

`assetBaseUrl` then bridges the gap between the paths recorded in the report and where the files land in the build output, so no particular layout is assumed.

It is prepended to the recorded path instead of replacing it, so the three values have to line up:

| Recorded in the report | `assetBaseUrl` | Requested URL                                   |
| ---------------------- | -------------- | ----------------------------------------------- |
| `vrt/baseline/x.png`   | `assets/`      | `assets/vrt/baseline/x.png`                     |
| `vrt/baseline/x.png`   | `vrt/`         | `vrt/vrt/baseline/x.png` (broken: path doubled) |

The first pairing is what this repository's test workspace uses. The report records workspace-relative paths instead of URLs so the runner does not have to know where the styleguide will serve them from.

## The variant list

Most of a library's variants are usually unchanged, and a flat list gives all of them equal weight, so the list is grouped instead. A [part](guide/showcase-decorator.md#partof) is skipped entirely; its parent's variants render and cover it.

```
Needs review · 1
  [Changed]  Outlined               87.40%

▸ Unchanged · 14
```

| Group            | Holds                             | Behaviour                        |
| ---------------- | --------------------------------- | -------------------------------- |
| **Needs review** | `changed`, `size-mismatch`, `new` | Always open; cannot be collapsed |
| **Unchanged**    | `unchanged`                       | Collapsed by default             |
| **Excluded**     | `excluded`                        | Collapsed by default             |

Empty groups are not rendered. Within **Needs review** the order is worst news first: changed, then resized, then new.

`new` sits in **Needs review** beside `changed`. A variant with no baseline is not a failure (the row keeps its neutral colour and the tab badge stays amber), but somebody has to accept a baseline before it resolves. `excluded` gets its own group instead of being folded into `unchanged`, because "compared and matched" and "never captured" mean different things and only the first counts as coverage.

When nothing needs review the first group starts open, because two collapsed headers and no rows would look like a panel that failed to load.

The rows are the same list rows as the a11y violations: a status badge, the name and the diff percentage on the right, and a tinted surface for the selected one, so the two panels look consistent.

### Variants and states

A component that declares [`states`](guide/variants.md#states) is captured once per variant and state, so a variant can have several rows: its own, and one for each state it was captured in. A state row reads `<variant> × <state>`:

```
Needs review · 2
  [Changed]  Outlined × Hover       12.30%
  [New]      Outlined × State 1     —
```

The state part is the entry's `stateName`. An entry that carries a `stateIndex` but no `stateName` reads `State <stateIndex + 1>`, the name the scanner gives a state declared without one, so the row reads like the state's column in the Overview: `State 1` above is `stateIndex` 0.

Each row is its own entry in the report and counts on its own: in the headings' summary, in the group counts and in the tab badge. A state that does not fit a variant (the render marker says [why](guide/external-tooling.md#a-state-that-does-not-apply)) is reported as `excluded` with the runner's `reason`, like any other capture the runner skipped.

Rows of the same status are ordered by `variantIndex`, then the variant's own entry before its states, then the states by `stateIndex`. An entry without a `stateIndex` behaves as it always did, so a report from before states renders unchanged.

## Report Format

Your runner writes this file; the plugin reads it.

```jsonc
{
    "total": {
        "auditedVariants": 85,
        "auditedComponents": 10,
        "unchanged": 84,
        "changed": 1,
        "sizeMismatch": 0,
        "new": 0,
        "maxDiffRatio": 0.5,
        "score": 99 // percent of comparable variants that are unchanged
    },
    "byVariant": [
        {
            "className": "ButtonComponent",
            "title": "Button",
            "variantName": "Primary",
            "variantIndex": 0,
            "stateIndex": 1, // optional: the ?state= value this capture was taken in
            "stateName": "Hover", // optional: the state's name
            "status": "changed", // unchanged | changed | size-mismatch | new | excluded
            "width": 800,
            "height": 2,
            "diffPixels": 800,
            "totalPixels": 1600,
            "diffRatio": 0.5,
            "baselinePath": "vrt/baseline/ButtonComponent/00-primary.png",
            "currentPath": "vrt/current/ButtonComponent/00-primary.png",
            "diffPath": "vrt/diff/ButtonComponent/00-primary.png",
            "bg": "light", // the surface this run captured on
            "baselineBg": "light" // the surface the stored baseline was captured on
        }
    ]
}
```

`total` is required and drives the header pill. `byVariant` is matched to components by `className`.

### States

| Field        | Required | Purpose                                                                                              |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `stateIndex` | no       | The `?state=` value the capture was taken with: the position of the state in `@Showcase({ states })` |
| `stateName`  | no       | The state's `name`, shown in the row label. Without it the row reads `State <stateIndex + 1>`        |

A runner that captures component-level states (`@Showcase({ states })`, listed in `__PRISM_MANIFEST__`, see [A worked example](guide/visual-regression.md#a-worked-example)) writes one entry per variant and state, with the `variantIndex` of the variant and the `stateIndex` of the state. Leave both fields out for the variant on its own: `variantIndex` alone identifies it, and every report written before states existed stays valid. `stateIndex` counts from 0, like `variantIndex`, and `0` is a real state.

A row is identified by `className`, `variantIndex` and `stateIndex`. Two entries with the same three values are indistinguishable in the list, so a state capture written without its `stateIndex` would collide with the variant's own entry.

### Status values

| Status          | Meaning                                    | Rendering                     |
| --------------- | ------------------------------------------ | ----------------------------- |
| `unchanged`     | Pixel-identical to the baseline            | Green                         |
| `changed`       | Differs from the baseline                  | Red, with the diff percentage |
| `size-mismatch` | Dimensions changed, so no pixel comparison | Orange                        |
| `new`           | No baseline recorded yet                   | Neutral, not a failure        |
| `excluded`      | Intentionally skipped by the runner        | Muted, in its own group       |

`new` is neutral. A newly added variant has nothing to regress against, and a runner that does not fail its build on it should not be contradicted by a red panel.

The list is closed. A variant carrying anything else (a typo, a status from a newer runner) is left out of the panel and out of the figures, and the build prints one warning per unrecognised value naming the first component it appeared on. Unknown statuses used to be counted in the totals while appearing in no group; dropping them keeps the count and the list consistent.

A diff percentage is only read off `unchanged` and `changed` rows. `size-mismatch` and `new` were never compared, so a `diffRatio` recorded on one of them is ignored instead of folded into the component's headline figure.

### Image paths

| Field          | Required | Purpose                        |
| -------------- | -------- | ------------------------------ |
| `baselinePath` | no       | The committed reference image  |
| `currentPath`  | no       | The image captured on this run |
| `diffPath`     | no       | The generated diff mask        |

All three are optional and the panel degrades gracefully:

- **`baselinePath` + `currentPath`:** a before/after comparison, with the diff available as a toggle. This is the most useful view.
- **`baselinePath` + `diffPath` only:** comparison falls back to baseline against the diff mask.
- **`new` status:** shows `currentPath` alone, or a "no baseline yet" note.
- **`excluded` status:** for variants a runner skipped because they cannot be captured meaningfully (a tooltip that only renders on hover would be screenshotted as its trigger). Shown as a neutral row with the runner's `reason`, and no comparison modes, since nothing was captured. Reported instead of dropped so the skipped set stays visible and coverage does not shrink unnoticed. Neither `new` nor `excluded` is framed as a fault.

### Backgrounds

| Field        | Required | Purpose                                            |
| ------------ | -------- | -------------------------------------------------- |
| `bg`         | no       | The canvas background this run captured on         |
| `baselineBg` | no       | The background the stored baseline was captured on |

Both take a `CanvasBg` value (`light`, `dark`, `dots`, `plain`, `checker`, `transparent`). A runner already has `bg`: it is the resolved [`bg` on the variant](guide/external-tooling.md#reading-the-background) it read from `__PRISM_MANIFEST__` to drive the app. `baselineBg` requires the runner to store the background next to the baseline image.

The panel uses them for two things:

- **The frame under a capture** is painted in the recorded colour instead of the transparency checkerboard. This matters for the diff mask, whose unchanged pixels a comparator typically leaves transparent, and on a checkerboard a dark variant's diff is unreadable. Only `light` and `dark` produce a colour; `dots`, `plain` and `checker` resolve to the themed surface, which the panel cannot know the runner's value for, so those keep the checkerboard. For `checker` that is correct anyway. `transparent`, which is also what a variant with no declared background resolves to, keeps it because its capture has a real alpha channel, and the checkerboard makes that visible without inventing a surface.
- **A named cause for a 100% diff.** With both fields present and different, the panel says the background moved from one surface to the other instead of leaving a reviewer to hunt a regression in an untouched component.

Both are optional throughout. A report without them renders as before.

## Related

- [Visual Regression Testing](guide/visual-regression.md): capturing screenshots that do not flake
- [External Tooling API](guide/external-tooling.md): the contract for driving the app
- [Coverage Plugin](plugins/coverage.md): the same build-time-report pattern for test coverage
