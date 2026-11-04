# ng-prism warnings: cause and fix

The builder prints these lines while it scans, with the prefix `⚠ ng-prism:` unless noted. `<Class>` is the component
class, `<where>` is `@Showcase` or a path into it such as `variants[2] "Disabled" › inputs.size`. Each distinct message
is printed once per run.

## Values the builder dropped

These count for `strictShowcase: true`, which ends the build with
`ng-prism: strictShowcase is enabled and N @Showcase value(s) were dropped; see the warnings above.`

- **`<Class> › <where> — "<source>" (<file>:<line>:<col>) cannot be evaluated statically and was dropped`**: an
  expression the builder can't read: a function call, a ternary, `??`, `&&`, the or-operator, a comparison. Write the
  value out, or move it into a `const` built from literals, enum members and arithmetic.
- **`… cannot be evaluated statically, so the component is skipped`**: the argument of `@Showcase(…)` as a whole isn't
  an object literal the builder can read, e.g. `@Showcase(makeConfig())`. Write the object literally.
- **`… is a runtime value (function, class or instance) and cannot be part of the static manifest; it was dropped`**: a
  function, class, `new …` (other than `new Date(…)`) or object method in the config. Remove it; behaviour that needs
  code belongs in a component page.
- **`… is the current time, which differs in every build and every visual regression run, so it was dropped; …`**: a
  `new Date()` without arguments. Write the date out, `new Date(2026, 3, 28)` for a day at local midnight.
- **`… is an invalid date and was dropped`**: the arguments of a `new Date(…)` make no valid date. Fix them.
- The dropped-value lines can end with the reason a constant couldn't be read:
    - **`… is declared with let; only const declarations can be read`** (or `var`): make it `const`.
    - **`… is declared without a value, as in a .d.ts file or with declare`**: a `declare`d value, or a constant from a
      compiled package that isn't a plain literal there. Use a local `const` or the literal.
    - **`… refers back to itself`**: a circular constant. Break the cycle.
    - **`… is a function or class, which only exists at runtime`**: use a value, not a function or class.
    - **`: new Date() is the current time, which differs in every build`**: the constant holds `new Date()`. Write the
      date out.
    - **`: new Date(…) is an invalid date`**: the constant holds a `new Date(…)` whose arguments make no date.
- **`<Class> declares @Showcase providers (…), which are deprecated and will be removed in 23.0.0; …`**: move them to
  `defineConfig({ appProviders })` in `ng-prism.config.ts`, or use a component page.
- **`<Class> has @Showcase without a "title" field, skipping. …`**: add a `title`.
- **`<Class> declares invalid status "<value>", expected one of: stable, beta, wip, deprecated. Skipping.`**: use a
  listed value.
- **`<Class> declares invalid bg "<value>", expected one of: …. Skipping.`**, also per variant as
  `<Class> variant "<name>" declares invalid bg …`: use `dots`, `plain`, `light`, `dark` or `transparent`.
- **`<Class> declares invalid canvasLayout "<value>", …`**, also per variant: use `fit` or `stretch`.
- **`<Class> variant "<name>" declares invalid pseudo <json>, expected an object mapping pseudo states to true or selectors. Skipping.`**:
  write `pseudo: { hover: true }` or `pseudo: { hover: '.btn' }`.
- **`… declares unknown pseudo state "<state>", expected one of: hover, active, focus, focus-visible, focus-within. Skipping.`**:
  use a listed state.
- **`… declares pseudo state "<state>" with an empty selector. Skipping.`**, **`… with an empty selector list. Skipping.`**,
  **`… with <values> in its selector list, expected non-empty strings. …`** and
  **`… with invalid target <json>, expected true, a selector or a list of selectors. Skipping.`**: the target must be
  `true`, a selector or a list of selectors.
- **`<Class> declares invalid states <value>, expected a list of { name, pseudo }. Skipping.`**: write
  `states: [{ name: 'Hover', pseudo: { hover: '.btn' } }]`.
- **`<Class> states[<i>] is <value>, expected { name, pseudo }. Its column stays empty.`**,
  **`<Class> states[<i>] has no name, expected a non-empty string. Calling it "State <n>".`**,
  **`<Class> state "<name>" declares no pseudo states. Its column stays empty.`** and
  **`<Class> state "<name>" repeats the name of states[<i>]; only the first one is used. Its column stays empty.`**:
  every entry needs a unique `name` and a non-empty `pseudo`. An entry that is not an object, a repeated name and a
  missing, empty or unusable `pseudo` keep their position as an empty state, so the ones behind it keep their index;
  an empty state fits no variant (`forces no state`). An entry without a name is not one of them: it is called
  `State <n>` and works as a state if its `pseudo` is usable, but give it a name.
- **`<Class> declares states together with renderPage; a component page has no Overview to show them in. Skipping states.`**:
  use one or the other. A component that needs states renders itself, without `renderPage`.
- **`<Class> variant "<name>" declares invalid states <value>, expected false. Skipping.`**: the only value a variant's
  `states` takes is `false`, which keeps it out of the component's states.

- **`<Class> › setup — "<source>" (<file>:<line>:<col>) must be an arrow function returning an array literal, e.g. setup: () => [provideX]; setup was dropped.`**
  (a service or pipe): `setup` has to be an arrow function whose body is an array literal, or a block with that one `return`.
  `as const`, a spread, a condition, a call, a plain array and a constant that holds the list are all rejected. Write
  `setup: () => [provideX, X_TOKEN]` directly in the `@Showcase({ … })` object.
- **`<Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is neither a function nor an InjectionToken; it was dropped.`**:
  the entry is a class, a plain value or a call. List a function declaration, a `const` arrow or function, or a
  `const` of type `InjectionToken`, by name or as `ns.name`.
- **`<Class> › setup[<i>] — "<source>" (<file>:<line>:<col>) is not exported from any library entry point, so the styleguide cannot show where to import it from; it was dropped.`**:
  export the function or token from an entry point the `prism` target scans.
- **`<Class> › setup (<file>:<line>:<col>) only applies to services and pipes (@Injectable, @Service or @Pipe); it was dropped.`**:
  `setup` sits on a component or directive. Remove it, or check that the class has `@Injectable`, `@Service` or `@Pipe`
  from `@angular/core` (an aliased import or `@ng.Injectable()` through a namespace import counts too).
- **`<Class> › setup (<file>:<line>:<col>) was dropped: setup only applies to services and pipes, and the class is still a component because it declares <fields>.`**:
  the class is an `@Injectable`, `@Service` or `@Pipe`, but the named component-only fields keep it a component until
  23.0.0 (see the legacy notices below), and a component has no use for `setup`. Remove the fields to make it a
  service or pipe, which is what `setup` is for, or remove `setup`.
- **`<Class> › @Pipe (<file>:<line>:<col>) is declared with standalone: false; ng-prism shows standalone pipes only, so it was dropped.`**:
  the pipe is declared in an NgModule. Make it standalone, which is also what lets the usage snippet put it into a
  component's `imports`. A pipe with component-only fields in its `@Showcase` gets the notice below instead, until 23.0.0.
- **`<Class> › @Pipe name (<file>:<line>:<col>) cannot be evaluated statically, so the pipe was dropped.`**: the `name` of
  `@Pipe({ name })` isn't a string literal or a `const` the builder can read (a `let`, a call). Write it as a literal;
  without the name a template has nothing to call the pipe by.

### Compositions (`template`, `host: { template }`, `imports`)

Since 22.7.0. `<where>` is the field, such as `variants[2] "Disabled" › template` or `host`. A composition the builder
finds a problem in is left out: that variant renders as it would without `template` and `host`, and the others stay.

- **`<Class> › <where> — expected a string, got <value>; it was dropped`** (`template`),
  **`… expected { template: string }, got <value>; it was dropped`** (`host`, on the showcase or a variant),
  **`<Class> › imports — expected a list of { name, from }, got <value>; it was dropped`** and
  **`<Class> › imports[<i>] — expected { name, from } with a non-empty string each, got <value>; it was dropped`**: the
  field has the wrong shape. `template` is a string, `host` is `{ template: '…' }`, `imports` is a list of
  `{ name: 'X', from: 'pkg' }` literals.
- **`<Class> › imports[<i>] — expected the name a class is exported under, got "<name>"; it was dropped`** (also
  `host.import` of a directive's object host): the generated manifest imports the class by `name`, so it has to be an
  identifier. Usually `name` and `from` are swapped, or `name` is dotted (`Cdk.TextareaAutosize`). A default export
  (`"default"`) cannot be imported by name: export the class by its name.
- **`… › content — set together with template; template wins and content was dropped`**: a variant has both. Keep
  `template` and delete `content`.
- **`… › template — <Angular's message> (<file>:<line>:<col>)`**, for example `Unexpected closing tag "div"`: a syntax
  error in the template or the host template, as Angular's parser words it. Fix the markup. The same for
  **`… › host — <Angular's message>`**.
- **`… › host — <tag> is not closed`** (or `› template`): an element is opened and never closed. Angular would close it
  at the end of a template of its own, but not inside the `@case` the generated wrapper puts it in. Close it.
- **`… — <Angular's message>, in the @case that the generated wrapper puts the template in; an unclosed {{ or block can cause it`**:
  the markup parses on its own but not inside the wrapper, typically an interpolation `{{` or a block `@if (…) {`
  without its end, which swallows the wrapper's `}`. Close it.
- **`… — <element> matches no imported component`** and **`… — pipe "<name>" matches no imported pipe`**: the element
  is no standard HTML, or the pipe is a pipe nobody declares, and no class the template can see declares it. A typo
  (`<lib-icn>`) is the usual cause. Otherwise the class isn't exported by an entry point the `prism` target scans
  (export it), or it comes from another package, or it is one of Angular's own pipes or directives: add
  `imports: [{ name: 'DatePipe', from: '@angular/common' }]`.
- **`… — <element> matches A and B, and Angular allows one component per element (NG0300)`**: two library components
  have selectors that match the element. Change the element or one of the selectors.
- **`… › host — the selector "<selector>" matches no element of the host template`**: the host template doesn't contain
  the subject. Write its element the way a user of the library writes it (`<input libInput>`), or put `prism-subject`
  on the element that is meant.
- **`… › host — the selector "<selector>" matches <n> elements of the host template; mark one with prism-subject`** and
  **`… › host — prism-subject marks <n> elements of the host template; mark one`**: put `prism-subject` on exactly one
  element.
- **`… › host — prism-subject marks <tag>, which the selector "<selector>" does not match`** (a component) and
  **`… but no part of the selector "<selector>" fits a <tag>`** (a directive): the marked element is not one the subject
  can sit on. Mark another element, or fix the host template.
- **`… — <tag> is a void element and takes no content`**: a variant `template` on a directive that renders on
  `<input>`, `<img>` or another void element. Delete the template, or host the directive on a non-void element.
- **`… › content — HTML content cannot be projected into a host template; use template`**: a component variant that
  renders in a host template has HTML `content`. Move it into `template`.
- **`… › inputs.<name> — set by the template on the subject; the variant value was dropped`**: the template writes that
  input on the subject element (`required`, `[x]="ref"`), which makes it the template's. Delete the value from `inputs`,
  or the attribute from the template.
- **`<Class> › host — "<host string>" is not one element ("<tag attrs>" or "<tag>text</tag>") for a variant template to render in, so the variants render without their template`**
  and **`<Class> › host — an object host needs a selector and an import { name, from } for a variant template to render in, …`**:
  a directive with a string or object `host` has a variant `template`, and the host can't hold one. Write the host as
  one element, or give the object host `selector` and `import`.
- **`<Class> › <where> — <Class> is not standalone, which the wrapper that renders a composition needs; no variant of this showcase renders a template or a host template`**:
  the showcased class is declared in an NgModule (`standalone: false`), and the generated wrapper can only import a
  standalone class. Make the class standalone, or show it without `template` and host templates.
- **`ng-prism could not read the library's components, directives and pipes (<reason>), so no variant renders a template or a host template.`**:
  the index the compositions are checked against failed to build, so no showcase of the library has a composition.
  Nothing in a `@Showcase` is wrong; tell the user, with the reason, so it can be reported to ng-prism.
- **`<Class> › <where> — @angular/compiler failed on it (<reason>); no variant of this showcase renders a template or a host template`**:
  one of the compiler's APIs threw, so every composition of the showcase is left out. The reason names it, for example
  a selector of the showcased class that Angular's selector parser rejects. Tell the user, with the reason and the class.

### Parts (`partOf`)

Since 22.7.0. In each of these the class keeps a page of its own, with the variants it declares, and `partOf` is dropped;
fix the selector to make it a part.

- **`<Class> › partOf — no component or directive with @Showcase has the selector "<selector>"; it keeps a page of its own`**:
  no showcased class exported by an entry point has that selector. Check the spelling, that the parent has `@Showcase`
  and is exported, and that `partOf` is the parent's selector (one entry of a selector list is enough), not its class name.
- **`<Class> › partOf — "<selector>" is the selector of <A> and <B>; name a selector only one of them has. It keeps a page of its own`**:
  several showcased classes match. Name a selector only the parent has, for example its attribute selector.
- **`<Class> › partOf — <Parent> is a part itself, and a part cannot have parts; it keeps a page of its own`**: the parent
  declares `partOf` too. Point the class at the parent's parent, or give the parent a showcase of its own.
- **`<Class> › partOf — a component cannot be a part of itself; it keeps a page of its own`**: the selector is one of the
  class's own.
- **`<Class> › partOf — expected the selector of a showcased component or directive as a string, got <value>; it was dropped`**:
  `partOf` is not a string, or only spaces.
- **`<Class> › partOf — only a component or directive can be part of another; it was dropped`**: a service or a pipe
  declares `partOf` (reported when a plugin shows services or pipes). Delete it.

## Notices

Same prefix, but they don't count for `strictShowcase`.

- **`<Class> is an @Injectable/@Service with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.`**:
  the class has a field only a component can use (`variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`,
  `imports` or `renderPage`), so it stays a component until 23.0.0 (deprecated since 22.7.0, removed in 23.0.0). To make it a service now, remove the fields and move the demo to
  a component page; otherwise leave it, nothing is lost.
- **`<Class> is a @Pipe with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be shown as a pipe and these fields will be dropped; remove them, or move the page to a componentPage.`**:
  the same rule for a `@Pipe` class (deprecated since 22.7.0, removed in 23.0.0): it has a component-only field, so it
  stays a component until then. To make it a pipe now, remove the fields and move the demo to a component page;
  otherwise leave it, nothing is lost.
- **`<Class> is a @Pipe with @Showcase and declares <fields>, so it is still treated as a component. From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.`**:
  the same for a pipe declared with `standalone: false`, which is gone from 23.0.0, not shown as a pipe. Make the pipe
  standalone and remove the fields, or move the page to a component page. This notice comes before the
  `standalone: false` and unreadable-`name` warnings: a pipe with `renderPage` keeps its page in 22.x either way.
- **`ng-prism: <n> service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.`**
  (no `⚠`, an info line of the normal log, once per build or `serve` run): no plugin has a view panel that applies to
  services, so the build only counted them and left every service out. It didn't read them either, so none of their
  `setup` warnings appear until a plugin shows them. Add `jsDocPlugin()` (skill setup). If `jsDocPlugin()` is already there, update
  `@ng-prism/plugin-jsdoc` to 22.7.0 or newer: an older one has no page for services.
- **`ng-prism: <n> pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.`**
  (no `⚠`, an info line of the normal log, once per build or `serve` run): no plugin has a view panel that applies to
  pipes, so the build only counted them and left every pipe out, without their `setup` and `@Pipe` warnings. A panel
  for services alone doesn't count. Add `jsDocPlugin()` (skill setup), or update
  `@ng-prism/plugin-jsdoc` to 22.7.0 or newer: an older one has no page for pipes.
- **`<Class>: could not read its API (<reason>); the service is left out of the styleguide.`** (or `the pipe is left
out`): the scanner failed on the class and skipped it, so that the rest of the library still gets its pages. Nothing
  in the `@Showcase` is wrong; it is a case the scanner doesn't handle. Tell the user, with the reason and the class, so
  it can be reported to ng-prism.
- **`<Class>: could not read its API for the API page (<reason>); the page falls back to its inputs and outputs.`**:
  the same for a component or directive, which keeps its page: its API tab shows the inputs and outputs without type
  links, payloads or type cards.
- **`<Class> › host — a string or object host has no effect on a component; use host: { template } to render it inside other markup. It was dropped.`**:
  a component never rendered in a string or object `host`, and it still doesn't, so nothing is lost. Delete the field,
  or write the markup around the component as `host: { template: '<div …><lib-x /></div>' }`.
- **`<Class> › <field> — has no effect on a part, which has no page of its own: the parent's showcase shows it. It was dropped.`**:
  a class with a resolved `partOf` sets a field that only a page uses (`variants`, `states`, `category`, `section`, `bg`,
  `host`, `renderPage`, …). Nothing the styleguide could show is lost. Delete the field from the part.
- **`<Class> › imports[<i>] — "<name>" from "<from>" is not a component, directive or pipe ng-prism can read; it is imported as written and Angular checks the template`**
  (also `host.import` of an object host): the entry resolved to something whose selector ng-prism can't read, an
  NgModule or a service for instance, or to no module at all. It is imported anyway. While one entry is unread, an
  unknown element or pipe is only a notice too (**`… — <element> matches no imported component; an import ng-prism cannot read may declare it, so Angular checks it`**),
  and Angular decides. Check `name` and `from` if you expected it to be read. If the styleguide build then fails with
  `NG8001` or `NG8002`, see "The styleguide build fails inside a composition".
- **`<Class> › imports — <Class2> on <element> matches only by standard attributes and is not imported; add it here to apply it`**:
  a library directive whose selector names the element only by standard attributes (`input[type=email]`) is not applied
  to `<input type="email">`, as a user of the library wouldn't get it without importing it. If the variant should have
  it, add `{ name: '<Class2>', from: '<entry point>' }` to `imports`; otherwise ignore the notice.
- **`<Class> › imports — <Class2> is not standalone, so a composition cannot import it; add the NgModule that declares it here`**
  (or `<Class2> and <Class3> are not standalone, …`): a template uses a library class declared in an NgModule, and
  Angular takes only standalone classes in `imports`. Add its NgModule: `{ name: 'LegacyModule', from: '<entry point>' }`.
  Until then, an element only that class declares is also reported as unknown.
- **`<Class> from "<from>" has the selector "<selector>", which Angular cannot parse (<reason>); no composition imports it.`**:
  a library class with a selector Angular's parser rejects (a nested `:not`, say) is never imported into a composition.
  Only a problem if a template needs that class.
- **`<Class>: <input> is a void element and takes no content, so the content of the host and of the variants is not rendered.`**
  (printed while the manifest is written): `content` on a directive that renders on a void element. Delete the content.
- **`<Class>: the host names no class to import (host.import), so it renders as <div>.`**: the object host has no
  `import: { name, from }`. Add it.
- **`<Class>: no part of the selector "<selector>" fits the host <tag>, so only its first attribute is set.`**: the host
  element isn't one the directive's selector names, so the directive may not match. Use a host that fits the selector.

- **`<Class> declares bg "checker", which is deprecated and will be removed in 23.0.0; use 'transparent' for the same look with a capture that keeps its alpha, or 'light'/'dark' for an absolute colour.`**
- **`<Class> uses @Input() decorators which are not fully supported. …`** or
  **`<Class> inherits @Input() decorators from <Base>, …`**: migrate the inputs to `input()` / `model()`.
- **`<Class> inherits <inputs> from <Base>, which only exists as a declaration (…); without its source these inputs cannot be read, …`**:
  the base class comes from a compiled package, so its inputs are missing from the manifest and variants can't set them.
- **`<Class> is exported by multiple entry points; keeping the first occurrence (importPath: …).`**: export the class
  from one entry point.
- **`entryPoint "<path>" resolves to no entry file: …`**: the `entryPoint` directory has no `ng-package.json` with an
  existing `lib.entryFile`, and no secondary entry points. Point `entryPoint` at the library's barrel file.
- **`source file not found for entry point <file>, skipping.`**: `lib.entryFile` in an `ng-package.json` points to a
  file that doesn't exist.
- **`failed to resolve exports for <file>: <message>`** (an error): the entry file doesn't compile; fix what the message
  names.
- **`[ng-prism] @Showcase host="<host>" could not be parsed and will fall back to <div>. Supported forms: …`** (prefix
  `[ng-prism]`): write the host as `<tag>`, `<tag attrs>`, `<tag />` or `<tag>text</tag>`, or as
  `{ selector, import: { name, from } }`.
- **`<config file> sets "<option>", which is deprecated and will be removed in 23.0.0. It has never had an effect; remove it.`**
  (for `ui`, `themeStylesheet`, `headless` or `appComponent`),
  **`plugin "<name>" sets wrapComponent, which is deprecated and will be removed in 23.0.0. …`**,
  **`plugin "<name>" sets position on panel "<id>", which is deprecated and will be removed in 23.0.0. …`** and
  **`perfPlugin() option "<option>" is deprecated and will be removed in 23.0.0. …`**: delete the option; nothing
  changes, since it never had an effect.
- **`<config file> sets <token> in "<option>": <token> is deprecated since 22.7.0 and will be removed in 23.0.0. …;
override <successor> instead.`** (for `--prism-mark-*`, `--prism-spectrum`, `--prism-primary-from` or
  `--prism-primary-to` in `theme`, `darkTheme` or `lightTheme`): move the override to the successor the notice names.
  A `--prism-mark-*` override still works until 23.0.0; the others have no effect any more.
- **`ng-prism: plugin "<name>" failed in <hook> for …: <cause>`** (an error): a plugin's build hook threw. On the first
  build this stops `serve` and `prism-build`; on a rescan the previous manifest stays.

## In the browser console

- **`[ng-prism] Variant "<name>" references unknown input "<key>" on <Class>, ignoring.`** and
  **`[ng-prism] Unknown input "<key>" on <selector>, skipping. Remove it from @Showcase variants.`**: a key under
  `inputs` isn't an input of the component. Check the spelling, write the class member name (also for an input with
  an `alias`), and make sure the member is an `input()` or `model()`. Up to 22.5.0 an alias lands here too.
- **`NG0303: Can't set value of the '<member>' input on the '<Class>' component.`** (Angular, dev mode), up to 22.5.0:
  the member is an input with an `alias`, which a variant can't set there, by either name. Leave it out and tell the
  user.
- **`[ng-prism] Variant <index> of <Class> failed to render:`** followed by the error: the component threw while
  rendering that variant in the **Overview** tab, the only place that logs this line. The Overview catches the error per
  cell, so that cell stays empty and the others render. The error that follows says why, for example a missing
  `input.required()`. Fix the variant's `inputs`, or the component.
  The single-variant canvas (Playground, and `scripts/screenshot.mjs`) doesn't catch it: Angular logs `ERROR` followed
  by the error, the canvas shows nothing or a half-built component, and `.demo-wrap` never gets its
  `data-prism-rendered` marker. The script then exits `1` with "Variant never rendered" and lists the error under the
  browser console errors. The fix is the same.
- **`[ng-prism] "<selector>" in forced pseudo states is not a valid selector, skipping it.`**: fix the CSS selector
  in `pseudo`.
- **`[ng-prism] Could not force a pseudo state for "<selector>".`** and
  **`[ng-prism] Cannot force pseudo states in <stylesheet>: its rules are cross-origin and cannot be read. …`** (dev
  mode only): the browser rejected the rewritten selector, or the stylesheet comes from another origin. Serve it from
  the same origin, or with CORS and a `crossorigin` attribute.
- **`[ng-prism] <token> is deprecated since 22.7.0 and will be removed in 23.0.0. …`**: the same deprecated theme
  token override the build reports, warned once per token. Fix it the same way.
- **`[ng-prism] The badge of panel "<id>" sets variant, which is deprecated since 22.7.0 and will be removed in
23.0.0. …`**: a plugin's `badge` callback returns `variant`. Return `kind` and `tone` instead: `warn` and `danger`
  become `kind: 'issues'` with that tone, `default` becomes `kind: 'count'`, and for `ok` return `null`. If the plugin
  isn't the user's, tell them; the badge keeps rendering until 23.0.0.

## `screenshot.mjs --state` exits with 4

`<Class> variant <n> × state <m> is excluded: <reason>`: the styleguide rendered the variant, but the state doesn't fit
it, so nothing is forced and the script takes no screenshot. It is the answer for that combination, not a fault of the
script. The reason says why:

- **`states: false`**: the variant opts out of the component's `states`. Leave it, or remove `states: false` if the
  variant should take the state.
- **`forces no state`**: the state declares no pseudo-class to force. The scanner couldn't evaluate it; look for a
  `⚠ ng-prism:` line for that `states` entry.
- **`<target> matches nothing`**: nothing in the variant's rendered component matches the selector (`<target>` is the
  selector, a list joined with `, `, or `the component`). Check the selector against the variant's template, or pick a
  variant that renders it.
- **`<target> is disabled`** or **`<target> is inert`**: a `focus` or `focus-visible` state, and no match can take
  focus. A disabled or `[inert]` element can't be focused. For `the component`, every element in it that could take
  focus (a button, a field, a link, `[tabindex]`) is disabled or inert.
- **`<target> has pointer-events: none`**: a `hover` or `active` state, and every match ignores the pointer.

Exit `1` with `<Class> has no state <m> (it declares <n>).` means the index is out of range: states are 0-based, in the
order written in `@Showcase({ states })`.

## The component is missing from the sidebar

Check the log line `ng-prism: Generated manifest with N component(s)` first, then:

1. `0 component(s)` and the `entryPoint` of the `prism` target names the library directory? Up to 22.5.0 that finds
   nothing without secondary entry points. Point `entryPoint` (on `prism` and `prism-build`) at the barrel file, the
   `lib.entryFile` of the library's `ng-package.json`, e.g. `projects/<lib>/src/public-api.ts`.
2. Is the class exported by the entry point the `prism` target scans (its `entryPoint` option), directly or through
   `export *`?
3. Up to 22.5.0: does the library have secondary entry points (`ng-package.json` files without `dest`)? Then only those
   are scanned: export the component from one of them.
4. Is the decorator written `@Showcase({ … })`, imported under that name, with an argument? An aliased import or
   `@Showcase()` without an argument is skipped without a warning.
5. Did the log warn about a missing `title` or a config that "cannot be evaluated statically, so the component is
   skipped"?
6. Does it declare `partOf` (22.7.0)? A part has no entry of its own: it shows on the page of its parent. If that is
   not what you want, remove `partOf`.

## The service is missing from the sidebar

Look at the log first. `ng-prism: … service(s) with @Showcase found, but no plugin shows services; …` means the
config has no `jsDocPlugin()` (or another plugin with a view panel that has `appliesTo: ['service']`): add it. If
`jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer. Otherwise:

1. Is the log line `ng-prism: Generated manifest with N component(s), M service(s)` and M is lower than expected?
2. Is the class exported from an entry point the `prism` target scans?
3. Does it carry `@Injectable` or `@Service` from `@angular/core`? An aliased import (`import { Injectable as Service }`)
   and a namespace import (`@ng.Injectable()`) count; a `@Service` from another DI library makes no service.
4. Does it have `@Component` or `@Directive` too? Then it is a component. Does it have `@Pipe`? Then it is a pipe.
   Does it declare `variants`, `renderPage` or another component-only field? Then it is still a component until
   23.0.0 (deprecated since 22.7.0), with a notice in the log.
5. Is the `@Showcase` argument an object literal with a `title`, readable by the builder? Otherwise the service is
   skipped with a warning, like a component.
6. Is there a notice `<Class>: could not read its API (…); the service is left out of the styleguide.`? See Notices.

A service is addressed as `?service=<ClassName>`; `?component=` never selects one.

## The pipe is missing from the sidebar

Look at the log first. `ng-prism: … pipe(s) with @Showcase found, but no plugin shows pipes; …` means the config has no
`jsDocPlugin()` (or another plugin with a view panel that has `appliesTo: ['pipe']`; one for services alone doesn't
count): add it. If `jsDocPlugin()` is already there, update `@ng-prism/plugin-jsdoc` to 22.7.0 or newer. Otherwise:

1. Is the log line `ng-prism: Generated manifest with N component(s), …, K pipe(s)` and K lower than expected?
2. Is the class exported from an entry point the `prism` target scans?
3. Does it carry `@Pipe` from `@angular/core` (also aliased, or `@ng.Pipe()`), and no `@Component` or `@Directive`?
4. Is there a `⚠ ng-prism:` line naming `@Pipe` or `@Pipe name`? Then it is declared with `standalone: false`, or its
   `name` isn't a string literal or a `const`: make it standalone, or write the name as a literal.
5. Does it declare `variants`, `renderPage` or another component-only field? Then it is still a component until 23.0.0
   (deprecated since 22.7.0), with a notice in the log, and it shows under Components.
6. Is the `@Showcase` argument an object literal with a `title`, readable by the builder? Otherwise the pipe is skipped
   with a warning, like a component.
7. Is there a notice `<Class>: could not read its API (…); the pipe is left out of the styleguide.`? See Notices.

A pipe is addressed as `?pipe=<ClassName>`; neither `?component=` nor `?service=` selects one.

## A pipe page is missing something

A pipe page takes the points of "A service page is missing something" for `setup`, defaults, types and `@returns`.
What is specific to a pipe:

- **A signature is missing:** the page has one row per overload signature of `transform()`, and the implementation
  signature only when there are no overloads. A `transform()` that exists only in a base class is read too, also from
  a `.d.ts`; when no class in the chain has one, the **Transform** section is left out without a warning.
- **A signature has no description:** an overload takes the doc block of its own, else of the implementation, else of
  the first documented overload, else of a base class's `transform()`. Document one of them. The class description
  comes from the pipe's own doc block and isn't inherited.
- **A tag of one overload is missing on another:** from another overload only the description and the `@param` texts
  are taken, not `@deprecated`, `@since`, `@see` or `@example`. Tags that apply to every signature go on the
  implementation.
- **A property or another method of the class isn't listed:** only `transform()` is.
- **The Pure / Impure chip is missing:** `pure` in `@Pipe({ … })` isn't a literal the builder can read.
- **The template line has no arguments, or too few:** it is built from the first signature that isn't `@deprecated`
  (the first one when all are), with each required parameter after the value as `: name`, up to the last required one.
  Optional and rest parameters after that are left out.

## A service page is missing something

- **A setup function or token is not listed:** look for a `⚠ ng-prism:` line naming `setup` or `setup[<i>]`.
- **A config table is missing:** the first parameter of the setup function has to be an interface, an object literal
  type or an object type alias (also in `Partial`, `Required` or `Readonly`). A class, an array, a primitive, or a token
  whose type argument is a class gets none.
- **A default shows `—`:** the option needs `@default <value>` in its JSDoc. Prose isn't read.
- **A type isn't a link:** it must be an interface, class, type alias or enum that a scanned entry point exports and
  that isn't `@internal`. A type imported under another name stays unlinked.
- **A property isn't listed:** `private`, `protected`, `#x`, `_x`, statics and `@internal` aren't, and a lifecycle hook
  never is. A constructor parameter is listed only with `public`, `readonly` or `override`.
- **A `@returns` text isn't shown:** that is a limit; the return type comes from the code. Say what it means in the
  method's description.
- **A method has several rows:** it is overloaded, and each overload signature gets one; the implementation signature
  is left out. An overload without a doc block takes the implementation's, else the description and `@param` texts of
  the first documented overload (not its tags, so `@deprecated` stays on its own overload), else the base class's.
  Document the implementation or the first overload.
- **The usage snippet imports a setup entry under the wrong name:** the function or token is exported under another
  name (`export { impl as provideToast }`), and the snippet uses the declared one. Export it under its declared name.
- **A panel of your own doesn't show on a service page:** it needs `appliesTo: ['service']` and `placement: 'view'`
  (`['pipe']` for a pipe page).

## The styleguide build fails with NG8002

`NG8002: Can't bind to '<member>' since it isn't a known property of '<tag>'`, reported in
`ng-prism-cache/<lib>-prism/prism-manifest.ts`, up to 22.5.0: a directive with `@Showcase` declares an input with an
`alias`, and the generated host binds the member name, which the directive doesn't accept. There the only ways out are
to drop the alias or the `@Showcase`; ask the user which. Later versions bind the alias.

## The styleguide build fails with TS2345 on a directive output

`TS2345: Argument of type '<T>' is not assignable to parameter of type 'void'`, reported in
`ng-prism-cache/<lib>-prism/prism-manifest.ts` at `(<output>)="<output>.emit($event)"`, up to 22.7.0-beta.5: a directive
with `@Showcase` has an output that carries a payload (`output<string>()`), and its generated host `<Class>__PrismHost`
declares the output as `output()`, which takes none. Later versions declare it as `output<any>()`; suggest the update.
On a 22.7.0 beta, a host template on the showcase or on every variant (`host: { template }`, see "Compositions")
renders the directive through the composition wrapper, which takes any payload. Before 22.7.0 the only way out is to
drop the `@Showcase`. Don't change the output's type in the directive; ask the user.

## A variant renders without its template or host template

Look in the build log for a `⚠ ng-prism:` line that names the variant (`variants[<i>] "<name>"`) or `host`, and read
"Compositions" above: each such variant is left out of the composition and renders as it would without `template` and
`host`, for example a frame without its input. Also check:

1. Is the installed `@ng-prism/core` 22.7.0 or newer? Its `showcase.types.d.ts` has `template` and `imports`. Older
   versions don't know the fields: they ignore `template` and `imports` without a warning, and a `host: { template }`
   on a directive makes their manifest generation throw.
2. Is the `template` or `host` written in the `@Showcase({ … })` object, as a string, a template literal of constants or
   a `const`? A call or a `let` is dropped with a warning, like any other value.
3. For a `host: { template }`: does the selector of the showcased class match an element of it, once?

## The styleguide build fails inside a composition

An error such as `NG8001: 'lib-x' is not a known element` or `NG8002: Can't bind to 'size' since it isn't a known property of 'lib-x'`
in `ng-prism-cache/<lib>-prism/prism-manifest.ts` is something only Angular finds, so ng-prism couldn't report it
beforehand. The error points at a line in the generated wrapper `<Class>__PrismComposition`. Above each `@case` of
its template is a comment with the variants and the position in the source, and above the class one with the
showcase's file:

```
<!-- variants[2] "Disabled" (projects/my-lib/src/lib/form-field/form-field.component.ts:47:9) -->
```

Find the comment above the reported line, open that file and fix the template of that variant. Typical causes are
a binding to an input the element doesn't have, an element or pipe from an import ng-prism couldn't read that the
import doesn't declare (see the notice about it), and a name that isn't a template reference variable in an expression.
Expressions in a template have no component class behind them. Never edit the generated file: the next scan
overwrites it. In `serve` the error goes away with the next save.

## An input has no effect

- The key isn't the member name: look for the browser console messages above.
- Up to 22.5.0: the input has an `alias`, which a variant can't set there.
- The value was dropped: look for a `⚠ ng-prism:` line that names `inputs.<key>`.
- The input is an `@Input()`: migrate it to `input()`.
- In a composition (`template` or `host: { template }`), the control reads `Not editable` and the value does nothing:
  the tooltip says why. `Set by the template of this variant`: the template writes that input on the subject element, so
  change it there. `Its default is unknown to ng-prism`: the default isn't a literal the builder can read, so the input
  stays unbound until the variant sets a value for it in `inputs`.

## Projected content lands in the wrong slot

- **`[ng-prism] Variant content "<key>" matches no <ng-content> of <Class>, skipping it.`** (browser console): the key
  isn't the `select` of any `<ng-content>` in the template. Copy the selector exactly; `default` is the unnamed slot.
- Up to 22.5.0 an object `content` fills the slots by position, not by their `select`: `default` goes into the first
  slot of the template, the other keys into the following ones in the order written. A component whose template puts
  a named slot before the unnamed one shows the contents swapped there, and reordering the keys can't fix it. Leave
  the component's template as it is; use a component page or tell the user.
- `content` is HTML parsed in the browser, not compiled by Angular. A component or directive selector in it is a plain
  element that nothing instantiates, so it has no behaviour, and no `contentChild`, `contentChildren` or injected parent
  reaches it. From 22.7.0 write the content as a variant `template` (rule 13 of the skill).
