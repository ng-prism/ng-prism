# @ng-prism/plugin-perf

Performance profiling plugin for [@ng-prism/core](https://github.com/ng-prism/ng-prism). Measures the shipped size of a component at build time and tracks its render and re-render timing via the Performance API.

> **Full documentation:** [ng-prism Docs: Perf Plugin](https://ng-prism.github.io/ng-prism/#/plugins/perf)

## Installation

```bash
npm install @ng-prism/plugin-perf
```

### Peer Dependencies

| Package          | Version               |
| ---------------- | --------------------- |
| `@ng-prism/core` | `^<plugin version>-0` |
| `@angular/core`  | `>=20.0.0`            |
| `typescript`     | `>=5.0.0`             |

Each release requires the `@ng-prism/core` of its own version (`^22.7.0-0` for 22.7.0), so keep the core and the plugin on the same version.

## Setup

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';
import { perfPlugin } from '@ng-prism/plugin-perf';

export default defineConfig({
    plugins: [perfPlugin()]
});
```

## What It Does

- Adds a **Performance** view tab to the styleguide
- Measures the component file the way it ships, at build time: source size and gzip estimate without `@Showcase` (which `ng-prism-strip` removes from the published build) and without comments, plus the files behind `templateUrl` and `styleUrl(s)`, the whole file for comparison, the imports and the import tree depth
- Profiles component lifecycle:
    - Initial render time (`prism:render`)
    - Re-render time on input changes (`prism:rerender`)
- Uses the browser's native Performance API (`performance.mark` / `performance.measure`)
- Displays timing metrics per variant
- Memory usage tracking

## How It Works

At build time, the plugin's `onComponentScanned` hook strips `@Showcase` from the component file with `@ng-prism/core/transformer`, prints it without comments and records the bundle metrics on the component. At runtime, it hooks into ng-prism's renderer lifecycle via `PrismRendererHooks` (`onBeforeCreate`, `onAfterCreate`, `onAfterDestroy`). Performance marks are placed around component creation and input updates. The panel component reads `performance.getEntriesByName()` to display the results.

## License

MIT
