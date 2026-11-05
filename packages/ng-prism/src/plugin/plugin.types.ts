import type { Provider, Type } from '@angular/core';
import type { ShowcaseImport } from '../decorator/showcase.types.js';
import type { CanvasBg } from '../shared/canvas-bg.type.js';
import type { ForcedPseudoStates } from '../shared/pseudo-state.type.js';
import type { StyleguidePage } from './page.types.js';
import type { RuntimePipe, ScannedPipe } from './pipe.types.js';
import type { ApiDocTags, ApiMethod, ApiTypeDoc, ApiTypeRef, PanelTarget, RuntimeService, ScannedService } from './service.types.js';

export interface NgPrismPlugin {
    /** Unique plugin name, used for debugging and conflict detection */
    name: string;

    // Build-time hooks (run inside the Angular builder / Node.js)
    onComponentScanned?: (component: ScannedComponent) => ScannedComponent | void | Promise<ScannedComponent | void>;
    onServiceScanned?: (service: ScannedService) => ScannedService | void | Promise<ScannedService | void>;
    onPipeScanned?: (pipe: ScannedPipe) => ScannedPipe | void | Promise<ScannedPipe | void>;
    onPageScanned?: (page: StyleguidePage) => StyleguidePage | void | Promise<StyleguidePage | void>;
    onManifestReady?: (manifest: PrismManifest) => PrismManifest | void | Promise<PrismManifest | void>;
    /**
     * Set when a hook or a panel of the plugin reads {@link ScannedComponent.api}. The scan only reads the API of the
     * components, and the manifest only carries it, when a plugin in the config sets this. Read from the plugin's
     * Node entry, like the build-time hooks.
     *
     * @experimental Experimental until 23.0.0, like {@link ComponentApi}: it may change in a 22.x minor release.
     */
    componentApi?: boolean;

    // Runtime contributions (embedded into the Prism app)
    panels?: PanelDefinition[];
    controls?: ControlDefinition[];
    /** Header widgets rendered in the Prism shell header bar */
    headerWidgets?: HeaderWidgetDefinition[];
    /** Markers contributed to each component's navigation item. */
    navigationDecorations?: NavigationDecorationDefinition[];
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. */
    wrapComponent?: Type<unknown>;
}

export interface HeaderWidgetDefinition {
    /** Unique widget id, used for de-duplication and tracking. */
    id: string;
    /** Eager component reference. */
    component?: Type<unknown>;
    /**
     * Lazy-loaded component. Use it when the widget pulls in browser-only or
     * heavy dependencies that should not run at config-load time.
     */
    loadComponent?: () => Promise<Type<unknown>>;
    /** Slot in the header: 'start' renders next to the brand, 'end' next to the existing actions. Default: 'end'. */
    placement?: 'start' | 'end';
    /** Sort order within the same placement (lower = earlier). Default: 0. */
    order?: number;
}

/**
 * A short marker on a panel's tab.
 *
 * Two kinds, and a filled badge means exactly one thing: `issues` is a number of
 * open findings, drawn as a pill in its tone and hidden at zero; `count` is a
 * plain quantity, drawn as a muted figure without a fill.
 */
export interface PanelBadge {
    /** Defaults from `variant` for badges written before 22.7: a judgement is `issues`, anything else `count`. Since 22.7.0. */
    kind?: 'count' | 'issues';
    /** Kept to a couple of characters because the tab bar scrolls horizontally. */
    text: string;
    /** Tone of an `issues` badge. Default `'danger'`. Since 22.7.0. */
    tone?: 'primary' | 'warn' | 'danger';
    /** Read after the tab's label by assistive technology, e.g. `'1 violation'`. Defaults to `text`. Since 22.7.0. */
    label?: string;
    /**
     * @deprecated Deprecated since 22.7.0, removed in 23.0.0. Use `kind` and `tone`:
     * `warn`/`danger` map to `kind: 'issues'` with that tone, `default` to `kind: 'count'`,
     * and `ok` is not rendered.
     */
    variant?: 'default' | 'ok' | 'warn' | 'danger';
}

/** What one source has to say about one component in the navigation. */
export interface NavigationDecoration {
    /**
     * Colour role. Only two: an 'ok' state would make the marker
     * permanent, and a marker that is always present stops being a signal.
     */
    variant: 'warn' | 'danger';
    /** One tooltip line for this source, e.g. 'A11y: 2 critical, 1 serious'. */
    label: string;
}

export interface NavigationDecorationDefinition {
    /** Unique id, used for de-duplication when two plugins contribute the same source. */
    id: string;
    /** Icon name from the built-in registry (`ICON_NAMES`). */
    icon: string;
    /**
     * Fixed slot order (lower = further left). The order is part of the reading
     * contract: position alone names the source, so a decoration must not move
     * depending on plugin registration order.
     * Built-in: a11y 10, visual-regression 20, coverage 30.
     */
    order?: number;
    /**
     * The component's standing for this source, or `null` for "nothing worth
     * saying".
     *
     * Called during change detection, so it has to be cheap and pure: read what
     * the component's `meta` already holds, do not fetch and do not inject.
     */
    badge: (component: RuntimeComponent) => NavigationDecoration | null;
}

export interface PanelDefinition {
    id: string;
    label: string;
    /** Angular standalone component for the panel content */
    component?: Type<unknown>;
    /** Lazy-loaded component. Use when the component import would pull in browser-only dependencies (e.g. DomSanitizer) */
    loadComponent?: () => Promise<Type<unknown>>;
    overlayComponent?: Type<unknown>;
    loadOverlayComponent?: () => Promise<Type<unknown>>;
    icon?: string;
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. Where a panel appears is `placement`. */
    position?: 'bottom' | 'right';
    /** Where this panel appears: 'addon' (the tab bar below the canvas) or 'view' (top view toolbar). Default: 'addon' */
    placement?: 'addon' | 'view';
    /**
     * Where this panel appears. Default: `['component']`. A panel with `'component'`
     * gets the input `activeComponent`, one with `'service'` gets the input
     * `activeService` (`RuntimeService | null`), one with `'pipe'` gets the input
     * `activePipe` (`RuntimePipe | null`). `isVisible` and `badge` are only
     * called for components.
     *
     * `'service'` and `'pipe'` only count on a view panel (`placement: 'view'`): a
     * service or pipe page has no addon area, so an addon panel shows on component
     * pages alone, and only when it applies to `'component'`. Since 22.7.0.
     */
    appliesTo?: readonly PanelTarget[];
    /**
     * The panel shows the parts of the active component (a view panel for `'component'`). It gets the input
     * `activePart` (`string | null`), the class name of the part to show, and a part's popover in the component head
     * links to it. Without this flag the panel gets no `activePart`, so it need not declare the input. When several
     * panels set it, the link goes to the first in registration order. Since 22.7.0.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    listsParts?: boolean;
    /** Providers injected into a child EnvironmentInjector scoped to this panel */
    providers?: Provider[];
    /** When provided, the panel tab is only shown if this returns true for the active component */
    isVisible?: (component: RuntimeComponent) => boolean;
    /**
     * When provided, the panel's tab carries this badge for the active
     * component. Return `null` for "nothing worth saying": a badge that is
     * always present stops being a signal.
     *
     * Called during change detection, so it has to be cheap and pure: read what
     * the component's `meta` already holds, do not fetch and do not inject.
     */
    badge?: (component: RuntimeComponent) => PanelBadge | null;
    /**
     * Keep the panel's component instance alive across tab switches.
     * When `true`, the panel is rendered once on first activation and merely hidden
     * (instead of destroyed) when the user switches tabs. Use for panels with
     * expensive setup (iframes, network calls, heavy DOM), e.g. embedded designs,
     * remote previews.
     *
     * Default: `false`.
     */
    keepAlive?: boolean;
}

export interface ControlDefinition {
    /** Returns true if this control should handle the given input */
    matchType: (input: InputMeta) => boolean;
    /** Angular standalone component that renders the control */
    component: Type<unknown>;
}

// --- Manifest types (generated by the builder scanner) ---

export interface PrismManifest {
    components: ScannedComponent[];
    services?: ScannedService[];
    pipes?: ScannedPipe[];
    pages?: StyleguidePage[];
    /** Library-wide plugin metadata (e.g. aggregate coverage totals). */
    meta?: Record<string, unknown>;
}

export interface ScannedComponent {
    className: string;
    filePath: string;
    showcaseConfig: import('../decorator/showcase.types.js').ShowcaseConfig;
    inputs: InputMeta[];
    outputs: OutputMeta[];
    componentMeta: {
        selector: string;
        standalone: boolean;
        isDirective: boolean;
    };
    /** Import path for the component's entry point (e.g. 'my-lib/atoms/pill') */
    importPath?: string;
    /**
     * Base classes with source the component extends, nearest first, for a
     * plugin to read what the component inherits. Build time only: the
     * manifest does not carry it.
     */
    baseClasses?: { className: string; filePath: string }[];
    /**
     * What the API page needs beyond `inputs` and `outputs`. Read only when a
     * plugin in the config sets {@link NgPrismPlugin.componentApi}. Absent
     * without one, when the scan cannot read it, when a plugin hook builds the
     * component, or in the manifest of an older core.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    api?: ComponentApi;
    /**
     * The compositions of the showcase: what its variants render, written as Angular templates. Absent when no variant
     * declares a `template` or a host template, and when a plugin hook builds the component. Since 22.7.0.
     */
    composition?: ComponentComposition;
    /**
     * The class name of the component or directive this one is a part of, set only when the selector in
     * `showcaseConfig.partOf` resolved to exactly one other showcased class. A plugin that works per page, such as one
     * that builds or photographs something for each component, skips a component that has it: the styleguide shows a
     * part on the page of its parent. A `partOf` that did not resolve is dropped from `showcaseConfig` and leaves this
     * unset, so the class stays a component of its own. Since 22.7.0.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    parentClassName?: string;
    /**
     * The parts of this component or directive, those showcased classes whose `partOf` names its selector, sorted by
     * title. Build time only: the `PrismManifest` that `onManifestReady` receives has them here and not in
     * `components`, and the runtime manifest carries them as {@link RuntimeComponent.parts}. The per-item hooks, such as
     * `onComponentScanned`, run before the parts are nested and see each part as a component of its own. Since 22.7.0.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    parts?: ScannedComponent[];
    /** Arbitrary plugin metadata */
    meta?: Record<string, unknown>;
}

/**
 * One distinct composition of a showcase, the markup of one or more variants as the generated wrapper renders it in a
 * `@case`. Since 22.7.0.
 *
 * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
 */
export interface CompositionCase {
    /**
     * The markup as written, the subject element included, with `COMPOSITION_SUBJECT_SLOT` at the end of the start tag
     * of the subject.
     */
    template: string;
    /**
     * The inputs of the subject that the wrapper does not bind in this case: `'template'` when the template sets the
     * input itself, `'default'` when its default could not be read and the variant does not set it. Controls show
     * them as not editable. `name` is the member name.
     */
    unbound: { name: string; reason: 'template' | 'default' }[];
    /**
     * Where the case comes from, as `file:line` and the variants: for the comments and errors of the generated code.
     * Set by the scan at build time, absent in the runtime manifest.
     */
    origin?: string;
}

/**
 * The compositions of a showcase: the distinct ones, and which one each variant uses. Since 22.7.0.
 *
 * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
 */
export interface ComponentComposition {
    /**
     * One entry per variant, or one for a showcase without variants, which renders as one implicit variant. Each is
     * the index into `cases`, or `-1` for a variant without a composition, which renders as it did before.
     */
    variantCases: number[];
    cases: CompositionCase[];
    /**
     * Every class the generated wrapper imports besides the subject: the library classes the templates use, matched
     * by selector, the showcase's `imports`, and the class of a directive's object host. Set by the scan, and in the
     * runtime manifest as well, so that a usage example in the browser can name them.
     */
    imports?: ShowcaseImport[];
}

/**
 * What the API page of a component or directive needs beyond `inputs` and `outputs`.
 *
 * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
 */
export interface ComponentApi {
    /** The class's own description (Markdown, `{@link}` kept), as for services and pipes. */
    description?: string;
    tags: ApiDocTags;
    /** The type of each input by member name, as written, with links. */
    inputTypes: Record<string, ApiTypeRef>;
    /** The payload type of each `output()` by member name. */
    outputTypes: Record<string, ApiTypeRef>;
    /** One entry per `model()` input: the change output Angular adds for it. `input` is the member name. */
    modelChanges: { input: string; event: string; type: ApiTypeRef }[];
    /** Public methods with JSDoc of their own or inherited, signatures from the code. */
    methods: ApiMethod[];
    types: ApiTypeDoc[];
}

export interface InputMeta {
    /** The class member. Variants and controls use this name. */
    name: string;
    /** The public name Angular binds the input by, when an `alias` makes it differ from `name`. */
    alias?: string;
    /** `'date'` is the runtime's `Date`, also with `null` or `undefined` (`Date | null`), since 22.8.0. */
    type: 'string' | 'number' | 'boolean' | 'union' | 'date' | 'array' | 'object' | 'unknown';
    rawType?: string;
    values?: string[];
    /**
     * For a `'date'`: what an emptied date control writes, `'null'` when the type allows `null`, else `'undefined'` when
     * it allows `undefined`. Not set when it allows neither, so the date cannot be emptied. Since 22.8.0.
     */
    emptyValue?: 'null' | 'undefined';
    defaultValue?: unknown;
    /**
     * The input starts out with a value the scan could not evaluate, such as the result of a function call: it has a
     * default, but `defaultValue` cannot say which. Not set for `input<string>()`, which starts out `undefined`.
     * Since 22.7.0.
     */
    defaultUnreadable?: true;
    required: boolean;
    doc?: string;
    /**
     * The input is a `model()` or `model.required()`, for which Angular adds the output `${alias ?? name}Change`.
     * {@link ScannedComponent.outputs} has no entry for that output, since no class member declares it. Since 22.7.0.
     */
    model?: true;
}

export interface OutputMeta {
    /** The class member. */
    name: string;
    /** The public event name, when an `alias` makes it differ from `name`. */
    alias?: string;
    doc?: string;
}

// --- Runtime manifest types (post-builder, contains actual class references) ---

export interface RuntimeManifest {
    components: RuntimeComponent[];
    services?: RuntimeService[];
    pipes?: RuntimePipe[];
    pages?: StyleguidePage[];
    /** Library-wide plugin metadata, mirrored from the build-time PrismManifest. */
    meta?: Record<string, unknown>;
}

export interface RuntimeComponent {
    meta: ScannedComponent;
    type: Type<unknown>;
    /**
     * The generated wrapper that renders the compositions of the showcase, for a component with
     * {@link ScannedComponent.composition}. It is set to the index of the variant through its `__prismVariant__` input.
     * When every variant is composed, `type` is this wrapper too. Since 22.7.0.
     */
    composition?: Type<unknown>;
    /**
     * The parts of the component, in the order of {@link ScannedComponent.parts}. The styleguide shows each one on this
     * component's page and never on a page of its own. Absent for a component without parts. Since 22.7.0.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    parts?: RuntimePart[];
}

/**
 * A part in the runtime manifest: its scanned data and nothing else. It has no `type`, because the styleguide never
 * renders a part by itself: the variants of the parent do, and the manifest does not import the class of a part unless
 * a composition of the parent uses it. Since 22.7.0.
 *
 * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
 */
export interface RuntimePart {
    meta: ScannedComponent;
}

// --- Discovery manifest (the `__PRISM_MANIFEST__` global) ---

/**
 * The shape external tooling reads from `globalThis.__PRISM_MANIFEST__`.
 *
 * A thin, JSON-safe projection of the runtime manifest: enough to enumerate and
 * address every variant and component-level state, plus the `@Showcase` metadata
 * a tool needs to decide how to treat one. It carries no Angular class
 * references, and `meta` values that cannot survive a structured clone are
 * dropped rather than half-serialised.
 */
export interface DiscoveryManifest {
    components: DiscoveryComponent[];
    pages: DiscoveryPage[];
}

export interface DiscoveryComponent {
    className: string;
    /** `ShowcaseConfig.title`, i.e. the display name, not the class name. */
    title: string;
    variants: DiscoveryVariant[];
    /**
     * `ShowcaseConfig.states`: the component-level states, one entry per declared
     * slot. Omitted when the component declares none. A component without
     * `variants` lists them next to its single `Default` variant.
     *
     * Whether a state fits a variant is not part of the manifest, because that is
     * only known once the variant renders; the render marker reports it
     * (`data-prism-excluded`).
     */
    states?: DiscoveryState[];
    /** Sanitised `ShowcaseConfig.meta`. Omitted when empty. */
    meta?: Record<string, unknown>;
    /**
     * The parts of the component or directive, those showcases whose `partOf` names its selector, in the order of the
     * styleguide's page (sorted by title). A part is not in `components`: it has no page, no variants and no render
     * marker of its own, and the variants of this component are what render it. Omitted when there are none.
     * Since 22.7.0.
     *
     * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
     */
    parts?: DiscoveryPart[];
}

/**
 * A part of a component or directive in `__PRISM_MANIFEST__`: what a tool needs to list it and to know the surface of
 * the class the variants of the parent render. Not something to visit or capture: a part has no page of its own, and
 * `?component=` with its class name opens its parent. Since 22.7.0.
 *
 * @experimental Experimental until 23.0.0: the shape may change in a 22.x minor release.
 */
export interface DiscoveryPart {
    className: string;
    /** `ShowcaseConfig.title`, i.e. the display name, not the class name. */
    title: string;
    /** The selector of the class, as `@Component` or `@Directive` declares it. */
    selector: string;
    /** The public names the inputs are bound by: the `alias` where there is one, else the member name. */
    inputs: string[];
    /**
     * The public names the outputs are bound by: the `alias` where there is one, else the member name. Then the change
     * output Angular adds for each `model()` input, `${alias ?? name}Change`, see {@link InputMeta.model}.
     */
    outputs: string[];
}

export interface DiscoveryVariant {
    name: string;
    /** 0-based index into the `variants` array (the `?variant=` URL value). */
    index: number;
    /**
     * The canvas background this variant renders on, already resolved:
     * `Variant.bg`, else `ShowcaseConfig.bg`, else `DEFAULT_VARIANT_BG`.
     *
     * Always present, because a screenshot runner cannot act on "nothing
     * declared". It is also the background capture mode paints, so the value
     * here and the pixels in the capture agree.
     */
    bg: CanvasBg;
    /** Sanitised `Variant.meta`. Omitted when empty. */
    meta?: Record<string, unknown>;
    /**
     * `Variant.pseudo`: the pseudo states the variant forces. Omitted when it
     * forces none. The render marker waits for them, so a capture shows them
     * without any action on the runner's side.
     */
    pseudo?: ForcedPseudoStates;
    /**
     * `false` when the variant opts out of the component's `states` (`Variant.states`).
     * Omitted otherwise. Nothing is forced for a state on such a variant, and the
     * render marker still reports its cell as excluded.
     */
    states?: false;
}

export interface DiscoveryState {
    name: string;
    /** 0-based index into the `states` array (the `?state=` URL value). */
    index: number;
    /**
     * The pseudo states the state forces, exactly as declared. An empty object
     * for a slot that forces nothing, for example one the scanner could not
     * evaluate: the slot stays listed so the indices behind it keep their value.
     */
    pseudo: ForcedPseudoStates;
}

export interface DiscoveryPage {
    title: string;
}

// --- defineConfig types ---

/**
 * What a theme switched by a class or an attribute needs on the shown
 * component for one color scheme. Since 22.8.0.
 */
export interface NgPrismColorSchemeTarget {
    /** A class such as `'dark'`, or several separated by spaces. */
    class?: string;
    /** Attributes and their values, such as `{ 'data-mode': 'dark' }`. */
    attributes?: Readonly<Record<string, string>>;
}

/** The {@link NgPrismColorSchemeTarget} per emulated color scheme, see {@link NgPrismConfig.colorScheme}. Since 22.8.0. */
export interface NgPrismColorSchemeConfig {
    light?: NgPrismColorSchemeTarget;
    dark?: NgPrismColorSchemeTarget;
}

export interface NgPrismConfig {
    plugins?: NgPrismPlugin[];
    pages?: StyleguidePage[];
    /** Providers added to the Prism app bootstrap, for library-wide services */
    appProviders?: Provider[];
    theme?: Record<string, string>;
    darkTheme?: Record<string, string>;
    lightTheme?: Record<string, string>;
    logo?: {
        light?: string;
        dark?: string;
    };
    title?: string;
    subtitle?: string;
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. */
    themeStylesheet?: string;
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. */
    ui?: {
        header?: Type<unknown>;
        sidebar?: Type<unknown>;
        componentHeader?: Type<unknown>;
        renderer?: Type<unknown>;
        controlsPanel?: Type<unknown>;
        eventsPanel?: Type<unknown>;
        footer?: Type<unknown>;
    };
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. */
    headless?: boolean;
    /** @deprecated Deprecated since 22.6.0, removed in 23.0.0. It has never had an effect: nothing reads it. */
    appComponent?: Type<unknown>;
    /** When false, disables URL state sync (default: true). */
    urlState?: boolean;
    /** When false, disables sessionStorage state persistence (default: true). */
    persistState?: boolean;
    buildInfo?: {
        version?: string;
        gitHash?: string;
    };
    /** Accessibility (build-time audit + runtime live audit) configuration. */
    a11y?: import('../app/panels/a11y/a11y.types.js').NgPrismA11yConfig;
    /**
     * Switches a theme that hangs on a class or an attribute along with the
     * color scheme the canvas simulates. While it emulates `light` or `dark`,
     * the shown component's host element and the CDK overlay container get the
     * class and the attributes named for that scheme, on top of the emulated
     * `prefers-color-scheme` and `color-scheme`. Under `System` they get
     * neither, and the component has its own classes and attributes back.
     *
     * Selectors such as `.dark .btn`, `:host-context(.dark)` or
     * `[data-mode='dark'] .btn` follow it. A theme keyed on `:root`, `html` or
     * `body` does not work: setting it there would hit the styleguide's own UI
     * too. Avoid `data-theme` as well, which the shell sets on `<html>` for its
     * own theme, so the rules of both themes would match.
     *
     * ```ts
     * colorScheme: {
     *     dark: { class: 'dark' },
     *     light: { attributes: { 'data-mode': 'light' } }
     * }
     * ```
     *
     * Since 22.8.0.
     */
    colorScheme?: NgPrismColorSchemeConfig;
    /**
     * When true, the build fails instead of warning whenever the scanner has
     * to drop a `@Showcase` value: one it cannot evaluate statically, an
     * invalid `bg`, `status`, `canvasLayout` or `pseudo`, a missing `title`,
     * or the deprecated `providers`, which never reach the styleguide, or a
     * `partOf` that matches no single other showcased component.
     * Default: `false`.
     */
    strictShowcase?: boolean;
}
