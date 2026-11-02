# External Tooling API

A built Prism app is a static site. That makes it a convenient target for tools that drive it from the outside: accessibility audits, visual regression runners, link checkers, screenshot generators for a design system site.

ng-prism exposes a small, stable contract for those tools. This page is the canonical reference for it; the [Accessibility](guide/accessibility.md) and [Visual Regression](guide/visual-regression.md) guides build on it.

> These anchors are public API. They are covered by the same semver policy as the TypeScript surface, so renaming `.demo-wrap` or `data-prism-rendered` is a breaking change.

## The Anchors

| Anchor                                                               | Where                           | Purpose                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.__PRISM_MANIFEST__`                                          | global, set by `providePrism()` | Shape: `{ components: [{ className, title, meta?, variants: [{ name, index, bg, meta?, pseudo?, states? }], states?: [{ name, index, pseudo }], parts?: [{ className, title, selector, inputs, outputs }] }], pages: [{ title }] }`. Use it to enumerate what to visit. |
| URL params `?component=<className>&variant=<index>&state=<index>`    | navigation state                | Drive the app to a specific component+variant from the outside. `variant` is the array index; omit it for index `0`. `state` is the index into the component's `states`; omit it for no state.                                                                          |
| `[data-prism-rendered="<className>:<variantIndex>"]` on `.demo-wrap` | renderer host element           | Render marker. Wait for this attribute to match the expected key before inspecting the variant. While a component-level state is active the key ends in `:<stateIndex>`, see [Waiting for a render](#waiting-for-a-render).                                             |
| `[data-prism-excluded="<reason>"]` on `.demo-wrap`                   | renderer host element           | Set next to the render marker when the requested state is not part of what the canvas shows. A runner reports the cell as excluded instead of capturing it, see [A state that does not apply](#a-state-that-does-not-apply).                                            |
| `?capture=1`                                                         | URL param                       | [Capture isolation mode](#capture-isolation-mode): strips canvas chrome, hands the canvas the whole viewport and freezes the render for deterministic screenshots.                                                                                                      |

> **Services and pipes are not part of this contract.** A [service](guide/showcasing-services.md) or [pipe](guide/showcasing-pipes.md) page is documentation without a canvas: it has no variants, no `.demo-wrap` and nothing a visual regression runner should capture. Neither appears in `__PRISM_MANIFEST__`, whose `components` lists exactly what renders. Before 22.7.0 a showcased service or pipe was listed there as a component that never rendered; from 22.7.0 a runner no longer sees it, see [Breaking changes and deprecations in 22.7.0](guide/migration-v22.md#breaking-changes-and-deprecations-in-2270). `?component=` never selects one. A service has its own URL parameter, `?service=<className>`, and a pipe `?pipe=<className>`, for deep links into the styleguide, see [State Preservation](guide/url-state.md).
>
> To look at a service's API page from the outside, for example to check its JSDoc, open `?service=<className>&view=jsdoc` and wait for `[data-prism-service-rendered="<className>"]`. For a pipe it is `?pipe=<className>&view=jsdoc` and `[data-prism-pipe-rendered="<className>"]`. The API tab of a component or directive is the same page, and for it it is `?component=<className>&view=jsdoc` and `[data-prism-component-rendered="<className>"]`. `@ng-prism/plugin-jsdoc` (since 22.7.0) sets that attribute on the page element once the page for that class is in the DOM; the element is also the page's scroll container. Exactly one of the three attributes is set, the one that fits the page. The showcase skill's screenshot script does this with `--service <ClassName>` and `--pipe <ClassName>`.
>
> `data-prism-component-rendered` is not the render marker of the canvas. It marks a page of documentation, not a rendered variant, so a visual regression runner keeps waiting for `data-prism-rendered` on `.demo-wrap`, and a component's API page is not a cell to capture.

### Enumerating what exists

`__PRISM_MANIFEST__` is a thin discovery view of the runtime manifest and carries no Angular class references.

```js
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => globalThis.__PRISM_MANIFEST__ !== undefined);
const manifest = await page.evaluate(() => globalThis.__PRISM_MANIFEST__);

// manifest.components -> [{ className: 'ButtonComponent', title: 'Button',
//                          variants: [{ name: 'Primary', index: 0, bg: 'light' }, ...],
//                          states: [{ name: 'Hover', index: 0, pseudo: { hover: true } }, ...] }]
// manifest.pages      -> [{ title: 'Button Patterns' }]
```

`title` is the `@Showcase` display name; `className` is the class. A component with no declared variants still reports one entry: `[{ name: 'Default', index: 0, bg: ... }]`.

A variant that forces [pseudo states](guide/states.md#per-variant-pseudo-states) reports them as `pseudo`, exactly as declared, e.g. `{ 'focus-visible': '.btn' }`. The field is omitted for a variant that forces none. Nothing has to act on it: the render marker waits for the states, and capture mode leaves room for their focus rings, see [Forced pseudo states](guide/visual-regression.md#forced-pseudo-states).

A component that declares `states` in `@Showcase` lists them as `states`, one entry per declared slot, with `index` being the position in the source, which is the `?state=` URL value and the last part of the render marker, see [Waiting for a render](#waiting-for-a-render). `pseudo` holds the states it forces, as declared. A slot the scanner could not use is listed all the same with `pseudo: {}`, so the indices behind it keep their value. The field is omitted when the component declares no states. A component without `variants` lists its states next to the single `Default` variant, since that variant combines with each of them.

```js
// component.states -> [{ name: 'Hover', index: 0, pseudo: { hover: true } },
//                      { name: 'Focus', index: 1, pseudo: { 'focus-visible': '.btn' } }]
```

A variant that opted out with `states: false` reports `states: false`, and every other variant has no `states` field. Whether a state fits a variant is not in the manifest, because that is only known once the variant renders. The cell is then reported by the render marker, see [A state that does not apply](#a-state-that-does-not-apply).

A component or directive with [parts](guide/parts.md) (`@Showcase({ partOf })`, since 22.7.0) lists them as `parts`, and the field is omitted when there are none. A part is not in `components`: it has no page, no variants and no render marker of its own, because the variants of its parent render it, so a runner that walks `components` neither visits nor captures it. The parts are in the order of the parent's page, sorted by title. `inputs` and `outputs` are the names a template binds by, the `alias` where the class declares one and the member name otherwise. `outputs` ends with the change output Angular adds for each `model()` input, `selectedChange` for `selected = model(false)`.

```js
// component.parts -> [{ className: 'OptionComponent', title: 'Option', selector: 'lib-option',
//                       inputs: ['value', 'disabled'], outputs: ['selected'] }]
```

The types are exported as `DiscoveryManifest`, `DiscoveryComponent`, `DiscoveryVariant`, `DiscoveryState`, `DiscoveryPart` and `DiscoveryPage` from `@ng-prism/core/plugin`. `DiscoveryPart` and `DiscoveryComponent.parts` are experimental until 23.0.0: the shape may change in a 22.x minor release.

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

The resolution order is variant, then component, then `transparent` (exported as `DEFAULT_VARIANT_BG` from `@ng-prism/core/plugin`, alongside the `CanvasBg` type and `resolveVariantBg()`). `transparent` means "nothing declared" and is captured without a backdrop. It was `checker` in `22.2.0-beta.0` and `-beta.1`; see [the note on the change](guide/visual-regression.md#breaking-the-default-background-changed).

> [Capture mode](#capture-isolation-mode) paints this background, so the manifest value and the screenshot always agree.

The default has no colour, so it cannot pick one up from the active theme. A runner that screenshots an undeclared variant must pass `omitBackground: true`, or the browser's own page backdrop ends up in the image; see [Capturing transparency](guide/visual-regression.md#capturing-transparency).

When a variant needs a specific surface, declare it. `light` and `dark` are absolute colours (`--prism-void-light`, `--prism-void-dark`) and flat, so use one when the component was built for that surface. `dots`, `plain` and `checker` all land on the themed surface, so a capture on one of them is only as stable as the theme.

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

Build-time plugin hooks write into the same `meta`, so plugin output (for example the Coverage plugin's per-component numbers) is visible here too.

An a11y report producer reads the [accepted violations](guide/accessibility.md#accepted-violations) the same way. The acceptances of a variant are the component's and the variant's own, matched by the axe rule id, as the live audit applies them:

```js
const accepted = (component, variant) => [...(component.meta?.['a11y']?.accept ?? []), ...(variant.meta?.['a11y']?.accept ?? [])];
const counts = (violation, component, variant) => !accepted(component, variant).some((a) => a.rule === violation.id);
```

Once a report lists a component, the build adds its entry (`found`, `score`, `summary`) to the component's `meta.a11y` next to `accept`, so a producer that reads a styleguide built with an earlier report still finds the acceptances.

> Only JSON-safe values cross over. The global is read through a structured-clone bridge, and `meta` is an open `Record<string, unknown>`. Primitives, arrays and plain objects are passed through; class instances (Angular types included), functions, symbols, non-finite numbers, `Date`, `Map` and DOM nodes are dropped rather than half-serialised, and cycles are broken. Unrepresentable array entries become `null` so indices stay stable. Keep anything a tool must read to plain data.

### Navigating

Set `component` (and optionally `variant` and `state`) on the URL and reload. `variant` is a 0-based index into the `variants` array; values outside the array are ignored and the app falls back to index `0`. `state` is a 0-based index into the `states` array of `@Showcase` (the position in the source, the same index the manifest and the render marker use); a value that is no index into it is ignored and no state is applied. It is read only next to `component`.

```js
const url = new URL(baseUrl);
url.searchParams.set('component', 'ButtonComponent');
url.searchParams.set('variant', '2');
url.searchParams.set('state', '1');
await page.goto(url.toString(), { waitUntil: 'load' });
```

> On a bare URL with no `component` or `page` parameter, nothing is selected and `.demo-wrap` does not exist. Always navigate to a component before waiting for the render marker.

### Waiting for a render

`data-prism-rendered` appears on `.demo-wrap` once the component instance has been created and, for a variant that forces [pseudo states](guide/states.md#per-variant-pseudo-states), once those states are in place:

```js
await page.waitForFunction(([expected]) => document.querySelector('.demo-wrap')?.getAttribute('data-prism-rendered')?.startsWith(expected), [`${comp.className}:`]);
```

> The marker means the component was instantiated; it may not be visually settled yet. Fonts may still be swapping and transitions may still be running when it appears. For anything pixel-sensitive, see [Visual Regression](guide/visual-regression.md).

The value is `<className>:<variantIndex>`. While a component-level state (`@Showcase({ states })`) is active, it is `<className>:<variantIndex>:<stateIndex>`, where `stateIndex` is the position of the state in the `states` array, in source order, the same index the manifest and the URL use. Nothing changes without a state: the value stays exactly `<className>:<variantIndex>`, so a runner that waits for that exact value, or for a prefix of it, keeps working. A runner that wants a state waits for the full key:

```js
const key = `${comp.className}:${variantIndex}:${stateIndex}`;

await page.waitForSelector(`.demo-wrap[data-prism-rendered="${key}"]`);
```

The marker holds back until the state is in place on the rendered component, the same way it waits for a variant's own forced states. A variant that opted out of states (`states: false`) is keyed with the state index all the same, so the runner finds its cell.

#### A state that does not apply

A state does not fit every variant. Rendering runs to the end either way and the marker is set, but `.demo-wrap` also carries `data-prism-excluded` with the reason, and nothing is forced for that state. A runner reads the attribute right after the marker appears and reports the cell as excluded, with that reason, instead of taking a picture of a component that is not in the state it asked for:

```js
const excluded = await page.locator('.demo-wrap').getAttribute('data-prism-excluded');

if (excluded !== null) {
    // Report the cell as excluded, with `excluded` as the reason, and take no screenshot.
}
```

The attribute is absent when no state is active, and when the state fits. Otherwise it holds one of these reasons, where `<target>` is the selector the state forces (a list reads as its selectors joined with `, `), or `the component` when it forces the whole component:

| Reason                              | Why                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `states: false`                     | The variant opts out of component-level states. The state stays in the URL, but is not applied.                                    |
| `forces no state`                   | The state declares no pseudo-class to force, for example because the scanner could not evaluate it.                                |
| `<target> matches nothing`          | Nothing in the rendered component matches the selector.                                                                            |
| `<target> is disabled`              | A `focus` or `focus-visible` state, and no match can take focus, at least one of them being disabled.                              |
| `<target> is inert`                 | A `focus` or `focus-visible` state, and no match can take focus, none being disabled but all under `[inert]` within the component. |
| `<target> has pointer-events: none` | A `hover` or `active` state, and every match, and everything inside it, ignores the pointer.                                       |

When a state forces several pseudo-classes, the reason names the first one that cannot be reached. The state fits only if each of them can. For a `focus` or `focus-visible` state on `the component`, the matches are what in it could take focus at all (a button, a field, a link with `href`, `[tabindex]` and the like), so a component whose only button is disabled reads `the component is disabled`.

The answer is the one at the moment the marker appears. The app keeps the attribute current while you browse it, because it checks the state again whenever the component's DOM changes, but a runner should read it once, together with the marker, and capture on that state. A target that renders only later, behind `@defer` or after an HTTP call, is not part of that moment, and the state reads as `<target> matches nothing`. That is the same limit every capture has for content that is not there yet; see the note above on the marker meaning "instantiated".

## Capture Isolation Mode

Element-scoped screenshots composite whatever is painted behind and inside the target element. For `.demo-wrap` that means the canvas dot grid, rulers, the zoom badge, the centre crosshair and any active panel overlay all end up in the image. And because the component is centred, the grid phase beneath it shifts whenever the component changes size, so an unrelated size change makes every pixel under the component differ.

The background colour does not cause that problem, and a variant that declares `bg: 'dark'` needs that surface in its baseline. Capture mode therefore removes the pattern and keeps the colour.

An alpha channel, unlike a pattern, has no phase that moves when the component resizes, so `bg: 'transparent'` can be captured see-through and still be deterministic. See [Capturing transparency](guide/visual-regression.md#capturing-transparency).

Add `capture=1` to the URL to render in an isolated mode built for screenshotting:

```
http://localhost:4200/?component=ButtonComponent&variant=2&capture=1
```

Accepted as "on": `?capture`, `?capture=1`, `?capture=true`. Anything else, including `?capture=0` and `?capture=false`, is off.

When active, ng-prism:

| Effect                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strips canvas patterns**        | Removes the dot grid and the checkerboard, plus rulers, crosshair, zoom badge, background pill and the measure overlay. The measure overlay sits behind the same `@if (!capture.active())` guard as the others, and its toggle defaults off and is never restored from `localStorage` in capture mode, so a session that had it on cannot leak into a baseline. The pin row below the canvas disappears by a different route: it has no capture guard of its own, because `CAPTURE_CANVAS_ONLY_SELECTOR` (see **Gives the canvas the viewport** below) removes every child of `.prism-canvas-wrap` that does not contain the stage, and the pin row is such a child. The background _colour_ stays opaque, except for `bg: 'transparent'`, whose colour is cleared along with the colour of every wrapper behind the canvas, so the capture carries a real alpha channel. That one needs `omitBackground: true` on the runner's side; see [Capturing transparency](guide/visual-regression.md#capturing-transparency). |
| **Keeps declared backgrounds**    | `@Showcase({ bg })` and a per-variant `bg` survive, so a variant is captured on the surface it was designed for; with neither declared it lands on `DEFAULT_VARIANT_BG` rather than on the session's canvas background. Either way the surface is the `bg` [reported for the variant](#reading-the-background). A manual user override does not survive, because it is session UI state and not part of the variant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Gives the canvas the viewport** | Every shell region that is not the canvas (header, sidebar, view tabs, component head, variant ribbon, the addon panel and its resizer, the floating canvas rail) is removed from layout, and the stage loses its padding, so the canvas fills the window. This makes the declared background cover all of `.demo-wrap`'s box; see [the guarantee](#the-guarantee-and-its-one-limit).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Locks zoom to 1**               | Persisted canvas state in `localStorage` (zoom, guides, rulers, measure, background) is neither read nor written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Suppresses overlays**           | Panel overlays render _inside_ `.demo-wrap`; in capture mode they are not rendered and lazy overlay components are never even fetched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Freezes motion**                | Transitions and animations are disabled document-wide, including inside your own component, via a document-level stylesheet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Leaves room for focus rings**   | A variant that forces [pseudo states](guide/states.md#per-variant-pseudo-states), or whose active component-level state fits, gets 8px of padding around the component inside `.demo-wrap`, taken back out of layout with a negative margin, so a ring drawn outside the component's box is not cropped. The component keeps its position and size; every other variant keeps its box, and so does one whose state is excluded, since nothing is forced there. The active state applies in capture mode, because it addresses the cell like the variant does; the tools menu's state toggle is ignored, like the background override. See [Forced pseudo states](guide/visual-regression.md#forced-pseudo-states).                                                                                                                                                                                                                                                                                                     |
| **Skips state restore**           | `sessionStorage` state (control-panel input overrides, a11y sub-tab) is not restored, so a previous session cannot alter what you capture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

The mode is a single switch with nothing else to configure, so a CI job can use it on a prebuilt styleguide it cannot reconfigure.

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

Until 22.2.0-beta.4 the shell was left in place, on the assumption that it "sits outside `.demo-wrap` and never appears in an element-scoped screenshot". The same mistake is easy to make in your own CSS. The component is centred in a canvas that scrolls, and a screenshot tool captures the screen coordinates of the target's whole box, so wherever the box extends past the canvas, the image picks up whatever paints there. Measured in Chromium at a 1280x720 viewport, a 200x400 component leaked 57px upwards into the variant ribbon and 121px downwards into the addon panel. This is not a z-order or clipping problem: the target does extend beyond its scroll container.

The limit: capture mode cannot make room the window does not have. The canvas is the viewport, so a component larger than the viewport still overflows it, and the overflowing part is composited against whatever lies outside the canvas. Size the runner's viewport to the largest variant you baseline.

### What it does not change

Your component is instantiated with the same inputs, in the same injector, at the same zoom, in the same document. The shell regions capture mode drops are removed from layout but stay mounted, and nothing about the component's own box depends on them. A view with no canvas at all (a [component page](guide/component-pages.md), a plugin view panel) renders as usual; the guarantee is about the canvas, and blanking the shell around a page would only produce an empty screenshot.

There is no mode that strips the shell for embedding: `headless` was planned for that, never had an effect and is deprecated (see [Custom UI Sections](guide/custom-ui.md)).

## Related

- [Accessibility](guide/accessibility.md): producing an `a11y-report.json` with an external audit
- [Visual Regression](guide/visual-regression.md): capturing and comparing screenshots
- [State Preservation](guide/url-state.md): the full URL parameter list
