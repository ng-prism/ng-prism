# Plugin UI Kit

The components, functions and constants of `@ng-prism/core` that a plugin builds its panels, header widgets and controls from, so that they look and behave like the built-in ones in both themes. [Panel Design](plugins/panel-design.md) describes how to lay out a panel with them, and [NgPrismPlugin](api/ng-prism-plugin.md) where they plug in.

The components are exported from `@ng-prism/core` only. They are `@Component` classes, and `@ng-prism/core/plugin` leaves them out so that it stays loadable in Node.js, where the builder evaluates a plugin's Node entry. The functions and constants are exported from `@ng-prism/core/plugin` and from `@ng-prism/core`, except `toneForStatus`, which comes from `@ng-prism/core` only.

## Metric badge

`PrismMetricBadgeComponent`, selector `prism-metric-badge`. A figure with an icon or a short label, the badge every built-in header widget renders: a11y, coverage and visual regression share one appearance through it.

```typescript
import { PrismMetricBadgeComponent } from '@ng-prism/core';
```

| Input        | Type                         | Default    | Description                                                                                                                                                                        |
| ------------ | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon`       | `string`                     | (required) | A name from [`ICON_NAMES`](#icons), shown when `shortLabel` is not set. Use the icon of the source's navigation decoration and panel tab, so one glyph means one source everywhere |
| `value`      | `string`                     | (required) | The formatted figure, such as `'87%'`. The badge does no formatting of its own                                                                                                     |
| `label`      | `string`                     | (required) | The name of the figure, such as `'Library coverage'`. The accessible name is `"<label>: <value>"`, so the figure cannot get lost                                                   |
| `title`      | `string`                     | `''`       | The tooltip; `label` when empty                                                                                                                                                    |
| `variant`    | `'ok' \| 'warn' \| 'danger'` | `'ok'`     | The colour, see below. Grade the figure with [`statusFor()`](#status-grading), so the header agrees with every other place that shows it                                           |
| `shortLabel` | `string \| null`             | `null`     | A short visible label such as `'Coverage'` or `'VRT'`. When set, it replaces the icon and the badge reads "Coverage 53%". The built-in widgets all set one                         |

| `variant` | Text colour       | Background           |
| --------- | ----------------- | -------------------- |
| `ok`      | `--prism-success` | `--prism-success-bg` |
| `warn`    | `--prism-warn`    | `--prism-warn-bg`    |
| `danger`  | `--prism-danger`  | `--prism-danger-bg`  |

The badge is `role="img"` with the computed `aria-label`; the icon and the short label are `aria-hidden`. In the header it gets the dark token set in both themes, so it needs no colours of its own there.

A header widget modelled on the one of the coverage plugin, registered through [`headerWidgets`](api/ng-prism-plugin.md#headerwidgetdefinition):

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrismMetricBadgeComponent } from '@ng-prism/core';
import { PRISM_MANIFEST, type RuntimeManifest, statusFor, thresholdFromTarget } from '@ng-prism/core/plugin';

@Component({
    selector: 'my-coverage-header-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismMetricBadgeComponent],
    template: `
        @if (data(); as d) {
            <prism-metric-badge icon="shield-check" label="Library coverage" shortLabel="Coverage" [value]="d.score + '%'" [variant]="d.variant" />
        }
    `
})
export class CoverageHeaderBadgeComponent {
    private readonly manifest = inject<RuntimeManifest>(PRISM_MANIFEST);

    protected readonly data = computed(() => {
        const total = (this.manifest.meta?.['coverage'] as { total?: { found: boolean; score: number } } | undefined)?.total;

        return total?.found ? { score: total.score, variant: statusFor(total.score, thresholdFromTarget(80)) } : null;
    });
}
```

## Icons

`PrismIconComponent`, selector `prism-icon`. One glyph of the icon registry as an inline `<svg>`, drawn in `currentColor`. It is the registry that `PanelDefinition.icon`, `NavigationDecorationDefinition.icon` and the metric badge's `icon` resolve against.

```typescript
import { PrismIconComponent } from '@ng-prism/core';
```

| Input  | Type     | Default    | Description                                                                                                                                                   |
| ------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` | `string` | (required) | A name from `ICON_NAMES`. An unknown name renders an empty glyph of the right size, and the console warns once per name: `[ng-prism] Unknown icon "<name>" …` |
| `size` | `number` | `16`       | Width and height in pixels                                                                                                                                    |

```html
<prism-icon name="camera" [size]="14" />
```

`ICON_NAMES` (`readonly string[]`) lists the valid names. It comes from a module without dependencies, so a plugin's Node entry can import it from `@ng-prism/core/plugin` to check or name an icon without loading Angular components. The names:

`search`, `refresh-cw`, `bell`, `sun`, `moon`, `more-horizontal`, `more-vertical`, `chevron-down`, `chevron-right`, `pin`, `box`, `sliders-horizontal`, `zap`, `accessibility`, `file-text`, `figma`, `box-select`, `activity`, `shield-check`, `camera`, `move`, `crosshair`, `ruler-dimension`, `ruler`, `copy`, `maximize-2`, `eye`, `code`, `x`, `menu`, `check`, `info`, `circle-dashed`, `plug`, `pipette`.

## UI primitives

The shared components the styleguide chrome is built from (since 22.7.0). A plugin panel built from them looks like a built-in one in both themes and keeps the contrast the defaults are tested for.

```typescript
import { PrismBadgeComponent, PrismButtonComponent, PrismMetricCardComponent, PrismPanelToolbarComponent, PrismTabsComponent } from '@ng-prism/core';
```

| Component                                                   | Selector                  | Use it for                                                                             |
| ----------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| [`PrismBadgeComponent`](#prismbadgecomponent)               | `prism-badge`             | Statuses, severities and counts inside content. Words in sentence case, never capitals |
| [`PrismTabsComponent`](#prismtabscomponent)                 | `prism-tabs`              | Sub-tabs in a panel toolbar (`size="sm"`)                                              |
| [`PrismSegmentedComponent`](#prismsegmentedcomponent)       | `prism-segmented`         | Choosing one of a few values: zoom, fit, mode                                          |
| [`PrismPanelToolbarComponent`](#prismpaneltoolbarcomponent) | `prism-panel-toolbar`     | The toolbar of a panel, only when it has sub-tabs or actions                           |
| [`PrismListRowComponent`](#prismlistrowcomponent)           | `prism-list-row`          | Findings and results in a list                                                         |
| [`PrismIconButtonComponent`](#prismiconbuttoncomponent)     | `button[prismIconButton]` | Icon-only actions and toggles                                                          |
| [`PrismButtonComponent`](#prismbuttoncomponent)             | `button[prismButton]`     | Text actions in a toolbar, secondary before primary                                    |
| [`PrismMetricCardComponent`](#prismmetriccardcomponent)     | `prism-metric-card`       | A measured value with an optional bar and threshold tick                               |

### `PrismBadgeComponent`

A badge in the sans face, with the value in the mono face and tabular figures. It also projects its content.

| Input     | Type                  | Default     | Description                                                                                               |
| --------- | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `tone`    | [`BadgeTone`](#types) | `'neutral'` | The colour role: `--prism-<tone>` on `--prism-<tone>-bg`; `neutral` is muted text on the input background |
| `variant` | `'soft' \| 'outline'` | `'soft'`    | `soft` fills with the tone's `-bg` tint, `outline` draws a contour instead                                |
| `size`    | `'sm' \| 'md'`        | `'md'`      | 16 px or 20 px high                                                                                       |
| `dot`     | `boolean`             | `false`     | A leading dot in the tone's colour. A boolean attribute: `<prism-badge dot>`                              |
| `label`   | `string \| null`      | `null`      | The words, in the sans face                                                                               |
| `value`   | `string \| null`      | `null`      | The figure, in the mono face                                                                              |

### `PrismTabsComponent`

A tab bar with full tab semantics: arrow keys, Home and End move between the tabs and select them.

| Input / output  | Type                      | Default    | Description                                                                                                   |
| --------------- | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `items`         | `readonly PrismTabItem[]` | (required) | The tabs, see [`PrismTabItem`](#types)                                                                        |
| `[(active)]`    | `string \| null`          | `null`     | The id of the active tab, a two-way binding. `activeChange` stays silent when the active tab is clicked again |
| `size`          | `'md' \| 'sm'`            | `'md'`     | `sm` for sub-tabs inside a panel                                                                              |
| `ariaLabel`     | `string \| null`          | `null`     | The accessible name of the tab list                                                                           |
| `panelIdPrefix` | `string \| null`          | `null`     | When set, each tab points at the element `<prefix><id>` through `aria-controls`                               |
| `(tabClick)`    | `string`                  |            | Every click on a tab, the active one included, before `active` changes (since 22.7.0)                         |

### `PrismSegmentedComponent`

A radio group of a few values, with arrow-key navigation.

| Input / output | Type                            | Default    | Description                                    |
| -------------- | ------------------------------- | ---------- | ---------------------------------------------- |
| `options`      | `readonly PrismSegmentOption[]` | (required) | The values, see [`PrismSegmentOption`](#types) |
| `[(value)]`    | `string \| null`                | `null`     | The chosen value, a two-way binding            |
| `ariaLabel`    | `string \| null`                | `null`     | The accessible name of the group               |
| `size`         | `'md' \| 'sm'`                  | `'md'`     |                                                |

### `PrismPanelToolbarComponent`

The 36 px toolbar of a panel: sub-tabs on the left, actions on the right. No inputs; it projects the slots `[toolbarStart]` and `[toolbarEnd]`. It holds no meta text: counts, timestamps, thresholds and sizes go in tooltips. Render it only when the panel has sub-tabs or actions.

### `PrismListRowComponent`

A row of a list: badge, title and description, meta on the right. It projects the slots `[rowBadge]`, `[rowTitle]`, `[rowDescription]` and `[rowMeta]`. Selection is a tinted surface, never a coloured edge.

| Input         | Type      | Default | Description                                                                                                                                                                            |
| ------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selected`    | `boolean` | `false` | Draws the row as selected. A boolean attribute                                                                                                                                         |
| `interactive` | `boolean` | `false` | Makes the row a button for assistive technology (`role="button"`, `aria-pressed` from `selected`), focusable, and activated by Enter and Space, which reach the host's click listeners |

### `PrismIconButtonComponent`

The ghost icon button of the chrome, on a `<button>`. Give it an `aria-label`.

| Input     | Type                   | Default | Description                                                                                                |
| --------- | ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `size`    | `'md' \| 'sm' \| 'xs'` | `'md'`  | 32 px, 28 px or 26 px. On a touch screen at least 40 × 40 px, whatever the size (since 22.7.0)             |
| `pressed` | `boolean \| null`      | `null`  | `null` for a plain button; a boolean makes it a toggle with `aria-pressed` and the active tint when `true` |

### `PrismButtonComponent`

A text button for toolbar actions, on a `<button>`.

| Input     | Type                                  | Default       | Description                                                                         |
| --------- | ------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `variant` | `'secondary' \| 'primary' \| 'ghost'` | `'secondary'` | `primary` fills with the brand colour, `secondary` draws a contour, `ghost` neither |
| `size`    | `'sm' \| 'md'`                        | `'sm'`        | 26 px or 30 px high                                                                 |

### `PrismMetricCardComponent`

A measured value in a panel: label, status badge, the figure with its unit, and an optional bar with a threshold tick, or a visual of your own in the slot `[metricVisual]`, such as a ring or a sparkline. It has no subtitle: details such as the threshold or the source go in `title`.

| Input         | Type                | Default    | Description                                                                                           |
| ------------- | ------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `label`       | `string`            | (required) | The name of the value                                                                                 |
| `value`       | `string`            | (required) | The formatted figure                                                                                  |
| `unit`        | `string \| null`    | `null`     | Shown small after the figure                                                                          |
| `tone`        | `BadgeTone \| null` | `null`     | The status. A rated value fills its bar in the tone, a plain quantity (no tone) in the primary colour |
| `statusLabel` | `string \| null`    | `null`     | The text of the status badge, shown when `tone` is set too                                            |
| `fraction`    | `number \| null`    | `null`     | The fill of the bar, 0–1. No bar without it                                                           |
| `threshold`   | `number \| null`    | `null`     | The position of the threshold tick on the bar, 0–1                                                    |
| `title`       | `string \| null`    | `null`     | The tooltip of the card                                                                               |

### Types

Exported from `@ng-prism/core` as types.

```typescript
/** Colour roles of `prism-badge`, also the tone of a tab badge. */
type BadgeTone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger';

interface PrismTabItem {
    id: string;
    label: string;
    icon?: string; // a name from ICON_NAMES
    badge?: PrismTabBadge | null;
    title?: string; // tooltip
}

interface PrismTabBadge {
    kind: 'count' | 'issues'; // count: a plain quantity, muted; issues: open findings, a pill in `tone`
    text: string;
    tone?: BadgeTone; // default 'danger'
    label: string; // read after the tab's label by assistive technology, e.g. "A11y, 1 violation"
}

interface PrismSegmentOption<T extends string = string> {
    value: T;
    label: string;
    title?: string; // tooltip
}
```

`PrismTabBadge` mirrors a panel's [`PanelBadge`](api/ng-prism-plugin.md#panelbadge) with the same field names. `PrismSegmentedComponent` is generic in the same `T`, so `value` has the type of the options' values.

## Status grading

One rule for every key figure the styleguide grades (since 22.7.0): the a11y score, coverage, the share of the visual regression report and the perf budgets. A plugin that grades with it agrees with the header, the sidebar and the built-in panels. The functions are framework-free, so the same call works in a build-time hook in Node.js and in a panel in the browser. The types `StatusTone` and `StatusThreshold` are described in [Types](api/types.md#statustone).

```typescript
import { STATUS_DANGER_RATIO, statusFor, thresholdFromTarget, worstTone } from '@ng-prism/core/plugin';
import { toneForStatus } from '@ng-prism/core';

function statusFor(value: number, threshold: StatusThreshold): StatusTone;
function thresholdFromTarget(target: number): StatusThreshold;
function worstTone(tones: Iterable<StatusTone>): StatusTone;
function toneForStatus(status: StatusTone): BadgeTone;
const STATUS_DANGER_RATIO = 0.75;
```

| Export                | Description                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statusFor`           | Grades a value. With `direction: 'higher'`, the default, it is `ok` from `ok` up, `warn` from `warn` up and `danger` below. With `'lower'`, for budgets such as a size, it is `ok` up to `ok`, `warn` up to `warn` and `danger` above |
| `thresholdFromTarget` | A threshold from one target, the shape of every built-in threshold option: `ok` at the target, `warn` down to `STATUS_DANGER_RATIO` of it. `thresholdFromTarget(80)` is `{ ok: 80, warn: 60 }`                                        |
| `worstTone`           | The most severe of several verdicts, `ok` when there are none. The tab of a panel that grades several figures takes this one                                                                                                          |
| `toneForStatus`       | The [badge tone](#types) of a verdict: `ok` → `success`, `warn` → `warn`, `danger` → `danger`. For a `prism-badge` or a metric card                                                                                                   |
| `STATUS_DANGER_RATIO` | `0.75`: how far below its target a value may fall before it is `danger`                                                                                                                                                               |

```typescript
statusFor(72, thresholdFromTarget(80)); // 'warn' (60 ≤ 72 < 80)
statusFor(12.4, { ok: 10, warn: 12.5, direction: 'lower' }); // 'warn'
worstTone(['ok', 'danger', 'warn']); // 'danger'
```

A verdict goes into the [metric badge](#metric-badge)'s `variant` as it is; a [`prism-badge`](#prismbadgecomponent) or a [metric card](#prismmetriccardcomponent) takes it through `toneForStatus()`.

## Constants and helpers

Exported from `@ng-prism/core/plugin` and `@ng-prism/core`.

### Compositions

> **Experimental until 23.0.0: they may change in a 22.x minor release**, like [`ComponentComposition`](api/types.md#componentcomposition).

Four constants (since 22.7.0) name what ng-prism puts into a [composition](guide/compositions.md) and takes out of it. A plugin that shows the markup of a variant, such as a snippet or a usage example, replaces `COMPOSITION_SUBJECT_SLOT` in each [`CompositionCase.template`](api/types.md#compositioncase) with the attributes of its choice.

| Constant                   | Value                  | Meaning                                                                                                                                                                                    |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `COMPOSITION_SUBJECT_SLOT` | `'\uE000'`             | Where the subject element takes its attributes and bindings in `CompositionCase.template`: the end of its start tag. A private-use character, so it cannot occur in markup an author wrote |
| `COMPOSITION_SUBJECT_ATTR` | `'data-prism-subject'` | Attribute the generated wrapper puts on the subject element, which is how the styleguide finds it, see `PrismRendererService.subjectElement`                                               |
| `SUBJECT_MARKER_ATTR`      | `'prism-subject'`      | Attribute an author puts on the one of several elements matching the subject's selector that is the subject. Removed from the generated template and from snippets                         |
| `PRISM_VARIANT_INPUT`      | `'__prismVariant__'`   | The input of the generated wrapper that takes the index of the variant, which the wrapper maps onto its case                                                                               |

### `partKeys`

```typescript
function partKeys(classNames: readonly string[]): string[];
```

The key of each part of a component (since 22.7.0, experimental until 23.0.0), from the class names of its `parts`, in their order. A part's key is its class name; two parts from different files can share one, and the second and later of them get `~2`, `~3`, …, which no class name contains. The `part` [URL parameter](guide/url-state.md#parts) and the `activePart` input of a [panel that lists parts](api/ng-prism-plugin.md#panels-that-list-parts) carry the key.

```typescript
const keys = partKeys((activeComponent()?.parts ?? []).map((part) => part.meta.className));
```

### Backgrounds

| Export               | Type                                                          | Description                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANVAS_BGS`         | `readonly CanvasBg[]`                                         | Every [`CanvasBg`](api/types.md#canvasbg) value, the deprecated `checker` included, in the order of the canvas tools menu: `dots`, `plain`, `light`, `dark`, `checker`, `transparent`                                                                                                        |
| `DEFAULT_VARIANT_BG` | `CanvasBg`                                                    | `'transparent'`: the background a variant without a declared `bg` reports and is captured on                                                                                                                                                                                                 |
| `resolveVariantBg`   | `(config: VariantBgSource, variantIndex: number) => CanvasBg` | The background a variant renders on in the Overview, in capture mode and in `__PRISM_MANIFEST__`: the variant's `bg`, else the component's, else `DEFAULT_VARIANT_BG`. `VariantBgSource` is `{ bg?: CanvasBg; variants?: readonly { bg?: CanvasBg }[] }`, which a `ShowcaseConfig` satisfies |

Which background applies where, and which to declare under visual regression, is described under [`bg`](api/showcase-config.md#bg).

### Pseudo states

`PSEUDO_STATES` (`readonly PseudoState[]`) lists every [`PseudoState`](api/types.md#pseudostate), in the order of the canvas tools menu: `hover`, `active`, `focus`, `focus-visible`, `focus-within`.
