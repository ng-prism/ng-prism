# Compositions

A composition renders the showcased component or directive, the subject, together with other markup, as one Angular template (since 22.7.0). Two fields write it: a variant's [`template`](api/showcase-config.md#template) is what the subject holds, and a [host template](api/showcase-config.md#host), `host: { template }`, is what the subject sits in. [`imports`](api/showcase-config.md#imports) names the classes from outside your library that either of them uses. This page shows how to use the three; the field reference has their types and rules.

## When to use a composition

[`content`](guide/content-projection.md) is HTML that ng-prism parses in the browser and hands to the component as projected nodes. That is enough for text, markup and elements that need no connection to the component around them. It is not enough when the parts find each other through Angular: a form field reads its control with `contentChild`, a radio group collects its radios with `contentChildren`, and a control injects the field it sits in. Those queries and injections only see what the same template declares.

A composition is that template. ng-prism compiles it ahead of time together with your classes: the build writes a wrapper component per showcase into the manifest, and the canvas creates that wrapper instead of the component. Use one when the subject works together with other classes of your library:

- **The subject holds them:** a form field with its input, a select with its options. Write a variant [`template`](#template).
- **The subject sits in them:** a directive in its form field, one radio of three in a group, a card in a frame of a fixed width. Write a [host template](#host-template).

A composition keeps everything another showcase has: the variant tabs, the Overview, [`states`](guide/states.md), the Controls and Events panels, the **Angular template** popover, a11y, Box Model, Perf, Figma and visual regression. A demo that needs providers of its own, state of its own or more than one subject is a component page instead, see [Composition, renderPage or a component page?](guide/component-pages.md#composition-renderpage-or-a-component-page).

### What the canvas shows

- **`states` and `pseudo` resolve against the whole composition.** `{ hover: '.lib-form-field__box' }` finds an element of the frame, `{ 'focus-visible': '.lib-input' }` the input, and `true` means every element of the composition, see [Selectors reach the whole composition](guide/states.md#selectors-reach-the-whole-composition).
- **a11y, Box Model, measuring, Figma and visual regression work on the whole composition,** since that is what the canvas renders. The a11y audit sees the label that belongs to the frame instead of an unlabelled input. The wrapper is a block element: in `fit` the canvas shrinks around its content, in `stretch` it fills the width.
- **Perf measures the whole composition,** see [Perf](plugins/perf.md#metrics).
- **The Events panel lists the outputs of the subject,** not those of other parts.
- **The usage snippet of the [JSDoc](plugins/jsdoc.md#components-and-directives) plugin** shows the subject inside the host template of the showcase.
- **`PrismRendererService`** has both elements: `renderedElement` is the root of the whole composition, `subjectElement` the subject, see [Runtime Services](api/services.md#prismrendererservice).

### Limits

- Overlays that render into `<body>`, such as the panel of a select or a datepicker popup, are not part of the composition. The Overview, a visual regression capture and the a11y audit do not include them.
- Live controls exist for the subject only, see [What the Controls panel can edit](#what-the-controls-panel-can-edit).

## template

A variant `template` is an Angular template that ng-prism compiles as the content of the subject:

```typescript
@Showcase<FormFieldComponent>({
    title: 'Form Field',
    imports: [{ name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' }],
    variants: [
        { name: 'Default', inputs: { label: 'E-Mail' }, template: '<input libInput type="email" />' },
        { name: 'Required', inputs: { label: 'E-Mail' }, template: '<input libInput type="email" required />' },
        { name: 'With icon', inputs: { label: 'Search' }, template: '<lib-icon libPrefix name="search" /><input libInput />' },
        { name: 'Note', inputs: { label: 'Note' }, template: '<textarea libInput cdkTextareaAutosize></textarea>' }
    ]
})
@Component({ selector: 'lib-form-field' /* ... */ })
export class FormFieldComponent {
    readonly label = input('');
}
```

The first variant renders as `<lib-form-field label="E-Mail"><input libInput type="email" /></lib-form-field>`, and the **Angular template** popover shows exactly that, with the current values of the controls on the `lib-form-field` element.

- **The subject is written for you.** ng-prism writes the element of the subject from its selector, binds its inputs and outputs to the Controls and Events panels, and puts the template inside. There is nothing to mark.
- **Angular picks the slot.** `<lib-icon libPrefix>` lands in `<ng-content select="[libPrefix]">` the way it does in an application, so a template needs no record of slots like `content` does.
- **Any template syntax works,** bindings with literals, control flow (`@if`, `@for`), template reference variables and event bindings included.
- **Expressions have no context.** Literals work (`[options]="['a', 'b']"`), and so do template reference variables (`#picker` and `[for]="picker"`). A member such as `[value]="size"` does not: there is no component class of yours behind the template. The generated wrapper has members of its own, but they are not API and change between releases.
- **A template is read from the source,** like every other value, see [What the Scanner Reads](guide/scanner-reads.md). A string, a template literal with constants as placeholders and a `const` all work. A call or a `let` is dropped with a warning.
- **`template` wins over `content`.** A variant with both keeps the template and drops `content` with a warning.

### On a directive

A directive gets the template as the content of the element it renders on. With a string or an object [`host`](guide/directive-hosting.md), the template renders inside that host element: a string host gives its tag and attributes, an object host its selector with the static `inputs`, and the class of its `import` joins the imports of the wrapper. Variants without a `template` render as they do without one:

```typescript
@Showcase({
    title: 'Tooltip',
    host: '<button class="btn">',
    variants: [
        { name: 'Text', inputs: { libTooltip: 'Saves a draft' }, content: 'Save' },
        { name: 'With icon', inputs: { libTooltip: 'Saves a draft' }, template: '<lib-icon name="save" /> Save' }
    ]
})
@Directive({ selector: '[libTooltip]' })
export class TooltipDirective {
    readonly libTooltip = input('');
}
```

`Text` renders `<button class="btn" libTooltip>Save</button>`. `With icon` renders the same button with the compiled `<lib-icon name="save" /> Save` inside. The host has to be one element for a template to render in; a string host of another form, or an object host without `selector` or `import`, leaves the variants without their template, with a warning.

A void element takes no content: a directive that renders on `<input>` or `<img>` cannot have a variant `template`, see [Void Elements](guide/directive-hosting.md#void-elements).

## Host template

`host: { template }` is an Angular template the subject renders in. It works for directives and for components, on the showcase and on a single variant, where it replaces the host template of the showcase for that variant:

```typescript
@Showcase<InputDirective>({
    title: 'Input',
    host: { template: '<lib-form-field label="Name"><input libInput type="text" /></lib-form-field>' },
    variants: [
        { name: 'Default' },
        { name: 'Required', inputs: { required: true } },
        {
            name: 'With hint',
            host: { template: '<lib-form-field label="Name" hint="As on your ID"><input libInput /></lib-form-field>' }
        }
    ]
})
@Directive({ selector: 'input[libInput], textarea[libInput]' })
export class InputDirective {
    readonly required = input(false);
}
```

The classes the template uses are found as for a variant template, see [imports](#imports), and its expressions have the same limits, see [template](#template). A showcase without variants renders its host template as its one variant.

### Where the subject is

The subject is the element that the selector of the subject matches. ng-prism matches the way Angular does, selector lists included, so you write `<input libInput>` as a user of your library would.

When several elements match, such as three `lib-radio` in a group, mark the one you mean with `prism-subject`. The others stay static instances:

```typescript
@Showcase<RadioComponent>({
    title: 'Radio',
    host: {
        template: `
            <lib-radio-group name="size">
                <lib-radio value="s">Small</lib-radio>
                <lib-radio prism-subject value="m">Medium</lib-radio>
                <lib-radio value="l">Large</lib-radio>
            </lib-radio-group>`
    }
})
@Component({ selector: 'lib-radio' /* ... */ })
export class RadioComponent {
    readonly value = input('');
}
```

The template writes `value` on the subject itself, which makes `value` the template's input, see [What the Controls panel can edit](#what-the-controls-panel-can-edit). `prism-subject` is removed from the compiled template and from the **Angular template** popover.

- **No match, or several without a mark,** is a warning, and the variant renders as it would without a host template:

    ```
    ⚠ ng-prism: InputDirective › variants[2] "With hint" › host — the selector "input[libInput], textarea[libInput]" matches no element of the host template (src/lib/input.directive.ts:14:20)
    ⚠ ng-prism: RadioComponent › host — the selector "lib-radio" matches 3 elements of the host template; mark one with prism-subject (src/lib/radio.component.ts:9:9)
    ```

- **A mark on an element the selector does not match** is a warning for a component. For a directive, ng-prism adds the attributes its selector asks for to the marked element.

The Controls, the Events panel and the **Angular template** popover belong to the subject. The rest of the template is part of what renders.

### Content in a host template

- A variant `template` replaces what the subject holds in the host template.
- HTML `content` cannot go into an element inside a compiled template. On a component variant that renders in a host template it is dropped with a warning that points to `template`. A directive keeps a string `content`: it becomes the text of the subject element.

### Around a component

A string or object `host` has no effect on a component, and the build drops it with a notice that does not fail a [`strictShowcase`](api/ng-prism-config.md#strictshowcase) build. To render a component inside other markup, such as a frame of a fixed width, write that markup as a host template:

```typescript
@Showcase({ title: 'Data Field', host: { template: '<div style="width: 180px;"><lib-data-field /></div>' } })
```

Turning an ignored string host into a host template changes what renders, so check the visual regression baselines of that component.

## imports

ng-prism has to know every class the templates use, because it compiles them into the manifest of the styleguide. It finds them in two ways.

**Your library, automatically.** Every component, directive and pipe that an entry point of the library exports is a candidate, with or without `@Showcase` and also when marked `@internal`. A class is imported when its selector matches an element of the template and the matching part names something you wrote: a custom element (its name has a `-`) or an attribute Angular's DOM schema does not know. So `<lib-icon>` and `libInput` import their classes, while `type`, `required` and `tabindex` do not, and neither does a class name. A directive with a broad selector such as `input[type=email]` does not attach to every `<input type="email">`, which is also what a user of your library would get without importing it. A pipe is imported when the template calls it by name.

When a library class matches only by standard attributes, the build prints a notice that names it. Here a library directive `EmailDirective` has the selector `input[type=email]`. List it in `imports` to apply it:

```
⚠ ng-prism: FormFieldComponent › imports — EmailDirective on <input> matches only by standard attributes and is not imported; add it here to apply it (src/lib/form-field.component.ts:10:11)
```

**Everything else, in `imports`.** A list of `{ name, from }` pairs for what your library does not export itself: classes from another package, and Angular's own pipes and directives. Angular's built-in pipes need an entry too, `{ name: 'DatePipe', from: '@angular/common' }` for `date` and `{ name: 'AsyncPipe', from: '@angular/common' }` for `async`.

```typescript
@Showcase({
    title: 'Form Field',
    imports: [
        { name: 'CdkTextareaAutosize', from: '@angular/cdk/text-field' },
        { name: 'DatePipe', from: '@angular/common' }
    ]
    // ...
})
```

- **Strings, not class references.** [`ng-prism-strip`](guide/library-publishing.md) removes the decorator from the published library, and an `import` statement that only the decorator used would stay behind in the bundle.
- **Each entry is looked up** in the declarations of its module (`.d.ts` or source), resolved the way a bundler does, so a package that only has `exports`, like `@angular/cdk`, resolves. That is how ng-prism knows the selector (`textarea[cdkTextareaAutosize]`) and can check `name` and `from`. An entry it cannot read, an NgModule for instance, is still imported as written, with a notice, and Angular checks the template.
- **A library class that is not standalone** is not imported, since Angular takes only standalone classes in `imports`. The build says so in a notice; add the NgModule that declares it to `imports`.
- **Two library components that match one element** are a warning, as they are an error in Angular (`NG0300`).

## What the Controls panel can edit

The Controls panel and a variant's `inputs` belong to the subject. Values for other parts of the composition are written in the template, per variant. A frame showcase cannot have a control for the `disabled` of the `<input>` inside it: write it into the template of a variant, as in `<input libInput disabled />`.

What a host template writes on the subject element itself, a static attribute (`<input libInput required>`) or a binding (`[libDatepicker]="picker"`), belongs to the template. ng-prism does not bind that input in this variant, for two reasons: a template reference such as `picker` cannot come from `inputs`, and Angular would see two competing bindings. The control of that input shows `Not editable`, with the reason "Set by the template of this variant", and a value for it in `inputs` is dropped with a warning:

```typescript
@Showcase<DatepickerInputDirective>({
    title: 'Datepicker Input',
    host: {
        template: `
            <lib-form-field label="Date">
                <input [libDatepicker]="picker" />
                <lib-datepicker-toggle [for]="picker" />
                <lib-datepicker #picker />
            </lib-form-field>`
    }
})
```

```
⚠ ng-prism: DatepickerInputDirective › variants[0] "Open" › inputs.libDatepicker — set by the template on the subject; the variant value was dropped (src/lib/datepicker-input.directive.ts:18:60)
```

An attribute without a value that the selector of the subject names does not count. For a `TooltipDirective` with the selector `[libTooltip]`, `<lib-button libTooltip>` only puts the directive on the element, so the control for `libTooltip` stays editable.

An input whose default the scanner could not read, and that the variant does not set, shows `Not editable` too, with the reason "Its default is unknown to ng-prism": the wrapper leaves it unbound, so the component keeps its own default. Every reason is listed under [What the Controls panel cannot edit](guide/inputs-and-controls.md#what-the-controls-panel-cannot-edit).

## Errors

ng-prism checks each composed template with Angular's own parser before it writes the manifest. What it finds is reported as a `⚠ ng-prism:` warning with the component, the variant, the field and the position in your showcase. Only that variant renders without its composition, as if it had no `template` and no host template. The styleguide still builds and the other variants stay as they are:

```
⚠ ng-prism: FormFieldComponent › variants[1] "Broken" › template — Unexpected closing tag "div". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags (src/lib/form-field.component.ts:14:27)
⚠ ng-prism: FormFieldComponent › variants[2] "Typo" › template — <lib-icn> matches no imported component (src/lib/form-field.component.ts:15:25)
```

These are warnings, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns them into a build error. The main ones:

- Syntax errors: unclosed tags, an end tag on a void element, broken bindings. An element left open at the end of a template or a host template counts too: Angular closes it on its own at the top of a template, but not inside the generated wrapper.
- An element that is neither standard HTML nor matched by an imported component or directive, and a pipe nothing declares.
- Two library components on one element.
- A host template whose subject cannot be found, see [Where the subject is](#where-the-subject-is).
- A value in `inputs` for an input that the host template sets on the subject.
- A directive with a variant `template` whose string host is not one element, or whose object host has no `selector` or no `import`: its variants render without their template.
- A `template` or `host` that is not a string or `{ template }`, and an `imports` entry that is not `{ name, from }` or whose `name` is not the name a class is exported under (`default` included).
- A showcased component or directive that is not standalone: the generated wrapper can only import a standalone class, so none of its variants is composed.

Where an import that ng-prism cannot read may declare what is missing, an unknown element or pipe is only a notice, and Angular decides. Notices do not count for `strictShowcase`.

What only Angular finds, such as a binding to an input the subject does not have, fails the styleguide build with an error in `ng-prism-cache/<lib>-prism/prism-manifest.ts`. The wrapper there has a comment above each case that names the showcase file, the line and the variants it renders, so look for the comment above the line Angular reports. In `serve`, the error overlay goes away with the next save.

This list is not complete. Every message, with its cause and fix, is under [Build Warnings › Compositions and hosts](api/build-warnings.md#compositions-and-hosts).

## Related

- [`template`](api/showcase-config.md#template), [`host`](api/showcase-config.md#host) and [`imports`](api/showcase-config.md#imports) in the ShowcaseConfig reference, [`HostTemplate`](api/types.md#hosttemplate) and [`ShowcaseImport`](api/types.md#showcaseimport) in Types
- [Content Projection](guide/content-projection.md): HTML `content` for components without Angular parts
- [Directive Hosting](guide/directive-hosting.md): a string or object `host` for a directive
- [Parts](guide/parts.md): components that only exist inside the one a composition shows
- [Component Pages](guide/component-pages.md): a demo that needs more than a template
- [Build Warnings › Compositions and hosts](api/build-warnings.md#compositions-and-hosts)
