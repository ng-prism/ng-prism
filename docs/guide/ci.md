# Audits in CI

Two audits feed the styleguide from the outside: an [a11y report](guide/a11y-reports.md) and the report of a [visual regression](guide/visual-regression.md) runner. A script of yours writes each of them against a built styleguide, the styleguide build reads it, and the result should block a merge without blocking the deploy that shows it. This page is that pipeline.

## The pattern

An audit produces two independent things: a report and an exit code. Wiring them into one chain is a common way to lose the report at the moment you need it most. Consider the obvious pipeline:

```bash
# Broken: && stops the chain on the first regression
ng run my-lib:prism-build && npm run audit && ng run my-lib:prism-build && npm run deploy:styleguide
```

The moment the audit finds something, it exits non-zero, `&&` aborts, the second build never embeds the report and the styleguide is never deployed. The report exists on disk, but nobody can look at it. Sequential CI steps behave the same way: a failing step skips every step after it.

Separate the two concerns. The gate blocks the _merge_; it must not block the _deploy_:

```bash
# 1. Build once so the audit has something to drive
ng run my-lib:prism-build

# 2. Audit. Always write the report, never fail here
npm run audit -- --no-fail

# 3. Rebuild so the styleguide embeds the report, then publish
ng run my-lib:prism-build
npm run deploy:styleguide

# 4. Now evaluate the result and fail the job
npm run audit:gate
```

The job still turns red and the pull request is still blocked, but the styleguide is deployed and shows what caused the failure.

Three practical notes:

- **The audit needs a way to not fail.** Write the report before checking thresholds, and put the threshold check behind a flag (`--no-fail`, or a separate gate command that re-reads the report). If the script can only ever exit non-zero, nothing above can help you.
- **In GitHub Actions, put `if: always()` on the build, deploy and gate steps after the audit.** Without it a failing earlier step skips them even when the shell chain would have continued.
- **As two jobs** instead of one sequence, the same idea reads more clearly: a `styleguide` job that always deploys, and a gate job marked as a required check. Both read the same report.

## Accessibility

The audit writes `a11y-report.json`, see [Writing a report](guide/a11y-reports.md#writing-a-report). The styleguide build reads it, and by default it also [gates](guide/a11y-reports.md#gating) on it: with the gate left out, a report that breaks the limits fails the rebuild in step 3, the very build that is meant to show it. Configure the styleguide's build not to gate, and leave the gating to the pipeline:

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    a11y: { gate: false }
});
```

```yaml
- run: npx nx run my-lib:test --coverage # the Coverage plugin's report, read by the same build
- run: npx nx run my-lib:prism-build

# Always write the report, never fail here
- run: npx nx run my-lib:audit-a11y -- --no-fail

# Rebuild so the report lands in the manifest, then publish
- run: npx nx run my-lib:prism-build
  if: always()
- run: npm run deploy:styleguide
  if: always()

# Now evaluate the result and fail the job
- run: npx nx run my-lib:audit-a11y:gate
  if: always()
```

The job still turns red and the pull request is still blocked, but the styleguide is deployed, and its header pill, the markers in the sidebar and the A11y tab show what caused it.

## Visual regression

The runner captures and compares, see [Visual Regression](guide/visual-regression.md), and writes the report the [Visual Regression plugin](plugins/visual-regression.md) reads when the styleguide is built. It is [the pattern](#the-pattern) with the runner as the audit: `npm run test:vrt -- --no-fail` in step 2, and `npm run test:vrt:gate` in step 4. The rebuild in step 3 lets the plugin embed the report, and since the plugin never fails a build, there is nothing to configure for it. The styleguide is deployed with the diffs that caused the failure.

### Which audience looks where

The styleguide report and the pull request serve different readers:

- **In the pull request** you want to answer "is this change intended?". That wants the diff images close to the review, in a job artifact or a PR comment. Unless you deploy a styleguide per pull request, the deployed report describes a different commit than the one under review.
- **In the styleguide** the report describes the state of your main branch: which variants drifted, which have no baseline yet. That is documentation, not gate feedback.

If you already deploy a preview styleguide per pull request, the two become one.

## Why only A11y gates in the build

The a11y report is read by ng-prism itself. It carries a library-wide total, and ng-prism grades that total against limits of its own, so the build can check them and fail: [`a11y.gate`](api/ng-prism-config.md#a11y). That gate is for a project without a gate of its own, where it keeps a styleguide that breaks the limits from being published. A pipeline that gates on its own sets `gate: false`, as above.

The Visual Regression plugin has no gate. It renders what a runner found, and its `thresholds` only grade the header pill. Whether a changed pixel is a regression is decided by the runner, against baselines, a browser and a font stack the styleguide build never sees, so the runner's exit code, or its gate command, is the gate.

Either way the build audits nothing: it reads the report that is on disk when it runs.

## Related

- [A11y Reports](guide/a11y-reports.md): writing the report, its schema and the build's gate
- [Visual Regression](guide/visual-regression.md): capturing and comparing in a runner
- [Visual Regression plugin](plugins/visual-regression.md): the report the plugin renders
- [`a11y`](api/ng-prism-config.md#a11y) in the NgPrismConfig reference
- [Builders](api/builders.md): the `prism-build` target
