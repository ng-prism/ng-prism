# JSDoc

`@ng-prism/plugin-jsdoc` extracts JSDoc comments from your component source files at build time and renders them as an API documentation panel in the showcase.

## What It Does

- Reads the JSDoc block above the component class and displays the class description
- Extracts `@deprecated`, `@since`, `@version`, `@see`, and `@example` tags
- Renders descriptions and examples as **Markdown** (since `21.13.0`)
- Draws the API tab of a [component or directive](#components-and-directives) as the same page as the one of a service or a pipe: a generated usage snippet, inputs with linked types, outputs with their payload, documented methods and the types they reach (since `22.7.0`)
- Draws the page of every [service](guide/showcasing-services.md) and [pipe](guide/showcasing-pipes.md) with `@Showcase`: its API, a generated usage snippet and the types it reaches (since `22.7.0`)
- Shows the full API of a component's [parts](#parts) in a block each on the component's API tab (since `22.7.0`)
- Turns `@see X` and `{@link X}` into a jump to the card of `X`, on all four kinds of page (since `22.7.0`), see [Links to Types](#links-to-types)
- Works purely at build time, with no runtime parsing of TypeScript source

## Install

```bash
ng add @ng-prism/plugin-jsdoc
```

This installs the package and registers `jsDocPlugin()` in your `ng-prism.config.ts` automatically. To install manually: `npm install @ng-prism/plugin-jsdoc` and add it to your config as shown below.

## Configuration

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin()]
});
```

The plugin adds an **API** tab to the view tabs of every component and directive, and the same tab is the whole page of a [service](#services) or a [pipe](#pipes). The tab is there without a single JSDoc comment, since the usage snippet and the signatures come from the code. A component you select next opens on its Playground, not on the API tab; a link with `view=jsdoc` opens the API tab directly.

## Supported Tags

| Tag                               | Rendering                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@description` (or block comment) | Rendered as block Markdown above the API table                                                                                          |
| `@deprecated`                     | Shown as a warning banner with the deprecation message                                                                                  |
| `@since`                          | Displayed as a version badge                                                                                                            |
| `@version`                        | A `Version` chip on a component or directive (since `22.7.0`)                                                                           |
| `@see`                            | A `See:` chip. A name that has a card on the page, like `@see TabItem`, is a button that jumps to it (since `22.7.0`), a URL stays text |
| `{@link X}`                       | In any rendered description: a jump to the card of `X`, or a link for a URL, see [Links to Types](#links-to-types) (since `22.7.0`)     |
| `@example`                        | Code block with syntax highlighting (language detected from the fence, see below)                                                       |

## Component-Level JSDoc

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

## Components and Directives

The API tab of a component or a directive is the same page as the one of a [service](#services) or a [pipe](#pipes): the same layout, type cards, links and "On this page" list (since `22.7.0`). What the tab showed before is all still there: the description with its Markdown, the chips, the examples, the inputs with their default, required marker and description, the outputs and the documented methods.

JSDoc on individual `input()`, `model()` and `output()` declarations is extracted into the Inputs and Outputs tables, and JSDoc on a public method into Methods:

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

- **Description and chips.** The class description as Markdown, then the chips `Deprecated` (with its message), `Version` (from `@version`), `Since`, `Entry point` (the import path of the entry point that exports the class, left out when the scanner could not place it) and one `See:` chip per `@see`.
- **Usage is generated,** not taken from you. It shows the import from the entry point, the `imports` entry of the component that uses the class and one line of template: the element of the selector (the first one of a list, `div` when the selector has none) and each required input as a binding to a member of the same name, `[tabs]="tabs"`, with the alias on the left when the input has one. A selector such as `button[libButton]` gives `<button libButton></button>`, and a void element closes itself (`<input fxMask />`). A directive goes where its showcase puts it: on the element of the `host` of `@Showcase`, with the attributes of that `host` in front, otherwise on the element of its selector, otherwise on a `div`. A `host` component joins the import line and the `imports` entry. A showcase-level [`host: { template }`](guide/directive-hosting.md#host-template) is the exception, for a component as well as for a directive (since `22.7.0`): the snippet shows the subject inside that markup, as the first composed variant renders it, with the required inputs on the subject element, and the classes the template uses join the import line and the `imports` entry.
- **Inputs** list the name (the alias, when there is one, the name a template uses), the type as written with every name that has a card linked, the default as the code writes it (a string in quotes, an array or object as JSON) and the description. A required input carries a `required` badge on its name (since `22.7.0`; the table had a column of its own before), `@deprecated` on the input is a badge there too, and `@since` a note after the description.
- **Outputs** list the name (again the alias), the payload and the description. The payload is the type argument of `output<T>()` or `new EventEmitter<T>()` (or the annotation), `void` for an `output()` without one, and the column is left out when no output has a known payload. Every `model()` input adds one row for the change event Angular generates for it, `activeTabIdChange` here, with the type of the model and the description "Emits when `activeTabId` changes; bind both ways with `[(activeTabId)]`." The scanner has no output for it, so it is on the page only, not in `ScannedComponent.outputs`.
- **Methods** are the public methods that have a doc block, their own or one inherited from a base class. Undocumented methods are left out, since a component's public methods are often only there for its own template. The signature comes from the code, `@param name text` adds the description under its parameter, an overloaded method has one row per overload signature as on a [service](#services), and the same members are left out as there: `private`, `protected` and `#private` members, names with a `_` prefix, lifecycle hooks, statics and `@internal`.
- **Types** hold one card per type that the types of the inputs, the payloads of the outputs and the signatures of the listed methods reach, recursively. A type gets a card when an entry point of the library exports it, whichever one and not only the component's own, and it is not tagged `@internal`; anything else, `Signal` or a type your library keeps to itself, stays text without a link. The cards work as on a service page, see [Showcasing Services: Types](guide/showcasing-services.md#types). Each says where its type was first met, for example `type of variant`, `payload of tabChanged` or `parameter of focus()`.

Inputs, outputs and methods a component inherits from a base class are documented the same way. The plugin reads their JSDoc from the base classes the scanner found, so `@deprecated` and `@since` on an inherited input show up in the table as well. A member the component redeclares with a JSDoc comment of its own takes its tags from that comment, even if it has none; a redeclaration or override without JSDoc keeps the documentation of the base class, as it does in TypeScript. An inherited input that a generic base class declares in terms of its type parameters is shown as the component instantiates it: a `model<T>()` of a base class that the component extends as `Field<number>` is `number | undefined`, not `T`.

The build reads the data behind the page, `ScannedComponent.api`, because `jsDocPlugin()` asks for it with [`componentApi`](api/ng-prism-plugin.md#componentapi); a config without the plugin skips that work. A component that has no `api` still gets the page, from `inputs`, `outputs` and the plugin's own data: that is a component whose API the scan could not read (the build prints a notice), one a plugin hook built, or one from the manifest of a core older than `22.7.0`. Its Inputs and Outputs have no links and no Payload column, its Methods are the documented ones, and there is no Types section. The links, the payloads and the cards come from the scanner, so they need `@ng-prism/core` 22.7.0 or newer as well as the plugin.

> The data behind the page (`ScannedComponent.api`) is experimental until 23.0.0. A plugin that reads it directly should expect it to change in a 22.x minor, see [`ComponentApi`](api/types.md#componentapi).

## Services

A class with `@Showcase` and `@Injectable` or `@Service` gets a page of its own under **Services** in the sidebar. The plugin draws it, which is why a service shows up at all only when `jsDocPlugin()` from 22.7.0 or newer is in the config: the page is a view panel of this plugin that applies to services. Without it, the build only counts the services, leaves them out and prints this once per build or `serve` run:

```
ng-prism: 2 service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

The page is the one a [component](#components-and-directives) gets too, and it reads your JSDoc by the same rules. What to know when you write one for a service:

- **Methods are listed with or without JSDoc.** A component's tab only lists methods that have a doc block. For a service the signature is information on its own, so every public method is there, and so is every public property, typed from the annotation or inferred (`Signal<boolean>`).
- **Overloads get one row each,** with their own parameters, and the implementation signature is left out. An overload without a doc block takes the one of the implementation, then the description and `@param` texts of the first documented overload (not its tags, so `@deprecated` stays where it is written), then the one of a base class.
- **Signatures come from the code,** not from `@param` and `@returns`. `@param name text` adds the description of a parameter, shown under it, and nothing else is needed for the types. A `@returns` text is not shown. On a constructor, `@param` describes its parameter properties (`constructor(readonly id: number)`), which are listed as properties.
- **`@see` shows as a chip,** a `See:` chip on the class and on each type card that has one. A name that has a card on the page is a button that jumps to it, see [Links to Types](#links-to-types).
- **Defaults come from `@default`.** The option tables of setup functions and interfaces show a **Default** column filled from `@default` on each property. Prose such as "Defaults to `'bottom-right'`." is not read.
- **`@internal` hides** a member or a type from the page.
- **Overrides inherit.** An override without a doc block of its own takes description, tags and `@param` texts from the nearest base class member that has them. A line comment between a doc block and the member (`// eslint-disable-next-line`) keeps the block attached.

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

The page is made of the sections Usage, Setup, Examples, Properties, Methods and Types, in this order, with an "On this page" list next to it; a section without content is left out. What is read, how `setup` and the usage snippet work and what the page leaves out is in [Showcasing Services](guide/showcasing-services.md).

> The data behind the page (`ScannedService.api`) is experimental until 23.0.0. A plugin that reads it directly should expect it to change in a 22.x minor, see [`ScannedService`](api/types.md#scannedservice).

## Pipes

A class with `@Showcase` and `@Pipe` gets a page of its own under **Pipes** in the sidebar, drawn by the same view panel, which applies to components, services and pipes. As for services, a pipe only shows up when `jsDocPlugin()` from 22.7.0 or newer is in the config. Without it, the build only counts the pipes, leaves them out and prints this once per build or `serve` run:

```
ng-prism: 2 pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

The page looks like the one of a service and reads the same JSDoc, with these differences:

- **Meta chips:** `Pipe: <name>` (what a template calls it), `Pure` or `Impure` (left out when the purity cannot be read), then `Since` and `Entry point`.
- **Usage** shows the imports, the `providers` entries of its `setup`, the component's `imports` entry and a template line such as `{{ value | timeAgo }}`, with the required arguments of the first signature that is not deprecated after the value.
- **Transform** replaces Properties and Methods: one row per `transform()` signature, with its parameters, return type and description. Every overload is listed with its own parameters, and the implementation signature is left out when there are overloads. An overload without a doc block takes the one of the implementation, then of the first documented overload (its description and `@param` texts, not its tags), then of a base class.
- **Nothing else of the class** is listed: properties and other methods do not appear, and add no type cards.

The page is made of the sections Usage, Setup, Examples, Transform and Types, in this order, with an "On this page" list; a section without content is left out. See [Showcasing Pipes](guide/showcasing-pipes.md).

> The data behind the page (`ScannedPipe.api`) is experimental until 23.0.0, see [`ScannedPipe`](api/types.md#scannedpipe).

## Parts

A [part](guide/parts.md) (`@Showcase({ partOf })`, since `22.7.0`) has no page of its own, so the API tab of its parent documents it. After the parent's own sections comes **Parts**, with one block per part, in the order of their titles:

- **The head of a block** names the part by its title and its selector, for example `Option <lib-option>`.
- **The block is the part's own API page,** read by the same rules as the one of a [component](#components-and-directives): the description and chips, a usage snippet with the import of the part, Examples, Inputs, Outputs, Methods and Types. Its section headings are a level below the title of the part.
- **"On this page" gets a group Parts:** the title of each part and, under it, the sections of its block. The Types section of a part and its cards stay out of the list to keep it short. They are still in the block, and the signatures and JSDoc of the part link to them.
- **Links stay in their block.** A type in a part's signatures, a `@see` and a `{@link}` in its JSDoc jump to the card in the part's own block, never to a card of the parent or of another part, even when those have a type of the same name. See [Links to Types](#links-to-types).
- **A jump to a part** scrolls to its block and lights it up. While the code blocks above it are still filling in, the page keeps the block at the top, until you scroll yourself, with or without reduced motion. **Full API →** on the card of a part in the [component head](guide/parts.md#how-a-part-shows) does that, and so does a URL with `part`: `?component=SelectComponent&view=jsdoc&part=OptionComponent`. A link to the part itself, `?component=OptionComponent&view=jsdoc`, is [rewritten](guide/url-state.md#parts) to that URL.

The API panel sets [`listsParts`](api/ng-prism-plugin.md#panels-that-list-parts) for this, which is also what makes the core show **Full API →** at all. Services and pipes have no parts.

## Links to Types

A reference in your JSDoc jumps to the card of a type on the same page (since `22.7.0`), on the page of a component, a directive, a service and a pipe alike:

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

## Class Description

The text before any tags in the JSDoc block is shown as the class description and rendered as Markdown.

```typescript
/**
 * Renders a status badge with configurable color and label.
 *
 * Use inside list items, table cells, and card headers.
 * Avoid using in body text; prefer inline `<strong>` elements.
 */
```

## Markdown Support

Class descriptions are rendered as block Markdown; input/output/method descriptions
are rendered inline (no wrapping `<p>`). Plain-text descriptions keep working unchanged, since
plain text is valid Markdown.

Supported syntax:

- Headings (`#`, `##`, `###`)
- Ordered and unordered lists
- Inline code (`` `code` ``), bold (`**text**`), italic (`*text*`)
- Links (`[text](url)`)
- Fenced code blocks with a language hint (` ```html `, ` ```scss `, ...)

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

### Code Fences in `@example`

`@example` blocks may start and end with a fenced code block. The language tag after the
opening backticks (e.g. ` ```html `) is passed to `ngx-highlightjs`. Examples without a
fence fall back to `typescript` for backwards compatibility:

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

Make sure the languages you reference are registered with `highlight.js` in your
application. Core languages ship by default; additional languages must be registered
explicitly in your consumer setup.

> **Security:** descriptions are bypassed past Angular's sanitizer because the source is
> component-author JSDoc compiled at build time, not user input. Do not put untrusted
> content into JSDoc comments.
