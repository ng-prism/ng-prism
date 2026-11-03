# Services & Pipes

A service or a pipe has no template, so there is nothing to render. What a developer who uses your library needs from it is a reference: what it can do, how to bring it in, and what its setup function takes. ng-prism builds that page from the class itself (since 22.7.0). Put `@Showcase` on a class with `@Injectable` or `@Service`, or with `@Pipe`, write JSDoc on what is public, and the class gets its own entry in the sidebar under **Services** or **Pipes**, with the API read from the code and a generated usage snippet. No separate documentation files.

A service or pipe page has no canvas, no variants and no controls. It is the API page of a component, made for a class without a template.

## Before you start

The page is drawn by the [JSDoc](plugins/jsdoc.md) plugin, `@ng-prism/plugin-jsdoc` 22.7.0 or newer: its API tab is a view panel that applies to services and pipes. Add it with:

```bash
ng add @ng-prism/plugin-jsdoc
```

Without such a panel in `ng-prism.config.ts`, nothing could show the services or the pipes. The build then only counts them, leaves them out of the manifest and the sidebar, and logs one hint per build or `serve` run, see [No plugin shows services](api/build-warnings.md#no-plugin-shows-services) and [No plugin shows pipes](api/build-warnings.md#no-plugin-shows-pipes). The hint does not count for [`strictShowcase`](api/ng-prism-config.md#strictshowcase), and since the classes are not read, none of their other messages appear either. If `jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc`: an older one has no page for services and pipes. How the build decides is under [Services and Pipes Gate](architecture/pipeline.md#_3-services-and-pipes-gate).

A service or a pipe is only listed when you mark it with `@Showcase`. There is no automatic discovery of every `@Injectable` or `@Pipe` in the library. Export it from a library entry point, as you do for components.

## Services

A class is a service when it

- is exported from a library entry point that the builder scans, like a component,
- carries `@Showcase`,
- carries `@Injectable` or `@Service` imported from `@angular/core`, and
- carries none of `@Component`, `@Directive` and `@Pipe`. A class with `@Component` or `@Directive` stays what it is, whatever else it has, and one with `@Pipe` is a [pipe](#pipes), also when it is `@Injectable`.

The import counts, not the name in your file. A `@Service()` from a dependency injection package (TypeDI has one) is not Angular's and makes no service. A decorator imported under another name is recognised by the one it has in `@angular/core`: with `import { Injectable as Service } from '@angular/core'`, `@Service({ providedIn: 'root' })` is Angular's `Injectable`, and its `providedIn` decides the provision. A namespace import works too: `@ng.Injectable()` and `@ng.Service()` with `import * as ng from '@angular/core'`.

### A first service

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

Export all of it from a library entry point and run `ng run my-lib:prism`. The sidebar has a **Services** section with a **Notification Service** item. Its page shows, in this order:

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

The repository's demo library (`test-workspace/projects/test-lib`) has this service, with a second overload of `show()`.

### How the service is provided

The scanner reads the options of the decorator to tell whether Angular provides the service on its own, which decides what the usage snippet says. The **Provided in** chip reads `root/automatically` or `providers`:

| Decorator                                                                 | Provided      | Usage snippet                      |
| ------------------------------------------------------------------------- | ------------- | ---------------------------------- |
| `@Service()`, `@Service({ autoProvided: true })`, `@Service({ factory })` | automatically | `inject()` only                    |
| `@Injectable({ providedIn: 'root' })`, `'platform'` or `'any'`            | automatically | `inject()` only                    |
| `@Service({ autoProvided: false })`, `@Injectable()` without `providedIn` | by hand       | `providers: [...]` plus `inject()` |

A `providedIn` that is a module class, and any option the scanner cannot read statically (a `let`, a function call), count as provided by hand. That prints no warning: a service nobody provides is a normal thing to document. `@Service({ factory })` gets no special treatment; it is shown like any other service. See [`ServiceProvision`](api/types.md#serviceprovision).

## Pipes

A class is a pipe when it

- is exported from a library entry point that the builder scans, like a component,
- carries `@Showcase`,
- carries `@Pipe` imported from `@angular/core`, and
- carries neither `@Component` nor `@Directive`. A class with one of those stays what it is, whatever else it has.

A class with `@Pipe` and `@Injectable` is a pipe. The decorator is recognised by the name it has in `@angular/core`, as for [services](#services), so `import { Pipe as NgPipe }` and `@ng.Pipe()` with `import * as ng from '@angular/core'` work too.

Two things about the pipe itself decide whether it can be shown:

- **`name` has to be readable.** It is what a template calls the pipe by. A string literal or a `const` works; anything the scanner cannot evaluate drops the pipe with a warning.
- **It has to be standalone.** The usage snippet puts the pipe into the `imports` of a component, which only works for a standalone pipe, Angular's default. A pipe with `standalone: false` (declared in an NgModule) is dropped with a warning. Finding the module that declares it is not something ng-prism does.

`pure` is read from `@Pipe({ pure })` and is `true` when the decorator does not say. When it cannot be read (`pure: isPure`), the **Pure** / **Impure** chip is left out, without a warning.

### A first pipe

The pipe, with the function that configures it and the types they share:

````typescript
// time-ago.pipe.ts
import { inject, Pipe, PipeTransform } from '@angular/core';
import { Showcase } from '@ng-prism/core';
import { provideTimeAgo, TIME_AGO_OPTIONS } from './provide-time-ago.js';
import { TimeAgoOptions } from './time-ago.model.js';

/**
 * Writes a point in time relative to now: `3 hours ago`, or `in 2 days` for a time ahead.
 *
 * - The value is a `Date`, a timestamp in milliseconds or a string `Date` can parse.
 * - A time less than a minute away reads `now`.
 * - The pipe is pure: it does not update while the page stays open.
 *
 * @since 1.5.0
 * @example
 * ```html
 * <span>{{ comment.createdAt | timeAgo }}</span>
 * <span>{{ comment.createdAt | timeAgo: { style: 'short' } }}</span>
 * ```
 */
@Showcase({
    title: 'Time Ago',
    category: 'Formatting',
    setup: () => [provideTimeAgo]
})
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
    private readonly defaults = inject(TIME_AGO_OPTIONS, { optional: true });

    /**
     * Writes the time relative to now, in the app-wide style.
     * @param value The point in time: a `Date`, a timestamp in milliseconds or a date string.
     * @returns The relative time, e.g. `3 hours ago`.
     */
    transform(value: Date | number | string): string;
    /**
     * Writes the time relative to now, in the style given for this call.
     * @param value The point in time: a `Date`, a timestamp in milliseconds or a date string.
     * @param options Overrides the app-wide options for this call.
     * @returns The relative time, e.g. `3 hr. ago`.
     */
    transform(value: Date | number | string, options: Partial<TimeAgoOptions>): string;
    transform(value: Date | number | string, options: Partial<TimeAgoOptions> = {}): string {
        /* ... */
    }
}
````

```typescript
// time-ago.model.ts
/** How the relative time is written: `3 hours ago` (long) or `3 hr. ago` (short). */
export type TimeAgoStyle = 'long' | 'short';

/** What `TimeAgoPipe` can be configured with, app-wide or for one call. */
export interface TimeAgoOptions {
    /**
     * How the relative time is written.
     * @default 'long'
     */
    style?: TimeAgoStyle;
}
```

````typescript
// provide-time-ago.ts
/**
 * Sets the app-wide defaults of `TimeAgoPipe`: how the relative time is written.
 * Optional: without it the pipe writes the long form, `3 hours ago`.
 * @param options The defaults to override.
 * @since 1.5.0
 * @example
 * ```ts
 * providers: [provideTimeAgo({ style: 'short' })]
 * ```
 */
export function provideTimeAgo(options: Partial<TimeAgoOptions> = {}): EnvironmentProviders {
    /* ... */
}
````

Export all of it from a library entry point and run `ng run my-lib:prism`. The sidebar has a **Pipes** section with a **Time Ago** item. Its page shows, in this order:

1. The class description, with chips for `Pipe: timeAgo`, `Pure`, `Since` and `Entry point`.
2. **Usage**, generated, with a copy button:

    ```typescript
    import { TimeAgoPipe, provideTimeAgo } from 'my-lib';

    // app.config.ts
    providers: [provideTimeAgo()]

    // in the component that uses it
    @Component({ imports: [TimeAgoPipe], … })

    // in its template
    {{ value | timeAgo }}
    ```

3. **Setup**: `provideTimeAgo(options?: Partial<TimeAgoOptions>): EnvironmentProviders`, with its description, its parameter, an option table (`style` with its `@default`) and its `@example`.
4. **Examples**, from the `@example` of the class.
5. **Transform**: one row per signature, here two: `transform(value)` and `transform(value, options)`, each with its parameters and their `@param` texts, the return type and its own description.
6. **Types**: a card for `TimeAgoOptions` and `TimeAgoStyle`, because the signatures above reach them.

This is the `TimeAgoPipe` of the repository's demo library (`test-workspace/projects/test-lib`).

## Which fields apply

| Field                                                                                    | On a service or a pipe                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                                                                  | Required, as everywhere                                                                                                                                                         |
| `description`                                                                            | Shown in the details popover of the head, behind the ⓘ glyph. The class JSDoc is the page's own text                                                                            |
| `category`, `categoryOrder`, `componentOrder`                                            | Group and sort the item in the sidebar, as for components                                                                                                                       |
| `section`, `sectionOrder`                                                                | `section` defaults to `'Services'`, whose default `sectionOrder` is `20`, or to `'Pipes'`, with `30`: after Components and Directives                                           |
| `tags`                                                                                   | Searchable, and shown in the popover                                                                                                                                            |
| `status`                                                                                 | As for components: a status chip in the head, the dashed-circle marker for `'wip'` and a struck-through name for `'deprecated'` in the sidebar                                  |
| `meta`                                                                                   | For plugins, see [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned) and [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned)                                      |
| [`setup`](#setup)                                                                        | The functions and tokens that configure the service or the pipe. Services and pipes only                                                                                        |
| `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports`, `renderPage` | Need a canvas. A class that declares one of them stays a component, with a notice (deprecated since 22.7.0, removed in 23.0.0)                                                  |
| [`partOf`](guide/parts.md)                                                               | Does not apply: only a component or directive can be part of another. A warning drops it, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) fails the build over it |

A class with `@Injectable`, `@Service` or `@Pipe` that declares one of the fields that need a canvas is shown as a component until 23.0.0. The build prints a notice that does not count for `strictShowcase`, see [A service that is still a component](api/build-warnings.md#a-service-that-is-still-a-component) and the two for pipes after it. Remove those fields to have it shown as a service or a pipe, and move a demo it needs to a [component page](guide/component-pages.md). What changes in 23.0.0 is under [Removed in 23.0.0](guide/upgrade-notes-22.md#removed-in-2300).

### `setup`

`setup` lists the functions and `InjectionToken` constants that configure the service or the pipe, such as `provideNotifications` and a `NOTIFICATION_CONFIG` token. They are not classes of their own, so they get no page. They appear in the **Setup** section of the page, each with its signature, description, `@example` and a table of its options, and the usage snippet calls them.

```typescript
@Showcase({
    title: 'Notification Service',
    setup: () => [provideNotifications, NOTIFICATION_CONFIG]
})
@Injectable({ providedIn: 'root' })
export class NotificationService {}
```

The builder reads `setup` from the source, so it has to be an arrow function that returns an array literal, written in the `@Showcase({ ... })` literal itself, and every entry has to be a function or an `InjectionToken` constant that a scanned entry point exports. Why it is a function and what exactly the builder accepts is in the [`setup`](api/showcase-config.md#setup) reference. An entry that cannot be used is dropped with a warning and the others stay; a `setup` of the wrong shape is dropped as a whole. On a component or a directive, `setup` is dropped with a warning. Every message is under [Build Warnings › Services and pipes](api/build-warnings.md#services-and-pipes).

## The page

A service page has the sections Usage, Setup, Examples, Properties, Methods and Types, in this order, and a pipe page Usage, Setup, Examples, Transform and Types. An "On this page" list sits next to the content. A section with nothing in it is left out, together with its entry in the list. Every type name in a table or a signature that has a card below is a link that jumps to it.

The page reads your JSDoc by the rules of the JSDoc plugin: the description as Markdown, `@since`, `@deprecated`, `@default`, `@param`, `@example`, `@see`, `{@link}` and `@internal`. Which tag shows where, and how an overload or an override finds its documentation, is under [JSDoc › Services](plugins/jsdoc.md#services) and [JSDoc › Pipes](plugins/jsdoc.md#pipes).

### Usage

The snippet is generated from the scanned API, not written by hand, so it says nothing about values:

- **Imports** are grouped by entry point, the service or the pipe first. A class the scanner could not place in an entry point has no import line.
- **Setup entries** go into `providers: [...]` in `app.config.ts`. A function is called without arguments when every parameter is optional or a rest parameter, and with a `…` placeholder otherwise. A token becomes `{ provide: NOTIFICATION_CONFIG, useValue: … }`. Without `setup` this block is left out.

For a service, `inject()` closes the snippet, with the class name, first letter in lower case, as the variable name. A service provided by hand without a setup function is shown in a `@Component` that lists it in `providers: [NotificationService]`. With a setup function, that line is left out: the setup function of such a service normally provides it, and listing it a second time would give every component its own silent second instance. If it is not provided after all, Angular reports a `NullInjectorError`, which is hard to miss. A `setup` of tokens only keeps the line, since a token never provides the service.

For a pipe, two lines follow: the pipe in the `imports` of a component, and a template line. The template line is built from the first signature of `transform()` that is not `@deprecated`, or from the first one when all are. Arguments are positional, so every parameter up to the last required one is kept, as `: name`. Optional and rest parameters after that are left out. `transform(value, pattern: string)` gives `{{ value | sgDate: pattern }}`, and `transform(value, zone = 'UTC', pattern: string)` gives `{{ value | sgDate: zone: pattern }}`, because `pattern` cannot be passed without `zone`.

### Option tables

For a setup function, the properties of its first parameter's object type become the option table: an interface, an object literal type or an object type alias, also inside `Partial<>`, `Required<>` and `Readonly<>`. `Partial<>` makes every option optional. For a token it is the properties of the type argument of the token. A first parameter that is a class, an array or a primitive gets no table, and neither does a token whose type argument is a class.

The defaults in the table come from `@default` on each property (`@default 'bottom-right'`). Prose such as "Defaults to bottom right." is not read.

### Members

A service page lists the public members of the class:

| Section        | What is listed                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Properties** | Public instance properties and getters: signals, `computed()`, readonly fields, accessors, and constructor parameter properties (`constructor(readonly id: number)`). Name, type, `readonly`, description. Listed without JSDoc as well, because the type alone is information |
| **Methods**    | Public instance methods, **with or without JSDoc**. Name, parameters as declared (type, optional, default, rest) with the `@param` text under each, return type, description                                                                                                   |

Methods are listed without JSDoc on purpose. That differs from the API tab of a component, which leaves undocumented methods out. An overloaded method gets one row per overload signature, each with its own parameters and return type; the implementation signature is left out, since no caller can use it.

Left out: `private`, `protected` and `#private` members, names that start with `_`, Angular's lifecycle hooks (`ngOnDestroy` and the others), the constructor itself, static members, and anything tagged `@internal`. A constructor parameter with `public`, `readonly` or `override` is a property: it is listed where the constructor stands, typed from its annotation or its default, and described by the constructor's `@param` for it. Members of base classes are included, nearest class first. A member the subclass declares hides the one of the base class.

The type is the annotation as written, or what the compiler infers when there is none (`Signal<boolean>`).

### Transform

`transform()` is the only member a pipe page lists; properties and other methods do not appear, and add no type cards. Each signature is one row, with its parameters as declared (type, optional, default, rest) and the `@param` text under each, the return type and the description.

- **Overloads.** Every overload signature gets its own row, with its own parameters and return type. The implementation signature is left out when there are overloads, since a template cannot call it. For a base that only exists as a `.d.ts` (e.g. `DatePipe`), every declared signature is listed, including a catch-all one.
- **No type annotations.** A `transform(value, count)` without them shows the types the compiler infers, `any` where TypeScript sees `any`.
- **Base classes.** A pipe without a `transform()` of its own takes it from the nearest base class, also one that only exists as a declaration, such as `class LocalDatePipe extends DatePipe {}` with `DatePipe` from `@angular/common`. Types from another package stay text without a card. Where no class in the chain has a `transform()`, the section is left out, without a warning.

The class description is the pipe's own JSDoc. A pipe without one does not take the description of its base class.

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

- **Sidebar:** a **Services** section with a plug icon and a **Pipes** section with a pipette icon. Categories and order work as for components. The search finds a service by title, class name, category and tag, and a pipe also by its template name (`timeAgo`). Navigation decorations (a11y, coverage, VRT) do not apply to services and pipes.
- **Head:** category, title, a status chip, and the details popover. For a service it shows the class name, the description, how the service is provided (`Provided automatically` or `Needs a providers entry`) and the entry point to import it from; for a pipe the template name as code (`| timeAgo`), the description, whether the pipe is pure or impure and the entry point.
- **View tabs:** only the panels that declare they apply to services or to pipes, which today is the **API** tab of the JSDoc plugin. There is no Playground, no Overview and no addon panel area. The API tab does not follow you back: a component you select next opens on its Playground, as every component does. See [Panels for services and pipes](plugins/writing-plugins.md#panels-for-services-and-pipes) to add a panel of your own.
- **URL:** `?service=NotificationService` and `?pipe=TimeAgoPipe`, see [Links & State](guide/url-state.md).

## Limits

- **Experimental data model.** The shape of the extracted API (`ServiceApi`, `PipeApi` and the `Api*` types below them) is experimental until 23.0.0 and may change in a 22.x minor release. The upper fields of `ScannedService`, `ScannedPipe`, `RuntimeService` and `RuntimePipe`, the hooks `onServiceScanned` and `onPipeScanned` and `PanelDefinition.appliesTo` are stable. See [API model](api/types.md#api-model).
- **`@returns` text** is not shown. The return type comes from the code; say what it means in the description of the method.
- **Generic type parameters** and **static members** are not listed. A `transform()` inherited from a generic base class shows the base's type parameters (`value: T`).
- **`transform` as a property.** A `transform` written as a property holding an arrow function is not read: the Transform section is left out and the template line has no arguments.
- **Renamed types.** A type imported or re-exported under another name appears under its declared name and may stay unlinked.
- **Renamed setup exports.** A setup function or token exported under another name (`export { impl as provideToast }`) is imported in the usage snippet under its declared name, which the entry point does not export. Export it under the name it is declared with.
- **No NgModule pipes.** See [Pipes](#pipes).
- **No live demo.** A service or a pipe has no playground and no evaluated input or output. The `@example` is the place to show a result; a hand-written [component page](guide/component-pages.md) can show the service at work.
- **An API that cannot be read.** When the scanner fails on a service or a pipe, it leaves that class out with a notice, so that the others still get their pages. Nothing in `@Showcase` causes it; report it with the class, see [A service or pipe whose API cannot be read](api/build-warnings.md#a-service-or-pipe-whose-api-cannot-be-read).
- **Publishing.** [`ng-prism-strip`](guide/library-publishing.md) removes `@Showcase` from a service or a pipe like from any class, `setup` included. The import of the setup function stays, as every other import does; nothing reads it any more, and the build is not affected.

## Related

- [`setup`](api/showcase-config.md#setup) and [Services and pipes](api/showcase-config.md#services-and-pipes) in the ShowcaseConfig reference
- [JSDoc](plugins/jsdoc.md): the plugin that draws the page, and the JSDoc it reads
- [`ScannedService`](api/types.md#scannedservice) and [`ScannedPipe`](api/types.md#scannedpipe) in Types
- [Build Warnings › Services and pipes](api/build-warnings.md#services-and-pipes): every message with its cause and fix
- [Writing a Plugin](plugins/writing-plugins.md#panels-for-services-and-pipes): panels and hooks for services and pipes
