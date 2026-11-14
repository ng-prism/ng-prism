// Plugin API exports
export type {
    ComponentApi,
    ComponentComposition,
    CompositionCase,
    ControlDefinition,
    DiscoveryComponent,
    DiscoveryManifest,
    DiscoveryPage,
    DiscoveryPart,
    DiscoveryState,
    DiscoveryVariant,
    HeaderWidgetDefinition,
    InputMeta,
    NavigationDecoration,
    NavigationDecorationDefinition,
    NgPrismColorSchemeConfig,
    NgPrismColorSchemeTarget,
    NgPrismConfig,
    NgPrismPlugin,
    NgPrismShowcaseDefaults,
    OutputMeta,
    PanelBadge,
    PanelDefinition,
    PrismManifest,
    RuntimeComponent,
    RuntimeManifest,
    RuntimePart,
    ScannedComponent
} from './plugin.types.js';
export type { ComponentPage, CustomPage, StyleguidePage } from './page.types.js';
export type { PipeApi, RuntimePipe, ScannedPipe } from './pipe.types.js';
export type {
    ApiDocTags,
    ApiMethod,
    ApiParam,
    ApiProperty,
    ApiSetupEntry,
    ApiTypeDoc,
    ApiTypeRef,
    PanelTarget,
    RuntimeService,
    ScannedService,
    ServiceApi,
    ServiceProvision
} from './service.types.js';

// What a showcase's compositions put into the manifest. Plugins that show the markup of a variant (a snippet, a usage
// example) replace the slot, and the constants name what ng-prism puts into and takes out of a composition.
export { COMPOSITION_SUBJECT_ATTR, COMPOSITION_SUBJECT_SLOT, PRISM_VARIANT_INPUT, SUBJECT_MARKER_ATTR } from '../shared/composition.js';

// The key a part is addressed by: the URL's `part`, the panel service and the `activePart` input of a panel that lists
// parts carry it, and a panel that finds a part by it computes the keys of the parts it is given.
export { partKeys } from '../shared/part-keys.js';

// A `Date` in a showcase value, a default or a payload, as the styleguide shows it: a plugin that shows one shows it the same way.
export { formatDateValue } from '../shared/date-value.js';

// The canvas background a variant renders on. Part of the discovery contract
// (`DiscoveryVariant.bg`), so external tooling and plugins can name the type
// and resolve the declaration the same way the app does.
export type { CanvasBg } from '../shared/canvas-bg.type.js';
export { CANVAS_BGS } from '../shared/canvas-bg.type.js';
export { DEFAULT_VARIANT_BG, resolveVariantBg, showcaseDefaultBg } from '../shared/variant-bg.js';
export type { VariantBgSource } from '../shared/variant-bg.js';

// The pseudo states a variant can force. `Variant.pseudo` reaches plugins
// through `ScannedComponent` and `RuntimeComponent`, and `DiscoveryVariant`
// reports it to external tooling.
export type { ForcedPseudoStates, PseudoState, PseudoTarget } from '../shared/pseudo-state.type.js';
export { PSEUDO_STATES } from '../shared/pseudo-state.type.js';
export { componentPage, customPage } from './page-helpers.js';
export type { ComponentPageOptions } from './page-helpers.js';
export { defineConfig } from './define-config.js';
export { STATUS_DANGER_RATIO, statusFor, thresholdFromTarget, worstTone } from './status.js';
export type { StatusThreshold, StatusTone } from './status.js';
// Imported from the dependency-free registry module, not from
// `prism-icon.component.js`. The builder evaluates plugin config in Node.js,
// and importing the component module would run its `@Component` decorator
// there. Plain Angular classes are fine (`prism-tokens.js` below imports
// `InjectionToken`); decorated declarations are not.
export { ICON_NAMES } from '../app/icons/icon-registry.js';
export { PRISM_CONFIG, PRISM_MANIFEST, PRISM_RENDERER_HOOKS } from '../app/tokens/prism-tokens.js';
export type { PrismRendererHooks } from '../app/tokens/prism-tokens.js';
