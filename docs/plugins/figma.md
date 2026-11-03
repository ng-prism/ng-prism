# Figma

`@ng-prism/plugin-figma` brings your Figma designs into the styleguide: embedded next to the component, and on request compared with it pixel by pixel.

## What it does

- Adds a **Figma** tab (id `figma`) to the addons panel below the canvas: the live, interactive Figma embed of the design that the component's `meta.figma` links. Registered by default.
- With `designDiff: true`, adds a **Design Diff** tab (id `figma-diff`): it captures the active variant, fetches its Figma node as an image and compares the two pixel by pixel, side by side, as an overlay or as a diff. See [Design Diff](#design-diff).

## Install

```bash
ng add @ng-prism/plugin-figma
```

This installs the package and registers `figmaPlugin()` in `ng-prism.config.ts`, which gives you the Figma tab. [Configuration](#configuration) shows how to add the Design Diff tab. To install it by hand, see [Installing Plugins](plugins/overview.md#installing-plugins).

The Design Diff needs `html2canvas` and `pixelmatch` as well, which the plugin declares as optional peer dependencies:

```bash
npm install -D html2canvas pixelmatch
```

The Figma tab works without them. The Design Diff tab is loaded when you first open it, and it loads `html2canvas` and `pixelmatch` only when you run a diff.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';
import { FIGMA_TOKEN } from './figma-token.local.ts';

export default defineConfig({
    plugins: [
        figmaPlugin({
            // Opt in to the Design Diff tab. Without it only the Figma tab is registered.
            designDiff: true,
            // Required by the Design Diff to fetch node images.
            accessToken: FIGMA_TOKEN
        })
    ]
});
```

The two options are independent: `designDiff` decides whether the Design Diff tab exists, `accessToken` whether it can run. `accessToken` alone does not add the tab; `designDiff: true` without a token adds it, and a diff then stops at **No access token**. For most setups the Figma tab alone is enough. Enable the diff when you want to compare pixels.

### Getting a Figma access token

1. Open Figma → **Settings** → **Security** → **Personal access tokens**.
2. Create a new token. Grant it the **File content (read-only)** scope. The plugin needs nothing else.
3. Put it into a file next to `ng-prism.config.ts` that stays out of git, and import it from there (example above):

    ```typescript
    // figma-token.local.ts, listed in .gitignore
    export const FIGMA_TOKEN = 'figd_…';
    ```

    The config runs twice: in Node inside the builder and in the browser, so `process.env['FIGMA_TOKEN']` doesn't work (the Angular build rejects `process`, and the browser has none). The `.ts` extension in the import lets the builder load the file in Node, which needs Node 22.18 or newer. For the Angular build, add `"rewriteRelativeImportExtensions": true` to the `compilerOptions` of the styleguide app's `tsconfig.app.json`. The file has to exist wherever the styleguide is built: without a token, `export const FIGMA_TOKEN = '';` builds, and the Design Diff reports the missing token when you run a diff.

> **The token becomes part of the styleguide app.** The styleguide's `main.ts` imports `ng-prism.config.ts`, and `figmaPlugin()` hands its options to the Design Diff, which calls the Figma REST API from the browser. Anyone who can open a styleguide built with a token can read the token from its bundle. Never deploy a styleguide built with your personal token where others can open it, and never commit the token to a repository.

## Options

| Option        | Type      | Default | Description                                                                                                              |
| ------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `designDiff`  | `boolean` | `false` | Adds the Design Diff tab. Without it the plugin contributes the Figma tab only, and no Design Diff tab appears anywhere. |
| `accessToken` | `string`  | none    | Personal access token the Design Diff uses to fetch node images from the Figma REST API. Nothing else reads it.          |

## Linking components to Figma nodes

Both tabs read Figma URLs from `meta.figma`, but not from the same place:

- The **Figma tab** reads only the component-level `meta.figma` on `@Showcase`, and only when it is a string. It shows the same design for every variant, and it stays hidden when the component has no such string, even if its variants have one.
- The **Design Diff** tab (with `designDiff: true`) appears once at least one variant sets `meta.figma`; a component-level value alone does not show it. It compares the active variant with that variant's `meta.figma`, or with the component-level one when the variant has none.

The Design Diff needs a node id: a `node-id` query parameter in the URL, which Figma adds when you copy the link to a selected frame, or the `nodeId` of the [object form](#object-form). The Figma tab passes the URL to Figma's embed endpoint as it is.

### Component-level URL

The only value the Figma tab reads, and the Design Diff's fallback for variants without their own:

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

Link a variant to its own Figma node. **The Design Diff needs at least one**: its tab only appears when a variant sets `meta.figma`, and it compares the active variant with that variant's node:

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

For the Design Diff, a variant's `meta.figma` takes precedence over the component-level value, and a variant without one falls back to it. The Figma tab ignores variant-level values.

### Object form

`meta.figma` also accepts an object, which is useful if you want to set the node id explicitly. Only the Design Diff reads this form; on the component level it hides the Figma tab, which needs a string:

```typescript
meta: {
  figma: {
    url: 'https://www.figma.com/design/abc123/My-Design?node-id=1-1',
    nodeId: '1:1', // optional, overrides the node-id read from the URL
  },
},
```

## The Figma tab

The tab embeds the design through Figma's public embed endpoint (`https://www.figma.com/embed?embed_host=ng-prism&url=...`). **No access token is required.** For a private file, the viewer has to be logged into Figma in the same browser.

The embedded viewer is fully interactive: you can navigate nodes, zoom and inspect properties without leaving ng-prism.

The tab keeps its iframe while you switch to another tab (the panel is `keepAlive`), so coming back to it does not reload the design. The iframe reloads when the URL changes, for example on another component.

## Design Diff

The Design Diff tab renders the active variant into an image (with `html2canvas`), fetches the Figma node as a PNG (from the Figma REST API) and computes a pixel-by-pixel diff (with `pixelmatch`).

### Workflow

1. Open the **Design Diff** tab.
2. Click **Run design diff**. The tab shows **Loading screenshots…** while it works.
3. Review the result in one of three views, switched in the panel toolbar.
4. Click **Re-run** after editing the component or the Figma node to compare again.

### View modes

| Mode             | What you see                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Side by side** | The capture of the component (labelled `ng-prism`) and the Figma image (labelled `Figma`) next to each other.                            |
| **Overlay**      | The Figma image on top of the capture, with an opacity slider from 0 to 100 that starts at 50. Good for catching small alignment drifts. |
| **Diff**         | The `pixelmatch` output alone: red pixels where the component and the design differ.                                                     |

### Stats

The tooltip of **Re-run** shows the result of the last run, for example `98.7% match · 1,204 px differ`:

- **Match:** `(totalPixels − diffPixels) / totalPixels × 100`, with one decimal
- **Pixels that differ:** the number of pixels that differ beyond the threshold

### How the diff works

1. The component is captured with `html2canvas` at the size it renders, at the screen's device pixel ratio. For a variant with a `template` or a host template, that is the whole composition, see [Canvas State](architecture/canvas-state.md#composed-variants-root-and-subject).
2. The Figma node is fetched at **2× scale** with `GET https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2` and the token in the `X-Figma-Token` header, then scaled to the size of the capture. The file key comes from a `figma.com/design/…` or `figma.com/file/…` URL; a `node-id` such as `1-2` is read as `1:2`.
3. `pixelmatch` compares the two with `threshold: 0.1`. It detects anti-aliased pixels and does not count them as differences.
4. All three images (capture, Figma image, diff) are kept in the tab, so switching views makes no further request.

## Parts and compositions

- **Parts:** a [part](guide/parts.md) has no page of its own, so no Figma tab or Design Diff shows the `meta.figma` it declares. Link the design on the parent, or on the parent's variants that show the part.
- **Compositions:** for a variant with a [`template` or a host template](guide/compositions.md), the Design Diff captures the whole composition, frame and other parts included. Compare such a variant with a Figma frame of the whole composition.

## Troubleshooting

The Design Diff tab shows one of these instead of a result:

| Message                            | What it means                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No access token**                | `designDiff: true` is set, but `figmaPlugin()` got no `accessToken`. The hint under it names the option to set.                                                                                                                                                                                                                                                       |
| **No Figma node for this variant** | Neither the active variant nor the component has a `meta.figma` with a node id: the value is missing, its URL has no `node-id` and there is no `nodeId`, or the variant's own value cannot be read (the component-level one is then not used).                                                                                                                        |
| **Figma API error**                | The diff failed, with the reason under it. Usually the Figma REST API rejected the request (`Figma API 403: …`): an invalid token, a missing file scope, or a file or node the token's owner cannot open. It also appears for a URL that is not a `figma.com/design/…` or `figma.com/file/…` link, and when capturing the component or loading the Figma image fails. |

When a tab is missing:

- **No Figma tab:** the component-level `meta.figma` is not a string, or the component has none. Variant-level values and the object form do not count for it.
- **No Design Diff tab:** `designDiff: true` is not set, or no variant of the component sets `meta.figma`.

## Related

- [`meta`](api/showcase-config.md#meta) in the ShowcaseConfig reference: where `figma` goes
- [Visual Regression](plugins/visual-regression.md): compares captures with baselines from your own runner, not with a design
- [Installing Plugins](plugins/overview.md#installing-plugins)
