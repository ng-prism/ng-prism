# ShowcaseConfig

The object passed to `@Showcase`, exported from `@ng-prism/core` as `ShowcaseConfig<T>`. This page is the reference for every field: its type, its default, its rules and the build messages it can cause. The guides under _Writing Showcases_ show how to use them, and [Types](api/types.md#showcase-config-types) has the types the fields use.

```typescript
interface ShowcaseConfig<T = unknown> {
    title: string;
    description?: string;
    category?: string;
    categoryOrder?: number;
    componentOrder?: number;
    section?: string;
    sectionOrder?: number;
    tags?: string[];
    status?: ComponentStatus;
    meta?: ShowcaseMeta;
    variants?: Variant<T>[];
    states?: ShowcaseState[];
    bg?: CanvasBg;
    canvasLayout?: CanvasLayout;
    renderPage?: string;
    host?: string | DirectiveHost | HostTemplate;
    imports?: ShowcaseImport[];
    partOf?: string;
    setup?: () => readonly ShowcaseSetupRef[];
    /** @deprecated */
    providers?: Provider[];
}
```

`T` is the class the decorator sits on. `@Showcase<ButtonComponent>({ ... })` types the `inputs` of every variant as `Partial<InputsOf<ButtonComponent>>`, which gives autocomplete on the input names and checks the values. Without it, `T` is `unknown` and `inputs` takes any `Record<string, unknown>`. See [`InputsOf`](api/types.md#inputsof) and [Inputs & Controls](guide/inputs-and-controls.md#type-safe-inputs).

The builder reads the argument from the source and never runs it. A value it cannot evaluate is dropped with a warning, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns such warnings into a build error. A class whose whole argument cannot be read, or whose argument has no `title`, is left out of the styleguide. See [What the Scanner Reads](guide/scanner-reads.md) and [Build Warnings](api/build-warnings.md#showcase-values).

Which fields apply depends on the class:

| Class                                                 | Fields that apply                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component or directive                                | Every field except `setup`. `providers` is deprecated and has no effect                                                                                                               |
| Part, a component or directive with `partOf`          | `title`, `description`, `tags`, `status`, `meta` and `partOf`, and on a directive a string or object `host`. The others are dropped with a notice, see [`partOf`](#partof)            |
| Service (`@Injectable`, `@Service`) or pipe (`@Pipe`) | `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `status`, `meta` and `setup`, see [Services and pipes](#services-and-pipes) |

## Identity and sidebar

What the class is called, how it is described and where it sits in the sidebar. [@Showcase](guide/showcase-decorator.md) explains how these fields order the sidebar together.

### `title`

**Type** `string` · **Required**

The display name: the sidebar entry, the heading of the page and the name in `__PRISM_MANIFEST__`. The sidebar search matches it.

A `@Showcase` without `title` leaves the class out of the styleguide, with a warning that counts for `strictShowcase`, see [Build Warnings](api/build-warnings.md#showcase-values).

```typescript
@Showcase({ title: 'Alert Banner' })
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `description`

**Type** `string` · **Default** none

Text in the details popover behind the ⓘ glyph next to the title, shown as plain text. A part shows its description in its card on the parent's page.

On a variant, `description` is data for plugins; the styleguide does not show it.

```typescript
@Showcase({
    title: 'Alert Banner',
    description: 'Displays status messages in four severities: info, warning, success and error.'
})
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `category`

**Type** `string` · **Default** none: the class lists under _Uncategorized_

Groups the class in the sidebar, inside its [`section`](#section). It also appears as the breadcrumb above the title. The sidebar search matches it.

```typescript
@Showcase({ title: 'Button', category: 'Atoms' })
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `categoryOrder`

**Type** `number` · **Default** none

The position of this _category_ within its section, lower first. When several classes share a category, the lowest `categoryOrder` among them counts. Categories without one sort alphabetically after the ordered ones.

```typescript
@Showcase({ title: 'Button', category: 'Atoms', categoryOrder: 1 })
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `componentOrder`

**Type** `number` · **Default** none

The position of _this class_ within its category, lower first. Classes without one sort by `title` after the ordered ones.

```typescript
@Showcase({ title: 'Icon Button', category: 'Atoms', componentOrder: 2 })
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `section`

**Type** `string` · **Default** `'Components'` for a component, `'Directives'` for a directive, `'Services'` for a service, `'Pipes'` for a pipe · **Since** 22.1.0

The top-level group of the sidebar. Any other string creates a section of its own, such as `'Forms'` or `'Behavior'`. Inside a section, [`category`](#category) groups the entries.

```typescript
@Showcase({ title: 'Autofocus', section: 'Behavior' })
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective {}
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `sectionOrder`

**Type** `number` · **Default** `Components` 0, `Directives` 10, `Services` 20, `Pipes` 30, any other section 100 · **Since** 22.1.0

The position of this _section_ in the sidebar, lower first. A section's order is the lowest `sectionOrder` among its entries, so one `@Showcase({ section: 'Behavior', sectionOrder: -1 })` moves the whole section above `Components`, and `5` puts it between `Components` and `Directives`. Sections with the same order list the four built-in ones first, in the order above, and the others alphabetically.

```typescript
@Showcase({ title: 'Autofocus', section: 'Behavior', sectionOrder: -1 })
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `tags`

**Type** `string[]` · **Default** none

Search terms for the sidebar. The search matches them next to `title`, `category` and the class name, and the selector of a component or the name of a pipe. The tags are also listed in the details popover behind the ⓘ glyph.

```typescript
@Showcase({ title: 'Button', tags: ['form', 'cta', 'interactive'] })
```

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `status`

**Type** [`ComponentStatus`](api/types.md#componentstatus): `'stable' | 'beta' | 'wip' | 'deprecated'` · **Default** none

The maturity or migration state. Without it, the class counts as stable and shows no indicator anywhere. Set it when the state should draw attention.

| Value          | Meaning                                  | Sidebar entry                                                 | Page head                                              |
| -------------- | ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| _unset_        |                                          | unchanged                                                     | no badge                                               |
| `'stable'`     | Migrated and production-ready            | unchanged                                                     | "Stable" badge in `--prism-success`                    |
| `'beta'`       | Functional, but the API may still change | unchanged                                                     | "Beta" badge in `--prism-warn`                         |
| `'wip'`        | Work in progress, migration ongoing      | dashed circle as the leading icon, tooltip "Work in progress" | "Work in progress" badge in `--prism-warn`, hollow dot |
| `'deprecated'` | Legacy. Do not use in new code           | name struck through and dimmed, tooltip "Deprecated / Legacy" | "Deprecated" badge in `--prism-danger`                 |

The badge is a soft-tinted [`prism-badge`](api/plugin-ui.md#ui-primitives) with a dot, inline after the title. Its tooltip says what the status means, and its colours follow the light and dark theme. The selector of the class is in the details popover behind the ⓘ glyph. A part shows its badge in its card on the parent's page.

A value other than the four is dropped with a warning that counts for `strictShowcase`.

```typescript
@Showcase({ title: 'Dialog', status: 'deprecated' })
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [@Showcase](guide/showcase-decorator.md)

### `meta`

**Type** [`ShowcaseMeta`](api/types.md#showcasemeta) · **Default** none

Open key-value data for plugins and projects. Each plugin reads its own key and documents it, such as `figma` for the [Figma](plugins/figma.md) plugin. Build-time plugin hooks write into the same object, and the values reach `__PRISM_MANIFEST__` as far as they are plain data, see [External Tooling API](guide/external-tooling.md#reading-showcase-metadata).

`a11y` is typed (since 22.7.0), the other keys stay open:

- `rules` switches axe rules on or off for the live audit, as `{ enabled: boolean }` per rule id.
- `disable: true` skips the live audit for the component.
- `accept` lists [accepted violations](guide/accessibility.md#accepted-violations), each with `rule` and `reason`: audited and shown, but not counted.

An `a11y` entry in another shape does not compile. Once the [a11y report](guide/a11y-reports.md#what-the-build-adds) lists the component, the build adds its entry (`found`, `score`, `summary`) to `meta.a11y`, next to these keys.

On a variant, `meta` is a `ShowcaseMeta` as well: plugins such as Figma read their key per variant, and `a11y.accept` adds accepted violations for that variant to the component's.

```typescript
@Showcase({
    title: 'Button',
    meta: {
        figma: 'https://www.figma.com/design/abc/Design?node-id=1-1',
        a11y: {
            rules: { 'color-contrast': { enabled: false } },
            accept: [{ rule: 'button-name', reason: 'The icon-only variants are labelled by their tooltip.' }]
        }
    }
})
```

**Guide:** [Accessibility Panel](guide/accessibility.md#accepted-violations), and the page of each plugin

## Variants and states

What the canvas shows: the variants and the pseudo states they can be shown in.

### `variants`

**Type** [`Variant<T>[]`](api/types.md#variant) · **Default** none: the class renders once, as an implicit `Default` variant with every input at its default

Each entry is a tab in the variant ribbon above the canvas and a row or cell of the Overview. A variant is addressed by its position in the array: `?variant=<index>`, the render marker and `__PRISM_MANIFEST__` use that index. The fields of a variant are under [Variant fields](#variant-fields).

Variant values are read from the source like every other value, see [What the Scanner Reads](guide/scanner-reads.md). On a part, `variants` is dropped with a notice. On an `@Injectable`, `@Service` or `@Pipe` class it keeps the class a component, see [Services and pipes](#services-and-pipes).

```typescript
@Showcase({
    title: 'Badge',
    variants: [
        { name: 'Info', inputs: { type: 'info' } },
        { name: 'Success', inputs: { type: 'success' } }
    ]
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Variants](guide/variants.md)

### `states`

**Type** [`ShowcaseState[]`](api/types.md#showcasestate) · **Default** none · **Since** 22.6.0

Named combinations of forced pseudo states, each combined with every variant it fits. An entry has a `name`, unique within the class, and a `pseudo` in the shape of [`pseudo`](#pseudo). The Overview shows the variants against the states as a matrix, the **State** group in the tools menu has a chip per state, and a screenshot runner addresses a combination with `?state=<index>`.

- **The position is the address.** A state's index in the array is its value in the `state` URL parameter, the render marker, `__PRISM_MANIFEST__` and a visual regression report. Keep the order stable and add new states at the end.
- **Broken entries keep their place.** An entry that is not an object, repeats the name of an earlier one, or has a `pseudo` that is missing or has nothing usable left becomes an empty state that forces nothing, so the states behind it keep their index. An entry without `name` works as `State <position>`. A pseudo-class or target inside `pseudo` that cannot be used is dropped, and the rest of the entry stays. Each of these is a warning that counts for `strictShowcase`. A `states` that is not an array is dropped whole.
- **A state is forced only where it fits:** where every pseudo-class it names has a target the browser could put into that state. Otherwise the combination is reported as not fitting, with a reason, and nothing is forced. See [When a state does not fit](guide/states.md#when-a-state-does-not-fit).
- **Not with `renderPage`.** A component page has no Overview, so the scan drops `states` next to [`renderPage`](#renderpage) with a warning.
- **Not on a part**, where it is dropped with a notice, and not on a service or a pipe, see [Services and pipes](#services-and-pipes).

On a variant, `states: false` keeps that variant out of every combination with the states: it renders in its own [`pseudo`](#pseudo) states only, as a single cell across the Overview's columns. A state requested for it anyway, with `?state=` or from the tools menu, stays selected but is not applied, and the combination reads `states: false`. `false` is the only valid value; any other is dropped with a warning.

```typescript
@Showcase<ButtonComponent>({
    title: 'Button',
    states: [
        { name: 'Hover', pseudo: { hover: '.btn' } },
        { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } },
        { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } }
    ],
    variants: [
        { name: 'Filled', inputs: { variant: 'filled' } },
        { name: 'Full width', inputs: { fullWidth: true }, canvasLayout: 'stretch', states: false }
    ]
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [States & Pseudo States](guide/states.md)

## Rendering

How the canvas renders the class: its background, its layout, or a page in its place.

### `bg`

**Type** [`CanvasBg`](api/types.md#canvasbg): `'dots' | 'plain' | 'light' | 'dark' | 'transparent'` · **Default** none

The recommended canvas background. A variant's own `bg` wins over the component's. What each value paints is in [`CanvasBg`](api/types.md#canvasbg).

Where it applies:

- **Playground:** opening a variant applies the background it declares. The user can pick another one from the **Background** group of the tools menu. That override is transient and resets on the next variant or component, and while it differs from the recommendation, a `Recommended: <bg>` pill with a `Reset` button sits in the canvas. When neither the variant nor the component declares one, the canvas keeps its own background: `dots` at first, then whatever the user last picked, remembered across visits. Until the user picks one, a simulated `Light` or `Dark` color scheme takes it to `light` or `dark`, see [Simulate: The ground](guide/styleguide-ui.md#the-ground). A project can replace `dots` as the first value with [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults); it is no recommendation, so the pill and the chip stay as they are.
- **Overview, capture mode and `__PRISM_MANIFEST__`:** the declared background, and `transparent` where nothing declares one (`DEFAULT_VARIANT_BG`), or the config's [`showcaseDefaults.bg`](api/ng-prism-config.md#showcasedefaults) if it sets one. The Overview draws `transparent` as a checkerboard, and where nothing is declared it paints `light` or `dark` instead while a color scheme is simulated. Capture mode ignores the user's override and paints the declared background, and `transparent` gives a screenshot with a real alpha channel, for which a runner has to pass `omitBackground: true`. See [Capturing transparency](guide/visual-regression.md#capturing-transparency).

`light` and `dark` are absolute colours (`--prism-void-light`, `--prism-void-dark`), while `dots` and `plain` follow the active theme. `transparent` is a checkerboard drawn from `--prism-void-light` while browsing, the same in both themes, and nothing at all in a capture. A baseline under visual regression is only as stable as its background, so declare `light` or `dark` for a component designed against a surface, and `transparent` when its own transparency is under test.

The three absolute grounds also set the text colour a component inherits, in both themes and in a capture: `--prism-void-light-text` on `light` and `transparent`, `--prism-void-dark-text` on `dark`. `dots` and `plain` leave the theme's text. A component that colours its own text is not affected; one that inherits it, an icon in `currentColor` for instance, is dark on `light` and light on `dark` under either theme. See [Base Tokens](guide/theming.md#base-tokens-theme-independent).

A value outside the five is dropped with a warning that counts for `strictShowcase`. On a part, `bg` is dropped with a notice.

```typescript
@Showcase({
    title: 'Button',
    bg: 'light',
    variants: [{ name: 'Filled' }, { name: 'On dark', bg: 'dark' }]
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Tour of the UI](guide/styleguide-ui.md#background), [Visual Regression](guide/visual-regression.md#the-background-is-part-of-the-baseline)

### `canvasLayout`

**Type** [`CanvasLayout`](api/types.md#canvaslayout): `'fit' | 'stretch'` · **Default** `'fit'`

How `.demo-wrap`, the wrapper around the rendered subject in the canvas stage, sizes itself:

| Value       | Wrapper                                         | Use it for                                                                                                                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'fit'`     | `display: inline-block`, shrinks to the subject | Most components (buttons, badges, cards, alerts): they render at their own size, and the stage centres them                                                        |
| `'stretch'` | `display: block; width: 100%; max-width: 800px` | A component without an intrinsic width (a horizontal divider drawn with `border-bottom`), or one that fills its container (a full-width button with `width: 100%`) |

With Viewport width on, the wrapper takes the width set there instead of the canvas width: a `'fit'` subject is centred in it, a `'stretch'` subject fills it, also when it renders in a [`template`](#template) or a host template. In the Overview, a `'stretch'` variant takes a full row.

A variant's own `canvasLayout` wins over the component's. A value other than the two is dropped with a warning that counts for `strictShowcase`. On a part, `canvasLayout` is dropped with a notice.

```typescript
@Showcase({
    title: 'Divider',
    canvasLayout: 'stretch',
    variants: [
        { name: 'Horizontal', inputs: { orientation: 'horizontal' } },
        { name: 'Vertical', inputs: { orientation: 'vertical' }, canvasLayout: 'fit' }
    ]
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Tour of the UI](guide/styleguide-ui.md#viewport-width)

### `renderPage`

**Type** `string` · **Default** none

The title of a component page, a [`ComponentPage`](api/types.md#componentpage) registered with `providePrism(manifest, config, { componentPages })`. The canvas renders that page component instead of the component (or its generated composition or host wrapper). The page can inject `PrismRendererService` to follow the active variant and the Controls panel. A title that matches no registered page renders the component itself.

A component with `renderPage` has no Overview and no entries in the Events panel, and it cannot declare [`states`](#states): the scan drops them with a warning. On a part, `renderPage` is dropped with a notice. On an `@Injectable`, `@Service` or `@Pipe` class it keeps the class a component, see [Services and pipes](#services-and-pipes).

A page is for a demo that needs providers of its own, state of its own or more than one subject. A subject that only needs other library classes around it or in it keeps the Overview, `states` and the Events panel with a variant [`template`](#template) or a host template, see [Component Pages](guide/component-pages.md).

```typescript
@Showcase({
    title: 'Data Table',
    renderPage: 'Data Table Demo' // the title of the ComponentPage
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Component Pages](guide/component-pages.md)

## Composition

What the subject renders on or inside. A variant's own markup is its [`template`](#template), under Variant fields.

### `host`

**Type** `string | DirectiveHost | HostTemplate` · **Default** none: a directive renders on the element its selector names, a component on its own element

Three forms:

- **String**, directives only: the HTML element the directive is put on, such as `'<button class="btn">Hover me</button>'`.
- **Object**, [`DirectiveHost`](api/types.md#directivehost), directives only: an Angular component as the element the directive is put on, with `selector`, `import: { name, from }` and static `inputs`.
- **Template**, [`HostTemplate`](api/types.md#hosttemplate), components and directives (since 22.7.0): an Angular template the subject renders in. The element that the subject's selector matches is the subject, and `prism-subject` marks it where several match.

Rules:

- A string or object `host` on a component has no effect: the build drops it with a notice, which does not count for `strictShowcase`. Use a host template to render a component inside other markup.
- A `{ template }` whose `template` is not a string is dropped with a warning. So is an object host whose `import` is not a `{ name, from }` pair of non-empty strings, and the directive then renders on a `<div>`.
- A variant's own `host` takes the template form only and overrides this field for that variant (since 22.7.0).
- On a part, a host template is dropped with a notice. A directive part keeps a string or object `host`: it names the element the directive sits on, which a usage line such as the one of the [JSDoc](plugins/jsdoc.md) plugin is written on.
- On an `@Injectable`, `@Service` or `@Pipe` class, `host` keeps the class a component, see [Services and pipes](#services-and-pipes).

```typescript
@Showcase<InputDirective>({
    title: 'Input',
    host: { template: '<lib-form-field label="Name"><input libInput /></lib-form-field>' }
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#compositions-and-hosts)

**Guide:** [Directive Hosting](guide/directive-hosting.md) for the string and the object form, [Compositions](guide/compositions.md#host-template) for the template form

### `imports`

**Type** [`ShowcaseImport[]`](api/types.md#showcaseimport), `{ name: string; from: string }[]` · **Default** none · **Since** 22.7.0

What the templates of the showcase ([`template`](#template) and a host template) use and ng-prism does not find in the library by itself: a class from another package such as `CdkTextareaAutosize`, or one of Angular's pipes and directives such as `DatePipe`. `name` is the exported name and `from` the module specifier, as in an `import`.

- **Strings, not class references,** so that [`ng-prism-strip`](guide/library-publishing.md) leaves no import behind in the published library.
- **Library classes need no entry.** A component, directive or pipe that the library's entry points export is imported when a template names it. The exceptions get a notice: a library class that is not standalone needs its NgModule listed here, and a library directive that a template matches only by standard attributes is applied only when listed here.
- **Unreadable entries are imported as written.** ng-prism reads each entry from its module to know its selector or name. An entry it cannot read is imported as written, with a notice, and Angular checks the template.
- **Malformed entries are dropped.** An entry that is not a `{ name, from }` pair of non-empty strings, or whose `name` is not a name a class can be exported under, is dropped with a warning; an `imports` that is not an array is dropped whole.
- **Components and directives only.** On a part, `imports` is dropped with a notice. On an `@Injectable`, `@Service` or `@Pipe` class it keeps the class a component, see [Services and pipes](#services-and-pipes).

```typescript
@Showcase<FormFieldComponent>({
    title: 'Form Field',
    imports: [{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }],
    variants: [{ name: 'Note', template: '<textarea libInput cdkTextareaAutosize></textarea>' }]
})
```

**Warnings:** [Build Warnings](api/build-warnings.md#compositions-and-hosts)

**Guide:** [Compositions](guide/compositions.md#imports)

## Parts

A class that only exists inside another one, such as an option inside a select, is a part of it.

### `partOf`

**Type** `string` · **Default** none · **Since** 22.7.0

The selector of the showcased component or directive this one is a part of, such as `'lib-select'` on `lib-option`. A part has no page and no sidebar entry of its own: its title, description, status, inputs and outputs appear on the page of its parent. The sidebar search finds the parent by the title, class name, selector or tags of its parts.

- **The value is one entry of the parent's `selector`**, compared without the spaces around it: `'lib-select'` and `'[libSelect]'` both find `selector: 'lib-select, [libSelect]'`. The parent can be a component or a directive, exported from any entry point.
- **A selector, not a class.** Why is under [Declaring a part](guide/parts.md#declaring-a-part).
- **One parent, no chains.** The selector has to belong to exactly one other class with `@Showcase`. A part cannot have parts, and a class cannot be its own part.
- **What a part uses:** `title`, `description`, `tags`, `status`, the inputs and outputs of its class, and `meta`, which stays for plugins. A plugin that reads the API of components (`componentApi`) reads the part's as well.
- **What has no effect on a part:** `variants`, `states`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `bg`, `canvasLayout`, a host template, `imports` and `renderPage`. The scan drops each with a notice, which does not count for `strictShowcase`. The scan reads the class before it knows that it is a part, so a malformed or unreadable value in one of these fields, and an error in the template of one of its variants, is reported as on any component and does count. `providers` and `setup` keep their own warnings. A directive part keeps a string or object [`host`](#host): it names the element the directive sits on, which the API tab of the [JSDoc](plugins/jsdoc.md#parts) plugin uses in the part's usage line, `<button libTrigger>` instead of `<div libTrigger>`.
- **A `partOf` that does not resolve** (not a non-empty string, no showcased class with that selector, several of them, a part, or the class itself) is a warning that counts for `strictShowcase`. `partOf` is dropped, and the class keeps a page of its own, variants included.
- **Components and directives only.** On a service or a pipe, `partOf` is dropped with a warning, reported only when a plugin shows services or pipes.

```typescript
@Showcase({
    title: 'Option',
    description: 'One choice of a select.',
    partOf: 'lib-select'
})
@Component({ selector: 'lib-option' /* ... */ })
export class OptionComponent {}
```

**Warnings:** [Build Warnings](api/build-warnings.md#parts)

**Guide:** [Parts](guide/parts.md)

## Services and pipes

`@Showcase` on a class with `@Injectable` or `@Service` makes it a service, and on a class with `@Pipe` a pipe (both since 22.7.0), unless the class also has `@Component` or `@Directive`. A class with `@Pipe` and `@Injectable` is a pipe. A service or a pipe gets a page with its API and no canvas, and it only appears when a plugin shows services or pipes, such as the [JSDoc](plugins/jsdoc.md) plugin.

These fields apply: `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `status`, `meta`, and [`setup`](#setup), which only services and pipes take. `partOf` is dropped with a warning. Only a standalone pipe is shown as a pipe: one declared in an NgModule (`standalone: false`) is dropped with a warning.

`variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports` and `renderPage` need a canvas. A service or pipe class that declares one of them is still shown as a component, with a notice that does not count for `strictShowcase` (deprecated since 22.7.0, removed in 23.0.0). Remove the fields, or move the demo to a [component page](guide/component-pages.md). [Upgrade Notes 22.x](guide/upgrade-notes-22.md#upgrading-to-2270) says what changes in 23.0.0.

### `setup`

**Type** `() => readonly ShowcaseSetupRef[]` · **Default** none · **Since** 22.7.0

The functions and `InjectionToken` constants that configure the service or pipe, as an arrow function that returns them. The styleguide documents each one next to the service or pipe (signature, description, `@example` and a table of its options), and the generated usage snippet calls them. An entry is a [`ShowcaseSetupRef`](api/types.md#showcasesetupref); ng-prism only reads its name, signature and type.

What the builder accepts:

- **An arrow function with an array literal as its body** (`() => [a, b]`), or with a block that only returns one. `as const`, a spread, a condition, a call and a constant that holds the list are not accepted: the whole `setup` is dropped with a warning.
- **Entries that are a function declaration, a `const` arrow or function expression, or a `const` of type `InjectionToken`.** Anything else is dropped with a warning, and the other entries stay.
- **Entries that a scanned entry point exports,** since the usage snippet needs the import path. One that is not exported is dropped with a warning.
- **`setup` written in the `@Showcase({ ... })` literal itself.** One that comes through a spread or a constant is not read, and nothing is reported.

`setup` is a function and not a list because `@Showcase(...)` is evaluated when the class is defined, in every library build without [`ng-prism-strip`](guide/library-publishing.md): a direct reference to a `const` of a module that is still loading, such as a `provide*` function in a file that imports the service back, fails with a `ReferenceError`. ng-prism never calls the function. The builder reads the array literal from the source, and `Showcase()` does nothing at runtime. TypeScript checks the references all the same, and renaming one in the IDE renames it here.

On a component or a directive, `setup` is dropped with a warning.

```typescript
@Showcase({
    title: 'Notification Service',
    setup: () => [provideNotifications]
})
@Injectable({ providedIn: 'root' })
export class NotificationService {}
```

**Warnings:** [Build Warnings](api/build-warnings.md#services-and-pipes)

**Guide:** [Services & Pipes](guide/services-and-pipes.md)

## Variant fields

A [`Variant`](api/types.md#variant) is one entry of [`variants`](#variants). Five fields are its own and follow below. Six more set a component-level field for this one variant:

| Field                           | On a variant                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`description`](#description)   | Data for plugins; the styleguide does not show it                                                       |
| [`meta`](#meta)                 | Plugin data for this variant; `a11y.accept` adds accepted violations for it                             |
| [`bg`](#bg)                     | The recommended background for this variant, wins over the component's                                  |
| [`canvasLayout`](#canvaslayout) | The layout for this variant, wins over the component's                                                  |
| [`host`](#host)                 | A host template only (`{ template }`), overrides the component's `host` for this variant (since 22.7.0) |
| [`states`](#states)             | `false` only: keeps the variant out of every combination with the component's states (since 22.6.0)     |

### `name`

**Type** `string` · **Required**

The label of the tab in the variant ribbon, the caption in the Overview and the `name` in `__PRISM_MANIFEST__`. Build warnings name a variant by it. A variant is addressed by its index, not by its name.

**Guide:** [Variants](guide/variants.md)

### `inputs`

**Type** `Partial<InputsOf<T>>`, or `Record<string, unknown>` without `T` · **Default** none

Values for the inputs of the class, keyed by the member name, also for an input with an `alias`; ng-prism binds each by its public name. With `@Showcase<T>`, the keys and the values are type-checked against the class's signal inputs, see [`InputsOf`](api/types.md#inputsof). Inputs from base classes count as inputs of the class.

- **Only the listed keys are set.** Every other input starts at its default, or `undefined` without one. Within the variant, the values the user changes in the Controls panel stay until another variant is selected or the panel's **Reset** button sets them back. `undefined` sets an input to `undefined` on purpose.
- **A key that is no input of the class** is ignored, with a warning in the browser console.
- **A value for an input that the variant's host template sets on the subject** is dropped with a warning: the template owns that input, and its control reads `Not editable`.
- A value that cannot be evaluated statically is dropped with a warning, and the rest of `inputs` stays.

```typescript
{ name: 'Large', inputs: { size: 'lg' } }
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Inputs & Controls](guide/inputs-and-controls.md), [Variants](guide/variants.md)

### `content`

**Type** `string | Record<string, string>` · **Default** none

HTML projected into the component's `<ng-content>`. A string goes into the default slot. A record maps slot selectors, such as `'[card-header]'`, to HTML, with `default` for the unnamed slot. It is HTML, not an Angular template, so components in it are not created; use [`template`](#template) for that.

On a directive, `content` is a string that becomes the text of the host element: markup in it shows as written, as text, and a record has no effect. Use `template` for markup inside the host element.

- Set together with `template`, `content` is dropped with a warning, and `template` wins.
- A key that matches no `<ng-content>` of the component is skipped, with a warning in the browser console.
- A component that renders in a host template takes no HTML content, which is a warning; use `template`. A directive keeps its text there.

```typescript
{ name: 'With icon', content: '<svg>...</svg> Save' }
```

**Warnings:** [Build Warnings](api/build-warnings.md#compositions-and-hosts)

**Guide:** [Content Projection](guide/content-projection.md)

### `template`

**Type** `string` · **Default** none · **Since** 22.7.0

An Angular template, compiled ahead of time as the content of the subject: a component gets it projected into its `<ng-content>` slots by Angular's own selector matching, a directive renders it inside its host element. The library's components, directives and pipes that it names are imported; anything else goes into [`imports`](#imports). The variant renders through a generated wrapper component, and the Controls panel keeps working on the subject's inputs, see [Compositions](guide/compositions.md#what-the-controls-panel-can-edit).

- A `template` that is not a string is dropped with a warning.
- Set together with `content`, `template` wins and `content` is dropped with a warning.
- A template that Angular's parser rejects is a warning with its location, and the variant renders without it. When `@angular/compiler` fails on the showcase as a whole, no variant of it renders a template or a host template.

```typescript
{ name: 'With icon', inputs: { label: 'Search' }, template: '<lib-icon libPrefix name="search" /><input libInput />' }
```

**Warnings:** [Build Warnings](api/build-warnings.md#compositions-and-hosts)

**Guide:** [Compositions](guide/compositions.md#template)

### `pseudo`

**Type** [`ForcedPseudoStates`](api/types.md#forcedpseudostates) · **Default** none · **Since** 22.5.0

Pseudo states forced on while this variant renders. The keys are `hover`, `active`, `focus`, `focus-visible` and `focus-within`. Each takes a target:

- `true`: every element of what is rendered, the host included.
- A selector, or a list of selectors: the matching elements among the host and everything inside it. For a variant with a `template` or a host template, that is the whole composition.

The component's own CSS draws the state: every rule that uses the pseudo-class is widened to also match a stand-in class on the targets. `pseudo` describes this one variant; to show every variant in the same states, declare them once as [`states`](#states). Unlike `states`, `pseudo` has no fit rule. It forces the state on the elements it names, a disabled one included.

An unknown state, a target that is neither `true` nor a selector, and an empty selector are dropped with a warning that counts for `strictShowcase`. Whether a selector parses is up to the browser, which warns once when the variant renders. What cannot be forced is listed in [States & Pseudo States](guide/states.md#pseudo-states).

```typescript
{ name: 'Focused', pseudo: { 'focus-visible': '.btn' } }
```

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [States & Pseudo States](guide/states.md#per-variant-pseudo-states)

## Deprecated

Deprecated values and uses are marked where they apply, such as the canvas fields on a service or a pipe under [Services and pipes](#services-and-pipes). [Upgrade Notes 22.x](guide/upgrade-notes-22.md#removed-in-2300) lists everything that is removed in 23.0.0.

### `providers`

**Type** `Provider[]` · **Deprecated** since 22.4.0, removed in 23.0.0

Never reaches the styleguide: a provider is a class, a factory or an instance, which the static manifest cannot hold. The build drops the field with one warning per component, which counts for `strictShowcase`, and the component renders without it. On an `@Injectable`, `@Service` or `@Pipe` class it still keeps the class a component until 23.0.0.

A component that injects something the styleguide app does not provide, such as a `Router` for `routerLink`, `HttpClient`, a translation service or a library config token, gets it from the app's root injector: [`appProviders`](api/ng-prism-config.md#appproviders) in the config, or the `providers` of the app's `main.ts` for `provideRouter()`, `provideHttpClient()` and providers from your library, see [Adding Global Providers](guide/configuration.md#adding-global-providers). For a provider that only one component may see, render the component through a [component page](guide/component-pages.md) with [`renderPage`](#renderpage) and declare the provider on the page component.

**Warnings:** [Build Warnings](api/build-warnings.md#showcase-values)

**Guide:** [Configuration](guide/configuration.md)
