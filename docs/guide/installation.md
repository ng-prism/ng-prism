# Installation

ng-prism runs in your workspace as two builders and a small styleguide app next to the library it shows. `ng add` sets up all of it.

## Prerequisites

- An Angular 22 workspace, from the Angular CLI or from Nx (see [Nx Workspaces](#nx-workspaces))
- Node.js 22+
- A library project whose components you want to showcase

## Automatic Setup with `ng add`

```bash
ng add @ng-prism/core
```

The schematic prompts for the library project unless you pass `--project`. The other two options are flags only:

| Option       | Default                | Description                                                                                          |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `--project`  | _(prompted, required)_ | The library whose components you want to showcase. The styleguide app is named `<project>-prism`.    |
| `--port`     | `4400`                 | Dev server port, written to the library's `prism` target and to the styleguide app's `serve` target. |
| `--zoneless` | `false`                | Bootstraps the styleguide app with `provideZonelessChangeDetection()` and without `zone.js`.         |

It installs `@ng-prism/core` as a dev dependency and sets up:

- **The styleguide app** `<project>-prism`, next to the library, so a library in `libs/` gets its styleguide app in `libs/` too. Its targets are under [The styleguide app target](api/builders.md#the-styleguide-app-target).
- **Two targets on the library:** `prism` for the dev server and `prism-build` for a production build, see [Builders](api/builders.md).
- **`ng-prism.config.ts`** in the workspace root, see [Configuration](guide/configuration.md).
- **Path mappings** in the root `tsconfig.json`, or `tsconfig.base.json` where the workspace has one: `ng-prism.config` for the config, `prism-manifest/*` for the manifest the builders write, and one from the project name to the library's entry file.
- **`ng-prism-cache/`** in `.gitignore`, where the builders write the manifest.
- **A `strip-showcase` npm script**, which removes `@Showcase` from the built library before you publish it, see [Publishing Libraries](guide/library-publishing.md).
- **`highlight.js` and `ngx-highlightjs`** as dev dependencies, for the code in the styleguide. `axe-core`, which runs the [Accessibility Panel](guide/accessibility.md), comes with `@ng-prism/core`.

```
projects/
  my-lib-prism/          ← generated styleguide app
    src/
      main.ts            ← bootstraps the styleguide
      index.html
    tsconfig.app.json
ng-prism.config.ts       ← your configuration file (workspace root)
angular.json             ← prism / prism-build targets added to my-lib
tsconfig.json            ← path mappings added here
```

What is already there stays as it is: an existing file, target, path mapping or script is not overwritten, so running `ng add` again only adds what is missing.

## Verify

```bash
ng run my-lib:prism        # or whatever the schematic named it
```

The styleguide opens at `http://localhost:4400`. Your components appear once they carry `@Showcase`, see [Your First Showcase](guide/first-showcase.md).

## Nx Workspaces

ng-prism works in Nx workspaces that define projects through per-project `project.json` files. Run the schematic through Nx rather than the Angular CLI:

```bash
npx nx g @ng-prism/core:ng-add --project=my-lib
```

`ng add @ng-prism/core` does not work here. The Angular CLI refuses to run outside a workspace it recognises, and an Nx workspace has no root `angular.json`. Nx's generator bridge supplies the workspace configuration to the schematic and writes the result back into the relevant `project.json` files, converting `architect` to `targets` and `builder` to `executor` along the way.

The schematic adapts to the workspace it finds:

| Aspect              | Angular CLI                           | Nx                                                  |
| ------------------- | ------------------------------------- | --------------------------------------------------- |
| Styleguide app root | next to the library, e.g. `projects/` | `apps/` when present, otherwise next to the library |
| Application builder | `@angular-devkit/build-angular`       | `@angular/build` when it is a direct dependency     |
| Path mappings       | `tsconfig.json`                       | `tsconfig.base.json`                                |
| Targets             | `architect` / `builder`               | `targets` / `executor`                              |

The app root also honours `workspaceLayout.appsDir` in `nx.json` when you have configured one. Existing path mappings are never overwritten.

Run the targets the usual way:

```bash
npx nx run my-lib:prism          # dev server on :4400
npx nx run my-lib:prism-build    # production build
```

> If Nx reports `Cannot find target 'prism'` straight after running the schematic, its project graph is stale; `npx nx reset` clears it.

Plugins are added through Nx as well, see [Installing Plugins](plugins/overview.md#installing-plugins).

## Zoneless Mode (optional, recommended)

ng-prism runs with Angular's zoneless change detection. Pass `--zoneless` during setup, and the styleguide app bootstraps with `provideZonelessChangeDetection()` and leaves the `zone.js` polyfill out of its bundle:

```bash
ng add @ng-prism/core --zoneless
```

The styleguide itself is built on signals and works either way. Whether zoneless suits your library depends on your components: they render inside the styleguide app, so a component that relies on `zone.js` to notice a change does not update there.

### Migrating an existing setup to zoneless

Three manual edits are needed:

**1. `projects/<lib>-prism/src/main.ts`**: add `provideZonelessChangeDetection()`:

```diff
+import { provideZonelessChangeDetection } from '@angular/core';
 import { bootstrapApplication } from '@angular/platform-browser';
 import { enablePrismHmr, PrismShellComponent, providePrism } from '@ng-prism/core';
 …
 bootstrapApplication(PrismShellComponent, {
-  providers: [providePrism(PRISM_RUNTIME_MANIFEST, config)],
+  providers: [
+    provideZonelessChangeDetection(),
+    providePrism(PRISM_RUNTIME_MANIFEST, config),
+  ],
 })…
```

**2. `angular.json`**: remove the `zone.js` polyfill from the styleguide app's build target:

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

**Verify:** run `ng run <lib>:prism`. The app should boot without errors and all showcases should render.

## Manual Setup

If you prefer not to use the schematic, set up what it would. The example uses a library `my-lib` in `projects/my-lib` with the entry file `src/public-api.ts`.

**1. Install the packages:**

```bash
npm install -D @ng-prism/core highlight.js ngx-highlightjs
```

**2. Create the styleguide app** `my-lib-prism`, an Angular application with the `build` and `serve` targets shown under [The styleguide app target](api/builders.md#the-styleguide-app-target). Its `src/index.html` renders `<prism-shell></prism-shell>`, and its `tsconfig.app.json` takes the manifest into the program:

```json
{
    "extends": "../../tsconfig.json",
    "compilerOptions": {
        "outDir": "../../out-tsc/app",
        "rootDir": "../..",
        "types": []
    },
    "files": ["src/main.ts"],
    "include": ["src/**/*.d.ts", "../../ng-prism-cache/my-lib-prism/**/*.ts"]
}
```

**3. Create `ng-prism.config.ts`** in the workspace root:

```typescript
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    plugins: []
});
```

**4. Write `src/main.ts`** of the styleguide app. The `hot` part swaps a rescanned manifest into the running app, see [Watching and reloading](api/builders.md#watching-and-reloading):

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { enablePrismHmr, PrismShellComponent, providePrism } from '@ng-prism/core';
import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/my-lib-prism'; // written by the builders into ng-prism-cache/my-lib-prism/
import config from 'ng-prism.config';

type ManifestModule = { PRISM_RUNTIME_MANIFEST: typeof PRISM_RUNTIME_MANIFEST };
const hot = (import.meta as ImportMeta & { hot?: { accept(dep: string, cb: (mod: ManifestModule | undefined) => void): void } }).hot;

bootstrapApplication(PrismShellComponent, {
    providers: [providePrism(PRISM_RUNTIME_MANIFEST, config)]
}).then((appRef) => {
    hot?.accept('prism-manifest/my-lib-prism', (mod) => {
        if (mod) enablePrismHmr(appRef, mod.PRISM_RUNTIME_MANIFEST);
    });
});
```

**5. Add the path mappings** to the root `tsconfig.json`. `main.ts` imports the config and the manifest through them, and the manifest imports your components from the library's project name, see [`libraryImportPath`](api/builders.md#libraryimportpath):

```jsonc
{
    "compilerOptions": {
        "paths": {
            "ng-prism.config": ["./ng-prism.config.ts"],
            "my-lib": ["./projects/my-lib/src/public-api.ts"],
            "prism-manifest/*": ["./ng-prism-cache/*/prism-manifest.ts"]
        }
    }
}
```

Add `ng-prism-cache/` to `.gitignore`. Where the manifest goes and why the mappings start with `./` is under [Manifest Output Location](architecture/pipeline.md#manifest-output-location).

**6. Add the targets** `prism` and `prism-build` to the library, as shown under [Builders](api/builders.md). In an Nx workspace they go into the library's `project.json` under `targets`, with `executor` instead of `builder`.

## Next Steps

- [Your First Showcase](guide/first-showcase.md): annotate a component and open it in the styleguide.
- [Overview](plugins/overview.md): the official plugins, each added with one `ng add`, see [Installing Plugins](plugins/overview.md#installing-plugins).
- [Configuration](guide/configuration.md): what goes into `ng-prism.config.ts`.
- [Builders](api/builders.md): every option of the `prism` and `prism-build` targets.
