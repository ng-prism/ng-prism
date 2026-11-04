# Build Warnings

Every message the builders print at build time, with its cause and its fix. They come from the `serve` and `build` builders while they load the config, scan the library, run the plugins' build hooks and write the manifest. Messages that the styleguide prints in the browser console are not listed here.

## How messages look

A message about a `@Showcase` value names the class, the path to the value, the source text and its file, line and column, relative to the working directory, so that a terminal or an editor can open it. A variant or a state is named by its index and its `name`:

```
⚠ ng-prism: FileInputComponent › variants[3] "Auto hint" › inputs.maxFileSize — "megabytes(5)" (projects/my-lib/src/file-input/file-input.component.ts:27:52) cannot be evaluated statically and was dropped.
```

In the messages below, `<…>` stands for what the build fills in, such as `<Class>`, `<path>` or `<file>:<line>:<col>`. A `<tag>` is printed with its angle brackets, as in `<input>`.

| Prefix                                | Printed for                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `⚠ ng-prism: `                        | Diagnostics and notices, on the console                                                                                |
| `ng-prism: `                          | The builder's log: hints, status lines, and the errors that stop a run                                                 |
| `[ng-prism] `                         | One warning of the manifest generator, see [A host string that cannot be parsed](#a-host-string-that-cannot-be-parsed) |
| `ng-prism/plugin-visual-regression: ` | The [Visual Regression](plugins/visual-regression.md) plugin                                                           |

Each message has one of these kinds:

- **Diagnostic:** the scan dropped a `@Showcase` value, or a whole class. With [`strictShowcase`](api/ng-prism-config.md#strictshowcase) on, the build fails after the scan, see [strictShowcase stopped the build](#strictshowcase-stopped-the-build).
- **Notice:** something worth knowing, but nothing in `@Showcase` was lost. It never fails the build.
- **Hint:** an info line of the builder's log, logged once per builder run.
- **Error:** stops `build`, and stops `serve` before the dev server starts. During a rescan of `serve` it is logged as [A re-scan failed](#a-re-scan-failed) instead, and the previous manifest stays.
- **Log:** a status line.

Diagnostics and notices are printed once per scan, however many entry points export the class. `serve` scans again after every change, so it prints them again. A service or a pipe is only read when a plugin shows services or pipes, so their messages only appear then, see [Services and pipes](#services-and-pipes).

Under each message: its kind, the source file that prints it (relative to `packages/ng-prism/src/` unless it starts with `packages/`), the cause and the fix.

### The manifest is written

```
ng-prism: Generated manifest with <n> component(s), <n> service(s), <n> pipe(s) and <n> page(s) at <path>
ng-prism: Verified (unchanged) manifest with <n> component(s) at <path>
```

Log · `builder/shared/prism-pipeline.ts`

- **Cause:** the end of every run. `Generated` means the manifest changed and was written, `Verified (unchanged)` that it was the same and left alone. Services, pipes and pages are named only when there are some, and the components count parents, not their parts.
- **Fix:** none needed.

### Watching for changes

```
ng-prism: Watching <paths> for changes...
ng-prism: Change detected, re-scanning...
ng-prism: Re-scan complete.
```

Log · `builder/watcher/prism-watcher.ts`

- **Cause:** `serve` has started its watcher, and rescans after a change. What it watches is under [Builders › Watching and reloading](api/builders.md#watching-and-reloading).
- **Fix:** none needed.

### A re-scan failed

```
ng-prism: Re-scan failed: <message>
```

Error, logged · `builder/watcher/prism-watcher.ts`

- **Cause:** an error stopped a rescan of `serve`, such as [strictShowcase](#strictshowcase-stopped-the-build) or [a plugin hook](#a-plugin-hook-failed). The dev server keeps running with the previous manifest.
- **Fix:** fix what `<message>` names and save; the next change rescans.

### The watcher failed

```
ng-prism: Watcher error: <message>
```

Error, logged · `builder/watcher/prism-watcher.ts`

- **Cause:** the file watcher of `serve` reported an error from the file system. Changes may stop triggering a rescan.
- **Fix:** restart `serve`. If it comes back, `<message>` names the cause.

## @Showcase values

The scan reads `@Showcase` from the source without running it, see [What the Scanner Reads](guide/scanner-reads.md), and checks every field against [ShowcaseConfig](api/showcase-config.md). What it cannot use, it drops with one of these messages. The same checks run on a service or a pipe, once a plugin shows them.

### A value that cannot be evaluated

```
⚠ ng-prism: <Class> › <path> — "<source>" (<file>:<line>:<col>) cannot be evaluated statically and was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the value is an expression the scan cannot fold, such as a function call, a ternary, `??` or a comparison. Only that property, array element or spread is lost; the object or array around it keeps the rest. A value inside a constant is reported where the constant writes it, also in another file. When a reference is what failed, the message ends with the reason:
    - `: <name> is declared with let; only const declarations can be read`, or `with var`
    - `: <name> is declared without a value, as in a .d.ts file or with declare`
    - `: <name> refers back to itself`
    - `: <name> is a function or class, which only exists at runtime`
    - `: new Date() is the current time, which differs in every build`, for a constant that holds `new Date()`
    - `: new Date(…) is an invalid date`, for a constant that holds one
- **Fix:** write the value out, such as `maxFileSize: 5 * 1024 * 1024` instead of `megabytes(5)`, or keep it in a `const` built from literals, enum members and arithmetic.

### A runtime value

```
⚠ ng-prism: <Class> › <path> — "<source>" (<file>:<line>:<col>) is a runtime value (function, class or instance) and cannot be part of the static manifest; it was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** an arrow function, a function or class expression, a `new …` other than a `new Date(…)`, or a method in an object literal. The manifest is static data and cannot hold it.
- **Fix:** remove it. A demo that needs code renders through a [component page](guide/component-pages.md); `setup` on a service or a pipe is the one function the scan reads, see [`setup`](api/showcase-config.md#setup).

### The current time

```
⚠ ng-prism: <Class> › <path> — "new Date()" (<file>:<line>:<col>) is the current time, which differs in every build and every visual regression run, so it was dropped; write the date out instead, such as new Date(2026, 3, 28).
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** `new Date()` without arguments (since 22.8.0). A variant would show a different moment in every build, and a visual regression baseline would never match.
- **Fix:** write the date out, see [Dates](guide/variants.md#dates).

### An invalid date

```
⚠ ng-prism: <Class> › <path> — "<source>" (<file>:<line>:<col>) is an invalid date and was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the arguments of a `new Date(…)` make no valid date, such as `new Date('soon')` (since 22.8.0).
- **Fix:** write a date the `Date` constructor reads, such as `new Date('2026-04-28')` or `new Date(2026, 3, 28)`.

### An argument that cannot be evaluated

```
⚠ ng-prism: <Class> › @Showcase — "<source>" (<file>:<line>:<col>) cannot be evaluated statically, so the component is skipped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the argument of `@Showcase(…)` as a whole cannot be read, as in `@Showcase(buildShowcase('File input'))`. The class is left out of the styleguide. The message can end with a reason, as above.
- **Fix:** write the object literally, or keep it in a `const` and pass that: `@Showcase(FILE_INPUT_SHOWCASE)` works.

### No title

```
⚠ ng-prism: <Class> has @Showcase without a "title" field, skipping. Add a title so it can appear in the styleguide.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** the argument has no [`title`](api/showcase-config.md#title). The class is left out of the styleguide.
- **Fix:** add a `title`.

### Providers in @Showcase

```
⚠ ng-prism: <Class> declares @Showcase providers (<file>:<line>:<col>), which are deprecated and will be removed in 23.0.0; the manifest is static and cannot hold them, so they never reach the styleguide. Use defineConfig({ appProviders }) instead.
```

Diagnostic, one per class · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** [`providers`](api/showcase-config.md#providers), deprecated since 22.4.0, removed in 23.0.0. A provider is a class, a factory or an instance, which never reached the styleguide.
- **Fix:** move the providers into the root injector of the styleguide app, through [`appProviders`](api/ng-prism-config.md#appproviders) or the `providers` of its `main.ts`. For a provider only one component may see, render it through a [component page](guide/component-pages.md) that declares the provider.

### An invalid status

```
⚠ ng-prism: <Class> declares invalid status "<value>", expected one of: stable, beta, wip, deprecated. Skipping.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** [`status`](api/showcase-config.md#status) is none of the four values. The class shows no status.
- **Fix:** use one of the four, or leave `status` out.

### An invalid background

```
⚠ ng-prism: <Class> declares invalid bg "<value>", expected one of: dots, plain, light, dark, checker, transparent. Skipping.
⚠ ng-prism: <Class> variant "<name>" declares invalid bg "<value>", expected one of: dots, plain, light, dark, checker, transparent. Skipping.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** [`bg`](api/showcase-config.md#bg) of the class or of a variant is none of the six values.
- **Fix:** use `dots`, `plain`, `light`, `dark` or `transparent`.

### The checker background

```
⚠ ng-prism: <Class> declares bg "checker", which is deprecated and will be removed in 23.0.0; use 'transparent' for the same look with a capture that keeps its alpha, or 'light'/'dark' for an absolute colour.
⚠ ng-prism: <Class> variant "<name>" declares bg "checker", which is deprecated and will be removed in 23.0.0; use 'transparent' for the same look with a capture that keeps its alpha, or 'light'/'dark' for an absolute colour.
```

Notice · `builder/scanner/component.scanner.ts`

- **Cause:** `bg: 'checker'`, deprecated since 22.2.0, removed in 23.0.0, see [`bg`](api/showcase-config.md#bg). The value still works.
- **Fix:** use `'transparent'`, or `'light'` or `'dark'` for an absolute colour.

### An invalid canvas layout

```
⚠ ng-prism: <Class> declares invalid canvasLayout "<value>", expected one of: fit, stretch. Skipping.
⚠ ng-prism: <Class> variant "<name>" declares invalid canvasLayout "<value>", expected one of: fit, stretch. Skipping.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** [`canvasLayout`](api/showcase-config.md#canvaslayout) of the class or of a variant is neither `'fit'` nor `'stretch'`.
- **Fix:** use `'fit'` or `'stretch'`.

### States that are not a list

```
⚠ ng-prism: <Class> declares invalid states <value>, expected a list of { name, pseudo }. Skipping.
```

Diagnostic · `builder/scanner/showcase-states.ts`

- **Cause:** [`states`](api/showcase-config.md#states) is not an array. The class has no states.
- **Fix:** write `states: [{ name: 'Hover', pseudo: { hover: '.btn' } }]`.

### A state that is not an object

```
⚠ ng-prism: <Class> states[<i>] is <value>, expected { name, pseudo }. Its column stays empty.
```

Diagnostic · `builder/scanner/showcase-states.ts`

- **Cause:** an entry of `states` is not an object. It keeps its place as an empty state that forces nothing, so the states behind it keep their index.
- **Fix:** write the entry as `{ name, pseudo }`.

### A state without a name

```
⚠ ng-prism: <Class> states[<i>] has no name, expected a non-empty string. Calling it "State <n>".
```

Diagnostic · `builder/scanner/showcase-states.ts`

- **Cause:** an entry has no `name`, or an empty one. It works under the name `State <n>`, its position counted from 1.
- **Fix:** give it a `name`.

### A repeated state name

```
⚠ ng-prism: <Class> state "<name>" repeats the name of states[<i>]; only the first one is used. Its column stays empty.
```

Diagnostic · `builder/scanner/showcase-states.ts`

- **Cause:** two entries have the same `name`. The later one becomes an empty state.
- **Fix:** give each state a name of its own.

### A state without pseudo states

```
⚠ ng-prism: <Class> state "<name>" declares no pseudo states. Its column stays empty.
```

Diagnostic · `builder/scanner/showcase-states.ts`

- **Cause:** the entry has no `pseudo`, or an empty one. It stays as an empty state.
- **Fix:** add the pseudo states it forces, such as `pseudo: { hover: '.btn' }`.

### States next to renderPage

```
⚠ ng-prism: <Class> declares states together with renderPage; a component page has no Overview to show them in. Skipping states.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** the class has both [`states`](api/showcase-config.md#states) and [`renderPage`](api/showcase-config.md#renderpage). A component page has no Overview.
- **Fix:** use one of the two. A component that needs states renders itself; markup around it goes into a variant [`template`](api/showcase-config.md#template) or a host template.

### A variant's states other than false

```
⚠ ng-prism: <Class> variant "<name>" declares invalid states <value>, expected false. Skipping.
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** a variant's `states` is anything but `false`, the only value it takes.
- **Fix:** write `states: false` to keep the variant out of the states, or delete it.

### Pseudo states that are not an object

```
⚠ ng-prism: <Class> variant "<name>" declares invalid pseudo <value>, expected an object mapping pseudo states to true or selectors. Skipping.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** a variant's [`pseudo`](api/showcase-config.md#pseudo), or a state's, is not an object. For a state the message starts with `<Class> state "<name>"`, and the state forces nothing.
- **Fix:** write `pseudo: { hover: true }` or `pseudo: { hover: '.btn' }`.

### An unknown pseudo state

```
⚠ ng-prism: <Class> variant "<name>" declares unknown pseudo state "<state>", expected one of: hover, active, focus, focus-visible, focus-within. Skipping.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** a key of `pseudo` is none of the five pseudo states. The others stay. For a state the message starts with `<Class> state "<name>"`.
- **Fix:** use one of the five.

### An empty selector

```
⚠ ng-prism: <Class> variant "<name>" declares pseudo state "<state>" with an empty selector. Skipping.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** the target of a pseudo state is `''` or only spaces.
- **Fix:** write a selector, or `true` for every element of what is rendered.

### An invalid selector in a list

```
⚠ ng-prism: <Class> variant "<name>" declares pseudo state "<state>" with <values> in its selector list, expected non-empty strings. Skipping it.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** a list of selectors holds something that is no non-empty string. Those entries are dropped (`Skipping them.` for several), the other selectors stay.
- **Fix:** list only selectors.

### An empty selector list

```
⚠ ng-prism: <Class> variant "<name>" declares pseudo state "<state>" with an empty selector list. Skipping.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** the target is `[]`.
- **Fix:** list at least one selector, or write `true`.

### An invalid pseudo target

```
⚠ ng-prism: <Class> variant "<name>" declares pseudo state "<state>" with invalid target <value>, expected true, a selector or a list of selectors. Skipping.
```

Diagnostic · `builder/scanner/pseudo-states.ts`

- **Cause:** the target is neither `true`, a selector nor a list of selectors, such as `false` or a number.
- **Fix:** write `true`, a selector or a list of selectors. Whether a selector parses is up to the browser, which warns when the variant renders.

## Parts

The messages of `partOf` (since 22.7.0): six diagnostics and one notice. After a diagnostic, `partOf` is dropped and the class keeps a page of its own, with everything it declares. Each message ends with the location of `partOf` or of the field. The rules are under [`partOf`](api/showcase-config.md#partof) in the ShowcaseConfig reference.

### partOf that is not a selector

```
⚠ ng-prism: <Class> › partOf — expected the selector of a showcased component or directive as a string, got <value>; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** `partOf` is not a string, or only spaces.
- **Fix:** write the parent's selector, such as `partOf: 'lib-select'`.

### No class with that selector

```
⚠ ng-prism: <Class> › partOf — no component or directive with @Showcase has the selector "<selector>"; it keeps a page of its own (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/resolve-parts.ts`

- **Cause:** no showcased class that an entry point exports has that selector.
- **Fix:** check the spelling, that the parent has `@Showcase` and is exported, and that `partOf` names one entry of the parent's selector, not its class.

### Several classes with that selector

```
⚠ ng-prism: <Class> › partOf — "<selector>" is the selector of <A> and <B>; name a selector only one of them has. It keeps a page of its own (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/resolve-parts.ts`

- **Cause:** more than one showcased class has the selector.
- **Fix:** name a selector only the parent has, such as its attribute selector.

### A parent that is a part itself

```
⚠ ng-prism: <Class> › partOf — <Parent> is a part itself, and a part cannot have parts; it keeps a page of its own (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/resolve-parts.ts`

- **Cause:** the class it names declares `partOf` too.
- **Fix:** point the class at the parent's own parent, or give the middle class a page of its own.

### A class named as its own part

```
⚠ ng-prism: <Class> › partOf — a component cannot be a part of itself; it keeps a page of its own (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/resolve-parts.ts`

- **Cause:** the selector is one of the class's own.
- **Fix:** name the parent's selector.

### partOf on a service or a pipe

```
⚠ ng-prism: <Class> › partOf — only a component or directive can be part of another; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** a service or a pipe declares `partOf`. Reported only when a plugin shows services or pipes, like their other messages.
- **Fix:** delete `partOf`.

### A field without effect on a part

```
⚠ ng-prism: <Class> › <field> — has no effect on a part, which has no page of its own: the parent's showcase shows it. It was dropped. (<file>:<line>:<col>)
```

Notice · `builder/scanner/resolve-parts.ts`

- **Cause:** a resolved part sets a field only a page uses: `variants`, `states`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `bg`, `canvasLayout`, a host template, `imports` or `renderPage`. Nothing the styleguide could show is lost.
- **Fix:** delete the field from the part.

## Services and pipes

A service or a pipe (since 22.7.0) is only read when a plugin has a view panel for it, such as `jsDocPlugin()`. Without one, the build only counts them and logs a hint, and none of their other messages appear. Two kinds of message always appear, since they come from the scan of components: `setup` on a component, and the notices for a service or pipe that is still a component. See [Services & Pipes](guide/services-and-pipes.md).

### No plugin shows services

```
ng-prism: <n> service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

Hint · `builder/shared/prism-pipeline.ts`

- **Cause:** no plugin in the config has a view panel that applies to services. The services are left out of the manifest and the sidebar.
- **Fix:** add [`jsDocPlugin()`](plugins/jsdoc.md) with `ng add @ng-prism/plugin-jsdoc`. If it is there already, update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer: an older one has no page for services.

### No plugin shows pipes

```
ng-prism: <n> pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.
```

Hint · `builder/shared/prism-pipeline.ts`

- **Cause:** no plugin has a view panel that applies to pipes. A panel for services alone does not count. The pipes are left out of the manifest and the sidebar.
- **Fix:** add `jsDocPlugin()`, or update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer.

### setup that is not a function returning a list

```
⚠ ng-prism: <Class> › setup — "<source>" (<file>:<line>:<col>) must be an arrow function returning an array literal, e.g. setup: () => [provideX]; setup was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** [`setup`](api/showcase-config.md#setup) is no arrow function whose body is an array literal, or a block that only returns one. `as const`, a spread, a condition, a call, a plain array and a constant that holds the list are rejected.
- **Fix:** write `setup: () => [provideX, X_TOKEN]` in the `@Showcase({ … })` literal. A `setup` that comes through a spread or a constant is not read at all, and nothing is reported.

### A setup entry that is neither a function nor a token

```
⚠ ng-prism: <Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is neither a function nor an InjectionToken; it was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the entry is a class, a plain value or a call. The other entries stay.
- **Fix:** list a function declaration, a `const` arrow or function expression, or a `const` of type `InjectionToken`.

### A setup entry that is not exported

```
⚠ ng-prism: <Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is not exported from any library entry point, so the styleguide cannot show where to import it from; it was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** no scanned entry point exports the function or token, so the usage snippet has no import path for it.
- **Fix:** export it from an entry point of the library.

### setup on a component

```
⚠ ng-prism: <Class> › setup (<file>:<line>:<col>) only applies to services and pipes (@Injectable, @Service or @Pipe); it was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** a component or directive declares `setup`. Printed whether or not a plugin shows services or pipes.
- **Fix:** remove `setup`, or check that the class has `@Injectable`, `@Service` or `@Pipe` from `@angular/core`.

### setup on a service that is still a component

```
⚠ ng-prism: <Class> › setup (<file>:<line>:<col>) was dropped: setup only applies to services and pipes, and the class is still a component because it declares <fields>.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** an `@Injectable`, `@Service` or `@Pipe` class declares `setup`, but the component-only fields it names keep it a component until 23.0.0, see [A service that is still a component](#a-service-that-is-still-a-component).
- **Fix:** remove those fields to make it a service or a pipe, or remove `setup`.

### A pipe declared in an NgModule

```
⚠ ng-prism: <Class> › @Pipe (<file>:<line>:<col>) is declared with standalone: false; ng-prism shows standalone pipes only, so it was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the pipe has `standalone: false`. The usage snippet imports a pipe into a component, which an NgModule pipe does not allow.
- **Fix:** make the pipe standalone.

### A pipe name that cannot be read

```
⚠ ng-prism: <Class> › @Pipe name (<file>:<line>:<col>) cannot be evaluated statically, so the pipe was dropped.
```

Diagnostic · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the `name` of `@Pipe({ name })` is no string constant the scan can read, such as a `let` or a call. Without it a template has nothing to call the pipe by.
- **Fix:** write the name as a string literal or a `const`.

### A service that is still a component

```
⚠ ng-prism: <Class> is an @Injectable/@Service with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** an `@Injectable` or `@Service` class declares a field only a component can use (`variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports` or `renderPage`), so it stays a component. Deprecated since 22.7.0, removed in 23.0.0.
- **Fix:** to make it a service now, remove the fields and move the demo to a [component page](guide/component-pages.md). Otherwise nothing is lost until 23.0.0.

### A pipe that is still a component

```
⚠ ng-prism: <Class> is a @Pipe with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be shown as a pipe and these fields will be dropped; remove them, or move the page to a componentPage.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the same for a standalone `@Pipe` class. Deprecated since 22.7.0, removed in 23.0.0.
- **Fix:** to make it a pipe now, remove the fields and move the demo to a component page.

### An NgModule pipe that is still a component

```
⚠ ng-prism: <Class> is a @Pipe with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the same for a pipe with `standalone: false`, which is not shown from 23.0.0. This notice comes instead of the diagnostics for [an NgModule pipe](#a-pipe-declared-in-an-ngmodule) and [an unreadable name](#a-pipe-name-that-cannot-be-read).
- **Fix:** make the pipe standalone and remove the fields, or move the demo to a component page.

### A service or pipe whose API cannot be read

```
⚠ ng-prism: <Class>: could not read its API (<reason>); the service is left out of the styleguide.
⚠ ng-prism: <Class>: could not read its API (<reason>); the pipe is left out of the styleguide.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the scanner failed on the class and left it out, so that the rest of the library still gets its pages. Nothing in `@Showcase` is wrong.
- **Fix:** report it to ng-prism with the class and the reason.

## Compositions and hosts

The messages of [`template`](api/showcase-config.md#template), the host template and [`imports`](api/showcase-config.md#imports) (since 22.7.0), and of a directive's string or object [`host`](api/showcase-config.md#host). `<path>` is the field, such as `variants[2] "Disabled" › template`, `host` or `imports[1]`. A problem in a composition leaves that variant out of it: the variant renders as it would without `template` and `host`, and the other variants stay. It is a diagnostic when ng-prism is sure, and a notice when Angular may still accept the template. See [Compositions](guide/compositions.md#errors).

### A template that is not a string

```
⚠ ng-prism: <Class> › variants[<i>] "<name>" › template — expected a string, got <value>; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** a variant's `template` is not a string.
- **Fix:** write the template as a string.

### A host template that is not a string

```
⚠ ng-prism: <Class> › host — expected { template: string }, got <value>; it was dropped (<file>:<line>:<col>)
⚠ ng-prism: <Class> › variants[<i>] "<name>" › host — expected { template: string }, got <value>; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** a `host` with a `template` that is no string, or a variant's `host` that is not `{ template }`. A variant takes the template form only.
- **Fix:** write `host: { template: '…' }`.

### content next to template

```
⚠ ng-prism: <Class> › variants[<i>] "<name>" › content — set together with template; template wins and content was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** a variant has both [`content`](api/showcase-config.md#content) and `template`.
- **Fix:** keep `template` and delete `content`.

### imports that is not a list

```
⚠ ng-prism: <Class> › imports — expected a list of { name, from }, got <value>; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** `imports` is not an array.
- **Fix:** write a list of `{ name: 'X', from: 'pkg' }` literals.

### An import of the wrong shape

```
⚠ ng-prism: <Class> › imports[<i>] — expected { name, from } with a non-empty string each, got <value>; it was dropped (<file>:<line>:<col>)
⚠ ng-prism: <Class> › host.import — expected { name, from } with a non-empty string each, got <value>; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** an entry of `imports`, or the `import` of a directive's object host, is not a pair of non-empty strings. Without its `import`, the object host renders as a `<div>`.
- **Fix:** write `{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }`.

### An import name that is not an identifier

```
⚠ ng-prism: <Class> › imports[<i>] — expected the name a class is exported under, got "<name>"; it was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/component.scanner.ts`

- **Cause:** the manifest imports the class as `import { <name> } from '<from>'`, so `name` has to be an identifier. Usually `name` and `from` are swapped, or `name` is dotted. A default export (`"default"`) cannot be imported by name. The same goes for `host.import`.
- **Fix:** write the name the class is exported under, and export a class that only has a default export by its name.

### A string or object host on a component

```
⚠ ng-prism: <Class> › host — a string or object host has no effect on a component; use host: { template } to render it inside other markup. It was dropped. (<file>:<line>:<col>)
```

Notice · `builder/scanner/component.scanner.ts`

- **Cause:** a component declares a string or object `host`, which only a directive uses. A component never rendered in it, so nothing is lost.
- **Fix:** delete it, or write the markup around the component as a host template: `host: { template: '<div class="frame"><lib-card /></div>' }`.

### An import ng-prism cannot read

```
⚠ ng-prism: <Class> › imports[<i>] — "<name>" from "<from>" is not a component, directive or pipe ng-prism can read; it is imported as written and Angular checks the template (<file>:<line>:<col>)
```

Notice · `builder/scanner/composition/read-composition.ts`

- **Cause:** the entry, or an object host's `import`, resolves to something without a selector or a pipe name that ng-prism can read, such as an NgModule, or to no module at all. It is imported anyway. While one entry is unread, [an unknown element](#an-unknown-element) or [pipe](#an-unknown-pipe) is only a notice too.
- **Fix:** check `name` and `from` if the entry should have been read. Otherwise nothing; Angular checks the template when the styleguide builds.

### An unknown element

```
⚠ ng-prism: <Class> › <path> — <tag> matches no imported component (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the template uses an element that is no standard HTML and that no class it can see declares, usually a typo such as `<lib-icn>`. When an import cannot be read, the message ends with `; an import ng-prism cannot read may declare it, so Angular checks it` and is a notice.
- **Fix:** fix the tag, export the class from an entry point of the library, or add a class from another package to [`imports`](api/showcase-config.md#imports).

### An unknown pipe

```
⚠ ng-prism: <Class> › <path> — pipe "<name>" matches no imported pipe (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the template calls a pipe nothing declares. Angular's own pipes are not imported by themselves. With an unread import, it is a notice, as for an unknown element.
- **Fix:** fix the name, or add the pipe to `imports`, such as `{ name: 'DatePipe', from: '@angular/common' }`.

### An element two components match

```
⚠ ng-prism: <Class> › <path> — <tag> matches <A> and <B>, and Angular allows one component per element (NG0300) (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the selectors of two library components match the same element.
- **Fix:** change the element, or one of the selectors.

### A library class that is not standalone

```
⚠ ng-prism: <Class> › imports — <A> is not standalone, so a composition cannot import it; add the NgModule that declares it here (<file>:<line>:<col>)
```

Notice · `builder/scanner/composition/read-composition.ts`

- **Cause:** a template uses a library class declared in an NgModule, and Angular takes only standalone classes in a component's `imports`. For several classes the message says `<A> and <B> are not standalone, … add the NgModules that declare them here`. Until then, an element only that class declares is unknown too.
- **Fix:** add the NgModule to `imports`, such as `{ name: 'LegacyModule', from: 'my-lib' }`.

### A library class that matches only by standard attributes

```
⚠ ng-prism: <Class> › imports — <A> on <tag> matches only by standard attributes and is not imported; add it here to apply it (<file>:<line>:<col>)
```

Notice · `builder/scanner/composition/read-composition.ts`

- **Cause:** a library directive whose selector names the element only by attributes HTML already has, such as `input[type=email]`, is not applied to `<input type="email">`: a user of the library would not get it without importing it either.
- **Fix:** add it to `imports` if the variant should have it. Otherwise nothing.

### A library selector Angular cannot parse

```
⚠ ng-prism: <Name> from "<from>" has the selector "<selector>", which Angular cannot parse (<reason>); no composition imports it.
```

Notice · `builder/scanner/composition/read-composition.ts`

- **Cause:** a component or directive the library exports has a selector that Angular's selector parser rejects. No composition imports it.
- **Fix:** only needed when a template uses that class: fix its selector.

### The library's classes could not be read

```
⚠ ng-prism: ng-prism could not read the library's components, directives and pipes (<reason>), so no variant renders a template or a host template.
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the index the compositions are checked against failed to build. No showcase of the library has a composition. Nothing in a `@Showcase` is wrong.
- **Fix:** report it to ng-prism with the reason.

### The compiler failed on a showcase

```
⚠ ng-prism: <Class> › <path> — @angular/compiler failed on it (<reason>); no variant of this showcase renders a template or a host template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** one of Angular's compiler APIs threw on the showcase, for example on a selector of the class that the selector parser rejects. Every composition of the showcase is left out.
- **Fix:** fix what `<reason>` names, or report it to ng-prism with the reason.

### A subject that is not standalone

```
⚠ ng-prism: <Class> › <path> — <Class> is not standalone, which the wrapper that renders a composition needs; no variant of this showcase renders a template or a host template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the showcased class has `standalone: false`, and the generated wrapper can only import a standalone class.
- **Fix:** make the class standalone, or show it without `template` and host template.

### A syntax error in a template

```
⚠ ng-prism: <Class> › <path> — <message> (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** Angular's template parser rejects the template or the host template, and `<message>` is its message, such as `Unexpected closing tag "div"`.
- **Fix:** fix the markup.

### An element left open

```
⚠ ng-prism: <Class> › <path> — <tag> is not closed (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** an element is opened and never closed. Angular closes it at the end of a template of its own, but not inside the `@case` that the generated wrapper puts the template in.
- **Fix:** close the element.

### An error inside the generated case

```
⚠ ng-prism: <Class> › <path> — <message>, in the @case that the generated wrapper puts the template in; an unclosed {{ or block can cause it (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** the markup parses on its own, but not inside the wrapper's `@case`, typically because an interpolation `{{` or a block such as `@if (…) {` is not closed and swallows the wrapper's `}`.
- **Fix:** close it.

### Content in a void element

```
⚠ ng-prism: <Class> › <path> — <tag> is a void element and takes no content (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** a variant `template` on a directive that renders on `<input>`, `<img>` or another void element.
- **Fix:** delete the template, or host the directive on an element that takes content.

### A selector that names no element

```
⚠ ng-prism: <Class> › <path> — the selector "<selector>" names no element to render the subject on (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** a variant `template` without a host template needs the subject's element, and the class's selector is empty or does not parse.
- **Fix:** give the class a selector, or render the variant in a host template.

### Several elements marked as the subject

```
⚠ ng-prism: <Class> › host — prism-subject marks <n> elements of the host template; mark one (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** more than one element of the host template carries `prism-subject`.
- **Fix:** mark exactly one.

### No element matches the selector

```
⚠ ng-prism: <Class> › host — the selector "<selector>" matches no element of the host template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** the host template does not contain the subject.
- **Fix:** write its element the way a user of the library writes it, such as `<input libInput>`, or put `prism-subject` on the element that is meant.

### Several elements match the selector

```
⚠ ng-prism: <Class> › host — the selector "<selector>" matches <n> elements of the host template; mark one with prism-subject (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** the subject's selector matches more than one element.
- **Fix:** put `prism-subject` on the one that is the subject.

### A marked element the selector does not match

```
⚠ ng-prism: <Class> › host — prism-subject marks <tag>, which the selector "<selector>" does not match (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** a component's `prism-subject` sits on an element its selector does not match.
- **Fix:** mark the component's own element.

### A marked element the directive cannot sit on

```
⚠ ng-prism: <Class> › host — prism-subject marks <tag>, but no part of the selector "<selector>" fits a <tag> (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/compose-template.ts`

- **Cause:** a directive's `prism-subject` sits on an element that no part of its selector allows, so ng-prism cannot add the attributes that make it match.
- **Fix:** mark another element, or fix the host template.

### HTML content in a host template

```
⚠ ng-prism: <Class> › variants[<i>] "<name>" › content — HTML content cannot be projected into a host template; use template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** a component variant that renders in a host template has HTML `content`.
- **Fix:** move the markup into the variant's `template`.

### A variant input the template sets

```
⚠ ng-prism: <Class> › variants[<i>] "<name>" › inputs.<input> — set by the template on the subject; the variant value was dropped (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** the host template writes that input on the subject element, such as `required` or `[size]="…"`, which makes it the template's. Its control reads `Not editable`.
- **Fix:** delete the value from `inputs`, or the attribute from the host template.

### A string host that is not one element

```
⚠ ng-prism: <Class> › host — "<host>" is not one element ("<tag attrs>" or "<tag>text</tag>") for a variant template to render in, so the variants render without their template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** a directive with a variant `template` has a string `host` that is not a single element.
- **Fix:** write the host as one element, or as a host template.

### An object host without selector or import

```
⚠ ng-prism: <Class> › host — an object host needs a selector and an import { name, from } for a variant template to render in, so the variants render without their template (<file>:<line>:<col>)
```

Diagnostic · `builder/scanner/composition/read-composition.ts`

- **Cause:** a directive with a variant `template` has an object `host` without `selector` or without `import`.
- **Fix:** give the object host both, see [`DirectiveHost`](api/types.md#directivehost).

### An object host without an import

```
⚠ ng-prism: <Class>: the host names no class to import (host.import), so it renders as <div>.
```

Notice, printed when the manifest is written · `builder/manifest/runtime-manifest.generator.ts`

- **Cause:** a directive's object host has no usable `import: { name, from }`, so the wrapper cannot render its component.
- **Fix:** add the `import`.

### A host the selector does not fit

```
⚠ ng-prism: <Class>: no part of the selector "<selector>" fits the host <tag>, so only its first attribute is set.
```

Notice, printed when the manifest is written · `builder/manifest/runtime-manifest.generator.ts`

- **Cause:** a directive's host element is not one its selector names, so the directive may not match it.
- **Fix:** use a host that fits the selector.

### Content on a void host

```
⚠ ng-prism: <Class>: <tag> is a void element and takes no content, so the content of the host and of the variants is not rendered.
```

Notice, printed when the manifest is written · `builder/manifest/runtime-manifest.generator.ts`

- **Cause:** a directive renders on a void element such as `<input>`, and its host or a variant has `content`.
- **Fix:** delete the content.

### A host string that cannot be parsed

```
[ng-prism] @Showcase host="<host>" could not be parsed and will fall back to <div>. Supported forms: "<tag>", "<tag attrs>", "<tag />", or "<tag>text</tag>".
```

Notice, printed when the manifest is written · `builder/manifest/host-parser.ts`

- **Cause:** a directive's string `host` is none of the supported forms. The directive renders on a `<div>`.
- **Fix:** write the host in one of the forms, or as an object host `{ selector, import: { name, from } }`.

### An Angular error in the generated manifest

```
NG8002: Can't bind to 'size' since it isn't a known property of 'lib-x'.
```

Angular's own message, when the styleguide app compiles · comments from `builder/manifest/composition-wrapper.generator.ts`

- **Cause:** an error that only Angular finds, such as `NG8001` for an unknown element or `NG8002` for an unknown property, at a line of `ng-prism-cache/<prism-project>/prism-manifest.ts`, in the template of a generated wrapper. ng-prism cannot report it while it scans.
- **Fix:** look above the reported line. A comment above the wrapper names the showcase's file, and one above each case names the variants and their position in the source, such as `<!-- variants[2] "Disabled" (projects/my-lib/src/lib/form-field/form-field.component.ts:47:9) -->`. Fix the template of that variant. In `serve`, the error shows in the dev server's overlay and goes away with the next save.

## Decorator inputs

Inputs declared with `@Input()` and outputs declared with `@Output()` work in variants, the Controls panel and the Events panel, with limits, see [Inputs & Controls](guide/inputs-and-controls.md#decorator-inputs-and-outputs).

### Inputs declared with @Input()

```
⚠ ng-prism: <Class> uses @Input() decorators which are not fully supported. Migrate to input() signals for full ng-prism support.
⚠ ng-prism: <Class> inherits @Input() decorators from <Base>, which are not fully supported. Migrate to input() signals for full ng-prism support.
```

Notice · `builder/scanner/component.scanner.ts`

- **Cause:** the class, or a decorated base class it extends, declares an input with `@Input()`. The scan reads it, but `@Showcase<T>` cannot type it, and setter inputs and the `inputs` array of the decorator are not read.
- **Fix:** migrate to `input()` and `model()`, for example with Angular's `signal-input-migration`.

### Inputs from a base class without source

```
⚠ ng-prism: <Class> inherits <inputs> from <Base>, which only exists as a declaration (<file>:<line>:<col>); without its source these inputs cannot be read, so they are missing from the manifest and variants cannot set them.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** a base class only exists as a declaration, such as a `.d.ts` of a package, so its inputs have no `input()` call to read. They are missing from the controls, and variants cannot set them. See [What the Scanner Reads](guide/scanner-reads.md#base-classes-and-mixins).
- **Fix:** when you have the base class's source, map its package to the `.ts` files through a path mapping, so that the scan reads them. Otherwise variants cannot set these inputs.

## Config

The config file, the builder options and the entry points they name.

### strictShowcase stopped the build

```
ng-prism: strictShowcase is enabled and <n> @Showcase value(s) were dropped; see the warnings above.
```

Error · `builder/shared/prism-pipeline.ts`

- **Cause:** [`strictShowcase`](api/ng-prism-config.md#strictshowcase) is on, and the scan printed `<n>` diagnostics. The build stops after the scan, before the plugin hooks run and before a manifest is written.
- **Fix:** fix the diagnostics above it.

### The a11y gate failed

```
ng-prism: a11y thresholds violated: <metric>: <actual> (threshold <limit>), …. Fix the components, relax config.a11y.gate (config.a11y.thresholds while gate is not set), or set gate: false to grade without failing the build.
```

Error in `build`, a warning prefixed `⚠ ` in `serve` · `builder/shared/prism-pipeline.ts`

- **Cause:** the total of the [a11y report](guide/a11y-reports.md#gating) breaks the limits of [`a11y.gate`](api/ng-prism-config.md#a11y), or of `a11y.thresholds` while `gate` is not set. `<metric>` is `score`, `critical`, `serious` or `moderate`.
- **Fix:** fix the components and write the report again, relax the limits, or set `gate: false` when CI gates on its own, see [Audits in CI](guide/ci.md#accessibility).

### A config option that never had an effect

```
⚠ ng-prism: <config file> sets "<option>", which is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.
```

Notice · `builder/config-loader/deprecated-options.ts`

- **Cause:** the config sets `ui`, `themeStylesheet`, `headless` or `appComponent`, see [Deprecated options](api/ng-prism-config.md#deprecated-options).
- **Fix:** remove the option. Nothing changes, since nothing has ever read it.

### A deprecated theme token

```
⚠ ng-prism: <config file> sets <token> in "<option>": <token> is deprecated since 22.7.0 and will be removed in 23.0.0. Until then its value is carried over to <successor>; override <successor> instead.
```

Notice · `builder/config-loader/deprecated-options.ts`, `app/theme/deprecated-tokens.ts`

- **Cause:** `theme`, `darkTheme` or `lightTheme` overrides a token deprecated since 22.7.0. For `--prism-mark-nominal`, `--prism-mark-attention` and `--prism-mark-critical`, the value still reaches `--prism-success`, `--prism-warn` and `--prism-danger`. For `--prism-spectrum`, `--prism-primary-from` and `--prism-primary-to`, the message says `Nothing reads it any more` instead, and the successor is `--prism-brand-gradient`. The styleguide warns about the same override in the browser console.
- **Fix:** override the successor the message names, see [`theme`](api/ng-prism-config.md#theme).

### A config file outside the workspace

```
ng-prism: configFile "<file>" resolves outside workspace root (<root>). Provide a path relative to the workspace.
```

Error · `builder/config-loader/config-loader.ts`

- **Cause:** the builder option [`configFile`](api/builders.md#configfile) points outside the workspace.
- **Fix:** move the config into the workspace and give its path relative to the workspace root.

### No entry file

```
⚠ ng-prism: entryPoint "<path>" resolves to no entry file: no ng-package.json with a lib.entryFile that exists, and no secondary entry points below it. Point entryPoint at the library's barrel file.
```

Notice · `builder/shared/prism-pipeline.ts`

- **Cause:** the [`entryPoint`](api/builders.md#entrypoint) directory has no `ng-package.json` whose entry file exists, and no secondary entry points. The styleguide has no components.
- **Fix:** point `entryPoint` at the library's barrel file, such as `projects/my-lib/src/public-api.ts`.

### An entry file that does not exist

```
⚠ ng-prism: source file not found for entry point <file>, skipping.
```

Notice · `builder/scanner/entry-point.scanner.ts`

- **Cause:** the entry file is not there, usually because [`entryPoint`](api/builders.md#entrypoint) names a file that does not exist. That entry point is skipped.
- **Fix:** fix the path in `entryPoint`.

### An entry file that cannot be read

```
⚠ ng-prism: failed to resolve exports for <file>: <message>
```

Notice, printed as an error · `builder/scanner/entry-point.scanner.ts`

- **Cause:** TypeScript failed to resolve the exports of the entry file. That entry point is skipped, the others are scanned.
- **Fix:** fix what `<message>` names.

### A class exported by several entry points

```
⚠ ng-prism: <Class> is exported by multiple entry points; keeping the first occurrence (importPath: <path>).
```

Notice · `builder/scanner/scanner.ts`

- **Cause:** two secondary entry points export the same class. The class keeps the import path of the first. A primary entry point that re-exports its secondaries is normal and prints nothing.
- **Fix:** export the class from one entry point.

## Plugins

Messages of the plugins in the config and of their build hooks. See [Writing a Plugin](plugins/writing-plugins.md) and [NgPrismPlugin](api/ng-prism-plugin.md).

### A plugin registered twice

```
⚠ ng-prism: plugin "<name>" is registered more than once, so later hooks may overwrite earlier ones.
```

Notice, printed by `defineConfig()` at build time and in the browser console · `plugin/define-config.ts`

- **Cause:** two entries of [`plugins`](api/ng-prism-config.md#plugins) have the same `name`.
- **Fix:** register each plugin once.

### A plugin hook failed

```
ng-prism: plugin "<name>" failed in <hook> for <target>: <cause>
```

Error · `builder/plugin-runner/plugin-runner.ts`

- **Cause:** a plugin's build hook threw. `<hook>` is the hook, `<target>` the item, such as `component "ButtonComponent"`, `service "…"`, `pipe "…"`, `page "…"` or `manifest`. A plugin without a name is called `<unnamed>`. The original stack follows the message.
- **Fix:** fix the hook, or report it to the plugin's author with the cause.

### A plugin that sets wrapComponent

```
⚠ ng-prism: plugin "<name>" sets wrapComponent, which is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.
```

Notice · `builder/config-loader/deprecated-options.ts`

- **Cause:** the plugin sets [`wrapComponent`](api/ng-prism-plugin.md#wrapcomponent), deprecated since 22.6.0, removed in 23.0.0. Nothing has ever read it.
- **Fix:** remove it from the plugin.

### A panel that sets position

```
⚠ ng-prism: plugin "<name>" sets position on panel "<id>", which is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.
```

Notice · `builder/config-loader/deprecated-options.ts`

- **Cause:** a panel of the plugin sets `position`, deprecated since 22.6.0, removed in 23.0.0. Nothing has ever read it.
- **Fix:** remove it from the panel.

### A deprecated Perf option

```
⚠ ng-prism: perfPlugin() option "<option>" is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.
```

Notice · `packages/plugin-perf/src/perf-plugin.ts`

- **Cause:** `perfPlugin()` gets `thresholds`, `bundle.excludeImports`, `render` or `memory`, see [Perf](plugins/perf.md).
- **Fix:** remove the option.

### An unknown status in the visual regression report

```
ng-prism/plugin-visual-regression: <report> reports an unknown status "<status>" (first seen on <Class>). Those variants are left out of the panel.
```

Notice, once per status · `packages/plugin-visual-regression/src/report-reader.ts`

- **Cause:** an entry of the report has a status the panel does not know. See [Visual Regression](plugins/visual-regression.md#status-values) for the valid ones.
- **Fix:** fix the runner that writes the report.

### A component API that cannot be read

```
⚠ ng-prism: <Class>: could not read its API for the API page (<reason>); the page falls back to its inputs and outputs.
```

Notice · `builder/scanner/showcase-diagnostics.ts`

- **Cause:** the scanner failed to read the API of a component or directive, which it only reads for a plugin that sets [`componentApi`](api/ng-prism-plugin.md#componentapi), such as `jsDocPlugin()`. The component keeps its page; the plugin's API tab shows its inputs and outputs without type links.
- **Fix:** report it to ng-prism with the class and the reason.
