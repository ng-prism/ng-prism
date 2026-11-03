# Panel Design

How a plugin panel looks like a part of the styleguide in both themes. The components it is built from, with their inputs, are in the [Plugin UI Kit](api/plugin-ui.md); how a plugin declares a panel is under [Add a panel](plugins/writing-plugins.md#add-a-panel).

## Principles

Every built-in panel follows the same eight rules (since 22.7.0). A plugin panel that follows them too looks like a part of the styleguide in both themes, and the [UI primitives](api/plugin-ui.md#ui-primitives) from `@ng-prism/core` do most of the work:

- **P1 Toolbar only when there is something to put in it.** [`prism-panel-toolbar`](api/plugin-ui.md#prismpaneltoolbarcomponent) is 36 px high, sub-tabs go in `[toolbarStart]`, actions in `[toolbarEnd]`. A panel without sub-tabs or actions has no toolbar. No meta text in it: timestamps, thresholds, sizes and counts go into tooltips.
- **P2 Sub-tabs** are [`prism-tabs`](api/plugin-ui.md#prismtabscomponent) with `size="sm"`.
- **P3 Measured values** are [`prism-metric-card`](api/plugin-ui.md#prismmetriccardcomponent): label, status badge, value with unit and optionally a bar with a threshold tick. No visible subtitle; details such as bytes, the threshold or branch counts are the card's `title`.
- **P4 Colour carries a verdict.** A graded value takes its status colour ([`statusFor`](api/plugin-ui.md#status-grading) from `@ng-prism/core/plugin`, then `toneForStatus`), a plain quantity stays in `--prism-primary`. The brand gradient is for the brand, not for data bars or rings.
- **P5 Lists** are [`prism-list-row`](api/plugin-ui.md#prismlistrowcomponent): badge, title, description and meta on the right. A selected row is tinted (`selected`), without a coloured left border.
- **P6 Content** has 16 × 18 px of padding on a 12 px grid and follows the height the panel is dragged to. Charts and images fit instead of being cut off.
- **P7 Surface:** the panel's background is `--prism-bg-surface`, embeds included.
- **P8 Actions** sit on the right of the toolbar as [`button[prismButton]`](api/plugin-ui.md#prismbuttoncomponent) (`sm`, 26 px), secondary before primary.

Colours come from the `--prism-*` tokens, never from fixed values, so the panel follows the theme and its overrides, see [Theming](guide/theming.md).

## Container queries

On a phone a panel spans the screen below the canvas, about 390 px wide. Lay it out against its own width with container queries (`container-type: inline-size` on the panel's root), not against the viewport with media queries: the built-in Controls panel stacks its rows below 520 px that way, and the same panel then also fits a narrow desktop window. The phone layout of the styleguide is described under [On a phone](guide/styleguide-ui.md#on-a-phone).

## A worked budget

A panel that grades the bundle size of a component against a budget of 10 kb, built from the primitives: the toolbar carries sub-tabs and two actions (P1, P2, P8), the size is a metric card graded with `statusFor` (P3, P4), and the content sits on the surface with the standard padding (P6, P7). The size comes from `meta.sizeKb`, which a build-time hook would write.

```typescript
// budget-panel.component.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PrismButtonComponent, PrismMetricCardComponent, PrismPanelToolbarComponent, type PrismTabItem, PrismTabsComponent, toneForStatus } from '@ng-prism/core';
import { type RuntimeComponent, statusFor } from '@ng-prism/core/plugin';

@Component({
    selector: 'my-budget-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismPanelToolbarComponent, PrismTabsComponent, PrismButtonComponent, PrismMetricCardComponent],
    template: `
        <prism-panel-toolbar>
            <prism-tabs toolbarStart size="sm" ariaLabel="Budget" [items]="tabs" [(active)]="tab" />
            <span toolbarEnd>
                <button prismButton type="button">Export</button>
                <button prismButton variant="primary" type="button">Measure</button>
            </span>
        </prism-panel-toolbar>
        <div class="budget">
            <prism-metric-card
                label="Size"
                unit="kb"
                [value]="size().toFixed(1)"
                [tone]="tone()"
                [statusLabel]="tone() === 'success' ? 'OK' : 'Over'"
                [fraction]="size() / 20"
                [threshold]="0.5"
                [title]="'Budget: 10 kb'" />
        </div>
    `,
    styles: `
        :host {
            display: block;
            background: var(--prism-bg-surface);
        }
        .budget {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
            padding: 16px 18px;
        }
    `
})
export class BudgetPanelComponent {
    readonly activeComponent = input<RuntimeComponent | null>(null);

    protected readonly tabs: PrismTabItem[] = [
        { id: 'size', label: 'Size' },
        { id: 'history', label: 'History' }
    ];
    protected readonly tab = signal<string | null>('size');

    protected readonly size = computed(() => (this.activeComponent()?.meta.showcaseConfig.meta?.['sizeKb'] as number | undefined) ?? 0);
    protected readonly tone = computed(() => toneForStatus(statusFor(this.size(), { ok: 10, warn: 12.5, direction: 'lower' })));
}
```

The bar spans 0 to 20 kb, so the threshold tick at `0.5` marks the budget. `statusFor` with `direction: 'lower'` grades the size `ok` up to 10 kb, `warn` up to 12.5 kb and `danger` above, and `toneForStatus` turns the verdict into the card's tone.

## Related

- [Plugin UI Kit](api/plugin-ui.md): the components, the status grading and their inputs
- [Writing a Plugin](plugins/writing-plugins.md#add-a-panel): declaring a panel and reading the active component
- [NgPrismPlugin](api/ng-prism-plugin.md#paneldefinition): every field of a panel definition
- [Theming](guide/theming.md): the `--prism-*` tokens
