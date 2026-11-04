# JSDoc

`@ng-prism/plugin-jsdoc` draws the API page of every component, directive, service and pipe in the styleguide, from the code and the JSDoc on it.

## What it does

- Adds the **API** view tab (id `jsdoc`, `view=jsdoc` in the URL) next to Playground and Overview on every component and directive. A component you select opens on its Playground; a link with `view=jsdoc` opens the API tab directly.
- Is the whole page of every [service and pipe](guide/services-and-pipes.md) with `@Showcase` (since 22.7.0). Without this plugin, services and pipes are not listed at all.
- Draws one page for all four kinds (since 22.7.0): a generated usage snippet, the examples, the API as the code declares it with linked types, the types it reaches and an "On this page" list.
- Shows the API of a component's [parts](#parts) in a block each on the parent's page (since 22.7.0).
- Turns `@see X` and `{@link X}` into a jump to the card of `X` (since 22.7.0), see [Links to Types](#links-to-types).
- Renders descriptions as Markdown and `@example` blocks with syntax highlighting, see [Markdown Support](#markdown-support).
- Works at build time: the scanner reads the API and the JSDoc, and the browser parses no TypeScript.

The page is there without a single JSDoc comment, since the usage snippet and the signatures come from the code.

## Install

```bash
ng add @ng-prism/plugin-jsdoc
```

This installs the package and registers `jsDocPlugin()` in `ng-prism.config.ts`. To install it by hand, see [Installing Plugins](plugins/overview.md#installing-plugins).

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin()]
});
```

The plugin sets [`componentApi`](api/ng-prism-plugin.md#componentapi), so the build reads the API of every component and directive for it (`ScannedComponent.api`); a config without the plugin skips that work. Its view panel [applies to](api/ng-prism-plugin.md#panels-on-service-and-pipe-pages) components, services and pipes, which is what makes the build read services and pipes at all.

## Options

`jsDocPlugin()` takes no options.

## Supported Tags

The description is the text of a doc block before its first tag. Of the tags, the page reads these:

| Tag                | Where it shows                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description        | As Markdown: a block on the class, a setup entry and a type card, inline in a table cell and under a parameter, see [Markdown Support](#markdown-support)                                                                                                                                                                                               |
| `@deprecated`      | On the class, the first chip, `Deprecated: <message>` with the message as Markdown, or `Deprecated` without one. On a setup entry, a badge `deprecated: <message>` after its signature. On an input, an output, a property, a method, a `transform()` signature or a type card, a `deprecated` badge without the message; a table row with it is dimmed |
| `@since`           | On the class, a `Since: <version>` chip. On an input, an output, a property, a method or an option, a note `Since <version>` after the description                                                                                                                                                                                                      |
| `@version`         | A `Version: <version>` chip, on components and directives only                                                                                                                                                                                                                                                                                          |
| `@default`         | The **Default** column of a setup entry's option table and of the properties on a type card. An input shows the default from the code instead                                                                                                                                                                                                           |
| `@param name text` | Under the parameter, in Methods, in Transform and on a setup entry. `@param name - text`, the TSDoc spelling, works as well; the dash is not part of the text. On a constructor, it describes the [parameter properties](guide/services-and-pipes.md#members)                                                                                           |
| `@example`         | On the class, a block in **Examples**. On a setup entry, a block under its signature. Highlighted by the language of its fence, see [Code Fences in `@example`](#code-fences-in-example)                                                                                                                                                                |
| `@see`             | A `See:` chip on the class and on a type card. A name that has a card on the page is a button that jumps to it; a URL or any other name stays text, see [Links to Types](#links-to-types)                                                                                                                                                               |
| `{@link X}`        | In any description the page renders: a jump to the card of `X`, a link for a URL, otherwise `X` as inline code, see [Links to Types](#links-to-types)                                                                                                                                                                                                   |
| `@internal`        | Hides a property, a method, a type, or a member of a type or an enum from the page. The inputs and outputs of a component are listed with or without it                                                                                                                                                                                                 |

Any other tag is not read. `@returns` is one of them: the return type comes from the code, so say what the value means in the description.

```typescript
/**
 * The primary action button. Supports primary, secondary, and danger variants.
 *
 * @since 1.0.0
 * @deprecated Use `IconButtonComponent` for icon-only actions.
 * @see https://design.example.com/buttons
 * @example
 * <lib-button label="Save" variant="primary" />
 */
@Showcase({ title: 'Button' })
@Component({ ... })
export class ButtonComponent { ... }
```

This class gets the description as Markdown, the chips `Deprecated: Use IconButtonComponent for icon-only actions.`, `Since: 1.0.0` and `See: https://design.example.com/buttons`, and the example in **Examples**.

### Which block describes a declaration

The doc block right above a declaration describes it. A line comment between the two, such as `// eslint-disable-next-line`, keeps the block attached. On a method, a property, a setup entry, a type and the class, a block that floats a few lines above, such as a section banner, and a block that is only a ruler (`/** ===== */`) describe nothing.

### Overloads and overrides

- **Overloads.** Each overload signature is a row of its own, and the implementation signature is left out. An overload with a doc block keeps it. One without takes the whole doc block of the implementation, then the description and `@param` texts of the first documented overload, then the doc block of the method in the nearest base class. From another overload it takes no tags: `@deprecated`, `@since`, `@see` and `@example` belong to the overload that carries them, so the overload that replaces a deprecated one is not marked deprecated with it. Documenting the implementation or the first overload is enough to give every row a description.
- **Overrides and redeclarations.** A member that a class inherits keeps the documentation of the base class. A redeclaration or an override with a doc block of its own takes everything from that block, even when it has no tags. One without keeps its own signature and takes the description, the tags and the `@param` texts of the nearest base class member that has them, as TypeScript does.

## Components and Directives

The API tab of a component or a directive is the same page as the one of a [service](#services) or a [pipe](#pipes): the same layout, type cards, links and "On this page" list. JSDoc on an `input()`, `model()` or `output()` declaration goes into the Inputs and Outputs tables, and JSDoc on a public method into Methods:

```typescript
/** One tab of a `TabsComponent`. */
export interface TabItem {
    /** Unique id, the value `activeTabId` holds and `tabChanged` emits. */
    id: string;
    /** Text on the tab. */
    label: string;
}

/**
 * Horizontal tab bar that switches between sections of a view.
 *
 * @since 1.0.0
 * @see TabItem
 */
export class TabsComponent {
    /** The tabs, in order, see {@link TabItem}. */
    readonly tabs = input.required<TabItem[]>();

    /** Id of the active tab. Two-way bindable with `[(activeTabId)]`. */
    readonly activeTabId = model<string>('');

    /** Emits the id of a tab when it is activated. */
    readonly tabChanged = output<string>();

    /**
     * Activates a tab as a click would.
     * @param tabId The `id` of the tab to activate
     */
    selectTab(tabId: string): void { ... }
}
```

The page is made of the sections Usage, Examples, Inputs, Outputs, Methods and Types, in this order, with an "On this page" list next to it; a section without content is left out. What each one shows:

- **Description and chips.** The class description as Markdown, then the chips `Deprecated` (with its message), `Version`, `Since`, `Entry point` (the import path of the entry point that exports the class, left out when the scanner could not place it) and one `See:` chip per `@see`.
- **Usage is generated,** not taken from you. It shows the import from the entry point, the `imports` entry of the component that uses the class and one line of template: the element of the selector (the first one of a list, `div` when the selector has none) and each required input as a binding to a member of the same name, `[tabs]="tabs"`, with the alias on the left when the input has one. A selector such as `button[libButton]` gives `<button libButton></button>`, and a custom element or a void element closes itself (`<input fxMask />`). A directive goes where its showcase puts it: on the element of the `host` of `@Showcase`, with the attributes of that `host` in front, otherwise on the element of its selector, otherwise on a `div`. A `host` component joins the import line and the `imports` entry. A showcase-level host template is the exception, see [Compositions](#compositions).
- **Inputs** list the name (the alias, when there is one, the name a template uses), the type as written with every name that has a card linked, the default as the code writes it (a string in quotes, an array or object as JSON, a `Date` as its day) and the description. A required input carries a `required` badge on its name.
- **Outputs** list the name (again the alias), the payload and the description. The payload is the type argument of `output<T>()` or `new EventEmitter<T>()` (or the annotation), `void` for an `output()` without one, and the column is left out when no output has a known payload. Every `model()` input adds one row for the change event Angular generates for it, `activeTabIdChange` here, with the type of the model and the description "Emits when `activeTabId` changes; bind both ways with `[(activeTabId)]`." The scanner has no output for it, so it is on the page only, not in `ScannedComponent.outputs`.
- **Methods** are the public methods that have a doc block, their own or one inherited from a base class. Undocumented methods are left out, since a component's public methods are often only there for its own template. The signature comes from the code, `@param` adds the description under its parameter, and an overloaded method has one row per overload signature, see [Overloads and overrides](#overloads-and-overrides). The same members are left out as on a service page: `private`, `protected` and `#private` members, names with a `_` prefix, lifecycle hooks, statics and `@internal`.
- **Types** hold one card per type that the types of the inputs, the payloads of the outputs and the signatures of the listed methods reach, recursively. A type gets a card when an entry point of the library exports it, whichever one and not only the component's own, and it is not tagged `@internal`; anything else, `Signal` or a type your library keeps to itself, stays text without a link. The cards work as on a service page, see [Services & Pipes › Types](guide/services-and-pipes.md#types). Each says where its type was first met, for example `type of variant`, `payload of tabChanged` or `parameter of focus()`.

Inputs, outputs and methods a component inherits from a base class are documented the same way: the plugin reads their JSDoc from the base classes the scanner found, so `@deprecated` and `@since` on an inherited input show up in the table as well, and [overrides](#overloads-and-overrides) follow the rule above. An inherited input that a generic base class declares in terms of its type parameters is shown as the component instantiates it: a `model<T>()` of a base class that the component extends as `Field<number>` is `number | undefined`, not `T`.

> The data behind the page (`ScannedComponent.api`) is experimental until 23.0.0. A plugin that reads it directly should expect it to change in a 22.x minor, see [`ComponentApi`](api/types.md#componentapi).

## Services

A class with `@Showcase` and `@Injectable` or `@Service` gets a page of its own under **Services** in the sidebar, and this plugin draws it. Without `jsDocPlugin()` the build leaves the services out and logs [a hint](api/build-warnings.md#no-plugin-shows-services). Which members the page lists, its sections and how the usage snippet is built are under [Services & Pipes](guide/services-and-pipes.md#the-page).

The page reads JSDoc by the rules above. For a service that means:

- **Chips:** `Deprecated`, `Since`, `Provided in` and `Entry point`, then the `See:` chips. `Provided in` says `root/automatically` for a service that provides itself and `providers` for one that needs a providers entry.
- **Signatures come from the code,** not from `@param` types or `@returns`: `@param` only adds the description of a parameter.
- **A setup entry** takes its description, its `@param` texts, its `@deprecated` message and its `@example` blocks from the doc block of the function or the token, and its option table takes the defaults from `@default` on each property. Prose such as "Defaults to `'bottom-right'`." is not read:

```typescript
/** App-wide defaults, set once with `provideNotifications()`. */
export interface NotificationConfig {
    /**
     * Where the notifications stack.
     * @default 'bottom-right'
     */
    position?: NotificationPosition;
}
```

> The data behind the page (`ScannedService.api`) is experimental until 23.0.0. A plugin that reads it directly should expect it to change in a 22.x minor, see [`ScannedService`](api/types.md#scannedservice).

## Pipes

A class with `@Showcase` and `@Pipe` gets a page of its own under **Pipes** in the sidebar, drawn by the same view, which applies to components, services and pipes. Without `jsDocPlugin()` the build leaves the pipes out and logs [a hint](api/build-warnings.md#no-plugin-shows-pipes). What the page lists, the template line of its usage snippet and how `transform()` is found are under [Services & Pipes](guide/services-and-pipes.md#transform).

For a pipe:

- **Chips:** `Deprecated`, `Pipe: <name>` (what a template calls it), `Pure` or `Impure` (left out when the purity cannot be read), `Since` and `Entry point`.
- **Transform** replaces Properties and Methods: one row per `transform()` signature, with its parameters, return type and description. An overload without a doc block of its own is documented by the rule under [Overloads and overrides](#overloads-and-overrides). Angular's own pipes document only the first overload, many libraries only the implementation: both give every row a description.
- **`@deprecated` on a signature** dims its row, and the usage snippet takes the first signature that is not deprecated.

> The data behind the page (`ScannedPipe.api`) is experimental until 23.0.0, see [`ScannedPipe`](api/types.md#scannedpipe).

## Links to Types

A reference in your JSDoc jumps to the card of a type on the same page (since 22.7.0), on the page of a component, a directive, a service and a pipe alike:

- **`@see X`** is a `See:` chip on the class or on a type card, and `X` is a button that scrolls to the card of `X` and lights it up. A `@see` that names no card, a URL included, stays plain text.
- **`{@link X}` and `{@link X | text}`** in any description the page renders: the class, inputs, outputs, methods and parameters, `setup` entries, the type cards and the message of a `@deprecated`. The text after the target, behind a bar or a space, is what the button says. `{@linkcode X}` and `{@linkplain X}` work the same way.

`X` has a card when it is one of the types of the page's Types section (in the JSDoc of a [part](#parts), of the Types section in the part's block): a type that the signatures of the page reach and that an entry point exports, see [Components and Directives](#components-and-directives). A type that exists but is not reached by anything on the page has no card. `X.member` and `X#member` jump to the card of `X`, since members have no anchor of their own. When two reachable types share a name, the second one's id is `name@importPath`. Only `@see Item@my-lib/atoms` can name it: TypeScript reads `{@link Item@my-lib/atoms}` as the target `Item` followed by the text `@my-lib/atoms`, so that link jumps to the first `Item`.

What a `{@link}` becomes when there is no card:

| Written                                   | Shown                                    |
| ----------------------------------------- | ---------------------------------------- |
| `{@link Unknown}`                         | `Unknown` as inline code                 |
| `{@link Unknown \| the item}`             | the item                                 |
| `{@link https://example.com \| the docs}` | a normal link to the URL, with that text |

A `{@link}` inside a Markdown code span stays as written.

## Markdown Support

Descriptions are Markdown. The class description, a setup entry and a type card are rendered as blocks; descriptions in a table cell and under a parameter are rendered inline (no wrapping `<p>`). Plain text is valid Markdown, so a description without any formatting shows as written.

```typescript
/**
 * Renders a status badge with configurable color and label.
 *
 * Use inside list items, table cells, and card headers.
 * Avoid using in body text; prefer inline `<strong>` elements.
 */
```

Supported syntax includes:

- Headings (`#`, `##`, `###`)
- Ordered and unordered lists
- Inline code (`` `code` ``), bold (`**text**`), italic (`*text*`)
- Links (`[text](url)`)
- Fenced code blocks with a language hint (` ```html `, ` ```typescript `)

````typescript
/**
 * Loading spinner component.
 *
 * ## Size
 *
 * - `small` (4px): inline indicators
 * - `large` (9px, default): section-level loading
 *
 * @example
 * ```html
 * <lib-loading size="small" color="light" />
 * ```
 */
````

> **Security:** descriptions bypass Angular's sanitizer, because their source is JSDoc that the library's authors wrote and the build compiled, not user input. Do not put untrusted content into JSDoc comments.

### Code Fences in `@example`

An `@example` block may start and end with a fenced code block. The language after the opening backticks (` ```html `) decides the highlighting. An example without a fence is highlighted as `typescript`:

````typescript
/**
 * @example
 * ```html
 * <lib-button label="Save" variant="filled" />
 * ```
 * @example
 * <lib-button label="Save" />  // no fence, highlighted as typescript
 */
````

The styleguide highlights two languages: `typescript` and `xml`, which also answers to `html`. No other language is registered, so write a fenced example in one of these two.

## Parts and compositions

### Parts

A [part](guide/parts.md) (`@Showcase({ partOf })`, since 22.7.0) has no page of its own, so the API tab of its parent documents it. After the parent's own sections comes **Parts**, with one block per part, in the order of their titles:

- **The head of a block** names the part by its title and its selector, for example `Option <lib-option>`.
- **The block is the part's own API page,** read by the same rules as the one of a [component](#components-and-directives): the description and chips, a usage snippet with the import of the part, Examples, Inputs, Outputs, Methods and Types. Its section headings are a level below the title of the part.
- **"On this page" gets a group Parts:** the title of each part and, under it, the sections of its block. The Types section of a part and its cards stay out of the list to keep it short. They are still in the block, and the signatures and JSDoc of the part link to them.
- **Links stay in their block.** A type in a part's signatures, a `@see` and a `{@link}` in its JSDoc jump to the card in the part's own block, never to a card of the parent or of another part, even when those have a type of the same name. See [Links to Types](#links-to-types).
- **A jump to a part** scrolls to its block and lights it up. While the code blocks above it are still filling in, the page keeps the block at the top, until you scroll yourself, with or without reduced motion. **Full API →** on the card of a part in the [component head](guide/parts.md#how-a-part-shows) does that, and so does a URL with `part`: `?component=SelectComponent&view=jsdoc&part=OptionComponent`. A link to the part itself, `?component=OptionComponent&view=jsdoc`, is [rewritten](guide/url-state.md#parts) to that URL.

The API panel sets [`listsParts`](api/ng-prism-plugin.md#panels-that-list-parts) for this, which is also what makes the core show **Full API →** at all. Services and pipes have no parts.

### Compositions

A showcase-level [host template](guide/compositions.md#host-template), `host: { template }` on `@Showcase`, changes the usage snippet of a component or a directive: it shows the subject inside that markup, as the first composed variant renders it, with the required inputs on the subject element, and the classes the template uses join the import line and the `imports` entry. The rest of the page documents the subject alone.

## Troubleshooting

- **A service or a pipe is missing from the sidebar.** No plugin in the config shows them, and the build logs [No plugin shows services](api/build-warnings.md#no-plugin-shows-services) or [No plugin shows pipes](api/build-warnings.md#no-plugin-shows-pipes). Add `jsDocPlugin()`, or update `@ng-prism/plugin-jsdoc` to the version of your `@ng-prism/core`.
- **The API tab has no type links, no Payload column and no Types section.** The component has no `ScannedComponent.api`: the scan could not read its API ([A component API that cannot be read](api/build-warnings.md#a-component-api-that-cannot-be-read)), or a plugin hook built the component. The page then falls back to `inputs`, `outputs` and the plugin's own data: Inputs and Outputs have no links and no Payload column, Methods are the documented ones, and there is no Types section.
- **A description or a tag does not show.** Check the [tag table](#supported-tags) for where the tag shows, and whether the block [describes the declaration](#which-block-describes-a-declaration).

## Related

- [Services & Pipes](guide/services-and-pipes.md): showcasing a service or a pipe, and what its page lists
- [Parts](guide/parts.md): `partOf` and how a part shows on its parent's page
- [`componentApi`](api/ng-prism-plugin.md#componentapi) and [`ComponentApi`](api/types.md#componentapi): the data behind the page
- [External Tooling API › Pages without a canvas](guide/external-tooling.md#pages-without-a-canvas): waiting for an API page from a script
