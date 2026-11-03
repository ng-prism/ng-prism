# ng-prism

A lightweight, Angular-native component showcase tool. Annotate your components directly with a `@Showcase` decorator. There are no separate story files and no parallel file tree to maintain.

<video controls preload="metadata" playsinline poster="assets/video/tour-poster.jpg" width="100%" aria-label="A one-minute tour of ng-prism">
  <source src="assets/video/tour.mp4" type="video/mp4" />
</video>

<sub>Voice: [elevenlabs.io](https://elevenlabs.io)</sub>

> **[See it in action: Live Demo](/ng-prism/demo/?component=ButtonComponent ':ignore :target=_blank')**: a component
> library with all six official plugins enabled, plus free-form component pages.

## Project Status

- **Status:** Stable and actively maintained. Published on npm since April 2026; the current release line is v22.x.
- **Version:** [![npm version](https://img.shields.io/npm/v/@ng-prism/core?label=%40ng-prism%2Fcore&color=2563eb)](https://www.npmjs.com/package/@ng-prism/core) · [Releases & changelog](https://github.com/ng-prism/ng-prism/releases)
- **Requires:** Angular 22 · Node.js 22+
- **Versioning:** The major tracks the Angular major it targets: v22.x is the Angular 22 line. Breaking changes within the same Angular major ship as a minor release.
- **License:** [MIT](https://github.com/ng-prism/ng-prism/blob/main/LICENSE), © 2026 Alexander Spies
- **Maintainer:** Alexander Spies ([@alexander-spies](https://github.com/alexander-spies) on GitHub)
- **Source & support:** [Repository](https://github.com/ng-prism/ng-prism) · [Issue tracker](https://github.com/ng-prism/ng-prism/issues)

## Key Features

- **Zero story files:** the decorator lives on the component itself, see [@Showcase](guide/showcase-decorator.md)
- **Signal-native:** built for Angular's `input()` and `output()` signals
- **Builders for your workspace:** `@ng-prism/core:serve` and `@ng-prism/core:build` run in an Angular CLI or Nx workspace, see [Builders](api/builders.md)
- **No iframe:** components render in the same document, so dialogs, overlays and CDK portals work out of the box
- **Read at build time:** the TypeScript compiler extracts inputs, outputs and types, without runtime reflection, see [What the Scanner Reads](guide/scanner-reads.md)
- **Accessibility built in:** every variant gets a live axe-core audit, and a library-wide report can gate the build, see [Accessibility Panel](guide/accessibility.md) and [A11y Reports](guide/a11y-reports.md)
- **Plugins:** API pages from JSDoc, Figma designs, the box model, performance, test coverage and visual regression, or a plugin of your own, see [Overview](plugins/overview.md)
- **Compositions:** a component with the parts it works with, such as a form field with its input, as a compiled Angular template, see [Compositions](guide/compositions.md)
- **Parts:** a component that only works inside another, such as an option in a select, shows on its parent's page, see [Parts](guide/parts.md)
- **Services and pipes:** an `@Injectable`, `@Service` or standalone `@Pipe` with `@Showcase` gets an API page and a usage snippet, see [Services & Pipes](guide/services-and-pipes.md)
- **Component pages:** free-form Angular components as pages of the styleguide, see [Component Pages](guide/component-pages.md)
- **Links:** every component, variant, state and view has a URL to share, see [Links & State](guide/url-state.md)
- **On a phone:** a shared link opens properly on a phone, and a component can be checked on a real device, see [Tour of the UI](guide/styleguide-ui.md#on-a-phone)
- **Zoneless:** the styleguide runs with Angular's zoneless change detection, and `ng add @ng-prism/core --zoneless` leaves `zone.js` out of its bundle, see [Installation](guide/installation.md#zoneless-mode-optional-recommended)

## Quick Example

```typescript
import { Component, input } from '@angular/core';
import { Showcase } from '@ng-prism/core';

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
    template: `<button [class]="variant()">{{ label() }}</button>`
})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'danger'>('primary');
}
```

After `ng add @ng-prism/core`, run the styleguide:

```bash
ng run my-lib:prism
```

Before you publish your library, strip `@Showcase` from its build, see [Publishing Libraries](guide/library-publishing.md).

## Where to Go Next

One starting point for each part of these docs:

- **Getting Started:** [Installation](guide/installation.md) sets ng-prism up in your workspace and leads on to your first showcase.
- **Writing Showcases:** [@Showcase](guide/showcase-decorator.md) explains the decorator and lists every field.
- **The Styleguide:** [Tour of the UI](guide/styleguide-ui.md) names the parts of the styleguide.
- **Configuration:** [Configuration](guide/configuration.md) covers `ng-prism.config.ts`: plugins, pages, providers, branding and theme.
- **Testing & CI:** [External Tooling API](guide/external-tooling.md) is how a screenshot runner or an audit drives the styleguide.
- **Plugins:** [Overview](plugins/overview.md) lists the official plugins and how to add one.
- **Plugin Development:** [Writing a Plugin](plugins/writing-plugins.md) builds a plugin step by step.
- **Reference:** [ShowcaseConfig](api/showcase-config.md) is the reference of every `@Showcase` field.
- **Upgrading:** [Upgrade Notes 22.x](guide/upgrade-notes-22.md) lists what changed in each release.
- **Architecture:** [Build Pipeline](architecture/pipeline.md) shows how the builders work inside.
