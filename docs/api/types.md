# Types

The types of `@ng-prism/core` and `@ng-prism/core/plugin`, one section per type. The decorator types are exported from `@ng-prism/core`. The manifest, API, discovery and plugin types are exported from `@ng-prism/core/plugin`, and from `@ng-prism/core` as well. Each group below says where its types come from, and a type that differs says so itself.

The fields of `ShowcaseConfig` are in [ShowcaseConfig](api/showcase-config.md), those of `NgPrismConfig` in [NgPrismConfig](api/ng-prism-config.md), and the plugin interfaces (`NgPrismPlugin`, `PanelDefinition`, `PanelBadge`, `ControlDefinition`, `HeaderWidgetDefinition`, `NavigationDecorationDefinition`, `NavigationDecoration`) in [NgPrismPlugin](api/ng-prism-plugin.md).

## Manifest and scan

What the builder scans and writes, and what the styleguide app runs on. `PrismManifest` is the build-time manifest the plugin hooks see; `RuntimeManifest` is the one the app bootstraps with. Where the manifest is written is described in [Build Pipeline](architecture/pipeline.md). Exported from `@ng-prism/core/plugin` and `@ng-prism/core`.

### `PrismManifest`

The build-time manifest: what the scan found, after the plugin hooks. Plain data, `Date`s included, no class references. `onManifestReady` receives it, and the builder writes the runtime manifest from it.

```typescript
interface PrismManifest {
    components: ScannedComponent[];
    services?: ScannedService[];
    pipes?: ScannedPipe[];
    pages?: StyleguidePage[];
    meta?: Record<string, unknown>;
}
```

| Field               | Description                                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components`        | Every showcased component and directive. A [part](api/showcase-config.md#partof) is not in the list: it sits in the [`parts`](#scannedcomponent) of its parent                                                                                                                |
| `services`, `pipes` | Only present when a plugin shows services or pipes, see [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned) and [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned). A service or a pipe is never in `components`                                               |
| `pages`             | The `pages` of the config, after [`onPageScanned`](api/ng-prism-plugin.md#onpagescanned)                                                                                                                                                                                      |
| `meta`              | Library-wide plugin metadata, such as aggregate coverage totals. When there is an a11y report, the build adds `meta.a11y` after the plugin hooks: the report's `total` and the thresholds it is graded against, see [A11y Reports](guide/a11y-reports.md#what-the-build-adds) |

### `ScannedComponent`

What the scanner extracts from a component or directive with `@Showcase`. Plugins receive it in [`onComponentScanned`](api/ng-prism-plugin.md#oncomponentscanned).

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

| Field                       | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`                 | TypeScript class name                                                                                                                                                                                                                                                                                                                                                                       |
| `filePath`                  | Absolute path to the source file                                                                                                                                                                                                                                                                                                                                                            |
| `showcaseConfig`            | The [`ShowcaseConfig`](api/showcase-config.md) passed to `@Showcase`, as the scan read it                                                                                                                                                                                                                                                                                                   |
| `inputs`                    | One [`InputMeta`](#inputmeta) per input (`input()`, `model()` or `@Input()`), base classes included                                                                                                                                                                                                                                                                                         |
| `outputs`                   | One [`OutputMeta`](#outputmeta) per output (`output()` or `@Output()`), base classes included                                                                                                                                                                                                                                                                                               |
| `componentMeta.selector`    | The selector, as `@Component` or `@Directive` declares it                                                                                                                                                                                                                                                                                                                                   |
| `componentMeta.standalone`  | Whether the class is standalone                                                                                                                                                                                                                                                                                                                                                             |
| `componentMeta.isDirective` | `true` if decorated with `@Directive`, `false` for `@Component`                                                                                                                                                                                                                                                                                                                             |
| `importPath`                | Import path of the entry point that exports the class (e.g. `'my-lib'` or `'my-lib/atoms'`). The scanner sets it for every entry point it scans, the primary one included                                                                                                                                                                                                                   |
| `baseClasses`               | Base classes with source that the class extends, nearest first. Build time only, not in the manifest                                                                                                                                                                                                                                                                                        |
| `api`                       | What the API page needs beyond `inputs` and `outputs`, see [`ComponentApi`](#componentapi) (since 22.7.0). Only read when a plugin sets [`componentApi`](api/ng-prism-plugin.md#componentapi), missing otherwise and when a plugin hook builds the component. **Experimental**                                                                                                              |
| `composition`               | What the variants render when they have a `template` or a host template, see [`ComponentComposition`](#componentcomposition) (since 22.7.0). Missing when no variant is composed and when a plugin hook builds the component. **Experimental**                                                                                                                                              |
| `parentClassName`           | The class name of the component or directive this one is a part of, set when the selector in `showcaseConfig.partOf` resolved to exactly one other showcased class (since 22.7.0). A plugin that works per page skips a component that has it. Missing for a component that is not a part, and for one whose `partOf` did not resolve, which stays a component of its own. **Experimental** |
| `parts`                     | The parts of the class, sorted by title (since 22.7.0). Build time only: `onManifestReady` gets the parts here and not in `manifest.components`, and the runtime manifest carries them as [`RuntimeComponent.parts`](#runtimecomponent). `onComponentScanned` runs before the parts are nested and sees each as a component of its own. **Experimental**                                    |
| `meta`                      | Plugin-injected metadata                                                                                                                                                                                                                                                                                                                                                                    |

The runtime manifest carries every field except `baseClasses`, `parentClassName` and `parts`. A part sits under its parent in [`RuntimeComponent.parts`](#runtimecomponent), next to the `meta` of the parent rather than inside it, which makes `parentClassName` redundant. `composition` is carried with its `imports` and without the `origin` of each case, which only the generated code uses. `importPath` and `api` are in the runtime manifest since 22.7.0, `api` only when a plugin in the config sets `componentApi`, so the page of a plugin treats both as optional.

The scan reads `composition` before the plugin hooks run. A hook that changes `showcaseConfig.variants[].template`, a host template or `imports` afterwards does not change what renders.

`className`, `filePath`, `showcaseConfig`, `inputs`, `outputs`, `componentMeta`, `importPath` and `meta` follow semver as they are. The shapes of `api` and `composition` do not, see [`ComponentApi`](#componentapi) and [`ComponentComposition`](#componentcomposition).

### `InputMeta`

One input of a component or directive, as the scanner reads it: a signal input (`input()`, `input.required()`, `model()`) or an `@Input()`.

```typescript
interface InputMeta {
    name: string;
    alias?: string;
    type: 'string' | 'number' | 'boolean' | 'union' | 'date' | 'array' | 'object' | 'unknown';
    rawType?: string;
    values?: string[];
    emptyValue?: 'null' | 'undefined';
    defaultValue?: unknown;
    defaultUnreadable?: true;
    required: boolean;
    doc?: string;
    model?: true;
}
```

| Field               | Description                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | The class member; variants and controls use it                                                                                                                                                                               |
| `alias`             | The public name from `alias` (or `@Input('x')`), when it differs from `name`                                                                                                                                                 |
| `type`              | The type category that selects a control, see [Inputs & Controls](guide/inputs-and-controls.md#input-types-and-controls). `'date'` is the runtime's `Date`, also with `null` or `undefined` (since 22.8.0)                   |
| `rawType`           | The TypeScript type as text (e.g. `'primary' \| 'danger'`)                                                                                                                                                                   |
| `values`            | For a union of literals: the individual member values                                                                                                                                                                        |
| `emptyValue`        | For a `'date'`: what a cleared date field sets (since 22.8.0), see [Input types and controls](guide/inputs-and-controls.md#input-types-and-controls)                                                                         |
| `defaultValue`      | The initial value, such as the argument of `input(defaultValue)`. A `new Date(…)` default is a `Date`                                                                                                                        |
| `defaultUnreadable` | `true` when the input starts out with a value the scan could not evaluate, such as the result of a function call (since 22.7.0). `defaultValue` is missing then. Not set for `input<string>()`, which starts out `undefined` |
| `required`          | `true` for a required input: `input.required()`, `model.required()` or `@Input({ required: true })`                                                                                                                          |
| `doc`               | The JSDoc comment of the property, as written: `{@link X \| text}` keeps its bar (since 22.7.0), so a reader can tell the target from the text                                                                               |
| `model`             | `true` for a `model()` or `model.required()` (since 22.7.0). Angular adds the output `${alias ?? name}Change` for it, which `ScannedComponent.outputs` does not list, since no class member declares it                      |

`defaultUnreadable` is what tells a composition to leave an input alone. The wrapper of a [composed variant](#componentcomposition) does not bind an input with an unreadable default unless the variant sets it, because binding `undefined` would replace the default the subject has. In a variant that does not set it, its control reads `Not editable` with the reason "Its default is unknown to ng-prism".

### `OutputMeta`

One output of a component or directive: an `output()` or an `@Output()`.

```typescript
interface OutputMeta {
    name: string;
    alias?: string;
    doc?: string;
}
```

`alias` is the public event name from `output({ alias })` or `@Output('x')`, when it differs from `name`. `doc` is the JSDoc comment of the property, read like [`InputMeta.doc`](#inputmeta).

### `ComponentComposition`

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `ComponentComposition`, which is `ScannedComponent.composition`, and [`CompositionCase`](#compositioncase).

What the variants of a showcase render when they have a `template` or a host template (since 22.7.0): the distinct compositions, and which one each variant uses. It is `ScannedComponent.composition`, and the runtime manifest carries it next to the generated wrapper in [`RuntimeComponent.composition`](#runtimecomponent).

```typescript
interface ComponentComposition {
    variantCases: number[];
    cases: CompositionCase[];
    imports?: ShowcaseImport[];
}
```

| Field          | Description                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variantCases` | One entry per variant, or one for a showcase without variants, which renders as one implicit variant. Each is the index into `cases`, or `-1` for a variant without a composition, which renders the class itself                                                                    |
| `cases`        | One entry per distinct composition. Variants with the same markup and the same unbound inputs share one                                                                                                                                                                              |
| `imports`      | Every class the generated wrapper imports besides the subject: the library classes the templates use, the showcase's `imports` and the class of a directive's object host. Set by the scan and carried in the runtime manifest, so that a usage example in the browser can name them |

See [Compositions](guide/compositions.md) for how a composition is written and what the canvas shows.

### `CompositionCase`

One distinct composition of a showcase: the markup of one or more variants as the generated wrapper renders it (since 22.7.0). **Experimental**, like [`ComponentComposition`](#componentcomposition).

```typescript
interface CompositionCase {
    template: string;
    unbound: { name: string; reason: 'template' | 'default' }[];
    origin?: string;
}
```

| Field      | Description                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template` | The markup as written, the subject element included, with `COMPOSITION_SUBJECT_SLOT` at the end of the start tag of the subject. The code snippet replaces the slot with the current attributes, the generated wrapper with the bindings                |
| `unbound`  | The inputs of the subject that the wrapper does not bind in this case, by member name. `'template'`: the template sets the input itself. `'default'`: its default could not be read and the variant does not set it. Controls show them as not editable |
| `origin`   | Where the case comes from, as the variants and `file:line`. Set at build time for the comments and errors of the generated code, not in the runtime manifest                                                                                            |

A plugin that shows the markup of a variant, such as a snippet or a usage example, replaces the slot with the attributes of its choice. The `unbound` list is what the Controls panel and the snippet read: an input in it is neither bound nor written. The constants that name what ng-prism puts into a composition and takes out of it (`COMPOSITION_SUBJECT_SLOT`, `COMPOSITION_SUBJECT_ATTR`, `SUBJECT_MARKER_ATTR`, `PRISM_VARIANT_INPUT`) share the experimental status and are described in [Plugin UI Kit](api/plugin-ui.md#constants-and-helpers).

### `ScannedService`

What the scanner extracts from a class with `@Showcase` and `@Injectable` or `@Service` (since 22.7.0), see [Services & Pipes](guide/services-and-pipes.md#services). Plugins receive it in [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned).

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
```

| Field            | Description                                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`      | TypeScript class name. It is what `?service=` addresses                                                                                                                                                                                                                    |
| `filePath`       | Absolute path to the source file. Build time use                                                                                                                                                                                                                           |
| `importPath`     | Import path of the entry point that exports the service. Missing when the scanner could not place it                                                                                                                                                                       |
| `showcaseConfig` | The `@Showcase` argument, reduced to the [fields that apply to services](api/showcase-config.md#services-and-pipes): `title`, `description`, `category`, `categoryOrder`, `componentOrder`, `section`, `sectionOrder`, `tags`, `meta`, `status`. `setup` is in `api.setup` |
| `provision`      | How the service reaches the injector, see [`ServiceProvision`](#serviceprovision)                                                                                                                                                                                          |
| `api`            | The extracted API, see [`ServiceApi`](#serviceapi). **Experimental**                                                                                                                                                                                                       |
| `meta`           | Plugin-injected metadata                                                                                                                                                                                                                                                   |

`className`, `filePath`, `importPath`, `showcaseConfig`, `provision` and `meta` follow semver as they are. The shape of `api` does not, see [API model](#api-model).

### `ServiceProvision`

How a service reaches the injector (since 22.7.0).

```typescript
type ServiceProvision = 'auto' | 'manual';
```

`'auto'` when Angular provides the service on its own: `@Service()` unless it says `autoProvided: false`, or `@Injectable` with `providedIn: 'root'`, `'platform'` or `'any'`. `'manual'` when a providers array has to list it, which includes a `providedIn` the scan cannot read.

### `ScannedPipe`

What the scanner extracts from a class with `@Showcase` and `@Pipe` (since 22.7.0), see [Services & Pipes](guide/services-and-pipes.md#pipes). Plugins receive it in [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned).

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

`className`, `filePath`, `importPath`, `showcaseConfig`, `pipeName`, `pure` and `meta` follow semver as they are. The shape of `api` does not, see [API model](#api-model).

### `RuntimeManifest`

The manifest the styleguide app runs on. The generated `prism-manifest.ts` exports it with the real class references, and `providePrism()` takes it.

```typescript
interface RuntimeManifest {
    components: RuntimeComponent[];
    services?: RuntimeService[];
    pipes?: RuntimePipe[];
    pages?: StyleguidePage[];
    meta?: Record<string, unknown>;
}
```

| Field               | Description                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components`        | One [`RuntimeComponent`](#runtimecomponent) per component and directive, with its parts nested in it                                                          |
| `services`, `pipes` | Only present when the library has [services or pipes](guide/services-and-pipes.md) and a plugin shows them. A service or a pipe is never part of `components` |
| `pages`             | The pages of the config, and the component pages passed to `providePrism()`                                                                                   |
| `meta`              | Library-wide plugin metadata, mirrored from [`PrismManifest.meta`](#prismmanifest), `meta.a11y` included                                                      |

### `RuntimeComponent`

A single entry in the runtime manifest: the scan data plus the Angular class.

```typescript
interface RuntimeComponent {
    meta: ScannedComponent;
    type: Type<unknown>;
    composition?: Type<unknown>;
    parts?: RuntimePart[];
}
```

`composition` (since 22.7.0) is the generated wrapper that renders the [compositions](#componentcomposition) of the showcase. The renderer sets its `__prismVariant__` input to the index of the variant and binds the inputs of the subject through the member names of the wrapper. It is only there when `meta.composition` is. When every variant is composed, `type` is the wrapper too. A variant without a composition renders `type`.

`parts` (since 22.7.0) are the components whose [`partOf`](api/showcase-config.md#partof) names this one, sorted by title, see [`RuntimePart`](#runtimepart). It is missing for a component without parts. **Experimental**

### `RuntimePart`

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `RuntimePart` and `RuntimeComponent.parts`.

A part of a component or directive in the runtime manifest (since 22.7.0): a showcase with [`partOf`](api/showcase-config.md#partof), which the styleguide shows on the page of its parent and never on a page of its own.

```typescript
interface RuntimePart {
    meta: ScannedComponent;
}
```

A part has `meta` and nothing else. It has no `type`, because the variants of the parent render it, and the manifest does not import its class, so a part costs no bundle size. The exception is a class that a [composition](#componentcomposition) of the parent names in its `imports`: that one is imported for the wrapper, as any class a template uses. A part is not in `RuntimeManifest.components`, so code that walks that list, such as a plugin or an external tool, does not see it as a component without variants.

### `RuntimeService`

A service in the runtime manifest (since 22.7.0). It carries data only: the service class is never imported into the styleguide, since the page is documentation and an import would only add bundle size and side effects.

```typescript
interface RuntimeService {
    meta: ScannedService;
}
```

### `RuntimePipe`

A pipe in the runtime manifest (since 22.7.0). Like a service, it carries data only: the pipe class is never imported into the styleguide.

```typescript
interface RuntimePipe {
    meta: ScannedPipe;
}
```

### `StyleguidePage`

A page of the sidebar that is not a showcase, told apart by `type`.

```typescript
type StyleguidePage = CustomPage | ComponentPage;
```

Pages list in the pinned _Pages_ section at the top of the sidebar, grouped by `category` (`Docs` without one), in the order of the manifest; `categoryOrder` and `order` are carried but not used for sorting. The search matches a page by its title and its category. See [Component Pages](guide/component-pages.md).

### `CustomPage`

A page made of data, which goes through the build: declared in [`defineConfig({ pages })`](api/ng-prism-config.md#pages), passed through [`onPageScanned`](api/ng-prism-plugin.md#onpagescanned) and written into the manifest as JSON. The styleguide shows its title and its `data` as formatted JSON.

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

`customPage()` from `@ng-prism/core/plugin` builds one with `type` set.

### `ComponentPage`

An Angular component rendered as a page of the sidebar, and the page a [`renderPage`](api/showcase-config.md#renderpage) names by its `title`.

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

Register it in `main.ts` with the third argument of `providePrism()`, which takes the same fields without `type` (`ComponentPageOptions`, exported from `@ng-prism/core`). `componentPage()` builds a `ComponentPage` with `type` set. A `ComponentPage` in `defineConfig({ pages })` does not work: the build writes the config's pages into the manifest as JSON, and `component`, a class, does not survive that.

```typescript
providePrism(PRISM_RUNTIME_MANIFEST, config, {
    componentPages: [{ title: 'Button Patterns', category: 'Atoms', component: ButtonPatternsPageComponent }]
});
```

## API model

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `ComponentApi`, `ServiceApi`, `PipeApi` and every `Api*` type they use: members, signatures, type cards, setup and the links between them. The first model is deliberately simple, and generics and statics can be refined in later minors. Read it in a plugin if you must, and expect to adjust it.

What the API page of a component, a service or a pipe shows, as the scanner extracts it (since 22.7.0). The [JSDoc](plugins/jsdoc.md) plugin draws its pages from it; which tags, overloads and members it reads is described there. The shared `Api*` types come first. Exported from `@ng-prism/core/plugin` and `@ng-prism/core`.

### `ApiDocTags`

The tags of a doc block.

```typescript
interface ApiDocTags {
    deprecated?: string | true;
    since?: string;
    version?: string;
    see?: string[];
    example?: string[];
    default?: string;
}
```

`deprecated` is the message of `@deprecated`, or `true` without one. `version` comes from `@version` (since 22.7.0), `default` from `@default`; prose such as "Default `x`." is not read.

### `ApiTypeRef`

A type as written, plus the ids of the documented types it mentions.

```typescript
interface ApiTypeRef {
    text: string; // as written, e.g. 'Signal<boolean>'
    links?: string[]; // ids of the api.types entries (ServiceApi, PipeApi or ComponentApi) named in the text
}
```

`links` is missing when the text names no documented type.

### `ApiParam`

One parameter of a method or a setup function.

```typescript
interface ApiParam {
    name: string;
    type: ApiTypeRef;
    optional: boolean;
    rest?: true;
    defaultValue?: string; // the initializer as written
    description?: string; // from @param
}
```

### `ApiMethod`

One method signature.

```typescript
interface ApiMethod {
    name: string;
    params: ApiParam[];
    returnType: ApiTypeRef;
    description?: string;
    tags: ApiDocTags;
}
```

An overloaded method is one `ApiMethod` per overload signature, in source order, in `methods` and in the `methods` of a type card alike: the name repeats, and the implementation signature is left out. Each takes the doc block of its own, else the one of the implementation, else the description and `@param` texts of the first documented overload (not its tags), else the docs of the method in the nearest base class.

### `ApiProperty`

One property of a service or of a documented type.

```typescript
interface ApiProperty {
    name: string;
    type: ApiTypeRef;
    readonly: boolean;
    optional?: true; // `?` on an interface member
    description?: string;
    tags: ApiDocTags;
}
```

### `ApiTypeDoc`

A type card: a documented type that the API reaches.

```typescript
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
```

### `ApiSetupEntry`

One entry of [`setup`](api/showcase-config.md#setup): a function or a token that configures a service or a pipe.

```typescript
interface ApiSetupEntry {
    name: string;
    kind: 'function' | 'token';
    importPath: string;
    description?: string;
    tags: ApiDocTags;
    params?: ApiParam[]; // functions
    returnType?: ApiTypeRef; // functions
    tokenType?: ApiTypeRef; // tokens: InjectionToken<T> as written
    config?: ApiProperty[]; // options of the first parameter, or of the token's type argument
}
```

### `ComponentApi`

What the API page of a component or directive needs beyond `inputs` and `outputs`, as the scanner extracts it for every component and directive (since 22.7.0) when a plugin in the config sets [`componentApi`](api/ng-prism-plugin.md#componentapi). It is `ScannedComponent.api`. The JSDoc plugin draws the API tab from it, see [Components and Directives](plugins/jsdoc.md#components-and-directives).

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
| `methods`      | The public methods that have a doc block of their own or an inherited one, with signatures from the code: one entry per overload signature, so a name can repeat. What is left out is the same as for a service, see [JSDoc](plugins/jsdoc.md#services)                                                                |
| `types`        | The documented types that the inputs, outputs and methods reach, recursively. A type is documented when any scanned entry point exports it and it is not `@internal`. An `id` is unique within this list                                                                                                               |

`api` only adds to the other fields of `ScannedComponent`: `InputMeta`, `OutputMeta` and the plugin data `showcaseConfig.meta.jsdoc` keep their shape. A component in a build without a plugin that sets `componentApi`, one whose API the scan could not read, one built by a plugin hook, or one read from the manifest of an older core has no `api`, and a reader falls back to `inputs` and `outputs`.

### `ServiceApi`

The documentation of one service, as the scanner extracts it. It is `ScannedService.api`, and the JSDoc plugin draws the service page from it.

```typescript
interface ServiceApi {
    description?: string;
    tags: ApiDocTags;
    properties: ApiProperty[];
    methods: ApiMethod[];
    setup: ApiSetupEntry[];
    types: ApiTypeDoc[];
}
```

What is listed and what is left out is described in [JSDoc](plugins/jsdoc.md#services).

### `PipeApi`

The documentation of one pipe, as the scanner extracts it. It is `ScannedPipe.api`, and the JSDoc plugin draws the pipe page from it.

```typescript
interface PipeApi {
    description?: string;
    tags: ApiDocTags;
    transform: ApiMethod[]; // one entry per overload signature, or the implementation when there are none
    setup: ApiSetupEntry[];
    types: ApiTypeDoc[];
}
```

A pipe has no `properties` or `methods`: only `transform()` is read, see [JSDoc](plugins/jsdoc.md#pipes).

## Showcase config types

The types the fields of [`ShowcaseConfig`](api/showcase-config.md) use. Exported from `@ng-prism/core`. `CanvasBg`, `PseudoState`, `PseudoTarget` and `ForcedPseudoStates` are exported from `@ng-prism/core/plugin` as well, and `CanvasLayout` is not exported.

### `Variant`

One entry of [`ShowcaseConfig.variants`](api/showcase-config.md#variants). The rules of each field are under [Variant fields](api/showcase-config.md#variant-fields).

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

The optional type parameter `T` is the component class. When it is given (through `@Showcase<MyComponent>({...})`), `inputs` is `Partial<InputsOf<MyComponent>>`, and the editor checks both keys and values against the component's signal inputs. Without it, `T` is `unknown` and `inputs` is `Record<string, unknown>`.

| Field          | Description                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`         | The tab label, see [`name`](api/showcase-config.md#name)                                                                                   |
| `inputs`       | Values for the inputs, by member name, typed through [`InputsOf<T>`](#inputsof), see [`inputs`](api/showcase-config.md#inputs)             |
| `content`      | HTML projected into `<ng-content>`, see [`content`](api/showcase-config.md#content)                                                        |
| `template`     | An Angular template compiled as the content of the subject (since 22.7.0), see [`template`](api/showcase-config.md#template)               |
| `host`         | A [`HostTemplate`](#hosttemplate) the subject renders in for this variant (since 22.7.0), see [`host`](api/showcase-config.md#host)        |
| `description`  | Data for plugins; the styleguide does not show it                                                                                          |
| `meta`         | Plugin data for this variant, a [`ShowcaseMeta`](#showcasemeta), see [`meta`](api/showcase-config.md#meta)                                 |
| `bg`           | The recommended background for this variant, a [`CanvasBg`](#canvasbg), see [`bg`](api/showcase-config.md#bg)                              |
| `canvasLayout` | The layout for this variant, a [`CanvasLayout`](#canvaslayout), see [`canvasLayout`](api/showcase-config.md#canvaslayout)                  |
| `pseudo`       | Pseudo states forced while the variant renders, [`ForcedPseudoStates`](#forcedpseudostates), see [`pseudo`](api/showcase-config.md#pseudo) |
| `states`       | `false` keeps the variant out of the component's [`states`](api/showcase-config.md#states); no other value is valid                        |

### `ShowcaseState`

One named combination of forced pseudo states, an entry of [`ShowcaseConfig.states`](api/showcase-config.md#states) (since 22.6.0). It applies on top of every variant that does not opt out with `states: false`.

```typescript
interface ShowcaseState {
    name: string;
    pseudo: ForcedPseudoStates;
}
```

| Field    | Description                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | The column title in the Overview, the chip label in the tools menu and the state name in a visual regression report. Unique within the component                                                                                                     |
| `pseudo` | The pseudo states the state forces, with the same shape and meaning as `Variant.pseudo`, see [`ForcedPseudoStates`](#forcedpseudostates). Unlike `Variant.pseudo`, a state is forced only where it [fits](guide/states.md#when-a-state-does-not-fit) |

```typescript
{ name: 'Hover', pseudo: { hover: '.btn' } }
{ name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } }
```

The position of a state in `ShowcaseConfig.states` is its index: the `state` URL parameter, the render marker, [`DiscoveryState`](#discoverystate) and a visual regression report use it. When a variant has a `pseudo` of its own, both are forced, and a pseudo-class both name goes to the targets of both. See [States & Pseudo States](guide/states.md).

### `InputsOf`

Maps a component class to a record of its signal inputs, each unwrapped to the value it is written with.

```typescript
type InputsOf<T>;
```

- It picks the fields declared as `input()`, `input.required()`, `model()`, or `input(..., { transform })`.
- It leaves out `output()` and every other class member, `@Input()` properties included, so `@Showcase<T>` accepts no key for a decorator input, see [Inputs & Controls](guide/inputs-and-controls.md#decorator-inputs-and-outputs).
- It unwraps each signal to its write-side type. For a transform input (e.g. `input(false, { transform: booleanAttribute })`) this is the type the transform reads (`string | boolean | ''`), not the parsed value, which is what a variant writes in `inputs: {...}`.
- When `T` is `unknown` (the default), it is `Record<string, unknown>`.

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

`closed` is left out because `output()` is not a signal input. `Variant<FooComponent>['inputs']` is `Partial<InputsOf<FooComponent>>`, so any subset of these keys is valid in a variant. See [Inputs & Controls](guide/inputs-and-controls.md#type-safe-inputs).

### `DirectiveHost`

The object form of [`ShowcaseConfig.host`](api/showcase-config.md#host): an Angular component whose element a directive renders on. Exported since 22.7.0.

```typescript
interface DirectiveHost {
    selector: string; // the component's element, e.g. 'lib-button'
    import: { name: string; from: string }; // the component's class: its exported name and its module
    inputs?: Record<string, unknown>; // static inputs of the component
}
```

The `inputs` are written as static attributes on the element. See [Directive Hosting](guide/directive-hosting.md).

### `HostTemplate`

The template form of a host (since 22.7.0): the markup the showcased component or directive renders in, compiled as an Angular template.

```typescript
interface HostTemplate {
    template: string;
}
```

The element that the subject's selector matches is the subject, and `prism-subject` marks it where several match. Used in [`ShowcaseConfig.host`](api/showcase-config.md#host), which is `string | DirectiveHost | HostTemplate`, and in `Variant.host`. See [Compositions](guide/compositions.md#host-template).

### `ShowcaseImport`

A class that the templates of a showcase use and ng-prism cannot find in the library on its own, an entry of [`ShowcaseConfig.imports`](api/showcase-config.md#imports) (since 22.7.0).

```typescript
interface ShowcaseImport {
    name: string; // exported name, e.g. 'CdkTextareaAutosize'
    from: string; // module specifier, e.g. '@angular/cdk/text-field'
}
```

Strings, not a class reference, so that `ng-prism-strip` leaves no import behind in the published library.

### `CanvasBg`

A canvas background, the type of [`ShowcaseConfig.bg`](api/showcase-config.md#bg) and `Variant.bg`.

```typescript
type CanvasBg = 'dots' | 'plain' | 'light' | 'dark' | 'checker' | 'transparent';
```

| Value         | Paints                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dots`        | A dot grid over the themed surface, the canvas's own starting background                                                                                                                                                   |
| `plain`       | The themed surface, no pattern                                                                                                                                                                                             |
| `light`       | A flat light surface in an absolute colour, `--prism-void-light`                                                                                                                                                           |
| `dark`        | A flat dark surface in an absolute colour, `--prism-void-dark`                                                                                                                                                             |
| `checker`     | **Deprecated** since 22.2.0, removed in 23.0.0. A checkerboard over the themed surface, captured as that surface's colour                                                                                                  |
| `transparent` | A checkerboard while browsing, real transparency in a capture. What a variant resolves to in discovery, capture and the Overview when nothing declares a background; the Playground keeps the canvas's own background then |

Which background applies where, and which to declare under visual regression, is described under [`bg`](api/showcase-config.md#bg). `CANVAS_BGS` lists every value, `DEFAULT_VARIANT_BG` is `'transparent'`, and `resolveVariantBg()` resolves the background of a variant as the styleguide does, see [Plugin UI Kit](api/plugin-ui.md#constants-and-helpers).

### `CanvasLayout`

How the wrapper around the rendered subject sizes itself, the type of [`ShowcaseConfig.canvasLayout`](api/showcase-config.md#canvaslayout) and `Variant.canvasLayout`.

```typescript
type CanvasLayout = 'fit' | 'stretch';
```

`'fit'` is the default. What each value does is described under [`canvasLayout`](api/showcase-config.md#canvaslayout). The type is not exported; write `'fit' | 'stretch'` where you need it.

### `PseudoState`

A user-action pseudo-class that a variant or a [component state](#showcasestate) can force on, a key of [`ForcedPseudoStates`](#forcedpseudostates).

```typescript
type PseudoState = 'hover' | 'active' | 'focus' | 'focus-visible' | 'focus-within';
```

These are the states a script cannot hold: `:hover` and `:active` follow the pointer, and only one element in the document can be focused. A state an input can set, such as `:checked` or `:disabled`, belongs in `Variant.inputs`. `PSEUDO_STATES` lists every value, in the order the canvas tools menu shows them.

### `PseudoTarget`

Where a forced state applies.

```typescript
type PseudoTarget = true | string | readonly string[];
```

| Target              | Forces the state on                                                                   |
| ------------------- | ------------------------------------------------------------------------------------- |
| `true`              | Every element of what is rendered, the host included                                  |
| `string`            | The elements matching the selector, matched against the host and everything inside it |
| `readonly string[]` | The elements matching any of the selectors                                            |

What is rendered is the whole [composition](#componentcomposition) for a variant with a `template` or a host template, so a selector reaches the frame and the other parts too, and `true` means every element of them.

### `ForcedPseudoStates`

The type of [`Variant.pseudo`](api/showcase-config.md#pseudo) and `ShowcaseState.pseudo`: which states a variant or a component state forces, and on which elements.

```typescript
type ForcedPseudoStates = Partial<Record<PseudoState, PseudoTarget>>;
```

```typescript
{ 'focus-visible': '.btn' }                          // the inner <button> of the host
{ hover: true }                                      // the whole component
{ hover: '.pill', 'focus-visible': '.pill__close' }  // two states on two elements
```

How the states are forced, and what cannot be forced, is described in [States & Pseudo States](guide/states.md#pseudo-states).

### `ComponentStatus`

The maturity or migration state, the type of [`ShowcaseConfig.status`](api/showcase-config.md#status).

```typescript
type ComponentStatus = 'stable' | 'beta' | 'wip' | 'deprecated';
```

What each value means and shows in the sidebar and the page head is described under [`status`](api/showcase-config.md#status).

### `ShowcaseMeta`

`meta` on [`ShowcaseConfig`](api/showcase-config.md#meta) and on a [`Variant`](#variant): open for plugins and projects, with `a11y` typed (since 22.7.0).

```typescript
interface ShowcaseMeta {
    a11y?: A11yShowcaseMeta;
    [key: string]: unknown;
}
```

### `A11yShowcaseMeta`

`meta.a11y` on a `@Showcase` or a variant (since 22.7.0).

```typescript
interface A11yShowcaseMeta {
    rules?: Record<string, { enabled: boolean }>; // component level: switch axe rules for the live audit
    disable?: boolean; // component level: skip the live audit
    accept?: A11yAcceptance[]; // component and variant: audited and shown, not counted
    [key: string]: unknown;
}
```

A rule switched off with `enabled: false` is not audited at all; an accepted violation is audited and shown under _Accepted_ with its reason, but not counted. The acceptances of a component apply to every variant, and a variant adds its own. Other keys stay open: the build adds the a11y report's entry for the component (`found`, `score`, `summary`) next to these keys. See [Accepted violations](guide/accessibility.md#accepted-violations).

### `A11yAcceptance`

A violation that is known, deliberate and owned, an entry of `A11yShowcaseMeta.accept` (since 22.7.0). It is matched by the axe rule id, for every node of that rule.

```typescript
interface A11yAcceptance {
    rule: string; // the axe rule id, e.g. 'color-contrast'
    reason: string; // required
}
```

`reason` is required: an acceptance without one cannot be told apart from an oversight.

### `ShowcaseSetupRef`

An entry of [`ShowcaseConfig.setup`](api/showcase-config.md#setup): a function or an injection token that configures a service or a pipe (since 22.7.0).

```typescript
type ShowcaseSetupRef = ((...args: never[]) => unknown) | InjectionToken<unknown>;
```

Any function fits, whatever it takes and returns; ng-prism only reads its name, signature and type from the source and never calls it.

## Discovery types

The shape of `window.__PRISM_MANIFEST__`, the discovery view that external tools read: a JSON-safe projection of the runtime manifest without class references, set by `providePrism()`. The contract around it (URL parameters, the render marker, capture mode) is described in [External Tooling API](guide/external-tooling.md). Exported from `@ng-prism/core/plugin` and `@ng-prism/core`.

### `DiscoveryManifest`

```typescript
interface DiscoveryManifest {
    components: DiscoveryComponent[];
    pages: DiscoveryPage[];
}
```

`components` lists exactly what renders: no service, no pipe and no part. Use it to enumerate what to visit, see [Enumerating what exists](guide/external-tooling.md#enumerating-what-exists).

### `DiscoveryComponent`

One component or directive in `__PRISM_MANIFEST__`.

```typescript
interface DiscoveryComponent {
    className: string;
    title: string;
    variants: DiscoveryVariant[];
    states?: DiscoveryState[];
    meta?: Record<string, unknown>;
    parts?: DiscoveryPart[];
}
```

| Field       | Description                                                                                                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className` | The class name, what `?component=` addresses                                                                                                                                                                                                                         |
| `title`     | `ShowcaseConfig.title`, the display name                                                                                                                                                                                                                             |
| `variants`  | One [`DiscoveryVariant`](#discoveryvariant) per declared variant. A component without variants reports one, `Default` at index 0                                                                                                                                     |
| `states`    | `ShowcaseConfig.states`, one [`DiscoveryState`](#discoverystate) per declared slot. Omitted when the component declares none. Whether a state fits a variant is not in the manifest, since that is only known once the variant renders: the render marker reports it |
| `meta`      | `ShowcaseConfig.meta`, plain data only, see [Reading `@Showcase` metadata](guide/external-tooling.md#reading-showcase-metadata). Omitted when empty                                                                                                                  |
| `parts`     | The parts of the component, one [`DiscoveryPart`](#discoverypart) each, sorted by title (since 22.7.0). Omitted when there are none. **Experimental**                                                                                                                |

### `DiscoveryVariant`

One variant in `__PRISM_MANIFEST__`, an entry of `DiscoveryComponent.variants`.

```typescript
interface DiscoveryVariant {
    name: string;
    index: number;
    bg: CanvasBg;
    meta?: Record<string, unknown>;
    pseudo?: ForcedPseudoStates;
    states?: false;
}
```

| Field    | Description                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | `Variant.name`                                                                                                                                                                                                                                      |
| `index`  | 0-based position in the `variants` array, the `?variant=` URL value                                                                                                                                                                                 |
| `bg`     | The background the variant renders on, already resolved: `Variant.bg`, else `ShowcaseConfig.bg`, else `'transparent'`. Always present, and what capture mode paints, see [Reading the background](guide/external-tooling.md#reading-the-background) |
| `meta`   | `Variant.meta`, plain data only. Omitted when empty                                                                                                                                                                                                 |
| `pseudo` | `Variant.pseudo`, as declared. Omitted when the variant forces no state. The render marker waits for the states, so a capture shows them without any action on the runner's side                                                                    |
| `states` | `false` when the variant opts out of the component's states, omitted otherwise. Nothing is forced for a state on such a variant, and the render marker reports its cell as excluded                                                                 |

### `DiscoveryState`

One component-level state in `__PRISM_MANIFEST__`, an entry of `DiscoveryComponent.states`.

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

### `DiscoveryPart`

> **Experimental until 23.0.0: the shape may change in a 22.x minor release.** This covers `DiscoveryPart` and `DiscoveryComponent.parts`.

One part of a component or directive in `__PRISM_MANIFEST__` (since 22.7.0), an entry of `DiscoveryComponent.parts`.

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

A part is not in `DiscoveryManifest.components`: it has no variants and no render marker of its own, and a tool that walks the components does not visit it. `?component=` with the class name of a part opens its parent.

### `DiscoveryPage`

One page in `__PRISM_MANIFEST__`, an entry of `DiscoveryManifest.pages`: custom pages and component pages alike.

```typescript
interface DiscoveryPage {
    title: string;
}
```

## Plugin types

Types a plugin works with besides the definitions in [NgPrismPlugin](api/ng-prism-plugin.md). `PanelTarget`, `StatusTone` and `StatusThreshold` are exported from `@ng-prism/core/plugin` and `@ng-prism/core`, `NavigationItem` from `@ng-prism/core` only.

### `PanelTarget`

Where a panel appears, the type of `PanelDefinition.appliesTo` (since 22.7.0). See [Panels on service and pipe pages](api/ng-prism-plugin.md#panels-on-service-and-pipe-pages).

```typescript
type PanelTarget = 'component' | 'service' | 'pipe';
```

### `NavigationItem`

An entry of the navigation: `PrismNavigationService.sectionTree()` holds the items of each category, and `PrismNavigationService.activeItem` is the one open. See [Runtime Services](api/services.md).

```typescript
type NavigationItem =
    | { kind: 'component'; data: RuntimeComponent }
    | { kind: 'service'; data: RuntimeService }
    | { kind: 'pipe'; data: RuntimePipe }
    | { kind: 'page'; data: StyleguidePage };
```

`kind` tells the four apart, and the `'service'` and `'pipe'` kinds exist since 22.7.0. Code that narrows a `NavigationItem` by `kind` and reads `data` needs a branch for each kind: after `item.kind === 'component' ? … : item.data.title`, the `data` of the other branch is a `RuntimeService | RuntimePipe | StyleguidePage`, on which `title` does not type-check.

### `StatusTone`

The verdict of `statusFor()`, which grades a key figure against a threshold (since 22.7.0). See [Plugin UI Kit](api/plugin-ui.md#status-grading).

```typescript
type StatusTone = 'ok' | 'warn' | 'danger';
```

### `StatusThreshold`

The threshold `statusFor()` grades against (since 22.7.0).

```typescript
interface StatusThreshold {
    ok: number;
    warn: number;
    direction?: 'higher' | 'lower';
}
```

With `direction: 'higher'`, the default, a value is `ok` from `ok` up, `warn` from `warn` up and `danger` below that. With `'lower'`, it is `ok` up to `ok`, `warn` up to `warn` and `danger` above that.
