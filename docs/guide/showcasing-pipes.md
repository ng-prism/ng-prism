# Showcasing Pipes

A pipe is no component, so there is nothing to render either. What a developer needs from it is a reference: what it is called in a template, which arguments `transform()` takes, what comes back, whether it is pure and how to bring it in. ng-prism builds that page from the pipe itself (since `22.7.0`). Put `@Showcase` on a class with `@Pipe`, write JSDoc on `transform()`, and the pipe gets its own entry in the sidebar under **Pipes**, with the signatures read from the code and a generated usage snippet.

A pipe page is the page of a [service](guide/showcasing-services.md) with the members replaced by the signatures of `transform()`: no canvas, no variants, no controls, no live demo. Everything the two have in common (the JSDoc that is read, `setup`, the type cards, how the plugin draws it) is described on the services page and only linked here.

> **Needs the JSDoc plugin.** The page is drawn by [`@ng-prism/plugin-jsdoc`](plugins/jsdoc.md). Without `jsDocPlugin()` in `ng-prism.config.ts`, nothing shows pipes, so the build leaves them out and says so once, see [Without the JSDoc plugin](#without-the-jsdoc-plugin).

## A first pipe

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

Export all of it from a library entry point, as you do for components, and run `ng run my-lib:prism`. The sidebar has a **Pipes** section with a **Time Ago** item. Its page shows, in this order:

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

A section with nothing in it is left out, together with its entry in the "On this page" list. This is the `TimeAgoPipe` of the repository's demo library (`test-workspace/projects/test-lib`).

## What counts as a pipe

A class is a pipe when it

- is exported from a library entry point that the builder scans, like a component,
- carries `@Showcase`,
- carries `@Pipe` imported from `@angular/core`, and
- carries neither `@Component` nor `@Directive`. A class with one of those stays what it is, whatever else it has.

A class with `@Pipe` and `@Injectable` is a pipe. The decorator has to come from `@angular/core`, as for [services](guide/showcasing-services.md#what-counts-as-a-service): it is recognised by the name it has there, so `import { Pipe as NgPipe }` and `@ng.Pipe()` with `import * as ng from '@angular/core'` work too.

A pipe is only listed when you mark it. Two things about the pipe itself decide whether it can be shown:

- **`name` has to be readable.** It is what a template calls the pipe by. A string literal or a `const` works; anything the scanner cannot evaluate drops the pipe with a warning.
- **It has to be standalone.** The usage snippet puts the pipe into the `imports` of a component, which only works for a standalone pipe, the default since Angular 19. A pipe with `standalone: false` (declared in an NgModule) is dropped with a warning. Finding the module that declares it is not something ng-prism does.

`pure` is read from `@Pipe({ pure })` and is `true` when the decorator does not say. When it cannot be read (`pure: isPure`), the **Pure** / **Impure** chip is left out, without a warning.

## Which `@Showcase` fields apply

The same ones as for a service: `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `meta`, `status` and [`setup`](guide/showcasing-services.md#setup), which works exactly as it does there. `section` defaults to `'Pipes'`, whose default `sectionOrder` is `30`, after Components, Directives and Services. `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports` and `renderPage` do not apply, since a pipe has no canvas, with a consequence until 23.0.0, see [Compatibility until 23.0.0](#compatibility-until-2300). [`partOf`](guide/parts.md) does not apply either, since only a component or directive can be part of another: a warning drops it, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) fails the build over it.

## What the page shows

The class description, the tags, **Usage**, **Setup**, **Examples** and **Types** work as on the services page: see [JSDoc that is read](guide/showcasing-services.md#jsdoc-that-is-read), [Setup](guide/showcasing-services.md#setup) and [Types](guide/showcasing-services.md#types). What differs is Usage and Transform.

### Usage

Generated from the scanned API, so it says nothing about values:

- **Imports** are grouped by entry point, the pipe first. Setup entries follow, in the `providers: [...]` of `app.config.ts`, called without arguments when every parameter is optional and with a `…` placeholder otherwise. That block is left out when there is no `setup`.
- **The component** line shows the pipe in the `imports` of a component.
- **The template** line is built from the first signature of `transform()` that is not `@deprecated`, or from the first one when all are. Arguments are positional, so every parameter up to the last required one is kept, as `: name`. Optional and rest parameters after that are left out. `transform(value, pattern: string)` gives `{{ value | sgDate: pattern }}`, and `transform(value, zone = 'UTC', pattern: string)` gives `{{ value | sgDate: zone: pattern }}`, because `pattern` cannot be passed without `zone`.

### Transform

`transform()` is the only member a pipe page lists; properties and other methods do not appear. Each signature is one row, with its parameters as declared (type, optional, default, rest) and the `@param` text under each, the return type and the description.

- **Overloads.** Every overload signature gets its own row, with its own parameters and return type. The implementation signature is left out when there are overloads, since a template cannot call it. For a base that only exists as a `.d.ts` (e.g. `DatePipe`), every declared signature is listed, including a catch-all one.
- **Documentation per overload.** An overload with a doc block of its own keeps it. One without takes the doc block of the implementation, then the one of the first documented overload, then the one of a `transform()` of the nearest base class that has one. From another overload it takes the description and the `@param` texts but not the tags: `@deprecated`, `@since`, `@see` and `@example` are about the overload that carries them, so the overload that replaces a deprecated one is not marked deprecated with it. Angular's own pipes document only the first overload, many libraries only the implementation: both give every row a description.
- **No type annotations.** A `transform(value, count)` without them shows the types the compiler infers, `any` where TypeScript sees `any`.
- **Base classes.** A pipe without a `transform()` of its own takes it from the nearest base class, also one that only exists as a declaration, such as `class LocalDatePipe extends DatePipe {}` with `DatePipe` from `@angular/common`. Types from another package stay text without a card. Where no class in the chain has a `transform()`, the section is left out, without a warning.

The class description is the pipe's own JSDoc. A pipe without one does not take the description of its base class.

## In the styleguide

- **Sidebar:** a **Pipes** section with a pipette icon. Categories and order work as for components. The search finds a pipe by title, class name, template name (`timeAgo`), category and tag. Navigation decorations (a11y, coverage, VRT) do not apply to pipes.
- **Head:** category, title, a status chip, and the details popover, which shows the template name as code (`| timeAgo`), the description, whether the pipe is pure or impure and the entry point to import it from.
- **View tabs:** only the panels that declare they apply to pipes, which today is the **API** tab of the JSDoc plugin. No Playground, no Overview, no addon panel area. The API tab does not follow you back: a component you select next opens on its Playground, as every component does. See [Writing a Plugin](plugins/writing-plugins.md#panels-for-services-and-pipes) to add a panel of your own.
- **URL:** `?pipe=TimeAgoPipe`, see [State Preservation](guide/url-state.md).

## Without the JSDoc plugin

A pipe page is made by a view panel that applies to pipes. When no plugin in `ng-prism.config.ts` has one, the build only counts the pipes, leaves them out of the manifest and the sidebar, and prints one notice per build or `serve` run:

```
ng-prism: 2 pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

It is a notice, not a warning, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) does not fail the build over it. Since the pipes are not read, none of the [warnings](#warnings) below appear for them either. Add the plugin with `ng add @ng-prism/plugin-jsdoc`, or see [JSDoc Plugin](plugins/jsdoc.md). If `jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer: an older one has no page for pipes.

## Compatibility until 23.0.0

> **Deprecated since 22.7.0, removed in 23.0.0.** Until then a `@Pipe` class with a component-only field stays a component. See [Deprecation: injectables and pipes with component-only fields](guide/migration-v22.md#deprecation-injectables-and-pipes-with-component-only-fields).

A class with `@Showcase` and `@Pipe` was shown as a component before pipes had a page, and with `renderPage` it had a working one. To keep that working in 22.x, a `@Pipe` class that declares one of the fields only a component can use (`variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports`, `renderPage`) stays a component, as before. The build prints a notice:

```
⚠ ng-prism: LegacyPagePipe is a @Pipe with @Showcase and declares renderPage, so it is still treated as a component. From 23.0.0 it will be shown as a pipe and these fields will be dropped; remove them, or move the page to a componentPage.
```

For a pipe declared in an NgModule (`standalone: false`) the notice says what happens instead, since such a pipe is not shown at all from 23.0.0:

```
⚠ ng-prism: NgModulePagePipe is a @Pipe with @Showcase and declares renderPage, so it is still treated as a component. From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.
```

This rule is checked before anything is said about the pipe itself: a pipe with `standalone: false` or an unreadable `name` that has `renderPage` keeps its page in 22.x, and gets one of these notices rather than the warnings below. Both are notices, so `strictShowcase` ignores them. To switch such a class to a pipe page now, remove those fields and move its demo to a [component page](guide/component-pages.md).

## Warnings

The builder prints these while it scans, once per run. `<Class>` is the pipe class:

```
⚠ ng-prism: <Class> › @Pipe (<file>:<line>:<col>) is declared with standalone: false; ng-prism shows standalone pipes only, so it was dropped.
⚠ ng-prism: <Class> › @Pipe name (<file>:<line>:<col>) cannot be evaluated statically, so the pipe was dropped.
```

A pipe takes the `setup` warnings of services as well, see [Warnings](guide/showcasing-services.md#warnings). On a [legacy component](#compatibility-until-2300) the one for `setup` says why the class has no use for it: `<Class> › setup (<file>:<line>:<col>) was dropped: setup only applies to services and pipes, and the class is still a component because it declares <fields>.` All of these are lost values, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns them into a build error. They only appear when a plugin shows pipes, see [Without the JSDoc plugin](#without-the-jsdoc-plugin). The notice for a [legacy component](#compatibility-until-2300), the hint [without the JSDoc plugin](#without-the-jsdoc-plugin) and the notice `<Class>: could not read its API (<reason>); the pipe is left out of the styleguide.`, printed when the scanner fails on a pipe and goes on with the others, do not. A `@Showcase` argument that cannot be read at all skips the pipe, with the same warning as a component. The [Claude Code skill](guide/ai-agents.md) lists each with its fix.

## Limits

- **Experimental data model.** The shape of the extracted API (`PipeApi` and the `Api*` types below it) is experimental until 23.0.0 and may change in a 22.x minor release. The upper fields of `ScannedPipe` and `RuntimePipe`, the `onPipeScanned` hook and `PanelDefinition.appliesTo` are stable. See [Type Reference](api/types.md#scannedpipe).
- **Only `transform()`.** No other member of the pipe class is listed, and none contributes a type card.
- **`@returns` text** is not shown, as for services. The return type comes from the code.
- **Generic type parameters** are not listed. A `transform()` inherited from a generic base class shows the base's type parameters (`value: T`).
- **`transform` as a property.** A `transform` written as a property holding an arrow function is not read: the Transform section is left out and the template line has no arguments.
- **No live demo.** There is no playground and no evaluated input or output. The `@example` is the place to show a result.
- **No NgModule pipes.** See [What counts as a pipe](#what-counts-as-a-pipe).
- **Renamed types and setup exports** behave as on the services page, see [Limits](guide/showcasing-services.md#limits).
- **Publishing.** [`ng-prism-strip`](guide/library-publishing.md) removes `@Showcase` from a pipe like from any class.

## See also

- [Showcasing Services](guide/showcasing-services.md): the page this one builds on
- [`ShowcaseConfig`](api/showcase-config.md#setup): `setup` in the field reference
- [JSDoc Plugin](plugins/jsdoc.md): the plugin that draws the page
- [Writing a Plugin](plugins/writing-plugins.md#panels-for-services-and-pipes): panels and hooks for pipes
