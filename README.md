<p align="center">
  <img src="docs/prism_cover.png" alt="ng-prism: Angular components, refracted" width="100%" />
</p>

# ng-prism

A component showcase for modern Angular, without story files.
You add one decorator to your component. ng-prism picks it up at build time and generates live controls, code snippets and docs from it.

[![npm](https://img.shields.io/npm/v/@ng-prism/core)](https://www.npmjs.com/package/@ng-prism/core)
[![downloads](https://img.shields.io/npm/dm/@ng-prism/core)](https://www.npmjs.com/package/@ng-prism/core)
[![Angular](https://img.shields.io/badge/Angular-22-dd0031)](https://angular.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

[Live demo](https://ng-prism.github.io/ng-prism/demo/?component=ButtonComponent) · [Documentation](https://ng-prism.github.io/ng-prism/)

<p align="center"><a href="https://ng-prism.github.io/ng-prism/"><b>Watch the one-minute tour</b></a></p>

## Same button, two approaches

<table>
<tr><th>Storybook</th><th>ng-prism</th></tr>
<tr>
<td valign="top">

```ts
// button.stories.ts (separate file)
import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
    title: 'Atoms/Button',
    component: ButtonComponent,
    argTypes: {
        variant: {
            control: 'select',
            options: ['primary', 'secondary', 'danger']
        }
    }
};
export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
    args: { variant: 'primary', label: 'Click me' }
};
export const Danger: Story = {
    args: { variant: 'danger', disabled: true }
};
```

</td>
<td valign="top">

<!-- prettier-ignore -->
```ts
// button.component.ts (on the component itself)
@Showcase<ButtonComponent>({
    title: 'Button',
    category: 'Atoms',
    variants: [
        { name: 'Primary',
          inputs: { variant: 'primary', label: 'Click me' } },
        { name: 'Danger',
          inputs: { variant: 'danger', disabled: true } }
    ]
})
@Component({ /* ... */ })
export class ButtonComponent { /* ... */ }
```

The controls come from your `input()` types.
You don't need `argTypes` or an extra file, and the variants are type-checked.

</td>
</tr>
</table>

## Does `@Showcase` end up in my production bundle?

Not after you strip it. The decorator does nothing at runtime, but the built library still calls it and imports `@ng-prism/core`; `ng add` registers a `strip-showcase` script that removes both after the build (`ng build my-lib && npm run strip-showcase`), so `@ng-prism/core` stays a `devDependency`.
The details, including Nx targets and the transformer API, are in [Publishing Libraries](https://ng-prism.github.io/ng-prism/#/guide/library-publishing).

## Why not Storybook?

Storybook is a great tool. ng-prism deliberately covers less. It only supports Angular and tries to work the way Angular does.

|                     | Storybook                                                             | ng-prism                                                                                                |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frameworks          | React, Vue, Angular and more                                          | Angular only                                                                                            |
| Where variants live | Separate `*.stories.ts`                                               | On the component                                                                                        |
| Controls            | Configured via `argTypes` / Compodoc                                  | Inferred from `input()` signals                                                                         |
| Services and pipes  | Hand-written MDX page per service or pipe, members table via Compodoc | `@Showcase` on the service or pipe: API page from its JSDoc, with usage snippet, setup and linked types |
| Visual regression   | Chromatic (paid SaaS) or community addons                             | Official plugin, works with your own screenshot runner, no SaaS                                         |
| Accessibility       | `@storybook/addon-a11y`                                               | Built in (axe-core)                                                                                     |
| Design handoff      | Design addons                                                         | Official Figma plugin, with an opt-in pixel diff against the design                                     |
| Interaction tests   | Yes (play functions)                                                  | No                                                                                                      |
| Addon ecosystem     | Huge                                                                  | Small (official plugins)                                                                                |

Storybook is the better choice if you need several frameworks, its addons or interaction tests right now.
ng-prism makes sense if you use modern, signal-based Angular and want your showcase to stay in sync with your components without maintaining story files.

## Features

ng-prism scans your library at build time with the TypeScript Compiler API, so there is nothing to register. It works with `input()` and `output()` signals. If you pass the component as a generic (`@Showcase<MyComponent>`), you get autocomplete and compile-time checks for the variant `inputs`.

In the UI you get generated controls with an editor for each input type, plus an Angular template snippet per variant that updates while you change the controls. Every variant gets an axe-core audit, and that's part of the core, not a plugin. The visual regression plugin shows a diff report for each variant next to the live component. Your own screenshot runner writes a plain JSON report for it, and the example in the docs uses Playwright. A variant can also force `:hover`, `:active` or `:focus-visible` on the elements you name, and `states` declare such conditions once for every variant: the Overview lines the variants up against them in a matrix, and a state that cannot apply to a variant, like a focus ring on a disabled button, is left out instead of faked. Your component's own CSS draws the state, so focus rings show up in the styleguide and get a baseline like everything else.

You can also showcase directives on a configurable host element and write your own demo pages for complex components. A variant can show a component with the parts it works with, such as a form field with its input: `template`, `host: { template }` and `imports` compile that markup as an Angular template, and the Overview, states and Controls stay as they are. A component that only works inside another, such as an option in a select, names its parent with `partOf` and shows on the parent's page instead of a page of its own. The URL always reflects the current component, variant, state and view, so you can share links to them. The UI is themed through CSS custom properties, and plugins add panels, header widgets and controls of their own.

There are [official plugins](https://ng-prism.github.io/ng-prism/#/plugins/overview) for JSDoc, Figma, performance, box model, coverage and visual regression.

## Quick Start

```bash
ng add @ng-prism/core      # creates the prism app, configures builders, generates ng-prism.config.ts
```

Add `@Showcase` to a component (see above), then run:

```bash
ng run my-lib:prism        # serves on http://localhost:4400
```

Your component shows up in the sidebar with live controls, code snippets and a tab per variant.

Using Claude Code? The [ng-prism plugin](https://ng-prism.github.io/ng-prism/#/guide/ai-agents) teaches it to write showcases, check them in the browser and set up ng-prism.

The [documentation](https://ng-prism.github.io/ng-prism/) goes on with [Your First Showcase](https://ng-prism.github.io/ng-prism/#/guide/first-showcase) and covers configuration, directives, component pages and the plugins.

## Requirements

Angular 22 · Node.js 22+

## Contributing

[CONTRIBUTING.md](./CONTRIBUTING.md) covers the development setup, how to work with the test workspace and what to keep in mind for pull requests. Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Security issues go through a separate [private reporting channel](./SECURITY.md).

## License

[MIT](./LICENSE)
