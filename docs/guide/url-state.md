# Links & State

ng-prism keeps the UI state alive across full-page reloads, which helps a lot during component-driven development. Two layers cooperate:

- **URL** carries shareable state (component, service or pipe, variant, state, view, the part a view shows, panel tab), so links are bookmarkable and deep-linkable.
- **sessionStorage** carries per-session ephemeral state (control panel input overrides, a11y sub-tab, perspective) and keeps it off the URL.

After editing a SCSS file in your library and waiting for the dev-server reload, you land back on the same component, same variant, with the same control overrides applied. No more clicking your way back to where you were.

## URL Parameters

| Parameter   | Example                        | Description                                                                                                                                                                                               |
| ----------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component` | `?component=ButtonComponent`   | Active component class name                                                                                                                                                                               |
| `service`   | `?service=NotificationService` | Active [service](guide/showcasing-services.md) class name. Services have their own parameter, so a tool that sets `?component=` never lands on one                                                        |
| `pipe`      | `?pipe=TimeAgoPipe`            | Active [pipe](guide/showcasing-pipes.md) class name. Pipes have their own parameter as well, so neither `?component=` nor `?service=` lands on one                                                        |
| `page`      | `?page=Button%20Patterns`      | Active page title (URL-encoded)                                                                                                                                                                           |
| `variant`   | `?variant=1`                   | Active variant index (0-based)                                                                                                                                                                            |
| `state`     | `?state=1`                     | Active component-level state: the 0-based index into the component's `states`. Written only while a state is active; a value that is no index into `states` is ignored.                                   |
| `view`      | `?view=overview`               | Active view tab (e.g. `overview`, `docs`, `a11y`)                                                                                                                                                         |
| `part`      | `?part=OptionComponent`        | The [part](guide/showcase-decorator.md#partof) of the component that the active view shows, as its class name (since 22.7.0), `~2` appended for a second part of the same class name. See [Parts](#parts) |
| `panel`     | `?panel=a11y`                  | Active addon panel tab (default: `controls`, omitted when default)                                                                                                                                        |
| `capture`   | `?capture=1`                   | Read-only input flag. Enables [capture isolation mode](guide/external-tooling.md#capture-isolation-mode) for screenshot tooling. Never written back to the URL.                                           |

Example URL:

```
http://localhost:4200?component=ButtonComponent&variant=2&view=docs&panel=a11y
```

A service page is addressed by `service` and a pipe page by `pipe`, with the view tab in `view`. The API tab of the JSDoc plugin has the id `jsdoc`:

```
http://localhost:4200?service=NotificationService&view=jsdoc
http://localhost:4200?pipe=TimeAgoPipe&view=jsdoc
```

`variant` and `state` mean nothing for a service or a pipe and are never written for one. When a URL carries more than one of `component`, `service`, `pipe` and `page`, the first in that order wins. A class name that is not a service or pipe in the manifest is ignored, like an unknown component.

## Parts

A [part](guide/showcase-decorator.md#partof) (`@Showcase({ partOf })`, since 22.7.0) has no page of its own, so there is no `component` to select for it. Its class name still works as an address, and `part` carries what it shows:

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

## Deep-Linking

Share a URL pointing directly to a specific component and variant. Anyone opening the link lands on the same state.

```
http://localhost:4200?component=AlertComponent&variant=1
```

Add `state` to open the variant in one of the component's `states` (`@Showcase({ states })`):

```
http://localhost:4200?component=AlertComponent&variant=1&state=1
```

The state is part of the address next to the variant. It stays in the URL when you switch variants, and goes when you switch components.

## Browser Back/Forward

Selecting another component or page pushes a new browser history entry. Changing the variant, the state, the view, the shown part or the panel tab rewrites the current entry instead, so stepping through variants does not fill the history. The browser back and forward buttons move between components and pages, and an entry holds the variant, state, view, part and panel its component was last left in.

Selecting a component in the sidebar opens it on the Playground, whichever view tab the page before showed (since 22.7.0; before, the view stayed from one component to the next while the next one offered it). A link, a reload and the back and forward buttons open the view their URL names, so going back returns to the Overview or API tab an entry was left on.

The sidebar keeps the open component, service, pipe or page in sight (since 22.7.0). After a link, a reload or a step back or forward it scrolls the entry into the middle of the list and opens its group if that was collapsed. An entry already in sight stays where it is, so a click in the sidebar never moves the list.

## Control Panel & A11y State (sessionStorage)

URL state does not carry control panel overrides, since long input strings would bloat every link. Instead, ng-prism mirrors these to `sessionStorage` under the key `ng-prism:state`:

- Control input overrides, keyed by `className` + `variantIndex`. Each component keeps its own bucket; switching components does not discard the others.
- A11y panel `activeTab` (`violations` | `keyboard` | `tree` | `sr`) and `perspective` (`visual` | `screen-reader`).

Writes are debounced 200ms, so rapid keystrokes in a text input do not thrash storage. On reload, the persisted bucket is applied only if the persisted `variantIndex` still matches the active variant restored from the URL. That keeps stale overrides from leaking into a different variant.

> Layout, theme, and canvas (zoom/background) are persisted independently to `localStorage` by their own services (`ng-prism-layout`, `ng-prism-theme`, `ng-prism-canvas`) and survive across browser sessions.

## Opting Out

Disable each layer independently:

```typescript
export default defineConfig({
    urlState: false, // disables URL sync
    persistState: false // disables sessionStorage for controls + a11y
});
```

When `urlState` is `false`, the URL never changes and no state is read from it on load. When `persistState` is `false`, control overrides and the a11y sub-tab reset on every reload.

## How It Works

`PrismUrlStateService` reads the URL on startup via `window.location.search` and sets the initial navigation state. It then subscribes to navigation signal changes and calls `history.pushState()` (or `replaceState()` when only sub-state changes) to keep the URL in sync.

`PrismPersistenceService` reads `sessionStorage` after the URL service has selected the active component, then applies persisted control values that match the current `className` + `variantIndex`. It subscribes to the same signals and debounce-writes back on change. Schema-version, corrupted JSON, quota-exceeded, and missing-`sessionStorage` are all handled gracefully without crashing the app.

Both services are initialized automatically by `PrismShellComponent` in this order: `urlStateService.init()`, then `persistenceService.init()`. If you use a custom shell component (`appComponent`), call them manually during bootstrap:

```typescript
@Component({ ... })
export class MyShellComponent {
  constructor() {
    inject(PrismUrlStateService).init();
    inject(PrismPersistenceService).init();
  }
}
```
