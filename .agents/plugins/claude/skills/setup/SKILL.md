---
name: setup
description: Use when setting up or configuring ng-prism (@ng-prism/core) in an Angular CLI or Nx workspace - ng add, ng-prism.config.ts, the prism and prism-build targets and their options, adding an official plugin (jsdoc, box-model, figma, perf, coverage, visual-regression), theming the styleguide, publishing a library without its @Showcase decorators, or upgrading ng-prism. Not for writing showcases (skill showcase) or plugins (skill write-plugin), and not for developing ng-prism itself.
---

# Setting up and configuring ng-prism

ng-prism adds a styleguide app to an Angular library. Its builder scans the library's `@Showcase` decorators and serves
or builds the app around them.

## The installed version decides

Read `version` in `node_modules/@ng-prism/core/package.json`. Where this skill and the installed package disagree, the
package is right:

- `NgPrismConfig`, the authoritative field list (only some fields carry JSDoc, the guides cover the rest):
  `node_modules/@ng-prism/core/dist/plugin/plugin.types.d.ts`.
- A field this skill names that those typings don't have is newer than the installed version: don't use it, suggest an
  update at most.
- Guides: `https://ng-prism.github.io/ng-prism/`, served as raw Markdown you can fetch directly, e.g.
  `https://ng-prism.github.io/ng-prism/guide/installation.md`. The pages for this skill are listed at the end.

## Install

Angular CLI, from the workspace root:

```bash
ng add @ng-prism/core --project <lib>
```

Nx: `npm i -D @ng-prism/core`, then `npx nx g @ng-prism/core:ng-add --project=<lib>`. Plain `ng add` needs an
`angular.json` and stops with this hint otherwise. If Nx reports `Cannot find target 'prism'` right afterwards, run
`npx nx reset`. Further options: `--port` (default 4400), `--zoneless`.

What it adds, without overwriting existing files or path mappings:

- an app `<lib>-prism` next to the library (Nx: under `apps/` or `workspaceLayout.appsDir`) with `src/main.ts`,
  `src/index.html` and `tsconfig.app.json`
- on the library: the targets `prism` (`@ng-prism/core:serve`, port 4400) and `prism-build` (`@ng-prism/core:build`,
  output `dist/<lib>-prism`), both with `entryPoint` set to the library directory
- `ng-prism.config.ts` at the workspace root
- path mappings in `tsconfig.base.json` (or `tsconfig.json`): `ng-prism.config`, `prism-manifest/*` and `<lib>` for the
  library's barrel
- `ng-prism-cache/` in `.gitignore`: the generated manifest lives there, is rebuilt on every run and never edited
- the script `strip-showcase` and the devDependencies `highlight.js` and `ngx-highlightjs`

**Up to 22.5.0, check `entryPoint` right after `ng add`.** There a library without secondary entry points (no
`ng-package.json` without `dest` below its root) needs `entryPoint` to name its barrel file, the `lib.entryFile` of its
`ng-package.json` (e.g. `projects/<lib>/src/public-api.ts`), on both targets. With the directory, those versions find
no component and don't warn: the log says `Generated manifest with 0 component(s)`. Later versions read the barrel
from the directory's `ng-package.json`.

Run it with `ng run <lib>:prism` (dev server, rescans on change) or `ng run <lib>:prism-build` (static build); in Nx
with `npx nx run <lib>:prism`. Target options: `entryPoint` (library directory or its barrel, required), `prismProject`
(required), `libraryProject`, `libraryImportPath`, `configFile` (default `ng-prism.config.ts`, must be inside the
workspace), `cacheDir`, `port` (serve) and `outputPath` (build). Unknown options fail validation.

## ng-prism.config.ts

```ts
import { provideHttpClient } from '@angular/common/http';
import { defineConfig } from '@ng-prism/core/config';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin()],
    appProviders: [provideHttpClient()],
    theme: { '--prism-primary': '#0f766e' },
    strictShowcase: true
});
```

The file is loaded twice: the builder imports it in Node, and the styleguide app imports it in the browser through
`main.ts`. Whatever it imports must load on both sides. In Node, only this file is transpiled and its imports resolve
the Node way, without tsconfig `paths`.

- `plugins`: official or your own (skill write-plugin).
- `appProviders`: providers for the whole styleguide app, where `@Showcase({ providers })` moved to.
- `pages`: custom pages declared in the config.
- `theme`, `darkTheme`, `lightTheme`: CSS custom property overrides (see Theming).
- `title`, `subtitle`, `logo: { light, dark }`, `buildInfo: { version, gitHash }`: the header. Since 22.7 the header is
  navy in both themes, so `logo.dark` is shown whenever it is set; a `title` is plain text, not in the brand gradient.
- `urlState` (default `true`) keeps the selection in the URL; `persistState` (default `true`) keeps state in
  sessionStorage across reloads.
- `a11y`: report path, `thresholds` (grade the header pill, navigation markers and gauges) and `gate` (since 22.7:
  the limits the build fails on; left out it is `thresholds`, `false` never fails, e.g. when CI gates on its own; the
  dev server only warns) for the accessibility audit (`api/ng-prism-config.md`).
- `colorScheme` (since 22.8): for a library whose theme hangs on a class or an attribute rather than on
  `prefers-color-scheme`, e.g. `colorScheme: { dark: { class: 'dark' }, light: { attributes: { 'data-mode': 'light' } } }`.
  While the tools menu's Simulate group emulates the color scheme Light or Dark, the shown component's host and the CDK
  overlay container get that class and those attributes, so `.dark .btn` and `:host-context(.dark)` follow. A theme
  keyed on `:root`, `html` or `body` can't be switched this way (it would switch the styleguide too). The attribute
  names `class`, `style` and `data-prism-sim` are left out with a console warning; avoid `data-theme`, which the
  styleguide still sets on `<html>` until 23.0. A library that themes through `prefers-color-scheme` needs nothing.
- `showcaseDefaults: { bg }` (since 22.8): the canvas background of every variant that declares no `bg`, e.g.
  `showcaseDefaults: { bg: 'light' }` for a library whose components are all designed against a light surface. Without
  it that is `dots` in the Playground and `transparent` in the Overview, in capture mode and in
  `window.__PRISM_MANIFEST__`. Only a fallback: a declared `bg`, a pick in the tools menu and a simulated color scheme
  beat it, and the pill doesn't call it recommended.
- `strictShowcase` (default `false`): a dropped `@Showcase` value fails the build instead of warning.

`ui`, `appComponent`, `themeStylesheet` and `headless` are in the typings, but nothing has ever read them; they are
deprecated (removed in 23.0.0) and the build prints a notice while one is set. Don't use them, and suggest removing
them where a config has them.

## Official plugins

Each one installs with `ng add @ng-prism/plugin-<name>`, which adds the import and the call to `ng-prism.config.ts`
and skips a plugin that is already there. In Nx: `npm i -D @ng-prism/plugin-<name>`, then
`npx nx g @ng-prism/plugin-<name>:ng-add`. Import from the package name; the Angular build picks the browser half
itself. Keep the core and every plugin on the same version: plugins require `@ng-prism/core` `^<their version>-0`.

| Package                              | Call                                                                  | Adds                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@ng-prism/plugin-jsdoc`             | `jsDocPlugin()`                                                       | an API tab for every component, directive, service and pipe, from the code and its JSDoc |
| `@ng-prism/plugin-box-model`         | `boxModelPlugin()`                                                    | a Box Model panel with a canvas overlay                                                  |
| `@ng-prism/plugin-figma`             | `figmaPlugin({ designDiff?, accessToken? })`                          | a Figma embed; with `designDiff: true` a Design Diff panel                               |
| `@ng-prism/plugin-perf`              | `perfPlugin({ bundle?: { maxTreeDepth? } })`                          | a Performance panel                                                                      |
| `@ng-prism/plugin-coverage`          | `coveragePlugin({ coveragePath?, thresholds? })`                      | coverage panel, header badge, sidebar marker                                             |
| `@ng-prism/plugin-visual-regression` | `visualRegressionPlugin({ reportPath?, assetBaseUrl?, thresholds? })` | VRT report panel, header badge, sidebar marker                                           |

- **JSDoc, services and pipes:** a class with `@Showcase` and `@Injectable` or `@Service` is a service, one with
  `@Showcase` and `@Pipe` a pipe, and `jsDocPlugin()` draws the page of both (skill showcase, since 22.7.0).
  **Services and pipes need the plugin.** Without it, or without any other plugin whose view panel has
  `appliesTo: ['service']` (`['pipe']` for pipes, decided apart), the build leaves all services (pipes) out of the
  manifest and the sidebar and logs once, through the normal log and not as a warning:
  `ng-prism: <n> service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.`
  and, for pipes:
  `ng-prism: <n> pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.`
  When a user asks why a service or pipe is missing, look for that line first, then add the plugin
  (`ng add @ng-prism/plugin-jsdoc`). If `jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc` to 22.7.0 or
  newer: an older one has no page for them. `strictShowcase` doesn't fail over either hint.
- **Figma:** the embed shows when the component sets `meta: { figma: '<Figma URL with node-id>' }` as a string on
  `@Showcase` itself. The Design Diff panel appears once a variant sets `meta.figma`: a URL with `node-id`, or
  `{ url, nodeId }`; a variant without its own value falls back to the component's `meta.figma`. It calls the Figma
  API from the browser, so `accessToken` becomes part of the styleguide app: never deploy a styleguide built with a
  personal token where others can open it. `process.env` doesn't work in the config, which also runs in the browser:
  keep the token in a gitignored `figma-token.local.ts` next to it, import it with the `.ts` extension and set
  `"rewriteRelativeImportExtensions": true` in the styleguide app's `tsconfig.app.json` (as for a plugin inside the
  repo, skill write-plugin).
- **Coverage** reads `coverage/coverage-summary.json` (Istanbul's `json-summary` reporter) at build time.
- **Visual regression** reads `vrt-report.json`, written by your own screenshot runner (`guide/visual-regression.md`).

## Theming

Theme values are CSS custom properties, set inline on `<html>`. The order: built-in tokens, the built-in dark or light
theme, `darkTheme` / `lightTheme`, then `theme`, which wins in both modes. Dark is the default; the user's choice is
stored in localStorage (`ng-prism-theme`) and set on `<html>` as `data-prism-theme="dark|light"` (since 22.8; the old
`data-theme` is deprecated, removed in 23.0): key styles of a component page or a plugin panel on `data-prism-theme`.
The main tokens: `--prism-primary` (text and indicators; overriding it alone also recolours the fills
`--prism-primary-fill`, `-fill-hover` and `--prism-toggle-on`), `--prism-on-primary`
(text on a fill; set it with a light primary of your own), `--prism-accent`, `--prism-bg`, `--prism-bg-surface`,
`--prism-bg-elevated`, `--prism-text`, `--prism-text-muted`, `--prism-border`, `--prism-success`, `--prism-warn`,
`--prism-danger`, `--prism-font-sans`, `--prism-font-mono`. The header is a navy brand band in both modes and renders
with the dark set, `darkTheme` included; a custom `title` replaces the wordmark and is shown in neutral text.
`--prism-brand-motion` (default `24s`) is the cycle of the header's slow brand light (glow swell, then a light along
the top edge); `'none'` in `theme` holds it still, and `prefers-reduced-motion` always does.
Deprecated since 22.7 (removed in 23.0): `--prism-primary-from`, `--prism-primary-to`, `--prism-spectrum` and
`--prism-mark-nominal|attention|critical` (aliases of success, warn and danger; an override still carries over, with a
console warning). Don't suggest them in new config.

## Publishing the library

`@Showcase` does nothing at runtime, but the built library still imports `@ng-prism/core`, which its consumers don't
have. Strip the decorators after the build:

```bash
ng build <lib> && npm run strip-showcase    # runs ng-prism-strip dist/<lib>
```

In Nx, a target with `"command": "npx ng-prism-strip dist/<path>"` and `"dependsOn": ["build"]`. It rewrites `.js` and
`.mjs` files in place and can run twice. `@ng-prism/core` then stays a devDependency of the library. In code:
`createShowcaseStripTransformer()` or `stripShowcaseDecorators(source)` from `@ng-prism/core/transformer`.

## Upgrading

- ng-prism's major version follows Angular's. A breaking change within one Angular major ships as a minor release,
  with a deprecation first and the removal in the next major where it can be deprecated. One that cannot, such as a
  union type that gains a member, ships in the minor release itself and is listed in `guide/upgrade-notes-22.md`. 22.x
  supports Angular 20 to 22.
- 22.7.0 is such a release. A class with `@Showcase` and `@Injectable`, `@Service` or `@Pipe` but no component-only
  field leaves `components`, `__PRISM_MANIFEST__` and `onComponentScanned`; it is listed as a service or a pipe with
  `jsDocPlugin()` 22.7.0 or newer. Code that narrows a `NavigationItem` by `kind` needs a `'service'` and a `'pipe'`
  branch. 22.7.0 also brings a new palette and look: `--prism-primary` is the text role and fills read
  `--prism-primary-fill`, the `--prism-mark-*`, `--prism-spectrum` and `--prism-primary-from/-to` tokens are deprecated
  (the build names any override of them), and `PanelBadge.variant` gives way to `kind`. See
  `guide/upgrade-notes-22.md#upgrading-to-2270`.
- 22.8.0 changes nothing in a config. A `@Showcase` that declares `bg: 'checker'` has to change: the value is removed
  and the build drops it with a warning. `ng update @ng-prism/core` rewrites it to `'transparent'` on the class and its
  inline variants, and a visual regression baseline taken on `checker` needs recording again. `data-theme` on `<html>`
  is deprecated: replace it with `data-prism-theme` in the styleguide app's own styles and scripts (an attribute can't
  warn, so search for it). The tools menu's first group is called Background now and its button
  `Background, state, zoom, width and simulate`, which matters only to end-to-end tests that find them by name. See
  `guide/upgrade-notes-22.md#upgrading-to-2280`.
- Update the core and all plugins in one call: `ng update @ng-prism/core @ng-prism/plugin-jsdoc …`.
- The migrations to v22 (manifest moved to `ng-prism-cache/`, `.ng-prism/` renamed) read `angular.json` only; in an Nx
  workspace apply them by hand following `guide/migration-v22.md`. They need Angular CLI 22 and a Node version it
  supports.

## Guides

- `guide/installation.md`, `guide/configuration.md`, `api/ng-prism-config.md`, `api/builders.md`
- `plugins/overview.md` and one page per plugin (`plugins/jsdoc.md`, `plugins/figma.md`, …)
- `guide/theming.md`, `guide/styleguide-ui.md#simulate` (what `colorScheme` serves), `guide/library-publishing.md`,
  `guide/upgrade-notes-22.md`, `guide/migration-v22.md`
