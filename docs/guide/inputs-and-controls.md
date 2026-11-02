# Inputs & Controls

ng-prism reads the inputs of a showcased component or directive from its source: their names, types, defaults and aliases. Variants set them through `inputs`, and the Controls panel offers a control for each one, so you can change them while you look at the canvas. This page covers how the inputs are read and what the Controls panel makes of them. Setting them per variant is under [Variants](guide/variants.md).

## Type-safe inputs

Pass the component class as a type argument to `@Showcase` to get autocomplete and type checking on every variant's `inputs`:

```typescript
@Showcase<ButtonComponent>({
    title: 'Button',
    variants: [
        { name: 'Primary', inputs: { label: 'Save', variant: 'primary' } },
        { name: 'Danger', inputs: { label: 'Delete', variant: 'danger' } }
    ]
})
@Component({/* ... */})
export class ButtonComponent {
    label = input.required<string>();
    variant = input<'primary' | 'secondary' | 'danger'>('primary');
    closed = output<void>();
}
```

The compiler then checks three things:

1. **Keys:** only the declared signal inputs (`label`, `variant`) are accepted. A typo like `inputs: { lable: 'Save' }` fails to compile.
2. **Values:** each value has to fit the input's type. `variant: 'tertiary'` is rejected, because the union does not include it.
3. **No outputs:** `output()` fields such as `closed` are not inputs and are not accepted.

`input()`, `input.required()` and `model()` count as inputs. For a transform input, such as `input(false, { transform: booleanAttribute })`, the accepted type is the one the transform reads, not the parsed value, so you write what you would write in an Angular template.

Without the type argument, `inputs` takes any `Record<string, unknown>`. [`InputsOf<T>`](api/types.md#inputsof) has the mapping. Inputs declared with `@Input()` are not part of it, see [Decorator inputs and outputs](#decorator-inputs-and-outputs).

## Input types and controls

The scanner resolves the type of every input at build time with the TypeScript compiler: from the type argument (`input<string>()`), else from the default (`input('md')`), and for an `@Input()` from the property's type. The Controls panel picks a control by that type:

| Type in the source                                                         | Control                               |
| -------------------------------------------------------------------------- | ------------------------------------- |
| `string`                                                                   | Text field                            |
| `number`                                                                   | Number field; an empty field sets `0` |
| `boolean`                                                                  | Toggle switch                         |
| A union of string literals, `'sm' \| 'md' \| 'lg'`                         | One button per value                  |
| An object, an interface, a `Record`, an array                              | JSON editor                           |
| Anything else, such as a union of numbers, `string \| number` or `unknown` | JSON editor                           |

`null` and `undefined` in a union do not count: `'sm' | 'md' | undefined` gets one button per value, and `string | null` a text field. The JSON editor applies what you type once it parses; while it does not, it says `Invalid JSON` and the input keeps its last value.

Each control is labelled with the input's member name and its type. Once you change a value, a **Reset** button at the top of the panel sets every input back to what the active variant gives it.

```typescript
@Component({/* ... */})
export class TagComponent {
    label = input.required<string>();
    count = input<number>(0);
    active = input(false);
    size = input<'sm' | 'md' | 'lg'>('md');
    style = input<Record<string, string>>({});
}
```

The Controls panel shows:

- `label`: a text field, empty, since a required input has no default
- `count`: a number field with `0`
- `active`: a toggle switch, off
- `size`: three buttons `sm`, `md` and `lg`, with `md` selected
- `style`: a JSON editor with `{}`

A plugin can bring a control of its own for the inputs it recognizes, which then replaces the built-in one, see [Add a custom control](plugins/writing-plugins.md#add-a-custom-control).

## Defaults

The scanner reads an input's default from the source: the first argument of `input()` and `model()`, or the initializer of an `@Input()` property. It evaluates it like a `@Showcase` value, so a literal, a constant or an enum member works, see [What the Scanner Reads](guide/scanner-reads.md).

```typescript
label = input('Click me'); // default: 'Click me'
variant = input<'primary' | 'ghost'>('primary'); // default: 'primary'
```

A variant that does not set an input shows it at its default, and without a default the input is `undefined`. A required input has no default, so give it a value in each variant. The **Angular template** popover, behind the code button on the canvas rail, leaves out an input that is `undefined`, and one that is at its default, unless the variant sets it. How the values of a variant and those you change in the Controls panel go together is under [Explicit keys](guide/variants.md#explicit-keys).

A default the scanner cannot read, such as `input(createOptions())`, is left out as a whole, since a part of it would overwrite the real one. Its control starts empty. ng-prism does not set the input in a variant that leaves it out, and the component starts with its own default, as long as no other variant of the showcase sets the input: then the variants that leave it out set it to `undefined`. In a variant with a [`template` or a host template](guide/compositions.md), such an input reads `Not editable`, see [What the Controls panel cannot edit](#what-the-controls-panel-cannot-edit).

## Inherited inputs

Inputs and outputs declared in a base class belong to the showcased component as well. Variants can set them, and the Controls panel lists them:

```typescript
@Directive()
export abstract class ListboxField<T> {
    options = input.required<T[]>();
    value = model<T | null>(null);
}

@Showcase<CountryPickerComponent>({
    title: 'Country picker',
    variants: [{ name: 'Countries', inputs: { options: ['de', 'jp'], value: 'de' } }]
})
@Component({/* ... */})
export class CountryPickerComponent extends ListboxField<string> {}
```

- **Order:** the component's own inputs come first, then those of each base class, nearest first. An input the subclass declares again replaces the one of its base class.
- **Generic base classes:** a type parameter resolves to what the subclass passes, so `options` above is a `string[]` input. An input that does not use a type parameter keeps its type as written, type alias names included.
- **Only decorated base classes count.** Angular inherits inputs and outputs only from a base class with `@Directive()` or `@Component()`, and so does the scan. An undecorated base class compiles without an error, but its inputs are not inputs of the component, so they are left out.
- **A value the subclass assigns** to an inherited input (`override title = 'child'` for an `@Input() title = 'base'`) becomes its default, since the component starts out with it. If that value cannot be read at build time, the input has no default.

A base class that only exists as a declaration, such as one from an npm package, and a mixin are not read, see [Base classes and mixins](guide/scanner-reads.md#base-classes-and-mixins).

## Aliased inputs

An input declared with an alias keeps its member name everywhere you write it, and ng-prism binds it by its public name:

```typescript
size = input<'md' | 'lg'>('md', { alias: 'buttonSize' });
```

```typescript
variants: [{ name: 'Large', inputs: { size: 'lg' } }];
```

- **Variants and the Controls panel** use the member name: `inputs: { size: 'lg' }`, and the control is labelled `size`.
- **The rendered component** gets the value by its alias. On a directive, the generated wrapper binds the alias on the host element.
- **The Angular template** popover writes the alias, `buttonSize="lg"`, as a consumer of the library would.
- **Outputs** with an alias are logged in the Events panel under their member name.

The scanner reads an alias from the options of `input()`, `input.required()`, `model()` and `output()`, and from `@Input('x')`, `@Input({ alias: 'x' })` and `@Output('x')`. It has to be a string literal or a constant. An alias the scanner cannot evaluate, or one equal to the member name, is ignored.

## What the Controls panel cannot edit

Some inputs show `Not editable` in place of a control. Hover it for the reason:

| Reason                                | When                                                                                                                                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Set by the template of this variant` | The variant's host template sets the input on the subject element, with an attribute or a property binding. The template owns it, see [What the Controls panel can edit](guide/compositions.md#what-the-controls-panel-can-edit) under Compositions |
| `Its default is unknown to ng-prism`  | A variant with a `template` or a host template does not set an input whose default the scanner cannot read. The generated wrapper leaves it unbound, so the component keeps its own default                                                         |
| `Framework reference type`            | The input's type names `TemplateRef`, `ElementRef` or `ViewContainerRef`, which wrap live framework objects that no control can produce                                                                                                             |

The first two hold for that variant only, the third for every variant.

## Decorator inputs and outputs

Signal inputs and outputs, `input()`, `input.required()`, `model()` and `output()`, are the way ng-prism is built for. Inputs declared with `@Input()` and outputs declared with `@Output()` are read as well, and work in the styleguide with a few limits.

What works:

- The scanner reads an `@Input()`'s type, default, `required: true`, the values of a string-literal union, its alias and its JSDoc, and an `@Output()`'s name, alias and JSDoc. That holds for inputs a decorated base class declares, too.
- Variants set these inputs by their member name, an aliased one included.
- The Controls panel shows a control for each, picked by its type as for a signal input.
- The Events panel logs every emission of an `@Output()` under its member name.

The limits:

- **A build notice per class.** Every class that declares an `@Input()` prints `<Class> uses @Input() decorators which are not fully supported. Migrate to input() signals for full ng-prism support.`, and one that inherits them `<Class> inherits @Input() decorators from <Base>, which are not fully supported. …`. It is a notice, so [`strictShowcase`](api/ng-prism-config.md#strictshowcase) does not fail the build over it, see [Decorator inputs](api/build-warnings.md#decorator-inputs).
- **No typing through `@Showcase<T>`.** [`InputsOf<T>`](api/types.md#inputsof) only knows signal inputs. On a class that also has signal inputs, a key for a decorator input does not compile; on a class with decorator inputs only, `inputs` takes any key and checks nothing. Leave the type argument out for such a class.
- **No setter inputs.** `@Input() set value(v) { … }` is not read: the input has no control, and a variant that sets it gets a warning in the browser console and is ignored for that key.
- **No metadata arrays.** The `inputs` and `outputs` arrays of `@Component()` and `@Directive()` are not read.

To get full support, migrate the class to signal inputs and outputs with Angular's migrations:

```bash
ng generate @angular/core:signal-input-migration
ng generate @angular/core:output-migration
```

## Related

- [Variants](guide/variants.md): setting inputs per variant, and how the values of variants and controls go together
- [`inputs`](api/showcase-config.md#inputs) in the ShowcaseConfig reference, and [`InputsOf`](api/types.md#inputsof) in Types
- [Compositions](guide/compositions.md): templates that render the subject with other components
- [What the Scanner Reads](guide/scanner-reads.md): which defaults and values can be read
- [Build Warnings](api/build-warnings.md#decorator-inputs): the notices about decorator inputs and base classes
