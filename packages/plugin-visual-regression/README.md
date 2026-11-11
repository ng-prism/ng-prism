# @ng-prism/plugin-visual-regression

Visual regression plugin for [@ng-prism/core](https://github.com/ng-prism/ng-prism). Reads a per-variant screenshot comparison report at build time and renders it inside the styleguide, so diffs live next to the component they belong to instead of in a CI log.

> **Full documentation:** [ng-prism Docs: Visual Regression Plugin](https://ng-prism.github.io/ng-prism/#/plugins/visual-regression)

The plugin **only renders a report someone else produced.** It performs no image comparison of its own. That belongs to your runner, which owns the baselines and the pinned container. See [Visual Regression Testing](https://ng-prism.github.io/ng-prism/#/guide/visual-regression) for how to capture screenshots that do not flake, including the `?capture=1` isolation mode.

## Installation

```bash
ng add @ng-prism/plugin-visual-regression
```

Or manually: `npm install @ng-prism/plugin-visual-regression`

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

| Option         | Default             | Description                                                                                           |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `reportPath`   | `'vrt-report.json'` | Path to the report JSON, relative to the workspace root.                                              |
| `assetBaseUrl` | `''`                | Prefix applied to the image paths in the report so they resolve against the build.                    |
| `thresholds`   | `{ score: 100 }`    | Target for the share of unchanged variants: below it the header pill is warn, below 75% of it danger. |

## Report Format

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
        "score": 99
    },
    "byVariant": [
        {
            "className": "ButtonComponent",
            "variantName": "Primary",
            "variantIndex": 0,
            "stateIndex": 1,
            "stateName": "Hover",
            "status": "changed",
            "diffRatio": 0.5,
            "baselinePath": "vrt/baseline/ButtonComponent/00-primary.png",
            "currentPath": "vrt/current/ButtonComponent/00-primary.png",
            "diffPath": "vrt/diff/ButtonComponent/00-primary.png",
            "bg": "light",
            "baselineBg": "light"
        }
    ]
}
```

Results are matched to components by `className`. All three image paths are optional and the panel degrades gracefully: baseline + current gives a wipe comparison, baseline + diff falls back to comparing against the diff mask, and a single image is shown on its own.

`stateIndex` and `stateName` are optional. A component that declares `states` in `@Showcase` is captured once per variant and state: write one entry for each, with the `variantIndex` of the variant and the `stateIndex` of the state (the `?state=` value, counting from 0). The panel lists the row as `<variant> × <state>`, falling back to `State <stateIndex + 1>` without a `stateName` (the name the scanner gives a state declared without one), and sorts it after the variant's own entry. Leave both fields out for the variant on its own; a report without them renders as before.

`status: "new"` (a variant with no baseline yet) renders as a **neutral** state, never as a failure.

`bg` and `baselineBg` are optional and record the canvas background a capture was taken on: `bg` for this run, `baselineBg` for the stored baseline. A runner already has `bg`: it is the resolved `bg` on the variant it read from `__PRISM_MANIFEST__`. Given them, the panel frames the images in that surface instead of the theme's transparency checkerboard (which is what makes a dark variant's diff mask readable), and when the two differ it names the background change instead of leaving a 100% diff unexplained. `transparent` (and a report without `bg`) is framed on the same fixed light checkerboard the canvas draws for it, in both themes.

## Serving the Images

The report references images by path; those files must be reachable from the built styleguide. Copy them in via the `assets` array of your Prism app's build target, then point `assetBaseUrl` at where they land.

`assetBaseUrl` is **prepended to the path in the report**, not a replacement for it. The three values have to line up:

```jsonc
// angular.json, my-lib-prism build target
"assets": [
  { "glob": "**/*", "input": "vrt", "output": "assets/vrt" }
]
```

| Recorded in the report | `assetBaseUrl` | Requested URL                                   |
| ---------------------- | -------------- | ----------------------------------------------- |
| `vrt/baseline/x.png`   | `assets/`      | `assets/vrt/baseline/x.png`                     |
| `vrt/baseline/x.png`   | `vrt/`         | `vrt/vrt/baseline/x.png` (broken: path doubled) |

## License

MIT
