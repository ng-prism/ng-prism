# Visual Regression

A built Prism app already knows every component and every variant in your library, and can be driven to any one of them from a URL. That makes it a natural source of truth for per-variant screenshot testing: one baseline image per variant, re-captured on every build and compared pixel by pixel.

ng-prism does not ship a screenshot runner. Capturing and comparing belongs to your CI container, which owns the baselines, the browser version and the font stack. Those three decide whether a diff is real. ng-prism provides a stable contract to drive the app and a rendering mode that makes the output deterministic.

> If you want the results rendered back inside the styleguide instead of only in a CI log, see the [Visual Regression plugin](plugins/visual-regression.md).

## The capture target

Screenshot `.demo-wrap`. It is [public API](guide/external-tooling.md) and safe to depend on.

It is the innermost wrapper around your rendered component: it carries the `data-prism-rendered` marker you already wait on, and it hugs the component's own box instead of the whole canvas. For a variant with a `template` or a host template, that box holds the whole composition, see [Canvas State](architecture/canvas-state.md#composed-variants-root-and-subject).

```js
const shot = await page.locator('.demo-wrap').screenshot();
```

## The three things that make screenshots flaky

### 1. The render marker means "instantiated", not "settled"

`data-prism-rendered` appears as soon as the component instance exists. At that moment fonts may still be swapping, transitions may still be running, and images may still be decoding, so the attribute does not mean "done".

For pixel work, wait for the marker and then for the page to settle:

```js
await page.waitForFunction(/* ... data-prism-rendered ... */);
await page.evaluate(() => document.fonts.ready);
```

Web-font loading is the most common source of one-off diffs: a variant captured before the face swaps in is rendered in the fallback family, and every glyph moves.

### 2. An element screenshot includes what is painted behind it

Playwright (and every other driver) clips the composited page to the element's box instead of rendering the element in isolation. Library components usually have no background of their own, so whatever the canvas paints shows through: the dot grid, the centre crosshair, rulers, the zoom badge.

The component is centred in the stage, so the grid phase underneath it shifts whenever the component changes size. A change to one variant's padding makes every pixel under it differ, and a real regression disappears in the noise.

The canvas also scrolls. A component taller or wider than the canvas viewport keeps a bounding box that extends past the canvas, and the driver captures the box's screen coordinates, including the part the canvas does not show. Whatever paints there lands in the image: the addon panel's tab bar, the variant ribbon, the floating canvas rail. Capture mode's layout isolation removes this failure, which is otherwise silent: a baseline recorded with chrome in it compares clean against itself forever.

### 3. Motion and persisted UI state

Transitions inside your own component, a zoom level left over in `localStorage` from a previous session, an a11y overlay left active on the panel: all of them land in the image.

## Capture isolation mode

`?capture=1` addresses all three problems with one switch. See [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode) for the full behaviour table; in short it strips the canvas down to a patternless background (keeping the colour a `@Showcase({ bg })` or per-variant `bg` declared, or clearing it entirely for `bg: 'transparent'`), hands the canvas the whole viewport, locks zoom to 1, suppresses panel overlays, freezes transitions and animations document-wide, and ignores persisted session state.

This lets you screenshot `.demo-wrap` directly: the capture target is composited against its declared background over its whole box, including the part that would scroll out of the canvas while browsing. Capture mode removes every shell region that is not the canvas (header, sidebar, view tabs, component head, variant ribbon, the addon panel and its resizer, the floating canvas rail), so nothing else can occupy those coordinates. It cannot make room the window does not have: a component larger than the viewport still overflows, so pin the runner's viewport to fit the largest variant you baseline.

That list is not maintained by hand. The isolation rule is structural: at every shell level that contains `.prism-canvas-stage` (`.prism-shell`, `.prism-body`, `.prism-main`, `.prism-canvas-wrap`), every sibling that does not itself contain the stage is hidden. A chrome change such as the canvas tools moving from a band to a floating rail therefore does not move any baseline. The canvas stage's own edge is built from `outline` and `box-shadow` instead of `border`, because a border would shrink the content box, shift where `.demo-wrap` centres and move every baseline.

> **Changed during the 22.2.0 beta.** Capture mode used to leave the shell in place, which composited styleguide chrome into any component taller than the canvas viewport. If you are already recording baselines against a `22.2.0` beta, every baseline moves; see [the note below](#breaking-capture-mode-hands-the-canvas-the-viewport).

### The background is part of the baseline

A variant declares `bg` because that is the surface it has to work on. A screenshot of an outlined button meant for `dark` taken on a light default proves nothing. Capture mode therefore keeps the declared colour, and the manifest tells you which one it is: every variant carries a resolved [`bg`](guide/external-tooling.md#reading-the-background), so the value you read and the pixels you get agree.

Two consequences for a runner:

- **Record it next to the baseline.** A variant whose `bg` changes compares a capture on one surface against a baseline on another: every pixel differs while the component is untouched. Storing the background alongside the baseline image lets you tell that apart from a regression, and the report has fields for both (`bg`, `baselineBg`).
- **Declare a background on anything you baseline.** `light` and `dark` are absolute colours (`--prism-void-light`, `--prism-void-dark`) and flat. Declare one when the component was designed against a surface. Declare [`transparent`](#capturing-transparency) when the component's own transparency is the thing under test. Avoid `dots`, `plain` and `checker`: all three resolve to `--prism-bg-surface`, a theme token, so a capture on one of them is only as stable as the browser profile's theme.

With nothing declared a variant resolves to `transparent` (`DEFAULT_VARIANT_BG`). An undeclared variant has no opinion about its surface, so it is captured without one. The earlier default, `checker`, patterned over a theme token, so an undeclared variant was photographed on whichever theme the runner's browser started in.

> **Changed during the 22.2.0 beta.** `DEFAULT_VARIANT_BG` moved from `checker` to `transparent`. If you are already recording baselines against `22.2.0-beta.0` or `-beta.1`, every variant that declares no `bg` now captures differently and its baseline is invalid. See [the note below](#breaking-the-default-background-changed).

### Capturing transparency

`light` and `dark` flatten the component onto an opaque colour. That is wrong for a component whose own transparency is under test, such as an outlined button, an icon or a divider: on an opaque surface, a transparent fill and a fill painted in the surface colour produce identical pixels, so that regression can never show up.

`bg: 'transparent'` captures the alpha channel instead of flattening it.

```typescript
@Showcase({
  title: 'Button',
  variants: [
    { name: 'Primary', bg: 'light' },        // designed for a light surface
    { name: 'Outlined', bg: 'transparent' }, // its transparency is under test
  ],
})
```

While browsing, `transparent` draws the checkerboard, like `checker`, because that is how the UI shows "no surface here"; a see-through canvas would just show the app shell. The two values diverge only under `?capture=1`, where `transparent` clears the canvas and every wrapper behind it so nothing is composited into the shot.

#### The runner has to ask for it

Without this flag the feature silently does nothing:

```js
await element.screenshot({ path, omitBackground: true });
```

`omitBackground` clears the _browser's_ default page backdrop, which no stylesheet can reach. Without it the capture comes back as PNG colour type 2 (no alpha channel, fully opaque) over whatever the browser painted. It still looks like a correct screenshot, but it no longer tests transparency and nothing reports that. With the flag, the same variants come back as colour type 6 with meaningful alpha.

Since an undeclared variant also resolves to `transparent`, a transparency-aware runner needs this flag for every variant without a `bg`, not only for the ones that declare `transparent`.

Two things to know before you record baselines this way:

- **Anti-aliasing becomes alpha.** Every soft edge that used to blend into an opaque surface now carries partial alpha (on a typical outlined button, around a fifth of the pixels). Within one environment this is bit-for-bit stable. Across environments it makes a macOS/Linux font-rendering difference more pronounced. Keep baselines container-only (see [below](#baselines-are-environment-specific)).
- **The comparator already handles it.** pixelmatch v7 blends semi-transparent pixels against a deterministic pattern before comparing (its `checkerboard` option, on by default), so no runner change is needed beyond the flag. The [visual-regression panel](plugins/visual-regression.md) likewise frames a transparent capture on a checkerboard rather than inventing a surface for it.

```
http://localhost:4200/?component=ButtonComponent&variant=2&capture=1
```

No config change is required, so a CI job can drive a styleguide that was built without screenshots in mind.

## Forced pseudo states

A variant that declares [`pseudo`](guide/variants.md#per-variant-pseudo-states) is captured in that state. Focus rings and hover colours get a baseline like any other variant:

```typescript
variants: [
  { name: 'Default', bg: 'light' },
  { name: 'Focused', bg: 'light', pseudo: { 'focus-visible': '.btn' } },
],
```

A component that declares [`states`](guide/variants.md#states) gets the same without a variant per state. Each state is combined with every variant, and every combination the state fits is a capture of its own, addressed with `state=` next to `variant=`. A combination it does not fit is reported as `excluded`, see [A state that does not fit](#a-state-that-does-not-fit):

```typescript
@Showcase({
  title: 'Button',
  states: [
    { name: 'Hover', pseudo: { hover: '.btn' } },
    { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } },
  ],
  variants: [{ name: 'Filled', bg: 'light' }, { name: 'Outlined', bg: 'light' }],
})
```

```
http://localhost:4200/?component=ButtonComponent&variant=1&state=0&capture=1
```

That is six captures to take instead of two: each of `Filled` and `Outlined`, on its own, in `Hover` and in `Focus visible`. The state is the index into `states`, the same one `__PRISM_MANIFEST__` lists. A runner that already walks the variants needs a loop over the states and nothing else, see [A worked example](#a-worked-example).

Two things make this work without a change in the runner:

- **The render marker waits for the state.** `data-prism-rendered` only appears once the forced states are in place on the rendered component, whether the variant forces them or a component state does. A runner that waits on the marker, as every runner on this page does, captures the forced state. With a component state the marker ends in its index (`ButtonComponent:1:0`), and a runner that wants the state waits for that exact value. Without a state it stays `ButtonComponent:1`.
- **Capture mode leaves room for the ring.** `.demo-wrap` hugs the component's box, but a focus ring is usually drawn outside it: an `outline` with an `outline-offset`, or a `box-shadow` halo. A screenshot of the bare box would crop exactly the thing under test. In capture mode, `.demo-wrap` therefore gets 8px of padding on every side for a capture that forces a state, taken back out of layout with a negative margin of the same size. The component keeps its position and its size, and the screenshot grows by 16px in each direction. A `stretch` variant keeps its width too as long as the clamp at 800px applies, i.e. from a viewport of 816px up; below that it gives up the 16px so the room stays inside the canvas.

The room applies only to captures that force a state: a variant with its own `pseudo`, or a combination whose state fits. A variant captured without a state keeps its box, so no existing baseline moves when you add `pseudo` or `states`. It is keyed on `.demo-wrap[data-pseudo]`, which lists the forced states. A ring wider than 8px still gets cropped. Clip the page screenshot yourself in that case, from the component's bounding box widened by the ring, instead of screenshotting `.demo-wrap`.

The toggle in the canvas tools menu is session state and is ignored in capture mode: what is captured is what the variant declares, plus the state in the URL. Transitions are frozen in capture mode as well, so the state is captured at its end value and not on its way there.

`__PRISM_MANIFEST__` reports the forced states per variant ([`pseudo`](guide/external-tooling.md#enumerating-what-exists)) and the component's `states`, for a runner that wants to label, filter or enumerate them.

### A state that does not fit

A state fits a variant only where the browser could put the component in it: `Remove hovered` has nothing to hover on a chip without a remove button, and `Focus visible` has nothing to focus on a disabled button. See [When a state fits](guide/variants.md#when-a-state-fits) for the rule. For such a combination nothing is forced, so what renders is the plain variant.

Do not capture that image. It is the variant's own baseline under the name of a state it is not in, so it can never fail for the state, and a selector that quietly stopped matching would go on passing. The combination still renders and still sets the marker. `.demo-wrap` also carries `data-prism-excluded` with the reason, and the runner reports the cell as `excluded` with that reason instead of taking a screenshot:

```js
const excluded = await page.locator('.demo-wrap').getAttribute('data-prism-excluded');
```

The reasons are listed in [A state that does not apply](guide/external-tooling.md#a-state-that-does-not-apply). A variant that opted out with `states: false` has no state captures at all: its manifest entry says `states: false`, and a runner skips the states for it. Asking for one anyway reads `states: false` in the same attribute.

## Breaking: the default background changed

`DEFAULT_VARIANT_BG` moved from `checker` to `transparent`. The app looks the same while browsing, since both render as the same checkerboard. But every variant that declares no `bg` produces a different capture, so its baseline is invalid.

This only affects installs already recording baselines against a `22.2.0` beta: declared backgrounds, `DEFAULT_VARIANT_BG` and capture mode all arrived in `22.2.0-beta.0` and never shipped in a stable release.

Why it moved: `checker` patterns over `--prism-bg-surface`, a theme token, and capture mode strips the pattern and keeps the colour, so an undeclared variant was captured on whichever theme the runner's browser started in. `transparent` has no theme dependency.

If you are on a `22.2.0` beta, in this order:

1. **Add `omitBackground: true`** to your runner's `screenshot(...)` call. Do this first. Without it an undeclared variant captures opaque over whatever the browser painted, which depends on the page instead of the theme and is reported nowhere.
2. **Declare a `bg` where the variant has an opinion.** `light` or `dark` for a component designed against a surface, `transparent` where transparency is the thing under test. A declared value is unaffected by this change.
3. **Re-record baselines** for everything still undeclared.

Declaring `bg: 'checker'` reproduces the old behaviour but is deprecated in the same release and removed in 23.0.0, because its colour follows the theme. Use `light` or `dark`, which are absolute.

## Breaking: capture mode hands the canvas the viewport

Capture mode used to leave the styleguide shell in place, assuming the shell sits outside `.demo-wrap` and cannot appear in an element-scoped screenshot. It can: a driver captures the target's screen coordinates, so a component taller or wider than the scrolling canvas picks up whichever shell region paints past the canvas edge.

It now removes every non-canvas region from layout (header, sidebar, view tabs, component head, variant ribbon, the addon panel and its resizer, the floating canvas rail) and drops the stage's padding, so the canvas fills the window.

Every baseline recorded in capture mode moves, though almost none of them were wrong. The canvas grows and the component re-centres inside it, so most captures shift by a few pixels and rasterise their glyphs slightly differently. In the library this was found on, 2 of 85 variants contained shell chrome; the rest move only because the geometry changed.

As above, this only affects installs already recording baselines against a `22.2.0` beta.

What to do:

1. **Re-record every baseline.** The canvas geometry changed for all of them. Do it in the same container you compare in.
2. **Check your viewport against your tallest variant.** Capture mode maximises the canvas but cannot exceed the window, so a component larger than the viewport still overflows it. A 1400x900 viewport (as in the example below) fits anything most libraries baseline; if you have a full-page pattern variant, give it room.
3. **Drop any CSS of your own that hid the panel.** An injected stylesheet that worked around this is now redundant, though harmless.

Capture mode uses `display: none` instead of `visibility: hidden` because a hidden panel still occupies its space, so the main area's background paints at those coordinates instead of the panel's tab bar. Measured at the bottom row of a `bg: 'transparent'` capture: `#11284e` with the panel left in layout, `#11284e` again with `visibility: hidden`, transparent only once it leaves layout. The canvas is `flex: 1` and has to reclaim the space for the stage to paint there.

## A worked example

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1
});
const page = await context.newPage();

// 1. Discover what exists.
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined);
const manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);

for (const comp of manifest.components) {
    for (const variant of comp.variants) {
        // Every variant on its own (`null`), then in each state of the component.
        // A variant that opted out with `states: false` has no state cells.
        const cells = [null, ...(variant.states === false ? [] : (comp.states ?? []))];

        for (const state of cells) {
            // 2. Navigate, in capture mode.
            const url = new URL(baseUrl);
            url.searchParams.set('component', comp.className);
            if (variant.index > 0) url.searchParams.set('variant', String(variant.index));
            if (state) url.searchParams.set('state', String(state.index));
            url.searchParams.set('capture', '1');
            await page.goto(url.toString(), { waitUntil: 'load' });

            // 3. Wait for the component instance. With a state, the marker ends in its index.
            const key = `${comp.className}:${variant.index}${state ? `:${state.index}` : ''}`;
            await page.waitForSelector(`.demo-wrap[data-prism-rendered="${key}"]`);

            // 4. A state that does not fit the variant still renders. Report it, do not capture it.
            const excluded = await page.locator('.demo-wrap').getAttribute('data-prism-excluded');
            if (excluded !== null) {
                await reportExcluded(comp.className, variant.index, state?.index, excluded);
                continue;
            }

            // 5. ...and then wait for the page to settle.
            await page.evaluate(() => document.fonts.ready);

            // 6. Capture. `variant.bg` is the surface it was captured on. Record it
            //    with the baseline so a background change is not read as a regression.
            const png = await page.locator('.demo-wrap').screenshot();
            await compareAgainstBaseline(comp.className, variant.index, state?.index, png, variant.bg);
        }
    }
}

await browser.close();
```

Name the baseline by variant and state (`01-outlined.png`, `01-outlined--hover.png`), so a state never overwrites the variant's own image. `reportExcluded` writes the cell into the report with `status: 'excluded'`, the reason and the `stateIndex`, see [the report format](plugins/visual-regression.md#states).

Pin `deviceScaleFactor` explicitly. A retina default doubles every dimension and invalidates every baseline captured without it.

## Baselines are environment-specific

Font hinting, subpixel rendering and text rasterisation differ between macOS and Linux, and between browser versions. The same component captured on a developer laptop and in CI will differ by hundreds of pixels while being visually identical.

Baselines belong in the same container that runs the comparison. In practice:

- Capture and compare inside one pinned container image (the Playwright images pin both the browser and the font set).
- Commit baselines produced by that image, never ones produced locally.
- Treat a browser or base-image bump as a baseline refresh, in its own commit.

## CI integration: keep the gate away from the deploy

A screenshot runner produces two independent things: a report and an exit code. Wiring them into one chain is a common way to make visual regression testing useless.

Consider the obvious pipeline:

```bash
# Broken: && stops the chain on the first regression
ng run my-lib:prism-build && npm run test:vrt && ng run my-lib:prism-build && deploy
```

The moment a variant changes, the runner exits non-zero, `&&` aborts, the second build never embeds the report and the styleguide is never deployed. The report exists on disk but nobody can look at it, at the moment you need it most.

Separate the two concerns. The gate blocks the _merge_; it must not block the _deploy_:

```bash
# 1. Build once so the runner has something to drive
ng run my-lib:prism-build

# 2. Capture and compare. Always write the report, never fail here
npm run test:vrt -- --no-fail

# 3. Rebuild so the plugin embeds the report, then publish
ng run my-lib:prism-build
npm run deploy:styleguide

# 4. Now evaluate the result and fail the job
npm run test:vrt:gate
```

The job still turns red and the pull request is still blocked, but the styleguide is deployed and shows the diffs that caused the failure.

Two practical notes:

- **Your runner needs a way to not fail.** Write the report before checking thresholds, and put the threshold check behind a flag (`--no-fail`, or a separate gate command that re-reads the report). If the runner can only ever exit non-zero, nothing above can help you.
- **In GitHub Actions, put `if: always()` on the build and deploy steps.** Without it a failing earlier step skips them even when the shell chain would have continued.

As two jobs instead of one sequence, the same idea reads more clearly: a `styleguide` job that always deploys, and a `vrt-gate` job marked as a required check. Both read the same report.

### Which audience looks where

The styleguide report and the pull request serve different readers:

- **In the pull request** you want to answer "is this change intended?". That wants the diff images close to the review, in a job artifact or a PR comment. Unless you deploy a styleguide per pull request, the deployed report describes a different commit than the one under review.
- **In the styleguide** the report describes the state of your main branch: which variants drifted, which have no baseline yet. That is documentation, not gate feedback.

If you already deploy a preview styleguide per pull request, the two become one.

## Sizing caveat: stretch variants

A variant using `canvasLayout: 'stretch'` renders as `width: 100%; max-width: 800px`. Above 800px of available canvas the width is clamped and fully deterministic. Below it the captured width follows the canvas.

In capture mode the canvas is the viewport, so "available canvas" means the viewport width, independent of the user-resizable, persisted sidebar width and panel height. Pin the viewport size in your runner (as the example above does) and keep it stable across runs.

## Report format

If you want the results surfaced in the styleguide itself, the [Visual Regression plugin](plugins/visual-regression.md) reads a JSON report your runner writes. The shape is documented there.

## Related

- [External Tooling API](guide/external-tooling.md): the anchors and capture mode in full
- [Accessibility](guide/accessibility.md): the same pattern applied to axe-core audits
- [Visual Regression plugin](plugins/visual-regression.md): rendering the report in the styleguide
