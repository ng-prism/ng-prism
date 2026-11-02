# Showcasing Services

A service is no component, so there is nothing to render. What a developer who uses your library needs from it is a reference: what it can do, how to bring it in, and what its setup function takes. ng-prism builds that page from the service itself (since `22.7.0`). Put `@Showcase` on a class with `@Injectable` or `@Service`, write JSDoc on what is public, and the service gets its own entry in the sidebar under **Services**, with the API read from the code and a generated usage snippet. No separate documentation files.

A service page has no canvas, no variants and no controls. It is the API page of a component, made for a class that has no template. A `@Pipe` gets the same kind of page, see [Showcasing Pipes](guide/showcasing-pipes.md).

> **Needs the JSDoc plugin.** The page is drawn by [`@ng-prism/plugin-jsdoc`](plugins/jsdoc.md). Without `jsDocPlugin()` in `ng-prism.config.ts`, nothing shows services, so the build leaves them out and says so once, see [Without the JSDoc plugin](#without-the-jsdoc-plugin).

## A first service

The service, with the function that configures it and the types they share:

````typescript
// notification.service.ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { Showcase } from '@ng-prism/core';
import { NotificationRef } from './notification-ref.js';
import { NotificationOptions } from './notification.model.js';
import { NOTIFICATION_CONFIG, provideNotifications } from './provide-notifications.js';

/**
 * Shows short messages in an overlay at the edge of the viewport, stacked newest first.
 *
 * - A notification closes after the configured duration (5000 ms by default), see `provideNotifications()`.
 * - `show()` returns a `NotificationRef`, so the caller can close that one notification early.
 *
 * @since 1.4.0
 * @example
 * ```ts
 * private readonly notifications = inject(NotificationService);
 *
 * save(): void {
 *     this.notifications.show({ message: 'Saved' });
 * }
 * ```
 */
@Showcase({
    title: 'Notification Service',
    category: 'Feedback',
    status: 'beta',
    setup: () => [provideNotifications]
})
@Injectable({ providedIn: 'root' })
export class NotificationService {
    private readonly config = inject(NOTIFICATION_CONFIG, { optional: true });

    /** How many notifications are open right now. */
    readonly count = computed(() => this.open().length);

    /**
     * Opens a notification. It closes by itself after its duration.
     * @param options What the notification shows and how long it stays.
     * @returns A handle to close this notification early.
     */
    show(options: NotificationOptions): NotificationRef {
        /* ... */
    }

    /** Closes every open notification. */
    dismissAll(): void {
        /* ... */
    }
}
````

```typescript
// notification.model.ts
/** Where on the screen notifications stack. */
export type NotificationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** App-wide defaults, set once with `provideNotifications()`. */
export interface NotificationConfig {
    /**
     * Where the notifications stack.
     * @default 'bottom-right'
     */
    position?: NotificationPosition;
    /**
     * Default time in milliseconds until a notification closes by itself.
     * @default 5000
     */
    duration?: number;
}
```

````typescript
// provide-notifications.ts
/**
 * Sets the app-wide defaults of `NotificationService`: where notifications stack and how long they stay.
 * Optional: without it they stack at the bottom right and close after 5000 ms.
 * @param config The defaults to override.
 * @example
 * ```ts
 * providers: [provideNotifications({ position: 'top-right', duration: 8000 })]
 * ```
 */
export function provideNotifications(config: NotificationConfig = {}): EnvironmentProviders {
    /* ... */
}
````

Export all of it from a library entry point, as you do for components, and run `ng run my-lib:prism`. The sidebar has a **Services** section with a **Notification Service** item. Its page shows, in this order:

1. The class description, with chips for `Since`, `Provided in` and `Entry point`.
2. **Usage**, generated, with a copy button:

    ```typescript
    import { NotificationService, provideNotifications } from 'my-lib';

    // app.config.ts
    providers: [provideNotifications()]

    // in a component or service
    private readonly notificationService = inject(NotificationService);
    ```

3. **Setup**: `provideNotifications(config?: NotificationConfig): EnvironmentProviders`, its description, its parameter as declared (`config: NotificationConfig = {}`) with its `@param` text, an option table (`position`, `duration`, each with its `@default`) and its `@example`.
4. **Examples**, from the `@example` of the class.
5. **Properties**: `count`, typed `Signal<number>`, readonly.
6. **Methods**: `show()` and `dismissAll()`, with parameters and their `@param` texts, return type and description.
7. **Types**: a card for `NotificationOptions`, `NotificationRef` (with its `readonly id`, a constructor parameter property), `NotificationConfig` and `NotificationPosition`, because the signatures above reach them.

A section with nothing in it is left out, together with its entry in the "On this page" list next to the content. Every type name in a table or a signature that has a card below is a link that jumps to it.

This is the `NotificationService` of the repository's demo library (`test-workspace/projects/test-lib`).

## What counts as a service

A class is a service when it

- is exported from a library entry point that the builder scans, like a component,
- carries `@Showcase`,
- carries `@Injectable` or `@Service` imported from `@angular/core`, and
- carries none of `@Component`, `@Directive` and `@Pipe`. A class with `@Component` or `@Directive` stays what it is, whatever else it has, and one with `@Pipe` is a [pipe](guide/showcasing-pipes.md), also when it is `@Injectable`.

`@Service` does not exist in Angular 20, and the builder does not need it to: it recognises the decorator in your source and imports nothing from `@angular/core`, so a library on Angular 20 with `@Injectable` works the same. `@ng-prism/core` keeps its peer dependency on `>=20.0.0`.

The import counts, not the name in your file. A `@Service()` from a dependency injection package (TypeDI has one) is not Angular's and makes no service. A decorator imported under another name is recognised by the one it has in `@angular/core`: with `import { Injectable as Service } from '@angular/core'`, `@Service({ providedIn: 'root' })` is Angular's `Injectable`, and its `providedIn` decides the provision. A namespace import works too: `@ng.Injectable()` and `@ng.Service()` with `import * as ng from '@angular/core'`.

A service is only listed when you mark it. There is no automatic discovery of every `@Injectable` in the library.

## Which `@Showcase` fields apply

| Field                                                                                    | On a service                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                                                                  | Required, as everywhere                                                                                                                                                         |
| `description`                                                                            | Shown in the head's details popover, behind the ⓘ glyph. The class JSDoc is the page's own text                                                                                 |
| `category`, `categoryOrder`, `componentOrder`                                            | Group and sort the item in the sidebar, as for components                                                                                                                       |
| `section`, `sectionOrder`                                                                | `section` defaults to `'Services'`, whose default `sectionOrder` is `20`, after Components and Directives                                                                       |
| `tags`                                                                                   | Searchable, and shown in the popover                                                                                                                                            |
| `status`                                                                                 | As for components: a status chip in the head, the dashed-circle marker for `'wip'` and a struck-through name for `'deprecated'` in the sidebar                                  |
| `meta`                                                                                   | For plugins, see [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned)                                                                                                  |
| [`setup`](#setup)                                                                        | The functions and tokens that configure the service. Services and pipes only                                                                                                    |
| `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports`, `renderPage` | Do not apply: a service has no canvas                                                                                                                                           |
| [`partOf`](guide/parts.md)                                                               | Does not apply: only a component or directive can be part of another. A warning drops it, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) fails the build over it |

The fields that do not apply have a consequence until 23.0.0 (deprecated since 22.7.0, removed in 23.0.0), see [Compatibility until 23.0.0](#compatibility-until-2300).

`setup` on a component or a directive is reported and dropped, since a component has no use for it. A [pipe](guide/showcasing-pipes.md) takes `setup` like a service does.

## How the service is provided

The scanner reads the options of the decorator to tell whether Angular provides the service on its own, which decides what the usage snippet says. The **Provided in** chip reads `root/automatically` or `providers`:

| Decorator                                                                 | Provided      | Usage snippet                      |
| ------------------------------------------------------------------------- | ------------- | ---------------------------------- |
| `@Service()`, `@Service({ autoProvided: true })`, `@Service({ factory })` | automatically | `inject()` only                    |
| `@Injectable({ providedIn: 'root' })`, `'platform'` or `'any'`            | automatically | `inject()` only                    |
| `@Service({ autoProvided: false })`, `@Injectable()` without `providedIn` | by hand       | `providers: [...]` plus `inject()` |

A `providedIn` that is a module class, and any option the scanner cannot read statically (a `let`, a function call), count as provided by hand. That prints no warning: a service nobody provides is a normal thing to document. `@Service({ factory })` gets no special treatment; it is shown like any other service.

## `setup`

`setup` (since `22.7.0`) lists the functions and `InjectionToken` constants that configure the service, such as `provideNotifications` and a `NOTIFICATION_CONFIG` token. They are not classes of their own, so they get no page. They appear as the **Setup** section of the service, each with its signature, description, `@example` and a table of its options, and the usage snippet calls them.

```typescript
@Showcase({
    title: 'Notification Service',
    setup: () => [provideNotifications, NOTIFICATION_CONFIG]
})
@Injectable({ providedIn: 'root' })
export class NotificationService {}
```

### Why a function

`setup` is an arrow function that returns the list, not the list itself. A `@Showcase` argument is evaluated when the class is defined, in every build of your library that does not run [`ng-prism-strip`](guide/library-publishing.md). A direct reference to `provideNotifications` would read a `const` from a file that itself imports the service, and a module cycle like that fails with a `ReferenceError` as soon as the library loads. The arrow function is never called, because `Showcase()` does nothing at runtime; it exists so the references are only touched if someone runs it. TypeScript still checks every reference in it, and renaming one in the IDE renames it here.

### What it may contain

The builder reads `setup` from the source, so it has to say what it lists:

- **The shape:** an arrow function whose body is an array literal, either the expression (`() => [provideX]`) or a block with a single `return [provideX];`. `as const`, a spread, a condition, a call or a reference to a constant that holds the list is not accepted.
- **The entries:** a function declaration, a `const` arrow or function expression, or a `const` of type `InjectionToken`. Written as a name or as a property access on an import (`toasts.provideToast`).
- **Exported:** each entry has to be exported from a scanned entry point, so the usage snippet knows what to import it from.
- **In the literal:** `setup` has to sit in the `@Showcase({ ... })` object itself. One that arrives through a spread or a constant (`@Showcase({ ...SHARED })`) is not read, and nothing is reported.

What fails costs only that: an entry that cannot be used is dropped with a warning and the others stay, and a `setup` of the wrong shape is dropped as a whole, since there is no telling what it would have listed. The warnings are in [Warnings](#warnings).

### The option table

For a function, the properties of its first parameter's object type become the option table: an interface, an object literal type or an object type alias, also inside `Partial<>`, `Required<>` and `Readonly<>`. `Partial<>` makes every option optional. For a token it is the properties of the type argument of the token. A first parameter that is a class, an array or a primitive gets no table, and neither does a token whose type argument is a class.

The defaults in the table come from `@default` on each property (`@default 'bottom-right'`). Prose such as "Defaults to bottom right." is not read.

## What the page shows

### Usage

The snippet is generated from the scanned API, not written by hand, so it says nothing about values:

- **Imports** are grouped by entry point, the service first. A service the scanner could not place in an entry point has no import line.
- **Setup entries** go into `providers: [...]` in `app.config.ts`. A function is called without arguments when every parameter is optional or a rest parameter, and with a `…` placeholder otherwise. A token becomes `{ provide: NOTIFICATION_CONFIG, useValue: … }`.
- **`inject()`** closes the snippet, with the class name, first letter in lower case, as the variable name.
- **A service provided by hand** without a setup function is shown in a `@Component` that lists it in `providers: [NotificationService]`. With a setup function, that line is left out: the setup function of such a service normally provides it, and listing it a second time would give every component its own silent second instance. If it is not provided after all, Angular reports a `NullInjectorError`, which is hard to miss. A `setup` of tokens only keeps the line, since a token never provides the service.

### Members

| Section        | What is listed                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Properties** | Public instance properties and getters: signals, `computed()`, readonly fields, accessors, and constructor parameter properties (`constructor(readonly id: number)`). Name, type, `readonly`, description. Listed without JSDoc as well, because the type alone is information |
| **Methods**    | Public instance methods, **with or without JSDoc**. Name, parameters as declared (type, optional, default, rest) with the `@param` text under each, return type, description                                                                                                   |

Methods are listed without JSDoc on purpose. That differs from the API tab of a component, which leaves undocumented methods out.

An overloaded method gets one row per overload signature, each with its own parameters and return type; the implementation signature is left out, since no caller can use it. An overload without a doc block of its own takes the one of the implementation, then the description and `@param` texts of the first documented overload (not its tags, so a `@deprecated` stays on the overload it is written on), then the one of the method in the nearest base class. Documenting the implementation or the first overload is enough.

Left out: `private`, `protected` and `#private` members, names that start with `_`, Angular's lifecycle hooks (`ngOnDestroy` and the others), the constructor itself, static members, and anything tagged `@internal`. A constructor parameter with `public`, `readonly` or `override` is a property: it is listed where the constructor stands, typed from its annotation or its default, and described by the constructor's `@param` for it. Members of base classes are included, nearest class first. A member the subclass declares hides the one of the base class; an override without JSDoc of its own keeps its signature and takes the description, tags and `@param` texts from the base class.

The type is the annotation as written, or what the compiler infers when there is none (`Signal<boolean>`).

### JSDoc that is read

| Tag                | Where it shows                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description        | Rendered as Markdown on the class; inline in tables                                                                                                                 |
| `@since`           | The `Since` chip of the class, a note next to a member                                                                                                              |
| `@deprecated`      | A badge, with the message after the colon                                                                                                                           |
| `@default`         | The **Default** column of an option or property table                                                                                                               |
| `@param name text` | Under the parameter, in **Methods** and below a setup signature (`@param name - text` works as well); on a constructor, the description of its parameter properties |
| `@example`         | A highlighted block, in **Examples** for the class and below the signature of a setup entry                                                                         |
| `@see`             | A `See:` chip on the class and on a type card. A name that has a card on the page is a button that jumps to it                                                      |
| `{@link X}`        | In any description: a jump to the card of `X`, else `X` as inline code or the link text, see [Links to Types](plugins/jsdoc.md#links-to-types) (since `22.7.0`)     |
| `@internal`        | Hides the member or the type altogether                                                                                                                             |

A line comment between the doc block and the member (`// eslint-disable-next-line`) keeps the doc block attached. A block that floats a few lines above the member, such as a banner, and a doc block that is only a ruler (`/** ===== */`) do not describe it.

### Types

Everything reached from the signatures gets a card in **Types**, recursively through members and type arguments (`Partial<X>`, `X[]`, `Readonly<X>`), once per type:

| A type that is                   | Its card shows                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| an `interface` or a type literal | A table of properties (type, `required`, `readonly`, `@default`, description) and its methods |
| a `class`                        | Its public properties (with `readonly`) and methods, as above                                 |
| a `type` of literals             | The union (`'top-left' \| 'top-right' ...`)                                                   |
| any other `type`                 | The aliased type as written                                                                   |
| an `enum`                        | Its members and values                                                                        |

A type is only documented when a scanned entry point exports it and it is not `@internal`. Anything else (`Signal`, `Observable`, `Provider`, a type your library keeps to itself) stays text without a link. Each card says where the type was first met (`parameter of show()`, `via config.position`).

## In the styleguide

- **Sidebar:** a **Services** section with a plug icon. Categories and order work as for components. The search finds a service by title, class name, category and tag. Navigation decorations (a11y, coverage, VRT) do not apply to services.
- **Head:** category, title, a status chip, and the details popover, which shows the class name, the description, how the service is provided (`Provided automatically` or `Needs a providers entry`) and the entry point to import it from.
- **View tabs:** only the panels that declare they apply to services, which today is the **API** tab of the JSDoc plugin. There is no Playground, no Overview and no addon panel area. The API tab does not follow you back: a component you select next opens on its Playground, as every component does. See [Writing a Plugin](plugins/writing-plugins.md#panels-for-services-and-pipes) to add a panel of your own.
- **URL:** `?service=NotificationService`, see [State Preservation](guide/url-state.md).

## Without the JSDoc plugin

A service page is made by a view panel that applies to services. When no plugin in `ng-prism.config.ts` has one, nothing could show the services, so the build only counts them, leaves them out of the manifest and the sidebar, and prints one notice per build or `serve` run:

```
ng-prism: 2 service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

It is a notice, not a warning: nothing is wrong with the library, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) does not fail the build over it. Since the services are not read, none of the [warnings](#warnings) below appear for them either, and `strictShowcase` cannot fail over one. Add the plugin with `ng add @ng-prism/plugin-jsdoc`, or see [JSDoc Plugin](plugins/jsdoc.md). If `jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer: an older one has no page for services.

## Compatibility until 23.0.0

> **Deprecated since 22.7.0, removed in 23.0.0.** Until then a class with a component-only field stays a component. See [Deprecation: injectables and pipes with component-only fields](guide/migration-v22.md#deprecation-injectables-and-pipes-with-component-only-fields).

A class with `@Showcase` and `@Injectable` was shown as a component before services existed, and with `renderPage` it had a working page. To keep that working in 22.x, a class with `@Injectable` or `@Service` that declares one of the fields only a component can use (`variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports`, `renderPage`) stays a component, as before. The build prints this notice:

```
⚠ ng-prism: ToastService is an @Injectable/@Service with @Showcase and declares variants, renderPage, so it is still treated as a component. From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.
```

It is a notice, so `strictShowcase` ignores it. To switch such a class to a service page now, remove those fields and move its demo to a [component page](guide/component-pages.md). The exception is deprecated since 22.7.0 and ends in 23.0.0: from then on the class is a service, and those fields are dropped.

## Warnings

The builder prints these while it scans. Each one is printed once per run, and `<Class>` is the service class:

```
⚠ ng-prism: <Class> › setup — "<source>" (<file>:<line>:<col>) must be an arrow function returning an array literal, e.g. setup: () => [provideX]; setup was dropped.
⚠ ng-prism: <Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is neither a function nor an InjectionToken; it was dropped.
⚠ ng-prism: <Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is not exported from any library entry point, so the styleguide cannot show where to import it from; it was dropped.
⚠ ng-prism: <Class> › setup (<file>:<line>:<col>) only applies to services and pipes (@Injectable, @Service or @Pipe); it was dropped.
⚠ ng-prism: <Class> › setup (<file>:<line>:<col>) was dropped: setup only applies to services and pipes, and the class is still a component because it declares <fields>.
```

The fourth is printed for a component, the fifth for a [legacy component](#compatibility-until-2300): an `@Injectable` or `@Service` that its component-only fields keep a component. All five are lost values, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns them into a build error. They only appear when a plugin shows services; without one the services are not read, see [Without the JSDoc plugin](#without-the-jsdoc-plugin).

Two more lines are notices, which `strictShowcase` ignores, like the notice for a [legacy component](#compatibility-until-2300) and the hint [without the JSDoc plugin](#without-the-jsdoc-plugin):

```
⚠ ng-prism: <Class>: could not read its API (<reason>); the service is left out of the styleguide.
⚠ ng-prism: <Class>: could not read its API for the API page (<reason>); the page falls back to its inputs and outputs.
```

The first means the scanner failed on the service and left it out, so that the other services and components still get their pages. The second is the same for a component, which keeps its page without type links. Neither is caused by your `@Showcase`; please report it with the class that triggers it. A `@Showcase` argument that cannot be read at all skips the service, with the same warning as a component. The [Claude Code skill](guide/ai-agents.md) lists each with its fix.

## Limits

- **Experimental data model.** The shape of the extracted API (`ServiceApi` and everything below it) is experimental until 23.0.0 and may change in a 22.x minor release. The upper fields of `ScannedService` and `RuntimeService`, the `onServiceScanned` hook and `PanelDefinition.appliesTo` are stable. See [Type Reference](api/types.md#scannedservice).
- **`@returns` text** is not shown. The return type comes from the code; say what it means in the description of the method.
- **Generic type parameters** and **static members** are not listed.
- **Renamed types.** A type imported or re-exported under another name appears under its declared name and may stay unlinked.
- **Renamed setup exports.** A setup function or token exported under another name (`export { impl as provideToast }`) is imported in the usage snippet under its declared name, which the entry point does not export. Export it under the name it is declared with.
- **No live demo.** A service has no playground. A hand-written [component page](guide/component-pages.md) still does that job.
- **Publishing.** [`ng-prism-strip`](guide/library-publishing.md) removes `@Showcase` from a service like from any class, `setup` included. The import of the setup function stays, as every other import does; nothing reads it any more, and the build is not affected.

## See also

- [Showcasing Pipes](guide/showcasing-pipes.md): the same page for a `@Pipe`
- [`ShowcaseConfig`](api/showcase-config.md#setup): `setup` in the field reference
- [JSDoc Plugin](plugins/jsdoc.md): the plugin that draws the page
- [Writing a Plugin](plugins/writing-plugins.md#panels-for-services-and-pipes): panels and hooks for services
