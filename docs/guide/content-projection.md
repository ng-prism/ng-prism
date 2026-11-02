# Content Projection

Use the [`content`](api/showcase-config.md#content) field on a variant to project HTML into a component's `<ng-content>` slots. Each variant sets its own; there is no component-level default.

`content` is plain HTML. When the content has to be real Angular, such as a component that finds its children with `contentChildren`, write a variant [`template`](guide/compositions.md#template) instead.

## Single Slot

Pass a plain string to project into the default (unnamed) slot:

```typescript
@Showcase({
    title: 'Button',
    variants: [
        { name: 'With Icon', content: '<svg viewBox="0 0 16 16">...</svg> Save' },
        { name: 'Text Only', content: 'Save' }
    ]
})
@Component({
    selector: 'lib-button',
    template: `<button><ng-content /></button>`
})
export class ButtonComponent {}
```

## Multi-Slot Content

Pass a `Record<string, string>` where each key is a CSS selector matching an `<ng-content select="...">` and the special key `'default'` targets the unnamed slot.

```typescript
@Showcase({
    title: 'Card',
    variants: [
        {
            name: 'Full',
            content: {
                '[card-header]': '<h3>Card Title</h3>',
                '[card-footer]': '<button>Action</button>',
                default: '<p>This is the card body content.</p>'
            }
        },
        {
            name: 'Header Only',
            content: {
                '[card-header]': '<h3>Card Title</h3>'
            }
        }
    ]
})
@Component({
    selector: 'lib-card',
    template: `
        <div class="card">
            <div class="card__header"><ng-content select="[card-header]" /></div>
            <div class="card__body"><ng-content /></div>
            <div class="card__footer"><ng-content select="[card-footer]" /></div>
        </div>
    `
})
export class CardComponent {}
```

Each key has to match the `select` attribute of an `<ng-content>` exactly as the template writes it; `default` (or a plain string) goes to the unnamed one. Content for a slot the template doesn't have is dropped with a warning in the browser console: `[ng-prism] Variant content "<key>" matches no <ng-content> of <Class>, skipping it.`

## HTML Content

Content strings are treated as raw HTML and injected via the renderer. You can include any valid HTML markup:

```typescript
content: `
  <strong>Bold text</strong> and
  <em>italic text</em> in the same slot.
`;
```

## Limitations

`content` strings are static HTML. Angular template syntax (`*ngIf`, `[(ngModel)]`, event bindings) does not work inside them, because they are not compiled as Angular templates, and a component written in them is not created.

- **Content made of components or directives, or content that needs bindings:** write a variant [`template`](guide/compositions.md#template). A variant with both keeps the `template` and drops `content` with a warning.
- **A component in a host template:** HTML `content` cannot go into it and is dropped with a warning, see [Content in a host template](guide/compositions.md#content-in-a-host-template).
- **A demo that needs providers or state of its own:** see [Composition, renderPage or a component page?](guide/component-pages.md#composition-renderpage-or-a-component-page).

## Directive Host Content

A directive has no `<ng-content>` to project into: its `content` becomes the text of its host element. See [Content in Directive Variants](guide/directive-hosting.md#content-in-directive-variants).

## Related

- [`content`](api/showcase-config.md#content) in the ShowcaseConfig reference
- [Compositions](guide/compositions.md): Angular templates as content, and the subject inside other markup
- [Variants](guide/variants.md#per-variant-fields): the other fields of a variant
