# Box Model

`@ng-prism/plugin-box-model` overlays CSS box model dimensions on the rendered component, letting you inspect margin, border, padding, and content dimensions without leaving the showcase.

## What It Does

- Adds a **Box Model** tab to the addon panel below the canvas
- While that tab is active, overlays the element under the pointer with color-coded regions: margin (orange), border (yellow), padding (green), content (blue)
- Labels the overlay with the margin and padding values and the content size, and shows the full box model in the panel
- Reads the box model again on every pointer move over the canvas

## Install

```bash
ng add @ng-prism/plugin-box-model
```

This installs the package and registers `boxModelPlugin()` in your `ng-prism.config.ts` automatically. To install manually: `npm install @ng-prism/plugin-box-model`.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
import { boxModelPlugin } from '@ng-prism/plugin-box-model';

export default defineConfig({
    plugins: [boxModelPlugin()]
});
```

## Using the Inspector

1. Open any component in the showcase.
2. Open the **Box Model** tab in the addon panel.
3. Move the pointer over the component on the canvas. The overlay marks the margin, border, padding, and content areas of the element under the pointer: the component's host element or any element inside it.
4. The panel below the canvas shows the values of the same element: each layer (margin, border, padding, content) in its own colour with its name in the top-left corner and every side at its edge, zero included. The border-box and content sizes are in the diagram's tooltip. Moving the pointer off the component clears the overlay and the panel.

Elements outside the rendered component are ignored. For a variant with a `template` or a host template, that is the whole composition, so the frame and the other parts around the component can be inspected too, see [Canvas State](architecture/canvas-state.md#composed-variants-root-and-subject). The overlay does not appear while the canvas measuring tool is on, or in capture mode.

## Options

`boxModelPlugin()` takes no options.
