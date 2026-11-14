# Links & State

ng-prism keeps the UI state alive across full-page reloads, which helps a lot during component-driven development. Two layers cooperate:

- **URL** carries shareable state (component, service or pipe, variant, state, view, the part a view shows, panel tab, and what the canvas simulates), so links are bookmarkable and deep-linkable.
- **sessionStorage** carries per-session state (the values you changed in the Controls panel, the a11y sub-tab, and the simulation) and keeps the control values off the URL.

When a change in your library reloads the page, you land back on the same component, the same variant, with the same control values applied. No more clicking your way back to where you were.

## URL Parameters

| Parameter   | Example                        | Description                                                                                                                                                                           |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component` | `?component=ButtonComponent`   | Active component class name                                                                                                                                                           |
| `service`   | `?service=NotificationService` | Active [service](guide/services-and-pipes.md#services) class name. Services have their own parameter, so a tool that sets `?component=` never lands on one                            |
| `pipe`      | `?pipe=TimeAgoPipe`            | Active [pipe](guide/services-and-pipes.md#pipes) class name. Pipes have their own parameter as well, so neither `?component=` nor `?service=` lands on one                            |
| `page`      | `?page=Button%20Patterns`      | Active page title (URL-encoded)                                                                                                                                                       |
| `variant`   | `?variant=1`                   | Active variant index (0-based). Omitted for the first variant; a value that is no index into the variants opens the first                                                             |
| `state`     | `?state=1`                     | Active component-level state: the 0-based index into the component's `states`. Written only while a state is active; a value that is no index into `states` is ignored.               |
| `view`      | `?view=overview`               | Active view tab: `overview`, `jsdoc` for the API tab of the JSDoc plugin, or the id of another view panel. Omitted for the Playground                                                 |
| `part`      | `?part=OptionComponent`        | The [part](guide/parts.md) of the component that the active view shows, as its class name (since 22.7.0), `~2` appended for a second part of the same class name. See [Parts](#parts) |
| `panel`     | `?panel=a11y`                  | Active tab of the addons panel (default: `controls`, omitted when default)                                                                                                            |
| `motion`    | `?motion=reduce`               | The [simulated](guide/styleguide-ui.md#simulate) motion preference, `reduce` (since 22.8.0). Omitted for `System`. See [Simulation](#simulation)                                      |
| `scheme`    | `?scheme=dark`                 | The simulated color scheme, `light` or `dark` (since 22.8.0). Omitted for `System`                                                                                                    |
| `forced`    | `?forced=active`               | Simulated forced colors, `active` (since 22.8.0). Omitted for `Off`                                                                                                                   |
| `vision`    | `?vision=deuteranopia`         | The simulated vision: `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia` or `blurred` (since 22.8.0). Omitted for `None`                                                     |
| `capture`   | `?capture=1`                   | Read-only input flag. Enables [capture isolation mode](guide/external-tooling.md#capture-isolation-mode) for screenshot tooling. Never written back to the URL.                       |

Example URL:

```
http://localhost:4400/?component=ButtonComponent&variant=2&panel=a11y
```

A service page is addressed by `service` and a pipe page by `pipe`, with the view tab in `view`. The API tab of the JSDoc plugin has the id `jsdoc`:

```
http://localhost:4400/?service=NotificationService&view=jsdoc
http://localhost:4400/?pipe=TimeAgoPipe&view=jsdoc
```

`variant` and `state` mean nothing for a service or a pipe and are never written for one. When a URL carries more than one of `component`, `service`, `pipe` and `page`, the first in that order wins. A class name that is not a service or pipe in the manifest is ignored, like an unknown component.

## Parts

A [part](guide/parts.md) (`@Showcase({ partOf })`, since 22.7.0) has no page of its own, so there is no `component` to select for it. Its class name still works as an address, and `part` carries what it shows:

- **`?component=<PartClass>` opens the parent.** The app selects the component the part belongs to and rewrites the URL to it. The `view` of the old link is kept, and the part goes into `part`:

    ```
    ?component=OptionComponent&view=jsdoc
    → ?component=SelectComponent&view=jsdoc&part=OptionComponent
    ```

    `variant` and `state` of such a link are dropped, since they would name the part's, and the parent opens on its defaults. The rewrite replaces the history entry instead of adding one, so back does not return to the link that was rewritten.

    The same happens during `ng-prism serve` when the component on screen gets a `partOf`: after the rebuild the app opens the parent, on the part when the view that lists parts was open, instead of the first entry.

- **`part` is applied only where it can be shown.** The view must be the first visible view panel that sets [`listsParts`](api/ng-prism-plugin.md#panels-that-list-parts), and the component must have that part. Without both the part is dropped and the component opens as usual, with the requested view. That is also what happens with a link to a part when no plugin lists parts.
- **Switching the component or the view removes `part`.** It marks where the reader was sent to, not a setting that follows them. Coming back to the same component and view inside the app does not scroll to the part again. The browser's back and forward buttons restore a history entry as it was, `part` included, so going back to an entry with a part scrolls to it.
- **`part` is not persisted.** Like the other navigation parameters it lives in the URL only, not in `sessionStorage`.

## Simulation

`motion`, `scheme`, `forced` and `vision` carry what the [Simulate](guide/styleguide-ui.md#simulate) group of the tools menu sets (since 22.8.0). They come last in the query string:

```
http://localhost:4400/?component=ButtonComponent&scheme=dark&vision=deuteranopia
```

- **Only what differs from the default is written**, so a URL without a simulation has none of them.
- **A link that names any of them sets the whole simulation.** A setting it leaves out is off, and the simulation kept in the session does not apply. An unknown value counts as left out, so it costs only its own setting.
- **A change of the simulation rewrites the current history entry** and never adds one. The back and forward buttons keep the simulation as it is, as switching the component does, and the entry they open takes it on in place.
- **Capture mode ignores them**: a capture never simulates, see [Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode).

## Deep-Linking

Share a URL pointing directly to a specific component and variant. Anyone opening the link lands on the same state.

```
http://localhost:4400/?component=AlertComponent&variant=1
```

Add `state` to open the variant in one of the component's [states](guide/states.md#states):

```
http://localhost:4400/?component=AlertComponent&variant=1&state=1
```

The state is part of the address next to the variant. It goes from the URL when you pick another variant or switch components, as it goes from the canvas, see [State switch](guide/styleguide-ui.md#state-switch).

## Browser Back/Forward

Selecting another component or page pushes a new browser history entry. Changing the variant, the state, the view, the shown part, the panel tab or the simulation rewrites the current entry instead, so stepping through variants does not fill the history. The browser back and forward buttons move between components and pages, and an entry holds the variant, state, view, part and panel its component was last left in. The simulation is not part of it: it stays as it is, see [Simulation](#simulation).

A component you select in the sidebar opens on the Playground, see [Tour of the UI](guide/styleguide-ui.md#playground-overview-and-api). A link, a reload and the back and forward buttons open the view their URL names, so going back returns to the Overview or API tab an entry was left on. The sidebar scrolls to the entry they open, see [Sidebar](guide/styleguide-ui.md#sidebar).

## Control Panel & A11y State (sessionStorage)

URL state does not carry the values you change in the Controls panel, since long input strings would bloat every link. Instead, ng-prism mirrors these to `sessionStorage` under the key `ng-prism:state`:

- Control values, one entry per component class with the variant they belong to. Each component keeps its own entry; switching components does not discard the others.
- The active sub-tab of the A11y panel (`violations` | `keyboard` | `tree` | `sr`).
- What the canvas [simulates](guide/styleguide-ui.md#simulate) (since 22.8.0). It applies when the URL names no simulation; a link that names one wins, see [Simulation](#simulation). A new session starts without one.

Writes are debounced by 200 ms, so rapid keystrokes in a text input do not thrash storage. On reload, a component's control values are applied only if their variant is still the one restored from the URL. That keeps stale values from leaking into a different variant. Capture mode reads none of this, so a screenshot shows the variant as declared.

> Layout, theme, the folded sidebar groups and the canvas settings (background, zoom, guides, rulers, the measuring tool and the viewport width) are kept separately in `localStorage` (`ng-prism-layout`, `ng-prism-theme`, `ng-prism-sidebar-collapsed`, `ng-prism-canvas`) and survive across browser sessions. None of them is in the URL, so a link opens with the reader's own settings.

## Opting Out

Disable each layer independently with [`urlState`](api/ng-prism-config.md#urlstate) and [`persistState`](api/ng-prism-config.md#persiststate):

```typescript
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    urlState: false, // disables URL sync
    persistState: false // disables sessionStorage for controls, a11y and the simulation
});
```

When `urlState` is `false`, the URL never changes and no state is read from it on load, so the simulation lasts through the session only. When `persistState` is `false`, control values and the a11y sub-tab reset on every reload, and the simulation is kept by the URL only.

## Related

- [Tour of the UI](guide/styleguide-ui.md): the views, tabs and tools these parameters address
- [External Tooling API](guide/external-tooling.md#navigating): driving the styleguide by URL from a script
- [`urlState`](api/ng-prism-config.md#urlstate) and [`persistState`](api/ng-prism-config.md#persiststate) in the NgPrismConfig reference
- [Canvas State](architecture/canvas-state.md#url-and-session-state): how the two layers are kept in sync, for contributors
