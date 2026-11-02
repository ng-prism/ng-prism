# Builders

`@ng-prism/core` ships two Angular builders: `serve` for the dev server and `build` for a production build. Both scan the library, run the plugins' build hooks and write the manifest, then hand over to the styleguide app's own targets. `ng add @ng-prism/core` sets them up as the targets `prism` and `prism-build` of the library, see [Installation](guide/installation.md). How the pipeline works inside is under [Build Pipeline](architecture/pipeline.md).

Run the library's targets, not the styleguide app's own `serve` and `build`: those skip the scan, so the app builds against the last manifest, or fails without one.

```bash
ng run my-lib:prism            # dev server on :4400
ng run my-lib:prism-build      # production build
npx nx run my-lib:prism        # the same in an Nx workspace
```

## serve

`@ng-prism/core:serve`, the `prism` target:

```json
"prism": {
  "builder": "@ng-prism/core:serve",
  "options": {
    "entryPoint": "projects/my-lib",
    "prismProject": "my-lib-prism",
    "libraryProject": "my-lib",
    "port": 4400
  }
}
```

1. Loads the config, scans the library and writes the manifest. An error here stops the builder before the dev server starts, see [Build Warnings](api/build-warnings.md#how-messages-look).
2. Starts watching the library, and rescans after a change, see [Watching and reloading](#watching-and-reloading).
3. Runs the `serve` target of [`prismProject`](#prismproject) with [`port`](#port).

It stops when the dev server stops. A report that breaks [`a11y.gate`](api/ng-prism-config.md#a11y) only prints a warning here, so that a stale local report cannot keep the dev server from starting.

In an Nx workspace the target lives in the library's `project.json` under `targets`, with `executor` instead of `builder`.

## build

`@ng-prism/core:build`, the `prism-build` target:

```json
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

It loads the config, scans the library and writes the manifest once, then runs the `build` target of [`prismProject`](#prismproject) in its default configuration, with [`outputPath`](#outputpath) when it is set, and ends with that build's result. It fails when [`strictShowcase`](api/ng-prism-config.md#strictshowcase) is on and the scan dropped a value, when the a11y report breaks [`a11y.gate`](api/ng-prism-config.md#a11y), and when a plugin's build hook throws.

## Options

Both builders take the same options, except `port` (`serve` only) and `outputPath` (`build` only). Paths are relative to the workspace root.

### `entryPoint`

**Type** `string` · **Required** · `serve` and `build`

The library to scan: its directory or its barrel file, such as `projects/my-lib` or `projects/my-lib/src/public-api.ts`. `ng add` writes the library's root directory.

The scan reads the secondary entry points first, then the primary one:

- **Secondary entry points:** every `ng-package.json` without `dest` at or below the library root. Each names its entry file as `lib.entryFile`, `public-api.ts` when the field is missing, and its import path is [`libraryImportPath`](#libraryimportpath) plus its directory, such as `my-lib/atoms`.
- **Primary entry point:** a file `entryPoint` is the primary entry file itself. A directory names it as `lib.entryFile` in its `ng-package.json`, ng-packagr's default `src/public_api.ts` when the field is missing.
- **Library root:** a directory `entryPoint` is the root. A file is first resolved upward to the nearest `ng-package.json`, whose directory is the root. Without one above it, the file is the only entry point.

A component the primary entry point re-exports from a secondary one keeps the secondary's import path. When nothing resolves to an entry file, the build warns, see [No entry file](api/build-warnings.md#no-entry-file). What the scan reads in these files is under [What the Scanner Reads](guide/scanner-reads.md).

### `prismProject`

**Type** `string` · **Required** · `serve` and `build`

The Angular project of the styleguide app, `<library>-prism` after `ng add`. The builders run its `serve` or `build` target, the manifest goes to `<cacheDir>/<prismProject>/prism-manifest.ts`, and `main.ts` imports it as `prism-manifest/<prismProject>`.

### `libraryProject`

**Type** `string` · **Default** none · `serve` and `build`

The Angular project of the library. Only used as the fallback for [`libraryImportPath`](#libraryimportpath).

### `libraryImportPath`

**Type** `string` · **Default** `libraryProject`, then `prismProject` · `serve` and `build`

The module specifier the manifest imports the library's components from, such as `@acme/ui`. A secondary entry point adds its directory to it. The styleguide app has to resolve it, through a path mapping in `tsconfig.json` (which `ng add` adds for the library) or an installed package.

### `configFile`

**Type** `string` · **Default** `'ng-prism.config.ts'` · `serve` and `build`

The config file the builder loads, see [NgPrismConfig](api/ng-prism-config.md). It has to be inside the workspace, otherwise the build stops with an error. When the file does not exist, the build runs with an empty config. The styleguide app imports the config separately, through the `ng-prism.config` path mapping in `tsconfig.json`, so a config somewhere else needs that mapping changed too.

### `cacheDir`

**Type** `string` · **Default** `<workspaceRoot>/ng-prism-cache` · `serve` and `build`

Where the manifest goes: `<cacheDir>/<prismProject>/prism-manifest.ts`. A relative path resolves against the workspace root. The `prism-manifest/*` path mapping in `tsconfig.json` has to point there too, see [Build Pipeline](architecture/pipeline.md#manifest-output-location). Useful for CI sandboxes.

### `port`

**Type** `number` · **Default** `4400` · `serve` only

The port of the dev server. It is passed to the styleguide app's `serve` target and wins over the port set there.

### `outputPath`

**Type** `string` · **Default** the `outputPath` of the styleguide app's `build` target · `build` only

Where the production build goes. It replaces the app target's `outputPath` with `{ "base": <outputPath>, "browser": "" }`. `ng add` writes `dist/<prismProject>`.

## The styleguide app target

`ng add` adds the styleguide app as a project of its own, with standard Angular targets that the two builders run:

```json
"my-lib-prism": {
  "projectType": "application",
  "root": "projects/my-lib-prism",
  "sourceRoot": "projects/my-lib-prism/src",
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
        "allowedCommonJsDependencies": ["highlight.js", "axe-core"],
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

- **Builder package:** `@angular/build` when it is a direct dependency of the workspace, as in Nx and newer Angular workspaces, otherwise `@angular-devkit/build-angular`. Both have the same `:application` and `:dev-server` builders.
- **`outputHashing`** is only in the `production` configuration. Hashed file names are for cache-busting in production and do not work with HMR; the dev server says `Hot Module Replacement (HMR) is disabled because the 'outputHashing' option is set to 'all'.` when hashing is on.
- **`development`** turns hashing and optimization off and source maps on, and the `serve` target builds with it.
- **`polyfills`** is `[]` for a workspace set up with `--zoneless`, see [Installation](guide/installation.md#zoneless-mode-optional-recommended).
- **`main.ts`** passes the manifest and the config to `providePrism()` and accepts a new manifest without a page reload, see [Watching and reloading](#watching-and-reloading).

## Watching and reloading

`serve` watches three places and rescans when something in them changes:

| Watched                                                                                                 | What triggers a rescan                         |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The [`entryPoint`](#entrypoint) directory, or the directory of the entry file, with everything below it | A `.ts` file that is added, changed or removed |
| The [config file](#configfile), when it exists as `serve` starts                                        | A change                                       |
| The [a11y report](api/ng-prism-config.md#a11y) that `a11y.reportPath` names                             | A new or changed report                        |

`node_modules` and `.git` are left out. The report's path is read again after every rescan, so a new `reportPath` takes effect, and a report in a directory that does not exist yet is watched from the next rescan on. Changes within 50 ms make one rescan, and a change during a rescan makes one more afterwards.

| Edit                                                     | ng-prism                                        | Angular dev server                |
| -------------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| A `.ts` file of the library (a component, a `@Showcase`) | Rescan; the manifest is written when it changed | Rebuild                           |
| A stylesheet, an `.html` template, an `.svg`             | Nothing                                         | Rebuild                           |
| `ng-prism.config.ts`                                     | Rescan                                          | Rebuild                           |
| The a11y report                                          | Rescan                                          | Rebuild when the manifest changed |

A rescan writes the manifest only when its content changed. The `main.ts` that `ng add` writes then swaps the new manifest into the running app with `enablePrismHmr()`, without a page reload. Any other change reloads the page as the dev server decides, and ng-prism restores the component, variant, view and control values, see [Links & State](guide/url-state.md).

Keep `liveReload: true` on the styleguide app's `serve` target, as `ng add` writes it, so the dev server reloads the page by itself after a rebuild. With `liveReload: false` you reload by hand, which only helps when you want to look at something between two edits.

A rescan that fails, such as one stopped by [`strictShowcase`](api/ng-prism-config.md#strictshowcase), logs the error, and the previous manifest stays in place, see [A re-scan failed](api/build-warnings.md#a-re-scan-failed). A problem in a variant's template is no such failure: the variant loses its composition with a warning, and the rest of the manifest is updated. An error that only Angular finds in the generated manifest shows in the dev server's overlay, see [An Angular error in the generated manifest](api/build-warnings.md#an-angular-error-in-the-generated-manifest).

Two edits do not trigger a rescan:

- A secondary entry point outside the watched directory, when `entryPoint` is a file in `src/` and the secondary entry points sit next to `src/`.
- A base class in another library behind a path mapping. It is read on every rescan, but editing it does not start one, see [What the Scanner Reads](guide/scanner-reads.md#watch-mode-across-libraries).

The next change inside the watched directory, or a restart, picks them up.

## Related

- [Installation](guide/installation.md): `ng add`, Nx and a manual setup.
- [NgPrismConfig](api/ng-prism-config.md): the config file the builders load.
- [Build Warnings](api/build-warnings.md): every message the builders print.
- [Build Pipeline](architecture/pipeline.md): what the builders do inside, the manifest's location and the path mappings.
