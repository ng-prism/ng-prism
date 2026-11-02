# @Showcase

## What `@Showcase` is

`@Showcase` registers a class of your library with ng-prism. It sits on the class itself and takes a [`ShowcaseConfig`](api/showcase-config.md) object: the title, the variants and whatever else the styleguide should know. There are no story files.

```typescript
import { Showcase } from '@ng-prism/core';

@Showcase({
    title: 'Alert Banner',
    category: 'Feedback',
    variants: [
        { name: 'Info', inputs: { severity: 'info', message: 'Saved.' } },
        { name: 'Error', inputs: { severity: 'error', message: 'Something went wrong.' } }
    ]
})
@Component({
    selector: 'lib-alert-banner'
    /* ... */
})
export class AlertBannerComponent {
    /* ... */
}
```

The builder reads the decorator at build time, when it scans the library, and writes what it finds into the styleguide's manifest. It reads the argument from the source and never runs it, so every value has to be spelled out there, see [What the Scanner Reads](guide/scanner-reads.md). In your library's own build, `@Showcase` does nothing at runtime, and [`ng-prism-strip`](guide/library-publishing.md) removes it, with its import, from the published package.

## Decorator order

Write `@Showcase` above the Angular decorator, `@Component`, `@Directive`, `@Injectable`, `@Service` or `@Pipe`, as every example here does. The scanner finds it in any position, and `ng-prism-strip` removes it from any position, so the order is a convention that keeps the Angular decorator next to the class.

The name does matter. The scanner recognizes the decorator by its name, so import it from `@ng-prism/core` as `Showcase`. A class whose decorator is imported under another name (`import { Showcase as S }`) or called through a namespace (`@prism.Showcase(...)`) is not found.

## Which classes it goes on

- **Components and directives** get a page with a canvas, their variants, and the Controls and Events panels. A directive renders on the element its selector names, or on the one its [`host`](guide/directive-hosting.md) gives it.
- **Services and pipes,** classes with `@Injectable`, `@Service` or `@Pipe`, get a page with their API and no canvas. They appear once a plugin shows them, such as the [JSDoc](plugins/jsdoc.md) plugin, see [Services & Pipes](guide/services-and-pipes.md). [`setup`](api/showcase-config.md#setup) is their field alone.
- **A component or directive that only exists inside another one,** such as an option inside a select, becomes a [part](guide/parts.md) of it with `partOf`, and shows on the page of its parent.

The class has to be exported by an entry point of the library, since the scan starts at the entry files that [`entryPoint`](api/builders.md#entrypoint) leads to. A class with `@Showcase` that no entry point exports is not found. One that several entry points export appears once, see [A class exported by several entry points](api/build-warnings.md#a-class-exported-by-several-entry-points).

## Typed showcases

`@Showcase` is generic. Pass the class as its type argument, and the `inputs` of every variant are checked against the class's signal inputs, with autocomplete on their names:

```typescript
@Showcase<ButtonComponent>({
    title: 'Button',
    variants: [
        { name: 'Primary', inputs: { label: 'Save', variant: 'primary' } },
        { name: 'Danger', inputs: { label: 'Delete', variant: 'danger' } }
    ]
})
@Component({/* ... */})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'secondary' | 'danger'>('primary');
}
```

A config kept in a constant takes the same argument through its type: `const BUTTON_SHOWCASE: ShowcaseConfig<ButtonComponent> = { ... }`, then `@Showcase(BUTTON_SHOWCASE)`. Without the type argument, `inputs` takes any record. What the compiler checks, and why inputs declared with `@Input()` are not part of it, is under [Type-safe inputs](guide/inputs-and-controls.md#type-safe-inputs).

## Ordering the sidebar

The sidebar has three levels: sections, categories inside a section, and entries inside a category. A handful of fields decide where a class lands. Nothing has to be set: without them, components list under _Components_, directives under _Directives_, and everything sorts by name.

```typescript
// One decorator each, on four classes
@Showcase({ title: 'Text Field', section: 'Forms', sectionOrder: -1, category: 'Inputs', categoryOrder: 1, componentOrder: 1 })
@Showcase({ title: 'Select', section: 'Forms', category: 'Inputs', componentOrder: 2 })
@Showcase({ title: 'Form Field', section: 'Forms', category: 'Layout' })
@Showcase({ title: 'Button', category: 'Actions' })
```

```
Forms
  Inputs
    Text Field
    Select
  Layout
    Form Field
Components
  Actions
    Button
```

- **[`section`](api/showcase-config.md#section)** is the top level. A class goes to _Components_, _Directives_, _Services_ or _Pipes_ by what it is, and `section` names another one, such as _Forms_ above. A section's place comes from [`sectionOrder`](api/showcase-config.md#sectionorder), lower first: the lowest value among its entries counts, and a section without one sits where its default puts it, _Components_ at 0, _Directives_ at 10, _Services_ at 20, _Pipes_ at 30 and any other section at 100. So `sectionOrder: -1` on one entry moves _Forms_ above _Components_.
- **[`category`](api/showcase-config.md#category)** groups the entries inside a section, and an entry without one lists under _Uncategorized_. [`categoryOrder`](api/showcase-config.md#categoryorder) orders the categories, lower first, again by the lowest value among their entries. Categories without one follow in alphabetical order.
- **[`componentOrder`](api/showcase-config.md#componentorder)** orders the entries inside a category, lower first. Entries without one follow, sorted by [`title`](api/showcase-config.md#title).

Two more fields help a reader find their way:

- **[`tags`](api/showcase-config.md#tags)** are search terms. The sidebar search matches them next to the title, the category, the class name and the selector or pipe name.
- **[`status`](api/showcase-config.md#status)** marks the maturity of a class. `'wip'` gives its sidebar entry a dashed circle, `'deprecated'` strikes its name through and dims it, and every status shows as a badge after the title on its page. Leave it out for a component that is simply done, which keeps the sidebar quiet. While you move components from a legacy library into a new one, set `'wip'` on what is being migrated, `'deprecated'` on what should no longer be used, and `'stable'` or `'beta'` once a component is done.

A part has no sidebar entry of its own, and the search finds its parent instead, see [Parts](guide/parts.md#how-a-part-shows).

## All fields at a glance

Each field links to its reference, with its type, its default and its rules.

| Field                                                     | What it does                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`title`](api/showcase-config.md#title)                   | The name in the sidebar and on the page. Required                                                                   |
| [`description`](api/showcase-config.md#description)       | Text in the details popover behind the ⓘ next to the title                                                          |
| [`category`](api/showcase-config.md#category)             | The group inside a section of the sidebar                                                                           |
| [`categoryOrder`](api/showcase-config.md#categoryorder)   | The place of the category in its section                                                                            |
| [`componentOrder`](api/showcase-config.md#componentorder) | The place of the class in its category                                                                              |
| [`section`](api/showcase-config.md#section)               | The top-level group of the sidebar                                                                                  |
| [`sectionOrder`](api/showcase-config.md#sectionorder)     | The place of the section in the sidebar                                                                             |
| [`tags`](api/showcase-config.md#tags)                     | Search terms for the sidebar                                                                                        |
| [`status`](api/showcase-config.md#status)                 | A maturity badge: `stable`, `beta`, `wip` or `deprecated`                                                           |
| [`meta`](api/showcase-config.md#meta)                     | Data for plugins, such as a Figma link, and the accessibility settings                                              |
| [`variants`](api/showcase-config.md#variants)             | The variants, each a tab above the canvas, see [Variants](guide/variants.md)                                        |
| [`states`](api/showcase-config.md#states)                 | Pseudo states combined with every variant, see [States & Pseudo States](guide/states.md)                            |
| [`bg`](api/showcase-config.md#bg)                         | The recommended canvas background                                                                                   |
| [`canvasLayout`](api/showcase-config.md#canvaslayout)     | Whether the subject keeps its own size or takes the width of the canvas                                             |
| [`renderPage`](api/showcase-config.md#renderpage)         | A component page to render in place of the component, see [Component Pages](guide/component-pages.md)               |
| [`host`](api/showcase-config.md#host)                     | What a directive sits on, or the template a subject renders in, see [Directive Hosting](guide/directive-hosting.md) |
| [`imports`](api/showcase-config.md#imports)               | Classes from other packages that the templates use, see [Compositions](guide/compositions.md#imports)               |
| [`partOf`](api/showcase-config.md#partof)                 | The parent this class is a part of, see [Parts](guide/parts.md)                                                     |
| [`setup`](api/showcase-config.md#setup)                   | The functions and tokens that configure a service or a pipe                                                         |
| [`providers`](api/showcase-config.md#providers)           | Deprecated since 22.4.0, removed in 23.0.0, without effect                                                          |

A variant has fields of its own, such as `inputs`, `content`, `template` and `pseudo`, see [Variant fields](api/showcase-config.md#variant-fields).

## Related

- [Variants](guide/variants.md), [Inputs & Controls](guide/inputs-and-controls.md) and [States & Pseudo States](guide/states.md): what a showcase shows
- [What the Scanner Reads](guide/scanner-reads.md): which values work in `@Showcase`
- [ShowcaseConfig](api/showcase-config.md): every field in detail
- [Build Warnings](api/build-warnings.md#showcase-values): the messages about `@Showcase` values
