---
name: showcase
description: Use when writing or changing an @Showcase decorator in an Angular library that uses @ng-prism/core (variants, inputs, content projection, compiled templates with host templates and imports for components that work together such as a form field with its input, components that only exist as a part of another (`partOf`), directive hosts, states and pseudo states, canvas background and layout, status, component pages, services with @Injectable or @Service and pipes with @Pipe, with their setup), when a build prints a "⚠ ng-prism:" warning, when a component, service or pipe is missing from the ng-prism styleguide or an input has no effect there, or when a showcase should be checked in the running styleguide with a screenshot. Also when someone asks for a "story" in a project that uses ng-prism instead of Storybook. Not for developing ng-prism itself.
---

# Writing and checking @Showcase configs

ng-prism builds a styleguide from `@Showcase` decorators on the components of an Angular library. The builder reads
them with the TypeScript compiler at build time and never executes them. A showcase is data, not code, and most
mistakes come from forgetting that.

## The installed version decides

Read `version` in `node_modules/@ng-prism/core/package.json`. Where this skill and the installed package disagree, the
package is right:

- Field reference, with JSDoc on every field and `@deprecated` notes:
  `node_modules/@ng-prism/core/dist/decorator/showcase.types.d.ts`.
- A field this skill names that those typings don't have is newer than the installed version: don't use it, suggest an
  update at most.
- Guides: `https://ng-prism.github.io/ng-prism/`. The site serves its pages as raw Markdown you can fetch directly,
  e.g. `https://ng-prism.github.io/ng-prism/guide/variants.md`. The pages for this skill are listed at the end.

## Rules

1. **Only values the builder can evaluate statically.** It reads literals, `const` declarations (imported ones too),
   enum members, arithmetic and string concatenation on those, template literals with such placeholders, property
   access on constants (`SIZES.md`), and arrays and objects, spreads included. It drops function calls, ternaries,
   `??` and `&&`, `let` and `var`, `declare`d values, functions, classes and `new`, each with a `⚠ ng-prism:` warning,
   and keeps the rest. The one function that works is the `setup: () => [...]` of a service or pipe: the builder reads the array
   literal from the source and never calls it. When the whole config can't be evaluated, the component is skipped.
   The one `new` that works is `new Date(…)` with arguments it can read (since 22.8.0), in variants and as an input
   default; the browser makes the `Date` from the arguments as written. For a day without a time write the local form
   `new Date(2026, 3, 28)` (month from 0): `new Date('2026-04-28')` is midnight in UTC and shows the 27th west of UTC.
   `new Date()` without arguments is the current time and is dropped.
   Constants imported from a compiled package (`.d.ts`) are readable only as plain literals.
   `defineConfig({ strictShowcase: true })` in `ng-prism.config.ts` turns every dropped value into a build error.
2. **The component must be exported by the library's entry point.** The builder scans what the `entryPoint` of the
   library's `prism` target exports, `export *` included: every secondary entry point (an `ng-package.json` without
   `dest` below the library), then the primary one. Up to 22.5.0 the primary entry file is skipped when secondary entry
   points exist, and without them a library directory as `entryPoint` finds no component at all, without a warning:
   there, name the barrel file (e.g. `projects/<lib>/src/public-api.ts`).
3. **`title` is required.** Without it the component is skipped with a warning.
4. **Signal inputs.** `input()`, `input.required()` and `model()` work; `@Input()` is read only partly and warns. The
   keys under a variant's `inputs` are the class member names. Write `@Showcase<ButtonComponent>({ … })` to get the
   keys and their values type-checked. An input with an `alias` is keyed by its member name too. Up to 22.5.0 such an
   input can't be set from a variant, by either name, and on a directive it fails the styleguide build with `NG8002`:
   don't work around it in the component, tell the user.
5. **`@Showcase` goes above `@Component` / `@Directive`**, imported from `@ng-prism/core` under its own name. An alias
   (`import { Showcase as S }`) or a namespace call is not recognized.
6. **No `providers`.** `@Showcase({ providers })` is deprecated since 22.4.0, removed in 23.0.0, and the build drops
   it: the manifest is static and can't hold providers. Put them into `defineConfig({ appProviders })` in
   `ng-prism.config.ts`, or use a component page.
7. **A directive renders on the element its selector names, and `host` changes that.** Without a `host`,
   `input[libInput]` renders as `<input libInput>` and `[libTooltip]` as `<div libTooltip>` (up to 22.6.0 always a
   `div`, and a selector with an element never matched). `host` is an HTML string such as
   `host: '<button class="btn">Save</button>'` (forms: `<tag>`, `<tag attrs>`, `<tag />`, `<tag>text</tag>`; anything
   else falls back to a `<div>` with a warning), `{ selector, import: { name, from }, inputs? }` to put the directive
   on another component, or `{ template }` for markup around it (rule 13). A void element (`<input>`, `<img>`) works
   as a host from 22.7.0 and takes no `content`; up to 22.6.0 it broke the styleguide build. Up to 22.7.0-beta.5 an
   output with a payload (`output<string>()`) on a directive breaks it too, with `TS2345`, see
   `references/troubleshooting.md`. A string or object `host` on a **component** has no effect, and from 22.7.0 the
   build reports it and points to `host: { template }`.
8. **Projected content is set per variant.** `content: 'Save'` fills the default `<ng-content>`; an object fills named
   slots by their `select`, written exactly as in the template, with `default` for the unnamed one:
   `content: { '[card-header]': '<h3>Title</h3>', default: '<p>Body</p>' }`. There is no component-level `content`.
   `content` is HTML parsed in the browser, not compiled: components and directives in it stay plain elements, and
   there are no bindings. For those use rule 13.
   Up to 22.5.0 an object fills the slots by position instead (`default` first, then the keys in the order written),
   so a named slot before the unnamed one gets swapped content there: don't change the component's template for it,
   use a component page or tell the user.
9. **States an input can't reach** (hover, active, focus, focus-visible, focus-within) are forced with `pseudo`: `true`
   for every element of the component, or a selector (or a list) for specific ones, e.g.
   `{ 'focus-visible': '.btn' }`. The component's own CSS draws the state. Where it goes depends on who shares it:
    - **A condition that applies to several variants goes into `states` on the component** (since 22.6.0):
      `states: [{ name: 'Hover', pseudo: { hover: '.btn' } }, { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } }]`.
      Every variant is then combined with each of them, where the state fits. The Overview becomes a variant × state matrix, the tools menu
      gets a chip per state and a screenshot can address each combination. Don't write `Hovered`, `Pressed` and
      `Focus visible` as variants of every variant. `name` is required and unique; the position in the list is the
      state's index (the `state` URL parameter, `--state`), so append new states at the end and don't reorder. A
      variant that must not take part says `states: false`. `states` is not possible together with `renderPage`.
    - **A picture that belongs to one variant stays `pseudo` on that variant**: its own inputs plus a forced state, or a
      one-off mix of targets, e.g. `{ name: 'Typing', inputs: { value: 'Hello' }, pseudo: { focus: '.field__input' } }`.
      `pseudo` forces exactly what it says, with no fit rule.
    - **A state fits a variant only where the browser could put the component in it.** Every pseudo-class of the state
      needs a target that exists, and a focus target must not be `:disabled` or under `[inert]` (for `true`: one of the
      component's focusable elements, if it has any), a hover or active target must take the pointer (not
      `pointer-events: none`). Otherwise nothing is forced and the cell is shown as not fitting, with the reason:
      `<target> matches nothing`, `<target> is disabled`, `<target> is inert`, `<target> has pointer-events: none`.
      That is intended, for example a remove-button state on a chip without that button, so don't widen the selector to
      make it fit. A state that fits no variant at all is usually a typo in its selector; the Overview warns about it in
      the browser console.
10. **Custom templates, mock data or several components together make a component page**: a
    `{ title, component, … }` entry in `componentPages`, the third argument of
    `providePrism(manifest, config, { componentPages })` in the styleguide app's `main.ts`, linked with
    `@Showcase({ renderPage: '<exact page title>' })`. The variant tabs and controls stay, but their values reach the
    page only if it injects `PrismRendererService` from `@ng-prism/core` and reads `inputValues()` and
    `activeVariantIndex()`. A page replaces the canvas and gives up the Overview, `states` (dropped with a warning),
    the Events panel and the perf render marks, and its code snippet shows the subject's selector, not the page. When
    every part of the demo is a class of the library, use rule 13 instead and keep all of that.

11. **A service is showcased on its class and gets a page without a canvas.** `@Showcase` on a class with `@Injectable`
    or `@Service`, both from `@angular/core` (an aliased or namespace import counts) and with no `@Component` or `@Directive`
    beside them, lists the class under **Services** in the sidebar. The page shows the public API read from the code,
    the types it reaches, the `setup` entries and a generated usage snippet. It needs an installed version whose
    `showcase.types.d.ts` has `setup`. Read `references/services-and-pipes.md` before writing one.
12. **A pipe is showcased on its class too, and gets the same kind of page.** `@Showcase` on a class with `@Pipe`
    from `@angular/core` (an aliased or namespace import counts), with no `@Component` or `@Directive` beside it (an `@Injectable`
    next to `@Pipe` is fine), lists the class under **Pipes**. The page shows the template name, whether it is pure,
    every signature of `transform()`, the `setup` entries, the types and a generated usage snippet. Only standalone
    pipes with a readable `name`. It needs the same installed version as a service (`showcase.types.d.ts` has
    `setup`): both came in one release. Read `references/services-and-pipes.md` before writing one.
13. **Parts that find each other through Angular are a composition, not `content` and not a component page** (since
    22.7.0; the typings have `template` and `imports`). A form field reads its input with `contentChild`, a radio group
    its radios with `contentChildren`, a control injects its field: write that markup as an Angular template that
    ng-prism compiles with the library.
    - **`variants[].template`** is the content of the subject. Angular picks the slot, so there is no record by slot:
      `{ name: 'With icon', inputs: { label: 'Search' }, template: '<lib-icon libPrefix name="search" /><input libInput />' }`.
      It wins over `content`, and a directive gets it as the content of its host element.
    - **`host: { template }`** (on the showcase, or `variants[].host` for one variant) is the markup the subject sits
      in, for a directive in its frame or one radio in a group:
      `host: { template: '<lib-form-field label="Name"><input libInput /></lib-form-field>' }`. The subject is the element
      the subject's selector matches, written as a user of the library writes it (selector lists included).
      `prism-subject` marks it when several match: `<lib-radio prism-subject value="m">`. No match, or several without
      the mark, is a warning.
    - **What the template writes on the subject element itself** (`required`, `value="m"`, `[libDatepicker]="picker"`)
      belongs to the template: that input is not bound in the variant, its control reads `Not editable`, and a value for
      it in `inputs` is dropped with a warning. A value-less attribute that the subject's own selector names
      (`<lib-button libTooltip>`) does not count. `inputs` and the controls are the subject's, so values for other parts
      go into the template, per variant.
    - **Expressions have no context:** literals and template reference variables (`#picker`, `[for]="picker"`) only,
      no members of the component class.
    - **`imports: [{ name, from }]`** on the showcase, strings and not classes, for what ng-prism can't find in the
      library: another package (`{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }`) and Angular's own
      pipes and directives (`date` needs `{ name: 'DatePipe', from: '@angular/common' }`). A library class that the
      entry points export needs no entry when the template names it by a custom element (`lib-icon`) or an attribute
      Angular's DOM schema doesn't know (`libInput`). `type`, `required` and `tabindex` don't count, so a library
      directive that matches an element only by those is not imported: a notice names it, and `imports` applies it.
      `name` is the name the class is exported under (an identifier, not `default`), `from` the module. A library class
      declared in an NgModule (`standalone: false`) is never imported: list its NgModule here. The subject itself has
      to be standalone, or none of its variants is composed.
    - **A composition keeps everything a showcase has:** Overview, `states` (targets resolve against the whole
      composition, `true` is every element of it), Controls and Events for the subject, the Code popover with the
      markup as written, a11y, perf and VRT. It doesn't cover overlays rendered into `<body>` (a select's panel, a
      datepicker popup) and has no live control for any part but the subject.
    - Don't use `renderPage` for it (rule 10). Don't write `host: '<div>…'` on a component: it has no effect.
14. **A component that only works inside one other is a part: `partOf: '<parent selector>'`** (since 22.7.0; the typings
    have `partOf`). `lib-option` in `lib-select`: `@Showcase({ title: 'Option', description: '…', partOf: 'lib-select' })`.
    A part has no page of its own and no variant to write: its title, description, inputs and outputs show on its parent's
    page.
    - **The value is the parent's selector as a string, never the class** (that would import the parent back, and the
      config runs when the class is defined, so the cycle is a `ReferenceError`). It matches one entry of the parent's
      `selector` list, spaces ignored: `'lib-select'` finds `selector: 'lib-select, [libSelect]'`. The parent can be a
      component or a directive in any entry point.
    - **Exactly one parent that has `@Showcase`, and no chains.** A selector no showcased class has, one that several
      have, a parent that is a part itself and a class naming itself are warnings that `strictShowcase` fails on. The
      class then keeps a page of its own, so nothing vanishes, and you fix the selector.
    - **A part uses `title`, `description`, `tags`, `status`, `meta`**, and its inputs and outputs from the class. Don't
      set `variants`, `states`, `category`, `section`, `bg`, `canvasLayout`, `host: { template }`, `imports` or
      `renderPage` on it: each is dropped with a notice that does not fail a strict build. A malformed value in them, or
      an error in the template of a variant, is a warning as on any component, since the class is read before it is
      known to be a part, and that one does fail a strict build. A directive part keeps a string or object `host`
      (markup such as `host: '<button>Open</button>'`, not a bare tag name): the element its usage line on the API tab
      is written on (`<button libTrigger>`). Only components and directives can be parts; on a service or a pipe
      `partOf` is a warning.
    - **When a part, when a showcase of its own:** a part when the class only works inside that one parent and its page
      would repeat the parent's variants (`lib-option`, `lib-optgroup` in `lib-select`). A showcase of its own when
      several components use it or it has a look worth its own variants and states: `libInput`, used by a form field and
      a search input, stays its own entry. `partOf` takes one parent only.

Other fields: `description` (Markdown), `category`, `categoryOrder`, `componentOrder`, `section`, `tags`, `status`
(`stable`, `beta`, `wip`, `deprecated`), `bg` (`dots`, `plain`, `light`, `dark`, `transparent`; `checker` is
deprecated), `canvasLayout` (`fit`, or `stretch` for a component that fills its container: it gets the canvas width up
to 800px, with Viewport width on the width set there, a subject in a composition too), `meta` (data for plugins, e.g. `meta: { figma: '<url>' }`), `imports` (rule 13), `partOf` (rule 14). A variant
can set its own `description`, `bg`, `canvasLayout`, `meta`, `pseudo`, `template` and `host` (rule 13).

`meta.a11y` (typed): `rules: { '<axe-rule>': { enabled: false } }` switches a rule off for the component's live audit
(not audited at all), `disable: true` skips the audit, and `accept: [{ rule: '<axe-rule>', reason: '…' }]` (since 22.7,
on the component and on a variant, which adds to the component's) accepts a known, deliberate violation: still audited
and shown under Accepted with the reason, but not counted. Accept only what someone owns and decided to keep; `reason`
is required and says why. Fixing the component beats accepting.

## Example

```ts
import { Component, input } from '@angular/core';
import { Showcase } from '@ng-prism/core';

export enum ButtonTone {
    Primary = 'primary',
    Danger = 'danger'
}

@Showcase<ButtonComponent>({
    title: 'Button',
    category: 'Actions',
    status: 'stable',
    variants: [
        { name: 'Primary', content: 'Save' },
        { name: 'Danger', inputs: { tone: ButtonTone.Danger }, content: 'Delete' },
        { name: 'Disabled', inputs: { disabled: true }, content: 'Save' }
    ],
    // Combined with every variant. `Focus visible` is not forced on `Disabled`, whose button can't take focus:
    // that cell shows as not fitting. A variant that wants no states says `states: false`.
    states: [
        { name: 'Hover', pseudo: { hover: 'button' } },
        { name: 'Focus visible', pseudo: { 'focus-visible': 'button' } }
    ]
})
@Component({
    selector: 'lib-button',
    templateUrl: './button.component.html'
})
export class ButtonComponent {
    readonly tone = input(ButtonTone.Primary);
    readonly disabled = input(false);
}
```

A composition, with a frame as the subject and a directive that sits in it (rule 13):

```ts
@Showcase<FormFieldComponent>({
    title: 'Form Field',
    imports: [{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }],
    variants: [
        { name: 'Default', inputs: { label: 'E-Mail' }, template: '<input libInput type="email" />' },
        { name: 'Note', inputs: { label: 'Note' }, template: '<textarea libInput cdkTextareaAutosize></textarea>' }
    ]
})
@Component({ selector: 'lib-form-field' /* … */ })
export class FormFieldComponent {
    readonly label = input('');
}

@Showcase<InputDirective>({
    title: 'Input',
    host: { template: '<lib-form-field label="Name"><input libInput /></lib-form-field>' },
    variants: [{ name: 'Default' }, { name: 'Required', inputs: { required: true } }]
})
@Directive({ selector: 'input[libInput], textarea[libInput]' })
export class InputDirective {
    readonly required = input(false);
}
```

## JSDoc on a component or directive

With `jsDocPlugin()` (skill setup) the API tab of a component or directive is the same page as the one of a service
(since 22.7.0): a generated usage snippet, then Inputs, Outputs, Methods and a card for each type they reach. It is read
from the code and the JSDoc, so write JSDoc for what the types can't say:

- **Describe every `input()`, `model()` and `output()`.** The description shows in its table row, `@deprecated` becomes
  a badge and `@since` a note. The type comes from the code, as written (`input.required<TabItem[]>()`) or, without a type
  argument, as the compiler infers it.
- **A type is linked only when an entry point exports it.** It then gets a card, with its properties and its JSDoc, and
  every mention of it in an input type, an output payload or a method signature links to it. A type the library keeps to
  itself, an `@internal` one and one from another package (`Signal`, `Observable`) stays plain text. Export the
  interface or union alias from a scanned entry point, a secondary one as well, if it should have a card.
- **`@see X` and `{@link X}` link to the card of `X`, and only when `X` is on the page**, that is, when an input, an
  output payload or a documented method reaches it. Otherwise `@see X` stays text and `{@link X}` shows as code (as
  the link text for `{@link X | text}`). `{@link https://…}` is a normal link. A Markdown link such as `[X](#)` is left
  as written and goes nowhere.
- **An output's payload comes from `output<T>()`.** Write the type argument; an `output()` without one shows `void`.
  The change event of a `model()` (`<name>Change`) is added by itself: don't document it twice.
- **Only documented methods are listed.** A public method with a doc block, its own or inherited, is a row, with
  `@param name text` under each parameter. One without is left out, as are `private` and `protected` members, `_x`
  names, lifecycle hooks, statics and `@internal`. Document the methods a user is meant to call from outside.
- **Nothing to write for Usage.** The snippet is generated from the selector, the required inputs and, for a directive,
  the `host` of its `@Showcase`: another reason to declare one (rule 7). A showcase-level `host: { template }` (rule 13)
  shows the subject inside that markup, with the classes the template uses. `@version` gives a Version chip next to
  `@since`; `@example` (a fenced block) goes under Examples.
- **A part's API is a block on its parent's tab** (rule 14). Its whole page, usage to types, follows the parent's
  under "Parts", and its links lead to the cards in its own block, so document a part as you would a component.

## Workflow

1. Read the component: its `input()` / `model()` members and their types, its `<ng-content>` slots, whether it is a
   directive, and whether it works only with other parts (`contentChild`, `contentChildren`, an injected parent), which
   makes the variants a composition (rule 13).
2. Write the showcase: one variant per combination of inputs worth seeing, named for what it shows. A hover, pressed or
   focus condition is a `states` entry, not another variant. Variant and state indexes are 0-based, in this order.
3. Run the styleguide as a background process: `ng run <lib>:prism` (Nx: `npx nx run <lib>:prism`). It is ready when
   `http://localhost:4400/` answers (the target's `port` option may say otherwise) and rescans on every change.
4. Read the build log. Each `⚠ ng-prism:` line is a dropped value or a deprecated option;
   `references/troubleshooting.md` has the cause and the fix for each. A composed variant with a problem in its
   template is named there with the variant and the position, and renders without its template until it is fixed. The line
   `ng-prism: Generated manifest with N component(s)` (or `Verified (unchanged)`) tells you whether the component was
   found. A service shows as `with N component(s), M service(s)` and a pipe as `, K pipe(s)`; when that part is missing and
   the "no plugin shows services" or "no plugin shows pipes" hint is in the log, they were left out. If the styleguide runs in a process you didn't start and
   you can't read its output, ask for the log or run `ng run <lib>:prism-build` once: it scans the same way and prints
   the same lines.
5. Check every variant you touched in the browser (next section) and look at each image. For a service or a pipe,
   capture its API page with `--service` or `--pipe` and check that its JSDoc reads cleanly there.
6. Report the URL, the variant, service or pipe, what the screenshot shows and any warning that's left.
7. Stop the background process unless the user wants it running. Install nothing without asking.

## Checking in the browser

`scripts/screenshot.mjs` next to this file drives Playwright from the user's project. Run it from the project root:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/screenshot.mjs" --component ButtonComponent --variant 1
node "${CLAUDE_SKILL_DIR}/scripts/screenshot.mjs" --component ButtonComponent --variant 1 --state 0
node "${CLAUDE_SKILL_DIR}/scripts/screenshot.mjs" --component ButtonComponent --shell
node "${CLAUDE_SKILL_DIR}/scripts/screenshot.mjs" --service NotificationService
node "${CLAUDE_SKILL_DIR}/scripts/screenshot.mjs" --pipe TimeAgoPipe
```

- By default it opens the variant in capture mode (`?capture=1`: the component alone on its background, motion
  frozen) and screenshots `.demo-wrap`. `--shell` takes the whole window, styleguide UI included.
- A variant without `bg`, or with `bg: 'transparent'`, comes back with a transparent background (a PNG with alpha).
  Viewers show transparent pixels differently; if a light or dark component is hard to judge, look at `--shell` too.
- `--state <index>` captures the variant in one of the component's `states` (`@Showcase({ states })`; 0-based, in
  source order, listed in `window.__PRISM_MANIFEST__`). Without it no state is active. A state doesn't fit every
  variant, for example one with `states: false`, or one whose target the variant doesn't render. The script then prints
  `<Class> variant <n> × state <m> is excluded: <reason>`, takes no screenshot and exits `4`. That is a result, not a
  failure: report the cell as excluded, with the reason.
- `--url` (default `http://localhost:4400`, https with a self-signed certificate works), `--out <file.png>` (default:
  the system temp dir, `prism-<Class>-<variant>.png`, with `-s<state>` after the variant for a state),
  `--timeout <ms>` (default 30000).
- It prints the URL and the PNG path and lists browser console errors. Open the PNG and look at it.
- It selects the variant and the state through URL parameters, like the URL below, and `urlState: false` in
  `ng-prism.config.ts` turns them off. The script then times out with "Variant never rendered"; ask before switching `urlState` back on.
- Exit codes: `0` saved. `1` the styleguide doesn't answer, the component, variant or state doesn't exist (it lists
  the components and variants that do), the class is a part (it names the parent and the URL of the part's block on
  the parent's API tab: screenshot the parent instead), the variant or the service or pipe page never rendered (it saves the full window for diagnosis), or the
  screenshot failed, e.g. for a component without a visible size (`--shell` still works). `2` invalid arguments. `3`
  Playwright or its Chromium is missing or won't start: suggest `npm i -D playwright && npx playwright install chromium`
  (on Linux with missing system libraries `npx playwright install --with-deps chromium`) and run it only if the user
  agrees. `4` the state doesn't fit the variant, see `--state` above and `references/troubleshooting.md`.

A service has no canvas: its page shows nothing but what its JSDoc says, rendered by `jsDocPlugin()` in the API tab.
`--service <ClassName>` captures that page at its full length, without the sidebar and header, so you can check that
the JSDoc you wrote comes out clean: the description and its Markdown, the usage snippet, the setup table with its
defaults, the members with their `@param` texts, and the type cards with their links. It opens
`?service=<ClassName>&view=jsdoc` and waits for `[data-prism-service-rendered="<ClassName>"]` and the highlighted
code blocks. It can't be combined with `--component`, `--variant`, `--state` or `--shell` (exit `2`), and the PNG goes
to `prism-service-<Class>.png` in the system temp dir unless `--out` says otherwise. Services aren't listed in
`window.__PRISM_MANIFEST__`, so a wrong class name, a service the build left out (no `jsDocPlugin()` 22.7.0 or newer,
see `references/services-and-pipes.md`) and `urlState: false` all look the same: the page never renders, the script saves the
full window for diagnosis and exits `1`. Check the build log line `with N component(s), M service(s)` first. A page
taller than 15000 px is cut there.

`--pipe <ClassName>` does the same for a pipe: it opens `?pipe=<ClassName>&view=jsdoc`, waits for
`[data-prism-pipe-rendered="<ClassName>"]` and the highlighted code blocks, and captures the page at its full length,
where you check the description, the usage snippet with its template line, the setup table and every `transform()`
row with its overloads, parameters and `@param` texts. It can't be combined with `--service`, `--component`,
`--variant`, `--state` or `--shell` (exit `2`), and the PNG goes to `prism-pipe-<Class>.png`. Pipes aren't listed in
`window.__PRISM_MANIFEST__` either: a wrong class name, an NgModule pipe, a pipe the build left out (no
`jsDocPlugin()` 22.7.0 or newer, see `references/services-and-pipes.md`) and `urlState: false` all end in the page never rendering
and exit `1`. The build log line says `, K pipe(s)` when the pipe was kept.

Without Playwright, use a browser tool if you have one (Playwright MCP, Chrome DevTools MCP, Claude in Chrome): open
`http://localhost:4400/?component=<ClassName>&variant=<index>&capture=1`, wait for
`.demo-wrap[data-prism-rendered="<ClassName>:<index>"]`, then take the screenshot. For a state add
`&state=<stateIndex>`, wait for `<ClassName>:<index>:<stateIndex>` and skip the screenshot when `.demo-wrap` has a
`data-prism-excluded` attribute (its value is the reason). For a service open
`http://localhost:4400/?service=<ClassName>&view=jsdoc` and wait for `[data-prism-service-rendered="<ClassName>"]`; for
a pipe open `?pipe=<ClassName>&view=jsdoc` and wait for `[data-prism-pipe-rendered="<ClassName>"]`; for the API tab of
a component or directive open `?component=<ClassName>&view=jsdoc` and wait for
`[data-prism-component-rendered="<ClassName>"]`. A part has its block on the parent's API tab:
`?component=<Parent>&view=jsdoc&part=<PartClass>` scrolls there, and the marker names `<Parent>`. Otherwise give the
user that URL. This is ng-prism's public External
Tooling API; `window.__PRISM_MANIFEST__` lists every component, its variants and its states, and under a component its
`parts` (`@Showcase({ partOf })`, never as components of their own), but no services or pipes.

## Guides

- `guide/showcase-decorator.md`, `guide/variants.md`, `guide/inputs-and-controls.md`, `guide/states.md`,
  `guide/content-projection.md`, `guide/compositions.md`, `guide/directive-hosting.md`, `guide/parts.md`,
  `guide/component-pages.md`, `guide/services-and-pipes.md` (services, pipes and `setup`), `guide/scanner-reads.md`,
  `plugins/jsdoc.md`
- `api/showcase-config.md` (every field), `api/build-warnings.md` (every build message),
  `guide/external-tooling.md` (URL parameters, render marker, capture mode)
