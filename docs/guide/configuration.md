# Configuration

ng-prism reads its configuration from `ng-prism.config.ts` in the workspace root, which `ng add` creates. The file exports the object of `defineConfig()` as its default:

```typescript
// ng-prism.config.ts (workspace root)
import { defineConfig } from '@ng-prism/core/config';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    title: 'Acme UI',
    plugins: [jsDocPlugin()]
});
```

Both sides load it: the builders while they build the styleguide, and the styleguide app in the browser, which imports it in its `main.ts`. The builder option [`configFile`](api/builders.md#configfile) points at another file. This page goes through the common tasks; every field, with its type, its default and its rules, is under [NgPrismConfig](api/ng-prism-config.md).

## Plugins

Plugins add panels, input controls, header widgets and sidebar markers. List them in [`plugins`](api/ng-prism-config.md#plugins), in the order their tabs should appear:

```typescript
import { defineConfig } from '@ng-prism/core/config';
import { figmaPlugin } from '@ng-prism/plugin-figma';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';

export default defineConfig({
    plugins: [jsDocPlugin(), figmaPlugin()]
});
```

`ng add @ng-prism/plugin-<name>` installs an official plugin and adds it to this list for you, see [Installing Plugins](plugins/overview.md#installing-plugins). The options of each plugin are on its own page. Services and pipes only get pages when a plugin shows them, such as `jsDocPlugin()`, see [Services & Pipes](guide/services-and-pipes.md).

## Pages

Pages of your own sit in a pinned _Pages_ section above the showcases. There are two kinds:

- **A page of data**, such as a changelog: list it in [`pages`](api/ng-prism-config.md#pages), see [Custom Pages via Config](guide/component-pages.md#custom-pages-via-config).
- **An Angular component of yours as a page**: register it in the `main.ts` of the styleguide app, not in the config, since the config's pages reach the app as JSON, see [Registering Pages](guide/component-pages.md#registering-pages).

[Component Pages](guide/component-pages.md) explains when a page is the right choice over a composition.

## Adding Global Providers

A showcased component that injects something the styleguide app does not provide, such as `HttpClient`, a router for `routerLink`, a mock backend or a configuration token of your library, needs a provider in the root injector of the styleguide app. Every rendered component sees what is there. There are two places for one:

- **The `providers` in the `main.ts` of the styleguide app**, next to `providePrism()`. This is the place for anything from your library or your own source files, and for `provideHttpClient()`, `provideRouter()` and other functions that return `EnvironmentProviders`.
- **[`appProviders`](api/ng-prism-config.md#appproviders) in the config**, for providers made only of installed packages. The builders load the config in Node.js as well, which knows neither your path mappings nor Angular's decorators, so the config cannot import your library or a service of your own. `appProviders` is a `Provider[]` and does not take `EnvironmentProviders`.

```typescript
// projects/my-lib-prism/src/main.ts
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { API_BASE_URL, ApiService } from 'my-lib';
import { MockApiService } from './mocks/mock-api.service';

bootstrapApplication(PrismShellComponent, {
    providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: ApiService, useClass: MockApiService },
        providePrism(PRISM_RUNTIME_MANIFEST, config)
    ]
});
```

Keep the rest of the `main.ts` that `ng add` wrote. For a provider that only one component may see, render that component through a [component page](guide/component-pages.md) and declare the provider there.

## Branding

Put your own name, logo and build in the header:

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

- [`title`](api/ng-prism-config.md#title) replaces the ng-prism wordmark. "Powered by ng-prism" stays at the foot of the sidebar.
- [`subtitle`](api/ng-prism-config.md#subtitle) is the smaller line under it.
- [`logo`](api/ng-prism-config.md#logo) replaces the ng-prism symbol. The header is a navy band in both themes, so `dark` is the one it shows whenever you set it.

On a phone the header drops the subtitle and shortens a long title, see [On a phone](guide/styleguide-ui.md#on-a-phone).

### Build Info

Show the deployed version and commit as a pill in the header with [`buildInfo`](api/ng-prism-config.md#buildinfo):

```typescript
export default defineConfig({
    buildInfo: {
        version: '1.2.3',
        gitHash: 'a1b2c3d4e5f6'
    }
});
```

The pill reads `v1.2.3 · a1b2c3d`. Either field works on its own.

## Theming

Colours, fonts and the density of the styleguide are CSS custom properties. Override them in [`theme`](api/ng-prism-config.md#theme) for both themes, or in [`darkTheme`](api/ng-prism-config.md#darktheme) and [`lightTheme`](api/ng-prism-config.md#lighttheme) for one. [Theming](guide/theming.md) shows how, and lists every token.

## Other Options

- [`urlState`](api/ng-prism-config.md#urlstate) and [`persistState`](api/ng-prism-config.md#persiststate) switch off what the styleguide keeps in the URL and across reloads, see [Links & State](guide/url-state.md).
- [`a11y`](api/ng-prism-config.md#a11y) points the build at a library-wide a11y report and sets its limits, see [A11y Reports](guide/a11y-reports.md).
- [`colorScheme`](api/ng-prism-config.md#colorscheme) switches a theme of your library that hangs on a class or an attribute along with the color scheme the canvas simulates, see [Simulate](guide/styleguide-ui.md#simulate).
- [`showcaseDefaults`](api/ng-prism-config.md#showcasedefaults) sets the canvas background of the variants that declare no `bg`, see [`bg`](api/showcase-config.md#bg).
- [`strictShowcase`](api/ng-prism-config.md#strictshowcase) fails the build when the scan has to drop a `@Showcase` value, see [Build Warnings](api/build-warnings.md).
- `themeStylesheet`, `ui`, `headless` and `appComponent` have no effect, see [Deprecated options](api/ng-prism-config.md#deprecated-options).
