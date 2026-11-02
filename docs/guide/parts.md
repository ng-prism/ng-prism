# Parts

Some components only exist inside another one: an option inside a select, an option group, a tab inside a tab group. A showcase of their own would rebuild the parent's markup in variants that the parent's variants already show. [`partOf`](api/showcase-config.md#partof) (since 22.7.0) says what such a class belongs to instead: the part gets no page of its own, and its title, description, inputs and outputs appear on the page of its parent.

## When something is a part

Use `partOf` for a class that only works inside one parent and whose page would repeat what the parent's variants show: `lib-option` and `lib-optgroup` in `lib-select`.

Keep a showcase of its own for a class that has a life apart from one parent. `libInput` stays its own entry: a form field and a search input both use it, `partOf` takes exactly one parent, and it has states of its own that only a page of its own can show. To show such a class together with the components it works with, give a variant a [`template` or a host template](guide/compositions.md).

## Declaring a part

`partOf` takes the selector of the parent:

```typescript
@Showcase<SelectComponent>({
    title: 'Select',
    variants: [{ name: 'Default' }, { name: 'Groups', template: '<lib-optgroup label="Fruit"><lib-option value="apple">Apple</lib-option></lib-optgroup>' }]
})
@Component({ selector: 'lib-select, [libSelect]' /* ... */ })
export class SelectComponent {}

@Showcase({
    title: 'Option',
    description: 'One choice of a select.',
    partOf: 'lib-select'
})
@Component({ selector: 'lib-option' /* ... */ })
export class OptionComponent {}
```

The value matches when it equals one entry of the parent's `selector`, spaces around it aside: `'lib-select'` matches `selector: 'lib-select, [libSelect]'`, and so does `'[libSelect]'`. The parent can be a component or a directive, and it can be exported from another entry point than the part.

The value is a selector string and not the class. A class would need `option.component.ts` to import `select.component.ts`, which usually imports the option for its `contentChildren`: an import cycle. The config is evaluated when the class is defined, so in a library build the cycle becomes a `ReferenceError`. A string costs nothing at runtime, and [`ng-prism-strip`](guide/library-publishing.md) removes the decorator as it does for every other field.

A part needs no variants. It is rendered by the variants of its parent, so the parent's `template` is where it shows on the canvas.

## How a part shows

The part has no entry in the sidebar. The head of the parent's page lists its parts after the title, the info glyph and the status badge: the label **Parts** and one chip per part, sorted by title. When the chips do not fit, they scroll sideways in their own track. A click on a chip opens a card at the chip, built like the details card behind the info glyph:

- the part's title, its `<selector>` and its status badge, if it has a `status`
- its description
- **Inputs**: the name a template binds (the alias, where there is one), a `required` badge, the type, the default and the JSDoc line
- **Outputs**: the name a template binds and the JSDoc line, then the change output Angular adds for each `model()`, `<name>Change`

A section without entries is left out. Everything on the card comes from what the scan reads from the part's class, so it works without a plugin.

At the bottom of the card, **Full API →** opens the first visible view panel that [lists parts](api/ng-prism-plugin.md#panels-that-list-parts), such as the API tab of the [JSDoc](plugins/jsdoc.md#parts) plugin, at the block of that part. It appears only when such a panel exists for the component, so without one the card ends with the outputs.

Elsewhere:

- **Search:** the sidebar search lists the parent for a query that matches the title, class name, selector or tags of one of its parts.
- **Links:** a link to the part's class opens its parent, and `?part=` scrolls the panel that lists parts to it, see [Links & State](guide/url-state.md#parts).
- **Plugins:** a plugin that reads the API of components (`componentApi`) reads the part's API as well. The build hooks see a part with `parentClassName`, the class name of its parent, see [Parts in the hooks](architecture/plugin-hooks.md#parts-in-the-hooks).
- **Tooling:** `__PRISM_MANIFEST__` lists the parts of each component under `parts`, not under `components`, see [Enumerating what exists](guide/external-tooling.md#enumerating-what-exists).

## Rules

The field's reference is [`partOf`](api/showcase-config.md#partof), and every message is under [Build Warnings](api/build-warnings.md#parts).

- **One parent, and no chains.** Name a selector that exactly one other class with `@Showcase` has. A part cannot be the parent of another part, and cannot name itself.
- **A `partOf` that does not resolve never makes a class disappear.** The scan reports it, drops `partOf`, and the class keeps a page of its own with everything it declares, its variants included. The report counts for [`strictShowcase`](api/ng-prism-config.md#strictshowcase).
- **A part uses** `title`, `description`, `tags` and `status`, the inputs and outputs the scan reads from its class, and `meta`, which stays for plugins.
- **What only a page uses has no effect:** `variants`, `states`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `bg`, `canvasLayout`, a host template, `imports` and `renderPage`. The scan drops each with a notice, which never fails a build, since nothing is lost that the styleguide could have shown. Delete them from the part.
- **The scan reads a class before it knows that it is a part.** A value in one of those fields that is malformed or cannot be read, and an error in the template of one of the part's variants, is reported as on any other component, and does count for `strictShowcase`. `providers` and `setup` keep their own warnings.
- **A directive part keeps a string or object `host`,** such as `host: '<button>Open</button>'`. It names the element the directive sits on, and the API tab of the [JSDoc](plugins/jsdoc.md) plugin writes the part's usage line on it: `<button libTrigger>` instead of `<div libTrigger>`.
- **Only a component or a directive can be a part.** On a service or a pipe, `partOf` is dropped with a warning, which appears once a plugin shows services or pipes.

## Related

- [`partOf`](api/showcase-config.md#partof) in the ShowcaseConfig reference
- [Build Warnings › Parts](api/build-warnings.md#parts): every message with its cause and fix
- [Compositions](guide/compositions.md): templates that render the parent with its parts
- [Links & State](guide/url-state.md#parts): links to a part
- [JSDoc](plugins/jsdoc.md#parts): the API blocks of the parts
