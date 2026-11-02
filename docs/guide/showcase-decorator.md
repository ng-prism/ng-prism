# @Showcase

`@Showcase` is placed directly on an Angular component (or directive) class to register it with ng-prism. The decorator accepts a `ShowcaseConfig` object.

```typescript
import { Showcase } from '@ng-prism/core';

@Showcase({
  title: 'My Component',
  // ...
})
@Component({ ... })
export class MyComponent { ... }
```

The decorator is evaluated at build time by the TypeScript Compiler API scanner, which reads the config from the source without running it (see [What the scanner can read](#what-the-scanner-can-read)). Its presence makes the builder include the component in the manifest.

> **Note:** `@Showcase` must always appear _above_ `@Component` or `@Directive`, as decorator application order in Angular matters.

`@Showcase` also goes on a class with `@Injectable` or `@Service`, and on one with `@Pipe`. That makes it a service or a pipe, which has no canvas: it gets a page with its API instead. See [Showcasing Services](guide/showcasing-services.md) and [Showcasing Pipes](guide/showcasing-pipes.md) for what applies to one, including the [`setup`](#setup) field that only they take.

## Type-safe variants (optional)

`@Showcase` is generic: `@Showcase<T>({...})` where `T` is the component class. Supplying it types each variant's `inputs` as `Partial<InputsOf<T>>`, giving you autocomplete on input names and value type-checking against the component's signal inputs.

```typescript
@Showcase<ButtonComponent>({
  title: 'Button',
  variants: [
    { name: 'Primary', inputs: { label: 'Save',  variant: 'primary' } },
    { name: 'Danger',  inputs: { label: 'Delete', variant: 'danger'  } },
  ],
})
@Component({ ... })
export class ButtonComponent {
  label   = input.required<string>();
  variant = input<'primary' | 'secondary' | 'danger'>('primary');
}
```

Without the generic argument, `inputs` falls back to `Record<string, unknown>`, so every existing call site keeps working unchanged. See [Variants: Type-safe inputs](guide/variants.md#type-safe-inputs) and [`InputsOf<T>`](api/types.md#inputsof) for full details.

## What the scanner can read

The builder never runs your code. It reads the `@Showcase` argument from the source, so every value in it has to be spelled out there:

| Works                                           | Example                                       |
| ----------------------------------------------- | --------------------------------------------- |
| Strings, numbers, booleans, `null`, `undefined` | `'Save'`, `42`, `-1`, `true`                  |
| Arithmetic and string concatenation             | `5 * 1024 * 1024`, `'Step ' + 2`              |
| Template literals, with placeholders            | `` `${2 * 3} files` ``                        |
| Type assertions                                 | `['pdf', 'png'] as const`, `'m' as Size`      |
| Array and object literals, nested               | `{ inputs: { tags: ['a', 'b'] } }`            |
| `const` constants, also imported                | `MAX_FILES`, `5 * MB`                         |
| Enum members                                    | `Size.Medium`                                 |
| Properties and indices of constants             | `TOKENS.size.m`, `SIZES[1]`                   |
| Spread and shorthand of constants               | `{ ...SHARED_META }`, `{ label }`             |
| Computed keys that resolve to a string          | `{ ['aria-label']: 'Close' }`, `{ [KEY]: 1 }` |

Each of these works as long as every part of it does: `5 * MB` works while `MB` is a `const` with a readable value.

A constant imported from a compiled package is read from that package's `.d.ts`, which keeps a value only when it was a plain literal. `export const MAX_FILES = 3` arrives as `MAX_FILES = 3`; `export const MB = 1024 * 1024` arrives as `MB: number` and cannot be read.

A constant is read as its initializer says. Changes made to it at runtime, such as `OPTIONS.push('pdf')` or `CONFIG.size = 'l'`, never happen for the scanner, so keep showcase values in constants that nothing mutates.

Anything else would need the code to run, so the scanner drops it:

| Does not work                    | Example                                     |
| -------------------------------- | ------------------------------------------- |
| `let` and `var` variables        | `let retries = 3`                           |
| Constants without a value        | `declare const MB: number`, see above       |
| Conditions and comparisons       | `dark ? 'dark' : 'light'`, `label ?? 'OK'`  |
| Function and method calls        | `megabytes(5)`, `items.map(toOption)`       |
| Functions, classes and instances | `(value) => value.length > 0`, `new Date()` |

Functions, classes and instances are a limit of the approach, not of the scanner: they only exist once code runs, so the static manifest has no way to hold them. The one function that works is [`setup: () => [...]`](guide/showcasing-services.md#setup) on a service or a pipe: the scanner reads the array literal it returns from the source and never evaluates or calls it.

### What happens to a value it cannot read

Only that value is lost. A property, an array element or a spread is dropped; the object or array around it keeps everything else. Each drop prints a warning naming the component, where the value sat in the config, the source text and its location:

```
⚠ ng-prism: FileInputComponent › variants[3] "Auto hint" › inputs.maxFileSize — "megabytes(5)" (projects/my-lib/src/file-input/file-input.component.ts:27:52) cannot be evaluated statically and was dropped.
```

When a reference is what failed, the warning names it and says why:

```
⚠ ng-prism: FileInputComponent › variants[4] "Retry" › inputs.retries — "retries" (projects/my-lib/src/file-input/file-input.component.ts:31:41) cannot be evaluated statically and was dropped: retries is declared with let; only const declarations can be read.
```

A value inside a constant is reported where the constant writes it, so the location points to the line to fix even when the constant lives in another file.

When the whole argument cannot be read, as in `@Showcase(buildShowcase('File input'))`, the component is skipped, and the warning says so. A config kept in a `const` and passed as `@Showcase(FILE_INPUT_SHOWCASE)` is fine.

To fix a warning, write the value out: `maxFileSize: 5 * 1024 * 1024` instead of `megabytes(5)`. To make the build fail instead of warning, for example in CI, set [`strictShowcase`](api/ng-prism-config.md#strictshowcase).

## All Fields

### `title` _(required)_

Display name shown in the sidebar and above the component canvas.

```typescript
@Showcase({ title: 'Alert Banner' })
```

### `description`

Text rendered in the component head's details popover, behind the ⓘ glyph next to the title. Good for documenting intent, usage notes, and accessibility hints.

```typescript
@Showcase({
  title: 'Alert Banner',
  description:
    'Communicates status messages. Not for persistent UI elements. ' +
    'Severity levels: info, warning, success, error.',
})
```

### `category`

Groups the component in the sidebar. Components without a category land in "Uncategorized".

```typescript
@Showcase({ title: 'Pill', category: 'Atoms' })
@Showcase({ title: 'Card', category: 'Molecules' })
```

For a top-level group above categories, use [`section`](#section).

### `categoryOrder`

Controls the order of this _category_ in the sidebar. Lower numbers appear first. Categories without this property sort alphabetically after ordered ones.

When multiple components share a category, the lowest `categoryOrder` value among them wins.

```typescript
@Showcase({ title: 'Button', category: 'Atoms', categoryOrder: 1 })
@Showcase({ title: 'Modal', category: 'Overlays', categoryOrder: 2 })
```

### `componentOrder`

Controls the order of _this component_ within its category. Same sorting rules as `categoryOrder`.

```typescript
@Showcase({ title: 'Icon Button', category: 'Atoms', componentOrder: 2 })
@Showcase({ title: 'Button',      category: 'Atoms', componentOrder: 1 })
```

### `section`

Top-level sidebar grouping. ng-prism auto-detects this from the decorator type: `@Directive` classes go to **Directives**, `@Component` classes go to **Components**, services go to **Services**, pipes go to **Pipes**. Set `section` to a different string to create your own top-level group:

```typescript
@Showcase({ title: 'AutofocusDirective', section: 'Behavior' })
@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective {}

@Showcase({ title: 'Date Field', section: 'Forms' })
@Component({ selector: 'lib-date-field', standalone: true, template: '…' })
export class DateFieldComponent {
    /* ... */
}
```

Inside each section, the existing `category` field still groups items into sub-categories.

### `sectionOrder`

Controls the order of this _section_ in the sidebar. Lower numbers appear first. Default order: `Components` (0), then `Directives` (10), then `Services` (20), then `Pipes` (30), then everything else (100, alphabetically). The section's effective order is the minimum `sectionOrder` of any item it contains, so a single `@Showcase({ section: 'Behavior', sectionOrder: 5 })` pulls the whole "Behavior" section above "Components".

```typescript
@Showcase({ title: 'AutofocusDirective', section: 'Behavior', sectionOrder: 5 })
```

### `variants`

Predefined tabs shown above the canvas. Each variant can set different `inputs`, `content` (HTML) or `template` (compiled, see [Content Projection](guide/content-projection.md#compiled-content-template)), a `host` template, a `description`, plugin `meta`, its own `bg` and `canvasLayout`, and forced `pseudo` states such as `:focus-visible`. A state that should apply to many variants is a component-level [`states`](#states) entry instead.

```typescript
@Showcase({
  title: 'Badge',
  variants: [
    { name: 'Info',    inputs: { label: 'New',    type: 'info' } },
    { name: 'Warning', inputs: { label: 'Review', type: 'warning' } },
    { name: 'Error',   inputs: { label: 'Error',  type: 'error' } },
  ],
})
```

See [Variants](guide/variants.md) for the full `Variant` interface.

### `states`

Named pseudo states, `hover`, `active`, `focus`, `focus-visible` and `focus-within`, that apply to every variant they fit. Each entry has a `name` and a `pseudo` in the shape of a variant's `pseudo`. The Overview becomes a matrix of variants against states, the **State** group in the tools menu gets a chip per state, and a screenshot runner can capture every combination.

```typescript
@Showcase<ButtonComponent>({
  title: 'Button',
  states: [
    { name: 'Hover', pseudo: { hover: '.btn' } },
    { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } },
    { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } },
  ],
  variants: [
    { name: 'Filled', inputs: { variant: 'filled' } },
    { name: 'Disabled', inputs: { variant: 'filled', disabled: true } },
    // Not combined with any state
    { name: 'Full width', inputs: { fullWidth: true }, canvasLayout: 'stretch', states: false },
  ],
})
```

A state is forced only where the browser could put the component in it, so `Focus visible` is not forced on the disabled button, and the combination is reported as not fitting, with the reason. A variant opts out of all states with `states: false`. The position in the list identifies a state in the URL, the render marker, `__PRISM_MANIFEST__` and a visual regression report, so keep the order stable.

Not combinable with [`renderPage`](#renderpage): a component page has no Overview, so the scanner reports `states` there and drops it. See [Variants: States](guide/variants.md#states) for the fit rule, the reasons and when to use `pseudo` on a variant instead.

### `tags`

Array of strings used for search and filtering in the sidebar. Tags are matched alongside `title`, `category`, the class name and the selector.

```typescript
@Showcase({
  title: 'Button',
  tags: ['interactive', 'form', 'cta'],
})
```

### `providers`

> **Deprecated since 22.4.0, removed in 23.0.0.** `providers` never reached the styleguide: a provider is a class, a factory or an instance, which the [scanner cannot read](#what-the-scanner-can-read). The build drops the field with one warning per component, and the component renders without it.

Components that inject something the Prism app does not provide (a `Router` for `routerLink`, `HttpClient`, a translation service, a library config token) get it from `defineConfig({ appProviders })`, which feeds the app's root injector. In the rare case that one component needs a provider the others must not see, render it through a [component page](guide/component-pages.md) via [`renderPage`](#renderpage) and declare the provider on the page component.

### `setup`

Services and pipes only: the functions and `InjectionToken` constants that configure the service or pipe, as an arrow function that returns them. The styleguide documents each one next to the service or pipe, and the generated usage snippet calls them.

```typescript
@Showcase({
    title: 'Notification Service',
    setup: () => [provideNotifications]
})
@Injectable({ providedIn: 'root' })
export class NotificationService {
    /* ... */
}
```

It is an arrow function so that a reference to a function from a file that imports the service or pipe back is not read while the class is still being defined. The builder reads the array literal from the source and never runs the function. See [`ShowcaseConfig.setup`](api/showcase-config.md#setup) for what it accepts and [Showcasing Services](guide/showcasing-services.md#setup) for the warnings; on a pipe it works the same way, see [Showcasing Pipes](guide/showcasing-pipes.md).

### `meta`

Arbitrary key-value metadata consumed by plugins. Each official plugin documents its own key.

```typescript
@Showcase({
  title: 'Button',
  meta: {
    figma: 'https://www.figma.com/design/abc123/My-Design?node-id=1-1',
    a11y: { rules: { 'color-contrast': { enabled: true } } },
  },
})
```

### `bg`

Recommended canvas background for this component. Applied automatically when the user opens the component (or one of its variants), unless a variant defines its own `bg`. The user can still pick a different background from the **Canvas** group in the tools menu (opened from the sliders button on the floating canvas rail); the override is transient and resets when switching variants or components. When the user has deviated, a `Recommended: <bg>` pill appears in the canvas with a one-click `Reset` button.

Accepted values: `'dots'`, `'plain'`, `'light'`, `'dark'`, `'checker'`, `'transparent'`.

`'transparent'` draws the same checkerboard as `'checker'` while browsing. The canvas has no way to show the difference, because the difference is what a [capture](guide/visual-regression.md#capturing-transparency) does: `'transparent'` yields a screenshot with a real alpha channel, `'checker'` one on the themed surface. It is also what a variant resolves to when nothing declares a background.

`'checker'` is deprecated since 22.2.0 and removed in 23.0.0. It draws the same checkerboard as `'transparent'` while browsing, so the canvas cannot tell them apart. But it captures as `--prism-bg-surface`, a theme token, which makes a baseline recorded on it depend on the theme the runner's browser started in. Use `'transparent'` for the same look with a capture that keeps its alpha, or `'light'`/`'dark'` for an absolute colour. The build warns for every component and variant that still declares it. It stays in the tools menu's **Canvas** group until then, because that group marks the active and the recommended background, and a value missing from it is a value the UI cannot show.

```typescript
@Showcase({
  title: 'Dark-only Card',
  bg: 'dark',
})
```

Variants can also declare a recommended `bg`. Variant-level always wins over component-level. See [Variants](guide/variants.md#per-variant-background).

### `canvasLayout`

Wrapper sizing mode for the canvas. Controls how `.demo-wrap` (the wrapper around the rendered component) sizes itself within the canvas stage.

Accepted values: `'fit'` (default) and `'stretch'`.

| Value       | Behavior                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'fit'`     | Wrapper is `display: inline-block` and shrinks to the component's intrinsic size; the stage's flexbox centers it. Use for the vast majority of components.                                              |
| `'stretch'` | Wrapper becomes `display: block; width: 100%; max-width: 800px`. Use when the component has no intrinsic width (horizontal divider via `border-bottom`) or opts into `width: 100%` (full-width button). |

```typescript
@Showcase({
  title: 'Divider',
  canvasLayout: 'stretch',
})
```

With Viewport width on, the wrapper takes the width set there instead of the canvas width: a `'fit'` component is centred in it, a `'stretch'` component fills it, also when the subject renders in a [`template`](guide/content-projection.md#compiled-content-template) or a [host template](guide/directive-hosting.md#host-template).

Variants can override this with their own `canvasLayout`. See [Variants: Per-Variant Canvas Layout](guide/variants.md#per-variant-canvas-layout) and the [`CanvasLayout`](api/types.md#canvaslayout) type for the exact wrapper styles applied in each mode.

### `host`

Tells ng-prism what to render a directive on, or what to render a component or directive inside. A directive without a `host` renders on the element its selector names, see [Directive Hosting](guide/directive-hosting.md#without-a-host).

**String host** (an HTML element string):

```typescript
@Showcase({
  title: 'Tooltip Directive',
  host: '<button class="btn">Hover me</button>',
  variants: [
    { name: 'Default', inputs: { appTooltip: 'This is a tooltip' } },
  ],
})
@Directive({ selector: '[appTooltip]' })
export class TooltipDirective { ... }
```

**Object host** (an Angular component):

```typescript
@Showcase({
  title: 'Ripple Directive',
  host: {
    selector: 'lib-button',
    import: { name: 'ButtonComponent', from: 'my-lib' },
    inputs: { label: 'Click me' },
  },
})
@Directive({ selector: '[libRipple]' })
export class RippleDirective { ... }
```

**Host template** (`{ template }`, since 22.7.0), an Angular template the subject renders in. It works for directives and components:

```typescript
@Showcase<InputDirective>({
  title: 'Input',
  host: { template: '<lib-form-field label="Name"><input libInput /></lib-form-field>' },
})
@Directive({ selector: 'input[libInput]' })
export class InputDirective { ... }
```

A string or an object `host` on a component has no effect, and the build warns about it. See [Directive Hosting](guide/directive-hosting.md) for a full walkthrough.

### `imports`

What the templates of this showcase use and ng-prism does not find in your library by itself (since 22.7.0): classes from another package, and Angular's pipes and directives. A list of `{ name, from }` pairs, strings and not class references:

```typescript
@Showcase<FormFieldComponent>({
  title: 'Form Field',
  imports: [{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }],
  variants: [{ name: 'Note', template: '<textarea libInput cdkTextareaAutosize></textarea>' }],
})
```

Library classes that a template names are imported without being listed. See [Content Projection: Imports](guide/content-projection.md#imports) for the rule. `imports` is for components and directives only; on a service or a pipe it counts as a [component-only field](guide/showcasing-services.md#compatibility-until-2300).

### `partOf`

The selector of the component or directive that this one is a part of (since 22.7.0). Some components only exist inside another one: an option inside a select, an option group, a tab inside a tab group. A showcase for each of them rebuilds the parent's markup in a variant that the parent's own variants already show. `partOf` says what it belongs to instead, and the part gets no page of its own: its title, description, inputs and outputs appear on the page of its parent.

```typescript
@Showcase<SelectComponent>({
  title: 'Select',
  variants: [{ name: 'Default' }, { name: 'Groups', template: '<lib-optgroup label="Fruit"><lib-option value="apple">Apple</lib-option></lib-optgroup>' }],
})
@Component({ selector: 'lib-select, [libSelect]', ... })
export class SelectComponent { ... }

@Showcase({
  title: 'Option',
  description: 'One choice of a select.',
  partOf: 'lib-select',
})
@Component({ selector: 'lib-option', ... })
export class OptionComponent { ... }
```

The value is a selector string and not the class. A class would need `option.component.ts` to import `select.component.ts`, which usually imports the option for its `contentChildren`: an import cycle, and the config is evaluated when the class is defined, which makes the cycle a `ReferenceError` in a library build. A string costs nothing at runtime, and `ng-prism-strip` removes the decorator as it does for every other field.

The rules:

- **A selector matches when it equals one entry of the parent's `selector`**, ignoring spaces around it. `'lib-select'` matches `selector: 'lib-select, [libSelect]'`, and so does `'[libSelect]'`. The parent can be a component or a directive, and it can be exported from another entry point than the part.
- **One parent, and no chains.** Name a selector that exactly one other class with `@Showcase` has. A part cannot be the parent of another part, and cannot name itself.
- **A part uses `title`, `description`, `tags` and `status`**, the inputs and outputs that the scan reads from its class, and `meta`, which stays for plugins. A plugin that reads the API of components (`componentApi`) reads the part's as well. The sidebar search lists the parent for a query that matches the title, class name, selector or tags of one of its parts, since the part has no entry of its own.
- **What only a page uses has no effect:** `variants`, `states`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `bg`, `canvasLayout`, a host template (`host: { template }`), `imports` and `renderPage`. Setting one costs a notice and never fails a build: the scan drops the field and says so, and a notice does not count for [`strictShowcase`](api/ng-prism-config.md#strictshowcase), since nothing is lost that the styleguide could have shown. The variants of a part are dropped too, so a part does not need one. The scan reads a class before it knows that it is a part, so a value in one of these fields that is malformed or cannot be read, and an error in the template of one of the part's variants, is reported as it is on any other component, and that does count for `strictShowcase`. `providers` and `setup` keep their own warnings on a part, as on every component. A directive part keeps a string or object `host`, such as `host: '<button>Open</button>'`: it names the element the directive sits on, and the API tab of the [JSDoc plugin](plugins/jsdoc.md) writes the part's usage line on it (`<button libTrigger>` instead of `<div libTrigger>`).
- **Only a component or a directive can be a part.** `partOf` on a service or a pipe is dropped with a diagnostic, like the other losses of a service or a pipe: only when a plugin shows services or pipes.

**Where a part shows up.** The head of the parent's page lists its parts after the title, the info glyph and the status badge: the label "Parts" and one chip per part, in the order of their titles. A click on a chip opens a card at that chip, built like the card behind the info glyph:

- the part's title, its `<selector>` and its status badge, if it has a `status`;
- its description;
- **Inputs**: the name (or the alias, which is what a template binds), a `required` badge, the type as it is written in the source, the default and the JSDoc line;
- **Outputs**: the name (or the alias) and the JSDoc line, then the change output Angular adds for each `model()`, `<name>Change`, with a line on the two-way binding.

A section without entries is left out. Everything on the card comes from what the scan reads from the part's class, so it works without a plugin.

At the bottom of the card, **Full API →** opens the first visible view panel that sets [`listsParts`](api/ng-prism-plugin.md#panels-that-list-parts), for example the API tab of the [JSDoc plugin](plugins/jsdoc.md), at the block of that part. It appears only when such a panel exists for the component, so without one the card ends with the outputs. The band of the head never wraps: when it is too narrow for all chips, they scroll sideways inside their own track.

A `partOf` that does not resolve never makes a component disappear. The scan reports a diagnostic, drops `partOf`, and the class stays an entry of its own with everything it declares, its variants included:

| Message                                                                                                                            | Cause and fix                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `<Class> › partOf — no component or directive with @Showcase has the selector "<selector>"; it keeps a page of its own`            | No exported class with `@Showcase` has that selector. Check the spelling, and that the parent has `@Showcase`.           |
| `<Class> › partOf — "<selector>" is the selector of <A> and <B>; name a selector only one of them has. It keeps a page of its own` | Several showcased classes match. Name a selector only the parent has, for example an attribute selector.                 |
| `<Class> › partOf — <Parent> is a part itself, and a part cannot have parts; it keeps a page of its own`                           | The parent declares `partOf` too. Point the part at the parent's own parent, or give the middle class a page of its own. |
| `<Class> › partOf — a component cannot be a part of itself; it keeps a page of its own`                                            | The selector is one of the class's own.                                                                                  |
| `<Class> › partOf — expected the selector of a showcased component or directive as a string, got <value>; it was dropped`          | `partOf` is not a string, or only spaces.                                                                                |
| `<Class> › partOf — only a component or directive can be part of another; it was dropped`                                          | A service or a pipe declares `partOf`. Reported when a plugin shows services or pipes, as their other diagnostics are.   |
| `<Class> › <field> — has no effect on a part, which has no page of its own: the parent's showcase shows it. It was dropped.`       | A notice, not a diagnostic. Delete the field from the part.                                                              |

Each message ends with the file, line and column of the `partOf` or the field, as other `@Showcase` messages do.

**When a part, when a showcase of its own.** Use `partOf` for a class that only works inside one parent and whose page would repeat what the parent's variants show: `lib-option` and `lib-optgroup` in `lib-select`. Keep a showcase of its own when the class has a life apart from one parent. `libInput` stays its own entry: a form field and a search input both use it, `partOf` takes exactly one parent, and it has states of its own that only a page of its own can show.

### `status`

Optional migration / maturity badge. Accepts `'stable'`, `'beta'`, `'wip'`, or `'deprecated'` (the `ComponentStatus` union).

```typescript
@Showcase({ title: 'Button',  status: 'stable' })
@Showcase({ title: 'Chip',    status: 'beta' })
@Showcase({ title: 'Slider',  status: 'wip' })
@Showcase({ title: 'Dialog',  status: 'deprecated' })
```

When `status` is omitted, the component is treated as stable but renders without any indicator, which keeps the sidebar quiet. Set it explicitly only when you want to draw attention.

**Visual impact**

| Status         | Sidebar item                           | Component head                                       |
| -------------- | -------------------------------------- | ---------------------------------------------------- |
| _unset_        | unchanged                              | no status badge                                      |
| `'stable'`     | unchanged                              | "Stable" badge in the success colour                 |
| `'beta'`       | unchanged                              | "Beta" badge in the warning colour                   |
| `'wip'`        | dashed-circle leading icon (tooltip)   | "Work in progress" badge, warning, with a hollow dot |
| `'deprecated'` | name struck-through + dimmed (tooltip) | "Deprecated" badge in the danger colour              |

The status badge is rendered inline with the title in the component head's single row; the `<selector>` now lives in the details popover behind the ⓘ glyph. It is a soft-tinted badge with a dot, coloured with `--prism-success`, `--prism-warn` and `--prism-danger`, so light and dark mode are handled automatically, and its tooltip says what the status means.

Use this to communicate migration state while moving components from a legacy library into a new one: set `'wip'` on what's actively being migrated, `'deprecated'` on what should no longer be used, and `'stable'` / `'beta'` to badge maturity once a component is done.

### `renderPage`

Title of a registered `ComponentPage` to render instead of the default component canvas. Use for complex components that need mock data or providers of their own, or a demo that is more than one subject. Components that only need other library parts in their content, or a frame around them, are better served by a variant [`template`](guide/content-projection.md#compiled-content-template) or a [host template](guide/directive-hosting.md#host-template), which keep the Overview, `states` and the Events panel that a page gives up.

The page component can inject `PrismRendererService` to react to variant and controls panel changes. A component with `renderPage` cannot declare [`states`](#states).

```typescript
@Showcase({
  title: 'Data Table',
  renderPage: 'Data Table Demo',  // must match the ComponentPage title
  variants: [
    { name: 'Empty', inputs: {} },
    { name: '10 rows', inputs: { rowCount: 10 } },
  ],
})
@Component({ ... })
export class DataTableComponent { ... }
```

See [Component Pages](guide/component-pages.md) for how to create and register the page.
