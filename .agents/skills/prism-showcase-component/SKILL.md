---
name: prism-showcase-component
description: Annotates an Angular component with the @Showcase decorator for ng-prism discovery. Triggers on "add showcase", "showcase this", "make showcaseable", "annotate component".
---

# @Showcase Decorator — Annotation Guide

Add `@Showcase` to Angular components to make them discoverable by ng-prism.

## Basic Usage

```typescript
import { Showcase } from '@ng-prism/core';

@Showcase({
  title: 'Button',
  category: 'Inputs',
})
@Component({ ... })
export class ButtonComponent { }
```

## Full Configuration

```typescript
@Showcase({
  // Required
  title: 'Button',

  // Optional — grouping in sidebar
  category: 'Inputs',

  // Optional — Markdown supported
  description: 'A versatile button component with multiple variants.',

  // Optional — search/filter tags
  tags: ['form', 'action', 'interactive'],

  // Optional — predefined demo tabs
  variants: [
    {
      name: 'Primary',
      inputs: { variant: 'primary', label: 'Click me' },
      description: 'Default primary button',
    },
    {
      name: 'Danger',
      inputs: { variant: 'danger', label: 'Delete', disabled: false },
    },
  ],

  // Optional — named pseudo states, combined with every variant they fit
  states: [{ name: 'Hover', pseudo: { hover: '.btn' } }],
})
```

## ShowcaseConfig Interface

Source of truth: `packages/ng-prism/src/decorator/showcase.types.ts`. The
interface is generic over the component type, which is what makes `inputs`
type-checked against the component's own signals.

```typescript
interface ShowcaseConfig<T = unknown> {
    title: string; // Required. Display name in the UI
    description?: string; // Markdown supported
    category?: string; // Sidebar grouping
    categoryOrder?: number; // Category position (lower = higher)
    componentOrder?: number; // Position within the category
    section?: string; // Top-level sidebar section. Auto-detected:
    // @Directive -> 'Directives', service -> 'Services',
    // pipe -> 'Pipes', else 'Components'. Any free-form string creates a new section.
    sectionOrder?: number; // Section position. Defaults: Components 0,
    // Directives 10, Services 20, Pipes 30, everything else 100
    variants?: Variant<T>[]; // Predefined demo tabs
    states?: ShowcaseState[]; // Named pseudo states, combined with every
    // variant. Order = index. Not with renderPage
    tags?: string[]; // Search/filter tags
    providers?: Provider[]; // @deprecated since 22.4.0, dropped by the build
    meta?: Record<string, unknown>; // Arbitrary plugin metadata
    setup?: () => readonly ShowcaseSetupRef[]; // Services and pipes only (since 22.7.0):
    // provide* functions and InjectionTokens, read statically, never called
    bg?: CanvasBg; // Recommended canvas background
    canvasLayout?: CanvasLayout; // Canvas layout for this component
    host?: string | DirectiveHost | HostTemplate; // Host element for directives, or
    // { template } (since 22.7.0): markup the component or directive renders in
    imports?: ShowcaseImport[]; // { name, from } of classes the templates use that the
    // library does not export (since 22.7.0)
    partOf?: string; // Selector of the showcased parent (since 22.7.0): no page of its
    // own, shown on the parent's page
    renderPage?: string; // Render a styleguide page instead
    status?: ComponentStatus; // 'stable' | 'beta' | 'wip' | 'deprecated'
}

interface ShowcaseState {
    name: string; // Overview column title, tools menu chip. Unique
    pseudo: ForcedPseudoStates; // Same shape as Variant.pseudo
}

interface HostTemplate {
    template: string; // The element the selector matches is the subject; prism-subject marks one of several
}

interface ShowcaseImport {
    name: string; // Exported class name, an identifier: 'CdkTextareaAutosize'
    from: string; // Module specifier: '@angular/cdk/text-field'
}

interface Variant<T = unknown> {
    name: string; // Tab label
    inputs?: Partial<InputsOf<T>>; // input() signal values, type-checked
    content?: string | Record<string, string>; // Projected content (ng-content)
    template?: string; // Compiled Angular template as the content (since 22.7.0)
    host?: HostTemplate; // Overrides ShowcaseConfig.host for this variant (since 22.7.0)
    description?: string; // Variant description
    meta?: Record<string, unknown>; // Arbitrary plugin metadata
    bg?: CanvasBg; // Overrides the component's bg
    canvasLayout?: CanvasLayout; // Overrides the component's layout
    pseudo?: ForcedPseudoStates; // Forced states, e.g. { hover: true }
    states?: false; // Keeps the variant out of every component state
}
```

## Rules

- `@Showcase` must come before `@Component` in decorator order
- `title` is the only required field
- `providers` is deprecated (22.4.0, removed in 23.0.0) and never reaches the
  styleguide: the build drops it with a warning. Put providers in
  `defineConfig({ appProviders })`, or for one component in a component page
  (`renderPage`)
- `variants.inputs` keys must match the component's `input()` member names
- A string or object `host` is for a directive. On a component it has no effect: the build drops it with a warning.
  To show a component inside other markup, or with the parts it works with, write a composition: `template` on a
  variant, or `host: { template }` on a variant or the showcase, with `prism-subject` on the subject where several
  elements match, and `imports` for what the library does not export
- A hover, pressed or focus condition that applies to several variants is a `states` entry, not a variant per
  variant. A picture that belongs to one variant (its own inputs plus a forced state) stays `Variant.pseudo`, which
  is not deprecated and has no fit rule. A state is forced only where its targets are reachable: when they are not,
  the combination does not fit and says why (`<target> matches nothing`, `is disabled`, `is inert` or
  `has pointer-events: none`). A state's position in the list is its index in the URL, the render marker, the
  manifest and the VRT report, so append new states at the end
- A component or directive that only works inside one parent (an option in a select) is a part:
  `partOf: '<parent selector>'`, a string and never the class, which would import the parent back. It gets no page
  and needs no variants: `title`, `description`, `tags`, `status` and its inputs and outputs show on the parent's
  page, and `variants`, `states`, `category`, `bg` and the other page fields are dropped with a notice. A directive
  part keeps a string or object `host` (markup such as `'<span>12</span>'`) for its usage line. The parent's
  variants show the part. Demo in test-lib: `lib-list` with `lib-list-item`, `lib-list-group` and
  `[libListItemMeta]`. Details: `docs/guide/parts.md`
- The component must be exported from the library's entry file to be discovered.
  Which file that is comes from the builder's `entryPoint` option — commonly
  `public-api.ts` or `index.ts`, not a fixed name.

## Scanner Compatibility

The scanner evaluates the config statically via the TypeScript Compiler API:

- Literals, `const` declarations (also imported from other files), enum members,
  arithmetic on them and spreads of such constants are resolved
- `new Date(…)` with such arguments is resolved too, and the manifest repeats the
  arguments; for a day use the local form `new Date(2026, 3, 28)`, since
  `new Date('2026-04-28')` is UTC midnight. `new Date()` without arguments is dropped
- Function calls and `let` references cannot be evaluated: the value is dropped
  and the build prints a warning naming the reference and its location.
  `defineConfig({ strictShowcase: true })` turns those warnings into a build error

```typescript
// Resolved — constants and enum members
const MB = 1024 * 1024;
@Showcase({
  title: 'Upload',
  variants: [{ name: 'Large', inputs: { maxFileSize: 5 * MB, size: Size.Medium } }],
})

// Dropped with a warning — a function call
@Showcase({
  title: 'Upload',
  variants: [{ name: 'Large', inputs: { maxFileSize: megabytes(5) } }],
})
```

## Checklist

- [ ] `title` is set
- [ ] `category` groups the component logically
- [ ] `variants` cover the main use cases
- [ ] A class that only works inside one parent declares `partOf` instead of variants of its own, and the parent's variants show it
- [ ] `variants.inputs` keys match the actual `input()` member names
- [ ] States shared by several variants are in `states`, with unique names and a stable order; `pseudo` stays on a variant only for a one-off picture
- [ ] Config values are statically evaluable (literals, `const`, enum members; no function calls, no `let`)
- [ ] Component is exported from the library's entry file (`entryPoint`)
