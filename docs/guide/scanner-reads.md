# What the Scanner Reads

The builder never runs your code. It reads the `@Showcase` argument from the source with the TypeScript compiler, so every value in it has to be spelled out there, or in a constant it can follow. The same rules apply to what it reads from the class: the default of an input, the alias of an input or output, the `selector` and `standalone` of `@Component` and `@Directive`, the `name`, `pure` and `standalone` of `@Pipe`, and the `providedIn` of `@Injectable`.

## Values the scanner evaluates

| Works                                            | Example                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Strings, numbers, booleans, `null`, `undefined`  | `'Save'`, `42`, `-1`, `true`                                           |
| Arithmetic and string concatenation              | `5 * 1024 * 1024`, `'Step ' + 2`, `2 ** 10`                            |
| Template literals, with placeholders             | `` `${2 * 3} files` ``                                                 |
| Unary `-`, `+` and `!`                           | `-SPACING`, `!DISABLED`                                                |
| Type-only syntax, which it sees through          | `['pdf', 'png'] as const`, `x satisfies Size`, `value!`                |
| Array and object literals, nested                | `{ inputs: { tags: ['a', 'b'] } }`                                     |
| `const` constants, also imported                 | `MAX_FILES`, `5 * MB`                                                  |
| Enum members                                     | `Size.Medium`                                                          |
| Properties and indices of constants              | `TOKENS.size.m`, `SIZES[1]`, `tokens.MAX_FILES` on a namespace import  |
| Spread and shorthand of constants                | `{ ...SHARED_META }`, `{ label }`                                      |
| Computed keys that resolve to a string or number | `{ ['aria-label']: 'Close' }`, `{ [KEY]: 1 }`                          |
| Dates with arguments it can read                 | `new Date(2026, 3, 28)`, `new Date('2026-04-28')`, `new Date(RELEASE)` |

Each of these works as long as every part of it does: `5 * MB` works while `MB` is a `const` with a readable value.

- **A whole config in a constant** works: `@Showcase(FILE_INPUT_SHOWCASE)` reads the `const` like any other.
- **A spread** merges into the literal around it, and a later key wins over an earlier one, as in JavaScript.
- **A constant from a compiled package** is read from that package's `.d.ts`, which keeps a value only when it was a plain literal. `export const MAX_FILES = 3` arrives as `MAX_FILES = 3`; `export const MB = 1024 * 1024` arrives as `MB: number` and cannot be read.
- **A constant is read as its initializer says.** Changes made to it at runtime, such as `OPTIONS.push('pdf')` or `CONFIG.size = 'l'`, never happen for the scanner, so keep showcase values in constants that nothing changes.
- **A `Date` keeps the arguments you wrote.** One string or number, or the year, the month and up to five more numbers. The styleguide makes the `Date` when it loads, in the time zone of the browser, so it is the `Date` your code makes, see [Dates](guide/variants.md#dates).

## What it drops

Anything else would need the code to run, so the scanner drops it:

| Does not work                                 | Example                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `let` and `var` variables                     | `let retries = 3`                                                         |
| Constants without a value                     | `declare const MB: number`, a compiled package's `MB` above               |
| Conditions, comparisons and logical operators | `dark ? 'dark' : 'light'`, `label ?? 'OK'`, `a === b`                     |
| Function and method calls                     | `megabytes(5)`, `items.map(toOption)`                                     |
| Functions, classes and instances              | `(value) => value.length > 0`, `new Map()`, a method in an object literal |
| `new Date()` without arguments                | `new Date()`, the current time, which would differ in every build         |
| A result JSON cannot hold                     | `1 / 0`, `0 / 0`                                                          |
| Constants that refer back to themselves       | `A` in one file built from `B` in another, which is built from `A`        |

Functions, classes and instances are a limit of the approach, not of the scanner: they only exist once code runs, and the static manifest has no way to hold them. A `Date` is the one instance it reads, since its arguments say all there is to it. The one function that is read is [`setup: () => [...]`](api/showcase-config.md#setup) on a service or a pipe: the scanner reads the array literal it returns from the source and never calls it.

Only the value that cannot be read is lost. A property, an array element or a spread is dropped, and the object or array around it keeps everything else. A property or index read from a constant fails as well when something it depends on was dropped from that constant, rather than reading a wrong value. Each drop prints a warning naming the class, where the value sat in the config, the source text and its location, and, when a reference failed, why:

```
⚠ ng-prism: FileInputComponent › variants[4] "Retry" › inputs.retries — "retries" (projects/my-lib/src/file-input/file-input.component.ts:31:41) cannot be evaluated statically and was dropped: retries is declared with let; only const declarations can be read.
```

A value inside a constant is reported where the constant writes it, so the location points to the line to fix even when the constant lives in another file. When the whole argument cannot be read, as in `@Showcase(buildShowcase('File input'))`, the class is skipped, and the warning says so.

To fix a warning, write the value out: `maxFileSize: 5 * 1024 * 1024` instead of `megabytes(5)`. To make the build fail on these warnings, for example in CI, set [`strictShowcase`](api/ng-prism-config.md#strictshowcase). Every message is under [Build Warnings](api/build-warnings.md#showcase-values).

The default of an input is the exception: it is read the same way, but a default that cannot be read is dropped as a whole and without a warning, see [Defaults](guide/inputs-and-controls.md#defaults).

## Base classes and mixins

Inputs and outputs that a component inherits are read from its base classes, whether they sit in the same file, in another file, or in another library behind a path mapping. Which of them count is under [Inherited inputs](guide/inputs-and-controls.md#inherited-inputs). Two kinds of base class cannot be read:

- **A base class that only exists as a declaration.** A class from an npm package ships only its `.d.ts`, where `options = input.required<…>()` has become `readonly options: InputSignal<…>`: no call is left to read `required` or a default from. The same holds for a `declare class` and for a class inside `declare module` or `declare namespace`. The build prints a notice that names the inputs it cannot see, by the names a template uses, see [Inputs from a base class without source](api/build-warnings.md#inputs-from-a-base-class-without-source). Those inputs have no control, and variants cannot set them. If you have the base class's source, map its package to the `.ts` files through a path mapping, and the scan reads them.
- **A mixin.** In `extends withTracking(Base)` the base is a function call, and what it returns has no class declaration to read members from. The scan stops there: neither the mixin nor anything behind it contributes inputs.

These notices do not count for [`strictShowcase`](api/ng-prism-config.md#strictshowcase), since the component's author often cannot change the base class.

## Watch mode across libraries

The [`serve`](api/builders.md#serve) builder rescans when a `.ts` file changes below the [`entryPoint`](api/builders.md#entrypoint) directory, or below the directory of the entry file when `entryPoint` is a file. What the scan reads from outside that directory, such as a base class or a constant in another library behind a path mapping, is read on every rescan, but editing it does not start one. The next change inside the watched directory, or a restart, picks it up. What `serve` watches is under [Watching and reloading](api/builders.md#watching-and-reloading).

## Related

- [ShowcaseConfig](api/showcase-config.md): every field and the values it takes
- [Build Warnings](api/build-warnings.md#showcase-values): the messages for values the scanner drops
- [Inputs & Controls](guide/inputs-and-controls.md): how inputs, defaults and inherited inputs are read
- [Scanner](architecture/scanner.md): how the scan works inside
