# Figma

`@ng-prism/plugin-figma` brings your Figma designs into ng-prism with two complementary panels:

- **Figma Embed:** live, interactive iframe of the design. Registered by default.
- **Design Diff:** pixel-by-pixel comparison between your rendered component and the Figma node (side by side, overlay, diff), switched in the panel toolbar; **Re-run** compares again, and the match percentage and the number of differing pixels are in its tooltip. **Opt-in** via `figmaPlugin({ designDiff: true })`.

## Install

```bash
ng add @ng-prism/plugin-figma
```

This installs the package and registers `figmaPlugin()` in your `ng-prism.config.ts` automatically, which gives you the Embed panel. See [Configuration](#configuration) to additionally enable the Design Diff panel. To install manually: `npm install @ng-prism/plugin-figma`.

The Design Diff feature additionally needs `html2canvas` and `pixelmatch` (declared as optional peer dependencies):

```bash
npm install html2canvas pixelmatch
```

You only need these if you actually use the Design Diff panel. The Embed panel works without them.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';
import { FIGMA_TOKEN } from './figma-token.local.ts';

export default defineConfig({
    plugins: [
        figmaPlugin({
            // Opt in to the Design Diff panel. Omit it and only the Embed panel is registered.
            designDiff: true,
            // Required by the Design Diff panel to fetch node images.
            accessToken: FIGMA_TOKEN
        })
    ]
});
```

### Options

| Option        | Type      | Default | Description                                                                                                                       |
| ------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `designDiff`  | `boolean` | `false` | Registers the Design Diff panel. Without it the plugin contributes the Embed panel only, and no Design Diff tab appears anywhere. |
| `accessToken` | `string`  | -       | Personal access token used to fetch node images via the Figma REST API. Only read by the Design Diff panel.                       |

### Getting a Figma access token

1. Open Figma → **Settings** → **Security** → **Personal access tokens**.
2. Create a new token. Grant it the **File content (read-only)** scope. The plugin needs nothing else.
3. Put it into a file next to `ng-prism.config.ts` that stays out of git, and import it from there (example above):

    ```typescript
    // figma-token.local.ts, listed in .gitignore
    export const FIGMA_TOKEN = 'figd_…';
    ```

    The config runs twice: in Node inside the builder and in the browser, so `process.env['FIGMA_TOKEN']` doesn't work (the Angular build rejects `process`, and the browser has none). The `.ts` extension in the import lets the builder load the file in Node, which needs Node 22.18 or newer. For the Angular build, add `"rewriteRelativeImportExtensions": true` to the `compilerOptions` of the styleguide app's `tsconfig.app.json`. The file has to exist wherever the styleguide is built: without a token, `export const FIGMA_TOKEN = '';` builds, and the panel reports the missing token when you run a diff.

> **The token becomes part of the styleguide app.** The styleguide's `main.ts` imports `ng-prism.config.ts`, and `figmaPlugin()` hands its options to the Design Diff panel, which calls the Figma REST API from the browser. Anyone who can open a styleguide built with a token can read the token from its bundle. Never deploy a styleguide built with your personal token where others can open it, and never commit the token to a repository.

The two options are independent: `designDiff` decides whether the panel exists, `accessToken` decides whether it can run. Setting `accessToken` alone does not register the panel; setting `designDiff: true` without a token registers it, but it shows an "Access Token fehlt" hint when triggered. For most setups the Embed panel alone is enough. Enable the diff only when you want to compare pixels.

## Linking components to Figma nodes

Both panels read Figma URLs from `meta.figma`, but not from the same place:

- The **Embed panel** reads only the component-level `meta.figma` on `@Showcase`, and only when it is a string. It shows the same design for every variant, and it stays hidden when the component has no such string, even if its variants have one.
- The **Design Diff panel** (with `designDiff: true`) appears once at least one variant sets `meta.figma`; a component-level value alone does not show it. It compares the active variant with that variant's `meta.figma`, or with the component-level one when the variant has none.

The Design Diff panel needs a node id: a `node-id` query parameter in the URL, which Figma adds when you copy the link to a selected frame, or the `nodeId` of the [object form](#object-form). The Embed panel passes the URL to Figma's embed endpoint as it is.

### Component-level URL

The only value the Embed panel reads, and the Design Diff panel's fallback for variants without their own:

```typescript
@Showcase({
  title: 'Button',
  meta: {
    figma: 'https://www.figma.com/design/abc123/My-Design?node-id=1-1',
  },
  variants: [
    { name: 'Primary', inputs: { variant: 'primary' } },
    { name: 'Danger',  inputs: { variant: 'danger' } },
  ],
})
```

### Variant-level URLs

Link a variant to its own Figma node. **The Design Diff panel needs at least one**: it only appears when a variant sets `meta.figma`, and it compares the active variant with that variant's node:

```typescript
@Showcase({
  title: 'Button',
  variants: [
    {
      name: 'Primary',
      inputs: { variant: 'primary' },
      meta: { figma: 'https://www.figma.com/design/abc123/My-Design?node-id=1-1' },
    },
    {
      name: 'Danger',
      inputs: { variant: 'danger' },
      meta: { figma: 'https://www.figma.com/design/abc123/My-Design?node-id=1-2' },
    },
  ],
})
```

For the Design Diff panel, a variant's `meta.figma` takes precedence over the component-level value, and a variant without one falls back to it. The Embed panel ignores variant-level values.

### Object form

`meta.figma` also accepts an object, which is useful if you want to override the parsed node id explicitly. Only the Design Diff panel reads this form; on the component level it hides the Embed panel, which needs a string:

```typescript
meta: {
  figma: {
    url: 'https://www.figma.com/design/abc123/My-Design?node-id=1-1',
    nodeId: '1:1', // optional, overrides the node-id extracted from the URL
  },
},
```

## Panel: Figma Embed

The Embed panel uses the public Figma Embed endpoint (`https://www.figma.com/embed?embed_host=ng-prism&url=...`). **No access token required** for public files. For private files, the user must be logged into Figma in their browser.

The embedded viewer is fully interactive: you can navigate nodes, zoom and inspect properties without leaving ng-prism.

The panel is visible when the component-level `meta.figma` on `@Showcase` is a string. Variant-level values don't count.

The panel registers itself with `keepAlive: true`, so the iframe survives tab switches. Switching to Controls and back will not trigger a re-load of the Figma embed. The iframe is only reloaded when the active component (and therefore the Figma URL) changes.

## Panel: Design Diff

The Design Diff panel renders the component into a canvas (via `html2canvas`), fetches the corresponding Figma node as a PNG (via the Figma REST API), and computes a pixel-by-pixel diff (via `pixelmatch`).

The panel has to be enabled with `figmaPlugin({ designDiff: true })`. Once enabled, it is visible when at least one variant has `meta.figma`. The diff targets the active variant, with the variant's own `meta.figma` or, without one, the component-level value.

### Workflow

1. Open the **Design Diff** panel.
2. Click **▶ Design Diff ausführen** to run the comparison.
3. Review the result in one of three modes.

### View modes

| Mode             | What you see                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Side-by-side** | Component screenshot and Figma export rendered next to each other.                                                       |
| **Overlay**      | Figma export layered on top of the component, with an opacity slider (0–100). Great for catching small alignment drifts. |
| **Diff**         | Just the pixelmatch output: red pixels where component and design diverge.                                               |

### Stats

The toolbar shows:

- **Similarity %:** `(totalPixels − diffPixels) / totalPixels * 100`
- **Diff pixel count:** raw number of pixels that differ beyond the threshold

Click **↺ Erneut** in the toolbar to re-run after editing the component or refreshing the Figma source.

### How the diff works

1. The component is captured with `html2canvas` at the size it currently renders. For a variant with a `template` or a host template, that is the whole composition, see [Canvas State](architecture/canvas-state.md#composed-variants-root-and-subject).
2. The Figma node is fetched at **2× scale** via `GET /v1/images/{fileKey}?ids={nodeId}&format=png&scale=2` and scaled to match the component dimensions.
3. `pixelmatch` runs with `threshold: 0.1` and anti-aliasing detection disabled, producing the diff buffer.
4. All three artefacts (component, Figma, diff) are stored as data URLs in the panel state, so mode switching makes no further network calls.

### Error states

| Status               | What it means                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Access Token fehlt` | The panel is enabled via `designDiff: true`, but no `accessToken` was passed to `figmaPlugin()`.                                                                                                                                                                                                                                     |
| `Kein Figma-Node …`  | Neither the active variant nor the component has a `meta.figma` with a node id: the value is missing, or its URL has no `node-id` and there is no `nodeId`.                                                                                                                                                                          |
| `Figma API Fehler`   | The diff failed. Usually the Figma REST API rejected the request: invalid token, missing file scope, file/node not accessible to the token's owner. It also shows `Ungültige Figma-URL` for a URL that is not a `figma.com/design/…` or `figma.com/file/…` link, and errors from capturing the component or loading the Figma image. |

## Lazy loading

The Design Diff panel component (`FigmaDesignDiffPanelComponent`) is loaded via `loadComponent`; the Embed panel component (`FigmaPanelComponent`) is imported directly. The plugin factory itself runs in Node.js (during the build) and in the browser, so we avoid eager imports of `@angular/platform-browser`, `html2canvas`, and `pixelmatch`, because they would crash the Node-side evaluation. The heavy diff dependencies are only pulled in the moment the user clicks **Design Diff ausführen**.
