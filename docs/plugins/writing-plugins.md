# Writing a Plugin

A plugin is a plain object, returned by a factory function and typed as `NgPrismPlugin` from `@ng-prism/core/plugin`. This page builds one step by step: a plugin that finds the `// TODO` comments in the source file of each component, lists them in a panel, shows their total in the header and marks components with open TODOs in the sidebar. The last steps add a custom control and package the plugin for npm.

Every field is described in [NgPrismPlugin](api/ng-prism-plugin.md), when and where the hooks run in [Plugin Hooks](architecture/plugin-hooks.md), and how a panel should look in [Panel Design](plugins/panel-design.md).

## Create the factory

```typescript
// todo-plugin.ts
import type { NgPrismPlugin } from '@ng-prism/core/plugin';

export function todoPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo'
    };
}
```

[`name`](api/ng-prism-plugin.md#name) is the only required field. Build messages name the plugin by it, and two plugins with the same `name` print [a warning](api/build-warnings.md#a-plugin-registered-twice), so use the package name. A factory, rather than a constant, lets the plugin take options, which its hooks then close over.

A project registers the plugin in its config, like an official one:

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { todoPlugin } from '@my-org/plugin-todo';

export default defineConfig({
    plugins: [todoPlugin()]
});
```

The object can carry these fields. The steps below add most of them:

| Field                                                                   | What it adds                                                                                      | Where it runs                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`onComponentScanned`](api/ng-prism-plugin.md#oncomponentscanned)       | Reads or changes the data of each component, for example to add what a panel shows                | Build, in Node.js                                                       |
| [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned)           | The same for each [service](guide/services-and-pipes.md#services)                                 | Build, in Node.js                                                       |
| [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned)                 | The same for each [pipe](guide/services-and-pipes.md#pipes)                                       | Build, in Node.js                                                       |
| [`onPageScanned`](api/ng-prism-plugin.md#onpagescanned)                 | The same for each entry of [`pages`](api/ng-prism-config.md#pages) in the config                  | Build, in Node.js                                                       |
| [`onManifestReady`](api/ng-prism-plugin.md#onmanifestready)             | Reads or changes the whole manifest before it is written, for example to add library-wide figures | Build, in Node.js                                                       |
| [`componentApi`](api/ng-prism-plugin.md#componentapi)                   | Asks the scan for the API of each component (experimental)                                        | Build, in Node.js                                                       |
| [`panels`](api/ng-prism-plugin.md#panels)                               | Tabs below the canvas, or views next to the Playground                                            | Styleguide, in the browser; the build reads `placement` and `appliesTo` |
| [`controls`](api/ng-prism-plugin.md#controls)                           | Input controls of its own in the Controls panel                                                   | Styleguide, in the browser                                              |
| [`headerWidgets`](api/ng-prism-plugin.md#headerwidgets)                 | Components in the styleguide header                                                               | Styleguide, in the browser                                              |
| [`navigationDecorations`](api/ng-prism-plugin.md#navigationdecorations) | Markers on the sidebar entries of components                                                      | Styleguide, in the browser                                              |

## Write `meta` in a hook

The build-time hooks run in the Angular builder, in Node.js, on every build and on every rescan of `serve`. The TODO plugin reads the source file of each component in `onComponentScanned` and keeps what it found in the component's `showcaseConfig.meta`, under a key of its own. `onManifestReady` then adds the total for the whole library to `manifest.meta`:

```typescript
// todo-plugin.ts
import type { NgPrismPlugin } from '@ng-prism/core/plugin';

export interface TodoMeta {
    todos: { line: number; text: string }[];
}

export function todoPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo',

        async onComponentScanned(component) {
            if (component.parentClassName) return; // a part: the page of its parent shows it

            const { readFile } = await import('node:fs/promises');
            const lines = (await readFile(component.filePath, 'utf-8')).split('\n');
            const todo: TodoMeta = {
                todos: lines.flatMap((text, index) => (/\/\/\s*TODO/.test(text) ? [{ line: index + 1, text: text.trim() }] : []))
            };

            return {
                ...component,
                showcaseConfig: { ...component.showcaseConfig, meta: { ...component.showcaseConfig.meta, todo } }
            };
        },

        onManifestReady(manifest) {
            const total = manifest.components.reduce((sum, component) => sum + ((component.showcaseConfig.meta?.['todo'] as TodoMeta | undefined)?.todos.length ?? 0), 0);

            return { ...manifest, meta: { ...manifest.meta, todo: { total } } };
        }
    };
}
```

- **Return a new object, or change the argument and return nothing.** The next plugin gets what this one returned. A hook may be `async`: the build waits for it before it calls the next one. The order of the hooks and of the plugins is under [Hook Execution Order](architecture/plugin-hooks.md#hook-execution-order).
- **One key of your own.** `showcaseConfig.meta` also holds what the author wrote in [`@Showcase({ meta })`](api/showcase-config.md#meta), so an author can give your plugin options per component under your key, as the [Figma](plugins/figma.md) plugin reads `meta.figma`. Panels and sidebar markers read the data back from `activeComponent()?.meta.showcaseConfig.meta`. `ScannedComponent.meta` is a second object for plugin data, which reaches the browser too; the official plugins all use `showcaseConfig.meta`.
- **Plain data only.** The manifest that carries `meta` to the browser is generated source code: strings, numbers, booleans, arrays and plain objects arrive as written, functions, dates and class instances do not.
- **`manifest.meta`** holds values for the whole library, such as the TODO total, which a [header widget](#add-a-header-widget) shows. `onManifestReady` runs once per plugin, after all other hooks. When there is an a11y report, the build adds `meta.a11y` after it, see [What the build adds](guide/a11y-reports.md#what-the-build-adds).
- **Parts.** A [part](guide/parts.md) goes through `onComponentScanned` as a component with `parentClassName`. A plugin that reports per page, like this one, skips it, since the page of its parent shows the part; one that reads the API of every component keeps it. In `onManifestReady` a part is not in `manifest.components` but in the `parts` of its parent, see [Parts in the Hooks](architecture/plugin-hooks.md#parts-in-the-hooks).
- **Node.js modules** make this file a Node.js-only file. The config, and the plugin with it, is bundled for the browser too, so a plugin that uses them gets a second, browser entry. The styleguide build fails until you split the entries, which [Node and browser entry points](#node-and-browser-entry-points) does after the panel below.
- **A hook that throws** fails the build with [`ng-prism: plugin "<name>" failed in <hook> for <target>`](api/build-warnings.md#a-plugin-hook-failed).

The other hooks follow the same pattern. [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned) and [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned) get each service and pipe, but only while some plugin shows them with a [view panel](#panels-for-services-and-pipes). [`onPageScanned`](api/ng-prism-plugin.md#onpagescanned) gets each entry of `pages` in the config, a `CustomPage`; a component page registered with `providePrism()` never reaches it. A hook or a panel that reads `component.api` sets [`componentApi: true`](api/ng-prism-plugin.md#componentapi).

## Add a panel

A panel is a tab below the canvas (`placement: 'addon'`, the default) or a view in the view switch next to the Playground (`placement: 'view'`). The TODO plugin lists the comments of the active component in a tab. Declare the component with `loadComponent`, so it is only loaded when the panel first opens:

```typescript
// todo-plugin.ts
export function todoPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo',
        // onComponentScanned and onManifestReady as above
        panels: [
            {
                id: 'my-org-todo',
                label: 'TODOs',
                icon: 'file-text',
                loadComponent: () => import('./todo-panel.component.js').then((m) => m.TodoPanelComponent)
            }
        ]
    };
}
```

The panel component receives the active component as the input `activeComponent` and reads what the hook wrote:

```typescript
// todo-panel.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PrismListRowComponent } from '@ng-prism/core';
import type { RuntimeComponent } from '@ng-prism/core/plugin';
import type { TodoMeta } from './todo-plugin.js';

@Component({
    selector: 'my-todo-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismListRowComponent],
    template: `
        @for (todo of todos(); track todo.line) {
            <prism-list-row>
                <span rowTitle>{{ todo.text }}</span>
                <span rowMeta>line {{ todo.line }}</span>
            </prism-list-row>
        } @empty {
            <p class="empty">No open TODO comments.</p>
        }
    `,
    styles: `
        :host {
            display: block;
            padding: 16px 18px;
            background: var(--prism-bg-surface);
        }
        .empty {
            margin: 0;
            color: var(--prism-text-muted);
        }
    `
})
export class TodoPanelComponent {
    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected readonly todos = computed(() => (this.activeComponent()?.meta.showcaseConfig.meta?.['todo'] as TodoMeta | undefined)?.todos ?? []);
}
```

- **`id`** is unique among all panels. The built-in panels are `controls`, `events`, `a11y` and the view `overview`, and a plugin panel with one of these ids does not replace the built-in one, so give yours a prefix.
- **Inputs.** An addon panel receives `activeComponent` (`RuntimeComponent | null`) and nothing else. The selected variant, its input values and the rendered element come from [`PrismRendererService`](api/services.md#prismrendererservice), which the panel injects.
- **A badge on the tab**, such as the number of open TODOs, comes from `badge`, and `isVisible` offers the panel only for some components. Both take the component, see [`PanelDefinition`](api/ng-prism-plugin.md#paneldefinition) and [`PanelBadge`](api/ng-prism-plugin.md#panelbadge).
- **The look** of a built-in panel comes from the components of the [Plugin UI Kit](api/plugin-ui.md#ui-primitives), here `prism-list-row`, and the rules in [Panel Design](plugins/panel-design.md).

### Panels for services and pipes

A [service or pipe](guide/services-and-pipes.md) page has no canvas and offers only the view panels that apply to it. Such a panel sets `placement: 'view'` and `appliesTo`, for example `['service']` or `['component', 'service', 'pipe']`, and declares one input for each kind it names: `activeService`, `activePipe` or `activeComponent`. Services and pipes only go into the manifest, and `onServiceScanned` and `onPipeScanned` only run, while some plugin has such a panel, so a plugin with two entries declares it in both, see [Node and browser entry points](#node-and-browser-entry-points). The table of targets and inputs is under [Panels on service and pipe pages](api/ng-prism-plugin.md#panels-on-service-and-pipe-pages).

### Panels that list parts

A view panel that shows the [parts](guide/parts.md) of a component sets `listsParts: true` (since 22.7.0, experimental until 23.0.0) and declares the input `activePart`: the key of the part the reader asked for, `null` for none. The keys of the parts come from [`partKeys()`](api/plugin-ui.md#partkeys), which takes their class names: `partKeys((activeComponent()?.parts ?? []).map((part) => part.meta.className))`. Scroll to the block of the part whenever the input changes. The rules are under [Panels that list parts](api/ng-prism-plugin.md#panels-that-list-parts).

## Node and browser entry points

The builder loads `ng-prism.config.ts` in Node.js to run the hooks. The styleguide app imports the same file: the `main.ts` that `ng add` writes hands it to `providePrism()`, so the config and every plugin it imports are bundled for the browser as well. A plugin file that imports a Node.js module such as `node:fs/promises` breaks that bundle, although no hook ever runs there: the bundler resolves a dynamic `import()` with a fixed path as well as a static one.

So the official plugins with build-time hooks ship two entry points, and the TODO plugin does the same with three files:

- **`todo-contributions.ts`** holds the runtime contributions and `TodoMeta`. It imports no Node.js module, and no Angular component other than through `loadComponent`. Both entries import the contributions from here, so they cannot drift apart, and the panel component imports `TodoMeta` from here now.
- **`todo-plugin.ts`** is the Node entry, which the builder loads. It carries the hooks and the contributions, and it may use Node.js modules. The coverage and visual regression plugins load theirs with a dynamic `import()` inside the hook, so they are only loaded when the hook runs.
- **`todo-plugin.browser.ts`** is the browser entry, which the styleguide app loads. It carries the contributions only and reads back what the Node entry wrote into `meta` during the build.

```typescript
// todo-contributions.ts: shared by both entries
import type { PanelDefinition } from '@ng-prism/core/plugin';

export interface TodoMeta {
    todos: { line: number; text: string }[];
}

export const TODO_PANEL: PanelDefinition = {
    id: 'my-org-todo',
    label: 'TODOs',
    icon: 'file-text',
    loadComponent: () => import('./todo-panel.component.js').then((m) => m.TodoPanelComponent)
};
```

```typescript
// todo-plugin.ts: the Node entry
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { TODO_PANEL, type TodoMeta } from './todo-contributions.js';

export function todoPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo',
        async onComponentScanned(component) {
            // as in "Write meta in a hook"
        },
        onManifestReady(manifest) {
            // as in "Write meta in a hook"
        },
        panels: [TODO_PANEL]
    };
}
```

```typescript
// todo-plugin.browser.ts: the browser entry
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { TODO_PANEL } from './todo-contributions.js';

export function todoPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-todo',
        panels: [TODO_PANEL]
    };
}
```

**Both entries declare the same panels.** The factory runs in Node.js too, so the whole `panels` array is built there, and the build reads `placement` and `appliesTo` from it, besides the hooks and `componentApi`. It never calls `loadComponent`. A panel for services or pipes that only the browser entry declares therefore never gets them: the build sees no panel that shows them and leaves them out. The browser entry needs neither the hooks nor `componentApi`. What runs where is listed under [Node and Browser](architecture/plugin-hooks.md#node-and-browser).

Prefer `loadComponent` to `component` in both entries. A component imported statically is loaded with the Node entry, so anything it needs the browser for at import time breaks the build.

The two entries export a factory of the same name. A `browser` condition in the `exports` of `package.json` picks one, so a project writes one import and gets the entry that fits where its bundle runs:

```json
{
    "type": "module",
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.ts",
            "browser": "./dist/index.browser.js",
            "import": "./dist/index.js",
            "default": "./dist/index.js"
        }
    }
}
```

`index.ts` re-exports the Node entry and `index.browser.ts` the browser entry, as in the coverage and visual regression plugins. Both conditions share one `index.d.ts`, so both files export the same names: a name only the Node entry exports type-checks in the styleguide app and then fails its bundle.

A plugin without Node.js code needs one entry only: the Figma and Box Model plugins ship one.

## Add a header widget

A header widget shows a figure for the whole library, here the TODO total that `onManifestReady` wrote into `manifest.meta`. Add its definition to the contributions and `headerWidgets: [TODO_HEADER_WIDGET]` to both entries:

```typescript
// todo-contributions.ts
import type { HeaderWidgetDefinition } from '@ng-prism/core/plugin';

export const TODO_HEADER_WIDGET: HeaderWidgetDefinition = {
    id: 'my-org-todo-total',
    placement: 'end',
    order: 10,
    loadComponent: () => import('./todo-header-badge.component.js').then((m) => m.TodoHeaderBadgeComponent)
};
```

`placement: 'end'`, the default, puts the widget in the actions area, before the build info, the theme switch and the layout menu; `'start'` puts it after the brand. Within one placement the widgets sort by `order`, lower first: the built-in a11y badge has `-20`, the badges of the coverage and visual regression plugins `-10`, so `10` comes after them. See [`HeaderWidgetDefinition`](api/ng-prism-plugin.md#headerwidgetdefinition).

A widget receives no inputs: it injects what it shows. The [metric badge](api/plugin-ui.md#metric-badge) of `@ng-prism/core` draws it like the built-in ones, and [`statusFor()`](api/plugin-ui.md#status-grading) grades the figure, here as a budget where fewer is better:

```typescript
// todo-header-badge.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrismManifestService, PrismMetricBadgeComponent } from '@ng-prism/core';
import { statusFor } from '@ng-prism/core/plugin';

@Component({
    selector: 'my-todo-header-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismMetricBadgeComponent],
    template: `<prism-metric-badge icon="file-text" label="Open TODOs" shortLabel="TODO" [value]="total().toString()" [variant]="variant()" />`
})
export class TodoHeaderBadgeComponent {
    private readonly manifest = inject(PrismManifestService).manifest;

    protected readonly total = computed(() => (this.manifest().meta?.['todo'] as { total: number } | undefined)?.total ?? 0);
    protected readonly variant = computed(() => statusFor(this.total(), { ok: 0, warn: 10, direction: 'lower' }));
}
```

When `updateManifest()` replaces the manifest in place, `PrismManifestService.manifest()` follows it, while the [`PRISM_MANIFEST`](api/services.md#injection-tokens) token keeps the manifest the styleguide started with. On a phone the widgets sit in strips that scroll sideways once the brand name has shortened as far as it can, so keep a widget to one compact pill, as the metric badge draws it, see [On a phone](guide/styleguide-ui.md#on-a-phone).

## Decorate the navigation

A navigation decoration puts a marker on the sidebar entry of a component, for a health signal that should be visible while browsing. Its `badge()` runs in the browser during change detection and sees one component at a time, so it cannot decide what counts as bad for the library. The hook decides, where the plugin's options are at hand, and stores the verdict next to the TODOs; `badge()` only reads it back.

The factory now takes an option, and the hook adds the verdict:

```typescript
// todo-plugin.ts: the Node entry
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { TODO_HEADER_WIDGET, TODO_NAVIGATION_DECORATION, TODO_PANEL, type TodoMeta, type TodoPluginOptions } from './todo-contributions.js';

export function todoPlugin(options: TodoPluginOptions = {}): NgPrismPlugin {
    const dangerAt = options.dangerAt ?? 5;

    return {
        name: '@my-org/plugin-todo',

        async onComponentScanned(component) {
            if (component.parentClassName) return;

            const { readFile } = await import('node:fs/promises');
            const lines = (await readFile(component.filePath, 'utf-8')).split('\n');
            const todos = lines.flatMap((text, index) => (/\/\/\s*TODO/.test(text) ? [{ line: index + 1, text: text.trim() }] : []));
            const todo: TodoMeta = { todos };

            if (todos.length > 0) {
                todo.summary = { variant: todos.length >= dangerAt ? 'danger' : 'warn', label: `${todos.length} open TODO${todos.length === 1 ? '' : 's'}` };
            }

            return {
                ...component,
                showcaseConfig: { ...component.showcaseConfig, meta: { ...component.showcaseConfig.meta, todo } }
            };
        },

        onManifestReady(manifest) {
            // as in "Write meta in a hook"
        },

        panels: [TODO_PANEL],
        headerWidgets: [TODO_HEADER_WIDGET],
        navigationDecorations: [TODO_NAVIGATION_DECORATION]
    };
}
```

The options, the verdict in `TodoMeta` and the decoration go into the contributions:

```typescript
// todo-contributions.ts
import type { NavigationDecorationDefinition } from '@ng-prism/core/plugin';

export interface TodoPluginOptions {
    /** From this many open TODOs on, the sidebar marker is red instead of amber. Default 5. */
    dangerAt?: number;
}

export interface TodoMeta {
    todos: { line: number; text: string }[];
    /** The verdict for the sidebar, decided by the hook. */
    summary?: { variant: 'warn' | 'danger'; label: string };
}

export const TODO_NAVIGATION_DECORATION: NavigationDecorationDefinition = {
    id: 'my-org-todo',
    icon: 'file-text',
    order: 40,
    badge: (component) => (component.meta.showcaseConfig.meta?.['todo'] as TodoMeta | undefined)?.summary ?? null
};
```

The browser entry declares the same three contributions and takes the same options, which it ignores: `export function todoPlugin(_options?: TodoPluginOptions): NgPrismPlugin`.

- **`null` for anything healthy.** A component without TODOs gets no `summary`, and `badge()` returns `null`, so the marker only appears where there is something to see. A marker has two colours, `warn` and `danger`, and no `ok`.
- **Cheap and pure.** `badge()` reads what `meta` holds: no fetch, no injection.
- **`order` places the marker** in the trailing group of the entry. `10`, `20` and `30` belong to a11y, visual regression and coverage, so a new source takes `40` or higher.
- **One icon per source.** The panel tab, the header widget and the marker use `file-text`, so the reader connects them.
- **Components only.** Services, pipes and pages get no markers.

The fields are described under [`NavigationDecorationDefinition`](api/ng-prism-plugin.md#navigationdecorationdefinition), the reasoning behind the split of decision and display under [Navigation Decorations](architecture/plugin-hooks.md#navigation-decorations).

## Add a custom control

A control replaces the built-in control of the Controls panel for the inputs it matches. It stands on its own, so this example is a plugin of its own, for inputs of a `ColorValue` type:

```typescript
// color-swatch-plugin.ts
import type { NgPrismPlugin } from '@ng-prism/core/plugin';
import { ColorSwatchControlComponent } from './color-swatch-control.component.js';

export function colorSwatchPlugin(): NgPrismPlugin {
    return {
        name: '@my-org/plugin-color-swatch',
        controls: [
            {
                matchType: (input) => input.rawType === 'ColorValue',
                component: ColorSwatchControlComponent
            }
        ]
    };
}
```

The control receives two inputs, `inputMeta` and `rendererService`, and reads and writes the value of the input through the service:

```typescript
// color-swatch-control.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PrismRendererService } from '@ng-prism/core';
import type { InputMeta } from '@ng-prism/core/plugin';

@Component({
    selector: 'my-color-swatch-control',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <label>
            {{ inputMeta().name }}
            <input type="color" [value]="value()" (change)="update($event)" />
        </label>
    `
})
export class ColorSwatchControlComponent {
    readonly inputMeta = input.required<InputMeta>();
    readonly rendererService = input.required<PrismRendererService>();

    protected readonly value = computed(() => (this.rendererService().inputValues()[this.inputMeta().name] as string | undefined) ?? '#000000');

    protected update(event: Event): void {
        this.rendererService().updateInput(this.inputMeta().name, (event.target as HTMLInputElement).value);
    }
}
```

- **`matchType`** is called with the [`InputMeta`](api/types.md#inputmeta) of each input of the active component. The controls of all plugins are asked in plugin order, and the first match wins over the built-in controls.
- **The whole row.** The control is rendered in place of the row of the input, its name and type included, so it shows the name itself.
- **No lazy variant.** `controls` takes the component class, so the plugin file imports it statically. The build does not read `controls`, so a plugin with two entries can leave them, and the import, out of the Node entry.

See [`ControlDefinition`](api/ng-prism-plugin.md#controldefinition) and [`PrismRendererService`](api/services.md#prismrendererservice).

## Package and publish

A plugin package is an Angular library with the [two entry points](#node-and-browser-entry-points) and their `exports` map. Compile its panels, widgets and controls with the Angular compiler, as any Angular library: the official plugins build with `ngc`.

Angular and ng-prism are peer dependencies, never bundled, so the plugin uses the copies of the workspace that installs it. Start the `@ng-prism/core` range at the release whose API the plugin uses: `statusFor`, the UI primitives and `PanelBadge.kind` are there since 22.7.0.

```json
{
    "name": "@my-org/plugin-todo",
    "peerDependencies": {
        "@angular/core": "^22.0.0",
        "@ng-prism/core": "^22.7.0"
    }
}
```

A project then installs the package and adds the factory to `plugins`, see [Installing Plugins](plugins/overview.md#installing-plugins). To support `ng add` as the official plugins do, the package names a schematics collection with an `ng-add` schematic (`"schematics": "./schematics/collection.json"`, and `"ng-add": { "save": "devDependencies" }` to install it as a dev dependency), and the schematic registers the plugin with `addPluginToConfig()` from `@ng-prism/core/schematics/utils`:

```typescript
// schematics/ng-add/index.ts
import type { Rule } from '@angular-devkit/schematics';
import { addPluginToConfig } from '@ng-prism/core/schematics/utils';

export function ngAdd(): Rule {
    return (tree) => {
        addPluginToConfig(tree, 'ng-prism.config.ts', {
            importName: 'todoPlugin',
            importFrom: '@my-org/plugin-todo',
            call: 'todoPlugin()'
        });
        return tree;
    };
}
```

`addPluginToConfig()` adds the import and the call to the `plugins` of the `defineConfig({ … })` that the config exports, and skips them when they are there already, so running `ng add` again is safe. It returns whether it changed the file, and throws when the config does not exist or is not written that way.

## Related

- [Plugin Hooks](architecture/plugin-hooks.md): order, chaining, errors, and what runs in Node.js and in the browser
- [NgPrismPlugin](api/ng-prism-plugin.md): every field, with the panel, badge, control, widget and decoration definitions
- [Plugin UI Kit](api/plugin-ui.md): the components and helpers a panel or widget is built from
- [Panel Design](plugins/panel-design.md): the rules the built-in panels follow
- [Runtime Services](api/services.md): the services a panel or widget injects
- [Types](api/types.md): `ScannedComponent`, `RuntimeComponent` and the other objects the hooks and panels receive
