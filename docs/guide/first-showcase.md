# Your First Showcase

This guide annotates an existing Angular component with `@Showcase` and opens it in the styleguide. It assumes ng-prism is set up in your workspace; if it is not, start with [Installation](guide/installation.md).

## Start with a Component

Assume you have this button component in your library:

```typescript
// projects/my-lib/src/lib/button/button.component.ts
import { Component, input } from '@angular/core';

@Component({
    selector: 'lib-button',
    template: `
        <button [class]="'btn btn--' + variant()" [disabled]="disabled()">
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

Import `Showcase` from `@ng-prism/core` and add the decorator above `@Component`:

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
    template: `...`
})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'secondary' | 'danger'>('primary');
    disabled = input(false);
}
```

`title` names the component in the sidebar, `category` groups it there, `description` goes into the details card behind ⓘ next to the title, and each entry of `variants` is one way to render it, with its own `inputs`. Every other field is listed under [All fields at a glance](guide/showcase-decorator.md#all-fields-at-a-glance).

## Make Sure It Is Exported

The scanner follows your library's public API from its entry file, the `lib.entryFile` of its `ng-package.json`. The component must be exported there:

```typescript
// projects/my-lib/src/public-api.ts
export * from './lib/button/button.component';
```

A component with `@Showcase` that the entry file does not export, directly or through another file, does not show up. How the builders find the entry files, secondary entry points included, is under [`entryPoint`](api/builders.md#entrypoint).

## Run the Showcase

```bash
ng run my-lib:prism
```

The scanner reads the entry file, finds `ButtonComponent` because it has `@Showcase`, reads its inputs and their types, and writes the manifest the styleguide renders. The styleguide opens at `http://localhost:4400`.

You will see:

- **Atoms** in the sidebar, with **Button** inside
- a tab for each variant above the canvas: Primary, Secondary, Danger
- a **Controls** tab in the panel below the canvas, with a text field for `label`, a button per value for `variant` and a toggle for `disabled`
- **`</>`** on the canvas rail, which opens the Angular template of the variant with its current input values

[Tour of the UI](guide/styleguide-ui.md) names every part of the screen, and shows how the styleguide works [on a phone](guide/styleguide-ui.md#on-a-phone). While `ng run my-lib:prism` runs, a change to the component or its `@Showcase` reaches the styleguide by itself, see [Watching and reloading](api/builders.md#watching-and-reloading).

## Next Steps

- [@Showcase](guide/showcase-decorator.md): what the decorator does, how to order the sidebar, and every field.
- [Variants](guide/variants.md) and [Inputs & Controls](guide/inputs-and-controls.md): more variants, type-safe inputs and how input types map to controls.
- [Content Projection](guide/content-projection.md) and [Compositions](guide/compositions.md): content inside the component, and the component together with others.
- [Configuration](guide/configuration.md): plugins, branding and the theme of the styleguide.
- [Overview](plugins/overview.md): the official plugins, such as the API page from your JSDoc.
