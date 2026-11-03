# Migrating from 21.x

`@ng-prism/core@22.0.0` moves the auto-generated `prism-manifest.ts` out of your source tree into a workspace-level cache directory and switches the import to a tsconfig path mapping. This is a **breaking change**: the previous layout will not work against the new pipeline.

> **This guide is for existing ng-prism installations** being upgraded from `21.x` to `22.x`. If you have not used ng-prism in this workspace before, you want a fresh install instead; see [Installation](guide/installation.md).

## Prerequisites

- An Angular 22 workspace, with Angular CLI 22. The migration schematic is shipped as ESM; older CLI versions silently skip it or report "package does not provide any `ng add` actions". Run `ng version` to check.
- Node.js 22+.

## TL;DR: upgrade an existing 21.x install

Update the core and every installed `@ng-prism/plugin-*` in a single call so that their peer dependencies resolve together:

```bash
ng update @ng-prism/core @ng-prism/plugin-box-model @ng-prism/plugin-coverage \
  @ng-prism/plugin-figma @ng-prism/plugin-jsdoc @ng-prism/plugin-perf \
  @ng-prism/plugin-visual-regression
```

Drop any plugins you don't have installed. The Angular CLI pulls in the new versions, runs the migration schematic, and leaves your workspace in the new layout. Manual `main.ts` customizations (component pages, zoneless setup, custom providers) are preserved. Only the manifest import line is touched.

> **Why core + plugins together?** Each plugin declares `@ng-prism/core` as a peer dependency within its major. If you update core to `22` without bumping plugins, npm rejects the install with a peer-dependency conflict. Bundling them in one `ng update` call lets the CLI resolve the whole set at once.

If you see peer-dependency warnings about `@angular-devkit/architect`, `@angular-devkit/core`, or `@angular-devkit/schematics`, those packages are available transitively via `@angular/cli` / `@angular-devkit/build-angular` in any Angular workspace. npm warns because they are not declared directly. Add `--force` to acknowledge:

```bash
ng update @ng-prism/core @ng-prism/plugin-... --force
```

After the update, verify:

```bash
ng run my-lib:prism        # dev server still starts
ng run my-lib:prism-build  # production build still succeeds
```

You should see the manifest generated at `<workspaceRoot>/ng-prism-cache/<my-lib>-prism/prism-manifest.ts` (where `<my-lib>` is your library project name).

The update takes you to the latest 22.x release, past the changes of every 22.x minor release. Check [Upgrade Notes 22.x](guide/upgrade-notes-22.md) for the breaking changes and deprecations among them.

## Troubleshooting

**`ng update` says "Package '@ng-prism/core' does not exist within the registry"**

You probably used `--next`. That flag looks for a `next` dist-tag, which ng-prism does not publish. Run the update without it.

**`ng update` says "Package '@ng-prism/core' is not a dependency"**

No ng-prism is installed in this workspace, so there is nothing to migrate. For a fresh install, use `ng add @ng-prism/core` (see [Installation](guide/installation.md)). If `ng add` reports "Package does not provide any `ng add` actions", run the schematic directly:

```bash
ng generate @ng-prism/core:ng-add --project=<your-library>
```

(Replace `<your-library>` with the name of your Angular library project from `angular.json`.)

**`ng update` says "Package '@ng-prism/core' is already up to date"**

The latest 22.x is installed already. If it got there without `ng update`, for example through `npm install`, the migration has not run. Run it on its own:

```bash
ng update @ng-prism/core --migrate-only --from=21.0.0
```

**`ng update` runs but my `main.ts` and `tsconfig.json` look unchanged**

Confirm your Angular CLI is on version 22 (`ng version`). ng-prism's schematics are ESM modules; older CLI versions cannot load them and may skip them silently. Upgrade the CLI first:

```bash
ng update @angular/cli@22 @angular/core@22
```

Then re-run the ng-prism migration.

**The migration warns "could not find PRISM_RUNTIME_MANIFEST import"**

`main.ts` imports the manifest in a form the migration does not recognise: together with other names, under an alias, or from another path than `./prism-manifest`. Change the import by hand, see [Step 1](#step-1-edit-projectsltlibgt-prismsrcmaints) of the manual migration.

**`ng update` fails with "Incompatible peer dependencies found"**

You probably bumped `@ng-prism/core` without also bumping the plugin packages (which still pin to the previous major). Re-run the combined update above so core and every installed `@ng-prism/plugin-*` move in lockstep.

**Build fails with `TS6059: File '...prism-manifest.ts' is not under rootDir`**

Your `projects/<lib>-prism/tsconfig.app.json` doesn't widen `rootDir` to the workspace root. The migration leaves the file alone when it cannot read it as plain JSON, for example because it has comments. Open the file and add both `rootDir` and the include glob:

```diff
  "compilerOptions": {
    "outDir": "../../out-tsc/app",
+   "rootDir": "../..",
    "types": []
  },
  ...
  "include": [
    "src/**/*.d.ts",
+   "../../ng-prism-cache/<lib>-prism/**/*.ts"
  ]
```

**Build fails with `TS5090: Non-relative paths are not allowed when 'baseUrl' is not set`**

A `paths` value in your root `tsconfig.json` lacks the `./` prefix. In 21.x, `ng add` wrote the `ng-prism.config` and `<lib>` mappings without it, and the migration adds only the new `prism-manifest/*` mapping. Open `tsconfig.json` and add the prefix to every ng-prism mapping:

```diff
- "ng-prism.config": ["ng-prism.config.ts"],
- "my-lib": ["projects/my-lib/src/public-api.ts"],
+ "ng-prism.config": ["./ng-prism.config.ts"],
+ "my-lib": ["./projects/my-lib/src/public-api.ts"],
  "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
```

## What the migration does

The migration schematic finds every prism project in your `angular.json`, the `prismProject` of each `@ng-prism/core:serve` target, and makes six changes: four for each prism project (steps 1, 3, 4 and 6) and two for the whole workspace (steps 2 and 5). Each step skips what is already in place, so running it twice changes nothing.

### 1. Rewrites `main.ts` import

```diff
- import { PRISM_RUNTIME_MANIFEST } from './prism-manifest';
+ import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/<lib>-prism';
```

The new specifier is project-specific (it ends with your prism project name), so multiple prism projects can coexist in one workspace (see the [wildcard mapping section](#wildcard-path-mapping) below).

The regex tolerates whitespace and quote-style variations and is anchored to line-start, so commented-out lines (`// import ...`) are left untouched.

### 2. Adds a wildcard path mapping to `tsconfig.json`

```diff
  "compilerOptions": {
    "paths": {
      "ng-prism.config": ["./ng-prism.config.ts"],
      "my-lib": ["./projects/my-lib/src/public-api.ts"],
+     "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
    }
  }
```

### 3. Deletes the legacy in-tree manifest

```
- projects/<lib>-prism/src/prism-manifest.ts
```

(If you previously committed the file by accident, `git status` will show it as deleted after the migration. Stage the deletion as part of your migration commit.)

### 4. Removes the stale `.gitignore` entry

```diff
- projects/<lib>-prism/src/prism-manifest.ts
```

### 5. Adds a single workspace-wide ignore (runs once, not per project)

```diff
+ ng-prism-cache/
```

### 6. Updates each prism `tsconfig.app.json`

```diff
  "compilerOptions": {
    "outDir": "../../out-tsc/app",
+   "rootDir": "../..",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": [
    "src/**/*.d.ts",
+   "../../ng-prism-cache/<lib>-prism/**/*.ts"
  ]
```

Both changes are required:

- `include` tells TypeScript that the cache file is part of the project (otherwise it isn't loaded into the compilation).
- `rootDir: ../..` widens the project's root to the workspace so the cache file is _under_ rootDir. Without this, TypeScript rejects with `TS6059: File ... is not under rootDir` even when the file is included.

An existing user-defined `rootDir` is preserved; the migration only sets the default when no `rootDir` is declared.

## Wildcard path mapping

If you have multiple prism projects in the same workspace, the wildcard mapping resolves each one to its own cache file:

```jsonc
"prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
```

So `from 'prism-manifest/test-lib-prism'` resolves to `./ng-prism-cache/test-lib-prism/prism-manifest.ts`, and `from 'prism-manifest/test-ui-kit-prism'` resolves to `./ng-prism-cache/test-ui-kit-prism/prism-manifest.ts`. Each project's `main.ts` imports its own specifier, so no per-tsconfig.app.json overrides are needed.

The mapping points at the default cache directory. If you move it with the builder option [`cacheDir`](api/builders.md#cachedir), point the mapping and the `include` of each `tsconfig.app.json` there too.

## Manual migration

If you can't use `ng update` (e.g., locked CLI version, vendored dependencies), apply the same edits by hand. For each prism project in your `angular.json`:

### Step 1: Edit `projects/<lib>-prism/src/main.ts`

Change the import line:

```diff
- import { PRISM_RUNTIME_MANIFEST } from './prism-manifest';
+ import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/<lib>-prism';
```

Replace `<lib>-prism` with the actual prism project name (the value of `prismProject` in your `@ng-prism/core:serve` builder options, typically `<library-name>-prism`).

### Step 2: Edit `tsconfig.json`

Add the wildcard mapping under `compilerOptions.paths`:

```jsonc
{
    "compilerOptions": {
        "paths": {
            // ... your existing mappings ...
            "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
        }
    }
}
```

This single workspace-wide entry covers all prism projects via the `*` wildcard. The leading `./` is required for TypeScript 6 when `baseUrl` is not set. The `ng-prism.config` and library mappings that `ng add` wrote in 21.x need it as well, see [Troubleshooting](#troubleshooting).

### Step 3: Delete the legacy manifest file

```bash
rm projects/<lib>-prism/src/prism-manifest.ts
```

Plus the `.d.ts` companion if it exists:

```bash
rm projects/<lib>-prism/src/prism-manifest.d.ts
```

### Step 4: Update `.gitignore`

Remove any per-project manifest lines:

```diff
- projects/<lib>-prism/src/prism-manifest.ts
```

Add a single workspace-wide ignore:

```diff
+ ng-prism-cache/
```

### Step 5: Update `projects/<lib>-prism/tsconfig.app.json`

Two changes:

```diff
  "compilerOptions": {
    "outDir": "../../out-tsc/app",
+   "rootDir": "../..",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": [
    "src/**/*.d.ts",
+   "../../ng-prism-cache/<lib>-prism/**/*.ts"
  ]
```

`include` adds the cache file to the program; `rootDir: ../..` makes the workspace root the project root so the cache file is _under_ rootDir. Without both, TypeScript fails with `TS6059`.

### Step 6: Run a build to populate the cache

```bash
ng run my-lib:prism-build
```

The pipeline will generate `<workspaceRoot>/ng-prism-cache/<lib>-prism/prism-manifest.ts` on first run. The Angular bundle should compile cleanly.

## What if I skip the migration?

If you install `@ng-prism/core` 22.x without `ng update`, for example with `npm install`, the migration does not run. Unless you apply the manual steps, expect one of two outcomes:

- **Stale `src/prism-manifest.ts` still present** (the file was previously generated): your `main.ts` still imports the old file via the relative path. The build succeeds, but the data is stale: components added since the last pipeline run won't appear in your styleguide.
- **Old file deleted** (e.g., wiped by `git clean -fdx`): TypeScript fails with `Cannot find module './prism-manifest'`.

In either case, run the migration on its own with `ng update @ng-prism/core --migrate-only --from=21.0.0`, or follow the manual steps above.

## Breaking changes and deprecations in 22.7.0

The breaking changes and deprecations of 22.7.0, and those of every other 22.x minor release, are listed in [Upgrade Notes 22.x](guide/upgrade-notes-22.md#upgrading-to-2270).

## Related

- [Upgrade Notes 22.x](guide/upgrade-notes-22.md): what changed in each 22.x minor release, and what is removed in 23.0.0
- Issue [#13](https://github.com/ng-prism/ng-prism/issues/13)
- Follow-up RFC [#14](https://github.com/ng-prism/ng-prism/issues/14): drop the separate `<lib>-prism` project entirely
