# Tour of the UI

This page walks through the styleguide that `ng run my-lib:prism` serves on `http://localhost:4400`, and names its parts the way the rest of these docs do. From top to bottom:

- **Header:** the brand (the ng-prism logo, or your [`logo`, `title` and `subtitle`](api/ng-prism-config.md#header)), the header widgets, such as the a11y pill or the pill of the coverage plugin, the [`buildInfo`](api/ng-prism-config.md#buildinfo) pill, the theme switch and the ⋮ menu.
- **Sidebar:** everything that is showcased, plus your pages.
- **Component head:** the title of what is open, its details and the view tabs **Playground**, **Overview** and **API**.
- **Variant ribbon:** one tab per variant.
- **Canvas:** the component itself, with the canvas rail floating at its top right.
- **Addons panel:** Controls, Events, A11y and the panels of your plugins.

The styleguide opens on the component, service, pipe or page the URL names. When it names none, it opens the first page; without pages the first component, then the first service, then the first pipe. What the URL carries is under [Links & State](guide/url-state.md).

## Sidebar

The sidebar lists every showcased component, directive, service and pipe, in sections (_Components_, _Directives_, _Services_, _Pipes_, or one a [`section`](api/showcase-config.md#section) names) and in categories inside them. The order is yours, see [Ordering the sidebar](guide/showcase-decorator.md#ordering-the-sidebar). Pages sit above them in a pinned **Pages** section, see [Pages in the Sidebar](guide/component-pages.md#pages-in-the-sidebar). Each section head shows how many entries it holds.

- **Filter:** the field at the top, or press `/` anywhere outside a text field. It matches the title, the category, the tags, the class name, a component's selector and a pipe's template name. A query that matches a [part](guide/parts.md#how-a-part-shows) lists its parent. Pages match by title and category.
- **Groups:** a click on a category head folds it. Folded groups stay folded across visits, in the browser's `localStorage`.
- **Entries:** the icon tells the kind, a box for a component, a plug for a service, a pipette for a pipe. A [`status`](api/showcase-config.md#status) of `'wip'` turns it into a dashed circle, and `'deprecated'` strikes the name through and dims it.
- **Markers:** an entry can carry markers on the right, such as the a11y marker that the library-wide report sets (see [A11y Reports](guide/a11y-reports.md)) or those of the coverage and visual regression plugins. A plugin adds its own with [`navigationDecorations`](api/ng-prism-plugin.md#navigationdecorationdefinition). The tooltip of the entry names them. A category head adds a chip with the number of its entries that carry one, in the tone of the worst, for example `2 of 5 entries need review` in its tooltip.
- **The open entry stays in sight** (since 22.7.0). After a link, a reload or a step back or forward, the sidebar scrolls the open entry into the middle of the list and opens its group if it was folded. An entry already in sight stays where it is, so a click in the list never moves it.

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
- The **addons panel** has the tabs **Controls** (the inputs, see [Inputs & Controls](guide/inputs-and-controls.md)), **Events** (what the outputs emit, and each change of a `model()`), **A11y** (see [Accessibility Panel](guide/accessibility.md)) and those of your plugins. A tab can carry a badge, such as the number of open a11y violations. Drag the edge between the canvas and the panel to change its height, between 200 and 560 pixels. The panel belongs to the Playground: the Overview and the API tab have none.

A service or a pipe has no Playground and no Overview; its page shows the view tabs that apply to it, see [Services & Pipes](guide/services-and-pipes.md#in-the-styleguide). A page renders its own component, without a component head or tabs.

## The Overview

**Overview** renders every variant of the active component at the same time, as a grid of cells, more of a contact sheet than a viewfinder. Use it to compare variants against each other instead of stepping through them one by one. A component with [states](guide/states.md) gets a matrix of variants against states instead, see [With states](#with-states). The Overview belongs to the component it shows: selecting another component opens that one on the Playground.

The tab appears when the Overview would have at least two cells. Without `states` a cell is a variant, so that means two or more variants. It stays hidden for single-variant components (a one-cell grid says nothing the Playground does not say better) and for components using [`renderPage`](guide/component-pages.md). Those render a page that reads its values from a single shared renderer state, so every cell would show the same thing.

With `states`, every variant counts one cell for itself and one for each state, and a variant with `states: false` counts one. A single variant with one state is two cells, so it has the tab. A component without variants counts as one implicit `Default` variant.

Each cell renders its variant as declared:

- **Background**: a variant's own [`bg`](api/showcase-config.md#bg) paints that cell, so an `On dark` variant sits on dark while its neighbours do not. Variants that declare nothing get the checkerboard, or the [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults) of the config, matching what external tooling is told the variant renders on, or the ground of a [simulated color scheme](#the-ground).
- **Layout**: a variant with `canvasLayout: 'stretch'` takes a full row instead of a column, because it has no intrinsic width to compare against its neighbours. The matrix has its own columns, see below.
- **Pseudo states**: a variant's own [`pseudo`](guide/states.md#per-variant-pseudo-states) states are forced in its cell, and only there, so a `Hovered` cell sits next to its unhovered neighbours. The tools menu's **State** group does not reach the Overview.
- **Caption**: running number and variant name below the frame, e.g. `08 On dark`. The matrix names its rows instead.

The Overview is a stage, not a workbench: it has no controls, no zoom and no addons panel. Control values you changed in the Playground do not leak into it. Every cell shows the variant as the decorator declares it. What the tools menu [simulates](#simulate) does reach every cell, and a pill above the cells says so.

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
- **Tools** (the sliders) opens the tools menu. It carries a dot while the menu holds something that changes the canvas: a state, a pseudo-class toggle or a simulation.
- **Angular template** (`</>`) opens the template of what the canvas shows, with the inputs the variant sets and those you changed, and a **Copy** button. For a [composition](guide/compositions.md) it is the composition as written.

The four toggles are preferences of your working environment, not of a component: they apply to every component and stay as you left them across visits, in the browser's `localStorage`. The tooltip of each says whether it is on.

The **tools menu** holds what you set once rather than flip all the time. Its choices are chips and segments, most of them with a preview of what they do:

- **Background:** a chip per background, with a swatch of it, see [Background](#background).
- **State:** the component's states, and a chip per pseudo-class with an icon, see [State switch](#state-switch).
- **Zoom:** 75%, 100%, 150% or 200%. Zoom scales the component, the rulers follow it, and the measuring tool still reports CSS pixels.
- **Width:** `Auto` or a preset width, each with a bar to scale, see [Viewport width](#viewport-width).
- **Simulate**, set apart at the end: motion, color scheme, forced colors and vision, each with a preview, see [Simulate](#simulate).

The pills sit at the top left of the canvas, the background pill above the [simulation pill](#simulate), the dimension line of the viewport width in the middle and the rail at the right. Turning the rulers on moves all three down below the top ruler. On the `light` and `dark` grounds they take fixed light or dark colours, so the rail stays light on a `light` canvas under the dark theme, and a project with a mid-tone ground sets their [theme tokens](guide/theming.md#base-tokens-theme-independent); under simulated [forced colors](#forced-colors) they take fixed colours of its palette; on the other grounds they follow the theme, see [Canvas overlays](guide/theming.md#canvas-overlays). Measurements you keep sit in a row below the canvas, see [Keeping measurements](guide/measuring.md#keeping-measurements).

Capture mode, which screenshot tools use, hides the rail, the menu and everything else the canvas draws around the component, and simulates nothing, see [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode).

## Viewport width

The viewport width narrows the box the component renders in, so you can check a layout at a given width without resizing the browser. It is one number rather than a list of devices, because it is for finding where a layout breaks, and it simulates nothing: the presets are plain widths, without device names.

- **On and off:** the **Viewport width** button on the rail. It comes back at the last width of the session, or at 390 pixels when the session has none yet. A width that is on when you leave is kept across visits, see below.
- **Presets:** the **Width** group of the tools menu offers `Auto` (off), 320, 390, 480, 640, 768 and 1024, without aiming at a grip.
- **Dragging:** a grip sits on either edge of the narrowed box, on a faint line down the canvas. Drag either one; the box stays centred, so both edges move. A drag rests on a preset when it comes within 8 pixels of it, and goes no narrower than 100 and no wider than 1600 pixels, well below any real device, so you can find where a layout gives up. The grips work at any zoom and stay under the pointer.
- **Keyboard:** Tab to a grip, then ArrowRight widens by 10 pixels and ArrowLeft narrows, on either grip, resting on a preset like a drag; Home and End jump to 100 and 1600. Both grips announce the width as their value.
- **Readout:** a dimension line across the top of the canvas spans the box and shows the width, such as `390 px`, with a tick at each end. The zoom readout's tooltip names it as well.

How the component sits in the box follows its [`canvasLayout`](api/showcase-config.md#canvaslayout): a `'fit'` component is centred in it, a `'stretch'` component fills it, in a composition as well.

**Container queries respond; media queries do not.** The constraint narrows a box but does not change what `@media (max-width: …)` sees, which is the real browser window. A component that uses media queries stays in its desktop layout however narrow the box gets. `@container` does respond: the box is a size container while it is narrowed, so a component written against container queries reflows as it would in production. To see media queries react, narrow the browser window, or open the styleguide on a phone, see [On a phone](#on-a-phone).

The width is a preference like zoom and lives in the browser's `localStorage`, not in the URL: a link opens with the reader's own setting. Capture mode ignores a stored width and never stores one, so a screenshot run always starts unconstrained. The phone layout ignores it too and keeps it for when the window is wide again.

## Background

The **Background** group of the tools menu has a chip for each background: **Dots**, **Plain**, **Light**, **Dark** and **Transparent**. Its swatch is painted by the canvas's own rules, so a theme that changes the ground or the dot colour shows in it. The filled chip is what the canvas paints right now. What each value means, and which follow the theme, is under [`bg`](api/showcase-config.md#bg).

- **The recommended background.** A component or a variant can declare the background it is designed for with [`bg`](api/showcase-config.md#bg). Its chip carries a border in the primary colour and the tooltip `Recommended background for this variant`, whenever the variant on screen has a recommendation. The recommended and the filled chip can be the same.
- **Picking another one** while a recommendation exists changes the background for this variant only. A pill `Recommended: dark` with a **Reset** button appears at the top left of the canvas, and Reset goes back to the recommendation. The pick goes with the next variant or component, so coming back to a variant always shows its recommendation.
- **Without a recommendation** your pick is the canvas background for every component and variant that declares none. It starts as Dots, or as the [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults) of the config, and is kept across visits, in the browser's `localStorage`. Until you pick one, a [simulated](#the-ground) Light or Dark color scheme takes the canvas to Light or Dark. A `showcaseDefaults.bg` is no recommendation: its chip has no border, no pill appears, and your pick replaces it for every variant that declares nothing.
- **Transparent** is a light checkerboard on the canvas, the same in the dark and the light theme, but has no colour in a capture. Its tooltip says so: `Checkerboard here, a real alpha channel in a capture`.

The Overview does not use your pick: it paints the declared background, or a checkerboard (the `showcaseDefaults.bg` of the config, if it sets one) where nothing is declared. Simulated forced colors paint the ground in the palette's `Canvas` whatever is declared or picked, see [The ground](#the-ground). Capture mode ignores your pick as well and paints the declared background; where nothing is declared, the capture is transparent, with a real alpha channel, unless `showcaseDefaults.bg` sets another. See [`bg`](api/showcase-config.md#bg).

## State switch

The **State** group in the tools menu (the sliders button on the canvas rail) starts with a row of chips, one per declared [state](guide/states.md), in declaration order. A chip carries the primary-coloured border of a declared value. Pick one to show the variant you are looking at in that state, pick it again to turn it off. At most one is active. While it is, the variant ribbon shows it as a chip next to the tabs, for example `Focus visible ✕`, and a click on the chip clears the state. A variant with `states: false` shows no chip in the ribbon, see [Opting a variant out](guide/states.md#opting-a-variant-out). The sliders button carries a dot while the menu holds a state or a toggle, so you see it with the menu closed (since 22.7.0).

The active state is part of the address of what you see, next to the variant, and like a background override it belongs to the variant you picked it for:

- It goes when you pick another variant or switch to another component. A cell in the Overview opens its variant in its state, and the next variant you pick starts without one. To compare one state across the variants, read its column in the Overview, or pick the state again after the switch.
- It is in the URL as `state`, see [Links & State](guide/url-state.md), and it applies in capture mode.
- The Controls stay usable. Change an input while a state is on and you see the component with that input in that state.

A chip for a state that does not fit the shown variant has a dashed border, and its tooltip names the reason, for example `Hover does not fit this variant: .btn has pointer-events: none`. You can still pick it. It stays selected and forces nothing until the variant has a target for it, say after the `removable` control of a chip is switched on, and from then on it applies. The reasons are listed under [When a state does not fit](guide/states.md#when-a-state-does-not-fit). The info popover behind the ⓘ in the component head counts what is declared: `9 variants · 3 states`.

Below the chips, the group has one toggle per pseudo-class, `:hover` to `:focus-within`. A toggle forces that state on whatever variant is shown, on the whole component, and several can be on at once. The states the variant declares in its [`pseudo`](guide/states.md#per-variant-pseudo-states) carry the primary-coloured border, like the recommended background in the **Background** group, and can be switched off there too. While the active state fits the shown variant, its pseudo-classes count as declared as well: they carry the border and can be switched off one by one. While it does not fit, a toggle forces its pseudo-class on the whole component, like any other toggle. The toggles are not subject to the fit rule. A toggle's tooltip says where a state comes from, such as `:hover is forced by this variant`.

Like a background override, the toggles are transient: picking another variant, state or component resets them, and capture mode ignores them.

## Simulate

The **Simulate** group at the end of the tools menu shows the component under conditions of the reader's environment rather than of the canvas (since 22.8.0): reduced motion, a light or dark color scheme, forced colors and colour vision deficiencies. Switch one on while you write the CSS for it, or in a review, and click through the components with it.

| Row             | Choices                                                                        | What the canvas does                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Motion`        | `System`, `Reduce`                                                             | `Reduce` answers `prefers-reduced-motion: reduce`                                                                                                            |
| `Color scheme`  | `System`, `Light`, `Dark`                                                      | `Light` and `Dark` answer `prefers-color-scheme` and set `color-scheme` on the component, so `light-dark()`, system colours and native controls follow along |
| `Forced colors` | `Off`, `Active`                                                                | `Active` answers `forced-colors: active` and approximates what the mode does to your colors, see [Forced colors](#forced-colors)                             |
| `Vision`        | `None`, `Protanopia`, `Deuteranopia`, `Tritanopia`, `Achromatopsia`, `Blurred` | Draws the component through a filter, see [Vision](#vision)                                                                                                  |

`System`, `Off` and `None` leave the real answer alone, and the settings combine. Each choice previews what it does: the dot in front of `System` moves and the one in front of `Reduce` stands still (both stand still when your own system asks for reduced motion), the color schemes and forced colors show a small page in their colours, and each Vision tile runs a stripe of red, green, blue and yellow through its filter. The tooltip of `Active` names the exact mode in Chrome's DevTools.

While anything is simulated, a pill at the top left of the canvas lists it, below the background pill when that shows, for example `Reduced motion · Deuteranopia`. The settings appear there as `Reduced motion`, `Light scheme`, `Dark scheme`, `Forced colors (approx.)`, `Protanopia`, `Deuteranopia`, `Tritanopia`, `Achromatopsia` and `Blurred vision`. Its **Reset** button ends the simulation and leaves the background alone. The Overview shows the same pill above its cells, and the tools button carries its dot, so a simulation is never on unseen.

### What it reaches

- **The component** in the Playground and in every cell of the Overview, with everything inside it.
- **Its overlays:** what the component opens through CDK's `Overlay`, which renders into the overlay container at the end of `<body>` (`.cdk-overlay-container`): dialogs, menus, tooltips, toasts. That includes the overlays CDK shows as popovers in the top layer.
- **The ground** behind the component, under forced colors and vision, see [The ground](#the-ground).

The styleguide itself is never simulated. The header, the sidebar, the panels, the rail and the tools menu, the pills, the rulers, the measuring tool and the panel overlays on the canvas, such as the A11y outline or the box model, look and behave as they do without a simulation.

Your styles need no change. Every `@media` rule that tests an emulated feature applies to the component as it would under the real condition: combined with other tests, which stay live (`(prefers-color-scheme: dark) and (min-width: 600px)` still follows the window), negated, or nested in `@supports`, `@layer`, `@container` or a style rule, with its specificity and its place in the cascade. Styles that arrive later, with a component opened for the first time or a hot reload, follow as well. Values your library sets on `:root` inside such a rule, its tokens for example, reach the component too.

The live a11y audit runs again under a simulated color scheme or forced colors, and says so, see [Under a simulation](guide/accessibility.md#under-a-simulation).

### How long it lasts

- It stays when you pick another variant, component or view: it describes the environment, not the component.
- It is in the URL as `motion`, `scheme`, `forced` and `vision`, so a link opens with it. A link that names it wins over the session, see [Links & State](guide/url-state.md#simulation).
- It lasts for the browser session: a reload keeps it, and a new session starts without one.
- For the back and forward buttons and for capture mode, which never simulates, see [Links & State](guide/url-state.md#simulation) and [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode).

### The ground

- **Color scheme:** under `Light` or `Dark` the canvas takes the matching background, `light` or `dark`, as long as neither the variant nor you picked one. A background the variant declares wins, and so does one you pick in the Background group. A pick for the canvas as a whole, made on a variant without a recommendation, is kept under every scheme and in later visits, so from then on the canvas no longer follows the scheme; pick Light or Dark yourself to match it. Overview cells whose variant declares no background take `light` or `dark` as well, instead of the checkerboard. A [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults) gives way to the scheme in the canvas and in the cells: it only fills in where nothing else decides.
- **Forced colors:** the ground is the `Canvas` of the palette, white in the light one and black in the dark one, over any background, as in the real mode. The Background group says `Canvas while Forced colors is on`.

### Forced colors

A page cannot switch the browser into forced colors mode, so the canvas approximates it: it changes the colors of your styles the way Chrome's mode does.

**The palette** is the one of Chrome's forced colors emulation: the light one under the color scheme `Light`, the dark one under `Dark`, and under `System` the one that matches your system's color scheme. It changes when your system's scheme does. System colors resolve against it, so `Highlight` is the palette's `Highlight` and not the browser's normal one. `SelectedItem` and `SelectedItemText` are the exception: Chrome leaves them at your system's selection colors, and so does the canvas.

**What is forced.** Your rules apply as they are and win and lose against each other as before, in a `@layer`, nested or with `!important`. Your rules in `@media (forced-colors: active)` apply as in the real mode, so a color there that is not a system color is forced like any other. Wherever a rule sets one of the properties below, the canvas gives the element what the browser puts in its place:

- **The text color** is `CanvasText`. In a link it is `LinkText`, in a button `ButtonText`, in a form field `FieldText`, in a disabled native control such as a button, a select or a text area `GrayText`, and in a `<mark>` `MarkText`; a placeholder is `GrayText`. What is inside takes the color of its parent.
- **Borders, outlines, text decorations, carets and the other foreground colors** take the text color of their own element, so the border of a link is `LinkText` and not `CanvasText`. An outline on the element with visible focus (`:focus-visible`) is `Highlight` whatever color it has, `transparent` included, so a `transparent` outline written as the fallback for forced colors shows. That holds for a Focus visible state the canvas forces as well. The generated content of that element and what is inside it do not get it.
- **Background colors** become `Canvas`, on a `<mark>` `Mark`, and keep the alpha you wrote: a transparent background stays transparent, on `::before` and `::after` as well, and a translucent one stays translucent. That holds behind `var()` too, for a `var()` among other values, such as `background: var(--chip-bg) no-repeat`, and for a background list in a custom property, such as `background: var(--ring)` with `--ring: linear-gradient(…), #8529d5`, whose color is the one in its last layer. Where you set none, a button has the palette's `ButtonFace` and a form field its `Field`.
- **Shadows** (`box-shadow`, `text-shadow`) and **gradients** in `background-image` go, a gradient that sits in a custom property as well. Images from a URL stay. `accent-color` and `scrollbar-color` become `auto`.
- **An SVG keeps the colors you set**, on the `<svg>` and inside it, as attributes or in a stylesheet: `fill` and `stroke`, the `stop-color` of a gradient, the `flood-color` and `lighting-color` of a filter, and `color`, backgrounds, borders and shadows. Chrome's own styles give an SVG `forced-color-adjust: preserve-parent-color`, and the canvas follows them. An SVG without a color of its own takes the forced color of the element around it, so an icon drawn in `currentColor` is `LinkText` in a link and `ButtonText` in a button. What a `<foreignObject>` holds is forced again, and so is an element inside the SVG that you give `forced-color-adjust: auto`, or the SVG itself with what is inside it.
- **A system color that is the whole value** stays, and so does a `light-dark()` of two of them, and it resolves against the palette. In a shorthand it stays as the color among the other values, as in `border: 2px solid Highlight`. That holds behind `var()` as well, where the `var()` is the whole value or one of the values of a shorthand, so a token such as `@media (forced-colors: active) { :root { --tok: ButtonText } }` keeps working in `color: var(--tok)` and in `border: 1px solid var(--tok)`, and under `forced-color-adjust: none`. `AccentColor` and `AccentColorText` are the exception: Chrome forces them like any other color. A system color inside a function, such as `color-mix()` or `rgb(from Highlight r g b / alpha)`, is forced like any other color. `currentcolor` stays in the text color, in borders and in text decorations, which are the element's own forced color already; as a background it is forced to the ground, and as the outline of the element with visible focus it becomes `Highlight`.
- **Inline styles and CSS animations** are forced like the rest: the colors of a `style` attribute, and the colors in the keyframes of an `@keyframes`.
- **`forced-color-adjust: none` and `preserve-parent-color`** keep an element and everything inside it as you styled them. `forced-color-adjust: auto` on an element inside takes that back for the element and what is inside it, and its colors are forced again.

**Where it differs from the real mode.** The canvas stays an approximation, which is why the pill, the tooltip and the audit say `approx.`. It differs in these places:

- **There is no backplate behind text.** Chrome paints `Canvas` behind every line of text, which CSS cannot do for a line. Text in `HighlightText` over a `Highlight` background, without `forced-color-adjust: none` on the element, reads fine in the simulation and fails in the real mode, where the text sits on the backplate and not on the `Highlight`. Put `forced-color-adjust: none` on the element that paints the surface, and the colors you wrote stay.
- **`forced-color-adjust` goes one level.** An `auto` below an exemption takes it back, but a `none` below that `auto` does not exempt again, and neither does an `<svg>` inside a `<foreignObject>`. Where your rules give one element both a `none` and an `auto`, the real mode lets specificity and order decide, and the canvas reads neither: an `auto` below an exemption always wins, and on an element with no exemption above it the `none` does.
- **Animations started from script**, with `element.animate()` or Angular's animations module, keep their colors.
- **An inline `style`** is forced through its attribute, which is all a selector can read of it: a background loses its alpha, and a system color in it is forced, where the real mode lets it stand. The canvas forces a color of the attribute where a declaration of it starts, at the start, after a `;` or after white space, so `--sel-color`, `background-size` or `border-radius` leave the colors of your rules alone; a declaration with a space before its colon (`color : red`) is not forced.
- **A gradient or a background list that reaches `background` through a second custom property**, such as `--ring: var(--base)`, keeps its gradients in the canvas, and a list loses its color there. The real mode drops the gradients and paints the color as `Canvas`. A list whose last layer holds more than its color, such as `url(a.png) #fff`, loses its color too.
- **A `background` with several `var()`s among its values**, such as `var(--c) var(--pos) no-repeat`, gets an opaque `Canvas`: the canvas cannot tell which of them is the color, so a translucent color loses its alpha and a background without a color gets one. A custom property that holds a color together with other values, such as `--bg: #c00 no-repeat`, leaves its background transparent in the canvas, where the real mode paints it as `Canvas`.
- **A system color as the fallback of a `var()`**, such as `var(--undefined, Highlight)`, is forced where the custom property has no value. The real mode keeps it.
- **Your own `color-scheme: dark`** gives `Highlight`, `SelectedItem` and `SelectedItemText` a slightly different shade in Chrome's mode. The canvas always uses the shades of a page without a `color-scheme`.
- **A rule with nested rules whose selector list mixes specificities**, such as `.a, #b { color: red; & .n { … } }`, sets its own colors with the highest of them, `#b`'s, in the canvas. A rule of yours that would win against `.a` but not against `#b`, `.a.c { color: Highlight }` for one, loses its kept color there.
- **Native controls** that the browser paints itself, such as a checkbox or a radio button with `appearance: auto`, keep their native look, where the real mode paints them in the forced colors.
- **A component with `ViewEncapsulation.ShadowDom`** is not reached, see [Limits](#limits).
- **A selector list that mixes `:root`, `html` or `body` with other selectors** counts as the document root for the rules nested inside it.
- **The relative color syntax** builds the forced backgrounds, so the browser needs Chrome 131, Safari 18 or Firefox 133. From Chrome 119, Safari 16.4 and Firefox 128 on it works, except from `currentcolor` and from a system color keyword: a background in `currentcolor`, `AccentColor` or `AccentColorText` stays transparent there.

For the exact mode, use Chrome DevTools › Rendering › Emulate CSS media feature `forced-colors`.

### Vision

`Protanopia`, `Deuteranopia` and `Tritanopia` show the component as a reader without red, green or blue cones sees it, after Machado, Oliveira and Fernandes (2009) at full severity. `Achromatopsia` shows brightness only, and `Blurred` a slight blur that stands for low vision. The filter covers the component, its overlays and the ground behind it, which shows through the component's transparent parts, but nothing the styleguide draws on the canvas. It changes what you see, not what the component computes, so the live audit does not run again for it.

### In your code

- **`matchMedia`** answers for the emulated features as well. A query made while `Motion`, `Color scheme` or `Forced colors` is set gets the emulated answer, and a `change` event whenever that answer changes. A `MediaQueryList` the component got before keeps answering for the real environment: ask again, or open the component again, to follow the simulation. When the last emulated setting goes back to `System` or `Off`, a list from the simulation reports the real answer, with a `change` where it differs, and then stays silent, while its `matches` stays right.
- **A theme on a class or an attribute**, such as `.dark` on a wrapper instead of `prefers-color-scheme`, follows `Light` and `Dark` once you name it in [`colorScheme`](api/ng-prism-config.md#colorscheme) in the config.
- **The component is not created again** when a setting changes. Code that reads computed styles once, in `ngAfterViewInit` for example, keeps the values it read before; open the component again.

### Limits

Where the canvas cannot follow your styles, the browser console warns once per case, in dev mode:

- `<link media="…">`, `<style media="…">` and `@import url(…) <media>` keep their real answer for an emulated feature, since the condition decides about a whole stylesheet. Put it in an `@media` rule inside the stylesheet instead.
- A stylesheet from another origin can only be read with CORS. Without it, its rules keep their real answer. Serve it from the same origin, or load it with a `crossorigin` attribute where the server allows it, as Google Fonts does: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?…" crossorigin>`.
- `@keyframes`, `@font-face`, `@property` and `@counter-style` inside an emulated `@media` keep their real condition: applied for the component, they would apply to the whole page.

And without a warning:

- A relative font size on the document root, such as `html { font-size: 62.5% }`, applies a second time on the component's host when a rule on the root inside an emulated `@media` sets a font size too. Text that inherits its size then comes out smaller.
- An overlay that CDK opens with the `'inline'` popover location (`withPopoverLocation('inline')`, `cdkConnectedOverlayUsePopover="inline"`) sits in the top layer outside the overlay container and does not get the vision filter; the other settings reach it. Only CDK's overlay container counts: what the component appends to `<body>` itself is not simulated.
- Under a vision setting, a part of the component that is positioned absolutely, reaches past the canvas and then shrinks can leave the canvas scrollable into empty ground until you scroll it.
- Under a vision setting, the filter on the component's host makes the host the containing block of every `position: fixed` element inside it, and a stacking context. A fixed backdrop, drawer or full-screen layer is laid out against the host's box instead of the canvas, which with Angular's default inline host can shrink to nothing, and no `z-index` lifts it over what lies next to the host. Check such layers with `Vision` on `None`.
- A component whose host is `display: contents` has no box to filter: under a vision setting its ground is filtered and the component is not. The other settings reach it.
- A component with `ViewEncapsulation.ShadowDom` keeps its styles in a shadow root. The emulated `@media` rules and the forced colors approximation do not reach inside it, as with [pseudo states](guide/states.md#limits); `matchMedia`, the `color-scheme` on its host and the vision filter do.
- Under forced colors the canvas's own scrollbars take the light or dark look of the palette.

## Small touches

- **Keyboard shortcuts:** `/` focuses the sidebar filter. ⌥S shows and hides the sidebar, ⌥T the variant ribbon and ⌥A the addons panel (Alt on Windows and Linux). The ⋮ menu in the header has the same three as **Show sidebar**, **Show variant rail** and **Show addons panel**.
- **Resizing by keyboard:** the edge of the sidebar, the edge above the addons panel and the two viewport grips can be focused with Tab. The arrow keys move them by 10 pixels, Home and End to their limits.
- **What is remembered:** the theme, the layout (the size of the sidebar and the panel, and what is shown), the folded sidebar groups and the canvas settings (background, zoom, the rail's toggles and the width) stay in the browser's `localStorage` across visits. The values you change in the Controls panel and the [simulation](#simulate) last for the browser session, see [Links & State](guide/url-state.md#control-panel-amp-a11y-state-sessionstorage).
- **Theme:** the sun or moon in the header switches between the dark and the light theme. The styleguide starts dark, see [Theming](guide/theming.md#dark-and-light-themes).
- **Details on demand:** the ⓘ card, the metrics card and the Angular template are popovers. Escape or a click outside closes them.

## On a phone

The styleguide has a phone layout (since 22.7.0), so a link to a component opens properly on a phone and a component can be checked on a real device. It applies up to 900 px of width, and on touch screens no taller than 500 px, which takes in large phones held sideways.

- **Navigation:** the sidebar is no longer a column. ☰ in the header opens it over the whole page; picking an entry, ✕ or Escape closes it again. A link always opens on the component, with the navigation closed.
- **Canvas and panel:** the canvas takes the full width and the panel sits below it at about half the height. Drag the grip between them, or tap the active panel tab to fold the panel down to its tabs and tap it again to open it. On a short screen, such as a phone held sideways, the panel starts folded.
- **Component head:** once the head runs out of room, in a narrow desktop window as well, Playground / Overview / API becomes a menu named after the active view, and the parts and the metrics move into the ⓘ card. A dot on ⓘ says that a metric warns or alarms.
- **Header:** the subtitle goes, a long title shortens before the plugin widgets scroll, and the theme switch and the build info move into the ⋮ menu.
- **Pages:** a [component page](guide/component-pages.md) or a custom page keeps an edge of 16 px on every side, and its title lines up with it. A page needs no padding of its own for the phone.
- **Controls** stack under their labels. On touch screens buttons, tabs and rows grow to a size a finger can hit, and text fields use 16 px so iOS does not zoom the page when one gets focus.

The phone layout leaves out guides, rulers, the [measuring tool](guide/measuring.md) with its pins, and the viewport width, together with the **Width** group of the tools menu: they need a pointer that hovers and an Alt key, and on a phone the canvas already is the device's viewport, so the component's media queries meet the real screen. The **Simulate** group stays. Whatever you switched on at the desktop is back when the window is wide again. The phone layout keeps its panel height to itself and never changes the layout you set at the desktop; ⌥S does nothing there.

## Related

- [Variants](guide/variants.md), [States & Pseudo States](guide/states.md) and [Inputs & Controls](guide/inputs-and-controls.md): what the ribbon, the Overview and the Controls panel show
- [Measuring](guide/measuring.md), [Accessibility Panel](guide/accessibility.md) and [Links & State](guide/url-state.md): the other pages of this group
- [`bg`](api/showcase-config.md#bg) and [`canvasLayout`](api/showcase-config.md#canvaslayout) in the ShowcaseConfig reference
- [`colorScheme`](api/ng-prism-config.md#colorscheme) in the NgPrismConfig reference: a theme on a class or an attribute under a simulated color scheme
- [Theming](guide/theming.md): the colours of the styleguide, the canvas overlays included
- [External Tooling API](guide/external-tooling.md#capture-isolation-mode): what capture mode hides
- [Canvas State](architecture/canvas-state.md): how the canvas keeps its state, for contributors
