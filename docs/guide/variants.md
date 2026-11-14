# Variants

A variant is one way to show a component: a set of inputs, content or a template, and a few settings of its own. Each variant is a tab in the variant ribbon above the canvas, and a cell or a row of the [Overview](guide/styleguide-ui.md#the-overview). When every variant should also be shown hovered, pressed or focused, declare those once as [states](guide/states.md) instead of as variants of their own.

## Defining variants

List them in [`variants`](api/showcase-config.md#variants):

```typescript
@Showcase<AlertComponent>({
    title: 'Alert',
    variants: [
        { name: 'Info', inputs: { message: 'Operation completed.', severity: 'info' } },
        { name: 'Error', inputs: { message: 'Something went wrong.', severity: 'error' } },
        { name: 'Dismissible', inputs: { message: 'Saved as draft.', severity: 'info', dismissible: true } }
    ]
})
@Component({/* ... */})
export class AlertComponent {
    /* ... */
}
```

- **`name`** is the label of the tab, the caption in the Overview and the name build warnings use for the variant.
- **The position** is the variant's address: `?variant=1` in the URL, the render marker and `__PRISM_MANIFEST__` use the index. Keep the order stable once links or screenshots point to it, and add new variants at the end.
- **Without variants,** the component renders once, as an implicit `Default` variant with every input at its default.

Variant values are read from the source without running it, so a `let` variable or a function call is dropped with a warning, while constants and enum members work, see [What the Scanner Reads](guide/scanner-reads.md). The type argument `@Showcase<AlertComponent>` checks the `inputs` against the component, see [Type-safe inputs](guide/inputs-and-controls.md#type-safe-inputs).

## Dates

A `Date` is a value like any other, as long as the scanner can read its arguments: `new Date(2026, 3, 28)`, `new Date('2026-04-28')` or `new Date(1777334400000)`, written out or in a constant. ng-prism keeps the arguments as you wrote them, and the styleguide makes the `Date` when it loads, in the time zone of the browser. A variant shows the day your code shows, whether the styleguide was built in CI or on your machine.

```typescript
@Showcase<DateFieldComponent>({
    title: 'Date field',
    variants: [
        { name: 'With value', inputs: { value: new Date(2026, 3, 28) } },
        { name: 'Min and max', inputs: { value: new Date(2026, 3, 28), min: new Date(2026, 3, 1), max: new Date(2026, 3, 30) } }
    ]
})
```

- **For a day without a time, write a local form,** `new Date(2026, 3, 28)` or `new Date('2026-04-28T00:00')`: midnight of the 28th in every time zone. In the first the month counts from 0, so `3` is April. The second reads like the day it is, because a time without an offset is local time. `new Date('2026-04-28')` without the time is midnight in UTC, which west of UTC is still the 27th: a date picker in New York shows the day before.
- **`new Date()` without arguments is dropped with a warning.** It is the current time, which would differ in every build and every visual regression run. Write the date out instead, see [The current time](api/build-warnings.md#the-current-time).

How the Controls panel edits a `Date` input is under [Input types and controls](guide/inputs-and-controls.md#input-types-and-controls).

## Explicit keys

A variant sets only the inputs it lists. Every other input starts at its default, or `undefined` without one:

```typescript
variants: [
    { name: 'Default', inputs: { label: 'Save' } },
    // `label` is back at its default here
    { name: 'Large', inputs: { size: 'lg' } }
];
```

What you change in the Controls panel stays while you look at that variant. Selecting another variant starts it from its own values. The **Reset** button of the Controls panel sets the inputs back to the active variant's own values without leaving it.

To make a variant set an input to `undefined` on purpose, for example to show the component without an icon its default would give it, write it out:

```typescript
variants: [{ name: 'No icon', inputs: { icon: undefined } }];
```

How defaults are read, and what happens to one the scanner cannot read, is under [Defaults](guide/inputs-and-controls.md#defaults).

## Per-variant fields

Besides `name` and `inputs`, a variant has these fields. Each one links to its reference.

- **[`content`](api/showcase-config.md#content):** HTML projected into the component's `<ng-content>`, one string for the default slot or a record for several, see [Content Projection](guide/content-projection.md).
- **[`template`](api/showcase-config.md#template):** an Angular template compiled as the content of the subject, for content made of components and directives, see [Compositions](guide/compositions.md#template).
- **[`host`](api/showcase-config.md#host):** a host template (`{ template }`) the subject renders in for this variant, in place of the showcase's `host`, see [Compositions](guide/compositions.md#host-template).
- **[`pseudo`](api/showcase-config.md#pseudo):** pseudo states such as `:hover` or `:focus-visible`, forced while the variant renders, see [Per-variant pseudo states](guide/states.md#per-variant-pseudo-states).
- **[`states`](api/showcase-config.md#states):** `false` keeps the variant out of the component's states, see [Opting a variant out](guide/states.md#opting-a-variant-out).
- **[`bg`](api/showcase-config.md#bg):** the recommended canvas background for this variant, which wins over the component's `bg`.
- **[`canvasLayout`](api/showcase-config.md#canvaslayout):** `'fit'` or `'stretch'` for this variant, which wins over the component's `canvasLayout`.
- **[`meta`](api/showcase-config.md#meta):** data for plugins, per variant, such as the [Figma](plugins/figma.md#variant-level-urls) node of each variant.
- **[`description`](api/showcase-config.md#description):** a text for plugins; the styleguide does not show it.

A variant can combine them. Here each variant links its own Figma node, and two of them set their own background and layout:

```typescript
@Showcase<ButtonComponent>({
    title: 'Button',
    variants: [
        { name: 'Primary', inputs: { variant: 'primary' }, meta: { figma: 'https://www.figma.com/design/abc?node-id=1-1' } },
        { name: 'On dark', inputs: { variant: 'primary' }, bg: 'dark', meta: { figma: 'https://www.figma.com/design/abc?node-id=1-2' } },
        { name: 'Full width', inputs: { variant: 'primary', fullWidth: true }, canvasLayout: 'stretch' }
    ]
})
```

## Related

- [Inputs & Controls](guide/inputs-and-controls.md): input types, defaults, inherited and aliased inputs, and the Controls panel
- [States & Pseudo States](guide/states.md): hover, pressed and focus across all variants
- [Compositions](guide/compositions.md): variants that render the subject together with other components
- [Variant fields](api/showcase-config.md#variant-fields) in the ShowcaseConfig reference, and [`Variant`](api/types.md#variant) in Types
- [Tour of the UI](guide/styleguide-ui.md): the variant ribbon, the Overview and the tools menu
