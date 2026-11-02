# Writing a Plugin

A plugin is a plain JavaScript object conforming to the `NgPrismPlugin` interface. Use `defineConfig()` for type safety on the config and return the plugin object from a factory function.

## The NgPrismPlugin Interface

```typescript
interface NgPrismPlugin {
    name: string;

    // Build-time hooks (run in Node.js)
    onComponentScanned?: (component: ScannedComponent) => ScannedComponent | void | Promise<ScannedComponent | void>;
    onServiceScanned?: (service: ScannedService) => ScannedService | void | Promise<ScannedService | void>;
    onPipeScanned?: (pipe: ScannedPipe) => ScannedPipe | void | Promise<ScannedPipe | void>;
    onPageScanned?: (page: StyleguidePage) => StyleguidePage | void | Promise<StyleguidePage | void>;
    onManifestReady?: (manifest: PrismManifest) => PrismManifest | void | Promise<PrismManifest | void>;
    componentApi?: boolean; // experimental: have the scan read ScannedComponent.api

    // Runtime contributions (run in the browser)
    panels?: PanelDefinition[];
    controls?: ControlDefinition[];
    wrapComponent?: Type<unknown>; // deprecated, no effect
}
```

## Build-Time Hooks

Build-time hooks run inside the Angular builder (Node.js). They must not import browser-only APIs.

### `onComponentScanned`

Called once per `@Showcase`-decorated component after the scanner extracts all metadata. Mutate the component object to add or change data, or return a new object. Returning `void` keeps the original.

```typescript
export function myPlugin(): NgPrismPlugin {
    return {
        name: 'my-plugin',
        onComponentScanned(component) {
            // Add extra metadata for the runtime panel to consume
            component.meta = {
                ...component.meta,
                myPlugin: {
                    customData: computeSomething(component)
                }
            };
        }
    };
}
```

A [part](guide/showcase-decorator.md#partof) (since `22.7.0`) runs through this hook as a component with `parentClassName`. A plugin that writes data for a page, as perf and visual-regression do, skips it with `if (component.parentClassName) return;`: the parent's page shows the part, so there is no page of its own to build, measure or photograph. A plugin that reads every component's API, as jsdoc and coverage do, keeps it. See [Parts in the hooks](architecture/plugin-hooks.md#parts-in-the-hooks).

`component.api` (since `22.7.0`) holds the extracted API of the component or directive: the type of each input, the payload of each output, the documented methods and the types they reach, see [`ComponentApi`](api/types.md#componentapi). The scan only reads it when a plugin in the config sets `componentApi: true` (`jsDocPlugin()` does), so a plugin that reads it sets the flag itself, in its Node entry:

```typescript
export function apiStatsPlugin(): NgPrismPlugin {
    return {
        name: 'api-stats',
        componentApi: true,
        onComponentScanned(component) {
            return { ...component, meta: { ...component.meta, methodCount: component.api?.methods.length ?? 0 } };
        }
    };
}
```

Its shape, and the flag, are experimental until 23.0.0 and may change in a 22.x minor release. It is absent without such a plugin, when the scan cannot read it, and on a component that another hook built from scratch; `className`, `inputs`, `outputs`, `showcaseConfig` and `meta` are stable. Keep your own data in `meta` and read `component.api` with `?.`, knowing it can change.

### `onServiceScanned`

Called once per `@Showcase`-decorated [service](guide/showcasing-services.md), with the `ScannedService`. Same pattern as `onComponentScanned`, and a service never goes through that hook: it has its own list, `manifest.services`.

```typescript
onServiceScanned(service) {
  return {
    ...service,
    meta: { ...service.meta, myPlugin: { setupEntries: service.api.setup.length } },
  };
}
```

`service.api` holds the extracted API (members, setup, types). Its shape is experimental until 23.0.0 and may change in a 22.x minor release; `className`, `importPath`, `showcaseConfig`, `provision` and `meta` are stable. The hook only runs when some plugin has a panel that [applies to services](#panels-for-services-and-pipes), otherwise the build only counts the services, without reading them, and leaves them out.

### `onPipeScanned`

Called once per `@Showcase`-decorated [pipe](guide/showcasing-pipes.md), with the `ScannedPipe`. Same pattern as `onServiceScanned`, and a pipe never goes through that hook or `onComponentScanned`: it has its own list, `manifest.pipes`.

```typescript
onPipeScanned(pipe) {
  return {
    ...pipe,
    meta: { ...pipe.meta, myPlugin: { signatures: pipe.api.transform.length } },
  };
}
```

`pipe.api` holds the extracted API (`transform` signatures, setup, types). Its shape is experimental until 23.0.0 and may change in a 22.x minor release; `className`, `pipeName`, `pure`, `importPath`, `showcaseConfig` and `meta` are stable. The hook only runs when some plugin has a panel that [applies to pipes](#panels-for-services-and-pipes), otherwise the build only counts the pipes, without reading them, and leaves them out. Services and pipes are decided apart: a panel for services alone does not keep the pipes.

### `onPageScanned`

Called once per `StyleguidePage` (both `CustomPage` and `ComponentPage`). Same mutation pattern as `onComponentScanned`.

```typescript
onPageScanned(page) {
  if (page.type === 'custom') {
    page.data = { ...page.data, processedAt: Date.now() };
  }
}
```

### `onManifestReady`

Called once with the full `PrismManifest` after all components and pages have been processed. Use for cross-component transformations or manifest-level additions.

```typescript
onManifestReady(manifest) {
  manifest.components = manifest.components.filter(
    (c) => !c.showcaseConfig.tags?.includes('internal'),
  );
}
```

A part (since `22.7.0`) is not in `manifest.components` here but in its parent's `parts`, so a plugin that walks the list reads `component.parts` as well when it must include parts, and the filter above drops a parent together with its parts. See [Parts in the hooks](architecture/plugin-hooks.md#parts-in-the-hooks).

### Async Hooks

All four hooks support returning a `Promise`. The pipeline awaits them before continuing.

```typescript
async onComponentScanned(component) {
  const data = await fetchExternalMetadata(component.className);
  component.meta = { ...component.meta, external: data };
}
```

## Runtime Contributions

Runtime contributions are evaluated in the browser. Do not place Node.js-only code here.

### `panels`

An array of `PanelDefinition` objects. Each registers a new panel tab.

```typescript
panels: [
  {
    id: 'my-panel',
    label: 'My Panel',
    loadComponent: () => import('./my-panel.component.js').then(m => m.MyPanelComponent),
    placement: 'addon',
  },
],
```

See [PanelDefinition](api/ng-prism-plugin.md#paneldefinition) for all fields.

#### Panels for services and pipes

A [service](guide/showcasing-services.md) or [pipe](guide/showcasing-pipes.md) page (since `22.7.0`) has no canvas, so it offers only the view panels that say they apply to it. Without `appliesTo` (since `22.7.0`), a panel is a component panel and does not appear there.

```typescript
panels: [
  {
    id: 'service-notes',
    label: 'Notes',
    placement: 'view',
    appliesTo: ['service'],
    loadComponent: () => import('./service-notes.component.js').then(m => m.ServiceNotesComponent),
  },
],
```

- `appliesTo: ['component']` is the default, `['service']` is for services only, `['pipe']` for pipes only, and a list names several, for example `['component', 'service', 'pipe']`.
- The panel component gets the input `activeService` (`RuntimeService | null`) when it applies to services, `activePipe` (`RuntimePipe | null`) when it applies to pipes, and `activeComponent` when it applies to components. It only gets the inputs of the targets it names, so a panel written before services and pipes existed is not affected.
- Use `placement: 'view'`: a service or pipe page shows view tabs only. An addon panel appears on component pages alone, so for it `appliesTo` only decides whether it applies to `'component'`: with `['service']` or `['pipe']` it shows nowhere.
- `isVisible` and `badge` take a component and are only called on component pages.
- The build reads `placement` and `appliesTo` from the panels the plugin's **Node entry** declares, to decide whether anything shows services or pipes: only a view panel that applies to services counts for services, and one that applies to pipes for pipes. A plugin with a [browser entry](api/ng-prism-plugin.md#example-a-complete-navigation-decoration-plugin) declares the same `placement` and `appliesTo` in both.

```typescript
@Component({
    selector: 'app-service-notes',
    standalone: true,
    template: `<h4>Notes for {{ activeService()?.meta.className }}</h4>`
})
export class ServiceNotesComponent {
    readonly activeService = input<RuntimeService | null>(null);
}
```

`activeService()?.meta.api` is the extracted API of the service (`ServiceApi`, experimental until 23.0.0). On a pipe page, a panel with `appliesTo: ['pipe']` declares `readonly activePipe = input<RuntimePipe | null>(null);` and reads `activePipe()?.meta.api.transform` (`PipeApi`, experimental until 23.0.0) and `activePipe()?.meta.pipeName`. On a component page, a panel reads `activeComponent()?.meta.api` (`ComponentApi`, experimental until 23.0.0). The manifest only carries it when a plugin in the config sets `componentApi: true`, so a plugin whose panel reads it sets the flag in its Node entry; it is also absent on a component that a hook built from scratch.

#### Panels that list parts

A component can have [parts](guide/showcase-decorator.md#partof) (`@Showcase({ partOf })`, since `22.7.0`), which have no page of their own. `RuntimeComponent.parts` holds them, and a view panel that shows them sets `listsParts: true` (since `22.7.0`, experimental until `23.0.0`):

```typescript
panels: [
  {
    id: 'api',
    label: 'API',
    placement: 'view',
    listsParts: true,
    loadComponent: () => import('./api-panel.component.js').then(m => m.ApiPanelComponent),
  },
],
```

- The panel component gets the input `activePart` (`string | null`) next to `activeComponent`: the key of the part to show, `null` for none. The key is the part's class name, and `~2`, `~3`, … appended for the second and later part of one class name, in the order of `parts`; `partKeys(parts)` from `@ng-prism/core/plugin` gives the keys of a component's parts. It scrolls to the block of that part. Declare `readonly activePart = input<string | null>(null);`.
- Only a panel with `listsParts` gets it, so a panel that does not declare the input never logs a warning about it.
- `activePart` follows the `part` [URL parameter](guide/url-state.md#parts), and a part's popover in the component head links to the first visible panel with `listsParts`. Switching the component or the view sets it back to `null`. Following the link of the part the panel already shows sets it to `null` for one render and then to the part again, so scrolling whenever the input changes is enough.
- See [Panels that list parts](api/ng-prism-plugin.md#panels-that-list-parts) for the details.

### `controls`

An array of `ControlDefinition` objects. Each registers a custom input control for inputs whose type matches `matchType`.

```typescript
controls: [
  {
    matchType: (input) => input.rawType === 'ColorValue',
    component: ColorPickerControlComponent,
  },
],
```

The Controls panel checks registered `ControlDefinition` entries in plugin registration order before falling back to the built-in controls.

### `wrapComponent`

> **Deprecated since 22.6.0, removed in 23.0.0.** `wrapComponent` has been on `NgPrismPlugin` since the first release, but nothing has ever read it, so setting it never had an effect. While a plugin sets it, the build prints a notice; remove it. A component that needs providers gets them from `defineConfig({ appProviders })` or a [component page](guide/component-pages.md).

## Header and Panel Widgets

`@ng-prism/core` (the main entry, not `@ng-prism/core/plugin`) exports two presentational components for building a `headerWidgets` entry or a panel's own chrome, so a plugin does not have to invent its own metric pill or reimplement icon rendering:

```typescript
import { PrismMetricBadgeComponent, PrismIconComponent } from '@ng-prism/core';
```

On a phone (since 22.7.0) the header shows the widgets in a strip of their own, which scrolls sideways once the brand name has shortened as far as it can. Keep a widget to one compact pill, as `PrismMetricBadgeComponent` draws it.

### `PrismMetricBadgeComponent`

The pill every built-in header widget (a11y, coverage, visual regression) renders through.

| Input     | Type                         | Required | Description                                                                                                           |
| --------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `icon`    | `string`                     | yes      | Icon name from the registry. Reuse the same one the source uses for its `navigationDecorations` marker and panel tab. |
| `value`   | `string`                     | yes      | Already-formatted figure, e.g. `'87%'`.                                                                               |
| `label`   | `string`                     | yes      | Metric name, composed into the accessible name as `"label: value"`.                                                   |
| `title`   | `string`                     | no       | Tooltip text. Defaults to `label`.                                                                                    |
| `variant` | `'ok' \| 'warn' \| 'danger'` | no       | Colour role. Default `'ok'`, which draws no accent colour at all.                                                     |

### `PrismIconComponent`

Renders one glyph from the same registry `PanelDefinition.icon` resolves against, as a sized inline `<svg>`.

| Input  | Type     | Required | Description                                 |
| ------ | -------- | -------- | ------------------------------------------- |
| `name` | `string` | yes      | Icon name from the registry (`ICON_NAMES`). |
| `size` | `number` | no       | Width/height in pixels. Default `16`.       |

### Example

```typescript
// coverage-header-badge.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PRISM_MANIFEST, type RuntimeManifest, statusFor, thresholdFromTarget } from '@ng-prism/core/plugin';
import { PrismMetricBadgeComponent } from '@ng-prism/core';

@Component({
    selector: 'prism-coverage-header-badge',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismMetricBadgeComponent],
    template: `
        @if (data(); as d) {
            <prism-metric-badge icon="shield-check" label="Library coverage" [value]="d.score + '%'" [variant]="d.variant" />
        }
    `
})
export class CoverageHeaderBadgeComponent {
    private readonly manifest = inject<RuntimeManifest>(PRISM_MANIFEST);
    protected readonly data = computed(() => {
        const meta = this.manifest.meta?.['coverage'] as { total?: { found: boolean; score: number } } | undefined;
        return meta?.total?.found ? { score: meta.total.score, variant: statusFor(meta.total.score, thresholdFromTarget(80)) } : null;
    });
}
```

Registered like any other `headerWidgets` entry; see [`HeaderWidgetDefinition`](api/ng-prism-plugin.md#headerwidgetdefinition). Full field reference: [`PrismMetricBadgeComponent`](api/plugin-ui.md#metric-badge) and [`PrismIconComponent`](api/plugin-ui.md#icons).

## PanelDefinition Fields

| Field                  | Type                  | Description                                                                                                                                                             |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `string`              | Unique panel identifier                                                                                                                                                 |
| `label`                | `string`              | Tab label                                                                                                                                                               |
| `component`            | `Type<unknown>`       | Static panel component                                                                                                                                                  |
| `loadComponent`        | `() => Promise<Type>` | Lazy-loaded panel component (use when importing browser-only APIs)                                                                                                      |
| `overlayComponent`     | `Type<unknown>`       | Canvas overlay component                                                                                                                                                |
| `loadOverlayComponent` | `() => Promise<Type>` | Lazy-loaded canvas overlay                                                                                                                                              |
| `icon`                 | `string`              | Icon name (optional)                                                                                                                                                    |
| `position`             | `'bottom' \| 'right'` | _Deprecated since 22.6.0, removed in 23.0.0. Never had an effect; where a panel appears is `placement`._                                                                |
| `placement`            | `'addon' \| 'view'`   | `addon` = bottom tab bar, `view` = top view toolbar                                                                                                                     |
| `appliesTo`            | `PanelTarget[]`       | `['component']` (default), `['service']`, `['pipe']` or several (since `22.7.0`), see [Panels for services and pipes](#panels-for-services-and-pipes)                   |
| `listsParts`           | `boolean`             | The panel shows the parts of the active component and gets the input `activePart` (since `22.7.0`, experimental), see [Panels that list parts](#panels-that-list-parts) |
| `badge`                | `(c) => PanelBadge`   | Marker on the panel's tab for the active component, `null` for nothing to report, see [`PanelBadge`](api/ng-prism-plugin.md#panelbadge)                                 |
| `providers`            | `Provider[]`          | Providers scoped to this panel's injector                                                                                                                               |

> **Note:** Always use `loadComponent` rather than `component` if your panel component imports anything from `@angular/platform-browser` or any other browser-only package. The config file is loaded in Node.js during the build, and a static import of a browser component crashes the builder.

## Example: Minimal Panel Plugin

```typescript
// my-notes-plugin.ts
import type { NgPrismPlugin } from '@ng-prism/core/plugin';

export function myNotesPlugin(): NgPrismPlugin {
    return {
        name: 'my-notes-plugin',
        panels: [
            {
                id: 'notes',
                label: 'Notes',
                loadComponent: () => import('./notes-panel.component.js').then((m) => m.NotesPanelComponent),
                placement: 'addon'
            }
        ]
    };
}
```

```typescript
// notes-panel.component.ts
import { Component, inject } from '@angular/core';
import { PrismNavigationService } from '@ng-prism/core';

@Component({
    selector: 'app-notes-panel',
    standalone: true,
    template: `
        <div class="notes">
            <h4>Notes for {{ componentTitle() }}</h4>
            <textarea placeholder="Write notes here…"></textarea>
        </div>
    `
})
export class NotesPanelComponent {
    private readonly nav = inject(PrismNavigationService);

    componentTitle() {
        return this.nav.activeComponent()?.meta.showcaseConfig.title ?? '—';
    }
}
```

## Panel Guidelines

Since `22.7.0` every built-in panel follows the same eight rules. A plugin panel that follows them too looks like part of the styleguide in both themes, and the [UI primitives](api/plugin-ui.md#ui-primitives) from `@ng-prism/core` do most of the work:

- **P1 Toolbar only when there is something to put in it.** `prism-panel-toolbar` is 36 px high, sub-tabs in `[toolbarStart]`, actions in `[toolbarEnd]`. A panel without sub-tabs or actions has no toolbar. No meta text in it: timestamps, thresholds, sizes and counts go into tooltips.
- **P2 Sub-tabs** are `prism-tabs` with `size="sm"`.
- **P3 Measured values** are `prism-metric-card`: label, status badge, value with unit and optionally a bar with a threshold tick. No visible subtitle; details such as bytes, the threshold or branch counts are the card's `title`.
- **P4 Colour carries a verdict.** A graded value takes its status colour (`statusFor` from `@ng-prism/core/plugin`, then `toneForStatus`), a plain quantity stays in `--prism-primary`. The brand gradient is for the brand, not for data bars or rings.
- **P5 Lists** are `prism-list-row`: badge, title, description and meta on the right. A selected row is tinted (`selected`), without a coloured left border.
- **P6 Content** has 16 × 18 px of padding on a 12 px grid and follows the height the panel is dragged to. Charts and images fit instead of being cut off.
- **P7 Surface:** the panel's background is `--prism-bg-surface`, embeds included.
- **P8 Actions** sit on the right of the toolbar as `button[prismButton]` (`sm`, 26 px), secondary before primary.

On a phone (since 22.7.0) a panel spans the screen, about 390 px wide, below the canvas. Lay it out against its own width with container queries (`container-type: inline-size` on the panel's root), not against the viewport with media queries: the built-in controls panel stacks its rows below 520 px that way, and the same panel then also fits a narrow desktop window.

```typescript
// budget-panel.component.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PrismButtonComponent, PrismMetricCardComponent, PrismPanelToolbarComponent, type PrismTabItem, PrismTabsComponent, toneForStatus } from '@ng-prism/core';
import { type RuntimeComponent, statusFor } from '@ng-prism/core/plugin';

@Component({
    selector: 'my-budget-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismPanelToolbarComponent, PrismTabsComponent, PrismButtonComponent, PrismMetricCardComponent],
    template: `
        <prism-panel-toolbar>
            <prism-tabs toolbarStart size="sm" ariaLabel="Budget" [items]="tabs" [(active)]="tab" />
            <span toolbarEnd>
                <button prismButton type="button">Export</button>
                <button prismButton variant="primary" type="button">Measure</button>
            </span>
        </prism-panel-toolbar>
        <div class="budget">
            <prism-metric-card
                label="Size"
                unit="kb"
                [value]="size().toFixed(1)"
                [tone]="tone()"
                [statusLabel]="tone() === 'success' ? 'OK' : 'Over'"
                [fraction]="size() / 20"
                [threshold]="0.5"
                [title]="'Budget: 10 kb'" />
        </div>
    `,
    styles: `
        :host {
            display: block;
            background: var(--prism-bg-surface);
        }
        .budget {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
            padding: 16px 18px;
        }
    `
})
export class BudgetPanelComponent {
    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected readonly tabs: PrismTabItem[] = [
        { id: 'size', label: 'Size' },
        { id: 'history', label: 'History' }
    ];
    protected readonly tab = signal<string | null>('size');

    protected readonly size = computed(() => (this.activeComponent()?.meta.showcaseConfig.meta?.['sizeKb'] as number | undefined) ?? 0);
    protected readonly tone = computed(() => toneForStatus(statusFor(this.size(), { ok: 10, warn: 12.5, direction: 'lower' })));
}
```

## Example: Custom Control Plugin

```typescript
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { ColorSwatchControlComponent } from './color-swatch-control.component.js';

export function colorSwatchPlugin(): NgPrismPlugin {
    return {
        name: 'color-swatch-plugin',
        controls: [
            {
                matchType: (input) => input.rawType?.startsWith('Color') === true || input.name.toLowerCase().includes('color'),
                component: ColorSwatchControlComponent
            }
        ]
    };
}
```

The `ColorSwatchControlComponent` receives `inputMeta` and `rendererService` as inputs from the Controls panel, so there is no need to `inject()` the service:

```typescript
@Component({
    selector: 'app-color-swatch-control',
    standalone: true,
    template: ` <input type="color" [value]="currentValue()" (change)="onChange($event)" /> `
})
export class ColorSwatchControlComponent {
    readonly inputMeta = input.required<InputMeta>();
    readonly rendererService = input.required<PrismRendererService>();

    currentValue = computed(() => (this.rendererService().inputValues()[this.inputMeta().name] as string) ?? '#000000');

    onChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.rendererService().updateInput(this.inputMeta().name, value);
    }
}
```
