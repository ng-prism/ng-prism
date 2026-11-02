# NgPrismConfig

The object that `ng-prism.config.ts` exports as its default, created with `defineConfig()`. This page is the reference for every field: its type, its default and its rules. [Configuration](guide/configuration.md) shows how to use them, and the builder option [`configFile`](api/builders.md#configfile) points the builders at another file.

```typescript
import { defineConfig } from '@ng-prism/core/config';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    title: 'Acme UI',
    plugins: [jsDocPlugin()]
});
```

`defineConfig()` returns the object as it is, typed as `NgPrismConfig`, and warns when two plugins have the same `name`.

```typescript
interface NgPrismConfig {
    plugins?: NgPrismPlugin[];
    pages?: StyleguidePage[];
    appProviders?: Provider[];
    title?: string;
    subtitle?: string;
    logo?: { light?: string; dark?: string };
    buildInfo?: { version?: string; gitHash?: string };
    theme?: Record<string, string>;
    darkTheme?: Record<string, string>;
    lightTheme?: Record<string, string>;
    urlState?: boolean;
    persistState?: boolean;
    a11y?: {
        thresholds?: { score?: number; critical?: number; serious?: number; moderate?: number };
        gate?: { score?: number; critical?: number; serious?: number; moderate?: number } | false;
        reportPath?: string;
    };
    strictShowcase?: boolean;
    /** @deprecated */
    themeStylesheet?: string;
    /** @deprecated */
    ui?: {
        header?: Type<unknown>;
        sidebar?: Type<unknown>;
        componentHeader?: Type<unknown>;
        renderer?: Type<unknown>;
        controlsPanel?: Type<unknown>;
        eventsPanel?: Type<unknown>;
        footer?: Type<unknown>;
    };
    /** @deprecated */
    headless?: boolean;
    /** @deprecated */
    appComponent?: Type<unknown>;
}
```

`NgPrismConfig` is exported from `@ng-prism/core/config`, next to `defineConfig()`.

## Plugins, pages and providers

What the styleguide shows beyond the showcases, and what its components get injected.

### `plugins`

**Type** [`NgPrismPlugin[]`](api/ng-prism-plugin.md) · **Default** none

The plugins to activate, in this order. At build time their hooks run in this order on every component, service, pipe and page, see [Plugin Hooks](architecture/plugin-hooks.md). In the styleguide they add panels, input controls, header widgets and sidebar markers.

The plugins also decide whether services and pipes get pages: the build reads them only when a plugin has a view panel that applies to them, such as `jsDocPlugin()`, see [Services & Pipes](guide/services-and-pipes.md).

Two plugins with the same `name` make `defineConfig()` warn, since the later hooks may overwrite what the earlier ones wrote.

```typescript
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin(), figmaPlugin()]
});
```

**Warnings:** [Build Warnings](api/build-warnings.md#plugins)

**Guide:** [Overview](plugins/overview.md) of the official plugins and how to add one, [Writing a Plugin](plugins/writing-plugins.md)

### `pages`

**Type** [`StyleguidePage[]`](api/types.md#styleguidepage) · **Default** none

Pages of data for the _Pages_ section of the sidebar. Only a [`CustomPage`](api/types.md#custompage) works here: the build passes each page through the plugins' `onPageScanned` and writes it into the manifest as JSON, where the class of a [`ComponentPage`](api/types.md#componentpage) does not survive. Register a component page with `providePrism(manifest, config, { componentPages })` in `main.ts` instead.

```typescript
export default defineConfig({
    pages: [
        {
            type: 'custom',
            title: 'Changelog',
            category: 'Meta',
            data: { version: '2.1.0' }
        }
    ]
});
```

**Guide:** [Component Pages](guide/component-pages.md)

### `appProviders`

**Type** `Provider[]` · **Default** none

Angular providers for the root injector of the styleguide app, added at bootstrap. Every rendered component can inject them. For a provider that only one component may see, render that component through a [component page](guide/component-pages.md) that declares the provider.

```typescript
import { DEFAULT_CURRENCY_CODE } from '@angular/core';

export default defineConfig({
    appProviders: [{ provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' }]
});
```

Two limits send a provider to the `providers` of the styleguide app's `main.ts` instead, next to `providePrism(…)`, where it reaches the same root injector, see [Adding Global Providers](guide/configuration.md#adding-global-providers):

- **Only installed packages.** The builders import the config in Node.js as well, without your path mappings and without Angular's compiler, so a provider made of your library, such as a mock of one of its services or one of its tokens, cannot be imported here.
- **Only `Provider`.** The type is Angular's `Provider[]`, so a function that returns `EnvironmentProviders` does not type-check in this list: `provideHttpClient()`, or `provideRouter()` for a component with `routerLink`.

**Guide:** [Configuration](guide/configuration.md)

## Header

The brand in the header of the styleguide. On a phone the header gets narrower, see [Tour of the UI](guide/styleguide-ui.md#on-a-phone).

### `title`

**Type** `string` · **Default** none: the ng-prism wordmark

The name in the header, in plain text and the regular text colour. Without it, the header shows the ng-prism wordmark in the brand gradient. "Powered by ng-prism" stays at the foot of the sidebar either way. On a phone, a long title is cut short when the header runs out of room.

**Guide:** [Configuration](guide/configuration.md)

### `subtitle`

**Type** `string` · **Default** none

Smaller text under the title or the wordmark, monospace and muted. Not shown on a phone.

**Guide:** [Configuration](guide/configuration.md)

### `logo`

**Type** `{ light?: string; dark?: string }` · **Default** none: the ng-prism symbol

Image URLs for the logo in front of the title, `light` for light backgrounds and `dark` for dark ones. The header is a navy band in both themes, so `dark` is shown whenever it is set, in both themes, and `light` only when it is the only one. On a phone, a wide logo is capped at 40% of the screen width.

```typescript
export default defineConfig({
    title: 'Acme UI',
    subtitle: 'acme/design-system',
    logo: {
        light: 'assets/logo-on-light.svg',
        dark: 'assets/logo-on-dark.svg'
    }
});
```

**Guide:** [Configuration](guide/configuration.md)

### `buildInfo`

**Type** `{ version?: string; gitHash?: string }` · **Default** none

A pill in the header, left of the action buttons, with the deployed version and commit: `v1.2.3 · a1b2c3d`. `version` is shown with a `v` in front, `gitHash` cut to its first 7 characters, and the pill shows whichever of the two is set. Without either, there is no pill. On a phone it moves into the ⋮ menu.

```typescript
export default defineConfig({
    buildInfo: {
        version: '1.2.3',
        gitHash: 'a1b2c3d4e5f6'
    }
});
```

**Guide:** [Configuration](guide/configuration.md)

## Theme tokens

Overrides of the CSS custom properties the styleguide is drawn with. The tokens and what they colour are listed under [Theming](guide/theming.md).

### `theme`

**Type** `Record<string, string>` · **Default** none

Token overrides for both themes, applied over the built-in values. For a token that `darkTheme` or `lightTheme` sets as well, `theme` wins.

```typescript
export default defineConfig({
    theme: {
        '--prism-primary': '#0ea5e9',
        '--prism-font-sans': '"Inter", system-ui, sans-serif'
    }
});
```

Six tokens are deprecated since 22.7.0, removed in 23.0.0: `--prism-mark-nominal`, `--prism-mark-attention` and `--prism-mark-critical`, whose value still reaches `--prism-success`, `--prism-warn` and `--prism-danger` until then, and `--prism-spectrum`, `--prism-primary-from` and `--prism-primary-to`, which nothing reads any more (`--prism-brand-gradient` replaces them). An override of one in `theme`, `darkTheme` or `lightTheme` prints a warning at build time, and the styleguide warns once per token in the browser console.

**Warnings:** [Build Warnings](api/build-warnings.md#a-deprecated-theme-token)

**Guide:** [Theming](guide/theming.md)

### `darkTheme`

**Type** `Record<string, string>` · **Default** none

Token overrides for the dark theme only. The header renders with the dark tokens in both themes, so a value here also reaches the header while the styleguide is light.

**Guide:** [Theming](guide/theming.md)

### `lightTheme`

**Type** `Record<string, string>` · **Default** none

Token overrides for the light theme only. They do not reach the header, which renders with the dark tokens in both themes.

```typescript
export default defineConfig({
    darkTheme: { '--prism-bg': '#0b1120' },
    lightTheme: { '--prism-bg': '#f8fafc' }
});
```

**Guide:** [Theming](guide/theming.md)

## Styleguide state

What the styleguide keeps across reloads and in its links.

### `urlState`

**Type** `boolean` · **Default** `true`

Whether the styleguide keeps its selection in the URL: the component, service, pipe or page, and the variant, state, view, part and panel, as query parameters. With `false` it neither writes them nor restores the selection from them.

```typescript
export default defineConfig({ urlState: false });
```

**Guide:** [Links & State](guide/url-state.md)

### `persistState`

**Type** `boolean` · **Default** `true`

Whether the styleguide keeps the values changed in the Controls panel, per component and variant, and the active tab and perspective of the accessibility panel in `sessionStorage`, so that a reload keeps them. Capture mode never restores them. The layout, the theme and the canvas settings are kept in `localStorage` either way.

```typescript
export default defineConfig({ persistState: false });
```

**Guide:** [Links & State](guide/url-state.md)

## Checks

What the build checks: the library-wide a11y report, and the `@Showcase` values it reads.

### `a11y`

**Type** `{ thresholds?, gate?, reportPath? }` · **Default** see the table

The settings for the library-wide [a11y report](guide/a11y-reports.md), a JSON file that you write with an audit of your own and the build reads.

| Key                   | Type                                 | Default              | Description                                   |
| --------------------- | ------------------------------------ | -------------------- | --------------------------------------------- |
| `thresholds.score`    | `number`                             | `80`                 | Lowest average score of the library, 0 to 100 |
| `thresholds.critical` | `number`                             | `0`                  | Most critical violations                      |
| `thresholds.serious`  | `number`                             | `0`                  | Most serious violations                       |
| `thresholds.moderate` | `number`                             | no limit             | Most moderate violations                      |
| `gate`                | the keys of `thresholds`, or `false` | `thresholds`         | The limits `build` fails on. Since 22.7.0     |
| `reportPath`          | `string`                             | `'a11y-report.json'` | The report, relative to the workspace root    |

- **`thresholds`** grades every a11y figure of the styleguide: the header pill, the marker in the sidebar, the gauge in the component head and the score card.
- **`gate`** is what the [`build`](api/builders.md#build) builder fails on when the report's total breaks it. A key left out of `gate` takes the default above, not the value of `thresholds`. Without `gate`, the build fails on `thresholds`. `gate: false` never fails the build, so that the styleguide can show a report that breaks the limits while CI gates on its own. `serve` only warns.
- **`reportPath`**: without a report there, the styleguide shows no pill and the build checks no gate. `serve` watches the file and rescans when an audit rewrites it.

```typescript
export default defineConfig({
    a11y: {
        thresholds: { score: 85, moderate: 5 },
        gate: false,
        reportPath: 'reports/a11y.json'
    }
});
```

**Warnings:** [Build Warnings](api/build-warnings.md#the-a11y-gate-failed)

**Guide:** [A11y Reports](guide/a11y-reports.md#report-schema) for the report's shape, [A11y Reports › Gating](guide/a11y-reports.md#gating), [Audits in CI](guide/ci.md#accessibility)

### `strictShowcase`

**Type** `boolean` · **Default** `false`

Fails the build when the scan had to drop a `@Showcase` value, instead of only warning. Every message of the kind _diagnostic_ under [Build Warnings](api/build-warnings.md#how-messages-look) counts: a value it cannot evaluate, an invalid field, a `@Showcase` without `title`, a composition it cannot build, a `partOf` that does not resolve, the deprecated `providers`. Notices and hints never count. Most diagnostics of a service or a pipe only come up when a plugin shows services or pipes, see [Services and pipes](api/build-warnings.md#services-and-pipes).

With `strictShowcase` on, the build stops after the scan, before the plugin hooks run and before a manifest is written:

```typescript
export default defineConfig({ strictShowcase: true });
```

```
ng-prism: strictShowcase is enabled and 2 @Showcase value(s) were dropped; see the warnings above.
```

`build` exits with this error, and `serve` does not start. A rescan of `serve` that fails this way logs the error, and the previous manifest stays in place.

**Warnings:** [Build Warnings](api/build-warnings.md#strictshowcase-stopped-the-build)

## Deprecated options

Four options of `NgPrismConfig` are never read by anything, so setting one has no effect. Each is deprecated since 22.6.0, removed in 23.0.0. While one is set, the build prints a notice, see [Build Warnings](api/build-warnings.md#a-config-option-that-never-had-an-effect); remove it. [Upgrade Notes 22.x](guide/upgrade-notes-22.md#removed-in-2300) lists everything that is removed in 23.0.0.

### `themeStylesheet`

**Type** `string` · **Deprecated** since 22.6.0, removed in 23.0.0

Was meant to load a stylesheet into the styleguide. Colours, fonts and density go through [`theme`](#theme), [`darkTheme`](#darktheme) and [`lightTheme`](#lighttheme).

### `ui`

**Type** `{ header?, sidebar?, componentHeader?, renderer?, controlsPanel?, eventsPanel?, footer? }`, each a `Type<unknown>` · **Deprecated** since 22.6.0, removed in 23.0.0

Was meant to replace regions of the styleguide with components of your own. What works instead:

- **Branding:** [`title`](#title), [`subtitle`](#subtitle), [`logo`](#logo) and [`buildInfo`](#buildinfo) for the header, and the [theme tokens](#theme) for the colours.
- **Your own content inside the styleguide:** a [component page](guide/component-pages.md), which renders your Angular component with the services ng-prism provides.
- **More panels, header widgets, input controls or sidebar markers:** a [plugin](plugins/writing-plugins.md).

### `headless`

**Type** `boolean` · **Deprecated** since 22.6.0, removed in 23.0.0

Was meant to strip the styleguide down to the canvas. For screenshots, capture mode renders the component without the styleguide around it, see [External Tooling API](guide/external-tooling.md#capture-isolation-mode).

### `appComponent`

**Type** `Type<unknown>` · **Deprecated** since 22.6.0, removed in 23.0.0

Was meant to replace the whole shell of the styleguide. Use a [component page](guide/component-pages.md) for your own content and a [plugin](plugins/writing-plugins.md) for panels and widgets, as under [`ui`](#ui).
