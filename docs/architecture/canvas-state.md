# Canvas State

The canvas (`PrismRendererComponent`) is governed by cooperating services with distinct responsibilities: durable preferences, the effective background, the forced pseudo states, the measurements and the simulation. This page describes how they work, for contributors. What a user sees and does is under [Tour of the UI](guide/styleguide-ui.md) and [Measuring](guide/measuring.md).

## `PrismCanvasService`

Holds the user's globally persisted canvas preferences:

- `bg`: global default canvas background (any `CanvasBg`: `dots | plain | light | dark | checker | transparent`), `'dots'` until the user picks one
- `bgChosen`: whether the user picked `bg` (`setBg()`), persisted with it. The value alone cannot tell the default `dots` from a picked one, and only a background nobody picked follows a simulated color scheme (see [Simulation](#simulation)). Storage written without the flag counts any value but `dots` as picked. Only `setBg()` writes it, always `true`, so there is no way back to unpicked
- `zoom`, `guides`, `rulers`: set from the floating canvas rail; guides and rulers are toggle buttons on the rail itself, zoom is a chooser in the rail's tools menu
- `measure`: whether the measuring tool is on, a toggle button on the rail. It lives here rather than in `PrismMeasureService` because it is the same kind of state as `guides` and `rulers`, a preference about the working environment, not a statement about the variant. The measurements themselves are in `PrismMeasureService`, see [Measuring](#measuring).
- `viewportWidth`: `number | null`; the width `.demo-wrap` is constrained to, or `null` for unconstrained. Toggled from the rail, set from the **Width** chooser in the tools menu, and dragged from the grips at either edge of the constrained area. `toggleViewport()` restores the last width of the session, a field that is not persisted and starts at `VIEWPORT_DEFAULT` (390).

State is persisted to `localStorage` under the key `ng-prism-canvas`. This is the source of truth for the user's preferred working environment across sessions. In capture mode the service neither reads nor writes it: the field defaults stay (zoom 1, no guides, no rulers, measuring off, no viewport width), and `save()` is a no-op, so a capture run neither inherits nor overwrites a stored preference.

## `PrismVariantBgService`

Computes the actually-applied canvas background by resolving a fallback chain:

```
recommended = variant.bg ?? component.bg
effective   = override ?? recommended ?? (bgChosen ? canvas.bg() : schemeGround) ?? canvas.bg()   // browsing
effective   = recommended ?? DEFAULT_VARIANT_BG           // capture mode ('transparent')
```

- `recommended`: computed from the active component and variant (`Variant.bg` wins over `ShowcaseConfig.bg`), `null` when neither declares one
- `schemeGround`: `PrismSimulationService.schemeGround()`, `light` or `dark` while the simulation emulates a color scheme, else `null`; the browsing chain is `playgroundGround()` (`simulate/ground.ts`)
- `override`: read-only view of a transient signal; set when the user picks a background from the tools menu's **Background** group while a recommendation is active
- `effective`: the final `CanvasBg` value bound to the `data-bg` attribute of `.prism-canvas-stage`. Capture mode ignores the override and the simulation, which are session UI state, and uses `DEFAULT_VARIANT_BG` where nothing is declared instead of `canvas.bg()`: `dots` paints a theme token, so a baseline would depend on the runner's theme. `DEFAULT_VARIANT_BG` is also what the discovery manifest reports, so the reported and the captured background cannot drift apart.
- `isDeviating`: computed boolean; true when the override is non-null AND differs from the current recommendation. It shows the `Recommended: <bg> [Reset]` pill (`PrismCanvasBgPillComponent`), whose button calls `clearOverride()`.

The override auto-clears whenever the active variant or component changes, so navigating back to a variant always shows its recommendation again.

The **Background** group of the tools menu is a readout of this service as well: the filled chip (`is-on`) is `effective()`, and the chip of `recommended()` carries `is-rec`, a border in the primary colour. Each chip's swatch carries `data-bg`, painted by the same `CANVAS_BG_STYLES` as the stage, which the toolbar includes in its `styles`. A click writes the override when `recommended()` is non-null and otherwise `canvas.setBg()`, the persisted default.

The shell also binds `canvasOverlayTokens(overlayGround(effective(), simulation.forcedPalette()))` (`canvas/canvas-overlay-tokens.ts`, `simulate/ground.ts`) on `.prism-canvas-wrap`. On `light` and `dark` these set the `--prism-canvas-overlay-*` tokens to fixed values, so the rail, the pills, the pin row and the rulers follow the ground rather than the theme; on the other grounds they are left to the theme, see [Canvas overlays](guide/theming.md#canvas-overlays). Under simulated forced colors `overlayGround()` answers the palette (`light` or `dark`), since the stage paints the palette's `Canvas` then, whatever `effective()` is.

### Why a separate service?

`PrismCanvasService` owns durable user preferences; `PrismVariantBgService` owns the transient, computed effective state. Keeping them separate preserves the user's global default when they temporarily deviate within a single variant.

## `PrismPseudoStateService`

Decides which pseudo states the canvas forces, following the same pattern as the background. The addressed cell is a variant and, optionally, a component-level state (`ShowcaseConfig.states`), and both bring pseudo states of their own. The service keeps them in two layers, because only the state's is subject to the fit rule:

```
base  = variant.pseudo, with the user's toggles on top
state = the active state's pseudo, with the user's toggles on top
```

Capture mode skips the toggles: both layers are what is declared.

- `declared`: `Variant.pseudo` of the active variant, or `null`
- `activeState`: the `ShowcaseState` at `PrismRendererService.activeStateIndex`, or `null`. The index is part of the addressed cell next to `activeVariantIndex`. `selectVariant()` sets it back to `null`, so a state never follows the user to another variant unnoticed, and so do a component change and a refresh that leaves the component with fewer states than the index. Whatever addresses a whole cell, an Overview cell or the URL restore, selects the state after the variant. A state slot the scanner could not evaluate (`pseudo: {}`) is still an active state, with an empty layer.
- `stateExclusion`: `'states: false'` while a state is active and the active variant opts out with `Variant.states: false`, else `null`. The state layer is `null` then, and the state declares nothing.
- `override`: transient per-state toggles from the tools menu's **State** group. `true` adds a state on the whole component, `false` switches off one the variant or the state declares. Cleared whenever the active variant, the active state or the component changes, and ignored in capture mode, because session UI state must not shape a baseline. The active state, in contrast, applies in capture mode: it addresses the cell.
- `layers`: `{ base, state }`, computed by `splitLayers()`. A toggle switched off takes the state out of both layers. A toggle switched on leaves a target the variant or the state declares in its own layer, and otherwise forces the state on the whole component in `base`, where the fit rule does not reach it. A state that does not fit is not applied, so it does not count as declaring anything here: `splitLayers()` takes a `stateFits` flag, and with `false` a class only the state declares is forced on the whole component by the toggle. The state layer is the same either way, since the marker still needs it to see when the state fits again. The state layer is `null` when no state applies or when the toggles have switched off every class the state declares, so a deliberate toggle never reads as a state that forces nothing. A state that declares nothing itself (a slot the scanner could not evaluate) stays an empty object, which the marker reports as not fitting. While nothing is toggled both layers are the declared objects themselves, not copies, because the render marker compares by identity (below).
- `canvasFit`: whether the active state fits the rendered canvas, a `StateFit` the renderer writes from its marker, `null` while no state is applied. `isForced()` counts a class of the state layer only while `canvasFit()?.fits`, and `isDeclared()` counts the classes of the variant, and those of the active state while it fits (`canvasFit` still `null` before the first render counts as fitting), so the tools menu can mark both.

The service also owns the document's `PseudoStyleSheets`, which every marker shares, so each stylesheet is rewritten once whether the Playground or an Overview cell forces a state first.

The tools menu's **State** group reads the service. Its chips come from `buildStateChips()` (`canvas/state-chips.ts`), at most one on; a click calls `PrismRendererService.selectState()`, and a click on the active chip passes `null`. Whether each state fits is `chipFits()`: the canvas's own `canvasFit` for the active state, `evaluateStateFit()` against the rendered element for the others, re-measured after every render, so a chip and the canvas cannot disagree. A chip that does not fit gets `is-na` and stays selectable. The toggles below bind `is-on` to `isForced()` and `is-rec` to `isDeclared()`, mirroring the Background group.

### Markers

A `PseudoStateMarker` forces states on one rendered component: it puts the stand-in classes (`prism-pseudo--<state>`) on the targeted elements and holds the shared stylesheets while it does, which widens every selector using one of the pseudo-classes in place, `:hover` to `:is(:hover, .prism-pseudo--hover)`. The rule keeps its position and its specificity, and without the class it matches exactly what it matched before. A copy keyed on the class was the first design and is wrong for negation: the copy of `.row:not(:hover) .actions` matches every row without the class, a really hovered one included. A `MutationObserver` on the component re-marks elements rendered later and follows elements whose classes or attributes make them start or stop matching a selector. `PseudoStyleSheets` watches `document.head` only while some marker holds it.

The marker takes the two layers separately, `apply(root, states, state?)`. `states` is forced as given, the way `Variant.pseudo` always was. `state` is forced only where it fits (`evaluateStateFit()` in `pseudo/state-fit.ts`): every one of its pseudo-classes needs a reachable target, and only the reachable targets get the class. Every pass measures the same DOM, whatever the previous pass left: it first puts the variant's classes and the state's on all of the state's targets at once, then evaluates the fit and the reach, then takes the state's class off the targets that cannot be reached, or off all of them when the state does not fit. The first pass, which `data-prism-rendered` waits for, therefore marks what any later one would, a target revealed by another forced hover counts, and a rule that sets `pointer-events: none` under its own `:hover` reads as not fitting. The records of these writes are dropped (`takeRecords()`), so a pass never sets off another. The fit is evaluated again on every pass the component's own DOM changes set off, so a control that removes a target (`removable` on a chip) flips it. `applied()` reports the exact `states` and `state` objects it was given, plus the `fit` (`null` without a state), which is how `PrismPseudoStateService.canvasFit` gets its value.

The renderer has one marker for the canvas. An effect applies the two layers to the rendered host element, `apply(element, layers().base, layers().state)`. A second effect writes `marker.applied()?.fit ?? null` to `canvasFit`, and only that: it never reads `canvasFit` back, and the value is `null` whenever no state layer is applied, so the fit of the previous state cannot linger. `layers` has an `equal` that compares `base` and `state`, so the override reset that every variant, state or component change triggers (it writes a fresh `{}`) does not re-apply the marker for the same two objects.

`renderedKey` withholds `data-prism-rendered` while the base forces something or a state layer is set, until `marker.applied()` reports that exact element and those exact `states` and `state` objects (`resolveRenderedKey()` in `renderer/rendered-key.ts`). The key is `<className>:<variantIndex>`, with `:<stateIndex>` appended while a state is active, an opted-out variant included (its state layer is `null`, the index is in the key regardless). A variant that forces nothing and has no state layer is not held back. `excludedReason`, `resolveExcludedReason()` in the same file, is the value of `data-prism-excluded`: `stateExclusion` while the variant opts out, else the `reason` of the marker's `fit` when it does not fit, else `null`, and always `null` without an active state. `.demo-wrap` carries the forced states in `data-pseudo`, taken from `appliedStateNames()`, so the active state's classes count only while it fits. That is what capture mode keys the room for focus rings on, and an excluded state gets none.

Each Overview cell creates its own marker and applies the variant's declared states, and a matrix cell also its column's state as the state layer, so a state never leaks into a neighbouring cell. A matrix cell reports the marker's fit to the matrix (`fitChange`), which counts it in the column header. When the state does not fit, the cell clears the marker and the component and shows a dashed placeholder in its place, with the reason as its tooltip and in its label, since a picture of the plain variant would sit under a label that says something else. The tools menu's toggle does not reach the Overview.

## Composed Variants: Root and Subject

A variant with a `template` or a host template is rendered through the generated composition wrapper, see [Build Pipeline](architecture/pipeline.md#_6-runtime-manifest-generation). `PrismRendererService.renderedElement` is the host element of that wrapper, the root of the whole composition, the same way it is the host of a directive's wrapper. Everything that works from the rendered element therefore sees the composition and not only the showcased element:

- the pseudo-state marker resolves its targets against the root, so a selector in `pseudo` or in a state finds elements of the frame and of the other parts, and `true` is every element of the composition (the rule "resolved against what is rendered");
- `data-prism-rendered`, the `.demo-wrap` box, the box model, measuring, Figma and the a11y audit work on the root. A label that belongs to the frame is part of the audited tree;
- the Overview cell of a composed variant renders the same wrapper with the variant's index.

`PrismRendererService.subjectElement` (since 22.7.0) is the one place that needs the showcased element itself. It is computed from `renderedElement`: the element with `data-prism-subject`, which the wrapper puts on the subject (the root itself when it matches), and otherwise the root. The a11y overlay reads the role it labels from it. Outside a composition no element is marked, so it is the root.

A switch to or from a composed variant creates the component again, since the type to render changes, and so does a switch between two composed variants, because each runs its own instances of the frame and the parts in it. The renderer keeps the type, the variant index and the content of the last render for that: only a variant of the same type and content takes the inputs through `setInput` on the instance it has.

## Viewport Width

`viewportWidth` narrows `.demo-wrap` so a layout can be checked at a given width without resizing the browser. The state is a single nullable number instead of a device list, because the tool is for finding where a layout breaks. The bounds, the presets and the snap tolerance are constants in `shared/viewport.type.ts` (`VIEWPORT_MIN`, `VIEWPORT_MAX`, `VIEWPORT_SNAPS`, `VIEWPORT_SNAP_TOLERANCE`); `clampViewportWidth()` keeps every stored and set value inside the bounds and on a whole pixel, and `snapViewportWidth()` (`canvas/viewport-snap.ts`) pulls a dragged width onto a preset within the tolerance. What the user sees is under [Viewport width](guide/styleguide-ui.md#viewport-width).

### The specimen is centred at the container

While constrained, `.demo-wrap` takes the viewport width with `flex: none` in every layout. With
`canvasLayout: 'fit'` it is also a grid with `justify-items: safe center`, so a specimen narrower than
the viewport sits in the middle of it rather than against its left edge. Sizing is unchanged by
this: a block-level specimen shrink-wraps here as it already does at rest inside the
`inline-block` wrapper, and one whose host asks for `width: 100%` still receives the whole viewport.

With `canvasLayout: 'stretch'` it keeps the `display: block` of its resting rule, so the viewport width
is laid out like the 800px at rest: a block-level specimen fills it, and so does the wrapper a
composition renders in, which hands a subject with `width: 100%` the whole viewport. Centring would
undo that. A grid item without a width of its own shrinks to its content, and in a composition the
grid item is ng-prism's wrapper, not the subject: the subject came out only as wide as its own
content, and a horizontal divider (`display: block`, no width) at 0px. `justify-items` stays off the
stretch box too, because browsers align block-level children in block layout by it as well.

`flex: none` is required too: the stage is a flex container and `.demo-wrap` is its only item, so the
default `flex-shrink: 1` would render the box narrower than the requested width whenever the canvas is
smaller, and `container-type` drops the automatic minimum size to zero. The stage is `overflow: auto`, so
the box scrolls instead of shrinking.

The `safe` keyword matters as well: bare `center` spills a specimen wider than the constraint equally
past both edges, whereas a real viewport of that width clips at zero and scrolls in one direction.
`safe` falls back to `start` when the item overflows.

The centring uses the container instead of `text-align: center`. The specimen is created through
`ViewContainerRef`, so its host element carries none of the renderer's `_ngcontent` attribute and
no scoped rule can reach it to undo an inherited value. A `text-align` on the wrapper would leak
into the specimen and re-align its text whenever the viewport was switched on.

### Container queries respond; media queries do not

`.demo-wrap` carries `container-type: inline-size` while constrained, so `@container` rules respond to
the width, while `@media` keeps reading the real browser window. Emulating media queries would mean
rendering the component in an iframe, which would take `plugin-box-model` and every other overlay its
target, since overlays render as Angular components inside `.demo-wrap`. The width constraint is the
cheaper option.

### Grips and dimension line

The grips, one straddling each edge of the constrained area, and the dimension line are siblings of
`.demo-wrap`, never children of it: `.demo-wrap` is what a visual regression runner screenshots, and
anything inside it would composite into every baseline.

- **Grips** run on `prismResizer` with `scale` `-2 / zoom` and `2 / zoom`: `.demo-wrap` is centred and
  scaled by the canvas zoom, so an edge moving by `d` changes the width by `2d / zoom`, which keeps the
  grip under the cursor at any zoom level. Each is a handle on a faint 1px guide line that runs the full
  height of the stage. Only the handle is clickable: the line's track is `pointer-events: none`, or it
  would cover the Reset buttons of the pills whenever a viewport is on. The handle's hit box is
  larger than the mark it draws (`background-clip: content-box` over padding), and the **Width** chooser
  reaches the same presets for anyone who cannot hit a 9px target. The line crosses the specimen, so it
  stays faint and brightens with the handle on hover, drag and focus. Both grips are
  `role="separator"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`. The pointer inversion
  that lets the left grip track the cursor does not apply to the keyboard: ArrowRight widens on either
  grip, because two separators announcing the same `aria-valuenow` must not move it in opposite
  directions for the same key.
- **Dimension line**: a horizontal rule in `--prism-measure` spanning the painted width at the top of
  the stage, with the value set into a gap at its centre and a short tick at each end, which make it
  read as a measurement instead of a divider. It is the middle resident of the overlay band (pills left,
  rail right) and reads the same `--prism-canvas-overlay-top` as the other two, so enabling rulers
  moves all three together. Its width carries the same `--prism-vp-w * --zoom` product the grips use.

The rail itself prints no width; `zoomTitle()` puts it into the zoom readout's tooltip.

### Capture mode

Capture mode never restores a persisted width, so a run always starts unconstrained and no viewport
from an earlier session can leak into a baseline. The grips and the dimension line sit inside the
renderer's `@if (!capture.active())` block, alongside the crosshair, the rulers and the
pills. Capture mode also never _writes_ the width back to storage (`PrismCanvasService.save()` is a
no-op while capture is active), so a capture run cannot corrupt the user's stored preference either.

### Phone layout

The phone layout ignores the width the same way: the renderer's `viewportWidth` computed is `null`
while capture mode is active or the phone layout is (`desktopTools()` is false), so on a phone the
specimen meets the device's own width. The grips, the dimension line, the crosshair, the rulers and the
measuring tool are left out there too, and the stored width, like the other toggles, stays as it was
and applies again once the window is wide. See [On a phone](guide/styleguide-ui.md#on-a-phone).

## Measuring

The measuring tool adds a third kind of state to the two services above: a point, stored in `.demo-wrap`-local CSS pixels, and an overlay drawn as a sibling of `.demo-wrap`, deliberately never a child of it. `PrismMeasureService` holds the drag in progress (`draft`), the pinned measurements (`pins`) and the Alt-click anchor (`hoverAnchor`). A change of variant or component clears all three (`clearAll()`); switching the tool off only drops the draft and the anchor (`suspend()`), because the toggle is a mode, not a reset. Nothing of it is persisted.

### Local coordinates, not screen coordinates

A `MeasurePoint` is recorded via `toLocal` in the same coordinate space `.demo-wrap` itself occupies before its own transform is applied, not in screen coordinates. The distinction matters because `.demo-wrap` carries `transform: scale(var(--zoom))`: a screen-pixel gap between two points on a zoomed-out canvas is smaller than the CSS-pixel distance the component itself renders at. Storing a point already inside that pre-scale space means the distance between two of them (`measureDistance`, a plain `Math.hypot`) is already the real CSS-pixel distance, and `formatMeasure` never has to divide by `zoom` to print it.

It also means a pin survives a zoom change instead of being tied to the screen position it was drawn at. `toScreen`, the inverse of `toLocal`, re-projects every point on every render, reading whatever `zoom` currently is; a pin placed at 50% and viewed back at 200% is recomputed from its stored CSS-pixel position, rather than replaying the screen coordinates captured the first time. The alt-hover four-sided readout takes the opposite route to the same destination: `quadSpans` reads screen-space boxes straight from `getBoundingClientRect()`, so `quadLines` divides by `zoom` once, by hand, before formatting. It is the one place the overlay needs an explicit division, because that reading starts in the other coordinate space.

### Rounding

Whatever the document did not pin is reported in whole pixels (`quantizeFree`). A point that latched onto nothing is the cursor minus the specimen's own offset, and because `.demo-wrap` is centred that offset is itself fractional, a left edge at 824.3594 and the like. Those decimals would describe where the specimen happened to sit, not what was measured, so they are rounded away.

The rounding is per axis, not per point, which keeps it from discarding the fractions that are real. Only one axis of a snapped point comes from the document: an endpoint latched to a left edge takes that edge's exact x, while its y is still the raw cursor carrying the same offset as a free point. So the latched axis is kept exactly and the other is rounded. Measured against this repo's own fixtures, about a fifth of the distances between a parent and its child are genuinely fractional, such as a toggle knob centred at 2.5px in its track, or an avatar's glyph sitting 6.8281 from one side and 6.8438 from the other, and rounding those away would hide the asymmetry a ruler exists to reveal.

Values are printed to at most one decimal, and whole values carry none (`formatMeasure`). One decimal is a deliberate floor: it is enough to show that a gap is 2.5 and not 3, and short enough to read at a glance. It does mean two readings that differ in the second decimal print the same number.

A measurement constrained with Shift (`constrainDirection`) is the one place fractions survive on purpose. Projecting onto a diagonal multiplies by √2/2, and the distance between two whole points on a 45-degree line is irrational in any case; rounding there would trade the exact angle Shift just promised for a tidier number.

### Why the label moves at 28px

`MEASURE_LABEL_MIN_SPAN` (28) is evaluated against the _projected_ span, the on-screen distance between the two ticks after `toScreen`, not the CSS-pixel value the label prints. That split matters: a measurement can be a large number and still render as a short line on screen at low zoom, and it is the rendered length, not the number, that decides whether the end ticks and the value can share the space without overlapping. Below 28px the value steps aside, perpendicular to the line, by `MEASURE_LABEL_OFFSET` (15px). Which side it steps toward is not fixed to one reference point across both callers of `labelPlacement`: the primary drag and pin measurements push it away from the specimen's own centre (`specimenCentre()`), while the alt-hover quad readout pushes it away from the centre of whichever element is currently hovered (`hover()` computes that centre fresh from `boxOf(targetEl)` on every call). Same mechanism, a different "away from" depending on what is actually being measured, and either way a short measurement inside a single small component never buries its own number under its own ticks.

### Two coordinate systems, and the projection between them

A stored `MeasurePoint` is `.demo-wrap`-local; every rect the overlay reads (`.demo-wrap`'s own for the projection origin, the specimen's for the label reference point, an element's for the four-sided readout) comes out of `getBoundingClientRect()` and is therefore in _viewport_ coordinates, measured from the corner of the window. Neither is the space the overlay draws in. `.m-svg` is `inset: 0` on the host, so its user coordinates begin at the host's top-left corner, and `.m-label` is placed with `left`/`top` against the same corner. `toHostSpace` is the one subtraction that closes the gap, applied to every drawn coordinate right after `toScreen` and inside `boxOf`. Skip it and the stored numbers stay exactly right while every line, tick, echo, outline and label is translated by the stage's screen offset, down by the header and right by the sidebar, which on a normal shell puts most of the drawing outside the stage. It is a pure function taking the host rect rather than reading one, because jsdom reports every rect as zero and a test routed through the DOM could not tell the subtraction from its absence.

### Where the overlay sits in the stack

`<prism-canvas-measure>` carries `z-index: 1`, and both the floor and the ceiling are load-bearing. It needs one at all because `.demo-wrap` is `position: relative` with a `transform`, a stacking context of its own, and renders _after_ the overlay in the template: at `z-index: auto` the two paint in tree order, `.demo-wrap` wins, and the overlay's marks disappear behind the specimen while its `pointerdown` never arrives, which takes alt-click anchoring with it. And it has to be the lowest of the stage's overlays (below the pills at 2, the rulers, grips and dimension line at 4, and the toolrail at 5), because it is the only one that takes pointer events across the stage's whole area: above the pills it covers their Reset buttons, and above the rail it covers the button that switches the tool back off.

Sitting above `.demo-wrap` is also what makes `elementUnderPoint` read the hit list rather than its topmost entry. The overlay is now the topmost hit for every point over the specimen, so `document.elementFromPoint` answers the overlay itself; `document.elementsFromPoint` and the first entry the rendered root contains gives the element actually underneath. The `contains` guard stays either way, because the toolrail and the grips sit above the overlay and would otherwise be snapped to.

### Core chrome, not a plugin overlay

`<prism-canvas-measure>` sits inside `.prism-canvas-stage` as a sibling of `.demo-wrap`, gated only by `canvasService.measure()` and the same `@if (!capture.active())` guard the crosshair, the rulers and the pills sit behind, never by which panel is active. A plugin overlay does not have that option: it is rendered as an ordinary Angular component _inside_ `.demo-wrap`, through `NgComponentOutlet` bound to the active panel. Two problems follow from sitting there instead. It is scaled by the same `transform: scale(var(--zoom))` `.demo-wrap` carries, so a label sized at 10px in the overlay's own CSS renders at 5 real screen pixels the moment zoom drops to 50%, the same shrink the specimen itself gets. And it is confined to `.demo-wrap`'s box the way `plugin-box-model`'s own overlay is, whose host sits at `inset: 0` relative to `.demo-wrap` with its own `overflow: hidden`, so a margin box that would extend past the specimen's edge is clipped exactly there. Neither problem is particular to box-model's overlay: both are what any component rendered inside a scaled, bounded box inherits for free, and both are exactly wrong for a tool whose job is comparing two elements that are not necessarily at the same place or the same apparent size on screen.

The deeper reason is architectural rather than visual: a panel overlay is _about_ the active panel, and box-model's overlay only makes sense while the Box Model panel is open. Measuring is not about any panel; it is orthogonal to them, chrome for the whole canvas the way guides and rulers are, rather than for one view. `resolveOverlay()` makes that explicit rather than incidental: it resolves to `{ kind: 'none' }` whenever the measuring tool is active, regardless of which panel is selected, and a lazy panel overlay is never even fetched while it runs, so the two are never competing for the same pointer. The function's own doc calls this a bridge: once the tool can attribute a measured gap to the CSS property that produced it, the box-model plugin has nothing left that it alone can do, and the reason for keeping them apart dissolves with it.

### The pin row

Pinned measurements render in `<prism-canvas-pin-row>`, a row below the canvas, not in a corner of the stage. The space above the canvas is already spoken for (the pills on the left, the dimension line in the centre, the toolrail on the right), and a fourth floating surface there would be the first to collide with one of the other three. The row is a direct child of `.prism-canvas-wrap` without a capture guard of its own: capture mode's structural rule removes every child of the wrap that does not contain the stage.

### No keyboard start yet

Keyboard support only operates a draft that already exists: arrow keys nudge (`nudge()` in `canvas/measure-keyboard.ts`, 1px, 10px with Shift), Enter commits, Escape cancels. A measurement begins only from a pointer-down. The design called for Tab to step through the specimen's snap targets as the keyboard equivalent of a pointer-down, arguably the more precise input of the two, since edges are exactly what one wants to measure, and that was never built. Tab is left untouched by `onKey` rather than repurposed as a plain stepping key, so it stays free for that mechanism. What the real interaction should be is still an open product question: a tool covering the whole canvas cannot simply take Tab for its own use without first deciding how a keyboard user gets back out of it.

The overlay is exposed as a labelled `group` rather than as an `application` for the same reason: `application` hands every keystroke to the widget and takes a screen-reader user out of browse mode, which would be a bad trade for a key set that cannot start anything. That changes the day the Tab mechanism exists, together with the overlay's `aria-label`.

## Simulation

`PrismSimulationService` holds what the tools menu's **Simulate** group sets: `motion`, `scheme`, `forced` and `vision`, each with a neutral default (`DEFAULT_SIMULATION` in `simulate/simulation.ts`, which also has the labels and the URL and storage parsers). Unlike the override and the toggles it survives a change of variant, component or view, because it describes the environment rather than the cell. `state` is `DEFAULT_SIMULATION` while capture mode is active, whatever was set, so nothing derived from it simulates there. Derived from it are `labels` for the pill (`PrismSimPillComponent`, in the stage under the background pill and above the Overview), `emulated` for the media engines (with an `equal`, so an unchanged emulation is the same object), `forcedPalette` for the engines and the ground (`forcedPalette()` in `simulate/simulation.ts`: the emulated scheme, under `System` the system's `prefers-color-scheme`, which the service reads from a `matchMedia` list it asks for once, before anything patches `matchMedia`, and follows on `change`), `schemeGround` and `forcedActive` for the ground, `auditCondition` for the live audit (scheme and forced colors only, which change computed colours) and `scopeRoot` for the scope roots.

**The scope.** The simulation applies to scope roots and what is inside them, never to the shell. A scope root is the host of the shown component, which the renderer and every Overview cell hold with `keepScopeRoot()`, and the CDK overlay container at the body. `applyScopeRoot()` (`simulate/scope-root.ts`) puts `data-prism-sim`, `color-scheme`, the vision `filter` and the class and attributes of the `colorScheme` config on it, records what each replaced, and takes back exactly that. Rewritten stylesheets reach the scope through `SIM_SCOPE` (`[data-prism-sim], .cdk-overlay-container`); `scopeIn()` and `scopeOut()` (`simulate/scope-selector.ts`) add suffixes that weigh nothing and are exact complements, so a rule keeps its specificity and matches inside or outside the scope but never both.

`PrismSimulationRuntimeService`, which the shell starts after the URL and the session have restored the simulation, carries it into the page. Each part runs only while it has something to do and takes back what it changed. The first and the third are the stylesheet half, `SimulationStyles` (`simulate/simulation-styles.ts`), which needs no Angular and takes back what it did with `clear()`:

- `MediaStyleSheets` (`simulate/media-stylesheets.ts`), on the pattern of `PseudoStyleSheets`: every `@media` that tests an emulated feature, at any depth, gets a copy right behind it with the emulated answer settled in its condition (`substituteMedia()`) and its selectors scoped in; the original is scoped out. Rules on the document root re-declare their inheritable values on the scope roots. It watches `document.head` for new styles, undoes and forgets a sheet that has left the document (removed component styles, a hot reload), and warns once about what it cannot rewrite.
- `patchMatchMedia()` (`simulate/match-media-patch.ts`) replaces `window.matchMedia` while a feature is emulated. A query that tests any emulatable feature gets a list that answers for the settled query and fires `change`; every other query gets the browser's own list, so the shell's width query stays real. A list is held weakly until its first `change` listener and from then on until the patch is uninstalled, as the browser keeps a list with listeners alive.
- The forced colors sheet (`forcedColorsCss()` in `simulate/forced-colors.ts`), adopted after the rewrite and ignored by it. Its rules weigh nothing and are `!important`, so the author's forced-colors copies win against it: the engine makes `!important` what they set of the properties the sheet forces (`FORCED_PROPERTIES`, `isForced()`), and leaves the rest of their declarations as they are. It is rebuilt whenever new styles arrive, since they can bring exemptions or gradients of their own.
- The overlay containers at the body as scope roots, and the vision filter on the overlays CDK opens in them as popovers (`applyTopLayerFilter()`): the top layer escapes an ancestor's `filter`, while the rest of the scope root reaches it by selector and inheritance.

**The ground.** `playgroundGround()` and `overviewGround()` (`simulate/ground.ts`) fold the scheme into the background (above), and `groundSimulation()` gives the stage and each cell `data-sim-forced` with `--prism-sim-canvas` (the ground becomes the palette's `Canvas`, as a value: the keyword would resolve against the browser's normal palette), `data-sim-vision` with `--prism-sim-filter` (a `::before` copy of the ground drawn through the filter) and, under forced colors, the palette's `color-scheme` for the stage's scrollbars. In the Playground `pinGroundLayer()` (`simulate/ground-layer.ts`) keeps that layer over the scrolled-to part of the stage. The live audit hides it, since axe takes it for something that covers the text.

**The audit.** `PrismPanelHostComponent` reads `auditCondition()` in its audit effect, so a change of scheme or forced colors schedules a new audit, and hands the condition to `A11yAuditService.scheduleAudit()`. The service sets `condition` together with the results, so a result never carries a newer condition than it was measured under.

## URL and Session State

Two services keep what is open across reloads; the user side is under [Links & State](guide/url-state.md). Neither carries canvas setup: zoom, guides, rulers, the measuring toggle and the viewport width are `localStorage` preferences of `PrismCanvasService`, not URL parameters. Both carry the simulation.

`PrismUrlStateService` reads the URL on startup via `window.location.search` and sets the initial navigation state: the component, service, pipe or page, then the variant, then the state (after the variant, which clears it), the view and the part, and the addon panel. The simulation is restored first, before anything writes the URL back: at startup only when the URL names it (`hasSimulationParams()`), so that the session's can apply next, and on `popstate` always, absent parameters meaning none. It then follows the navigation signals and the simulation with an effect and calls `history.pushState()` when what is open changes to another component, service, pipe or page, and `replaceState()` when only the variant, state, view, part, panel or simulation changes. `writeSimulationParams()` writes the settings that differ from the default, last. The query string is built from scratch on every write, so a parameter the app does not own, `capture` included, never survives a navigation. A `popstate` restores from the URL again. With `urlState: false` it neither reads nor writes.

`PrismPersistenceService` reads `sessionStorage` (`ng-prism:state`) after the URL service has selected the active component, then applies persisted control values that match the current `className` and variant index, and the persisted simulation unless the URL names one. It follows the same signals and writes back debounced (200 ms), skipping a write that would store what is already there. A different schema version, corrupted JSON, an exceeded quota and a missing `sessionStorage` are all handled without crashing the app. With `persistState: false`, and in capture mode, it neither reads nor writes.

`PrismShellComponent` initializes both at startup, in this order: `urlStateService.init()`, then `persistenceService.init()`, and then `PrismSimulationRuntimeService.init()`, so the runtime starts from the restored simulation.
