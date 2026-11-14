# A11y Reports

The [Accessibility Panel](guide/accessibility.md) audits the variant on the canvas while you look at it. For the library as a whole, ng-prism reads a report: the header shows its score as a pill (`A11y 92`), the sidebar marks the components that fall short, and the build can fail on it.

ng-prism does not audit the library itself. Producing the report is up to you, with a tool of your choice, the same pattern as `coverage-summary.json` for the [Coverage](plugins/coverage.md) plugin. ng-prism only reads the `a11y-report.json` you place in your workspace.

## Writing a report

Write the report with any tool you like: a headless browser with axe-core (Playwright or Puppeteer), an Nx target wrapping `@axe-core/cli`, or a script of your own. A built styleguide is a convenient target. The [External Tooling API](guide/external-tooling.md) lists every component and variant in `window.__PRISM_MANIFEST__`, drives the app to one by URL and marks the render with `data-prism-rendered` on `.demo-wrap`, so a loop over every variant, and every state, looks like the one for visual regression:

```js
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined);
const manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);

for (const comp of manifest.components) {
    // `disable: true` switches the audit off for the component, as in the A11y tab.
    if (comp.meta?.['a11y']?.disable) continue;

    for (const variant of comp.variants) {
        // Every variant on its own (`null`), then in each state of the component.
        const cells = [null, ...(variant.states === false ? [] : (comp.states ?? []))];

        for (const state of cells) {
            const url = new URL(baseUrl);
            url.searchParams.set('component', comp.className);
            if (variant.index > 0) url.searchParams.set('variant', String(variant.index));
            if (state) url.searchParams.set('state', String(state.index));
            url.searchParams.set('capture', '1');
            await page.goto(url.toString(), { waitUntil: 'load' });

            const key = `${comp.className}:${variant.index}${state ? `:${state.index}` : ''}`;
            await page.waitForSelector(`.demo-wrap[data-prism-rendered="${key}"]`);

            // A state that does not fit the variant forces nothing: the plain variant is already audited.
            if ((await page.locator('.demo-wrap').getAttribute('data-prism-excluded')) !== null) continue;

            // Run axe-core on `.demo-wrap` with the component's rules, for example with @axe-core/playwright:
            // new AxeBuilder({ page }).include('.demo-wrap').options({ rules: comp.meta?.['a11y']?.rules ?? {} }).analyze()
            const results = await audit(page, comp);
            record(comp, variant, state, results);
        }
    }
}
```

- **Pass `capture=1`.** axe-core cannot decide a colour contrast over a background image, and the canvas paints a dot or checkerboard pattern while browsing. [Capture mode](guide/external-tooling.md#capture-isolation-mode) removes it, keeps the background the variant declares and leaves out the overlays and tools the canvas draws around the component, as the A11y tab does for its own audit.
- **Use the component's `rules`.** `meta.a11y.rules` is in the format of axe-core's own `rules` option, and the A11y tab passes it to axe-core unchanged.
- **Leave accepted violations out of the counts.** An [accepted violation](guide/accessibility.md#accepted-violations) is matched by the axe rule id. The acceptances of a variant are the component's and the variant's own, both under `meta` in `__PRISM_MANIFEST__`, as the live audit applies them:

```js
const accepted = (component, variant) => [...(component.meta?.['a11y']?.accept ?? []), ...(variant.meta?.['a11y']?.accept ?? [])];
const counts = (violation, component, variant) => !accepted(component, variant).some((a) => a.rule === violation.id);
```

### Scores and counts

To score a variant the way the A11y tab does, count each violated axe rule once, leaving the accepted ones out, and subtract 25 per critical, 10 per serious, 5 per moderate and 1 per minor violation from 100, down to 0. `passes` and `incomplete` count rules as well: the checks axe passed, and the ones it could not decide.

A component's entry in `components` covers all its variants and states:

- `score`: the worst variant's score, not the average. An average hides a variant: a serious violation in one of 19 variants averages to 99.5 and grades ok.
- `critical`, `serious`, `moderate`, `minor`, `violations`, `passes`, `incomplete`: summed over the variants.

`total` is the library: its `score` is the average the [gate](#gating) checks, its counts are summed, and `auditedComponents` and `auditedVariants` say how much the audit covered.

## Report schema

```json
{
    "total": {
        "score": 92,
        "violations": 3,
        "critical": 0,
        "serious": 0,
        "moderate": 2,
        "minor": 1,
        "passes": 145,
        "incomplete": 0,
        "auditedComponents": 18,
        "auditedVariants": 47
    },
    "components": {
        "ButtonComponent": {
            "score": 100,
            "violations": 0,
            "critical": 0,
            "serious": 0,
            "moderate": 0,
            "minor": 0,
            "passes": 12,
            "incomplete": 0
        }
    },
    "generatedAt": "2026-06-01T10:00:00.000Z"
}
```

| Field         | Required | Description                                                                                                                                                                                                                           |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total`       | yes      | The library: `score` (0 to 100), `violations`, `critical`, `serious`, `moderate`, `minor`, `passes`, `incomplete`, `auditedComponents` and `auditedVariants`, all numbers. Drives the header pill and the [gate](#gating)             |
| `components`  | no       | One entry per component, keyed by its class name, with `score`, `violations`, `critical`, `serious`, `moderate`, `minor`, `passes` and `incomplete`. Drives the markers in the sidebar; without it, the sidebar shows no a11y markers |
| `generatedAt` | no       | When the report was written, as an ISO timestamp. Informational: ng-prism does not read it                                                                                                                                            |

A file that is missing, is not valid JSON or has no `total` counts as no report: the header shows no pill, the sidebar no a11y markers, and the build checks no gate. ng-prism says nothing about it.

## Pointing ng-prism at the report

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    a11y: {
        reportPath: 'a11y-report.json', // relative to the workspace root (the default)
        thresholds: {
            score: 85,
            critical: 0,
            serious: 0,
            moderate: 5
        }
    }
});
```

The keys, their types and defaults are under [`a11y`](api/ng-prism-config.md#a11y). `thresholds` grades the report's figures by the same rule as the score card in the [A11y tab](guide/accessibility.md#violations): danger for a critical or serious count above its limit or a score below three quarters of the target, warn for a score below the target or too many moderate violations, ok otherwise.

The report is read whenever the styleguide is built:

```bash
ng run my-lib:prism-build
```

The dev server (`ng run my-lib:prism`) reads it as well, watches the file and rebuilds when an audit run rewrites it. A report in a directory that does not exist yet when the server starts is picked up from the next rebuild on.

## Gating

`thresholds` grades the figures. Whether the [`build`](api/builders.md#build) fails is `gate`'s job (since 22.7.0). When a report exists and its `total` breaks the gate's limits, the build stops with [an error](api/build-warnings.md#the-a11y-gate-failed) that names each limit:

| `gate`                   | The build fails when the report's total breaks                         |
| ------------------------ | ---------------------------------------------------------------------- |
| left out                 | `thresholds`                                                           |
| `{ score, critical, … }` | these limits; missing ones are the defaults, not `thresholds`          |
| `false`                  | never; the styleguide grades and shows the report, CI gates on its own |

The gate looks at `total` only, not at the entries in `components`. With the gate left out, a built styleguide can only show a report whose total meets the thresholds, so the pill never turns warn or danger; the marker of a single component still can. Set `gate: false` (or limits of its own) to see a library that breaks them, for example while CI does the gating, see [Audits in CI](guide/ci.md#accessibility).

The dev server never stops over the gate: it logs the same message as a warning instead, so a stale local report cannot keep it from starting.

## What the build adds

The build reads the report after the plugin hooks have run and adds it to the manifest in two places:

- **The library.** The manifest's `meta.a11y` holds the report's `total` and the thresholds it is graded against. The header pill shows the total score in the colour of its grade, and its tooltip names the target, the audited components and variants, and the violations by severity. A plugin's [`onManifestReady`](api/ng-prism-plugin.md#onmanifestready) runs before and does not see it.
- **Each component the report lists.** Its `showcaseConfig.meta.a11y` gets `found: true`, `score` (the component's entry in the report) and `summary`, the grade (`ok`, `warn` or `danger`) with a label such as `A11y: 1 serious` or `A11y score 72`. They go next to what the `@Showcase` declares there, so [`rules`, `disable` and `accept`](api/showcase-config.md#meta) keep working for a component the report lists. A component that grades warn or danger gets a marker in the sidebar with that label; one that grades ok gets none.

The entries reach `__PRISM_MANIFEST__` like the rest of `meta`, so a producer that reads a styleguide built with an earlier report still finds the acceptances, next to the old entry.

The figures are those of the report, a snapshot of the run that wrote it. The A11y tab and the gauge in the component head show the live audit of what is on the canvas.

## Related

- [Accessibility Panel](guide/accessibility.md): the live audit, per-component config and accepted violations
- [Audits in CI](guide/ci.md#accessibility): writing the report in a pipeline without blocking the deploy
- [External Tooling API](guide/external-tooling.md): the contract the audit loop drives
- [`a11y`](api/ng-prism-config.md#a11y) in the NgPrismConfig reference, and [`meta`](api/showcase-config.md#meta) in the ShowcaseConfig reference
- [Build Warnings](api/build-warnings.md#the-a11y-gate-failed): the message of a failed gate
