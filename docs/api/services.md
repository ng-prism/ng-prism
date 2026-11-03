# Runtime Services

The services of the styleguide app, for component pages, plugin panels, header widgets and custom controls. Each is provided in `root`, so `inject()` reaches it anywhere in the app. Import them from `@ng-prism/core`.

```typescript
import { PrismRendererService } from '@ng-prism/core';

export class MyPanelComponent {
    private readonly renderer = inject(PrismRendererService);
}
```

A member typed `WritableSignal` can be set, but most have a method that does more than set the signal (clamp, save, reset). Use the method where there is one.

## PrismManifestService

The runtime manifest: every component, service, pipe and page of the styleguide.

| Member                     | Type                                      | Description                                                                                                                                                |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                 | `Signal<RuntimeManifest>`                 | The [runtime manifest](api/types.md#runtimemanifest). After a rescan of `serve` the page reloads with the new one; `updateManifest()` replaces it in place |
| `components`               | `Signal<RuntimeComponent[]>`              | Every component and directive. A part is not in the list but in the `parts` of its parent                                                                  |
| `services`                 | `Signal<RuntimeService[]>`                | Every showcased [service](guide/services-and-pipes.md#services), `[]` when no plugin shows services                                                        |
| `pipes`                    | `Signal<RuntimePipe[]>`                   | Every showcased [pipe](guide/services-and-pipes.md#pipes), `[]` when no plugin shows pipes                                                                 |
| `pages`                    | `Signal<StyleguidePage[]>`                | The custom pages of the config and the component pages registered with `providePrism()`                                                                    |
| `categories`               | `Signal<string[]>`                        | The categories of the components and pages, `'Uncategorized'` for none, sorted by the lowest `categoryOrder` of a component in them, then alphabetically   |
| `groupedByCategory`        | `Signal<Map<string, RuntimeComponent[]>>` | The components by category, `'Uncategorized'` for none                                                                                                     |
| `updateManifest(manifest)` | `void`                                    | Replaces the manifest                                                                                                                                      |

### enablePrismHmr

```typescript
function enablePrismHmr(appRef: ApplicationRef, newManifest: RuntimeManifest): void;
```

A function, not a service: it hands a new manifest to `PrismManifestService.updateManifest()` through the root injector of `appRef`, so the styleguide shows it without a page reload and keeps the open component. The `main.ts` that `ng add` writes calls it from an `import.meta.hot` hook for the manifest module. That hook only runs where the dev server delivers a module update for the manifest; Angular 22's dev server reloads the page after a rescan instead, so under `serve` it does not run, see [Watching and reloading](api/builders.md#watching-and-reloading).

```typescript
import { enablePrismHmr } from '@ng-prism/core';

// In the HMR accept handler of the manifest module:
enablePrismHmr(appRef, mod.PRISM_RUNTIME_MANIFEST);
```

## PrismNavigationService

What is open: a component, service, pipe or page.

| Member                    | Type                                     | Description                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeItem`              | `WritableSignal<NavigationItem \| null>` | The open [`NavigationItem`](api/types.md#navigationitem). Set it through the `select` methods                                                                                                                                                                                                                                                                    |
| `activeComponent`         | `Signal<RuntimeComponent \| null>`       | The component of `activeItem`, looked up by class name in the current manifest, so it follows a rescan. `null` when another kind is open or the manifest no longer has it                                                                                                                                                                                        |
| `activeService`           | `Signal<RuntimeService \| null>`         | The same for a service                                                                                                                                                                                                                                                                                                                                           |
| `activePipe`              | `Signal<RuntimePipe \| null>`            | The same for a pipe                                                                                                                                                                                                                                                                                                                                              |
| `activePage`              | `Signal<StyleguidePage \| null>`         | The same for a page, looked up by title and type                                                                                                                                                                                                                                                                                                                 |
| `activeTarget`            | `Signal<PanelTarget \| null>`            | `'component'`, `'service'` or `'pipe'` for the open item, `null` for a page or when nothing is open                                                                                                                                                                                                                                                              |
| `sectionTree`             | `Signal<SectionNode[]>`                  | The sidebar tree of the components, services and pipes that match the search: sections (`name`, `order`, `totalCount`, `categories`), each with its categories (`name`, `items: NavigationItem[]`), sorted by `sectionOrder`, `categoryOrder` and `componentOrder`, see [Identity and sidebar](api/showcase-config.md#identity-and-sidebar). Pages are not in it |
| `parentOfPart(className)` | `RuntimeComponent \| undefined`          | The component that has a part of that class name (since 22.7.0). A part has no page of its own, so its parent's page is where it opens                                                                                                                                                                                                                           |
| `select(comp)`            | `void`                                   | Opens a `RuntimeComponent`                                                                                                                                                                                                                                                                                                                                       |
| `selectService(service)`  | `void`                                   | Opens a `RuntimeService`                                                                                                                                                                                                                                                                                                                                         |
| `selectPipe(pipe)`        | `void`                                   | Opens a `RuntimePipe`                                                                                                                                                                                                                                                                                                                                            |
| `selectPage(page)`        | `void`                                   | Opens a `StyleguidePage`                                                                                                                                                                                                                                                                                                                                         |
| `selectFirst()`           | `void`                                   | Opens the first page that matches the search, else the first component, service or pipe, in that order; nothing when none matches                                                                                                                                                                                                                                |

## PrismRendererService

The variant, the state and the input values of the component on the canvas, and the elements it rendered.

| Member                           | Type                                                            | Description                                                                                                                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeVariantIndex`             | `WritableSignal<number>`                                        | Index of the active variant, 0-based                                                                                                                                                                                                                                                           |
| `activeStateIndex`               | `WritableSignal<number \| null>`                                | Position in [`states`](api/showcase-config.md#states) of the component-level state on the canvas, `null` for none. Reset when the variant or the component changes                                                                                                                             |
| `inputValues`                    | `WritableSignal<Record<string, unknown>>`                       | The current input values: the defaults of the inputs, then the inputs of the variant, then the changes made in the Controls panel                                                                                                                                                              |
| `activeContent`                  | `WritableSignal<string \| Record<string, string> \| undefined>` | The `content` of the variant that the canvas projects into the component; `undefined` for a directive and for a variant with a composition                                                                                                                                                     |
| `renderedElement`                | `WritableSignal<Element \| null>`                               | The root DOM element of what is rendered: the component, the host of a directive's wrapper, or the whole [composition](guide/compositions.md) when the variant has a `template` or a host template                                                                                             |
| `subjectElement`                 | `Signal<Element \| null>`                                       | The element of the showcased component or directive inside `renderedElement`, itself included: in a composition the one the generated wrapper marks with `data-prism-subject`, else `renderedElement`. `null` while nothing is rendered (since 22.7.0)                                         |
| `dirtyInputCount`                | `Signal<number>`                                                | How many input values differ from those of the active variant. The Controls panel shows its Reset button while it is above zero                                                                                                                                                                |
| `resetForComponent(comp)`        | `void`                                                          | Full reset: variant 0, no state, the inputs and the content of variant 0                                                                                                                                                                                                                       |
| `reconcileForComponent(comp)`    | `void`                                                          | Runs on every navigation to a component, in any view, and again when the canvas mounts. A full reset when `comp` is another component than the last one; otherwise it keeps the variant and the state where the component still has them, keeps the changed inputs and fills in input defaults |
| `selectVariant(index)`           | `void`                                                          | Changes the variant, applies its inputs and clears the active state (since 22.7.0). Select a state after the variant                                                                                                                                                                           |
| `selectState(index)`             | `void`                                                          | Sets `activeStateIndex`; `null` clears the state                                                                                                                                                                                                                                               |
| `updateInput(name, value)`       | `void`                                                          | Sets one input value, merged into `inputValues`                                                                                                                                                                                                                                                |
| `resetInputsToVariantDefaults()` | `void`                                                          | Applies the inputs of the active variant again and drops the changes made in the Controls panel                                                                                                                                                                                                |

`renderedElement` stays the root of everything the canvas renders. In a composition that is the frame and every other element as well, so a tool that measures, audits or captures the picture reads it. Use `subjectElement` when you mean the showcased element itself, for instance for its role or its label. Outside a composition the two are the same element.

A [component page](guide/component-pages.md) reacts to the Controls panel through `inputValues()`:

```typescript
readonly rowCount = computed(() => (this.renderer.inputValues()['rowCount'] as number) ?? 0);
```

## PrismSearchService

The sidebar search. A match is case-insensitive and ignores surrounding spaces; an empty query matches everything.

| Member               | Type                         | Description                                                                                             |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `query`              | `WritableSignal<string>`     | The search query. Set it through `search()` and `clear()`                                               |
| `filteredComponents` | `Signal<RuntimeComponent[]>` | The components whose title, category, tags, class name or selector match, or one of whose parts matches |
| `filteredServices`   | `Signal<RuntimeService[]>`   | The services whose title, category, tags or class name match                                            |
| `filteredPipes`      | `Signal<RuntimePipe[]>`      | The pipes whose title, category, tags, class name or pipe name match                                    |
| `filteredPages`      | `Signal<StyleguidePage[]>`   | The pages whose title or category match                                                                 |
| `search(q)`          | `void`                       | Sets the query                                                                                          |
| `clear()`            | `void`                       | Clears the query                                                                                        |

## PrismEventLogService

The output events the component on the canvas emitted, which the Events panel lists.

| Member             | Type                              | Description                     |
| ------------------ | --------------------------------- | ------------------------------- |
| `events`           | `WritableSignal<EventLogEntry[]>` | The logged events, newest first |
| `log(name, value)` | `void`                            | Adds an event                   |
| `clear()`          | `void`                            | Removes all events              |

```typescript
interface EventLogEntry {
    id: number; // counts up from 0
    timestamp: number; // Date.now()
    name: string;
    value: unknown;
}
```

The canvas calls `log()` for every output of the component it renders. It does not for the component of a page that [`renderPage`](api/showcase-config.md#renderpage) opens, so such a page calls `log()` itself to fill the Events panel. `EventLogEntry` is exported from `@ng-prism/core` as a type.

## PrismLayoutService

The visibility and the sizes of sidebar, variant rail and addon panel. It keeps them in `localStorage` under the key `ng-prism-layout`.

| Member                | Type                                  | Description                                                                               |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `sidebarVisible`      | `WritableSignal<boolean>`             | Whether the sidebar is visible. Default `true`                                            |
| `addonsVisible`       | `WritableSignal<boolean>`             | Whether the addon panel area is visible. Default `true`                                   |
| `toolbarVisible`      | `WritableSignal<boolean>`             | Whether the variant rail, the variant ribbon above the canvas, is visible. Default `true` |
| `addonsOrientation`   | `WritableSignal<'bottom' \| 'right'>` | Where the addon panel area sits. Default `'bottom'`                                       |
| `sidebarWidth`        | `WritableSignal<number>`              | Sidebar width in pixels, 200–360, default 280                                             |
| `panelHeight`         | `WritableSignal<number>`              | Height of the addon panel in pixels when it sits at the bottom, 200–560, default 300      |
| `panelWidth`          | `WritableSignal<number>`              | Width of the addon panel in pixels when it sits on the right, 200–600, default 320        |
| `toggleSidebar()`     | `void`                                | Shows or hides the sidebar                                                                |
| `toggleAddons()`      | `void`                                | Shows or hides the addon panel area                                                       |
| `toggleToolbar()`     | `void`                                | Shows or hides the variant rail (`Alt+T`)                                                 |
| `toggleOrientation()` | `void`                                | Moves the addon panel area between bottom and right                                       |
| `setSidebarWidth(px)` | `void`                                | Sets the sidebar width, clamped to its range                                              |
| `setPanelHeight(px)`  | `void`                                | Sets the panel height, clamped to its range                                               |
| `setPanelWidth(px)`   | `void`                                | Sets the panel width, clamped to its range                                                |

The methods save the layout; setting a signal directly does not.

## PrismThemeService

The colour mode and the theme tokens. It keeps the mode in `localStorage` under the key `ng-prism-theme`, sets `data-theme` on `<html>`, writes the resolved tokens onto `document.documentElement` and sets the favicon.

| Member                         | Type                                | Description                                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme`                        | `WritableSignal<'dark' \| 'light'>` | The active mode. Default `'dark'`, or `'light'` when that is the stored choice                                                                                                                                                                                                       |
| `isDark`                       | `Signal<boolean>`                   | Whether the active mode is `'dark'`                                                                                                                                                                                                                                                  |
| `appTokens`                    | `Signal<Record<string, string>>`    | Every token of the active mode, with the overrides of the config (since 22.7.0). The header renders with the dark set, so a popover that opens from a header widget binds this as `[style]` to show the active theme again                                                           |
| `headerTokens`                 | `Signal<Record<string, string>>`    | The dark set with the `theme` and `darkTheme` overrides (since 22.7.0). The header binds it on its host: it is a navy band in both themes                                                                                                                                            |
| `toggle()`                     | `void`                              | Switches between dark and light                                                                                                                                                                                                                                                      |
| `applyConfigOverrides(config)` | `void`                              | Applies `theme`, `darkTheme` and `lightTheme` from the config; `PrismShellComponent` calls it at startup. An override of a deprecated token goes to its successor where it has one, and the console warns once per token (since 22.7.0), see [`theme`](api/ng-prism-config.md#theme) |

## PrismPluginService

The contributions of the plugins in `NgPrismConfig.plugins`, in plugin order. The built-in panels, header widgets and navigation decorations are not in these lists.

| Member                  | Type                                       | Description                                            |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `panels`                | `Signal<PanelDefinition[]>`                | Every panel of every plugin                            |
| `addonPanels`           | `Signal<PanelDefinition[]>`                | The panels with `placement` other than `'view'`        |
| `viewPanels`            | `Signal<PanelDefinition[]>`                | The panels with `placement: 'view'`                    |
| `controls`              | `Signal<ControlDefinition[]>`              | Every custom control of every plugin                   |
| `headerWidgets`         | `Signal<HeaderWidgetDefinition[]>`         | Every header widget of every plugin, sorted by `order` |
| `headerWidgetsStart`    | `Signal<HeaderWidgetDefinition[]>`         | The header widgets with `placement: 'start'`           |
| `headerWidgetsEnd`      | `Signal<HeaderWidgetDefinition[]>`         | The header widgets with `placement: 'end'` or none     |
| `navigationDecorations` | `Signal<NavigationDecorationDefinition[]>` | Every navigation decoration of every plugin            |

The definitions are described in [NgPrismPlugin](api/ng-prism-plugin.md).

## PrismUrlStateService

Keeps what is open in the URL: the component, service, pipe or page, the variant, the state, the view, the part and the addon panel, see [URL parameters](guide/url-state.md#url-parameters).

| Member   | Type   | Description                                                                                                                                                           |
| -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init()` | `void` | Restores the state from the URL, then writes every change back and listens for `popstate`. Does nothing when [`urlState`](api/ng-prism-config.md#urlstate) is `false` |

## PrismPersistenceService

Keeps the input values of each component visited, with the variant they belong to, and the active tab and perspective of the A11y panel, in `sessionStorage` under the key `ng-prism:state`.

| Member   | Type   | Description                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init()` | `void` | Restores the input values of the open component when its variant is the stored one, then saves every change, 200 ms after the last one. Does nothing when [`persistState`](api/ng-prism-config.md#persiststate) is `false` and in capture mode. An unreadable entry, a full storage or a browser without `sessionStorage` leave the styleguide working without it |

`PrismShellComponent` calls `PrismUrlStateService.init()` and then `PrismPersistenceService.init()` at startup. Layout, theme and canvas settings are kept by their own services in `localStorage`. What survives a reload, and how, is described in [Links & State](guide/url-state.md).

## Injection tokens

| Token                  | Type                                 | Exported from                             | Description                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRISM_MANIFEST`       | `InjectionToken<RuntimeManifest>`    | `@ng-prism/core`, `@ng-prism/core/plugin` | The runtime manifest `providePrism()` was called with, including the component pages it registered. It keeps that value when `updateManifest()` replaces the manifest in place, which `PrismManifestService.manifest()` follows |
| `PRISM_CONFIG`         | `InjectionToken<NgPrismConfig>`      | `@ng-prism/core`, `@ng-prism/core/plugin` | The config `providePrism()` was called with, `{}` without one: in the browser, the config `main.ts` imports, with the browser entries of the plugins                                                                            |
| `PRISM_RENDERER_HOOKS` | `InjectionToken<PrismRendererHooks>` | `@ng-prism/core/plugin`, `@ng-prism/core` | Optional, not provided by default. Callbacks around each render of the Playground canvas, provided through [`appProviders`](api/ng-prism-config.md#appproviders)                                                                |

```typescript
interface PrismRendererHooks {
    onBeforeCreate?(selector: string): void;
    onAfterCreate?(selector: string): void;
    onAfterDestroy?(selector: string): void;
}
```

`onBeforeCreate` runs before the canvas creates the component, with its selector; `onAfterCreate` after the inputs are set and the first change detection ran. `onAfterDestroy` runs after the canvas removed what it rendered, with an empty string. A page that `renderPage` opens gets only `onAfterDestroy`. The Overview does not call them.

```typescript
import { defineConfig } from '@ng-prism/core/config';
import { PRISM_RENDERER_HOOKS, type PrismRendererHooks } from '@ng-prism/core/plugin';

const hooks: PrismRendererHooks = {
    onAfterCreate: (selector) => performance.mark(`rendered ${selector}`)
};

export default defineConfig({
    appProviders: [{ provide: PRISM_RENDERER_HOOKS, useValue: hooks }]
});
```
