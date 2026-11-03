---
name: write-plugin
description: Use when writing your own ng-prism plugin (NgPrismPlugin from @ng-prism/core/plugin) - build-time hooks (onComponentScanned, onServiceScanned, onPipeScanned, onPageScanned, onManifestReady), panels (also for service and pipe pages) and canvas overlays, custom input controls, header widgets, sidebar navigation decorations - or packaging one for npm. Not for adding an official plugin (skill setup) and not for developing ng-prism itself.
---

# Writing an ng-prism plugin

A plugin is a factory function that returns an `NgPrismPlugin`, registered in `ng-prism.config.ts`
(`plugins: [notesPlugin()]`). That file runs twice: in Node inside the builder, where the hooks run, and in the
browser, where the styleguide picks up panels, controls, widgets and decorations. Whatever a plugin imports at the top
level has to load on both sides.

## The installed version decides

Read `version` in `node_modules/@ng-prism/core/package.json`. Where this skill and the installed package disagree, the
package is right:

- Every type below, with JSDoc: `node_modules/@ng-prism/core/dist/plugin/plugin.types.d.ts`.
- A field this skill names that those typings don't have is newer than the installed version: don't use it, suggest an
  update at most.
- Guides: `https://ng-prism.github.io/ng-prism/`, served as raw Markdown you can fetch directly, e.g.
  `https://ng-prism.github.io/ng-prism/plugins/writing-plugins.md`. The pages for this skill are listed at the end.

## Build-time hooks

```ts
import type { NgPrismPlugin } from '@ng-prism/core/plugin';

export function notesPlugin(): NgPrismPlugin {
    return {
        name: 'notes',
        onComponentScanned(component) {
            const variants = component.showcaseConfig.variants ?? [];
            component.showcaseConfig.meta = { ...component.showcaseConfig.meta, notes: { variants: variants.length } };
            return component;
        }
    };
}
```

- `onComponentScanned(component)` runs once per component, `onServiceScanned(service)` once per service and `onPipeScanned(pipe)` once per
  pipe (see below), `onPageScanned(page)` once per page from the config's `pages` (not the component pages registered in `main.ts`),
  `onManifestReady(manifest)` once at the end.
- Plugins run in registration order, one after the other, and each gets the previous one's result. Return the changed
  object, a new one, or nothing to keep it as it is; `async` is fine.
- What a user wrote in `@Showcase({ meta })` arrives as `component.showcaseConfig.meta`, a variant's as
  `component.showcaseConfig.variants[i].meta`.
- **`component.api` (`ComponentApi`, since 22.7.0) is experimental until 23.0.0** and may change in a 22.x minor, so
  read it knowing that and keep your own data in `showcaseConfig.meta`, as below. It holds the type of each
  input and the payload of each output (`ApiTypeRef`: text and links to cards), the change event of each `model()`, the
  documented methods and the types they reach. The scan only reads it when a plugin in the config sets
  `componentApi: true` on its plugin object (also experimental; in the Node entry, like the hooks): a plugin that reads
  `api`, in a hook or a panel, sets it. `jsDocPlugin()` does, but don't rely on another plugin. It is also absent when
  the scan cannot read it, on a component a hook builds from scratch and in the manifest of an older core, so check for
  it. `inputs`, `outputs` and the other fields of `ScannedComponent` are stable.
- **`component.composition` (`ComponentComposition`, since 22.7.0)** holds what the scan read from a showcase's
  `template` and `host: { template }`: `variantCases` (per variant, an index into `cases` or `-1`) and `cases`, each with
  the markup as written, `template`, and `unbound`, the inputs of the subject the case does not bind. `imports` lists
  the classes the wrapper imports besides the subject (`{ name, from }`), which a usage example names too. The markup
  has `COMPOSITION_SUBJECT_SLOT` (from `@ng-prism/core/plugin`) at the end of the subject's start tag: a plugin that
  shows the markup of a variant replaces it with the attributes it wants there, as the usage example of `jsDocPlugin()`
  does.
  It is read before the hooks run, so a hook that edits `template` or `host` afterwards changes nothing that renders,
  and it is absent when no variant has one and on a component a hook builds from scratch.
- **Parts (since 22.7.0, experimental until 23.0.0).** A class with `@Showcase({ partOf: '<selector of the parent>' })` is
  a part of that component or directive and has no page of its own. `onComponentScanned` runs on it like on any
  component, so it has `inputs`, `outputs` and, with `componentApi`, `api`. When `partOf` resolved,
  `component.parentClassName` names the parent: a hook that works per page (builds, measures or photographs each
  component) returns early for a component that has it. `onManifestReady` gets the parts nested: they are not in
  `manifest.components` but in `parts` of their parent (`ScannedComponent.parts`, sorted by title), the same shape as
  `RuntimeComponent.parts`. So a plugin that walks `manifest.components` sees parents only and reads `c.parts ?? []` to
  include parts, and a filter that drops a parent drops its parts too. The scan decides which parent a part belongs to:
  a hook that rewrites the parent, its selector or class name included, keeps its parts on it.
- Store per-component results in `component.showcaseConfig.meta[<your key>]`, as the official plugins do. Data for the
  whole library goes into `manifest.meta`, read in the browser with `inject(PRISM_MANIFEST).meta`.
- The manifest that carries these results to the browser is generated source code: only JSON-like data survives. In
  a component's showcase meta a function becomes `undefined`, and a `Date`, `Map`, `Set` or class instance becomes a
  plain object of its own enumerable fields (`{}` for the built-ins). `manifest.meta` is written with `JSON.stringify`:
  functions are dropped, a `Date` becomes an ISO string.
- Import Node-only modules inside the hook (`const { readFile } = await import('node:fs/promises')`), never at the top
  of the file: the same file is bundled for the browser.
- **Services have their own hook and list** (since 22.7.0). A class with `@Showcase` and `@Injectable` or `@Service`
  is a service: it is in `manifest.services`, never in `manifest.components`, and `onComponentScanned` never sees it.
  `onServiceScanned(service: ScannedService)` works like the component hook (mutate or return, `async` is fine, plugins
  chain). `className`, `filePath`, `importPath`, `showcaseConfig`, `provision` (`'auto' | 'manual'`) and `meta` are
  stable; **`service.api` (`ServiceApi`: members, setup, types) is experimental until 23.0.0** and may change in a 22.x
  minor, so read it knowing that and keep your own data in `service.meta`. Services only reach the manifest, and the
  hook only runs, when some plugin has a view panel (`placement: 'view'`) with `appliesTo` including `'service'`;
  otherwise the build only counts them, without reading them, and logs a hint once per run
  (`ng-prism: <n> service(s) with @Showcase found, but no plugin shows services; …`). `navigationDecorations` are not
  called for services.
- **Pipes have their own hook and list too** (since 22.7.0). A class with `@Showcase` and `@Pipe` is a pipe: it is in
  `manifest.pipes`, never in `manifest.components` or `manifest.services`, and neither `onComponentScanned` nor
  `onServiceScanned` sees it. `onPipeScanned(pipe: ScannedPipe)` works like the service hook. `className`, `filePath`,
  `importPath`, `showcaseConfig`, `pipeName`, `pure` (absent when it can't be read) and `meta` are stable;
  **`pipe.api` (`PipeApi`: `transform` signatures, setup, types) is experimental until 23.0.0**, so keep your own
  data in `pipe.meta`. Pipes reach the manifest, and the hook runs, only when some plugin has a view panel
  (`placement: 'view'`) with `appliesTo` including `'pipe'`, decided apart from services; otherwise the build only
  counts them and logs a hint (`ng-prism: <n> pipe(s) with @Showcase found, but no plugin shows pipes; …`).
  `navigationDecorations` are not called for pipes.
- A hook that throws stops the build with `ng-prism: plugin "<name>" failed in <hook> for …`; during `serve`, a failed
  rescan keeps the previous manifest.

## Runtime contributions

| Field                   | Definition                                                                                                                                                       | The component receives                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panels`                | `{ id, label, loadComponent, icon?, placement?: 'addon' \| 'view', appliesTo?, listsParts?, isVisible?, badge?, keepAlive?, providers?, loadOverlayComponent? }` | input `activeComponent: RuntimeComponent \| null`, `activeService: RuntimeService \| null` for a view panel that applies to services, `activePipe: RuntimePipe \| null` for one that applies to pipes, `activePart: string \| null` for a panel with `listsParts` |
| overlay                 | `loadOverlayComponent` on a panel, drawn over the canvas while that panel is active                                                                              | input `rendererService: PrismRendererService`                                                                                                                                                                                                                     |
| `controls`              | `{ matchType: (input: InputMeta) => boolean, component }`                                                                                                        | inputs `inputMeta` and `rendererService`                                                                                                                                                                                                                          |
| `headerWidgets`         | `{ id, loadComponent, placement?: 'start' \| 'end', order? }`                                                                                                    | nothing                                                                                                                                                                                                                                                           |
| `navigationDecorations` | `{ id, icon, order?, badge: (c) => { variant: 'warn' \| 'danger', label } \| null }`                                                                             | (no component)                                                                                                                                                                                                                                                    |

- Components are standalone. Load panels, overlays and header widgets lazily:
  `loadComponent: () => import('./notes-panel.component').then((m) => m.NotesPanelComponent)`. An eager `component`
  pulls its imports into the file that also runs in Node. Controls only have `component`.
- `RuntimeComponent.meta` is the whole scanned component, so the user's showcase meta is
  `activeComponent()?.meta.showcaseConfig.meta`, and a panel reads the API at `activeComponent()?.meta.api`
  (experimental, `undefined` for a component without one, and only in the manifest when a plugin sets
  `componentApi: true`, so set it on yours).
- `RuntimeComponent.parts` (since 22.7.0, experimental until 23.0.0) is `RuntimePart[]`, one `{ meta: ScannedComponent }`
  per part of the component, sorted by title, with no `type`: the variants of the component render a part, never the
  part itself. It is missing for a component without parts.
- **Panels for services and pipes.** `appliesTo: ('component' | 'service' | 'pipe')[]` (since 22.7.0) says where a
  panel appears, default `['component']`. A service or pipe page has no canvas and offers only the panels that apply
  to it, as view tabs: such a panel needs `placement: 'view'`, since there is no addon area. An addon panel shows on
  component pages only, and only when it applies to `'component'`. The panel component declares
  `readonly activeService = input<RuntimeService | null>(null)` and/or
  `readonly activePipe = input<RuntimePipe | null>(null)` (and `activeComponent` if it applies to components); it is
  only given the inputs of the targets it names. `isVisible` and `badge` are called for components only. Declare
  `placement` and `appliesTo` in the plugin's Node entry too, not only in `index.browser.ts`: the build reads them from
  there to decide whether any plugin shows services or pipes. The panel reads the API at `activeService()?.meta.api`
  or `activePipe()?.meta.api`.
- **A panel that lists parts.** `listsParts: true` on a view panel for `'component'` (since 22.7.0, experimental until
  23.0.0) says it shows the parts of the component (`RuntimeComponent.parts`). It declares
  `readonly activePart = input<string | null>(null)`, the key of the part to show (its class name, `~2`, `~3`, … appended
  for a later part of the same class name; `partKeys(parts)` from `@ng-prism/core/plugin` lists them), and scrolls to
  its block; only a panel with `listsParts` is given the input. `activePart` follows the `part` URL parameter and a
  part's popover in the component head, which links to the first visible panel with `listsParts`; it goes back to
  `null` when the component or the view changes. The link of the part already shown sets it to `null` for one render
  and then to the part again, so scrolling whenever the input changes is enough.
- The selected variant and its inputs: inject `PrismRendererService` from `@ng-prism/core` (`activeVariantIndex()`,
  `inputValues()`, `renderedElement()`, `subjectElement()`, `selectVariant()`, `updateInput()`).
  `renderedElement()` is the root of everything the canvas renders: for a variant with a `template` or a `host: { template }`
  (a composition, since 22.7.0) that is the whole composition, frame and other parts included, so measuring, auditing
  or capturing the picture reads it. `subjectElement()` (since 22.7.0, `Element | null`) is the showcased component or
  directive inside it, the element the generated wrapper marks with `data-prism-subject`, and the root itself outside
  a composition: read it when you mean that element, for its role, label or attributes.
  `PrismNavigationService.activeComponent` is the selection. `PRISM_MANIFEST`, `PRISM_CONFIG` and `ICON_NAMES` (the valid `icon` values) come from
  `@ng-prism/core/plugin`.
- `isVisible`, `badge` and a decoration's `badge` run during change detection: keep them pure and cheap, and decide
  verdicts in `onComponentScanned`.
- A panel's `badge` returns `{ kind?: 'count' | 'issues', text, tone?: 'primary' | 'warn' | 'danger', label? }` or
  `null` (since 22.7). `issues` is a number of open findings, a filled pill in `tone` (default `danger`), hidden at
  `'0'`; `count` is a plain muted figure. `label` is what a screen reader hears after the tab label. `variant` is
  deprecated (removed in 23.0.0) and still mapped: `warn`/`danger` → `issues`, `default` → `count`, `ok` → nothing.
- Grade a figure with `statusFor(value, { ok, warn, direction? })` or `thresholdFromTarget(target)` from
  `@ng-prism/core/plugin` (warn down to 75 % of the target, danger below), and `worstTone()` for several. The header
  badge, the sidebar and the built-in panels grade the same way, so a plugin that does too never disagrees with them.

- Panel ids are not deduplicated: prefix yours and avoid the built-in `overview`, `controls`, `events` and `a11y`.
- Decoration ids are deduplicated: built-ins first (only `a11y`), then plugins in registration order. The first
  definition of an id wins, later ones are dropped silently. The orders 10, 20 and 30 belong to a11y, visual regression
  and coverage.
- The first control whose `matchType` matches wins, in registration order.
- `wrapComponent` and a panel's `position` are in the typings, but nothing has ever read them; they are deprecated
  (removed in 23.0.0). Don't use them. Where a panel appears is `placement`.

## Panel look

Since 22.7 the built-in panels share one anatomy, and the same primitives are exported from `@ng-prism/core`:
`prism-panel-toolbar` (slots `[toolbarStart]`, `[toolbarEnd]`), `prism-tabs` (`items`, `[(active)]`, `size`),
`prism-segmented`, `prism-metric-card` (`label`, `value`, `unit`, `tone`, `statusLabel`, `fraction`, `threshold`,
`title`), `prism-list-row` (`selected`, `interactive`; slots `[rowBadge]`, `[rowTitle]`, `[rowDescription]`,
`[rowMeta]`), `prism-badge` (`tone`, `variant`, `size`, `label`, `value`), `button[prismButton]`,
`button[prismIconButton]`, plus `toneForStatus(status)` for a badge tone. Use them instead of styling your own, and
follow the rules the built-ins follow:

- A toolbar only when the panel has sub-tabs (`prism-tabs size="sm"`) or actions; no meta text in it, put counts,
  timestamps and thresholds in tooltips.
- Measured values as metric cards without a visible subtitle (details in `title`); findings as list rows, a selected
  row tinted, never a coloured left border.
- A graded value in its status colour, a plain quantity in `--prism-primary`; the brand gradient is not for data.
- Content padded 16 × 18 px on a 12 px grid, following the dragged panel height; images and charts fit.
- Background `--prism-bg-surface`, embeds too. Actions right in the toolbar, `prismButton` `sm`, secondary before
  primary.
- Colours only through `--prism-*` tokens, so the panel works in both themes; `plugins/panel-design.md` has a full
  example.
- On a phone (since 22.7.0) a panel is about 390 px wide. Lay it out with container queries on its own width
  (`container-type: inline-size` on its root), not with media queries on the viewport.
- Header widgets sit in a strip that scrolls sideways on a phone: keep one to a compact pill, as
  `PrismMetricBadgeComponent` draws it.

## Packaging for npm

The official plugins with build-time hooks split into a Node entry with everything and a browser entry with the
runtime contributions only:

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
    },
    "peerDependencies": { "@angular/core": ">=20.0.0", "@ng-prism/core": "^22.7.0-0" }
}
```

- `index.ts` exports the factory with hooks and contributions; `index.browser.ts` exports a factory of the same name
  without the hooks. Both export the same names, since they share one `index.d.ts`.
- Angular and `@ng-prism/core` are `peerDependencies`, never bundled. Start the `@ng-prism/core` range at the release
  whose APIs the plugin uses: `statusFor`, the UI primitives and `PanelBadge.kind` exist from 22.7.0, so a plugin that
  follows this skill needs `^22.7.0-0`.
- Optional `ng add`: a schematic that calls `addPluginToConfig(tree, path, { importName, importFrom, call })` from
  `@ng-prism/core/schematics/utils`, with `path` pointing at `ng-prism.config.ts`.

## A plugin inside your repo

A plugin doesn't have to be a package. Import its file from `ng-prism.config.ts` with the `.ts` extension
(`import { notesPlugin } from './prism/notes-plugin.ts';`) and add `"rewriteRelativeImportExtensions": true` to the
`compilerOptions` of the styleguide app's `tsconfig.app.json`, so the browser build accepts that path. In the builder,
Node loads the file as it is, which needs Node 22.18 or newer; without `"type": "module"` in the root `package.json` it
prints a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning. That file and whatever it imports statically may only
use TypeScript Node can strip: `import type` for types, no `enum`, no decorators, no constructor parameter properties.
Write its own relative imports with `.ts` as well; Node adds no extension. Keep components behind `loadComponent`,
which only the browser runs. That rules out `controls`: a control's `component` is eager, so its decorator would have
to run in Node. Restart `ng run <lib>:prism` after changing a hook: Node caches the imported plugin module, so a rescan
doesn't reload it.

## Testing

- Hooks are plain functions: unit-test them with a hand-built `ScannedComponent`, `ScannedService` or `ScannedPipe`.
- Then run the styleguide (`ng run <lib>:prism`), check the hook's effect in the log and open the panel; the showcase
  skill's screenshot script with `--shell` shows the UI.

## Guides

- `plugins/writing-plugins.md`, `plugins/panel-design.md`, `architecture/plugin-hooks.md`, `api/ng-prism-plugin.md`,
  `api/plugin-ui.md`, `api/services.md`,
  `api/types.md` (`ScannedComponent`, `ComponentApi`, `ComponentComposition`, `ScannedService`, `ServiceApi`, `ScannedPipe`, `PipeApi`),
  `guide/services-and-pipes.md`
