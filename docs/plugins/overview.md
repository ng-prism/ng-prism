# Overview

Plugins extend ng-prism with panels, input controls, header widgets, sidebar markers and data that is read while the styleguide is built. You register them in `ng-prism.config.ts`, which runs both in the builder and in the styleguide app.

## What Plugins Can Do

A plugin adds tabs below the canvas or views next to the Playground, input controls of its own, figures in the header and markers in the sidebar, and it can read or add data while the styleguide is built. What each part of a plugin does is listed under [Writing a Plugin](plugins/writing-plugins.md#create-the-factory).

## Installing Plugins

Each official plugin comes with an `ng-add` schematic:

```bash
ng add @ng-prism/plugin-jsdoc
ng add @ng-prism/plugin-figma
ng add @ng-prism/plugin-box-model
ng add @ng-prism/plugin-perf
ng add @ng-prism/plugin-coverage
ng add @ng-prism/plugin-visual-regression
```

Each command installs the package as a dev dependency and adds its import and its call, without options (`jsDocPlugin()`), to the `plugins` of `ng-prism.config.ts` in the workspace root. Re-running is safe: a plugin whose import and call are already there is skipped. Options go into the call afterwards; each plugin's page lists them.

- **Another config file:** pass its path, `ng add @ng-prism/plugin-jsdoc --config-path=config/ng-prism.config.ts`.
- **What the schematic expects:** the config file exists (`ng add @ng-prism/core` creates it, see [Installation](guide/installation.md)), its default export is a `defineConfig({ … })` call with an object literal, and `plugins`, where it is set, is an array literal. Otherwise the schematic stops with an error and changes nothing.
- **Nx:** `ng add` does not run in an Nx workspace, see [Nx Workspaces](guide/installation.md#nx-workspaces). Install the package and run its schematic through Nx:

```bash
npm install -D @ng-prism/plugin-jsdoc
npx nx g @ng-prism/plugin-jsdoc:ng-add
```

To wire a plugin up by hand, install the package and add its factory to `plugins`:

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin(), figmaPlugin()]
});
```

- **Import from the package name.** A plugin with build-time code ships a separate browser half, and the Angular build picks it by itself, see [Node and browser entry points](plugins/writing-plugins.md#node-and-browser-entry-points).
- **Keep the versions together.** An official plugin needs `@ng-prism/core` of at least its own version, within the same major: 22.7.0 asks for `^22.7.0-0`. Update the core and the plugins together.
- **Order:** plugins run in the order of [`plugins`](api/ng-prism-config.md#plugins). Their build hooks run one after the other, see [Plugin Hooks](architecture/plugin-hooks.md#hook-execution-order), and their tabs appear in that order.

## Official Plugins

| Plugin                                            | Package                              | What it adds                                                                                                                    |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [JSDoc](plugins/jsdoc.md)                         | `@ng-prism/plugin-jsdoc`             | The **API** view tab of every component and directive, and the page of every service and pipe, read from the code and its JSDoc |
| [Figma](plugins/figma.md)                         | `@ng-prism/plugin-figma`             | A **Figma** tab with the embedded design, and with `designDiff: true` a **Design Diff** tab that compares the component with it |
| [Box Model](plugins/box-model.md)                 | `@ng-prism/plugin-box-model`         | A **Box Model** tab and an overlay with the margin, border, padding and content of the element under the pointer                |
| [Perf](plugins/perf.md)                           | `@ng-prism/plugin-perf`              | A **Performance** tab with the shipped size of the component file, render timings and heap readings                             |
| [Coverage](plugins/coverage.md)                   | `@ng-prism/plugin-coverage`          | A **Coverage** tab with the test coverage of each component's file, a header pill and sidebar markers, from an Istanbul summary |
| [Visual Regression](plugins/visual-regression.md) | `@ng-prism/plugin-visual-regression` | A **Visual Regression** tab with the results of your screenshot runner per variant, a header pill and sidebar markers           |

> The accessibility audit is built into the core, no plugin needed, see [Accessibility Panel](guide/accessibility.md).

## Writing Your Own Plugin

See [Writing a Plugin](plugins/writing-plugins.md) for a walkthrough: the factory, a build hook, a panel, the Node and browser entry points, header widgets, sidebar markers, input controls and publishing.
