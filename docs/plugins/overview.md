# Overview

Plugins extend ng-prism with additional panels, controls, and build-time data extraction. They are registered in your `ng-prism.config.ts` and activated automatically during both the build pipeline and at runtime.

## What Plugins Can Do

| Capability           | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `panels`             | Add new tabs to the addon panel area or the view toolbar                                    |
| `controls`           | Register custom input controls for specific TypeScript types                                |
| `onComponentScanned` | Enrich `ScannedComponent` data at build time (e.g. extract JSDoc, inject external metadata) |
| `onServiceScanned`   | Enrich `ScannedService` data at build time, for [services](guide/showcasing-services.md)    |
| `onPipeScanned`      | Enrich `ScannedPipe` data at build time, for [pipes](guide/showcasing-pipes.md)             |
| `onPageScanned`      | Enrich `StyleguidePage` data at build time                                                  |
| `onManifestReady`    | Transform the final manifest before it is written to disk                                   |

## Installing Plugins

The fastest path is the `ng-add` schematic. It installs the package and registers the plugin in `ng-prism.config.ts` automatically:

```bash
ng add @ng-prism/plugin-jsdoc
ng add @ng-prism/plugin-figma
# … and so on for any other plugin
```

Re-running is safe, because already-registered plugins are skipped.

If you prefer to wire things up manually, install the package and add the plugin factory to your config:

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';
import { figmaPlugin } from '@ng-prism/plugin-figma';

export default defineConfig({
    plugins: [jsDocPlugin(), figmaPlugin()]
});
```

Plugins run in registration order during build-time hooks and are activated in order at runtime.

## Official Plugins

| Package                                                              | Description                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`@ng-prism/plugin-jsdoc`](plugins/jsdoc.md)                         | Extracts JSDoc comments from source and renders an API documentation panel, also the page of a service or a pipe |
| [`@ng-prism/plugin-figma`](plugins/figma.md)                         | Embeds Figma designs and runs pixel-perfect Design Diffs against the rendered component                          |
| [`@ng-prism/plugin-box-model`](plugins/box-model.md)                 | Overlays CSS box model dimensions on the rendered component                                                      |
| [`@ng-prism/plugin-perf`](plugins/perf.md)                           | Profiles render and re-render timing via the Performance API                                                     |
| [`@ng-prism/plugin-coverage`](plugins/coverage.md)                   | Displays per-component test coverage from Istanbul/v8 reports                                                    |
| [`@ng-prism/plugin-visual-regression`](plugins/visual-regression.md) | Renders a per-variant visual regression report inside the styleguide                                             |

> **Note:** Accessibility auditing (axe-core, keyboard navigation, ARIA tree, screen reader simulation) is built into ng-prism core. No plugin needed.

## Writing Your Own Plugin

See [Writing a Plugin](plugins/writing-plugins.md) for a complete walkthrough of the `NgPrismPlugin` interface, build-time hooks, and runtime panel registration.
