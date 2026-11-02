# NgPrismPlugin

The interfaces a plugin implements. A plugin is a plain object, usually returned by a factory function, with no base class. The types on this page are exported from `@ng-prism/core/plugin` and from `@ng-prism/core`.

How to build a plugin step by step is described in [Writing a Plugin](plugins/writing-plugins.md), when and where each hook runs in [Plugin Hooks](architecture/plugin-hooks.md). The objects the hooks and panels receive (`ScannedComponent`, `RuntimeComponent`, …) are in [Types](api/types.md), the components and helpers for a plugin's UI in [Plugin UI Kit](api/plugin-ui.md), and the services a panel injects in [Runtime Services](api/services.md).

## NgPrismPlugin

```typescript
interface NgPrismPlugin {
    name: string;

    // Build time, in Node.js
    onComponentScanned?: (component: ScannedComponent) => ScannedComponent | void | Promise<ScannedComponent | void>;
    onServiceScanned?: (service: ScannedService) => ScannedService | void | Promise<ScannedService | void>;
    onPipeScanned?: (pipe: ScannedPipe) => ScannedPipe | void | Promise<ScannedPipe | void>;
    onPageScanned?: (page: StyleguidePage) => StyleguidePage | void | Promise<StyleguidePage | void>;
    onManifestReady?: (manifest: PrismManifest) => PrismManifest | void | Promise<PrismManifest | void>;
    componentApi?: boolean; // experimental

    // Runtime contributions to the styleguide app
    panels?: PanelDefinition[];
    controls?: ControlDefinition[];
    headerWidgets?: HeaderWidgetDefinition[];
    navigationDecorations?: NavigationDecorationDefinition[];

    /** @deprecated since 22.6.0, removed in 23.0.0 */
    wrapComponent?: Type<unknown>;
}
```

The five hooks run in the Angular builder, in Node.js, on every build and on every rescan of `serve`, so they must not use browser APIs. They share one contract:

- **Return value.** Change the argument in place or return a new object. The next plugin receives what the previous one returned; returning nothing keeps the object as it is.
- **Async.** A hook may return a promise, and the build awaits it before it calls the next hook.
- **Order.** Plugins run in the order of [`plugins`](api/ng-prism-config.md#plugins): every component through `onComponentScanned`, then the services, the pipes and the pages through their hooks, and `onManifestReady` last. See [Hook execution order](architecture/plugin-hooks.md#hook-execution-order).
- **Errors.** A hook that throws fails the build with [`ng-prism: plugin "<name>" failed in <hook> for <target>`](api/build-warnings.md#a-plugin-hook-failed).

### `name`

**Required.** `string`. Names the plugin in build messages, such as a failed hook, and in the duplicate check: two plugins with the same `name` print [a warning](api/build-warnings.md#a-plugin-registered-twice). Use the package name, for example `'@my-org/plugin-todo'`.

### `onComponentScanned`

```typescript
onComponentScanned?: (component: ScannedComponent) => ScannedComponent | void | Promise<ScannedComponent | void>;
```

Called once per component or directive with `@Showcase`, with its [`ScannedComponent`](api/types.md#scannedcomponent). Services and pipes never reach it.

- **Parts** (since 22.7.0) arrive as components of their own, with `parentClassName` set. A plugin that builds something per page, as perf and visual regression do, skips them with `if (component.parentClassName) return;`, since the parent's page shows the part. One that reads every component's API, as jsdoc and coverage do, keeps them. See [Parts in the hooks](architecture/plugin-hooks.md#parts-in-the-hooks).
- **`api`** (since 22.7.0, experimental) is only there when a plugin in the config sets [`componentApi`](#componentapi). Read it with `?.`.
- **`composition`** (since 22.7.0, experimental) is read before the hooks run, so changing `template`, `host` or `imports` in a hook does not change what renders. To show the markup of a variant, replace [`COMPOSITION_SUBJECT_SLOT`](api/plugin-ui.md#constants-and-helpers) in the `template` of each case.

### `onServiceScanned`

```typescript
onServiceScanned?: (service: ScannedService) => ScannedService | void | Promise<ScannedService | void>;
```

Called once per [service](guide/services-and-pipes.md#services) with `@Showcase` (since 22.7.0), with its [`ScannedService`](api/types.md#scannedservice). Its `api` is the extracted API of the service, experimental. A service never reaches `onComponentScanned` and is not in `PrismManifest.components`: the manifest lists it in `services`.

The hook only runs when a plugin shows services, that is when some plugin has a view panel (`placement: 'view'`) whose `appliesTo` includes `'service'`, in practice `jsDocPlugin()` 22.7.0 or newer. Without one the build only counts the services: it reads neither their API nor their `setup`, so none of their messages appear, leaves them out of the manifest, runs no `onServiceScanned` and prints [a hint](api/build-warnings.md#no-plugin-shows-services). See [the gate](architecture/pipeline.md#_3-services-and-pipes-gate). The build reads `placement` and `appliesTo` from the panels of the plugin's Node entry, so a plugin with a separate browser entry declares both in both entries.

### `onPipeScanned`

```typescript
onPipeScanned?: (pipe: ScannedPipe) => ScannedPipe | void | Promise<ScannedPipe | void>;
```

Called once per [pipe](guide/services-and-pipes.md#pipes) with `@Showcase` (since 22.7.0), with its [`ScannedPipe`](api/types.md#scannedpipe). Its `api.transform` has one entry per overload signature of `transform`, experimental. A pipe never reaches `onComponentScanned` or `onServiceScanned` and is not in `PrismManifest.components`: the manifest lists it in `pipes`.

The hook only runs when a plugin shows pipes, decided apart from services: a view panel whose `appliesTo` includes `'pipe'`. A panel for services alone does not keep the pipes. Without one the build only counts the pipes, reads neither their API, their `setup` nor their `@Pipe` metadata, leaves them out of the manifest and prints [a hint](api/build-warnings.md#no-plugin-shows-pipes). As for services, a plugin with a browser entry declares `placement` and `appliesTo` in both entries.

### `onPageScanned`

```typescript
onPageScanned?: (page: StyleguidePage) => StyleguidePage | void | Promise<StyleguidePage | void>;
```

Called once per entry of [`pages`](api/ng-prism-config.md#pages) in the config, with its [`StyleguidePage`](api/types.md#styleguidepage). The scan finds no pages of its own, and a `ComponentPage` registered with `providePrism(…, { componentPages })` is added in the browser, so it never reaches this hook.

### `onManifestReady`

```typescript
onManifestReady?: (manifest: PrismManifest) => PrismManifest | void | Promise<PrismManifest | void>;
```

Called once per plugin, after all other hooks, with the [`PrismManifest`](api/types.md#prismmanifest). For changes across components, for filtering, and for library-wide values in `manifest.meta`, which a [header widget](#headerwidgetdefinition) reads in the browser.

- A [part](api/showcase-config.md#partof) is not in `manifest.components` here but in the `parts` of its parent (since 22.7.0). A filter on `components` drops a parent together with its parts.
- `manifest.services` and `manifest.pipes` are only there when a plugin shows services or pipes.
- The build adds `meta.a11y` from the a11y report after this hook, see [What the build adds](guide/a11y-reports.md#what-the-build-adds).

### `componentApi`

> **Experimental until 23.0.0**, like [`ComponentApi`](api/types.md#componentapi): it may change in a 22.x minor release.

`boolean` (since 22.7.0). Set it when a hook or a panel of the plugin reads `ScannedComponent.api`, which a panel finds at `activeComponent()?.meta.api`. Reading the API of every component costs scan time on each build and each rescan of `serve`, and its types make up a large part of the manifest, so the scan reads it, and the manifest carries it, only when a plugin in the config sets `componentApi: true`. `jsDocPlugin()` does, so a config with it needs nothing more.

The build reads the flag from the plugin's Node entry; a browser entry needs no copy. Even with it, a component can come without `api`: when the scan cannot read it ([a notice](api/build-warnings.md#a-component-api-that-cannot-be-read)) or when a hook builds the component from scratch. The API page of the JSDoc plugin then shows the component's `inputs` and `outputs` without type links.

### `panels`

`PanelDefinition[]`. Tabs below the canvas (`placement: 'addon'`) or views next to the Playground (`placement: 'view'`), see [`PanelDefinition`](#paneldefinition). The factory runs in Node.js too, so the whole array is built there: the build reads `placement`, `appliesTo` and `position` from it and never calls `loadComponent`. A plugin with a separate browser entry declares the same panels in both entries.

### `controls`

`ControlDefinition[]`. Custom controls for the Controls panel, see [`ControlDefinition`](#controldefinition).

### `headerWidgets`

`HeaderWidgetDefinition[]`. Components in the styleguide header for library-wide figures such as total coverage, see [`HeaderWidgetDefinition`](#headerwidgetdefinition). A widget usually shows a value the plugin's `onManifestReady` wrote into `manifest.meta`, drawn with the [metric badge](api/plugin-ui.md#metric-badge).

### `navigationDecorations`

`NavigationDecorationDefinition[]`. A marker on the sidebar entry of each component, for health signals that should be visible while browsing. Services, pipes and pages get none: `badge` is never called for them. The core's a11y marker and the markers of the coverage and visual regression plugins use the same extension point. See [`NavigationDecorationDefinition`](#navigationdecorationdefinition) and [Example: a complete navigation decoration plugin](#example-a-complete-navigation-decoration-plugin).

### `wrapComponent`

> **Deprecated since 22.6.0, removed in 23.0.0.** Nothing has ever read it, so setting it never had an effect. While a plugin sets it, the build prints [a notice](api/build-warnings.md#a-plugin-that-sets-wrapcomponent); remove it. A component that needs providers gets them from [`appProviders`](api/ng-prism-config.md#appproviders) or a [component page](guide/component-pages.md).

## PanelDefinition

A panel of a plugin, in [`NgPrismPlugin.panels`](#panels).

```typescript
interface PanelDefinition {
    id: string;
    label: string;
    component?: Type<unknown>;
    loadComponent?: () => Promise<Type<unknown>>;
    overlayComponent?: Type<unknown>;
    loadOverlayComponent?: () => Promise<Type<unknown>>;
    icon?: string;
    placement?: 'addon' | 'view';
    appliesTo?: readonly PanelTarget[];
    listsParts?: boolean; // experimental
    providers?: Provider[];
    isVisible?: (component: RuntimeComponent) => boolean;
    badge?: (component: RuntimeComponent) => PanelBadge | null;
    keepAlive?: boolean;
    /** @deprecated since 22.6.0, removed in 23.0.0 */
    position?: 'bottom' | 'right';
}
```

| Field                  | Description                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | **Required.** Unique among all panels. The URL carries the active addon panel as `panel` and the active view as `view`. The built-in panels are `controls`, `events`, `a11y` and the view `overview`, and the Playground is the view `renderer`. A plugin panel with one of these ids does not replace the built-in one |
| `label`                | **Required.** The text of the tab (addon) or of the entry in the view switch (view)                                                                                                                                                                                                                                     |
| `component`            | The panel component, imported statically. Prefer `loadComponent`, see the note below                                                                                                                                                                                                                                    |
| `loadComponent`        | The panel component, loaded when the panel is first opened. The build never calls it                                                                                                                                                                                                                                    |
| `overlayComponent`     | A component drawn over the canvas, inside `.demo-wrap`, while the panel is the active addon panel, such as the box model's annotations. It gets the input `rendererService` and the panel's `providers`. Not drawn in capture mode or while the measuring tool runs                                                     |
| `loadOverlayComponent` | The overlay component, loaded on first use                                                                                                                                                                                                                                                                              |
| `icon`                 | A name from [`ICON_NAMES`](api/plugin-ui.md#icons), shown on the tab of an addon panel                                                                                                                                                                                                                                  |
| `placement`            | `'addon'` (default): a tab below the canvas of a component page. `'view'`: an entry in the view switch next to Playground, which replaces the canvas                                                                                                                                                                    |
| `appliesTo`            | The pages the panel appears on: `['component']` (the default), `['service']`, `['pipe']` or several (since 22.7.0). See [Panels on service and pipe pages](#panels-on-service-and-pipe-pages)                                                                                                                           |
| `listsParts`           | The panel shows the [parts](api/showcase-config.md#partof) of the active component (since 22.7.0, experimental until 23.0.0). It gets the input `activePart`, and the popover of a part in the component head links to it. See [Panels that list parts](#panels-that-list-parts)                                        |
| `providers`            | Providers of a child `EnvironmentInjector` for this panel and its overlay, created once per panel                                                                                                                                                                                                                       |
| `isVisible`            | With it, a component page only offers the panel when it returns `true` for the active component. Not called on service and pipe pages                                                                                                                                                                                   |
| `badge`                | A [badge](#panelbadge) on the tab of an addon panel for the active component, `null` for none. Not called for view panels or on service and pipe pages                                                                                                                                                                  |
| `keepAlive`            | `true` keeps an addon panel alive across tab switches: it is created on first activation and then hidden instead of destroyed. For costly panels such as iframes or remote previews. Default `false`. Addon panels only                                                                                                 |
| `position`             | _Deprecated since 22.6.0, removed in 23.0.0._ It never had an effect, and the build prints [a notice](api/build-warnings.md#a-panel-that-sets-position) while a panel sets it. Where a panel appears is `placement`                                                                                                     |

An addon panel receives one input, `activeComponent` (`RuntimeComponent | null`). A view panel receives the inputs of the targets it names in `appliesTo`, see the table below, and `activePart` when it lists parts. A panel receives no other input, so it only declares the ones it asked for.

> **Note:** Prefer `loadComponent` over `component`. The builder loads the config, and every plugin it imports, in Node.js, so a static import of a component that uses `DomSanitizer` or a browser global at import time breaks the build. See [Writing a Plugin](plugins/writing-plugins.md).

### Panels on service and pipe pages

A [service or pipe](guide/services-and-pipes.md) page has no canvas, so it offers only the view panels that apply to it. `appliesTo` (a [`PanelTarget[]`](api/types.md#paneltarget), since 22.7.0) names where a panel appears. Without it a panel is a component panel.

| `appliesTo`                        | Component pages | Service pages      | Pipe pages         | A view panel receives                                                        |
| ---------------------------------- | --------------- | ------------------ | ------------------ | ---------------------------------------------------------------------------- |
| _unset_ or `['component']`         | yes             | no                 | no                 | input `activeComponent`                                                      |
| `['service']`                      | no              | yes, as a view tab | no                 | input `activeService`                                                        |
| `['pipe']`                         | no              | no                 | yes, as a view tab | input `activePipe`                                                           |
| `['component', 'service', 'pipe']` | yes             | yes, as a view tab | yes, as a view tab | one input per kind it names, the ones that do not apply on screen are `null` |

An addon panel (`placement: 'addon'`, the default) only ever appears below the canvas of a component page and receives `activeComponent` alone. For it, `appliesTo` only matters for `'component'`: with `['service']` or `['pipe']` it shows nowhere.

- **`activeService`** is a [`RuntimeService`](api/types.md#runtimeservice) or `null`. A panel reads the API of the service from `activeService()?.meta.api`, a `ServiceApi`, and its `className`, `provision`, `importPath` and `showcaseConfig` from `meta`.
- **`activePipe`** is a [`RuntimePipe`](api/types.md#runtimepipe) or `null`. A panel reads the signatures from `activePipe()?.meta.api.transform`, a `PipeApi`, and `className`, `pipeName`, `pure`, `importPath` and `showcaseConfig` from `meta`.
- **Only the inputs of the named targets.** A panel only receives the inputs of the targets it names, so a component panel never logs a warning about an input it does not declare.
- **`placement: 'view'`** is what a service or pipe page shows: its view switch, without Playground or Overview. A panel for services or pipes with `placement: 'addon'` has no area on those pages and never shows. A component view that is still selected when the reader opens a service or a pipe is not drawn there.
- **`isVisible` and `badge`** take a component and are only called on component pages. A service or pipe page offers every panel that applies to it.
- **The build reads this field, once per kind.** A service is read and goes into the manifest only when some plugin has a view panel that applies to services, and a pipe only when one applies to pipes, see [`onServiceScanned`](#onservicescanned) and [`onPipeScanned`](#onpipescanned). `jsDocPlugin()` 22.7.0 or newer has a panel that does both.

```typescript
panels: [
    {
        id: 'service-notes',
        label: 'Notes',
        placement: 'view',
        appliesTo: ['service'],
        loadComponent: () => import('./service-notes.component.js').then((m) => m.ServiceNotesComponent)
    }
];

@Component({
    selector: 'app-service-notes',
    template: `<h4>Notes for {{ activeService()?.meta.className }}</h4>`
})
export class ServiceNotesComponent {
    readonly activeService = input<RuntimeService | null>(null);
}
```

### Panels that list parts

A component can have [parts](guide/parts.md) (`@Showcase({ partOf })`, since 22.7.0): showcases without a page of their own that the page of their parent shows. A view panel that shows them sets `listsParts: true` and declares the input `activePart`. Experimental until 23.0.0: the shape may change in a 22.x minor release.

```typescript
export class ApiPanelComponent {
    readonly activeComponent = input<RuntimeComponent | null>(null);
    readonly activePart = input<string | null>(null);
}
```

- **`activePart`** is the key of the part to show, `null` for none: the class name of one of `activeComponent()?.parts` ([`RuntimePart[]`](api/types.md#runtimepart)), with `~2`, `~3`, … appended for the second and later part of one class name, in the order of `parts`. [`partKeys()`](api/plugin-ui.md#constants-and-helpers) computes the keys from the class names. The panel scrolls to the block of that part. The reader sets it through the `part` [URL parameter](guide/url-state.md#parts) or by following the link in the popover of a part in the component head.
- **A new value is a new request.** When the reader follows the link of the part the panel already shows, `activePart` turns `null` for one render and then names the part again, so a panel that scrolls whenever the input changes scrolls to the block once more.
- **Only panels with `listsParts` get it.** `activePart` goes to a view panel that sets `listsParts` and applies to `'component'`, nothing else, so a panel that does not declare the input never logs a warning about it.
- **One panel is the target.** Several panels may set `listsParts`; the link in the popover of a part and `part` in the URL address the first visible one, in registration order, built-in before plugin. The popover has no link when none is visible for the component.
- **The part does not stay.** Switching the component or the view sets `activePart` back to `null`, and it is not kept in the session.

## PanelBadge

A short marker on the tab of an addon panel, returned by [`PanelDefinition.badge`](#paneldefinition). A filled badge means one thing: open findings. Everything else is a plain figure.

```typescript
interface PanelBadge {
    kind?: 'count' | 'issues';
    text: string;
    tone?: 'primary' | 'warn' | 'danger';
    label?: string;
    /** @deprecated since 22.7.0, removed in 23.0.0 */
    variant?: 'default' | 'ok' | 'warn' | 'danger';
}
```

| Field     | Description                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`    | `'issues'`: a number of open findings, drawn as a pill in `tone` and hidden at `'0'`. `'count'` (default): a plain quantity, drawn as a muted figure without a fill. Since 22.7.0                                                                            |
| `text`    | **Required.** The figure. Keep it to a couple of characters, since the tab bar scrolls horizontally on a narrow panel                                                                                                                                        |
| `tone`    | Tone of an `issues` badge: `'danger'` (default) for findings that are failures, `'warn'` for ones that only need a look, `'primary'` for neutral news. Since 22.7.0                                                                                          |
| `label`   | Read after the tab's label by assistive technology: `'3 to review'` becomes "Visual Regression, 3 to review". Defaults to `text`. Since 22.7.0                                                                                                               |
| `variant` | _Deprecated since 22.7.0, removed in 23.0.0._ Still rendered: `'warn'` and `'danger'` become `kind: 'issues'` in that tone, `'default'` becomes `kind: 'count'`, and `'ok'` is not rendered. The browser console warns once per panel. Use `kind` and `tone` |

```typescript
badge: (component) => {
    const open = countOpenItems(component);
    return open ? { kind: 'issues', text: String(open), tone: 'danger', label: `${open} to review` } : null;
};
```

Two rules make the difference between a badge and decoration:

- **Return `null` when there is nothing to report.** A badge that is always there stops being a signal: a green `0` on every tab trains people to ignore the one tab showing `3`.
- **Keep it cheap and pure.** The callback runs during change detection. Read what the component's `meta` already holds; do not fetch, and do not inject, since a badge has no injection context.

The deprecation is described in [Upgrade Notes 22.x](guide/upgrade-notes-22.md#upgrading-to-2270).

## ControlDefinition

A custom control for the Controls panel, in [`NgPrismPlugin.controls`](#controls).

```typescript
interface ControlDefinition {
    matchType: (input: InputMeta) => boolean;
    component: Type<unknown>;
}
```

| Field       | Description                                                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchType` | **Required.** Called with the [`InputMeta`](api/types.md#inputmeta) of each input of the active component. Return `true` to use this control. The definitions of all plugins are asked in plugin order, and the first match wins over the built-in controls |
| `component` | **Required.** A standalone component, rendered in place of the whole row of the input (name, type and control). It receives two inputs, `inputMeta: InputMeta` and `rendererService: PrismRendererService`                                                  |

The control reads the current value from `rendererService().inputValues()[inputMeta().name]` and writes a new one with `rendererService().updateInput(inputMeta().name, value)`, see [`PrismRendererService`](api/services.md#prismrendererservice).

## HeaderWidgetDefinition

A component in the styleguide header, in [`NgPrismPlugin.headerWidgets`](#headerwidgets).

```typescript
interface HeaderWidgetDefinition {
    id: string;
    component?: Type<unknown>;
    loadComponent?: () => Promise<Type<unknown>>;
    placement?: 'start' | 'end';
    order?: number;
}
```

| Field           | Description                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | **Required.** Unique widget id                                                                                                                               |
| `component`     | The widget component, imported statically. Prefer `loadComponent`, as for panels                                                                             |
| `loadComponent` | The widget component, loaded when the header first renders it                                                                                                |
| `placement`     | `'start'`: after the brand block. `'end'` (default): in the actions area, before the build info, the theme switch and the layout menu                        |
| `order`         | Sort order within one placement, lower first. Default `0`. The built-in a11y badge has `-20`, the badges of the coverage and visual regression plugins `-10` |

A widget receives no inputs. It injects what it shows, usually [`PRISM_MANIFEST`](api/services.md#injection-tokens) for library-wide values in `manifest.meta` that the plugin's [`onManifestReady`](#onmanifestready) wrote. The header uses the dark token set in both themes, so a widget gets colours that fit it without code of its own; a popover that opens from a widget binds [`PrismThemeService.appTokens()`](api/services.md#prismthemeservice) to show the active theme again. The [metric badge](api/plugin-ui.md#metric-badge) is the component the built-in widgets render.

## NavigationDecorationDefinition

A source of markers on the sidebar entries of components, in [`NgPrismPlugin.navigationDecorations`](#navigationdecorations).

```typescript
interface NavigationDecorationDefinition {
    id: string;
    icon: string;
    order?: number;
    badge: (component: RuntimeComponent) => NavigationDecoration | null;
}
```

| Field   | Description                                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | **Required.** Unique id. Of two decorations with one id only the first is used, and the built-in `a11y` comes first, so a plugin cannot silence or restyle it by reusing its id                                                           |
| `icon`  | **Required.** A name from [`ICON_NAMES`](api/plugin-ui.md#icons). The built-in sources use `accessibility` (a11y), `camera` (visual regression) and `shield-check` (coverage)                                                             |
| `order` | Slot in the trailing marker group of a sidebar entry, lower further left. Default `0`. The markers sort by `order` alone, never by registration order, since their position names the source to the reader. See the reserved values below |
| `badge` | **Required.** The standing of a component for this source, a [`NavigationDecoration`](#navigationdecoration), or `null` for "nothing worth saying". Called for components only                                                            |

The built-in sources reserve these `order` values. Pick another one (`40`, `50`, …) for a new source, so its marker does not interleave with them:

| `order` | Source                                                   |
| ------- | -------------------------------------------------------- |
| `10`    | A11y (core)                                              |
| `20`    | Visual Regression (`@ng-prism/plugin-visual-regression`) |
| `30`    | Coverage (`@ng-prism/plugin-coverage`)                   |

A decoration follows three rules:

- **Return `null` for anything healthy.** `NavigationDecoration` has no `'ok'` variant, because a marker that is always there stops being a signal, as for a [panel badge](#panelbadge). A plugin whose own summary has an `ok` verdict returns `null` for it instead of passing it through.
- **Keep it cheap and pure.** `badge()` runs during change detection: read what `component.meta.showcaseConfig.meta` already holds, do not fetch and do not inject. A decoration has no injection context.
- **Decide the threshold at build time.** `badge()` sees one component, so it cannot know what counts as bad for the library as a whole. The plugin decides in `onComponentScanned`, where thresholds and aggregates are at hand, stores the verdict in `component.showcaseConfig.meta` under its own key, by convention as `summary: { variant, label }`, and `badge()` only reads it back. See [The two-zone principle](architecture/plugin-hooks.md#the-two-zone-principle).

## NavigationDecoration

What one source has to say about one component, returned by [`NavigationDecorationDefinition.badge`](#navigationdecorationdefinition).

```typescript
interface NavigationDecoration {
    variant: 'warn' | 'danger';
    label: string;
}
```

| Field     | Description                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant` | **Required.** Colour role. Only these two exist, see the rule "return `null` for anything healthy" above                                                                                |
| `label`   | **Required.** One tooltip line for this source, such as `'A11y: 2 critical, 1 serious'`. The labels of several sources on one component join with a newline in the tooltip of the entry |

---

## Example: a complete navigation decoration plugin

A self-contained plugin that flags components with open `// TODO` comments. It follows the same three-file split every shipped plugin with a build-time hook uses. This example mirrors `packages/plugin-coverage/src/coverage-plugin.ts`, `coverage-plugin.browser.ts` and `coverage-contributions.ts`.

The split exists because the generated Prism app imports the config directly (see the schematic that wires it in, `packages/ng-prism/src/schematics/ng-add/index.ts`), so the config module and every plugin it imports also land in the browser bundle, in addition to the Node.js process that runs the builder. A plugin file with a top-level `import { readFileSync } from 'node:fs'` crashes as soon as that bundle loads it, even though `onComponentScanned` never runs in the browser.

Three files close that gap:

- **`todo-marker-contributions.ts`**: no `node:` imports, no Angular. Declares the `navigationDecorations` entry once, so both entries below share the exact same `badge()` and can't drift apart.
- **`todo-marker-plugin.ts`**: the **Node entry**, resolved when the builder loads the config. Carries `onComponentScanned`. Still no _static_ `node:` import: `readFileSync` is loaded with a dynamic `import()` inside the hook, the same shape `coverage-plugin.ts` uses to load `coverage-reader.js`. A dynamic import only executes when the hook actually runs, which is never in a browser bundle.
- **`todo-marker-plugin.browser.ts`**: the **browser entry**, resolved when the Prism app itself loads the config. No build-time hooks at all, only the runtime contribution, reading back whatever the Node entry already wrote to `meta` during the last build.

```typescript
// todo-marker-contributions.ts: shared by both entries, dependency-free
import type { NavigationDecorationDefinition, RuntimeComponent } from '@ng-prism/core/plugin';

export interface TodoSummary {
    variant: 'warn' | 'danger';
    label: string;
}

export interface TodoMeta {
    count: number;
    /** Pre-derived verdict, written by the build-time hook in todo-marker-plugin.ts. */
    summary?: TodoSummary;
}

function todoMeta(component: RuntimeComponent): TodoMeta | undefined {
    return component.meta.showcaseConfig.meta?.['todo'] as TodoMeta | undefined;
}

export const TODO_NAVIGATION_DECORATION: NavigationDecorationDefinition = {
    id: 'todo',
    icon: 'file-text',
    order: 40,
    badge: (component) => {
        const todo = todoMeta(component);
        return todo?.summary ? { variant: todo.summary.variant, label: todo.summary.label } : null;
    }
};
```

```typescript
// todo-marker-plugin.ts: Node entry, loaded by the builder
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { TODO_NAVIGATION_DECORATION, type TodoMeta } from './todo-marker-contributions.js';

export function todoMarkerPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo-marker',

        // Build time only: count `// TODO` markers and decide the verdict once,
        // here and not in `badge()`, which never sees more than one component and
        // cannot know what "too many" means for the library as a whole.
        async onComponentScanned(component) {
            const { readFileSync } = await import('node:fs');
            const source = readFileSync(component.filePath, 'utf-8');
            const count = (source.match(/\/\/\s*TODO/g) ?? []).length;

            const todo: TodoMeta = {
                count,
                ...(count > 0
                    ? {
                          summary: {
                              variant: count >= 5 ? 'danger' : 'warn',
                              label: `${count} open TODO${count === 1 ? '' : 's'}`
                          }
                      }
                    : {})
            };

            return {
                ...component,
                showcaseConfig: {
                    ...component.showcaseConfig,
                    meta: { ...component.showcaseConfig.meta, todo }
                }
            };
        },

        navigationDecorations: [TODO_NAVIGATION_DECORATION]
    };
}
```

```typescript
// todo-marker-plugin.browser.ts: browser entry, loaded by the Prism app itself
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { TODO_NAVIGATION_DECORATION } from './todo-marker-contributions.js';

export function todoMarkerPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo-marker',
        // Runtime only: read the pre-derived verdict back. No file access, no
        // computation, no build-time hooks. Just the shared contribution.
        navigationDecorations: [TODO_NAVIGATION_DECORATION]
    };
}
```

The two entries are the same exported function name in two files; a `"browser"` export condition in `package.json` picks between them so consumers write one import and get whichever twin fits where their bundle runs:

```json
{
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "browser": "./dist/index.browser.js",
            "import": "./dist/index.js",
            "default": "./dist/index.js"
        }
    }
}
```

`packages/plugin-coverage/package.json` and `packages/plugin-visual-regression/package.json` carry the shipped version of this map: each `index.ts` re-exports the Node entry, each `index.browser.ts` re-exports the browser entry. See [Plugin Hooks](architecture/plugin-hooks.md#navigation-decorations) for why the threshold decision has to live in the Node entry's hook and never in `badge()`.
