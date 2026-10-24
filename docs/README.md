# ng-prism

A lightweight, Angular-native component showcase tool. Annotate your components directly with a `@Showcase` decorator. There are no separate story files and no parallel file tree to maintain.

<video controls preload="metadata" playsinline poster="assets/video/tour-poster.png" width="100%" aria-label="A one-minute tour of ng-prism">
  <source src="assets/video/tour.mp4" type="video/mp4" />
</video>

> **[See it in action: Live Demo](/ng-prism/demo/?component=ButtonComponent ':ignore :target=_blank')**: a component
> library with all six official plugins enabled, plus free-form component pages.

## Project Status

- **Status:** Stable and actively maintained. Published on npm since April 2026; the current release line is v22.x.
- **Version:** [![npm version](https://img.shields.io/npm/v/@ng-prism/core?label=%40ng-prism%2Fcore&color=2563eb)](https://www.npmjs.com/package/@ng-prism/core) · [Releases & changelog](https://github.com/ng-prism/ng-prism/releases)
- **Requires:** Angular 20+ (tested against 20, 21 and 22) · Node.js 20+ · TypeScript 5.5+
- **Versioning:** The major tracks the Angular major it targets: v22.x is the Angular 22 line. Breaking changes within the same Angular major ship as a minor release.
- **License:** [MIT](https://github.com/ng-prism/ng-prism/blob/main/LICENSE), © 2026 Alexander Spies
- **Maintainer:** Alexander Spies ([@alexander-spies](https://github.com/alexander-spies) on GitHub)
- **Source & support:** [Repository](https://github.com/ng-prism/ng-prism) · [Issue tracker](https://github.com/ng-prism/ng-prism/issues)

## Key Features

- **Zero story files:** the decorator lives on the component itself
- **Signal-native:** built for Angular 20+ with `input()` / `output()` signals
- **Plugin architecture:** extend with JSDoc, A11y, Figma, Perf, Coverage panels and more
- **Custom Angular Builder:** `@ng-prism/core:serve` and `@ng-prism/core:build` integrate into your existing workspace
- **No iframe:** components render in the same document, so dialogs, overlays, and CDK portals work out of the box
- **TypeScript Compiler API:** inputs, outputs, and types are extracted at build time instead of through runtime reflection
- **Component Pages:** register free-form Angular components as styleguide pages alongside `@Showcase` components
- **Compositions:** show a component with the parts it works with, such as a form field with its input, as a compiled Angular template with `template`, `host: { template }` and `imports`, and keep the Overview, states and Controls (since `22.7.0`)
- **Services:** an `@Injectable` or `@Service` with `@Showcase` gets an API page and a usage snippet, read from the code and its JSDoc, drawn by the [JSDoc plugin](plugins/jsdoc.md) (since `22.7.0`)
- **Pipes:** a standalone `@Pipe` with `@Showcase` gets the same kind of page, with every `transform()` overload and a template line in its usage snippet (since `22.7.0`)
- **URL state:** deep-linking via `?component=`, `?service=`, `?pipe=`, `?variant=`, `?state=`, `?page=`, `?view=` params
- **Zoneless ready:** opt in via `ng add @ng-prism/core --zoneless` for ~30 KB bundle savings

## Quick Example

```typescript
import { Showcase } from '@ng-prism/core';
import { Component, input } from '@angular/core';

@Showcase({
    title: 'Button',
    category: 'Atoms',
    description: 'The primary action button.',
    variants: [
        { name: 'Primary', inputs: { label: 'Save', variant: 'primary' } },
        { name: 'Danger', inputs: { label: 'Delete', variant: 'danger' } }
    ]
})
@Component({
    selector: 'lib-button',
    standalone: true,
    template: `<button [class]="variant()">{{ label() }}</button>`
})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'danger'>('primary');
}
```

Run the showcase:

```bash
ng run my-lib:prism
```

## Getting Started

- [Installation & Setup](guide/installation.md): add ng-prism to an existing workspace in two minutes
- [Your First Showcase](guide/first-showcase.md): annotate a component step by step
- [Configuration](guide/configuration.md): the `ng-prism.config.ts` reference

## Official Plugins

All plugins ship with an `ng-add` schematic, so one command installs and registers the plugin:

```bash
ng add @ng-prism/plugin-jsdoc       # JSDoc API documentation panel
ng add @ng-prism/plugin-figma       # Figma embed + pixel-perfect design diff
ng add @ng-prism/plugin-box-model   # CSS box model overlay
ng add @ng-prism/plugin-coverage    # Per-component test coverage from Istanbul/v8
ng add @ng-prism/plugin-perf        # Render and re-render timing via Performance API
ng add @ng-prism/plugin-visual-regression  # Per-variant visual regression report
```

Re-running a command is safe, since already-registered plugins are skipped. See [Plugin Overview](plugins/overview.md) for full documentation.

## Going Further

- [Plugins](plugins/overview.md): extend the UI with official and custom plugins
- [Component Pages](guide/component-pages.md): free-form styleguide pages
- [Writing a Plugin](plugins/writing-plugins.md): build-time hooks and runtime panels
- [API Reference](api/showcase-config.md): complete type documentation
