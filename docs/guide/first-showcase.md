# Your First Showcase

This guide walks through annotating an existing Angular component with `@Showcase` and seeing it appear in the browser.

## Start with a Component

Assume you have this button component in your library:

```typescript
// packages/my-lib/src/lib/button/button.component.ts
import { Component, input } from '@angular/core';

@Component({
    selector: 'lib-button',
    standalone: true,
    template: `
        <button [class]="'btn btn--' + variant()">
            {{ label() }}
        </button>
    `
})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'secondary' | 'danger'>('primary');
    disabled = input(false);
}
```

## Add the Decorator

Import `Showcase` from `ng-prism` and add the decorator above `@Component`:

```typescript
import { Component, input } from '@angular/core';
import { Showcase } from '@ng-prism/core'; // ← add this

@Showcase({
    title: 'Button',
    category: 'Atoms',
    description: 'The primary action element. Use for form submissions and navigation triggers.',
    variants: [
        {
            name: 'Primary',
            inputs: { label: 'Save', variant: 'primary' }
        },
        {
            name: 'Secondary',
            inputs: { label: 'Cancel', variant: 'secondary' }
        },
        {
            name: 'Danger',
            inputs: { label: 'Delete', variant: 'danger' }
        }
    ]
})
@Component({
    selector: 'lib-button',
    standalone: true,
    template: `...`
})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'secondary' | 'danger'>('primary');
    disabled = input(false);
}
```

## What Each Field Does

| Field         | Effect                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Display name in the sidebar and component head                                                                                         |
| `category`    | Groups this component in the sidebar, and is the breadcrumb ahead of the title in the component head. Omit to land in "Uncategorized". |
| `description` | Shown in the component head's details popover, behind the ⓘ glyph next to the title.                                                   |
| `variants`    | Named tabs above the rendered component. Each tab sets different `inputs`.                                                             |

## Make Sure It Is Exported

The scanner follows your library's public API. The component must be exported from your `index.ts`:

```typescript
// packages/my-lib/src/index.ts
export { ButtonComponent } from './lib/button/button.component.js';
```

## Run the Showcase

```bash
ng run my-lib:prism
```

The scanner reads your `index.ts`, finds `ButtonComponent` (because it has `@Showcase`), extracts the inputs and their types, and generates a runtime manifest. The showcase opens in the browser.

You will see:

- "Atoms" category in the sidebar with "Button" inside
- Three variant tabs: Primary, Secondary, Danger
- A **Controls** panel listing `label`, `variant`, and `disabled` with appropriate input types
- A **`</> Code`** toggle that shows a live code snippet reflecting current input values

## On a Phone

Since 22.7.0 the styleguide has a phone layout, so a link to a component opens properly on a phone and a component can be checked on a real device. It applies up to 900 px of width, and on touch screens no taller than 500 px, which takes in large phones held sideways.

- **Navigation:** the sidebar is no longer a column. ☰ in the header opens it over the whole page; picking an entry, ✕ or Escape closes it again. A link always opens on the component, with the navigation closed.
- **Canvas and panel:** the canvas takes the full width and the panel sits below it at about half the height. Drag the grip between them, or tap the active panel tab to fold the panel down to its tabs and tap it again to open it. On a short screen, such as a phone held sideways, the panel starts folded.
- **Component head:** once the head runs out of room, in a narrow desktop window as well, Playground / Overview / API becomes a menu named after the active view, and the parts and the metrics move into the ⓘ card. A dot on ⓘ says that a metric warns or alarms.
- **Header:** the subtitle goes, a long title shortens before the plugin widgets scroll, and the theme switch and the build info move into the ⋮ menu.
- **Controls** stack under their labels. On touch screens buttons, tabs and rows grow to a size a finger can hit, and text fields use 16 px so iOS does not zoom the page when one gets focus.

The phone layout leaves out guides, rulers, the [measuring tool](guide/measuring.md) and the viewport width: they need a pointer that hovers and an Alt key, and on a phone the canvas already is the device's viewport, so the component's media queries meet the real screen. Whatever you switched on at the desktop is back when the window is wide again. The phone layout keeps its panel height to itself and never changes the layout you set at the desktop.

## Next Steps

- Learn about all `@Showcase` options in the [@Showcase Decorator](guide/showcase-decorator.md) reference
- Understand how input types map to controls in [Inputs & Controls](guide/inputs-and-controls.md)
- Add content projection with the `content` field (see [Content Projection](guide/content-projection.md))
