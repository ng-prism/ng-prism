# @ng-prism/plugin-figma

Figma design embed panel for [@ng-prism/core](https://github.com/ng-prism/ng-prism). Displays Figma designs as interactive iframes directly in your component styleguide.

> **Full documentation:** [ng-prism Docs: Figma Plugin](https://ng-prism.github.io/ng-prism/#/plugins/figma)

Uses Figma's official embed endpoint, so no API token is required. Works with any publicly shared Figma file.

An optional **Design Diff** panel compares the rendered component against the Figma node pixel by pixel. It is opt-in and needs a Figma access token (see [`figmaPlugin()`](#figmaplugin) below).

## Installation

```bash
npm install @ng-prism/plugin-figma
```

### Peer Dependencies

| Package          | Version               |
| ---------------- | --------------------- |
| `@ng-prism/core` | `^<plugin version>-0` |
| `@angular/core`  | `>=20.0.0`            |

Each release requires the `@ng-prism/core` of its own version (`^22.7.0-0` for 22.7.0), so keep the core and the plugin on the same version.

## Usage

### 1. Register the plugin

Add `figmaPlugin()` to your `ng-prism.config.ts`:

```typescript
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';

export default defineConfig({
    plugins: [figmaPlugin()]
});
```

### 2. Link Figma designs to components

Add a `figma` key to the `meta` field of your `@Showcase` decorator:

```typescript
import { Component, input, output } from '@angular/core';
import { Showcase } from '@ng-prism/core';

@Showcase({
    title: 'Button',
    category: 'Inputs',
    meta: {
        figma: 'https://www.figma.com/file/abc123/my-design'
    }
})
@Component({
    selector: 'my-button',
    standalone: true,
    template: `<button>{{ label() }}</button>`
})
export class ButtonComponent {
    label = input('Button');
}
```

A **Figma** tab appears in the panel area (next to Controls and Events). The tab displays an interactive Figma viewer with zoom and navigation support.

Components without a `meta.figma` URL show a placeholder message instead.

### Supported URL formats

Any publicly shared Figma URL works:

- `https://www.figma.com/file/<id>/<name>`: full file
- `https://www.figma.com/file/<id>/<name>?node-id=<node>`: specific frame/component
- `https://www.figma.com/design/<id>/<name>`: new Figma URL format

## How it works

By default the plugin registers a single panel (`FigmaPanelComponent`) that:

1. Reads `meta.figma` from the active component's `@Showcase` config
2. Constructs a Figma embed URL: `https://www.figma.com/embed?embed_host=ng-prism&url=<encoded-url>`
3. Renders the embed in a sandboxed `<iframe>` with `allowfullscreen`
4. Reactively updates when navigating between components (Angular Signals)

No build-time hooks; the plugin is purely runtime. The panel component is **lazy-loaded**
via `loadComponent` to avoid pulling in browser-only Angular dependencies (`DomSanitizer`)
at config-load time in Node.js.

## API

### `figmaPlugin(options?)`

Factory function that returns an `NgPrismPlugin`. Zero-config by default: called without
arguments it registers the Figma embed panel and nothing else.

```typescript
import { figmaPlugin } from '@ng-prism/plugin-figma';

const plugin = figmaPlugin();
// plugin.name === '@ng-prism/plugin-figma'
// plugin.panels === [{ id: 'figma', label: 'Figma', component: FigmaPanelComponent, ... }]
```

#### Options

| Option        | Type      | Default | Description                                                                                                 |
| ------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `designDiff`  | `boolean` | `false` | Registers the Design Diff panel. Without it, no Design Diff tab appears.                                    |
| `accessToken` | `string`  | -       | Figma personal access token used to fetch node images via the REST API. Only read by the Design Diff panel. |

```typescript
import { FIGMA_TOKEN } from './figma-token.local.ts'; // gitignored: export const FIGMA_TOKEN = 'figd_…';

figmaPlugin({ designDiff: true, accessToken: FIGMA_TOKEN });
// plugin.panels === [{ id: 'figma', ... }, { id: 'figma-diff', label: 'Design Diff', ... }]
```

`ng-prism.config.ts` also runs in the browser, so `process.env` is not available there. Keep the token in a gitignored `.ts` file next to the config, import it with the `.ts` extension (Node 22.18 or newer), and add `"rewriteRelativeImportExtensions": true` to the styleguide app's `tsconfig.app.json`. The token ends up in the styleguide bundle: never deploy a styleguide built with a personal token where others can open it. See the [Figma plugin guide](https://ng-prism.github.io/ng-prism/#/plugins/figma) for the details.

`accessToken` alone does not enable the panel. The two options are independent, so a token
in your config never surfaces a tab you did not ask for. Enabling `designDiff` without a token
registers the panel, but it reports a missing token when you run a diff.

### `FigmaPanelComponent`

The Angular component rendering the Figma iframe. Lazy-loaded by the plugin, so typically
you don't need to import it directly. The type is exported for advanced use cases.

## License

MIT
