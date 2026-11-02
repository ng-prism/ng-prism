# Installation

## Prerequisites

- Angular 20+ workspace (tested against 20, 21, 22)
- Node.js 20+, npm 10+
- Angular CLI and Nx workspaces are both supported (see [Nx Workspaces](#nx-workspaces))

## Automatic Setup with `ng add`

The fastest path is the `ng add` schematic. It creates a showcase app project, wires up the Angular builder targets, and generates a config file in one command.

```bash
ng add @ng-prism/core
```

The schematic prompts for the library project unless you pass `--project`. The other two options are flags only:

| Option       | Default                | Description                                                                                        |
| ------------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `--project`  | _(prompted, required)_ | The library whose components you want to showcase. The showcase app is named `<project>-prism`.    |
| `--port`     | `4400`                 | Dev server port, written to the library's `prism` target and to the showcase app's `serve` target. |
| `--zoneless` | `false`                | Bootstraps the showcase app with `provideZonelessChangeDetection()` and without `zone.js`.         |

After running, your workspace contains:

```
projects/
  my-lib-prism/          ← generated showcase app
    src/
      main.ts            ← bootstraps the Prism app
      index.html
    tsconfig.app.json
ng-prism.config.ts       ← your configuration file (workspace root)
angular.json             ← prism / prism-build targets added to my-lib
tsconfig.json            ← path mappings added here
```

The showcase app is placed next to the library it documents, so a library in `libs/` yields a showcase app in `libs/` too. See [Nx Workspaces](#nx-workspaces) for how that plays out there.

The schematic also adds a `strip-showcase` npm script to your `package.json`. This strips `@Showcase` decorators from compiled library output before publishing. See [Publishing Libraries](guide/library-publishing.md) for details.

## Verify

```bash
ng run my-lib:prism        # or whatever the schematic named it
```

The showcase opens at `http://localhost:4400`.

## Nx Workspaces

ng-prism works in Nx workspaces that define projects through per-project `project.json` files. Run the schematic through Nx rather than the Angular CLI:

```bash
npx nx g @ng-prism/core:ng-add --project=my-lib
```

`ng add @ng-prism/core` does not work here. The Angular CLI refuses to run outside a workspace it recognises, and an Nx workspace has no root `angular.json`. Nx's generator bridge supplies the workspace configuration to the schematic and writes the result back into the relevant `project.json` files, converting `architect` to `targets` and `builder` to `executor` along the way.

The schematic adapts to the workspace it finds:

| Aspect              | Angular CLI                           | Nx                                                  |
| ------------------- | ------------------------------------- | --------------------------------------------------- |
| Showcase app root   | next to the library, e.g. `projects/` | `apps/` when present, otherwise next to the library |
| Application builder | `@angular-devkit/build-angular`       | `@angular/build` when it is a direct dependency     |
| Path mappings       | `tsconfig.json`                       | `tsconfig.base.json`                                |
| Targets             | `architect` / `builder`               | `targets` / `executor`                              |

The app root also honours `workspaceLayout.appsDir` in `nx.json` when you have configured one. Existing path mappings are never overwritten, so the `my-lib` to `src/index.ts` mapping Nx generated for your library stays as it is.

Run the targets the usual way:

```bash
npx nx run my-lib:prism          # dev server on :4400
npx nx run my-lib:prism-build    # production build
```

> If Nx reports `Cannot find target 'prism'` straight after running the schematic, its project graph is stale; `npx nx reset` clears it.

## Zoneless Mode (optional, recommended)

ng-prism supports Angular's zoneless change detection. Pass `--zoneless` during setup to skip the `zone.js` polyfill:

```bash
ng add @ng-prism/core --zoneless
```

This removes ~30 KB from the bundle and aligns with the modern Angular direction. ng-prism itself is fully signal-based, and the scanner already requires `input()`/`output()` signals on every showcased component, so running zoneless is safe.

### Migrating an existing setup to zoneless

Three manual edits are needed:

**1. `projects/<lib>-prism/src/main.ts`**: add `provideZonelessChangeDetection()`:

```diff
+import { provideZonelessChangeDetection } from '@angular/core';
 import { bootstrapApplication } from '@angular/platform-browser';
 import { PrismShellComponent, providePrism } from '@ng-prism/core';
 import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/<lib>-prism';
 import config from 'ng-prism.config';

 bootstrapApplication(PrismShellComponent, {
-  providers: [providePrism(PRISM_RUNTIME_MANIFEST, config)],
+  providers: [
+    provideZonelessChangeDetection(),
+    providePrism(PRISM_RUNTIME_MANIFEST, config),
+  ],
 });
```

Order matters: `provideZonelessChangeDetection()` must come before `providePrism()`.

**2. `angular.json`**: remove the `zone.js` polyfill from the Prism app's build target:

```diff
 "projects": {
   "<lib>-prism": {
     "architect": {
       "build": {
         "options": {
-          "polyfills": ["zone.js"],
+          "polyfills": [],
```

**3. `ng-prism.config.ts`**: if your `appProviders` contains zone-dependent providers (e.g. older animation modules, `provideZoneChangeDetection`), remove them or swap for zoneless-compatible alternatives.

**Verify:** Run `ng run <lib>:prism`. The app should boot without errors and all showcases should render. Bundle size drops by ~30 KB (zone.js is no longer loaded).

## Angular Builder Targets

The schematic adds two targets to the library project in `angular.json`:

```json
"prism": {
  "builder": "@ng-prism/core:serve",
  "options": {
    "entryPoint": "projects/my-lib",
    "prismProject": "my-lib-prism",
    "libraryProject": "my-lib",
    "port": 4400
  }
},
"prism-build": {
  "builder": "@ng-prism/core:build",
  "options": {
    "entryPoint": "projects/my-lib",
    "prismProject": "my-lib-prism",
    "libraryProject": "my-lib",
    "outputPath": "dist/my-lib-prism"
  }
}
```

- **`@ng-prism/core:serve`** runs the TypeScript scanner, generates a runtime manifest, then delegates to the Angular dev server. Watches for file changes and re-scans incrementally.
- **`@ng-prism/core:build`** uses the same pipeline but runs the Angular production build and exits.

### Builder Options

| Option              | Required      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entryPoint`        | Yes           | Path to the library directory or to its barrel file (e.g. `projects/my-lib/src/public-api.ts`). ng-prism scans the secondary entry points below the library root (every `ng-package.json` without `dest`), then the primary one: the file you name, or the `lib.entryFile` of the directory's `ng-package.json`. A file is first resolved upward to the nearest `ng-package.json`. Up to 22.5.0 a directory without secondary entry points found no component, and with secondary entry points the primary one was skipped. |
| `prismProject`      | Yes           | Angular project name for the generated showcase app                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `libraryProject`    | No            | Angular project name of the library being showcased. Only used as a fallback for `libraryImportPath`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `libraryImportPath` | No            | Override the import path used in the generated manifest (defaults to `libraryProject`)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `configFile`        | No            | Path to your config file (default: `ng-prism.config.ts` at workspace root)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `port`              | No            | Dev server port for `:serve` (default: `4400`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `outputPath`        | `:build` only | Output directory for the production build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `cacheDir`          | No            | Cache root for the generated manifest, which goes to `<cacheDir>/<prismProject>/prism-manifest.ts`. Default: `<workspaceRoot>/ng-prism-cache`. Relative paths resolve against `workspaceRoot`. The `prism-manifest/*` path mapping in `tsconfig` has to point there too. Useful for CI sandboxes.                                                                                                                                                                                                                           |

## Showcase App Target Configuration

The schematic also adds a separate showcase app project (`my-lib-prism`) to `angular.json` with its own build and serve targets:

```json
"my-lib-prism": {
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": { "base": "dist/my-lib-prism", "browser": "" },
        "index": "projects/my-lib-prism/src/index.html",
        "browser": "projects/my-lib-prism/src/main.ts",
        "tsConfig": "projects/my-lib-prism/tsconfig.app.json",
        "styles": ["node_modules/highlight.js/styles/base16/solarized-dark.min.css"],
        "polyfills": ["zone.js"],
        "allowedCommonJsDependencies": ["highlight.js"],
        "preserveSymlinks": true
      },
      "configurations": {
        "production": {
          "outputHashing": "all"
        },
        "development": {
          "outputHashing": "none",
          "optimization": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "builder": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "my-lib-prism:build:development",
        "port": 4400,
        "hmr": true,
        "liveReload": true
      }
    }
  }
}
```

> The builder package is picked to match your workspace: `@angular/build` when it is a direct dependency (typical for Nx and newer Angular workspaces), otherwise `@angular-devkit/build-angular`. Both expose the same `:application` and `:dev-server` builders.

The configuration split is intentional:

- `outputHashing` lives only in the `production` configuration. Hashed filenames (`main.abc123.js`) are needed for production cache-busting but are incompatible with HMR. The dev server prints `Hot Module Replacement (HMR) is disabled because the 'outputHashing' option is set to 'all'.` in the terminal when hashing is on.
- The `development` configuration disables hashing, turns off optimization, and enables source maps, which are the usual Angular dev defaults.
- The `serve` target explicitly points at `:build:development` so iteration uses the dev configuration.
- The `polyfills` array shown above is the zone-based default. When set up with `--zoneless`, this field is `[]` instead; see [Zoneless Mode](#zoneless-mode-optional-recommended) above.

## Dev Reload Behavior

Angular's `@angular/build:application` builds the entire app into a single bundle (`main.js`). True module-level HMR, where individual modules get hot-swapped, is not possible against a monolithic bundle. In practice that means **edits trigger a full page refresh**, even with `hmr: true`. ng-prism turns this from a workflow blocker into an acceptable iteration loop through two layers:

1. **The dev configuration skips minification and source-map optimization.** Library and showcase rebuilds typically complete in 300-900ms.
2. **State preservation across reloads** (built into ng-prism): the active component, variant, [component state](guide/variants.md#states), view tab, addon panel tab, control panel overrides, and a11y sub-state are restored after the page reloads, so iterating on a specific variant doesn't lose context. See [State Preservation](guide/url-state.md).

`liveReload: true` is the recommended default because it triggers the reload automatically. Setting `liveReload: false` is only useful if you want to refresh manually (for example to inspect server-side state between edits).

### What ng-prism's watcher does

The `@ng-prism/core:serve` builder runs its own incremental scanner on the library entry point. The scanner only reacts to `.ts` file changes. Style and template edits don't need a manifest rescan and are handled directly by Angular's dev server. Concretely:

| Edit                                       | ng-prism scanner                                  | Angular dev server |
| ------------------------------------------ | ------------------------------------------------- | ------------------ |
| `.ts` (component logic, `@Showcase`, etc.) | re-scan + regenerate manifest if metadata changed | rebuild + reload   |
| `.scss` / `.css` / `.svg`                  | skipped                                           | rebuild + reload   |
| `.html` template                           | skipped                                           | rebuild + reload   |
| `ng-prism.config.ts`                       | re-scan + regenerate manifest                     | rebuild + reload   |

Skipping the scan for style and template changes shaves ~300-500ms off every save, since the TypeScript compiler API doesn't need to traverse the library source tree for those edits.

## Manual Setup

If you prefer not to use the schematic, follow these steps:

**1. Install the package**

```bash
npm install @ng-prism/core
```

**2. Create a showcase app project** in your workspace (a standard Angular app is fine).

**3. Create `ng-prism.config.ts`** at the workspace root:

```typescript
import { defineConfig } from '@ng-prism/core';

export default defineConfig({
    plugins: []
});
```

**4. Update `main.ts`** to use `providePrism`:

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { PrismShellComponent, providePrism } from '@ng-prism/core';
import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/my-lib-prism'; // generated by the builder into ng-prism-cache/my-lib-prism/
import config from 'ng-prism.config';

bootstrapApplication(PrismShellComponent, {
    providers: [providePrism(PRISM_RUNTIME_MANIFEST, config)]
});
```

`main.ts` imports the config and the manifest through two path mappings in `tsconfig.json`; `prism-manifest/*` is a wildcard over the prism projects:

```jsonc
{
    "compilerOptions": {
        "paths": {
            "ng-prism.config": ["./ng-prism.config.ts"],
            "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
        }
    }
}
```

The schematic adds these path mappings and a workspace-wide `ng-prism-cache/` entry in `.gitignore` automatically.

**5. Add builder targets** to `angular.json` as shown in the [Builder Targets](#angular-builder-targets) section above. In an Nx workspace they go into the library's `project.json` under `targets`, with `executor` instead of `builder` (see [Nx Workspaces](#nx-workspaces)).

## Adding Plugins

All official plugins ship with their own `ng-add` schematic. Adding a plugin is a single command:

```bash
ng add @ng-prism/plugin-jsdoc
ng add @ng-prism/plugin-box-model
ng add @ng-prism/plugin-coverage
ng add @ng-prism/plugin-figma
ng add @ng-prism/plugin-perf
ng add @ng-prism/plugin-visual-regression
```

Each command installs the plugin into `devDependencies` and registers it in `ng-prism.config.ts`. Re-running is safe: already-registered plugins are skipped.

See [Plugin Overview](plugins/overview.md) for details on what each plugin provides.

## Peer Dependencies

Nothing has to be installed by hand:

| Package                           | Provided by                               |
| --------------------------------- | ----------------------------------------- |
| `axe-core`                        | ships as a dependency of `@ng-prism/core` |
| `highlight.js`, `ngx-highlightjs` | installed by `ng add @ng-prism/core`      |

`axe-core` powers the built-in [accessibility panel](guide/accessibility.md) and is loaded lazily, so it costs nothing until you open that panel.
