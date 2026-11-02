# Content Projection

Use the `content` field on a variant to project HTML into a component's `<ng-content>` slots. Each variant sets its own; there is no component-level default.

`content` is plain HTML. When the content has to be real Angular, such as a component that finds its children with `contentChildren`, use [`template`](#compiled-content-template) instead.

## Single Slot

Pass a plain string to project into the default (unnamed) slot:

```typescript
@Showcase({
    title: 'Button',
    variants: [
        { name: 'With Icon', content: '<svg viewBox="0 0 16 16">...</svg> Save' },
        { name: 'Text Only', content: 'Save' }
    ]
})
@Component({
    selector: 'lib-button',
    template: `<button><ng-content /></button>`
})
export class ButtonComponent {}
```

## Multi-Slot Content

Pass a `Record<string, string>` where each key is a CSS selector matching an `<ng-content select="...">` and the special key `'default'` targets the unnamed slot.

```typescript
@Showcase({
    title: 'Card',
    variants: [
        {
            name: 'Full',
            content: {
                '[card-header]': '<h3>Card Title</h3>',
                '[card-footer]': '<button>Action</button>',
                default: '<p>This is the card body content.</p>'
            }
        },
        {
            name: 'Header Only',
            content: {
                '[card-header]': '<h3>Card Title</h3>'
            }
        }
    ]
})
@Component({
    selector: 'lib-card',
    template: `
        <div class="card">
            <div class="card__header"><ng-content select="[card-header]" /></div>
            <div class="card__body"><ng-content /></div>
            <div class="card__footer"><ng-content select="[card-footer]" /></div>
        </div>
    `
})
export class CardComponent {}
```

Each key has to match the `select` attribute of an `<ng-content>` exactly as the template writes it; `default` (or a plain string) goes to the unnamed one. Content for a slot the template doesn't have is dropped with a console warning: `[ng-prism] Variant content "<key>" matches no <ng-content> of <Class>, skipping it.`

> Up to 22.5.0 the slots were filled by position instead: `default` went into the first `<ng-content>` of the template and the other keys into the following ones in the order written, so the card above rendered its body in the header slot.

## HTML Content

Content strings are treated as raw HTML and injected via the renderer. You can include any valid HTML markup:

```typescript
content: `
  <strong>Bold text</strong> and
  <em>italic text</em> in the same slot.
`;
```

## Compiled Content (`template`)

`content` is HTML that ng-prism parses in the browser and hands to the component as projected nodes. That is enough for text, markup and elements that need no connection to the component around them. It is not enough when the parts find each other through Angular: a form field reads its control with `contentChild`, a radio group collects its radios with `contentChildren`, and a control injects the field it sits in. Those queries and injections only see what the same template declares.

`template` (since `22.7.0`) is an Angular template that ng-prism compiles together with your classes, as the content of the showcased component or directive:

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

The first variant renders as `<lib-form-field label="E-Mail"><input libInput type="email" /></lib-form-field>`, and the **Code** popover shows exactly that, with the current values of the controls on the `lib-form-field` element. A showcase that renders its subject with other markup like this is a composition. It keeps everything another showcase has: the variant tabs, the Overview, `states`, Controls, the Events panel, the code snippet, a11y, Box Model, Perf, Figma and visual regression.

- **The subject is written for you.** ng-prism writes the element of the showcased component from its selector, binds its inputs and outputs to the Controls and Events panels, and puts the template inside. There is nothing to mark.
- **Angular picks the slot.** `<lib-icon libPrefix>` lands in `<ng-content select="[libPrefix]">` the way it does in an application, so a template needs no record of slots like `content` does. A directive gets the template as the content of its host element.
- **Any template syntax works,** bindings with literals, control flow (`@if`, `@for`), template reference variables and event bindings included.
- **Expressions have no context.** Literals work (`[options]="['a', 'b']"`), and so do template reference variables (`#picker` and `[for]="picker"`). A member such as `[value]="size"` does not: there is no component class behind the template. The generated wrapper has members of its own, but they are not API and change between releases.
- **A template is read from the source,** like every other value, see [What the Scanner Reads](guide/scanner-reads.md). A string, a template literal with constants as placeholders and a `const` all work. A call or a `let` is dropped with a warning.
- **`template` wins over `content`.** A variant with both keeps the template and drops `content` with a warning.
- **Void elements take no content.** A directive that renders on `<input>` or `<img>` cannot have a variant `template`, see [Directive Hosting](guide/directive-hosting.md#void-elements).

To put the subject inside a template of its own, such as a directive in its form field or one of three radios in a group, use [`host: { template }`](guide/directive-hosting.md#host-template).

### Imports

ng-prism has to know every class the template uses, because it compiles the template into the manifest of the styleguide. It finds them in two ways.

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

The entries are strings, not class references. `ng-prism-strip` removes the decorator from the published library, and an `import` statement that only the decorator used would stay behind in the bundle.

ng-prism looks each entry up in the declarations of the module (`.d.ts` or source), resolving it the way a bundler does, so a package that only has `exports`, like `@angular/cdk`, resolves. That is how it knows the selector (`textarea[cdkTextareaAutosize]`) and can check `name` and `from`. An entry it cannot read, an NgModule for instance, is still imported as written, with a notice, and Angular checks the template.

Two library components that match one element are an error, as in Angular (`NG0300`).

### Errors

ng-prism checks each composed template with Angular's own parser before it writes the manifest. What it finds is reported as a `⚠ ng-prism:` warning with the component, the variant, the field and the position in your showcase. Only that variant renders without its composition, as if it had no `template`. The styleguide still builds and the other variants stay as they are:

```
⚠ ng-prism: FormFieldComponent › variants[1] "Broken" › template — Unexpected closing tag "div". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags (src/lib/form-field.component.ts:14:27)
⚠ ng-prism: FormFieldComponent › variants[2] "Typo" › template — <lib-icn> matches no imported component (src/lib/form-field.component.ts:15:25)
```

These are warnings that [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns into build errors:

- Syntax errors: unclosed tags, an end tag on a void element, broken bindings. An element left open at the end of a template or host template counts too: Angular closes it on its own at the top of a template, but not inside the generated wrapper.
- An element that is neither standard HTML nor matched by an imported component or directive, and a pipe nothing declares.
- Two library components on one element.
- A value in `inputs` for an input that the template sets on the subject itself, see [Host template](guide/directive-hosting.md#host-template).
- A `template` or `host` that is not a string or `{ template }`, and an `imports` entry that is not `{ name, from }` or whose `name` is not the name a class is exported under (`default` included).
- A showcased component or directive that is not standalone: the generated wrapper can only import a standalone class, so none of its variants is composed.

Where an import that ng-prism cannot read may declare what is missing, an unknown element or pipe is only a notice, and Angular decides. Notices do not count for `strictShowcase`. A library class that is not standalone gets one too: Angular takes only standalone classes in `imports`, so ng-prism does not import it, and you add the NgModule that declares it to `imports`.

What only Angular finds, such as a binding to an input the subject does not have, fails the styleguide build with an error in `ng-prism-cache/<lib>-prism/prism-manifest.ts`. The wrapper there has a comment above each case that names the showcase file, the line and the variants it renders, so look for the comment above the line Angular reports. In `serve`, the error overlay goes away with the next save.

### What the canvas shows

- **Controls and `inputs` belong to the subject.** Values for other parts of the composition are written in the template, per variant. A control for an input that the template sets on the subject, or whose default ng-prism could not read and the variant does not set, shows `Not editable` with the reason as its tooltip.
- **`states` and `pseudo` resolve against the whole composition.** `{ hover: '.lib-form-field__box' }` finds an element inside the frame and `{ 'focus-visible': '.lib-input' }` the input, and `true` means every element of the composition.
- **a11y, Box Model, measuring, Figma and visual regression work on the whole composition,** since that is what the canvas renders. The a11y audit sees the label that belongs to the frame instead of an unlabelled input. The wrapper is a block element: in `fit` the canvas shrinks around its content, in `stretch` it fills the width.
- **Perf measures the whole composition.** See [Perf](plugins/perf.md#metrics).
- **The Events panel lists the outputs of the subject,** not those of other parts.
- **The usage example of the [JSDoc plugin](plugins/jsdoc.md#components-and-directives)** shows the subject inside its host template.

### Known limits

- Overlays that render into `<body>`, such as a select's panel or a datepicker popup, are not part of the composition. The Overview, a visual regression capture and the a11y audit do not include them.
- Live Controls exist for the subject only. A frame showcase cannot have a control for the `disabled` of the `<input>` inside it: write it in the template of a variant, as in `<input libInput disabled />`.

## Limitations

`content` strings are static HTML. Angular template syntax (`*ngIf`, `[(ngModel)]`, event bindings) does not work inside them, because they are not compiled as Angular templates.

For content made of components or directives, or content that needs bindings, use [`template`](#compiled-content-template) instead of `content`. Use a [Component Page](guide/component-pages.md) with `renderPage` only when the demo is not a composition of your library's classes, for example when it needs a service of its own or mock data wired to state that only the page owns. See [Component Pages: Composition or page](guide/component-pages.md#composition-or-page).

## Directive Host Content

For directives, content is placed inside the host element rather than projected via `<ng-content>`. See [Directive Hosting](guide/directive-hosting.md) for details.
