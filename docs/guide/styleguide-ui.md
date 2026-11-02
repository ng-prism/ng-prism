# Tour of the UI

This page walks through the styleguide that `ng run my-lib:prism` serves on `http://localhost:4400`, and names its parts the way the rest of these docs do. From top to bottom:

- **Header:** the brand (the ng-prism logo, or your [`logo`, `title` and `subtitle`](api/ng-prism-config.md#header)), the header widgets, such as the a11y pill or the pill of the coverage plugin, the [`buildInfo`](api/ng-prism-config.md#buildinfo) pill, the theme switch and the ⋮ menu.
- **Sidebar:** everything that is showcased, plus your pages.
- **Component head:** the title of what is open, its details and the view tabs **Playground**, **Overview** and **API**.
- **Variant ribbon:** one tab per variant.
- **Canvas:** the component itself, with the canvas rail floating at its top right.
- **Addons panel:** Controls, Events, A11y and the panels of your plugins.

The styleguide opens on the component, service, pipe or page the URL names. When it names none, it opens the first page, or the first component if there are no pages. What the URL carries is under [Links & State](guide/url-state.md).

## Sidebar

The sidebar lists every showcased component, directive, service and pipe, in sections (_Components_, _Directives_, _Services_, _Pipes_, or one a [`section`](api/showcase-config.md#section) names) and in categories inside them. The order is yours, see [Ordering the sidebar](guide/showcase-decorator.md#ordering-the-sidebar). Pages sit above them in a pinned **Pages** section, see [Pages in the Sidebar](guide/component-pages.md#pages-in-the-sidebar). Each section head shows how many entries it holds.

- **Filter:** the field at the top, or press `/` anywhere outside a text field. It matches the title, the category, the tags, the class name, a component's selector and a pipe's template name. A query that matches a [part](guide/parts.md#how-a-part-shows) lists its parent. Pages match by title and category.
- **Groups:** a click on a category head folds it. Folded groups stay folded across visits, in the browser's `localStorage`.
- **Entries:** the icon tells the kind, a box for a component, a plug for a service, a pipette for a pipe. A [`status`](api/showcase-config.md#status) of `'wip'` turns it into a dashed circle, and `'deprecated'` strikes the name through and dims it.
- **Markers:** an entry can carry markers on the right, such as the a11y marker that the library-wide report sets (see [A11y Reports](guide/a11y-reports.md)) or those of the coverage and visual regression plugins. A plugin adds its own with [`navigationDecorations`](api/ng-prism-plugin.md#navigationdecorationdefinition). The tooltip of the entry names them. A category head adds a chip with the number of its entries that carry one, in the tone of the worst, for example `2 of 5 entries need review` in its tooltip.
- **The open entry stays in sight.** After a link, a reload or a step back or forward, the sidebar scrolls the open entry into the middle of the list and opens its group if it was folded. An entry already in sight stays where it is, so a click in the list never moves it.

Drag the sidebar's right edge to change its width, between 200 and 360 pixels. ⌥S hides and shows it, see [Small touches](#small-touches). On a phone it becomes a full-screen navigation, see [On a phone](#on-a-phone).

## Playground, Overview and API

The **component head** sits above whatever is open:

- the category and the title
- **ⓘ**, the details card: the selector as code (`<lib-button>`), the [`description`](api/showcase-config.md#description), the count of variants and [states](guide/states.md) (`9 variants · 3 states`) and the [`tags`](api/showcase-config.md#tags)
- the [`status`](api/showcase-config.md#status) badge, with a dot in its tone
- the chips of the component's [parts](guide/parts.md#how-a-part-shows)
- the metrics chip: the worst of **Coverage**, **A11y score** and **VRT diff** as far as they are measured, with a card that lists all three with their threshold and value. Coverage and VRT diff come from the [Coverage](plugins/coverage.md) and [Visual Regression](plugins/visual-regression.md) plugins, the A11y score from the live audit of the [Accessibility Panel](guide/accessibility.md). Without any of them there is no chip.

At the end of the head are the **view tabs**:

- **Playground** shows the component on the canvas, with the variant ribbon above and the addons panel below.
- **Overview** shows every variant at once, see [The Overview](#the-overview). It is built in.
- **API** is the page of the [JSDoc](plugins/jsdoc.md) plugin, with the id `jsdoc` in the URL. A plugin can add further view tabs, see [`PanelDefinition`](api/ng-prism-plugin.md#paneldefinition).

Every component opens on the Playground, whichever view the one before it showed: you look at a component first and at its API second. A link, a reload and the browser's back and forward buttons open the view their URL names.

On the Playground:

- The **variant ribbon** has one tab per [variant](guide/variants.md), and ‹ › for the previous and the next one. While a [state](#state-switch) is on, the ribbon shows it as a chip; a component without variants shows the ribbon only for that chip.
- The **canvas** renders the selected variant, see [Canvas rail and tools](#canvas-rail-and-tools).
- The **addons panel** has the tabs **Controls** (the inputs, see [Inputs & Controls](guide/inputs-and-controls.md)), **Events** (what the outputs emit), **A11y** (see [Accessibility Panel](guide/accessibility.md)) and those of your plugins. A tab can carry a badge, such as the number of open a11y violations. Drag the edge between the canvas and the panel to change its height, between 200 and 560 pixels. The panel belongs to the Playground: the Overview and the API tab have none.

A service or a pipe has no Playground and no Overview; its page shows the view tabs that apply to it, see [Services & Pipes](guide/services-and-pipes.md#in-the-styleguide). A page renders its own component, without a component head or tabs.

## The Overview

**Overview** renders every variant of the active component at the same time, as a grid of cells, more of a contact sheet than a viewfinder. Use it to compare variants against each other instead of stepping through them one by one. A component with [states](guide/states.md) gets a matrix of variants against states instead, see [With states](#with-states). The Overview belongs to the component it shows: selecting another component opens that one on the Playground.

The tab appears when the Overview would have at least two cells. Without `states` a cell is a variant, so that means two or more variants. It stays hidden for single-variant components (a one-cell grid says nothing the Playground does not say better) and for components using [`renderPage`](guide/component-pages.md). Those render a page that reads its values from a single shared renderer state, so every cell would show the same thing.

With `states`, every variant counts one cell for itself and one for each state, and a variant with `states: false` counts one. A single variant with one state is two cells, so it has the tab. A component without variants counts as one implicit `Default` variant.

Each cell renders its variant as declared:

- **Background**: a variant's own [`bg`](api/showcase-config.md#bg) paints that cell, so an `On dark` variant sits on dark while its neighbours do not. Variants that declare nothing get the checkerboard, matching what external tooling is told the variant renders on.
- **Layout**: a variant with `canvasLayout: 'stretch'` takes a full row instead of a column, because it has no intrinsic width to compare against its neighbours. The matrix has its own columns, see below.
- **Pseudo states**: a variant's own [`pseudo`](guide/states.md#per-variant-pseudo-states) states are forced in its cell, and only there, so a `Hovered` cell sits next to its unhovered neighbours. The tools menu's **State** group does not reach the Overview.
- **Caption**: running number and variant name below the frame, e.g. `08 On dark`. The matrix names its rows instead.

The Overview is a stage, not a workbench: it has no controls, no zoom and no addons panel. Control values you changed in the Playground do not leak into it. Every cell shows the variant as the decorator declares it.

Every cell opens in the Playground. Click it, or focus it and press Enter or Space, and the Playground shows exactly that combination: the variant and, in the matrix, the state. That holds for components without states as well. A hovered cell and the one the Playground currently shows have a primary-coloured frame.

### With states

The matrix has a row per variant and a column per state, Default first and then the states in the order they are declared:

- **Row header**: the variant name. Where there is something to add, the variant's own `bg` (`bg: dark`) or `states: false`, it is the header's tooltip.
- **Column header**: the state's name, what it forces (`hover + active → .btn`, with a group per target when the pseudo-classes name different ones: `hover → .pill; focus-visible → .pill__close`), and how many variants it fits (`2/5` next to the name, spelled out in its tooltip). The count is of the variants the state is combined with, so those with `states: false` are not in it. The Default column says `no state`. The corner above the row headers reads `Variant \ State`.
- **Background and layout** belong to the row: a variant's `bg` paints every cell of its row, and a `stretch` variant fills its cells.
- **A cell that does not fit** is empty and dashed, with only a `–` in it. The reason is the cell's tooltip and part of its accessible name, see [When a state does not fit](guide/states.md#when-a-state-does-not-fit).
- **A variant with `states: false`** has a single cell across all columns, because it is combined with none of them.

Each cell shows the variant with the state of its column forced, and only there, like a variant's own `pseudo`. Many states or a wide component make the matrix scroll horizontally. The header row and the variant column stay in view, and the columns have a minimum width instead of being squeezed.

Link straight to the Overview with `?view=overview`, see [Links & State](guide/url-state.md).

## Canvas rail and tools

The canvas rail floats at the top right of the canvas:

- **Zoom readout**, such as `100%`. Its tooltip also names the viewport width: `Zoom 100% · Width 390px`.
- **Guides:** two faint lines through the centre of the canvas.
- **Rulers:** pixel rulers along the top and the left edge, in CSS pixels at the current zoom.
- **Viewport width:** narrows the box the component renders in, see [Viewport width](#viewport-width).
- **Measure:** the [measuring tool](guide/measuring.md).
- **Tools** (the sliders) opens the tools menu.
- **Angular template** (`</>`) opens the template of what the canvas shows, with the inputs the variant sets and those you changed, and a **Copy** button. For a [composition](guide/compositions.md) it is the composition as written.

The four toggles are preferences of your working environment, not of a component: they apply to every component and stay as you left them across visits, in the browser's `localStorage`. The tooltip of each says whether it is on.

The **tools menu** holds what you set once rather than flip all the time:

- **Canvas:** the background, see [Background](#background).
- **State:** the component's states and the pseudo-class toggles, see [State switch](#state-switch).
- **Zoom:** 75%, 100%, 150% or 200%. Zoom scales the component, the rulers follow it, and the measuring tool still reports CSS pixels.
- **Width:** `Auto` or a preset width, see [Viewport width](#viewport-width).

The background pill sits at the top left of the canvas, the dimension line of the viewport width in the middle and the rail at the right. Turning the rulers on moves all three down below the top ruler. They take their colours from the canvas ground, not from the theme, so the rail stays light on a `light` canvas under the dark theme, see [Canvas overlays](guide/theming.md#canvas-overlays). Measurements you keep sit in a row below the canvas, see [Keeping measurements](guide/measuring.md#keeping-measurements).

Capture mode, which screenshot tools use, hides the rail, the menu and everything else the canvas draws around the component, see [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode).

## Viewport width

The viewport width narrows the box the component renders in, so you can check a layout at a given width without resizing the browser. It is one number rather than a list of devices, because it is for finding where a layout breaks, and it simulates nothing: the presets are plain widths, without device names.

- **On and off:** the **Viewport width** button on the rail. The first time it starts at 390 pixels, afterwards at the last width you used.
- **Presets:** the **Width** group of the tools menu offers `Auto` (off), 320, 390, 480, 640, 768 and 1024, without aiming at a grip.
- **Dragging:** a grip sits on either edge of the narrowed box, on a faint line down the canvas. Drag either one; the box stays centred, so both edges move. A drag rests on a preset when it comes within 8 pixels of it, and goes no narrower than 100 and no wider than 1600 pixels, well below any real device, so you can find where a layout gives up. The grips work at any zoom and stay under the pointer.
- **Keyboard:** Tab to a grip, then ArrowRight widens by 10 pixels and ArrowLeft narrows, on either grip, resting on a preset like a drag; Home and End jump to 100 and 1600. Both grips announce the width as their value.
- **Readout:** a dimension line across the top of the canvas spans the box and shows the width, such as `390 px`, with a tick at each end. The zoom readout's tooltip names it as well.

How the component sits in the box follows its [`canvasLayout`](api/showcase-config.md#canvaslayout): a `'fit'` component is centred in it, a `'stretch'` component fills it, in a composition as well.

**Container queries respond; media queries do not.** The constraint narrows a box but does not change what `@media (max-width: …)` sees, which is the real browser window. A component that uses media queries stays in its desktop layout however narrow the box gets. `@container` does respond: the box is a size container while it is narrowed, so a component written against container queries reflows as it would in production. To see media queries react, narrow the browser window, or open the styleguide on a phone, see [On a phone](#on-a-phone).

The width is a preference like zoom and lives in the browser's `localStorage`, not in the URL: a link opens with the reader's own setting. Capture mode ignores a stored width and never stores one, so a screenshot run always starts unconstrained. The phone layout ignores it too and keeps it for when the window is wide again.

## Background

The **Canvas** group of the tools menu has a button for each background: **Dots**, **Plain**, **Light**, **Dark**, **Checker** and **Transparent**. The filled one is what the canvas paints right now. What each value means, and which follow the theme, is under [`bg`](api/showcase-config.md#bg).

- **The recommended background.** A component or a variant can declare the background it is designed for with [`bg`](api/showcase-config.md#bg). Its button carries a border in the primary colour and the tooltip `Recommended background for this variant`, whenever the variant on screen has a recommendation. The recommended and the filled button can be the same.
- **Picking another one** while a recommendation exists changes the background for this variant only. A pill `Recommended: dark` with a **Reset** button appears at the top left of the canvas, and Reset goes back to the recommendation. The pick goes with the next variant or component, so coming back to a variant always shows its recommendation.
- **Without a recommendation** your pick is the canvas background for every component and variant that declares none. It starts as Dots and is kept across visits, in the browser's `localStorage`.
- **Transparent and Checker** look the same on the canvas, a checkerboard. Their tooltips say the difference: `Checkerboard here, a real alpha channel in a capture` for Transparent, and that Checker is deprecated and keeps the themed colour in a capture.

The Overview and capture mode do not use your pick: they paint the declared background, or the checkerboard where nothing is declared, see [`bg`](api/showcase-config.md#bg).

## State switch

The **State** group in the tools menu (the sliders button on the canvas rail) starts with a row of chips, one per declared [state](guide/states.md), in declaration order. A chip carries the primary-coloured border of a declared value. Pick one to show the variant you are looking at in that state, pick it again to turn it off. At most one is active. While it is, the variant ribbon shows it as a chip next to the tabs, for example `Focus visible ✕`, and a click on the chip clears the state. A variant with `states: false` shows no chip in the ribbon, see [Opting a variant out](guide/states.md#opting-a-variant-out). The sliders button carries a dot while the menu holds a state or a toggle, so you see it with the menu closed (since 22.7.0).

The active state is part of the address of what you see, next to the variant, and like a background override it belongs to the variant you picked it for:

- It goes when you pick another variant or switch to another component. A cell in the Overview opens its variant in its state, and the next variant you pick starts without one. To compare one state across the variants, read its column in the Overview, or pick the state again after the switch.
- It is in the URL as `state`, see [Links & State](guide/url-state.md), and it applies in capture mode.
- The Controls stay usable. Change an input while a state is on and you see the component with that input in that state.

A chip for a state that does not fit the shown variant has a dashed border, and its tooltip names the reason, for example `Hover does not fit this variant: .btn has pointer-events: none`. You can still pick it. It stays selected and forces nothing until the variant has a target for it, say after the `removable` control of a chip is switched on, and from then on it applies. The reasons are listed under [When a state does not fit](guide/states.md#when-a-state-does-not-fit). The info popover behind the ⓘ in the component head counts what is declared: `9 variants · 3 states`.

Below the chips, the group has one toggle per pseudo-class, `:hover` to `:focus-within`. A toggle forces that state on whatever variant is shown, on the whole component, and several can be on at once. The states the variant declares in its [`pseudo`](guide/states.md#per-variant-pseudo-states) carry the primary-coloured border, like the recommended background in the **Canvas** group, and can be switched off there too. While the active state fits the shown variant, its pseudo-classes count as declared as well: they carry the border and can be switched off one by one. While it does not fit, a toggle forces its pseudo-class on the whole component, like any other toggle. The toggles are not subject to the fit rule. A toggle's tooltip says where a state comes from, such as `:hover is forced by this variant`.

Like a background override, the toggles are transient: picking another variant, state or component resets them, and capture mode ignores them.

## Small touches

- **Keyboard shortcuts:** `/` focuses the sidebar filter. ⌥S shows and hides the sidebar, ⌥T the variant ribbon and ⌥A the addons panel (Alt on Windows and Linux). The ⋮ menu in the header has the same three as **Show sidebar**, **Show variant rail** and **Show addons panel**.
- **Resizing by keyboard:** the edge of the sidebar, the edge above the addons panel and the two viewport grips can be focused with Tab. The arrow keys move them by 10 pixels, Home and End to their limits.
- **What is remembered:** the theme, the layout (the size of the sidebar and the panel, and what is shown), the folded sidebar groups and the canvas settings (background, zoom, the rail's toggles and the width) stay in the browser's `localStorage` across visits. The values you change in the Controls panel last for the browser session, see [Links & State](guide/url-state.md#control-panel-amp-a11y-state-sessionstorage).
- **Theme:** the sun or moon in the header switches between the dark and the light theme. The styleguide starts dark, see [Theming](guide/theming.md#dark-and-light-themes).
- **Details on demand:** the ⓘ card, the metrics card and the Angular template are popovers. Escape or a click outside closes them.

## On a phone

The styleguide has a phone layout (since 22.7.0), so a link to a component opens properly on a phone and a component can be checked on a real device. It applies up to 900 px of width, and on touch screens no taller than 500 px, which takes in large phones held sideways.

- **Navigation:** the sidebar is no longer a column. ☰ in the header opens it over the whole page; picking an entry, ✕ or Escape closes it again. A link always opens on the component, with the navigation closed.
- **Canvas and panel:** the canvas takes the full width and the panel sits below it at about half the height. Drag the grip between them, or tap the active panel tab to fold the panel down to its tabs and tap it again to open it. On a short screen, such as a phone held sideways, the panel starts folded.
- **Component head:** once the head runs out of room, in a narrow desktop window as well, Playground / Overview / API becomes a menu named after the active view, and the parts and the metrics move into the ⓘ card. A dot on ⓘ says that a metric warns or alarms.
- **Header:** the subtitle goes, a long title shortens before the plugin widgets scroll, and the theme switch and the build info move into the ⋮ menu.
- **Controls** stack under their labels. On touch screens buttons, tabs and rows grow to a size a finger can hit, and text fields use 16 px so iOS does not zoom the page when one gets focus.

The phone layout leaves out guides, rulers, the [measuring tool](guide/measuring.md) with its pins, and the viewport width, together with the **Width** group of the tools menu: they need a pointer that hovers and an Alt key, and on a phone the canvas already is the device's viewport, so the component's media queries meet the real screen. Whatever you switched on at the desktop is back when the window is wide again. The phone layout keeps its panel height to itself and never changes the layout you set at the desktop; ⌥S does nothing there.

## Related

- [Variants](guide/variants.md), [States & Pseudo States](guide/states.md) and [Inputs & Controls](guide/inputs-and-controls.md): what the ribbon, the Overview and the Controls panel show
- [Measuring](guide/measuring.md), [Accessibility Panel](guide/accessibility.md) and [Links & State](guide/url-state.md): the other pages of this group
- [`bg`](api/showcase-config.md#bg) and [`canvasLayout`](api/showcase-config.md#canvaslayout) in the ShowcaseConfig reference
- [Theming](guide/theming.md): the colours of the styleguide, the canvas overlays included
- [External Tooling API](guide/external-tooling.md#capture-isolation-mode): what capture mode hides
- [Canvas State](architecture/canvas-state.md): how the canvas keeps its state, for contributors
