# Visual Regression

A built Prism app already knows every component and every variant in your library, and can be driven to any one of them from a URL. That makes it a natural source of truth for per-variant screenshot testing: one baseline image per variant, re-captured on every build and compared pixel by pixel.

ng-prism does not ship a screenshot runner. Capturing and comparing belongs to your CI container, which owns the baselines, the browser version and the font stack. Those three decide whether a diff is real. ng-prism provides a stable contract to drive the app, the [External Tooling API](guide/external-tooling.md), and a rendering mode that makes the output deterministic. This page shows how a runner uses both; how to wire it into a pipeline is under [Audits in CI](guide/ci.md#visual-regression).

> If you want the results rendered back inside the styleguide instead of only in a CI log, see the [Visual Regression plugin](plugins/visual-regression.md). It reads a JSON report your runner writes, and documents its shape.

## The capture target

Screenshot `.demo-wrap`. It is [public API](guide/external-tooling.md) and safe to depend on.

It is the innermost wrapper around your rendered component: it carries the `data-prism-rendered` marker you already wait on, and it hugs the component's own box instead of the whole canvas. For a variant with a `template` or a host template, that box holds the whole [composition](guide/compositions.md).

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

Playwright (and every other driver) clips the composited page to the element's box instead of rendering the element in isolation. Library components usually have no background of their own, so whatever the canvas paints shows through: the dot grid, the centre crosshair, the rulers.

The component is centred in the stage, so the grid phase underneath it shifts whenever the component changes size. A change to one variant's padding makes every pixel under it differ, and a real regression disappears in the noise.

The canvas also scrolls. A component taller or wider than the canvas viewport keeps a bounding box that extends past the canvas, and the driver captures the box's screen coordinates, including the part the canvas does not show. Whatever paints there lands in the image: the addon panel's tab bar, the variant ribbon, the floating canvas rail. Capture mode's layout isolation removes this failure, which is otherwise silent: a baseline recorded with chrome in it compares clean against itself forever.

### 3. Motion and persisted UI state

Transitions inside your own component, a zoom level left over in `localStorage` from a previous session, an a11y overlay left active on the panel: all of them land in the image.

## Capture isolation mode

`?capture=1` addresses all three problems with one switch, and needs no change in the config, so a CI job can drive a styleguide that was built without screenshots in mind. In short it strips the canvas down to a patternless background (keeping the colour a `@Showcase({ bg })` or per-variant `bg` declared, or clearing it entirely for `bg: 'transparent'`), hands the canvas the whole viewport, locks zoom to 1, suppresses panel overlays, freezes transitions and animations document-wide, and ignores persisted session state. What it changes in detail is under [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode).

This lets you screenshot `.demo-wrap` directly: the capture target is composited against its declared background over its whole box, including the part that would scroll out of the canvas while browsing. It cannot make room the window does not have: a component larger than the viewport still overflows, so pin the runner's viewport to fit the largest variant you baseline.

### The background is part of the baseline

A variant declares `bg` because that is the surface it has to work on. A screenshot of an outlined button meant for `dark` taken on a light default proves nothing. Capture mode therefore keeps the declared colour, and the manifest tells you which one it is: every variant carries a resolved [`bg`](guide/external-tooling.md#reading-the-background), so the value you read and the pixels you get agree.

Two consequences for a runner:

- **Record it next to the baseline.** A variant whose `bg` changes compares a capture on one surface against a baseline on another: every pixel differs while the component is untouched. Storing the background alongside the baseline image lets you tell that apart from a regression, and the plugin's report has fields for both (`bg`, `baselineBg`).
- **Declare a background on anything you baseline.** `light` or `dark` when the component was designed against a surface, since their colours are absolute. [`transparent`](#capturing-transparency) when the component's own transparency is the thing under test. Avoid `dots` and `plain`: they follow the theme, so a capture on one of them is only as stable as the browser profile's theme, see [`bg`](api/showcase-config.md#bg).

With nothing declared a variant resolves to `transparent`. An undeclared variant has no opinion about its surface, so it is captured without one. A project whose components are all designed against one surface can say so once with [`showcaseDefaults: { bg: 'light' }`](api/ng-prism-config.md#showcasedefaults): the variants that declare nothing resolve to that value instead, and `__PRISM_MANIFEST__` reports it.

A capture keeps the text colour of the ground, also on `transparent`, whatever theme the runner's browser started in, so a component that inherits its colour looks as it does while browsing, see [`bg`](api/showcase-config.md#bg).

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

While browsing, `transparent` draws a checkerboard, because that is how the UI shows "no surface here". It is light in both themes, so a component sees the same ground under the dark theme as under the light one, see [`CanvasBg`](api/types.md#canvasbg). Only under `?capture=1` does it clear the canvas and every wrapper behind it, so nothing is composited into the shot.

#### The runner has to ask for it

Without this flag the feature silently does nothing:

```js
await element.screenshot({ path, omitBackground: true });
```

`omitBackground` clears the _browser's_ default page backdrop, which no stylesheet can reach. Without it the capture comes back as PNG colour type 2 (no alpha channel, fully opaque) over whatever the browser painted. It still looks like a correct screenshot, but it no longer tests transparency and nothing reports that. With the flag, the same variants come back as colour type 6 with meaningful alpha.

Since an undeclared variant also resolves to `transparent`, unless the config sets `showcaseDefaults.bg`, a transparency-aware runner needs this flag for every variant without a `bg`, not only for the ones that declare `transparent`. The `bg` in `__PRISM_MANIFEST__` says which it is.

Two things to know before you record baselines this way:

- **Anti-aliasing becomes alpha.** Every soft edge that would blend into an opaque surface carries partial alpha instead. Within one environment this is bit-for-bit stable. Across environments it makes a macOS/Linux font-rendering difference more pronounced. Keep baselines container-only (see [below](#baselines-are-environment-specific)).
- **The comparator already handles it.** pixelmatch 7 blends semi-transparent pixels against a deterministic pattern before comparing (its `checkerboard` option, on by default), so no runner change is needed beyond the flag. The [visual-regression panel](plugins/visual-regression.md) likewise frames a transparent capture on a checkerboard rather than inventing a surface for it.

## Forced pseudo states

A variant that declares [`pseudo`](guide/states.md#per-variant-pseudo-states) is captured in that state. Focus rings and hover colours get a baseline like any other variant:

```typescript
variants: [
  { name: 'Default', bg: 'light' },
  { name: 'Focused', bg: 'light', pseudo: { 'focus-visible': '.btn' } },
],
```

A component that declares [`states`](guide/states.md#states) gets the same without a variant per state. Each state is combined with every variant, and every combination the state fits is a capture of its own, addressed with `state=` next to `variant=`. A combination it does not fit is reported as `excluded`, see [A state that does not fit](#a-state-that-does-not-fit):

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
http://localhost:4400/?component=ButtonComponent&variant=1&state=0&capture=1
```

That is six captures to take instead of two: each of `Filled` and `Outlined`, on its own, in `Hover` and in `Focus visible`. The state is the index into `states`, the same one `__PRISM_MANIFEST__` lists. A runner that already walks the variants needs a loop over the states and nothing else, see [A worked example](#a-worked-example).

Two things make this work without a change in the runner:

- **The render marker waits for the state.** `data-prism-rendered` only appears once the forced states are in place on the rendered component, whether the variant forces them or a component state does. A runner that waits on the marker, as every runner on this page does, captures the forced state. With a component state the marker ends in its index (`ButtonComponent:1:0`), and a runner that wants the state waits for that exact value, see [Waiting for a render](guide/external-tooling.md#waiting-for-a-render). Without a state it stays `ButtonComponent:1`.
- **Capture mode leaves room for the ring.** A focus ring is usually drawn outside the component's box, which `.demo-wrap` hugs. For a capture that forces a state, capture mode pads `.demo-wrap` without moving the component, so the screenshot grows instead of cropping the ring, see [Room for a focus ring](guide/external-tooling.md#room-for-a-focus-ring). A variant captured without a state keeps its box, so no existing baseline moves when you add `pseudo` or `states`. A ring wider than that room (8px) still gets cropped; [the same section](guide/external-tooling.md#room-for-a-focus-ring) says what to do then.

The toggles in the canvas tools menu are session state and are ignored in capture mode, and so is what the menu [simulates](guide/styleguide-ui.md#simulate): what is captured is what the variant declares, plus the state in the URL. Transitions are frozen in capture mode as well, so the state is captured at its end value and not on its way there.

`__PRISM_MANIFEST__` reports the forced states per variant ([`pseudo`](guide/external-tooling.md#enumerating-what-exists)) and the component's `states`, for a runner that wants to label, filter or enumerate them.

### A state that does not fit

A state fits a variant only where the browser could put the component in it: `Remove hovered` has nothing to hover on a chip without a remove button, and `Focus visible` has nothing to focus on a disabled button. See [When a state does not fit](guide/states.md#when-a-state-does-not-fit) for the rule. For such a combination nothing is forced, so what renders is the plain variant.

Do not capture that image. It is the variant's own baseline under the name of a state it is not in, so it can never fail for the state, and a selector that quietly stopped matching would go on passing. The combination still renders and still sets the marker. `.demo-wrap` also carries `data-prism-excluded` with the reason, and the runner reports the cell as `excluded` with that reason instead of taking a screenshot:

```js
const excluded = await page.locator('.demo-wrap').getAttribute('data-prism-excluded');
```

The reasons are listed in [When a state does not fit](guide/states.md#when-a-state-does-not-fit). A variant that opted out with `states: false` has no state captures at all: its manifest entry says `states: false`, and a runner skips the states for it. Asking for one anyway reads `states: false` in the same attribute.

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

            // 6. Capture, with the alpha channel of a `transparent` background. `variant.bg` is the
            //    surface it was captured on. Record it with the baseline so a background change
            //    is not read as a regression.
            const png = await page.locator('.demo-wrap').screenshot({ omitBackground: true });
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

## Sizing caveat: stretch variants

A variant with [`canvasLayout: 'stretch'`](api/showcase-config.md#canvaslayout) is clamped at 800px. Above 800px of available canvas its width is fully deterministic. Below it the captured width follows the canvas.

In capture mode the canvas is the viewport, so "available canvas" means the viewport width, independent of the user-resizable, persisted sidebar width and panel height, and of a viewport width set in the tools menu. Pin the viewport size in your runner (as the example above does) and keep it stable across runs.

## Related

- [External Tooling API](guide/external-tooling.md): the anchors and capture mode in full
- [Audits in CI](guide/ci.md#visual-regression): running the comparison in a pipeline without blocking the deploy
- [Visual Regression plugin](plugins/visual-regression.md): rendering the report in the styleguide
- [States & Pseudo States](guide/states.md#screenshot-runners): states in a screenshot runner
- [A11y Reports](guide/a11y-reports.md): the same contract driving an axe-core audit
