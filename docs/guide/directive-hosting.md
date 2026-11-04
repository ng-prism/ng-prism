# Directive Hosting

A directive cannot render on its own: it needs a host element or a host component. Without any configuration, ng-prism renders a directive on the element its selector names. The [`host`](api/showcase-config.md#host) field of `@Showcase` chooses another element, as a string, or a component, as an object. To show the directive inside other markup, such as an input in its form field, use a host template, see [Compositions](guide/compositions.md#host-template).

## Without a Host

A directive without `host` renders on the element its selector names, with the attributes and classes the selector asks for (since 22.7.0):

| Selector                 | Renders as                        |
| ------------------------ | --------------------------------- |
| `input[libInput]`        | `<input libInput>`                |
| `button[libBtn].primary` | `<button libBtn class="primary">` |
| `[libTooltip]`           | `<div libTooltip>`                |

A selector without an element renders on a `div`. Of a selector list, such as `input[libInput], textarea[libInput]`, the first part counts.

## Why `host` Is Needed

A directive often needs more than its own element: a button to hover, a component to sit on, or a frame around it. `host` says what to render the directive on.

```typescript
@Showcase({
    title: 'Tooltip',
    host: '<button class="btn">Hover me</button>'
})
@Directive({ selector: '[appTooltip]' })
export class TooltipDirective {
    readonly appTooltip = input('');
}
```

For a frame around the directive, or other components next to it, write a [host template](guide/compositions.md#host-template).

## String Host

The simplest form is one HTML element as a string. ng-prism generates a wrapper that renders the directive on it:

```html
<!-- what the generated wrapper renders -->
<button class="btn" appTooltip [appTooltip]="…">Hover me</button>
```

- **The selector is applied for you.** ng-prism adds the attributes and classes of the selector to the element; of a selector list, those of the first part whose element is the host's tag, or that names no element. When no part fits the tag, only the first attribute of the selector is set, with a notice.
- **Inputs are bound** to the values of the variant and the Controls panel, by their public name, see [Aliased inputs](guide/inputs-and-controls.md#aliased-inputs).
- **The string is one element:** `<tag>`, `<tag attrs>`, `<tag />` or `<tag>text</tag>`. Anything else falls back to a `<div>` with a notice. The text of `<tag>text</tag>` is the content of the host until a variant sets its own.

### Void Elements

The host may be a void element: `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track` or `wbr`. ng-prism renders it without content and without an end tag (since 22.7.0):

```typescript
@Showcase({
    title: 'Mask',
    host: '<input type="text">',
    variants: [{ name: 'Phone', inputs: { libMask: '(000) 000-0000' } }]
})
@Directive({ selector: '[libMask]' })
export class MaskDirective {
    readonly libMask = input('');
}
```

A void element takes no content, so `content` on such a variant cannot render. The build says so once per directive:

```
⚠ ng-prism: MaskDirective: <input> is a void element and takes no content, so the content of the host and of the variants is not rendered.
```

## Object Host: Angular Component

When the directive is designed to be applied to a specific Angular component, use the object form, a [`DirectiveHost`](api/types.md#directivehost):

```typescript
@Showcase({
    title: 'Ripple',
    host: {
        selector: 'lib-button',
        import: { name: 'ButtonComponent', from: 'my-lib' },
        inputs: { label: 'Click me', variant: 'primary' }
    },
    variants: [
        { name: 'Default', inputs: {} },
        { name: 'Custom Color', inputs: { libRippleColor: '#6366f1' } }
    ]
})
@Directive({ selector: '[libRipple]' })
export class RippleDirective {
    readonly libRippleColor = input('currentColor');
}
```

| Field         | Description                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------- |
| `selector`    | The element selector of the host component                                                    |
| `import.name` | The exported class name                                                                       |
| `import.from` | The npm package or path to import from                                                        |
| `inputs`      | Static inputs of the host component, written as attributes, so each value arrives as a string |

ng-prism generates a wrapper that renders:

```html
<lib-button label="Click me" variant="primary" libRipple [libRippleColor]="…" />
```

An object host needs `import`. Without it the directive renders on a `<div>`, with a notice: `<Class>: the host names no class to import (host.import), so it renders as <div>.` An `import` that is not a `{ name, from }` pair of non-empty strings is dropped with a warning, with the same result.

## Content in Directive Variants

A variant's `content` becomes the text of the host element:

```typescript
@Showcase({
    title: 'Tooltip',
    host: '<span>',
    variants: [
        { name: 'Short', content: 'Hover' },
        { name: 'Long', content: 'Hover over this longer text' }
    ]
})
```

On a directive, `content` is a string and is written as text: markup in it shows as written, and a record of slots has no effect. For markup, components or directives inside the host element, give the variant a [`template`](guide/compositions.md#on-a-directive).

## Inputs the Wrapper Does Not Bind

The wrapper of a string host, an object host or no host binds an input when its type is a string, a number, a boolean or a union of string literals, or when the scanner read a default for it. A `Date` input is bound as well (since 22.8.0), unless it has a default the scanner could not read, such as `model<Date>(new Date())`, which the directive keeps. Any other input, such as an object without a default or a `TemplateRef`, stays unbound: a value from a variant or the Controls panel does not reach the directive. A variant with a [composition](guide/compositions.md), a `template` or a host template, renders through another wrapper, which binds those inputs as well.

An input whose type names `TemplateRef`, `ElementRef` or `ViewContainerRef` shows `Not editable` in the Controls panel, see [What the Controls panel cannot edit](guide/inputs-and-controls.md#what-the-controls-panel-cannot-edit).

## Outputs

The generated wrapper re-emits every output of the directive and each change of a `model()` it binds, and the Events panel logs each emission with its payload. A payload of any type passes, also one whose type the library does not export.

## Examples

### Simple attribute directive

```typescript
@Showcase({
    title: 'Highlight',
    host: '<p>Some text to highlight</p>',
    variants: [
        { name: 'Yellow', inputs: { appHighlight: '#fef08a' } },
        { name: 'Blue', inputs: { appHighlight: '#bfdbfe' } }
    ]
})
@Directive({ selector: '[appHighlight]' })
export class HighlightDirective {
    appHighlight = input('#fef08a');
}
```

### Directive with a required input

```typescript
@Showcase({
    title: 'Permission Guard',
    host: '<div>Protected content</div>',
    variants: [
        { name: 'Allowed', inputs: { appPermission: 'admin' } },
        { name: 'Denied', inputs: { appPermission: 'guest' } }
    ]
})
@Directive({ selector: '[appPermission]' })
export class PermissionDirective {
    appPermission = input.required<string>();
}
```

ng-prism always puts the directive on an element as an attribute. A structural directive, one that injects `TemplateRef` and is applied with `*` or on an `<ng-template>`, has no template to receive there. Show it in a [component page](guide/component-pages.md) instead.

## Next Steps

- [Compositions](guide/compositions.md): a directive inside its form field, or a variant template inside the host element
- [Inputs & Controls](guide/inputs-and-controls.md): input types, aliases and what the Controls panel cannot edit
- [`host`](api/showcase-config.md#host) in the ShowcaseConfig reference and [`DirectiveHost`](api/types.md#directivehost) in Types
- [Build Warnings › Compositions and hosts](api/build-warnings.md#compositions-and-hosts): every message about a host
