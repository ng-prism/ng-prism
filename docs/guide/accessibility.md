# Accessibility Panel

The **A11y** tab of the addons panel audits the component on the canvas with [axe-core](https://github.com/dequelabs/axe-core) and shows how the component reads to assistive technology. It is part of the core, so no plugin is required. axe-core ships as a dependency of `@ng-prism/core` and is loaded lazily, with the first audit; a styleguide app set up by hand lists it in `allowedCommonJsDependencies`, see [The styleguide app target](api/builders.md#the-styleguide-app-target).

## Features

The audit covers the component the canvas renders, its own element and everything inside it. For a variant with a [`template` or a host template](guide/compositions.md) that is the whole composition: the audit, the ARIA tree, the screen reader list and the tab order include the frame and the other parts. A form control in its field is audited with the label the field gives it, so `Form elements must have labels` does not fire for an input the frame labels. An overlay the component opens in `<body>`, such as a CDK overlay, is outside it and is not audited.

The audit runs on the Playground while the addons panel is shown, whichever of its tabs is open, since the A11y tab carries the number of violations. It runs again about half a second after the variant, the component or an input value in the Controls panel changes. A state picked in the tools menu, a pseudo-class toggle and a theme switch do not start a new audit, so change an input to audit the component in that state.

The panel has four sub-tabs.

### Violations

The axe-core audit of the variant on the canvas:

- **Score** out of 100, in a card whose ring takes the colour of the score's grade against [`a11y.thresholds`](api/ng-prism-config.md#a11y): red with a critical or serious violation above its limit or a score below three quarters of the target, amber below the target or with too many moderate violations, green otherwise. The tooltip names the target and the counts.
- **Violations**, most severe first, each with the rule's help text, its description and the rule id:

    | Level    | Badge         | Meaning                              |
    | -------- | ------------- | ------------------------------------ |
    | Critical | red           | Must fix: blocks users entirely      |
    | Serious  | red, outlined | Should fix: significant barrier      |
    | Moderate | amber         | Consider fixing: some users affected |
    | Minor    | grey          | Nice to fix: minor inconvenience     |

- **Accepted**, the [accepted violations](#accepted-violations) with their reasons.
- **Needs review**, what axe answered with "incomplete" because it could not decide, for example a contrast over a background image or under another element, with axe's reason (since 22.7.0). They do not count towards the score, but they are not passes either.
- **Passed checks**, folded into one line you can open.

The A11y tab and the Violations sub-tab carry the number of open violations, red when one of them is critical or serious and amber otherwise. A clean component's tab carries no badge.

**What the audit sees.** It measures the component and nothing the canvas draws around it (since 22.7.0). For the duration of the audit, the panel overlays (the A11y panel's own outline, the box model, any plugin's), the measuring tool, the rulers and the canvas's dot or checker pattern are hidden, so an outline over the component cannot hide a contrast violation and the result does not depend on which panel is open. They may blink away for that moment. What the component renders itself stays visible. The theme is the one you look at.

### Keyboard Navigation

The tab stops of the component, in the order the Tab key reaches them: elements with a positive `tabindex` first, then the others in document order. Each row shows `Tab 1`, `Tab 2`, …, the element's accessible name (or its tag and type), its states, such as `disabled`, and the element. A component without a focusable element reads `No focusable elements found.`

### ARIA Tree

The component as an accessibility tree: each element with its role (`generic` where it has none), its accessible name in quotes and its states and properties in brackets, such as `[expanded=false]`. A node with children folds open and closed. An element with `aria-hidden="true"` or the `hidden` attribute is dimmed, and its children are left out; one hidden only by CSS is listed like any other.

### Screen Reader

What a screen reader announces, in reading order: one numbered line per element with a role it announces (button, link, text field, heading, list, image and the other common roles), with its accessible name and its states. Elements with `aria-hidden="true"` or the `hidden` attribute are left out.

## On the canvas

While the A11y tab is open, the canvas outlines the rendered component and labels it with the role of the showcased element (`role="button"`) and, when the component holds a focusable element, its first tab stop (`Tab 1`). In a composition the outline goes around the whole composition, and the role is the one of the showcased element. The outline is gone while the [measuring tool](guide/measuring.md) is on and in capture mode.

## Per-component config

[`meta.a11y`](api/showcase-config.md#meta) on `@Showcase` configures the audit of one component. `rules` switches axe rules on or off:

```typescript
@Showcase({
    title: 'Dialog',
    meta: {
        a11y: {
            rules: {
                'color-contrast': { enabled: false }, // disable a rule
                'aria-required-attr': { enabled: true }
            }
        }
    }
})
```

`disable: true` skips the audit for the component. The A11y tab then shows `Accessibility audit disabled for this component.` instead of the sub-tabs:

```typescript
@Showcase({
    title: 'Decorative Icon',
    meta: {
        a11y: { disable: true }
    }
})
```

## Accepted violations

A violation that is known, deliberate and owned can be accepted (since 22.7.0). It is still audited and shown, under _Accepted_ with its reason, but it does not count towards the score, the gauge in the component head or the badges:

```typescript
@Showcase({
    title: 'Select',
    meta: {
        a11y: {
            // applies to every variant
            accept: [{ rule: 'aria-required-children', reason: 'The options render in a CDK overlay outside the host.' }]
        }
    },
    variants: [
        {
            name: 'Default',
            meta: {
                a11y: {
                    // this variant only, in addition to the component's
                    accept: [{ rule: 'color-contrast', reason: 'The placeholder is Concrete as in Figma, 3.35:1; design keeps it.' }]
                }
            }
        }
    ]
})
```

- `rule` is the axe rule id. An acceptance covers every node that rule reports in the variant.
- `reason` is required: an acceptance without one cannot be told apart from an oversight. An entry without a rule or a reason is ignored, with a warning in the browser console.
- A variant gets the component's acceptances and its own.

Accepting is not switching a rule off. `rules: { 'color-contrast': { enabled: false } }` means the rule is not audited at all; `accept` means it is audited and visible, but not counted. A report producer applies the same rule when it writes the library-wide report, see [A11y Reports](guide/a11y-reports.md#writing-a-report).

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

## Related

- [Tour of the UI](guide/styleguide-ui.md#playground-overview-and-api): the addons panel and the metrics in the component head
- [`meta`](api/showcase-config.md#meta) in the ShowcaseConfig reference, and [`a11y`](api/ng-prism-config.md#a11y) in the NgPrismConfig reference
- [A11y Reports](guide/a11y-reports.md): the library-wide score, its header pill and the markers in the sidebar
- [Audits in CI](guide/ci.md#accessibility): auditing every variant in CI
