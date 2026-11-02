# Types

All types exported from `ng-prism` or `ng-prism/plugin`.

---

## RuntimeManifest

The in-memory manifest produced after the builder scan and loaded at app bootstrap.

```typescript
interface RuntimeManifest {
    components: RuntimeComponent[];
    services?: RuntimeService[];
    pipes?: RuntimePipe[];
    pages?: StyleguidePage[];
}
```

`services` and `pipes` are only present when the library has [services](guide/showcasing-services.md) or [pipes](guide/showcasing-pipes.md) and a plugin shows them. Neither is ever part of `components`. Before 22.7.0 a showcased service or pipe was listed in `components` as a component; code that walks `components` no longer sees it, see [Breaking changes and deprecations in 22.7.0](guide/migration-v22.md#breaking-changes-and-deprecations-in-2270).

---

## RuntimeComponent

A single entry in the runtime manifest, combining scan metadata with the actual Angular class reference.

```typescript
interface RuntimeComponent {
    meta: ScannedComponent;
    type: Type<unknown>;
    composition?: Type<unknown>;
    parts?: RuntimePart[];
}
```

`composition` (since `22.7.0`) is the generated wrapper that renders the [compositions](#componentcomposition) of the showcase. The renderer sets its `__prismVariant__` input to the index of the variant and binds the inputs of the subject through the member names of the wrapper. It is only there when `meta.composition` is. When every variant is composed, `type` is the wrapper too. A variant without a composition renders `type` as before.

`parts` (since `22.7.0`) are the components whose [`partOf`](api/showcase-config.md#partof) names this one, sorted by title, see [`RuntimePart`](#runtimepart). It is missing for a component without parts. **Experimental**

---

## RuntimePart

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `RuntimePart` and `RuntimeComponent.parts`.

A part of a component or directive in the runtime manifest (since `22.7.0`): a showcase with [`partOf`](api/showcase-config.md#partof), which the styleguide shows on the page of its parent and never on a page of its own.

```typescript
interface RuntimePart {
    meta: ScannedComponent;
}
```

A part has `meta` and nothing else. It has no `type`, because the variants of the parent render it, and the manifest does not import its class, so a part costs no bundle size. The exception is a class that a [composition](#componentcomposition) of the parent names in its `imports`: that one is imported for the wrapper, as any class a template uses. A part is no longer in `RuntimeManifest.components`, so code that walks that list, such as a plugin or an external tool, does not see it as a component without variants.

---

## ScannedComponent

The raw data extracted from a `@Showcase`-annotated component by the TypeScript Compiler API scanner.

```typescript
interface ScannedComponent {
    className: string;
    filePath: string;
    showcaseConfig: ShowcaseConfig;
    inputs: InputMeta[];
    outputs: OutputMeta[];
    componentMeta: {
        selector: string;
        standalone: boolean;
        isDirective: boolean;
    };
    importPath?: string;
    baseClasses?: { className: string; filePath: string }[];
    api?: ComponentApi;
    composition?: ComponentComposition;
    parentClassName?: string;
    parts?: ScannedComponent[];
    meta?: Record<string, unknown>;
}
```

| Field                       | Description                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`                 | TypeScript class name                                                                                                                                                                                                                                                                                                                                                                         |
| `filePath`                  | Absolute path to the source file                                                                                                                                                                                                                                                                                                                                                              |
| `showcaseConfig`            | The `ShowcaseConfig` passed to `@Showcase`                                                                                                                                                                                                                                                                                                                                                    |
| `inputs`                    | Array of extracted `InputMeta` for each `input()` signal, base classes included                                                                                                                                                                                                                                                                                                               |
| `outputs`                   | Array of extracted `OutputMeta` for each `output()` signal, base classes included                                                                                                                                                                                                                                                                                                             |
| `componentMeta.selector`    | Angular element selector                                                                                                                                                                                                                                                                                                                                                                      |
| `componentMeta.standalone`  | Whether the component is standalone                                                                                                                                                                                                                                                                                                                                                           |
| `componentMeta.isDirective` | `true` if decorated with `@Directive`, `false` for `@Component`                                                                                                                                                                                                                                                                                                                               |
| `importPath`                | Import path of the entry point that exports the component (e.g. `'my-lib'` or `'my-lib/atoms'`). The scanner sets it for every entry point it scans, the primary one included                                                                                                                                                                                                                 |
| `baseClasses`               | Base classes with source the component extends, nearest first. Build time only, not in the manifest                                                                                                                                                                                                                                                                                           |
| `api`                       | What the API page needs beyond `inputs` and `outputs`, see [`ComponentApi`](#componentapi) (since `22.7.0`). Only read when a plugin sets [`componentApi`](api/ng-prism-plugin.md#componentapi), missing otherwise and when a plugin hook builds the component. **Experimental**                                                                                                              |
| `composition`               | What the variants render when they have a `template` or a host template, see [`ComponentComposition`](#componentcomposition) (since `22.7.0`). Missing when no variant is composed and when a plugin hook builds the component. **Experimental**                                                                                                                                              |
| `parentClassName`           | The class name of the component or directive this one is a part of, set when the selector in `showcaseConfig.partOf` resolved to exactly one other showcased class (since `22.7.0`). A plugin that works per page skips a component that has it. Missing for a component that is not a part, and for one whose `partOf` did not resolve, which stays a component of its own. **Experimental** |
| `parts`                     | The parts of the component, sorted by title (since `22.7.0`). Build time only: `onManifestReady` gets the parts here and not in `manifest.components`, and the runtime manifest carries them as [`RuntimeComponent.parts`](#runtimecomponent). `onComponentScanned` runs before the parts are nested and sees each as a component of its own. **Experimental**                                |
| `meta`                      | Plugin-injected metadata                                                                                                                                                                                                                                                                                                                                                                      |

The runtime manifest carries every field of `ScannedComponent` except `baseClasses`, `parentClassName` and `parts`. `baseClasses` stays build-time only. A part sits under its parent in [`RuntimeComponent.parts`](#runtimecomponent), next to the `meta` of the parent rather than inside it, which makes `parentClassName` redundant. Since `22.7.0` the manifest carries `importPath` and `api`, `api` only when a plugin in the config sets `componentApi`: an older core wrote neither, and the page of a plugin has to cope with a manifest that lacks them. `composition` is carried too, with its `imports` and without the `origin` of each case, which only the generated code uses.

The scan reads `composition` before the plugin hooks run. A hook that changes `showcaseConfig.variants[].template`, a host template or `imports` afterwards does not change what renders.

`className`, `filePath`, `showcaseConfig`, `inputs`, `outputs`, `componentMeta`, `importPath` and `meta` follow semver as they are. The shape of `api` does not, see below, and neither does the shape of `composition`, see [`ComponentComposition`](#componentcomposition).

---

## ComponentApi

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `ComponentApi`, which is `ScannedComponent.api`. The `Api*` types it uses are the ones of [`ServiceApi`](#serviceapi) and share its status.

What the API page of a component or directive needs beyond `inputs` and `outputs`, as the scanner extracts it for every component and directive (since `22.7.0`) when a plugin in the config sets [`componentApi`](api/ng-prism-plugin.md#componentapi). The JSDoc plugin draws the API tab from it, see [Components and Directives](plugins/jsdoc.md#components-and-directives). It shares `ApiDocTags`, `ApiTypeRef`, `ApiMethod` and `ApiTypeDoc` with `ServiceApi`, shown there.

```typescript
interface ComponentApi {
    description?: string;
    tags: ApiDocTags;
    inputTypes: Record<string, ApiTypeRef>; // by member name
    outputTypes: Record<string, ApiTypeRef>; // by member name
    modelChanges: { input: string; event: string; type: ApiTypeRef }[];
    methods: ApiMethod[];
    types: ApiTypeDoc[];
}
```

| Field          | Description                                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`  | The class's own description as Markdown, with `{@link}` kept as written. Missing without one                                                                                                                                                                                                                           |
| `tags`         | The tags of the class doc block: `deprecated`, `since`, `version`, `see` and `example`                                                                                                                                                                                                                                 |
| `inputTypes`   | The type of each input by member name (`InputMeta.name`, not the alias), as written in `input<T>()`, `model<T>()` or the annotation, else as the compiler infers it, with `links` to the cards. An input a generic base class declares in terms of its type parameters has the type the component instantiates it with |
| `outputTypes`  | The payload of each output by member name: the type argument of `output<T>()`, `EventEmitter<T>` or the annotation, `void` for an `output()` without one                                                                                                                                                               |
| `modelChanges` | One entry per `model()` input: `input` is its member name, `event` the change output Angular adds for it (`${alias ?? name}Change`) and `type` the type of the model. `ScannedComponent.outputs` has no entry for it                                                                                                   |
| `methods`      | The public methods that have a doc block of their own or an inherited one, with signatures from the code: one entry per overload signature, so a name can repeat. The rules of what is left out are those of a service, see [Showcasing Services](guide/showcasing-services.md#members)                                |
| `types`        | The documented types that the inputs, outputs and methods reach, recursively. A type is documented when any scanned entry point exports it and it is not `@internal`. An `id` is unique within this list                                                                                                               |

The other `ScannedComponent` fields, `InputMeta`, `OutputMeta` and the plugin data `showcaseConfig.meta.jsdoc` stay as they were: `api` only adds. A component in a build without a plugin that sets `componentApi`, one whose API the scan could not read, one built by a plugin hook, or one read from the manifest of an older core has no `api`, and a reader falls back to `inputs` and `outputs`.

---

## RuntimeService

A single service in the runtime manifest. It carries data only: the service class is never imported into the styleguide, since the page is documentation and an import would only add bundle size and side effects.

```typescript
interface RuntimeService {
    meta: ScannedService;
}
```

---

## ScannedService

The data the scanner extracts from a `@Showcase`-annotated class with `@Injectable` or `@Service` (since `22.7.0`), see [Showcasing Services](guide/showcasing-services.md). Plugins receive it in [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned).

```typescript
interface ScannedService {
    className: string;
    filePath: string;
    importPath?: string;
    showcaseConfig: ShowcaseConfig;
    provision: ServiceProvision;
    api: ServiceApi;
    meta?: Record<string, unknown>;
}

type ServiceProvision = 'auto' | 'manual';
```

| Field            | Description                                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`      | TypeScript class name. It is what `?service=` addresses                                                                                                                                                                       |
| `filePath`       | Absolute path to the source file. Build time use                                                                                                                                                                              |
| `importPath`     | Import path of the entry point that exports the service. Missing when the scanner could not place it                                                                                                                          |
| `showcaseConfig` | The `@Showcase` argument, reduced to the fields that apply to services: `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `meta`, `status`. `setup` is in `api.setup` |
| `provision`      | `'auto'` when Angular provides the service on its own (`@Service()`, `providedIn: 'root'`, `'platform'` or `'any'`), `'manual'` when a providers array has to list it                                                         |
| `api`            | The extracted API, see [`ServiceApi`](#serviceapi). **Experimental**                                                                                                                                                          |
| `meta`           | Plugin-injected metadata                                                                                                                                                                                                      |

`className`, `filePath`, `importPath`, `showcaseConfig`, `provision` and `meta` follow semver as they are. The shape of `api` does not, see below.

---

## ServiceApi

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `ServiceApi` and every `Api*` type below it: members, signatures, type cards, setup and the links between them. The first model is deliberately simple, and generics and statics can be refined in later minors. Read it in a plugin if you must, and expect to adjust it.

The documentation of one service, as the scanner extracts it. The JSDoc plugin draws the service page from it.

```typescript
interface ServiceApi {
    description?: string;
    tags: ApiDocTags;
    properties: ApiProperty[];
    methods: ApiMethod[];
    setup: ApiSetupEntry[];
    types: ApiTypeDoc[];
}

interface ApiDocTags {
    deprecated?: string | true;
    since?: string;
    version?: string; // from @version (since 22.7.0)
    see?: string[];
    example?: string[];
    default?: string; // from @default
}

interface ApiTypeRef {
    text: string; // as written, e.g. 'Signal<boolean>'
    links?: string[]; // ids of the api.types entries (ServiceApi, PipeApi or ComponentApi) named in the text
}

interface ApiParam {
    name: string;
    type: ApiTypeRef;
    optional: boolean;
    rest?: true;
    defaultValue?: string; // the initializer as written
    description?: string; // from @param
}

interface ApiMethod {
    name: string;
    params: ApiParam[];
    returnType: ApiTypeRef;
    description?: string;
    tags: ApiDocTags;
}

interface ApiProperty {
    name: string;
    type: ApiTypeRef;
    readonly: boolean;
    optional?: true;
    description?: string;
    tags: ApiDocTags;
}

interface ApiTypeDoc {
    id: string; // the name, or `${name}@${importPath}` when two reachable types share a name; unique within one service, pipe or component
    name: string;
    kind: 'interface' | 'class' | 'type' | 'enum';
    importPath: string;
    description?: string;
    tags: ApiDocTags;
    properties?: ApiProperty[]; // interfaces, classes, object type aliases
    methods?: ApiMethod[]; // interfaces and classes
    union?: string[]; // a type alias of literals
    text?: string; // any other type alias
    members?: { name: string; value?: string; description?: string }[]; // enums
    reachedFrom?: string; // e.g. 'parameter of show()', 'via options.action'
}

interface ApiSetupEntry {
    name: string;
    kind: 'function' | 'token';
    importPath: string;
    description?: string;
    tags: ApiDocTags;
    params?: ApiParam[]; // functions
    returnType?: ApiTypeRef; // functions
    tokenType?: ApiTypeRef; // tokens
    config?: ApiProperty[]; // options of the first parameter, or of the token's type argument
}
```

An overloaded method is one `ApiMethod` per overload signature, in source order, in `methods` and in the `methods` of a type card alike: the name repeats, and the implementation signature is left out. Each takes the doc block of its own, else the one of the implementation, else the description and `@param` texts of the first documented overload (not its tags), else the docs of the method in the nearest base class.

`ServiceProvision`, `PanelTarget`, `ServiceApi`, `ComponentApi`, `ApiDocTags`, `ApiTypeRef`, `ApiParam`, `ApiMethod`, `ApiProperty`, `ApiTypeDoc` and `ApiSetupEntry` are exported from `@ng-prism/core/plugin` (and `@ng-prism/core`), with `ScannedService` and `RuntimeService`. What is listed and what is left out is described in [Showcasing Services](guide/showcasing-services.md#members).

---

## RuntimePipe

A single pipe in the runtime manifest. Like a service, it carries data only: the pipe class is never imported into the styleguide.

```typescript
interface RuntimePipe {
    meta: ScannedPipe;
}
```

---

## ScannedPipe

The data the scanner extracts from a `@Showcase`-annotated class with `@Pipe` (since `22.7.0`), see [Showcasing Pipes](guide/showcasing-pipes.md). Plugins receive it in [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned).

```typescript
interface ScannedPipe {
    className: string;
    filePath: string;
    importPath?: string;
    showcaseConfig: ShowcaseConfig;
    pipeName: string;
    pure?: boolean;
    api: PipeApi;
    meta?: Record<string, unknown>;
}
```

| Field            | Description                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`      | TypeScript class name. It is what `?pipe=` addresses                                                                                                                                                                                                  |
| `filePath`       | Absolute path to the source file. Build time use                                                                                                                                                                                                      |
| `importPath`     | Import path of the entry point that exports the pipe. Missing when the scanner could not place it                                                                                                                                                     |
| `showcaseConfig` | The `@Showcase` argument, reduced to the fields that apply to pipes, the same as for a service: `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `meta`, `status`. `setup` is in `api.setup` |
| `pipeName`       | The name a template calls the pipe by, from `@Pipe({ name })`                                                                                                                                                                                         |
| `pure`           | From `@Pipe({ pure })`, `true` when the decorator does not say. Missing when it cannot be read                                                                                                                                                        |
| `api`            | The extracted API, see [`PipeApi`](#pipeapi). **Experimental**                                                                                                                                                                                        |
| `meta`           | Plugin-injected metadata                                                                                                                                                                                                                              |

`className`, `filePath`, `importPath`, `showcaseConfig`, `pipeName`, `pure` and `meta` follow semver as they are. The shape of `api` does not, see below.

---

## PipeApi

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** Like [`ServiceApi`](#serviceapi), this covers `PipeApi` and every `Api*` type below it.

The documentation of one pipe, as the scanner extracts it. The JSDoc plugin draws the pipe page from it. It shares `ApiDocTags`, `ApiMethod`, `ApiParam`, `ApiSetupEntry` and `ApiTypeDoc` with `ServiceApi`, shown there.

```typescript
interface PipeApi {
    description?: string;
    tags: ApiDocTags;
    transform: ApiMethod[]; // one entry per overload signature, or the implementation when there are none
    setup: ApiSetupEntry[];
    types: ApiTypeDoc[];
}
```

`PipeApi`, `ScannedPipe` and `RuntimePipe` are exported from `@ng-prism/core/plugin` (and `@ng-prism/core`). A pipe has no `properties` or `methods`: only `transform()` is read, see [Showcasing Pipes](guide/showcasing-pipes.md#transform).

---

## PanelTarget

Where a panel appears, the type of [`PanelDefinition.appliesTo`](api/ng-prism-plugin.md#panels-on-service-and-pipe-pages).

```typescript
type PanelTarget = 'component' | 'service' | 'pipe';
```

---

## InputMeta

Describes a single `input()` signal as extracted by the scanner.

```typescript
interface InputMeta {
    name: string;
    alias?: string;
    type: 'string' | 'number' | 'boolean' | 'union' | 'array' | 'object' | 'unknown';
    rawType?: string;
    values?: string[];
    defaultValue?: unknown;
    defaultUnreadable?: true;
    required: boolean;
    doc?: string;
    model?: true;
}
```

| Field               | Description                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`              | Property name; variants and controls use it                                                                                                                                                                                    |
| `alias`             | Public name from `alias` (or `@Input('x')`), when it differs from `name`                                                                                                                                                       |
| `type`              | Normalized type category used to select a control                                                                                                                                                                              |
| `rawType`           | Raw TypeScript type string (e.g. `'primary' \| 'danger'`)                                                                                                                                                                      |
| `values`            | For union types: the individual member values                                                                                                                                                                                  |
| `defaultValue`      | Value from `input(defaultValue)`                                                                                                                                                                                               |
| `defaultUnreadable` | `true` when the input starts out with a value the scan could not evaluate, such as the result of a function call (since `22.7.0`). `defaultValue` is missing then. Not set for `input<string>()`, which starts out `undefined` |
| `required`          | `true` if declared with `input.required<T>()`                                                                                                                                                                                  |
| `doc`               | JSDoc comment from the property, as written: `{@link X \| text}` keeps its bar (since `22.7.0`, see below)                                                                                                                     |
| `model`             | `true` for a `model()` or `model.required()` (since `22.7.0`). Angular adds the output `${alias ?? name}Change` for it, which `ScannedComponent.outputs` does not list, since no class member declares it                      |

`defaultUnreadable` is what tells a composition to leave an input alone. The wrapper of a [composed variant](#componentcomposition) does not bind an input with an unreadable default unless the variant sets it, because binding `undefined` would replace the default the subject has. In a variant that does not set it, its control reads `Not editable` with the reason "Its default is unknown to ng-prism".

`doc` of an input and of an output is the JSDoc comment of the property with its Markdown and `{@link}` tags as written. The bar of `{@link X | text}` stays since `22.7.0`, so a reader can tell the target from the text. Before, a link whose target TypeScript resolves to a symbol came out as `{@link Xtext}`.

---

## OutputMeta

Describes a single `output()` signal.

```typescript
interface OutputMeta {
    name: string;
    alias?: string;
    doc?: string;
}
```

`alias` is the public event name from `output({ alias })` or `@Output('x')`, when it differs from `name`. `doc` is the JSDoc comment of the property, read like `InputMeta.doc`.

---

## PanelDefinition

See [NgPrismPlugin: PanelDefinition](api/ng-prism-plugin.md#paneldefinition).

---

## ControlDefinition

See [NgPrismPlugin: ControlDefinition](api/ng-prism-plugin.md#controldefinition).

---

## StatusTone and StatusThreshold

`StatusTone` (`'ok' | 'warn' | 'danger'`) and `StatusThreshold` (`{ ok, warn, direction? }`) are the verdict and the threshold of `statusFor()`, exported from `@ng-prism/core/plugin` since `22.7.0`. See [NgPrismPlugin: Status grading](api/ng-prism-plugin.md#status-grading).

---

## StyleguidePage

Discriminated union for sidebar pages.

```typescript
type StyleguidePage = CustomPage | ComponentPage;
```

### CustomPage

A data-only page processed through the build pipeline. Requires a plugin panel to render `data`.

```typescript
interface CustomPage {
    type: 'custom';
    title: string;
    category?: string;
    categoryOrder?: number;
    order?: number;
    data: Record<string, unknown>;
}
```

### ComponentPage

A free-form Angular component rendered as a sidebar page. Registered via `providePrism`, not through the build pipeline.

```typescript
interface ComponentPage {
    type: 'component';
    title: string;
    category?: string;
    categoryOrder?: number;
    order?: number;
    component: Type<unknown>;
}
```

Use the `componentPage()` helper to create entries with TypeScript type safety:

```typescript
import { componentPage } from '@ng-prism/core';

componentPage({
    title: 'Button Patterns',
    category: 'Atoms',
    order: 99,
    component: ButtonPatternsPageComponent
});
```

---

## NavigationItem

Discriminated union used in `PrismNavigationService.sectionTree()` (the items of each category) and `PrismNavigationService.activeItem`.

```typescript
type NavigationItem =
    | { kind: 'component'; data: RuntimeComponent }
    | { kind: 'service'; data: RuntimeService }
    | { kind: 'pipe'; data: RuntimePipe }
    | { kind: 'page'; data: StyleguidePage };
```

The `'service'` and `'pipe'` kinds were added in 22.7.0 with [services](guide/showcasing-services.md) and [pipes](guide/showcasing-pipes.md). It is a public type, so any code that narrows a `NavigationItem` by `kind` and reads `data` needs a branch for each. That includes a plain two-way check: after `item.kind === 'component' ? … : item.data.title`, the `data` in the other branch is a `RuntimeService | RuntimePipe | StyleguidePage`, and `title` no longer type-checks. See [Breaking change: NavigationItem has two new kinds](guide/migration-v22.md#breaking-change-navigationitem-has-two-new-kinds) for a before and after.

---

## Variant

```typescript
interface Variant<T = unknown> {
    name: string;
    inputs?: Partial<InputsOf<T>>;
    content?: string | Record<string, string>;
    template?: string;
    host?: HostTemplate;
    description?: string;
    meta?: ShowcaseMeta;
    bg?: CanvasBg;
    canvasLayout?: CanvasLayout;
    pseudo?: ForcedPseudoStates;
    states?: false;
}
```

The optional type parameter `T` is the component class. When provided (via `@Showcase<MyComponent>({...})`), `inputs` becomes `Partial<InputsOf<MyComponent>>` and the editor checks both keys and values against the component's signal inputs. When omitted, `T` defaults to `unknown` and `inputs` falls back to `Record<string, unknown>`, which keeps it fully backwards compatible.

| Field          | Description                                                                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Tab label                                                                                                                                                                                                                                                                    |
| `inputs`       | Key-value map of input signal names to values. Typed via [`InputsOf<T>`](#inputsof) when a component generic is supplied to `@Showcase`.                                                                                                                                     |
| `content`      | Content projected into `<ng-content>`: string for single slot, record for named slots                                                                                                                                                                                        |
| `template`     | An Angular template, compiled as the content of the subject (since `22.7.0`). Wins over `content`. See [Compiled Content](guide/content-projection.md#compiled-content-template)                                                                                             |
| `host`         | A [`HostTemplate`](#hosttemplate) the subject renders in for this variant (since `22.7.0`). Overrides `ShowcaseConfig.host`. See [Host Template](guide/directive-hosting.md#host-template)                                                                                   |
| `description`  | Optional description rendered below the variant tab                                                                                                                                                                                                                          |
| `meta`         | Metadata for plugins (e.g. `{ figma: 'url' }`), a [`ShowcaseMeta`](#showcasemeta). `a11y.accept` adds [accepted violations](guide/accessibility.md#accepted-violations) to the component's for this variant.                                                                 |
| `bg`           | Recommended canvas background. Overrides `ShowcaseConfig.bg`. One of `dots`, `plain`, `light`, `dark`, `checker`, `transparent`. See [Per-Variant Background](guide/variants.md#per-variant-background).                                                                     |
| `canvasLayout` | Canvas layout mode for this variant. Overrides `ShowcaseConfig.canvasLayout`. One of `fit`, `stretch`. See [Per-Variant Canvas Layout](guide/variants.md#per-variant-canvas-layout) and the [`CanvasLayout`](#canvaslayout) type.                                            |
| `pseudo`       | Pseudo states forced on while the variant renders, each with the elements it applies to. See [Per-Variant Pseudo States](guide/variants.md#per-variant-pseudo-states) and the [`ForcedPseudoStates`](#forcedpseudostates) type.                                              |
| `states`       | `false` keeps the variant out of every combination with the component's [`states`](#showcasestate): it renders in its own pseudo states only, as a single cell in the Overview. No other value is valid. See [Opting a variant out](guide/variants.md#opting-a-variant-out). |

---

## ShowcaseState

One named combination of forced pseudo states, an entry of `ShowcaseConfig.states`. It applies on top of any variant that does not opt out with `Variant.states: false`.

```typescript
interface ShowcaseState {
    name: string;
    pseudo: ForcedPseudoStates;
}
```

| Field    | Description                                                                                                                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | Column title in the Overview, chip label in the tools menu and state name in a visual regression report. Unique within the component.                                                                                                           |
| `pseudo` | The pseudo states the state forces, with the same shape and meaning as `Variant.pseudo`, see [`ForcedPseudoStates`](#forcedpseudostates). Unlike `Variant.pseudo`, a state is forced only where it [fits](guide/variants.md#when-a-state-fits). |

```typescript
{ name: 'Hover', pseudo: { hover: '.btn' } }
{ name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } }
```

The position of a state in `ShowcaseConfig.states` is its identity: the `state` URL parameter, the render marker, [`DiscoveryState`](#discoverystate) and a visual regression report use that index. When a variant has a `pseudo` of its own, both are forced, and a pseudo-class both name goes to the targets of both.

`ShowcaseState` is exported from `@ng-prism/core`. See [Variants: States](guide/variants.md#states).

---

## InputsOf

Utility type that maps a component class to a record of its signal-input properties, unwrapped to their write-side value type.

```typescript
type InputsOf<T>;
```

**Selection rules**

- Picks fields declared as `input()`, `input.required()`, `model()`, or `input(..., { transform })`.
- Excludes `output()` and any other class members.
- Unwraps each signal to its write-side type. For transform inputs (e.g. `input(false, { transform: booleanAttribute })`) this is the source type (`string | boolean | ''`), not the parsed value type. That mirrors what callers actually write in `inputs: {...}`.
- When `T` is `unknown` (the default), evaluates to `Record<string, unknown>`.

**Example**

```typescript
import { booleanAttribute, input, model, output } from '@angular/core';

class FooComponent {
    label = input.required<string>();
    count = input<number>(0);
    active = input(false, { transform: booleanAttribute });
    selected = model<string>('');
    closed = output<void>();
}

// InputsOf<FooComponent> ≡
// {
//   label: string;
//   count: number;
//   active: string | boolean | '';
//   selected: string;
// }
```

`closed` is excluded because `output()` is not a signal input. `Variant<FooComponent>['inputs']` is `Partial<InputsOf<FooComponent>>`, so any subset of these keys is valid in a variant.

---

## DirectiveHost

```typescript
interface DirectiveHost {
    selector: string;
    import: { name: string; from: string };
    inputs?: Record<string, unknown>;
}
```

Used in `ShowcaseConfig.host` for directive showcases that require an Angular component as the host element. Exported from `@ng-prism/core` since `22.7.0`. See [Directive Hosting](guide/directive-hosting.md).

---

## HostTemplate

```typescript
interface HostTemplate {
    template: string;
}
```

The markup the showcased component or directive renders in, compiled as an Angular template (since `22.7.0`). The element that the selector of the subject matches is the subject, and `prism-subject` marks it when several match. Used in `ShowcaseConfig.host` and `Variant.host`; `ShowcaseConfig.host` is `string | DirectiveHost | HostTemplate`. See [Host Template](guide/directive-hosting.md#host-template).

---

## ShowcaseImport

```typescript
interface ShowcaseImport {
    name: string;
    from: string;
}
```

A class that the templates of a showcase use and ng-prism cannot find in the library on its own, an entry of `ShowcaseConfig.imports` (since `22.7.0`). `name` is the exported name (`'CdkTextareaAutosize'`) and `from` the module specifier (`'@angular/cdk/text-field'`). Strings, not a class reference, so that `ng-prism-strip` leaves no import behind. See [`imports`](api/showcase-config.md#imports).

`HostTemplate` and `ShowcaseImport` are exported from `@ng-prism/core`.

---

## ComponentComposition

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `ComponentComposition`, which is `ScannedComponent.composition`, `CompositionCase` and the four constants below.

What the variants of a showcase render when they have a `template` or a host template (since `22.7.0`): the distinct compositions, and which one each variant uses. It is `ScannedComponent.composition`, and the runtime manifest carries it next to the generated wrapper in [`RuntimeComponent.composition`](#runtimecomponent).

```typescript
interface ComponentComposition {
    variantCases: number[];
    cases: CompositionCase[];
    imports?: ShowcaseImport[];
}

interface CompositionCase {
    template: string;
    unbound: { name: string; reason: 'template' | 'default' }[];
    origin?: string;
}
```

| Field          | Description                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variantCases` | One entry per variant, or one for a showcase without variants, which renders as one implicit variant. Each is the index into `cases`, or `-1` for a variant without a composition, which renders as it did before                                                                    |
| `cases`        | One entry per distinct composition. Variants with the same markup and the same unbound inputs share one                                                                                                                                                                              |
| `imports`      | Every class the generated wrapper imports besides the subject: the library classes the templates use, the showcase's `imports` and the class of a directive's object host. Set by the scan and carried in the runtime manifest, so that a usage example in the browser can name them |

| `CompositionCase` field | Description                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template`              | The markup as written, the subject element included, with `COMPOSITION_SUBJECT_SLOT` at the end of the start tag of the subject. The code snippet replaces the slot with the current attributes, the generated wrapper with the bindings                |
| `unbound`               | The inputs of the subject that the wrapper does not bind in this case, by member name. `'template'`: the template sets the input itself. `'default'`: its default could not be read and the variant does not set it. Controls show them as not editable |
| `origin`                | Where the case comes from, as the variants and `file:line`. Set at build time for the comments and errors of the generated code, not in the runtime manifest                                                                                            |

A plugin that shows the markup of a variant, such as a snippet or a usage example, replaces the slot with the attributes of its choice. Four constants name what ng-prism puts into a composition and takes out of it, exported from `@ng-prism/core/plugin`:

| Constant                   | Value                  | Meaning                                                                                           |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `COMPOSITION_SUBJECT_SLOT` | `'\uE000'`             | Where the subject element takes its attributes and bindings in `CompositionCase.template`         |
| `COMPOSITION_SUBJECT_ATTR` | `'data-prism-subject'` | Attribute the generated wrapper puts on the subject element, which is how the styleguide finds it |
| `SUBJECT_MARKER_ATTR`      | `'prism-subject'`      | Attribute an author puts on the one of several matching elements that is the subject              |
| `PRISM_VARIANT_INPUT`      | `'__prismVariant__'`   | The input of the wrapper that selects the case of a variant                                       |

The `unbound` list is what the Controls panel and the snippet read: an input in it is neither bound nor written. See [Compiled Content](guide/content-projection.md#compiled-content-template) for how a composition is written and what the canvas shows.

---

## CanvasBg

Canvas background mode used by `ShowcaseConfig.bg` and `Variant.bg`.

```typescript
type CanvasBg = 'dots' | 'plain' | 'light' | 'dark' | 'checker' | 'transparent';
```

| Value         | Visual                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `dots`        | Dot grid over the themed surface (the canvas's own starting background)                                     |
| `plain`       | The themed surface, no pattern                                                                              |
| `light`       | Flat light surface, for components designed for light themes                                                |
| `dark`        | Flat dark surface, for components designed for dark themes                                                  |
| `checker`     | **Deprecated** (removed in 23.0.0). Checkerboard over the themed surface; captures as that surface's colour |
| `transparent` | Checkerboard while browsing, real transparency in a capture. Also the "nothing declared" answer             |

Two different defaults are in play. The canvas starts on `dots` and remembers whatever the user picks from the toolbar. A variant's background resolves to `transparent` when neither the variant nor its component declares one. That is `DEFAULT_VARIANT_BG`, which is what [`DiscoveryVariant.bg`](guide/external-tooling.md#reading-the-background) reports and what capture mode paints. It was `checker` in the first two `22.2.0` betas; see [the note on the change](guide/visual-regression.md#breaking-the-default-background-changed).

`light` and `dark` are flat by design, and their colours (`--prism-void-light`, `--prism-void-dark`) are absolute instead of theme tokens, which makes them the values to declare for a variant under [visual regression](guide/visual-regression.md#the-background-is-part-of-the-baseline). `dots`, `plain` and `checker` follow `--prism-bg-surface` and therefore the active theme.

`'checker'` is deprecated since 22.2.0 and removed in 23.0.0. It draws the same checkerboard as `'transparent'` while browsing, so the canvas cannot tell them apart. It does, however, capture as `--prism-bg-surface`, a theme token, which makes a baseline recorded on it depend on the theme the runner's browser started in. Use `'transparent'` for the same look with a capture that keeps its alpha, or `'light'`/`'dark'` for an absolute colour. The build warns for every component and variant that still declares it.

`transparent` has no colour at all. While browsing it renders as the checkerboard, which is already the UI's way of saying "no surface here"; a see-through canvas would just show the app shell through it. In capture mode it becomes real transparency. See [Capturing transparency](guide/visual-regression.md#capturing-transparency).

---

## CanvasLayout

Wrapper sizing mode used by `ShowcaseConfig.canvasLayout` and `Variant.canvasLayout`. Controls how `.demo-wrap` (the inner wrapper of the canvas stage) sizes itself around the rendered component.

```typescript
type CanvasLayout = 'fit' | 'stretch';
```

| Value     | Wrapper styles                                     | When to use                                                                                                                                                    |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit`     | `display: inline-block`, shrinks to component size | Default. The vast majority of components (buttons, badges, cards, alerts) render at their intrinsic size and are centered by the canvas stage flex.            |
| `stretch` | `display: block; width: 100%; max-width: 800px`    | Components without intrinsic width (horizontal dividers via `border-bottom`) or that opt into filling their container (full-width buttons with `width: 100%`). |

The variant-level value always wins over the component-level value; the default is `'fit'`.

With Viewport width on (canvas rail), `.demo-wrap` takes the width set there in both modes. A `fit` component is centred in it at its own size. A `stretch` component keeps `display: block` and fills it as it fills the canvas, also when the subject renders in a [`template`](guide/content-projection.md#compiled-content-template) or a [host template](guide/directive-hosting.md#host-template).

---

## PseudoState

A user-action pseudo-class a variant or a [component state](#showcasestate) can force on, used as a key of [`ForcedPseudoStates`](#forcedpseudostates).

```typescript
type PseudoState = 'hover' | 'active' | 'focus' | 'focus-visible' | 'focus-within';
```

These are the states a script cannot hold: `:hover` and `:active` follow the pointer, and only one element in the document can be focused. A state an input can set, such as `:checked` or `:disabled`, belongs in `Variant.inputs`. `PSEUDO_STATES` lists every value, in the order the canvas tools menu shows them.

---

## ForcedPseudoStates

The type of `Variant.pseudo` and `ShowcaseState.pseudo`: which states a variant or a component state forces, and on which elements.

```typescript
type PseudoTarget = true | string | readonly string[];
type ForcedPseudoStates = Partial<Record<PseudoState, PseudoTarget>>;
```

| Target              | Forces the state on                                                                   |
| ------------------- | ------------------------------------------------------------------------------------- |
| `true`              | Every element of what is rendered, the host included                                  |
| `string`            | The elements matching the selector, matched against the host and everything inside it |
| `readonly string[]` | The elements matching any of the selectors                                            |

What is rendered is the whole [composition](#componentcomposition) for a variant with a `template` or a host template, so a selector reaches the frame and the other parts too, and `true` means every element of them.

```typescript
{ 'focus-visible': '.btn' }                          // the inner <button> of the host
{ hover: true }                                      // the whole component
{ hover: '.pill', 'focus-visible': '.pill__close' }  // two states on two elements
```

`PseudoState`, `PseudoTarget`, `ForcedPseudoStates` and `PSEUDO_STATES` are exported from `@ng-prism/core/plugin` (and `@ng-prism/core`). How the states are forced, and what cannot be forced, is described in [Per-Variant Pseudo States](guide/variants.md#per-variant-pseudo-states).

---

## DiscoveryState

One component-level state in `window.__PRISM_MANIFEST__`, the entries of `DiscoveryComponent.states`. The manifest is the discovery view for [external tooling](guide/external-tooling.md#enumerating-what-exists).

```typescript
interface DiscoveryState {
    name: string;
    index: number;
    pseudo: ForcedPseudoStates;
}
```

| Field    | Description                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | The state's name, as declared in `@Showcase({ states })`                                                                                                                           |
| `index`  | 0-based position in the declared `states` array, the `?state=` URL value                                                                                                           |
| `pseudo` | The states it forces, as declared, see [`ForcedPseudoStates`](#forcedpseudostates). `{}` for a slot that forces nothing; it stays listed so the indices behind it keep their value |

`DiscoveryComponent.states` is omitted when the component declares none, and `DiscoveryVariant.states` is `false` for a variant that opted out of the component's states and absent otherwise. `DiscoveryState` is exported from `@ng-prism/core/plugin`.

---

## DiscoveryPart

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `DiscoveryPart` and `DiscoveryComponent.parts`.

One part of a component or directive in `window.__PRISM_MANIFEST__` (since `22.7.0`), the entries of `DiscoveryComponent.parts`. The manifest is the discovery view for [external tooling](guide/external-tooling.md#enumerating-what-exists).

```typescript
interface DiscoveryPart {
    className: string;
    title: string;
    selector: string;
    inputs: string[];
    outputs: string[];
}
```

| Field       | Description                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className` | The class name of the part                                                                                                                                           |
| `title`     | `ShowcaseConfig.title`, the display name                                                                                                                             |
| `selector`  | The selector of the class, as `@Component` or `@Directive` declares it                                                                                               |
| `inputs`    | The public names of its inputs: the `alias` where there is one, the member name otherwise                                                                            |
| `outputs`   | The public names of its outputs: the `alias` where there is one, the member name otherwise, then the change output of each `model()` input, `${alias ?? name}Change` |

`DiscoveryComponent.parts` is omitted when the component has no [parts](api/showcase-config.md#partof). A part is not in `DiscoveryManifest.components`: it has no variants and no render marker of its own, and a tool that walks the components does not visit it. `DiscoveryPart` is exported from `@ng-prism/core/plugin`.

---

## ComponentStatus

Optional migration / maturity badge used by `ShowcaseConfig.status`.

```typescript
type ComponentStatus = 'stable' | 'beta' | 'wip' | 'deprecated';
```

| Value        | Meaning                                  |
| ------------ | ---------------------------------------- |
| `stable`     | Migrated and production-ready            |
| `beta`       | Functional, but API may still change     |
| `wip`        | Work in progress, migration ongoing      |
| `deprecated` | Legacy component. Do not use in new code |

When `status` is omitted, no indicator renders. See [`ShowcaseConfig.status`](api/showcase-config.md#status) for the full UI behavior in sidebar and header.

---

## ShowcaseMeta

`meta` on [`ShowcaseConfig`](api/showcase-config.md#meta) and on a [`Variant`](#variant): open for plugins and projects, with `a11y` typed (since 22.7.0). Exported from `@ng-prism/core`, like `A11yShowcaseMeta` and `A11yAcceptance`.

```typescript
interface ShowcaseMeta {
    a11y?: A11yShowcaseMeta;
    [key: string]: unknown;
}

interface A11yShowcaseMeta {
    rules?: Record<string, { enabled: boolean }>; // component level: switch axe rules for the live audit
    disable?: boolean; // component level: skip the live audit
    accept?: A11yAcceptance[]; // component and variant: audited and shown, not counted
    [key: string]: unknown;
}

interface A11yAcceptance {
    rule: string; // axe rule id
    reason: string; // required
}
```

A rule switched off with `enabled: false` is not audited at all; an accepted violation is audited and shown under _Accepted_ with its reason, but not counted. The build adds the a11y report's entry for the component (`found`, `score`, `summary`) next to these keys. See [Accepted violations](guide/accessibility.md#accepted-violations).

---

## ShowcaseSetupRef

An entry of [`ShowcaseConfig.setup`](api/showcase-config.md#setup): a function or an injection token that configures a service or a pipe.

```typescript
type ShowcaseSetupRef = ((...args: never[]) => unknown) | InjectionToken<unknown>;
```

Any function fits, whatever it takes and returns; ng-prism only reads its name, signature and type from the source and never calls it. Exported from `@ng-prism/core`.

---

## PrismManifest

The build-time manifest written to disk by the builder. Contains JSON-serializable data only, no class references.

```typescript
interface PrismManifest {
    components: ScannedComponent[];
    services?: ScannedService[];
    pipes?: ScannedPipe[];
    pages?: StyleguidePage[];
}
```

`services` and `pipes` are only present when a plugin shows them, see [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned) and [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned). Neither is in `components`.
