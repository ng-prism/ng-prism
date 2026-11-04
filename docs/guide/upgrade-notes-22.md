# Upgrade Notes 22.x

What changed in each minor release of the 22.x line, newest first: what can break, what is deprecated and what is new. Patch releases appear only where they changed behaviour. 22.0.0 moved the generated manifest out of the source tree into a cache directory; coming from 21.x, start with [Migrating from 21.x](guide/migration-v22.md).

Update the core and every `@ng-prism/plugin-*` you have installed in one call, so that their peer dependencies resolve together:

```bash
ng update @ng-prism/core @ng-prism/plugin-jsdoc @ng-prism/plugin-visual-regression
```

Everything deprecated in 22.x is removed in 23.0.0, see [Removed in 23.0.0](#removed-in-2300).

## Upgrading to 22.8.0

22.8.0 reads `Date` values in showcases and gives `Date` inputs a date field. No `@Showcase` has to change.

**Breaking.**

- **A `Date` input is `type: 'date'`.** [`InputMeta.type`](api/types.md#inputmeta) was `'object'` for `Date`, `Date | null` and `Date | undefined`. A plugin control whose `matchType` looks for `'object'` no longer gets these inputs, and code that switches over `type` meets a new value.
- **`model()` changes reach the panels.** Up to 22.7.x a component that set its own `model()` went unheard. Now the Events panel logs the change as `<name>Change`, the control shows the new value, and the input counts as changed, so **Reset** appears and the value is kept across a reload.

**New.**

- **`Date` values.** `new Date(…)` with arguments the scanner can read is a showcase value, in variants and as the default of an input. `new Date()` without arguments is dropped with a warning, see [Dates](guide/variants.md#dates).
- **A date field** for `Date` inputs in the Controls panel, see [Input types and controls](guide/inputs-and-controls.md#input-types-and-controls).
- **Readable dates** in the Events panel, the JSON editor, the parts popover and the API page of `@ng-prism/plugin-jsdoc`. `formatDateValue` from `@ng-prism/core/plugin` shows a `Date` the same way in a plugin.

## Upgrading to 22.7.0

22.7.0 adds services and pipes, compositions, parts, a phone layout and a new look. No `@Showcase` of a component or directive has to change. The breaking changes are in types of the public API, in what the manifest lists, and in what a few directives and the view tabs render.

**Breaking.**

- **Services and pipes are no longer components.** Before 22.7.0 every class with `@Showcase` was a component, so one with `@Injectable`, `@Service` or `@Pipe` was in `PrismManifest.components`, `RuntimeManifest.components` and `window.__PRISM_MANIFEST__` (a pipe with the selector `''`), went through `onComponentScanned`, and had a Playground that never rendered it. From 22.7.0 it leaves all four, unless it declares a field that needs a canvas (see **Deprecated** below). Code or a screenshot runner that walks `components` no longer sees it; nothing that rendered is lost. The manifest lists them in `services` and `pipes` of their own, with the hooks `onServiceScanned` and `onPipeScanned`, so a plugin written before them sees the same components as before and none of its hooks is ever called with a service or a pipe. Where such a class goes:

    - **With `jsDocPlugin()`** from `@ng-prism/plugin-jsdoc` 22.7.0 or newer in the config, a class with `@Injectable` or `@Service` is listed under **Services** and a standalone `@Pipe` under **Pipes**. A `@Pipe` with `standalone: false`, or with a `name` the scan cannot read, is dropped with a warning, which fails a [`strictShowcase`](api/ng-prism-config.md#strictshowcase) build.
    - **Without such a plugin** the build leaves services and pipes out and says so once.

    See [Services & Pipes: Before you start](guide/services-and-pipes.md#before-you-start), [`PrismManifest`](api/types.md#prismmanifest) and, for the messages, [Build Warnings](api/build-warnings.md#services-and-pipes).

- **`NavigationItem` has two new kinds.** The type, exported from `@ng-prism/core`, gains `{ kind: 'service'; data: RuntimeService }` and `{ kind: 'pipe'; data: RuntimePipe }`. It only affects code of your own that narrows a `NavigationItem` by `kind` and reads `data`, for example a custom page or a plugin panel reading `PrismNavigationService.activeItem()`. That code needs a `'service'` and a `'pipe'` branch. A plain two-way check fails to compile now, because the other branch is `RuntimeService | RuntimePipe | StyleguidePage`, and `title` no longer type-checks there:

    ```typescript
    // before 22.7.0
    function label(item: NavigationItem): string {
        return item.kind === 'component' ? item.data.meta.showcaseConfig.title : item.data.title;
    }

    // from 22.7.0
    function label(item: NavigationItem): string {
        switch (item.kind) {
            case 'component':
            case 'service':
            case 'pipe':
                return item.data.meta.showcaseConfig.title;
            case 'page':
                return item.data.title;
        }
    }
    ```

    The same goes for a `switch` that ends in `never` and for a lookup typed on the union. At runtime nothing changes until the styleguide contains a service or a pipe. See [`NavigationItem`](api/types.md#navigationitem).

- **`ShowcaseConfig.host` is a wider union.** It was `string | DirectiveHost` and is `string | DirectiveHost | HostTemplate` now, for the [host template](guide/compositions.md#host-template). It only affects code of your own that reads `host`, for example a plugin that reads `showcaseConfig.host` of a scanned or runtime component. Code that takes every host that is no string for a `DirectiveHost` fails to compile now, because the other branch is `DirectiveHost | HostTemplate`. Tell them apart with `'template' in host`:

    ```typescript
    // before 22.7.0
    function hostTag(host: ShowcaseConfig['host']): string | undefined {
        return typeof host === 'string' ? host : host?.selector;
    }

    // from 22.7.0
    function hostTag(host: ShowcaseConfig['host']): string | undefined {
        if (typeof host === 'string') return host;
        return host && !('template' in host) ? host.selector : undefined;
    }
    ```

    At runtime nothing changes until a showcase uses a host template: a string or object host keeps its shape. See [`DirectiveHost`](api/types.md#directivehost) and [`HostTemplate`](api/types.md#hosttemplate).

- **`meta.a11y` is typed.** `meta` on a `@Showcase` and on a variant is a [`ShowcaseMeta`](api/types.md#showcasemeta) now, with `a11y` typed as [`A11yShowcaseMeta`](api/types.md#a11yshowcasemeta), so an `a11y` entry in the wrong shape no longer compiles: `disable` is a boolean, a rule switch is `{ enabled: boolean }`, and an acceptance needs both `rule` and `reason`. Other keys under `meta` and under `meta.a11y` stay open. See [`meta`](api/showcase-config.md#meta).

- **A directive renders on the element its selector names.** Without a `host`, `input[libInput]` renders as `<input libInput>`. Up to 22.6.0 every directive without a `host` rendered on a `div`, and a selector that names an element never matched, because the generated wrapper wrote the whole selector as an attribute name. A directive with `host: '<input>'` or another void element used to fail the styleguide build: the wrapper wrote `<input …>{{ … }}</input>`, which Angular rejects with `Void elements do not have end tags "input"`. It renders now, see [Directive Hosting: Void Elements](guide/directive-hosting.md#void-elements). Check the visual regression baselines of such directives, since their output changes. See [Directive Hosting](guide/directive-hosting.md#without-a-host).

- **Every component opens on the Playground.** Selecting a component in the sidebar opens it on the Playground, whichever view the one before showed. Before 22.7.0 the view tab stayed from one component to the next while the next one offered it, so a reader who opened the Overview or the API tab of one component found the next one on the same tab. A link, a reload and the browser's back and forward buttons still open the view their URL names, so `?component=ButtonComponent&view=jsdoc` opens the API tab as before. After a click in the sidebar the URL carries no `view` until another view is picked. An end-to-end test that clicks from component to component on the Overview or the API tab has to select the tab again after each click, or navigate by URL. See [Tour of the UI: Playground, Overview and API](guide/styleguide-ui.md#playground-overview-and-api) and [Links & State](guide/url-state.md#url-parameters).

**Deprecated.** Each is removed in 23.0.0 and still accepted in 22.x; overrides of the three gradient tokens below no longer have an effect.

- **A service or a pipe with a field that needs a canvas stays a component.** Before services and pipes had a page, a class with `@Showcase` and `@Injectable` or `@Pipe` was shown as a component, and with `renderPage` it had a working page. To keep that working in 22.x, a class with `@Injectable`, `@Service` or `@Pipe` that declares `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports` or `renderPage` stays a component, and the build prints a notice that does not count for `strictShowcase`:

    ```
    ⚠ ng-prism: ToastService is an @Injectable/@Service with @Showcase and declares variants, renderPage, so it is still treated as a component. From 23.0.0 it will be shown as a service and these fields will be dropped; remove them, or move the page to a componentPage.
    ```

    From 23.0.0 the class is a service or a pipe, and those fields are dropped. To switch now, remove the fields, or move the demo to a [component page](guide/component-pages.md) and keep the service or the pipe on its own. See [Services & Pipes: Which fields apply](guide/services-and-pipes.md#which-fields-apply) and the notices under [A service that is still a component](api/build-warnings.md#a-service-that-is-still-a-component) and [A pipe that is still a component](api/build-warnings.md#a-pipe-that-is-still-a-component).

- **A pipe declared in an NgModule with such a field** keeps its page in 22.x and loses it in 23.0.0, because ng-prism shows standalone pipes only: one without those fields is already dropped with a warning in 22.7.0, see above. Its notice says so: `From 23.0.0 it will be dropped, because ng-prism shows standalone pipes only; make the pipe standalone and remove the fields, or move the page to a componentPage.` Make the pipe standalone and remove the fields to have it shown as a pipe, or move the page to a component page. See [An NgModule pipe that is still a component](api/build-warnings.md#an-ngmodule-pipe-that-is-still-a-component).

- **Six theme tokens.** Core no longer reads them:

    | Token                                                                     | Since 22.7.0                                                                | Use instead                                         |
    | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
    | `--prism-mark-nominal`, `--prism-mark-attention`, `--prism-mark-critical` | Aliases of the status colours. An override is carried over to its successor | `--prism-success`, `--prism-warn`, `--prism-danger` |
    | `--prism-spectrum`                                                        | An alias of `--prism-brand-gradient`. Nothing reads an override             | `--prism-brand-gradient` for brand moments          |
    | `--prism-primary-from`, `--prism-primary-to`                              | Still set, but nothing paints from them                                     | `--prism-brand-gradient`, `--prism-primary-fill`    |

    ```typescript
    // before 22.7.0
    theme: { '--prism-mark-critical': '#dc2626' }

    // from 22.7.0
    theme: { '--prism-danger': '#dc2626' }
    ```

    Every override of one of them, in `theme`, `darkTheme` or `lightTheme`, is reported twice: the build prints a notice, see [A deprecated theme token](api/build-warnings.md#a-deprecated-theme-token), and the styleguide warns once per token in the browser console with `[ng-prism] <token> is deprecated since 22.7.0 …`. See [`theme`](api/ng-prism-config.md#theme) and [Theming: Status Colors](guide/theming.md#status-colors).

- **`PanelBadge.variant`.** A panel's tab badge says what it counts with `kind` instead of a colour: `kind: 'issues'` is a number of open findings, a filled pill in `tone` (`danger` by default, `warn` or `primary`), and `kind: 'count'` is a plain muted figure. `label` names it for a screen reader. A badge that still sets `variant` keeps rendering: `warn` and `danger` become `kind: 'issues'` in that tone, `default` or no variant becomes `kind: 'count'`, and `ok` is not rendered, as before. The styleguide warns once per panel in the browser console: `[ng-prism] The badge of panel "<id>" sets variant, which is deprecated since 22.7.0 and will be removed in 23.0.0. It is mapped to kind and tone until then; set those instead.` See [`PanelBadge`](api/ng-prism-plugin.md#panelbadge).

    ```typescript
    // before 22.7.0
    badge: (c) => (open(c) ? { text: String(open(c)), variant: 'danger' } : null);

    // from 22.7.0
    badge: (c) => (open(c) ? { kind: 'issues', text: String(open(c)), tone: 'danger', label: `${open(c)} to review` } : null);
    ```

    Grade a figure with `statusFor()` and `thresholdFromTarget()` from `@ng-prism/core/plugin`, so a plugin's verdict matches the header, the sidebar and the built-in panels, see [Plugin UI Kit: Status grading](api/plugin-ui.md#status-grading).

**New.**

- **Services and pipes** get pages of their own: `@Showcase` on an `@Injectable`, a `@Service` or a standalone `@Pipe`, with [`setup`](api/showcase-config.md#setup) for the provider functions and tokens a consumer needs. The pages come from `jsDocPlugin()` 22.7.0 or newer. For plugins: the hooks [`onServiceScanned`](api/ng-prism-plugin.md#onservicescanned) and [`onPipeScanned`](api/ng-prism-plugin.md#onpipescanned), `appliesTo` on a panel, `PrismNavigationService.activeService`, `selectService()`, `activePipe` and `selectPipe()`, and the URL parameters `service` and `pipe`. A panel without `appliesTo` is a component panel, and a panel only gets the inputs of the targets it names, so a panel written before services and pipes existed does not show up on their pages and is not handed anything new. See [Services & Pipes](guide/services-and-pipes.md) and [Panels on service and pipe pages](api/ng-prism-plugin.md#panels-on-service-and-pipe-pages).
- **One API page for all four kinds** in the [JSDoc](plugins/jsdoc.md#components-and-directives) plugin: a generated usage snippet, the examples, the API with linked types, cards for the types it reaches and an "On this page" list. What the API tab of a component showed before is all still there: the description with its Markdown, the chips, the examples, the inputs with their default, required marker and description, the outputs and the documented methods. A required input carries a `required` badge on its name; the table had a Required column before. `@see X` and `{@link X}` jump to the card of `X`, see [JSDoc: Links to Types](plugins/jsdoc.md#links-to-types). The links, the payloads and the cards come from the scanner, so they need `@ng-prism/core` 22.7.0 or newer as well as the plugin; a component from the manifest of an older core still gets the page, from `inputs`, `outputs` and the plugin's own data.
- **The manifest carries `importPath`, and `api`** when a plugin in the config sets [`componentApi`](api/ng-prism-plugin.md#componentapi) (experimental until 23.0.0). An older core wrote neither, so the page of a plugin has to cope with a manifest that lacks them. `InputMeta.doc` keeps the bar of `{@link X | text}`, so a reader can tell the target from the text; before, a link whose target TypeScript resolves to a symbol came out as `{@link Xtext}`.
- **Compositions:** `template` on a variant, `host: { template }` on a variant and on the showcase, and `imports` on the showcase render the subject with other parts of the library as one compiled Angular template, see [Compositions](guide/compositions.md). Every existing `content`, string `host` and object `host` renders as before. A string or object `host` on a component never had an effect and still has none, but the build warns about it now and drops it, without failing a `strictShowcase` build, see [A string or object host on a component](api/build-warnings.md#a-string-or-object-host-on-a-component). Delete it, or switch to `host: { template }` for the wrapper it was meant to give, see [Compositions: Around a component](guide/compositions.md#around-a-component); check the visual regression baselines of that component then, since the output changes. `imports` joins the fields that keep a service or a pipe a component, see **Deprecated**. A plugin that reads `ScannedComponent` sees one more optional field, [`composition`](api/types.md#componentcomposition), and [`InputMeta`](api/types.md#inputmeta) two more, `defaultUnreadable` and `model`.
- **A directive output with a payload** builds. Up to 22.6.0 the wrapper declared its outputs as `output()`, which takes no value, so a directive with an output like `output<string>()` failed the styleguide build with `TS2345: Argument of type 'string' is not assignable to parameter of type 'void'`, reported in `ng-prism-cache/<lib>-prism/prism-manifest.ts`. See [Directive Hosting: Outputs](guide/directive-hosting.md#outputs).
- **Parts:** with [`partOf`](guide/parts.md), a component or directive that only works inside another one, such as an option in a select, names the selector of its parent and gets no page of its own. Its title, description, inputs and outputs show on the parent's page, on a card behind a chip in the head and, with the JSDoc plugin, in a block of the API tab that `?part=` links to. Nothing changes until a class declares `partOf`; then it changes for the tools that read the manifest:

    - A part is not in `components`: it leaves `PrismManifest.components`, `RuntimeManifest.components` and `window.__PRISM_MANIFEST__`, and its parent lists it in `parts`. A plugin that walks `manifest.components` in `onManifestReady` and must see every class reads `component.parts` as well, see [Parts in the hooks](architecture/plugin-hooks.md#parts-in-the-hooks). A visual regression runner needs no change: the variants of the parent render the part, and the part has no variants or render marker of its own.
    - `onComponentScanned` still runs on a part, which carries `parentClassName` once `partOf` resolved. A plugin that adds a panel per component can skip it by that field.
    - A view panel can list parts with `listsParts: true` and gets the input `activePart`, see [Panels that list parts](plugins/writing-plugins.md#panels-that-list-parts).

    `parts`, `parentClassName`, `listsParts` and `DiscoveryPart` are experimental until 23.0.0: their shape may change in a 22.x minor release.

- **A phone layout,** see [Tour of the UI: On a phone](guide/styleguide-ui.md#on-a-phone).
- **A new look:** a new logo and palette, and reworked chrome and built-in panels. No config, no plugin and no showcase has to change to keep building and running. What a theme override or a plugin of your own may notice:

    - **Every colour changes.** Primary is blue instead of violet (`--prism-primary` `#60a5fa` dark, `#1d4ed8` light, was `#a78bfa` and `#7c3aed`), the surfaces are slate and navy instead of violet-tinted, `--prism-accent` is violet instead of pink, and success, warning and danger have new values. A page or panel of your own that reads the tokens recolours with them. One that was matched to the old violet by eye is worth a look.
    - **The light theme swaps two roles.** `--prism-bg` (chrome: header, sidebar, tab bars) is grey `#f1f5f9`, `--prism-bg-surface` (content) is white; before, it was the other way round. If you override only one of them for the light theme, check that the two still read as chrome and content.
    - **Primary has two roles.** `--prism-primary` is the text and indicator colour. Fills (primary buttons, active toggles, checked checkboxes) read `--prism-primary-fill` and `--prism-primary-fill-hover` with `--prism-on-primary` on top, and a switched-on toggle `--prism-toggle-on`. If you override `--prism-primary` alone, they follow it, and so do the selection tints and the tab and sidebar indicators (`--prism-brand-ink`), so your colour still reaches every control. Only the wordmark and the tool rail on the absolute `light` and `dark` canvas grounds keep ng-prism's colours. With a light primary of your own, also set `--prism-on-primary`. See [Theming: Color Properties](guide/theming.md#color-properties).
    - **The header is a navy brand band in both themes,** also while the app runs light, and renders with the dark token set, your `darkTheme` overrides included. A custom `title` replaces the wordmark and is shown in neutral text, not in the gradient. With both `logo.light` and `logo.dark` set, the header shows `logo.dark` in both themes; `logo.light` is shown only when it is the one you set. Header widgets read colours that fit the band without code of their own; [`PrismMetricBadgeComponent`](api/plugin-ui.md#metric-badge) gains an optional `shortLabel` for the look of the built-in badges. A slow light moves through the band, timed by `--prism-brand-motion`. See [Theming: The Header Band](guide/theming.md#the-header-band) and [Brand Motion](guide/theming.md#brand-motion).
    - **The status badge** in the component head adapts to light and dark mode; before, it was an outline in the `--prism-mark-*` colours.
    - **The canvas grounds of a visual regression baseline are unchanged.** `--prism-void-light` (`#f7f5fc`) and `--prism-void-dark` (`#07050f`) stay as they were, so a variant on `bg: 'light'`, `'dark'` or `'transparent'` is captured on the same ground. Two things can still move a few pixels: a component that inherits its text colour from the styleguide picks up the new `--prism-text` (dark `#f1f5f9`, was `#ede9f8`; light `#0f172a`, was `#1c1530`), which stays under the default tolerance of common comparers but shows in a strict one, and `dots`, `plain` and `checker`, which follow the theme and are not recommended for a baseline, look different.
    - **The a11y verdict has a danger tier everywhere.** A score below 75 % of the configured threshold is danger in the sidebar, the component head and the panel, not only in the header badge. The threshold, and the build gate on it, are unchanged.
    - **The Coverage tab has no badge any more.** The figures are in the panel and the header badge.
    - **The sidebar and the addons panel resize within new bounds:** the sidebar between 200 and 360 px (default 280, was 160 to 600), the panel height between 200 and 560 px (default 300, was 100 to 600). A size stored by an earlier version is clamped on load.
    - **Internal class names changed.** The panels are built from shared primitives now, so classes such as `.vrt__summary`, `.perf-card` or `.st-tab` are gone from the DOM. None of them was public API, but a stylesheet or test that targeted them no longer matches.
    - **The primitives are exported.** The UI components the built-in panels use come from `@ng-prism/core`, see [Plugin UI Kit](api/plugin-ui.md#ui-primitives) and [Panel Design](plugins/panel-design.md#principles).

- **Accessibility:**

    - **Accepted violations:** `accept: [{ rule, reason }]` in `meta.a11y` of a component or a variant keeps a violation visible without counting it, see [Accessibility Panel: Accepted Violations](guide/accessibility.md#accepted-violations).
    - **Needs review:** axe answers some checks with "incomplete", for example a contrast over a background image. The panel lists them under _Needs review_ with axe's reason; before, they did not appear at all. They do not count towards the score. See [Accessibility Panel: Violations](guide/accessibility.md#violations).
    - **The live audit measures the component only:** the canvas overlays are hidden while it runs.
    - **`a11y.gate`:** when an `a11y-report.json` exists and its total breaks the gate's limits, `ng run my-lib:prism-build` fails. The gate is `gate`, or `thresholds` while `gate` is left out, as before 22.7.0; `gate: false` never fails the build. The dev server only warns now, where it used to fail like the build, and rebuilds when the report changes. See [`a11y`](api/ng-prism-config.md#a11y) and [A11y Reports: Gating](guide/a11y-reports.md#gating).
    - **The report no longer replaces `rules` and `disable`:** the build adds a component's entry to its `meta.a11y` as `found`, `score` and `summary`, next to what the `@Showcase` declares there; before, the entry replaced it. See [A11y Reports: What the build adds](guide/a11y-reports.md#what-the-build-adds).

- **Perf measures the file the way it ships:** without `@Showcase` and printed without comments, and an import that only served `@Showcase` is no longer counted. A well-documented component with many variants is no longer graded as large because of its documentation. The budget stays at 20 and 50 kb. The report gains the optional fields `rawSourceSize`, `rawGzipEstimate`, `templateSize`, `styleSize` and `stripped`. See [Perf: Bundle](plugins/perf.md#bundle).
- **Smaller changes in the styleguide:**

    - The active state belongs to its variant: it goes when you pick another variant or switch to another component; before, it stayed on every variant. The variant ribbon shows it as a chip that clears it, and the tools button carries a dot. See [Tour of the UI: State switch](guide/styleguide-ui.md#state-switch).
    - The Overview belongs to the component it shows: selecting another component opens that one on the Playground; before, the Overview stayed open from component to component.
    - The sidebar scrolls the open entry into view and opens its group after a link, a reload or a step back or forward, see [Tour of the UI: Sidebar](guide/styleguide-ui.md#sidebar).
    - The default typography of a component page sits in a cascade layer, so your own styles win over it, see [Component Pages: Following the theme](guide/component-pages.md#following-the-theme).

## Upgrading to 22.6.0

No breaking changes. 22.6.0 adds component states, a Claude Code plugin and faster watch rebuilds, and deprecates options that never had an effect.

**Deprecated.** These have been declared since the first release, but nothing has ever read them, so setting one never had an effect. The build prints a notice while one is set. Removing them changes nothing at runtime.

- `NgPrismConfig`: [`themeStylesheet`](api/ng-prism-config.md#themestylesheet), [`ui`](api/ng-prism-config.md#ui), [`headless`](api/ng-prism-config.md#headless) and [`appComponent`](api/ng-prism-config.md#appcomponent). Colours, fonts and density go through the theme tokens, see [Theming](guide/theming.md).
- [`NgPrismPlugin.wrapComponent`](api/ng-prism-plugin.md#wrapcomponent).
- `PanelDefinition.position`: where a panel appears is `placement`, see [`PanelDefinition`](api/ng-prism-plugin.md#paneldefinition).
- `perfPlugin()`: the options `thresholds`, `bundle.excludeImports`, `render` and `memory`, and the `PERF_PLUGIN_CONFIG` token, see [Perf: Options](plugins/perf.md#options).

The notices are listed under [Build Warnings](api/build-warnings.md#a-config-option-that-never-had-an-effect).

**New.**

- **States:** [`states`](api/showcase-config.md#states) declares named combinations of forced pseudo states once, and every variant is combined with them; `states: false` keeps a variant out. The Overview shows a matrix of variants against states, see [States & Pseudo States](guide/states.md). For screenshot runners all of it is additive: `__PRISM_MANIFEST__` lists the states, `?state=` selects one, the render marker gets the state index as a suffix, and `data-prism-excluded` names the reason when a state does not fit the variant, see [External Tooling API](guide/external-tooling.md#a-state-that-does-not-apply).
- **States in the visual regression report:** an entry can carry `stateIndex` and `stateName`. An entry without a `stateIndex` behaves as it always did: `variantIndex` alone identifies the variant on its own, so every report written before states existed stays valid and renders unchanged. See [Visual Regression: States](plugins/visual-regression.md#states).
- **A Claude Code plugin** for projects that use ng-prism, see [AI Coding Agents](guide/ai-agents.md).
- **Faster watch rebuilds:** the scanner reuses parsed source files between rebuilds, and reading the `paths` of your tsconfig no longer lists the files below it. See [Build Pipeline](architecture/pipeline.md#prismpipelinestate-scanner-reuse-across-rebuilds).
- **Aliased inputs and outputs work.** A variant and the Controls panel set an input by its member name, and ng-prism binds the public one. Up to 22.5.0 an aliased input could not be set from a variant or the Controls panel, and on a directive it broke the styleguide build with `NG8002: Can't bind to '<member>' since it isn't a known property of '<tag>'`, reported in `ng-prism-cache/<lib>-prism/prism-manifest.ts`. See [Inputs & Controls: Aliased Inputs](guide/inputs-and-controls.md#aliased-inputs).
- **Named slots fill by name.** Up to 22.5.0 the slots were filled by position: `default` went into the first `<ng-content>` of the template and the other keys into the following ones in the order written, so a card with a named slot before its default slot rendered its body in the header slot. See [Content Projection](guide/content-projection.md#multi-slot-content).
- **The primary entry point is scanned next to the secondary ones.** Up to 22.5.0 a directory without secondary entry points found no component, such as a library set up with `ng add`, and with secondary entry points the primary one was skipped. See [Builders: `entryPoint`](api/builders.md#entrypoint).
- **Back and forward between two components** restore the variant from the URL instead of jumping to the first one, see [Links & State](guide/url-state.md#browser-backforward).

## Upgrading to 22.5.0

No breaking changes and no deprecations.

**New.**

- **Forced pseudo states per variant:** [`pseudo`](api/showcase-config.md#pseudo) on a variant forces states such as `:hover` or `:focus-visible` on the elements its selectors name, see [States & Pseudo States: Per-variant pseudo states](guide/states.md#per-variant-pseudo-states).

## Upgrading to 22.4.0

No breaking changes, but the build now warns where it used to drop a `@Showcase` value without a word. Up to 22.3.0 anything beyond a literal, such as `5 * 1024 * 1024`, became `undefined`, and a spread or a shorthand property took the whole object around it along. Now the scan reads far more (see below), drops only the value it cannot evaluate, and prints a `⚠ ng-prism:` warning with its path and source location. See [Build Warnings: Showcase values](api/build-warnings.md#showcase-values) and [What the Scanner Reads](guide/scanner-reads.md).

**Deprecated.**

- **`providers` on `@Showcase`.** It never reached the styleguide: a provider is a class, a factory or an instance, which the static manifest cannot hold. The build warns once per component. A component gets what it injects from the root injector of the styleguide app, or from a [component page](guide/component-pages.md). See [`providers`](api/showcase-config.md#providers) and [Build Warnings: Providers in @Showcase](api/build-warnings.md#providers-in-showcase).

**New.**

- **[`strictShowcase`](api/ng-prism-config.md#strictshowcase)** fails the build when the scan had to drop a `@Showcase` value, instead of only warning.
- **More of `@Showcase` is read:** arithmetic, template literals, `const` constants (also imported ones), enum members and spreads of constants, see [What the Scanner Reads: Values the scanner evaluates](guide/scanner-reads.md#values-the-scanner-evaluates).
- **[`categoryOrder`](api/showcase-config.md#categoryorder) and [`componentOrder`](api/showcase-config.md#componentorder) sort the sidebar.** The scan used to drop them, so the sidebar sorted as if neither was declared.
- **Inputs and outputs from base classes** show in the Controls and Events panels, see [Inputs & Controls: Inherited Inputs](guide/inputs-and-controls.md#inherited-inputs) and [What the Scanner Reads: Base classes and mixins](guide/scanner-reads.md#base-classes-and-mixins).
- **A measuring tool** on the canvas, see [Measuring](guide/measuring.md).

## Upgrading to 22.3.0

No breaking changes and no deprecations.

**New.**

- **Viewport width:** narrows the box the component renders in, see [Tour of the UI: Viewport width](guide/styleguide-ui.md#viewport-width).
- **`ng add` in Nx workspaces** with a `project.json` per project, see [Installation: Nx Workspaces](guide/installation.md#nx-workspaces).
- **`axe-core` is a dependency of `@ng-prism/core`.** A workspace set up with `ng add` used to fail its first production build with `Could not resolve "axe-core"`, because the Accessibility panel imports it and nothing installed it.

## Upgrading to 22.2.0

22.2.0 reduces the fixed chrome above the canvas, gives every panel tab an icon, and adds capture mode, the Visual Regression plugin and the Overview. Every new token is additive and every existing token is kept. The breaking changes affect application code only: none of them touches `ShowcaseConfig`, the manifest format or the public API of a plugin.

**Breaking.**

- **`PrismLayoutService.templatePopoverVisible`, `toggleTemplatePopover()` and `closeTemplatePopover()` are gone.** The Angular-template popover uses the platform [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API): open and close are wired through the `popovertarget` and `popovertargetaction` attributes instead of a service call. If code of your own called one of these members, replace the call with a `popovertarget="prism-template"` attribute on your trigger element; there is no programmatic open or close any more.
- **`Alt+T` toggles only the variant rail.** The component head no longer hides with it, because it carries the Playground/API view switcher. [`PrismLayoutService`](api/services.md#prismlayoutservice)`.toolbarVisible` and `toggleToolbar()`, which back `Alt+T`, keep their names. Tooling that asserts on the component head disappearing after `Alt+T` has to expect only the variant ribbon to hide.
- **The component head is one row.** Its description, tags, selector and stat row moved into a details popover behind the ⓘ glyph, and the status badge sits inline with the title. Four internal class names left the DOM with them, `.comp-desc`, `.comp-tags`, `.comp-selector` and `.comp-head-stats`, and the variant ribbon's `--vc` custom property is gone. None of them was documented API, but a stylesheet or a browser extension that targeted them no longer matches. See [Tour of the UI: Playground, Overview and API](guide/styleguide-ui.md#playground-overview-and-api).
- **The gauge in the component head shows three values instead of five:** coverage, a11y score and VRT diff. The variant count moved to the details popover, next to the selector and the tags, because it is a property of the component and has no threshold. The bundle-size figure was dropped: it read fields that `@ng-prism/plugin-perf` does not write, so it never showed a value.
- **The canvas toolbar is no longer a band.** It used to take a fixed-height strip between the variant ribbon and the canvas; it is a floating rail now (`.prism-toolrail`), positioned inside `.prism-canvas-wrap`, with a popover menu for the background and the zoom. The recommended background is marked with a border in the primary colour instead of a star, see [Tour of the UI: Background](guide/styleguide-ui.md#background) and [Canvas rail and tools](guide/styleguide-ui.md#canvas-rail-and-tools).
- **22.2.1: the Figma Design Diff tab is opt-in.** In 22.2.0 `figmaPlugin()` added it on its own; from 22.2.1 it needs `designDiff: true`, see [Figma: Options](plugins/figma.md#options).

For a header widget built from the same parts as the gauge, see [`PrismMetricBadgeComponent`](api/plugin-ui.md#metric-badge) and [`PrismIconComponent`](api/plugin-ui.md#icons).

**Deprecated.**

- **`bg: 'checker'`.** It draws the same checkerboard as `'transparent'` while browsing, but captures on a theme token, so a baseline recorded on it depends on the theme the runner's browser started in. Use `'transparent'`, or `'light'` or `'dark'`. See [`bg`](api/showcase-config.md#bg) and [Build Warnings: The checker background](api/build-warnings.md#the-checker-background).

**New.**

- **Capture mode** (`?capture=1`) for screenshot runners, see [External Tooling API: Capture Isolation Mode](guide/external-tooling.md#capture-isolation-mode) and [Visual Regression](guide/visual-regression.md).
- **The [Visual Regression](plugins/visual-regression.md) plugin** shows the results of your own screenshot runner next to each component.
- **Navigation decorations:** a plugin marks sidebar entries with [`navigationDecorations`](api/ng-prism-plugin.md#navigationdecorations). The `wip` status became a dashed-circle icon; before, it was a 6px amber dot in the trailing slot, the position and colour a health signal uses. See [Navigation decorations](architecture/plugin-hooks.md#navigation-decorations).
- **The Overview** shows every variant of a component at once, see [Tour of the UI: The Overview](guide/styleguide-ui.md#the-overview).
- **The details popover** behind ⓘ in the component head, see [Tour of the UI: Playground, Overview and API](guide/styleguide-ui.md#playground-overview-and-api).
- **Density tokens:** one `--density` scales every band of the chrome, see [Theming: Density](guide/theming.md#density).

## Upgrading to 22.1.0

No breaking changes and no deprecations.

**New.**

- **Sidebar sections:** [`section`](api/showcase-config.md#section) and [`sectionOrder`](api/showcase-config.md#sectionorder) group components into sections of your own, see [Ordering the sidebar](guide/showcase-decorator.md#ordering-the-sidebar).

## Removed in 23.0.0

23.0.0 removes everything that is deprecated in 22.x. Each item below is still accepted in 22.x, most of them with a build notice or a warning in the browser console.

| Deprecated                                                                                                                                      | Since  | Instead                                                                                                       | Reference                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `bg: 'checker'`                                                                                                                                 | 22.2.0 | `'transparent'`, or `'light'` or `'dark'`                                                                     | [`bg`](api/showcase-config.md#bg)                                                                              |
| `providers` on `@Showcase`                                                                                                                      | 22.4.0 | The root injector of the styleguide app (`appProviders` or the `providers` in `main.ts`), or a component page | [`providers`](api/showcase-config.md#providers)                                                                |
| `themeStylesheet`                                                                                                                               | 22.6.0 | `theme`, `darkTheme`, `lightTheme`                                                                            | [`themeStylesheet`](api/ng-prism-config.md#themestylesheet)                                                    |
| `ui`                                                                                                                                            | 22.6.0 | The header options, a component page or a plugin                                                              | [`ui`](api/ng-prism-config.md#ui)                                                                              |
| `headless`                                                                                                                                      | 22.6.0 | Capture mode                                                                                                  | [`headless`](api/ng-prism-config.md#headless)                                                                  |
| `appComponent`                                                                                                                                  | 22.6.0 | A component page or a plugin                                                                                  | [`appComponent`](api/ng-prism-config.md#appcomponent)                                                          |
| `NgPrismPlugin.wrapComponent`                                                                                                                   | 22.6.0 | Nothing; remove it                                                                                            | [`wrapComponent`](api/ng-prism-plugin.md#wrapcomponent)                                                        |
| `PanelDefinition.position`                                                                                                                      | 22.6.0 | `placement`                                                                                                   | [`PanelDefinition`](api/ng-prism-plugin.md#paneldefinition)                                                    |
| `perfPlugin()` options `thresholds`, `bundle.excludeImports`, `render`, `memory`, and `PERF_PLUGIN_CONFIG`                                      | 22.6.0 | Nothing; remove them                                                                                          | [Perf: Options](plugins/perf.md#options)                                                                       |
| `PanelBadge.variant`                                                                                                                            | 22.7.0 | `kind`, `tone` and `label`                                                                                    | [`PanelBadge`](api/ng-prism-plugin.md#panelbadge)                                                              |
| `--prism-mark-nominal`, `--prism-mark-attention`, `--prism-mark-critical`                                                                       | 22.7.0 | `--prism-success`, `--prism-warn`, `--prism-danger`                                                           | [`theme`](api/ng-prism-config.md#theme), [Theming: Status Colors](guide/theming.md#status-colors)              |
| `--prism-spectrum`, `--prism-primary-from`, `--prism-primary-to`                                                                                | 22.7.0 | `--prism-brand-gradient`, and `--prism-primary-fill` for fills                                                | [`theme`](api/ng-prism-config.md#theme), [Theming: Brand](guide/theming.md#brand)                              |
| `variants`, `states`, `providers`, `bg`, `canvasLayout`, `host`, `imports` or `renderPage` on a class with `@Injectable`, `@Service` or `@Pipe` | 22.7.0 | Remove the fields; move a demo to a component page                                                            | [Services and pipes](api/showcase-config.md#services-and-pipes)                                                |
| A `@Pipe` with `standalone: false` and one of those fields                                                                                      | 22.7.0 | Make the pipe standalone                                                                                      | [An NgModule pipe that is still a component](api/build-warnings.md#an-ngmodule-pipe-that-is-still-a-component) |

From 23.0.0 a class with `@Injectable` or `@Service` and one of those fields is shown as a service and a standalone `@Pipe` as a pipe, with the fields dropped; a pipe declared in an NgModule is not shown at all.
