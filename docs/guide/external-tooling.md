# External Tooling API

A built Prism app is a static site. That makes it a convenient target for tools that drive it from the outside: accessibility audits, visual regression runners, link checkers, screenshot generators for a design system site.

ng-prism exposes a small, stable contract for those tools, and this page is its reference. [Visual Regression](guide/visual-regression.md) and [A11y Reports](guide/a11y-reports.md) build on it.

> These anchors are public API. They are covered by the same semver policy as the TypeScript surface, so renaming `.demo-wrap` or `data-prism-rendered` is a breaking change.

## The Anchors

| Anchor                                                               | Where                           | Purpose                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.__PRISM_MANIFEST__`                                          | global, set by `providePrism()` | The discovery view of the manifest: every component with its variants, states and parts, and every page. Use it to enumerate what to visit, see [Enumerating what exists](#enumerating-what-exists).                          |
| URL params `?component=<className>&variant=<index>&state=<index>`    | navigation state                | Drive the app to a specific component+variant from the outside. `variant` is the array index; omit it for index `0`. `state` is the index into the component's `states`; omit it for no state. See [Navigating](#navigating). |
| `[data-prism-rendered="<className>:<variantIndex>"]` on `.demo-wrap` | renderer host element           | Render marker. Wait for this attribute to match the expected key before inspecting the variant. While a component-level state is active the key ends in `:<stateIndex>`, see [Waiting for a render](#waiting-for-a-render).   |
| `[data-prism-excluded="<reason>"]` on `.demo-wrap`                   | renderer host element           | Set next to the render marker when the requested state is not part of what the canvas shows. A runner reports the cell as excluded instead of capturing it, see [A state that does not apply](#a-state-that-does-not-apply).  |
| `?capture=1`                                                         | URL param                       | [Capture isolation mode](#capture-isolation-mode): strips canvas chrome, hands the canvas the whole viewport and freezes the render for deterministic screenshots.                                                            |
| `[data-prism-capture]` on `<html>`                                   | document element                | Set while capture mode is on, see [Detecting it](#detecting-it).                                                                                                                                                              |

Services and pipes are not part of this contract, see [Pages without a canvas](#pages-without-a-canvas).

### Enumerating what exists

`__PRISM_MANIFEST__` is a thin discovery view of the runtime manifest and carries no Angular class references. Its shape is under [Discovery types](api/types.md#discovery-types).

```js
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined);
const manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);

// manifest.components -> [{ className: 'ButtonComponent', title: 'Button',
//                          variants: [{ name: 'Primary', index: 0, bg: 'light' }, ...],
//                          states: [{ name: 'Hover', index: 0, pseudo: { hover: true } }, ...] }]
// manifest.pages      -> [{ title: 'Button Patterns' }]
```

`title` is the `@Showcase` display name; `className` is the class, and the value of `?component=`. `components` lists exactly what renders on the canvas: no service, no pipe and no part. A component with no declared variants still reports one entry: `[{ name: 'Default', index: 0, bg: ... }]`.

What a runner reads from it besides the names:

- **`pseudo` on a variant:** the [pseudo states](guide/states.md#per-variant-pseudo-states) the variant forces, exactly as declared, e.g. `{ 'focus-visible': '.btn' }`, and omitted for a variant that forces none. Nothing has to act on it: the render marker waits for the states, and capture mode leaves room for their focus rings.
- **`states`:** the component-level [states](guide/states.md#states), one entry per declared slot, omitted when the component declares none. `index` is the position in the source, which is the `?state=` URL value and the last part of the render marker. `pseudo` holds the states it forces, as declared. A slot the scanner could not use is listed all the same with `pseudo: {}`, so the indices behind it keep their value. A component without `variants` lists its states next to the single `Default` variant, since that variant combines with each of them.
- **`states: false` on a variant:** the variant opted out of the component's states; every other variant has no `states` field. Whether a state fits a variant is not in the manifest, because that is only known once the variant renders. The render marker reports the cell then, see [A state that does not apply](#a-state-that-does-not-apply).
- **`parts`:** the [parts](guide/parts.md) of a component or directive (`@Showcase({ partOf })`, since 22.7.0), with the names a template binds their inputs and outputs by, omitted when there are none. They are experimental until 23.0.0: the shape may change in a 22.x minor release. A part is not in `components`: it has no page, no variants and no render marker of its own, because the variants of its parent render it, so a runner that walks `components` neither visits nor captures it. `?component=` with the class name of a part opens its parent.

```js
// component.states -> [{ name: 'Hover', index: 0, pseudo: { hover: true } },
//                      { name: 'Focus', index: 1, pseudo: { 'focus-visible': '.btn' } }]
// component.parts  -> [{ className: 'OptionComponent', title: 'Option', selector: 'lib-option',
//                        inputs: ['value', 'disabled'], outputs: ['selected'] }]
```

### Reading the background

Every variant reports the canvas background it renders on. A component may declare one for all its variants, and a variant may declare its own:

```ts
@Showcase({
  title: 'Button',
  bg: 'light', // applies to every variant below
  variants: [
    { name: 'Filled' },
    { name: 'On dark', bg: 'dark' }, // wins for this variant
  ],
})
```

`bg` is already resolved and always present, so a tool reads one field instead of reimplementing the fallback:

```js
// variants -> [{ name: 'Filled', index: 0, bg: 'light' },
//              { name: 'On dark', index: 1, bg: 'dark' }]
```

The resolution order is variant, then component, then [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults) of the config, then `transparent`. `@ng-prism/core/plugin` exports it as `resolveVariantBg()`, which takes the project's value as an optional third argument, alongside `DEFAULT_VARIANT_BG` (`'transparent'`) and the `CanvasBg` type. `transparent` means "nothing declared, and the project has set no default" and is captured without a backdrop. What each value paints, and which values follow the theme, is under [`bg`](api/showcase-config.md#bg).

[Capture mode](#capture-isolation-mode) paints this background, so the manifest value and the screenshot always agree. A runner that screenshots a variant on `transparent`, which includes every variant that declares nothing unless the config sets `showcaseDefaults.bg`, must pass `omitBackground: true`, or the browser's own page backdrop ends up in the image, see [Capturing transparency](guide/visual-regression.md#capturing-transparency).

### Reading `@Showcase` metadata

`meta` from the decorator is exposed on both levels, so a tool can decide how to treat a component or a single variant without a separate config file on its side. It is omitted when the decorator declares none.

```ts
@Showcase({
  title: 'Tooltip',
  variants: [
    // A tooltip only renders after hover, so a screenshot would capture the trigger.
    { name: 'Top Position', meta: { vrt: { skip: true } } },
    { name: 'Disabled' },
  ],
})
```

```js
const skip = (component, variant) => variant.meta?.['vrt']?.skip ?? component.meta?.['vrt']?.skip ?? false;
```

Build-time plugin hooks write into the same `meta`, so plugin output (for example the Coverage plugin's per-component numbers) is visible here too. An a11y report producer reads the [accepted violations](guide/accessibility.md#accepted-violations) from it, see [Writing a report](guide/a11y-reports.md#writing-a-report).

> Only JSON-safe values cross over. The global is read through a structured-clone bridge, and `meta` is an open `Record<string, unknown>`. Primitives, arrays and plain objects are passed through; class instances (Angular types included), functions, symbols, non-finite numbers, `Date`, `Map` and DOM nodes are dropped rather than half-serialised, and cycles are broken. Unrepresentable array entries become `null` so indices stay stable. Keep anything a tool must read to plain data.

### Navigating

Set `component` (and optionally `variant` and `state`) on the URL and load the page. `variant` is a 0-based index into the `variants` array; values outside the array are ignored and the app falls back to index `0`. `state` is a 0-based index into the `states` array of `@Showcase` (the position in the source, the same index the manifest and the render marker use); a value that is no index into it is ignored and no state is applied. It is read only next to `component`.

```js
const url = new URL(baseUrl);
url.searchParams.set('component', 'ButtonComponent');
url.searchParams.set('variant', '2');
url.searchParams.set('state', '1');
await page.goto(url.toString(), { waitUntil: 'load' });
```

- **Always name the component.** On a URL without `component`, `service`, `pipe` or `page`, or with a class name that is not in the manifest, the styleguide opens its first page, or its first component when it has no pages, so `.demo-wrap` is missing or shows another component than the one you wait for.
- **Leave `view` out.** `.demo-wrap` and its render marker exist on the Playground only. The [Overview](guide/styleguide-ui.md#the-overview) renders every variant at once and sets no marker.
- **Keep `urlState` on.** The styleguide reads these parameters only while [`urlState`](api/ng-prism-config.md#urlstate) is on, which is the default. With `urlState: false` it ignores them and opens its first entry; `capture` is read either way.

The full list of parameters is under [Links & State](guide/url-state.md).

### Waiting for a render

`data-prism-rendered` appears on `.demo-wrap` once the component instance has been created and, for a variant that forces [pseudo states](guide/states.md#per-variant-pseudo-states), once those states are in place:

```js
await page.waitForFunction(([expected]) => document.querySelector('.demo-wrap')?.getAttribute('data-prism-rendered')?.startsWith(expected), [`${comp.className}:`]);
```

> The marker means the component was instantiated; it may not be visually settled yet. Fonts may still be swapping and transitions may still be running when it appears. For anything pixel-sensitive, see [Visual Regression](guide/visual-regression.md#the-three-things-that-make-screenshots-flaky).

The value is `<className>:<variantIndex>`. While a component-level state (`@Showcase({ states })`) is active, it is `<className>:<variantIndex>:<stateIndex>`, where `stateIndex` is the position of the state in the `states` array, in source order, the same index the manifest and the URL use. Nothing changes without a state: the value stays exactly `<className>:<variantIndex>`, so a runner that waits for that exact value, or for a prefix of it, keeps working. A runner that wants a state waits for the full key:

```js
const key = `${comp.className}:${variantIndex}:${stateIndex}`;

await page.waitForSelector(`.demo-wrap[data-prism-rendered="${key}"]`);
```

The marker holds back until the state is in place on the rendered component, the same way it waits for a variant's own forced states. A variant that opted out of states (`states: false`) is keyed with the state index all the same, so the runner finds its cell.

### A state that does not apply

A state does not fit every variant. Rendering runs to the end either way and the marker is set, but `.demo-wrap` also carries `data-prism-excluded` with the reason, and nothing is forced for that state. A runner reads the attribute right after the marker appears and reports the cell as excluded, with that reason, instead of taking a picture of a component that is not in the state it asked for:

```js
const excluded = await page.locator('.demo-wrap').getAttribute('data-prism-excluded');

if (excluded !== null) {
    // Report the cell as excluded, with `excluded` as the reason, and take no screenshot.
}
```

The attribute is absent when no state is active, and when the state fits. Otherwise it holds the reason, such as `.btn is disabled` or `states: false`. The rule and every reason are under [When a state does not fit](guide/states.md#when-a-state-does-not-fit).

The answer is the one at the moment the marker appears. The app keeps the attribute current while you browse it, because it checks the state again whenever the component's DOM changes, but a runner should read it once, together with the marker, and capture on that state. A target that renders only later, behind `@defer` or after an HTTP call, is not there yet at that moment and reads as `<target> matches nothing`, the same limit every capture has for content that is not there yet.

## Capture Isolation Mode

Add `capture=1` to the URL to render in an isolated mode built for screenshotting:

```
http://localhost:4400/?component=ButtonComponent&variant=2&capture=1
```

Accepted as "on": `?capture`, `?capture=1`, `?capture=true`. Anything else, including `?capture=0` and `?capture=false`, is off.

While browsing, an element screenshot of `.demo-wrap` picks up whatever the canvas paints behind and around the component, and the pattern under it shifts whenever the component changes size, see [The three things that make screenshots flaky](guide/visual-regression.md#the-three-things-that-make-screenshots-flaky). Capture mode removes all of that and keeps what the variant declares. When active, ng-prism:

| Effect                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Strips the canvas pattern**     | Removes the dot grid and the checkerboard, whose phase moves when the component resizes. The background _colour_ stays opaque, except for `bg: 'transparent'`, whose colour is cleared along with the colour of every wrapper behind the canvas, so the capture carries a real alpha channel. An alpha channel has no phase, so that capture is just as deterministic. It needs `omitBackground: true` on the runner's side; see [Capturing transparency](guide/visual-regression.md#capturing-transparency).                                                      |
| **Keeps declared backgrounds**    | `@Showcase({ bg })` and a per-variant `bg` survive, so a variant is captured on the surface it was designed for; with neither declared it lands on `transparent` rather than on the session's canvas background. Either way the surface is the `bg` [reported for the variant](#reading-the-background). A background picked in the tools menu does not survive, because it is session UI state and not part of the variant.                                                                                                                                       |
| **Hides the canvas tools**        | The rulers, the crosshair, the pills, the handles and the dimension line of the viewport width, and the measuring tool with its pinned measurements are not shown. The measuring tool starts off and is not restored from a previous session, so a measurement never ends up in a baseline.                                                                                                                                                                                                                                                                        |
| **Gives the canvas the viewport** | Every shell region that is not the canvas (header, sidebar, component head with its view tabs, variant ribbon, the addon panel and its resizer, the floating canvas rail) is removed from layout, and the stage loses its padding and its edge, so the canvas fills the window. The rule is structural: a region a later release adds next to the canvas goes as well, so a change of the styleguide's chrome does not move a baseline. This makes the declared background cover all of `.demo-wrap`'s box; see [the guarantee](#the-guarantee-and-its-one-limit). |
| **Locks zoom to 1**               | Persisted canvas settings in `localStorage` (zoom, guides, rulers, measuring, background, viewport width) are neither read nor written. A stored [viewport width](guide/styleguide-ui.md#viewport-width) does not apply, so the component renders at the width of the canvas.                                                                                                                                                                                                                                                                                      |
| **Suppresses overlays**           | Panel overlays render _inside_ `.demo-wrap`; in capture mode they are not rendered and lazy overlay components are never even fetched.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Freezes motion**                | Transitions and animations are disabled document-wide, including inside your own component, via a document-level stylesheet. The text caret is hidden, and smooth scrolling is off.                                                                                                                                                                                                                                                                                                                                                                                |
| **Leaves room for focus rings**   | A capture that forces a state (a variant with its own [pseudo states](guide/states.md#per-variant-pseudo-states), or one whose active component-level state fits) gets 8px of padding around the component inside `.demo-wrap`, taken back out of layout with a negative margin, so a ring drawn outside the component's box is not cropped. See [Room for a focus ring](#room-for-a-focus-ring).                                                                                                                                                                  |
| **Skips state restore**           | `sessionStorage` state (control-panel input overrides, a11y sub-tab, the simulation) is not restored, so a previous session cannot alter what you capture.                                                                                                                                                                                                                                                                                                                                                                                                         |

The active state applies in capture mode, because it addresses the cell like the variant does. The toggles of the tools menu's **State** group are ignored, like the background picked there: what is captured is what the variant declares, plus the state in the URL.

The [Simulate](guide/styleguide-ui.md#simulate) group of the tools menu is ignored as well, whether it comes from the session or from the URL parameters `motion`, `scheme`, `forced` and `vision`: a capture never simulates, so it shows the component under the conditions of the browser that runs it. To capture under a condition, emulate it in that browser, for example with Playwright's `page.emulateMedia({ colorScheme: 'dark' })`.

The mode is a single switch with nothing else to configure, so a CI job can use it on a prebuilt styleguide it cannot reconfigure.

### Room for a focus ring

`.demo-wrap` hugs the component's box, but a focus ring is usually drawn outside it: an `outline` with an `outline-offset`, or a `box-shadow` halo. A screenshot of the bare box would crop exactly the thing under test. For a capture that forces a state, `.demo-wrap` therefore gets 8px of padding on every side, taken back out of layout with a negative margin of the same size. The component keeps its position and its size, and the screenshot grows by 16px in each direction.

- **Only captures that force a state get it:** a variant with its own `pseudo`, or a combination whose state fits. A variant captured without a state keeps its box, so no existing baseline moves when you add `pseudo` or `states`. A state that is excluded forces nothing and adds no room. The room is keyed on `.demo-wrap[data-pseudo]`, which lists the forced states.
- **A `stretch` variant** keeps its width as long as its clamp at 800px applies, that is from a viewport of 816px up. Below that it gives up the 16px, so the room stays inside the canvas.
- **A ring wider than 8px** still gets cropped. Clip the page screenshot yourself in that case, from the component's bounding box widened by the ring, instead of screenshotting `.demo-wrap`.

### Detecting it

While active, the document element carries a marker attribute:

```js
await page.evaluate(() => document.documentElement.hasAttribute('data-prism-capture'));
```

You can hook your own rules onto it, for example to neutralise something specific to your library:

```css
[data-prism-capture] .my-lib-live-clock {
    visibility: hidden;
}
```

### It is read once, and never written back

The flag is parsed from the URL a single time when the app boots. ng-prism rebuilds the query string from scratch whenever navigation state changes, so `capture=1` disappears from the address bar on the first in-app navigation while the mode itself stays on for the lifetime of the document.

Consequences for tooling:

- Navigating with a full page load per variant (the normal pattern) works as expected. Pass `capture=1` on every URL.
- Driving navigation in-page (clicking the sidebar, pushing history) keeps capture mode on, but the URL no longer advertises it. Do not read the mode back off `window.location`; use the `data-prism-capture` attribute instead.
- **Reloading after in-page navigation drops the mode.** `page.reload()`, or navigating to a URL derived from `page.url()`, replays an address the flag has already been stripped from, so the document boots without it and renders with the full shell. Nothing errors and the screenshot still looks plausible, so the recorded baseline is contaminated. Keep `capture=1` in the URL your runner holds instead of reading the one the app shows.

### The guarantee, and its one limit

Capture mode guarantees that `.demo-wrap` is composited against its declared background over its whole box, including the part that would scroll out of the canvas while browsing. That is why a runner can screenshot `.demo-wrap` directly instead of reconstructing the component's bounds.

The shell matters even though it sits outside `.demo-wrap`. The component is centred in a canvas that scrolls, and a screenshot tool captures the screen coordinates of the target's whole box, so wherever the box extends past the canvas, the image picks up whatever paints there. This is not a z-order or clipping problem: the target does extend beyond its scroll container. The same mistake is easy to make in CSS of your own that hides parts of the page for a screenshot.

The limit: capture mode cannot make room the window does not have. The canvas is the viewport, so a component larger than the viewport still overflows it, and the overflowing part is composited against whatever lies outside the canvas. Size the runner's viewport to the largest variant you baseline.

### What it does not change

Your component is instantiated with the same inputs, in the same injector and in the same document as while browsing. The shell regions capture mode drops are removed from layout but stay mounted, and nothing about the component's own box depends on them. A view with no canvas at all (a [component page](guide/component-pages.md), a plugin view panel) renders as usual; the guarantee is about the canvas, and blanking the shell around a page would only produce an empty screenshot.

There is no mode that strips the shell for embedding: [`headless`](api/ng-prism-config.md#headless) was meant for that, never had an effect and is deprecated since 22.6.0, removed in 23.0.0.

## Pages without a canvas

A [service](guide/services-and-pipes.md#services) or [pipe](guide/services-and-pipes.md#pipes) page is documentation without a canvas: it has no variants, no `.demo-wrap` and nothing a visual regression runner should capture. Neither appears in `__PRISM_MANIFEST__`, whose `components` lists exactly what renders, and `?component=` never selects one. A service has its own URL parameter, `?service=<className>`, and a pipe `?pipe=<className>`, for deep links into the styleguide, see [Links & State](guide/url-state.md).

To look at an API page from the outside anyway, for example to check what a class's JSDoc renders to, open it with `view=jsdoc` and wait for the attribute that [`@ng-prism/plugin-jsdoc`](plugins/jsdoc.md) (since 22.7.0) sets on the page element once the page for that class is in the DOM:

| Page                                | URL                                 | Wait for                                        |
| ----------------------------------- | ----------------------------------- | ----------------------------------------------- |
| Service                             | `?service=<className>&view=jsdoc`   | `[data-prism-service-rendered="<className>"]`   |
| Pipe                                | `?pipe=<className>&view=jsdoc`      | `[data-prism-pipe-rendered="<className>"]`      |
| API tab of a component or directive | `?component=<className>&view=jsdoc` | `[data-prism-component-rendered="<className>"]` |

Exactly one of the three attributes is set, the one that fits the page. The element is also the page's scroll container. The showcase skill's screenshot script does this with `--service <ClassName>` and `--pipe <ClassName>`, see [AI Coding Agents](guide/ai-agents.md#checking-in-the-browser).

`data-prism-component-rendered` is not the render marker of the canvas. It marks a page of documentation, not a rendered variant, so a visual regression runner keeps waiting for `data-prism-rendered` on `.demo-wrap`, and a component's API page is not a cell to capture.

## Related

- [Visual Regression](guide/visual-regression.md): capturing and comparing screenshots
- [A11y Reports](guide/a11y-reports.md): producing an `a11y-report.json` with an external audit
- [Audits in CI](guide/ci.md): running both in a pipeline
- [States & Pseudo States](guide/states.md#screenshot-runners): states in a screenshot runner
- [Links & State](guide/url-state.md): the full URL parameter list
- [Types](api/types.md#discovery-types): the shape of `__PRISM_MANIFEST__`
