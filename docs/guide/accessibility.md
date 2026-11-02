# Accessibility Panel

ng-prism includes an accessibility panel powered by [axe-core](https://github.com/dequelabs/axe-core). It's part of the core, so no plugin is required.

## Features

The A11y panel has four sub-tabs:

### Violations

Runs an axe-core audit against the currently rendered component variant. Results are sorted by impact level:

| Level    | Color  | Meaning                              |
| -------- | ------ | ------------------------------------ |
| Critical | Red    | Must fix: blocks users entirely      |
| Serious  | Orange | Should fix: significant barrier      |
| Moderate | Yellow | Consider fixing: some users affected |
| Minor    | Blue   | Nice to fix: minor inconvenience     |

The audit re-runs automatically when you switch variants or change input values in the Controls panel. The Violations view shows the score in a small card whose ring takes the colour of its grade (see below), the violations most severe first, the [accepted ones](#accepted-violations) with their reasons, what axe could not decide, and the passed checks folded into one line you can open. The panel's tab, and the Violations sub-tab, carry the number of open violations, red when one of them is critical or serious and amber otherwise; a clean component's tab carries no badge.

**Needs review.** axe answers some checks with "incomplete": it could not decide, for example a contrast over a background image or under another element. Those are listed under _Needs review_ with axe's reason. They do not count towards the score, but they are not passes either (since 22.7.0; before, they did not appear at all).

**What the audit sees.** It measures the component and nothing the canvas draws around it. For the duration of the audit, the panel overlays (the A11y panel's own outline, the box model, any plugin's), the measure tool, the rulers and the stage's dot or checker pattern are hidden, so the outline over the component cannot hide a contrast violation and the result does not depend on which panel is open (since 22.7.0). They may blink away for that moment. What the component renders itself stays visible, a CDK overlay in `<body>` included; the audit covers the component's own element, so such an overlay is not audited (see [How It Works](#how-it-works)). The theme is the one you look at.

### Keyboard Navigation

Analyzes the component's keyboard accessibility:

- Tab order visualization with numbered indicators
- Focus trap detection
- Missing `tabindex` warnings
- Overlay with numbered focus indicators in the primary colour on the rendered component

### ARIA Tree

Displays the component's ARIA role hierarchy as a tree structure:

- Roles, states, and properties for each element
- Highlights missing or incorrect ARIA attributes
- Shows the accessible name computation

### Screen Reader

Simulates how a screen reader would interpret the component:

- **List mode** (visual perspective): shows all announced elements
- **Player mode** (screen reader perspective): step-by-step navigation with previous/next controls
- Overlay indicators in the primary colour on the rendered component

## Perspective Toggle

The renderer toolbar includes a perspective toggle:

- **Visual**: default view, component rendered normally
- **Screen Reader**: canvas dims, overlay shows SR-announced elements

The active perspective decides which overlay is visible: Keyboard shows the tab order, Screen Reader the announced elements.

## Configuration

### Per-component rules

Use the `meta` field on `@Showcase` to configure axe-core rules for specific components:

```typescript
@Showcase({
  title: 'Dialog',
  meta: {
    a11y: {
      rules: {
        'color-contrast': { enabled: false },  // disable specific rule
        'aria-required-attr': { enabled: true },
      },
    },
  },
})
```

### Disabling for a component

```typescript
@Showcase({
  title: 'Decorative Icon',
  meta: {
    a11y: { disable: true },
  },
})
```

When disabled, the A11y panel shows a message instead of running the audit.

### Accepted violations

A violation that is known, deliberate and owned can be accepted (since 22.7.0). It is still audited and shown, under _Accepted_ with its reason, but it does not count towards the score, the gauge in the component head or the badges:

```typescript
@Showcase({
  title: 'Select',
  meta: {
    a11y: {
      // applies to every variant
      accept: [{ rule: 'aria-required-children', reason: 'The options render in a CDK overlay outside the host.' }],
    },
  },
  variants: [
    {
      name: 'Default',
      meta: {
        a11y: {
          // this variant only, in addition to the component's
          accept: [{ rule: 'color-contrast', reason: 'The placeholder is Concrete as in Figma, 3.35:1; design keeps it.' }],
        },
      },
    },
  ],
})
```

- `rule` is the axe rule id. An acceptance covers every node that rule reports in the variant.
- `reason` is required: an acceptance without one cannot be told apart from an oversight. An entry without a rule or a reason is ignored, with a warning in the console.
- A variant gets the component's acceptances and its own.

Accepting is not switching a rule off. `rules: { 'color-contrast': { enabled: false } }` means the rule is not audited at all; `accept` means it is audited and visible, but not counted. A report producer applies the same rule when it writes the library-wide report, see below.

## Library-Wide A11y Score & Header Badge

Beyond the live runtime audit, ng-prism can surface a library-wide A11y score as a pill in the header ("A11y 92") and a marker per component in the navigation. Every a11y figure in the styleguide is graded by one rule against `a11y.thresholds`: any critical or serious violation above its limit is danger; a score below 75% of the score threshold is danger, below the threshold or with too many moderate violations it is warn; otherwise ok. The header pill, the navigation marker, the gauge in the component head and the score card all use it.

ng-prism does not generate the score itself. Producing an aggregate audit is the consumer's responsibility (same pattern as `coverage-summary.json` for the coverage plugin). ng-prism only reads an `a11y-report.json` you place in your workspace.

### 1. Produce `a11y-report.json` in your library project

Write the report at build time using any tool you like: headless browsers + axe-core (Playwright/Puppeteer), an Nx target wrapping `@axe-core/cli`, or your own script.

#### External Audit API

The Prism app exposes a small contract for driving it from the outside: `window.__PRISM_MANIFEST__` to enumerate components and variants, `?component=`/`?variant=` to navigate, and `data-prism-rendered` on `.demo-wrap` as the render marker. It is documented in full under [External Tooling API](guide/external-tooling.md).

An axe-core audit loop over every variant looks like this:

```js
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined);
const manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);

for (const comp of manifest.components) {
    for (const variant of comp.variants) {
        const url = new URL(baseUrl);
        url.searchParams.set('component', comp.className);
        if (variant.index > 0) url.searchParams.set('variant', String(variant.index));
        await page.goto(url.toString(), { waitUntil: 'load' });
        await page.waitForFunction(
            ([expected]) => document.querySelector('.demo-wrap')?.getAttribute('data-prism-rendered')?.startsWith(expected),
            [`${comp.className}:`]
        );
        // inject axe-core, run against .demo-wrap, collect violations…
    }
}
```

> Auditing accessibility does not need [capture isolation mode](guide/external-tooling.md#capture-isolation-mode), because axe-core inspects the DOM, not pixels. Screenshot tooling does; see [Visual Regression](guide/visual-regression.md).

The file must match this JSON shape:

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

`total` is required and drives the header pill. `components` is optional and drives the markers in the navigation: a component the report lists gets a marker when its entry grades warn or danger. Without it, the navigation shows no a11y markers. `generatedAt` is informational.

How a producer best fills `components`, one entry per component across its variants:

- `score`: the worst variant's score, not the average. An average hides a variant: a serious violation in one of 19 variants averages to 99.5 and grades ok.
- `critical`, `serious`, `moderate`, `minor`, `violations`, `passes`, `incomplete`: summed over the variants.
- Accepted violations do not count, the same as in the live audit: an acceptance applies to a variant when the component's `meta.a11y.accept` or the variant's names the violation's rule id. Both are in [`window.__PRISM_MANIFEST__`](guide/external-tooling.md) under `meta` of the component and of each variant.

The build adds a component's entry to its `showcaseConfig.meta.a11y` as `found`, `score` and `summary`, next to what the `@Showcase` already declares there: `rules` and `disable` keep working for a component the report lists (since 22.7.0; before, the entry replaced them).

### 2. Point ng-prism at the report

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';

export default defineConfig({
    a11y: {
        reportPath: 'a11y-report.json', // relative to workspace root (default)
        thresholds: {
            score: 85,
            critical: 0,
            serious: 0,
            moderate: 5
        }
    }
});
```

`thresholds` grades the figures. Whether the build fails is `gate`'s job (since 22.7.0):

| `gate`                   | The build fails when the report's total breaks                         |
| ------------------------ | ---------------------------------------------------------------------- |
| left out                 | `thresholds`, as before 22.7.0                                         |
| `{ score, critical, … }` | these limits; missing ones are the defaults, not `thresholds`          |
| `false`                  | never; the styleguide grades and shows the report, CI gates on its own |

With the gate left out, a built styleguide can only show a report that meets the thresholds, so the pill never turns warn or danger. Set `gate: false` (or limits of its own) to see a library that breaks them, for example while CI does the gating.

The dev server (`ng run my-lib:prism`) never stops over the gate: it logs a warning instead, so a stale local report cannot keep it from starting. It also watches the report file and rebuilds when an audit run rewrites it. A report in a directory that does not exist yet when the server starts is picked up from the next rebuild on.

### 3. Build the Prism app

```bash
npx nx run my-lib-prism:build
```

The build pipeline reads `a11y-report.json` and embeds the aggregate data into the runtime manifest. The header pill renders if the file exists. If `reportPath` doesn't resolve, the pill is silently omitted.

### CI integration

The audit produces two independent things: a report and an exit code. Chaining them together is a common way to lose the report when you need it most.

```yaml
# Broken: the audit fails the job, so the build that embeds the report never runs
- run: npx nx run my-lib:test --coverage
- run: npx nx run my-lib:audit-a11y # exits non-zero on a threshold violation
- run: npx nx run my-lib-prism:build # never reached
```

The moment the library drops below its threshold, the audit exits non-zero, the second build never happens, and the styleguide that would have shown you _which_ components regressed is never deployed.

Separate them. The gate blocks the merge; it must not block the deploy. Configure the styleguide's build not to gate (`a11y: { gate: false }`), so the rebuild below embeds whatever the audit found:

```yaml
- run: npx nx run my-lib:test --coverage
- run: npx nx run my-lib-prism:build

# Always write the report, never fail here
- run: npx nx run my-lib:audit-a11y -- --no-fail

# Rebuild so the report lands in the manifest, then publish
- run: npx nx run my-lib-prism:build
  if: always()
- run: npm run deploy:styleguide
  if: always()

# Now evaluate the result and fail the job
- run: npx nx run my-lib:audit-a11y:gate
  if: always()
```

The job still turns red and the pull request is still blocked, but the styleguide is deployed and the header pill and A11y panel show what caused it.

This requires an audit script that can run without failing: write the report before checking thresholds, and put the threshold check behind a flag or a separate gate command that re-reads the report. With the build's gate left out instead, the rebuild would throw on exactly the report it is meant to show. The same reasoning applies to visual regression testing; see [CI integration](guide/visual-regression.md#ci-integration-keep-the-gate-away-from-the-deploy) there for details.

> `&&` chains in an npm script have the same problem as sequential CI steps: `build && audit && build` stops at the first non-zero exit.

## Dependencies

`axe-core` ships as a dependency of `@ng-prism/core`, so there is nothing to install. It is loaded lazily: the audit engine is only fetched when you open the A11y panel, so it costs nothing in a styleguide you never audit.

The `ng add` schematic already lists it in `allowedCommonJsDependencies` for the generated showcase app. If you set the app up by hand, add it yourself to silence the CommonJS optimization-bailout warning, since axe-core ships as UMD:

```json
"allowedCommonJsDependencies": ["highlight.js", "axe-core"]
```

## How It Works

The A11y system consists of several services:

| Service                  | Responsibility                                  |
| ------------------------ | ----------------------------------------------- |
| `A11yAuditService`       | Runs axe-core against the rendered DOM element  |
| `A11yKeyboardService`    | Analyzes tab order and focus behavior           |
| `A11yTreeService`        | Builds the ARIA role tree from DOM              |
| `A11ySrService`          | Generates screen reader announcement sequence   |
| `A11yPerspectiveService` | Manages visual/screen-reader perspective toggle |
| `A11yPanelStateService`  | Tracks active sub-tab for overlay visibility    |

The audit uses `PrismRendererService.renderedElement` signal to access the component's DOM element. When the element or input values change, the audit debounces (500ms) and re-runs automatically.

For a variant with a [`template` or a host template](guide/compositions.md), `renderedElement` is the root of the whole composition, so the audit, the ARIA tree, the screen reader sequence and the tab order cover the frame and the other parts too. A form control in its field is audited with the label that the field gives it, and `Form elements must have labels` does not fire for an input the frame labels. Only the role the overlay shows for the element comes from `PrismRendererService.subjectElement`, the showcased element itself. Overlays that render into `<body>` are outside the composition and are not audited.
