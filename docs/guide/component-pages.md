# Component Pages

A component page is an Angular component of your own that the styleguide renders as a page. It stands in the _Pages_ section of the sidebar, and a showcased component can render it in place of its canvas with [`renderPage`](api/showcase-config.md#renderpage). A custom page is a page without a component: data from the config, shown as JSON.

## Composition, renderPage or a component page?

Most demos need no page. Go down this list and take the first row that fits: each one further down gives up more of what the styleguide does for a showcase.

| What the demo needs                                                                                                                  | Use                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Input values that can be written as literals                                                                                         | The `inputs` of a variant, see [Variants](guide/variants.md)                                                            |
| Other components, directives or pipes of your library in or around the subject, with mock data written as literals in their bindings | A composition, a variant `template` or a `host: { template }`, see [Compositions](guide/compositions.md)                |
| A service, a router or a token that every component may see, such as a mock backend or translations                                  | [`appProviders`](api/ng-prism-config.md#appproviders) in `ng-prism.config.ts`                                           |
| Providers that only this demo may see, state that the demo owns, or more than one subject                                            | `renderPage` with a component page, see [Linking a Page to a Component](#linking-a-page-to-a-component-with-renderpage) |
| No single subject: a pattern overview, a colour palette, a token table, an icon catalog                                              | A component page of its own, see [Registering Pages](#registering-pages)                                                |

A composition is compiled ahead of time with your classes and keeps everything a showcase has: the Overview, `states`, the Controls and Events panels, the Perf render marks and the side by side comparison of the variants. A page replaces the canvas with a component of your own and gives up part of that, see [What a Page Gives Up](#what-a-page-gives-up).

`renderPage` is for components and directives. On a [part](guide/parts.md) it is dropped with a notice, and on a class with `@Injectable`, `@Service` or `@Pipe` it keeps the class a component, see [Services & Pipes](guide/services-and-pipes.md#which-fields-apply).

## Creating a Page Component

A component page is a standalone Angular component. Place it in the styleguide app (`projects/my-lib-prism/src/`), not in the library: it is a demo, not part of what you publish, and it reaches the styleguide through `main.ts`, because a class cannot go through the manifest that the build writes.

```typescript
// projects/my-lib-prism/src/pages/button-patterns.page.ts
import { Component } from '@angular/core';
import { ButtonComponent } from 'my-lib';

@Component({
    selector: 'app-button-patterns',
    imports: [ButtonComponent],
    template: `
        <h2>Button Patterns</h2>
        <section>
            <lib-button label="Primary Action" variant="primary" />
            <lib-button label="Secondary" variant="secondary" />
            <lib-button label="Danger" variant="danger" [disabled]="true" />
        </section>
    `
})
export class ButtonPatternsPageComponent {}
```

The styleguide shows the page's `title` as a heading above the component.

## Following the Theme

A page renders in the styleguide's own document, on the dark or light background the theme toggle in the header picks. A fixed colour only works on one of them: dark text written for a white page all but disappears in the dark theme. Take colours from the theme tokens instead. They sit on `<html>` and switch with the theme:

```css
.tokens-page {
    color: var(--prism-text);
}

.tokens-page__intro {
    color: var(--prism-text-2);
}

.tokens-page code {
    font-family: var(--prism-font-mono);
    color: var(--prism-text-muted);
}

.tokens-page h2 {
    border-bottom: 1px solid var(--prism-border-strong);
}
```

Text without a colour of its own inherits `--prism-text-2` and the styleguide's sans font. Headings, paragraphs, lists, code and links without styles of their own get the styleguide's defaults (links in `--prism-link`, underlined). Those defaults sit in a cascade layer, so any rule of your page or of a global stylesheet for the same element wins, whatever its specificity. [Theming](guide/theming.md) lists every token with its dark and light value. For anything a token cannot express, such as an image per theme, `data-theme` on `<html>` reads `dark` or `light`, see [Dark and Light Themes](guide/theming.md#dark-and-light-themes).

## Registering Pages

Register component pages with the third argument of `providePrism()` in the `main.ts` of the styleguide app:

```typescript
// projects/my-lib-prism/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { PrismShellComponent, providePrism } from '@ng-prism/core';
import { PRISM_RUNTIME_MANIFEST } from 'prism-manifest/my-lib-prism';
import config from 'ng-prism.config';
import { ButtonPatternsPageComponent } from './pages/button-patterns.page';

bootstrapApplication(PrismShellComponent, {
    providers: [
        providePrism(PRISM_RUNTIME_MANIFEST, config, {
            componentPages: [{ title: 'Button Patterns', category: 'Patterns', component: ButtonPatternsPageComponent }]
        })
    ]
});
```

Keep the rest of the `main.ts` that `ng add` wrote, such as the hot replacement of the manifest; only the third argument is new.

| Field       | Type            | Description                                                          |
| ----------- | --------------- | -------------------------------------------------------------------- |
| `title`     | `string`        | The name in the sidebar, and what a `renderPage` names               |
| `category`  | `string`        | The group in the _Pages_ section of the sidebar. Without one, `Docs` |
| `component` | `Type<unknown>` | The Angular component to render                                      |

The options also take `categoryOrder` and `order`, which the sidebar does not use. A component page in `defineConfig({ pages })` does not work, since the build writes the config's pages as JSON, where a class does not survive. See [`ComponentPage`](api/types.md#componentpage).

## Pages in the Sidebar

Pages have a section of their own, _Pages_, pinned at the top of the sidebar above the components. They never mix with components, also when a page and a component have the same `category`. Within the section, pages are grouped by `category`, `Docs` for a page without one, in the order of the manifest: the custom pages of the config first, then the component pages in the order of `componentPages`.

The sidebar search finds a page by its title and its category. A link to a page is `?page=` with its title, see [Links & State](guide/url-state.md). A page that a `renderPage` uses is listed there as well.

## Linking a Page to a Component with `renderPage`

`renderPage` on `@Showcase` names a registered component page by its `title`, and the canvas of the component renders that page instead of the component:

```typescript
@Showcase({
    title: 'Data Table',
    renderPage: 'Data Table Demo', // the title of the component page
    variants: [{ name: 'Empty' }, { name: '10 rows', inputs: { rowCount: 10 } }]
})
@Component({ selector: 'lib-data-table' /* ... */ })
export class DataTableComponent {}
```

The variant tabs and the Controls panel stay. Their values only reach the page when it reads them, see [Reacting to Controls Panel Changes](#reacting-to-controls-panel-changes). A title that matches no registered component page renders the component itself.

### What a Page Gives Up

The canvas renders the page instead of the component, so what depends on the component itself is not there:

| Feature                                   | On a `renderPage` component                                      |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Overview                                  | Hidden: every cell would show the same page                      |
| `states`                                  | Dropped by the scanner, with a warning                           |
| Controls                                  | Only what the page reads from `PrismRendererService.inputValues` |
| Events panel                              | Stays empty: the outputs of the component are not subscribed to  |
| Perf render marks                         | None: the Performance panel has no render timings for the page   |
| Angular template popover                  | Shows the selector of the showcased component, not the page      |
| a11y, Box Model, measuring, Figma and VRT | Work, on the root element of the page                            |

If the page only puts library components together, a [composition](guide/compositions.md) gives the same picture without giving any of this up.

## Reacting to Controls Panel Changes

A component page that a `renderPage` names can inject [`PrismRendererService`](api/services.md#prismrendererservice) to read the current input values and the active variant:

```typescript
import { Component, computed, inject } from '@angular/core';
import { PrismRendererService } from '@ng-prism/core';
import { DataTableComponent } from 'my-lib';

@Component({
    selector: 'app-data-table-demo',
    imports: [DataTableComponent],
    template: `<lib-data-table [rows]="rows()" [loading]="loading()" />`
})
export class DataTableDemoComponent {
    private readonly renderer = inject(PrismRendererService);

    readonly rows = computed(() => {
        const rowCount = (this.renderer.inputValues()['rowCount'] as number) ?? 0;
        return Array.from({ length: rowCount }, (_, i) => ({
            id: i,
            name: `Row ${i}`
        }));
    });

    readonly loading = computed(() => (this.renderer.inputValues()['loading'] as boolean) ?? false);
}
```

## Custom Pages via Config

A page of data needs no component. Declare it as a [`CustomPage`](api/types.md#custompage) in [`pages`](api/ng-prism-config.md#pages) of `ng-prism.config.ts`:

```typescript
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    pages: [
        {
            type: 'custom',
            title: 'Changelog',
            category: 'Meta',
            data: { version: '2.1.0', entries: [] }
        }
    ]
});
```

The styleguide shows its title and its `data` as formatted JSON. That is all it shows: a page has no view tabs and no panels, so no plugin draws it. A plugin can change the page before it is written into the manifest, in [`onPageScanned`](api/ng-prism-plugin.md#onpagescanned). For a page with a layout of its own, write a component page.

## Related

- [`renderPage`](api/showcase-config.md#renderpage) in the ShowcaseConfig reference, [`pages`](api/ng-prism-config.md#pages) in the NgPrismConfig reference
- [`ComponentPage`](api/types.md#componentpage), [`CustomPage`](api/types.md#custompage) and [`StyleguidePage`](api/types.md#styleguidepage) in Types
- [`PrismRendererService`](api/services.md#prismrendererservice) in Runtime Services
- [Compositions](guide/compositions.md): the subject together with other parts of your library, without a page
