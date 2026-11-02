# Box Model

`@ng-prism/plugin-box-model` overlays the CSS box model of the element under the pointer on the canvas, so you can inspect margin, border, padding and content without leaving the styleguide.

## What it does

- Adds a **Box Model** tab (id `box-model`) to the addons panel below the canvas.
- While that tab is active, overlays the element under the pointer with color-coded regions: margin (orange), border (yellow), padding (green), content (blue).
- Labels the overlay with the margin and padding of each side that is not zero and the content size, and shows the full box model of the same element in the tab.
- Reads the box model again on every pointer move over the canvas.

## Install

```bash
ng add @ng-prism/plugin-box-model
```

This installs the package and registers `boxModelPlugin()` in `ng-prism.config.ts`. To install it by hand, see [Installing Plugins](plugins/overview.md#installing-plugins).

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { boxModelPlugin } from '@ng-prism/plugin-box-model';

export default defineConfig({
    plugins: [boxModelPlugin()]
});
```

## Options

`boxModelPlugin()` takes no options.

## Using the Inspector

1. Open any component in the styleguide.
2. Open the **Box Model** tab in the addons panel.
3. Move the pointer over the component on the canvas. The overlay marks the margin, border, padding and content areas of the element under the pointer: the component's host element or any element inside it.
4. The tab shows the values of the same element: each layer (margin, border, padding, content) in its own colour with its name in the top-left corner and every side at its edge, zero included. The content size is in the middle, the border-box and content sizes are in the diagram's tooltip. Moving the pointer off the component clears the overlay and the tab, which then says **Hover over an element to inspect its box model.**

Elements outside the rendered component are ignored.

## Parts and compositions

For a variant with a [`template` or a host template](guide/compositions.md), the rendered component is the whole composition, so the frame and the other parts around the showcased component can be inspected too, see [Canvas State](architecture/canvas-state.md#composed-variants-root-and-subject). A [part](guide/parts.md) has no page of its own; inspect it where its parent's variants render it.

## Troubleshooting

- **No overlay on the canvas:** the overlay is drawn only while the **Box Model** tab is the active tab of the addons panel, and never while the [measuring tool](guide/measuring.md) is on or in [capture mode](guide/external-tooling.md#capture-isolation-mode).
- **The overlay stops at the component's edge:** elements outside the rendered component, such as a popup that renders into `<body>`, are ignored.

## Related

- [Measuring](guide/measuring.md): distances between elements on the canvas, without a plugin
- [Tour of the UI](guide/styleguide-ui.md): the canvas and the addons panel
