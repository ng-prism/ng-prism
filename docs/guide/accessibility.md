# Accessibility Panel

The **A11y** tab of the addons panel audits the component on the canvas with [axe-core](https://github.com/dequelabs/axe-core) and shows how the component reads to assistive technology. It is part of the core, so no plugin is required. axe-core ships as a dependency of `@ng-prism/core` and is loaded lazily, with the first audit; a styleguide app set up by hand lists it in `allowedCommonJsDependencies`, since axe-core ships as UMD and would otherwise cause the CommonJS optimization-bailout warning, see [The styleguide app target](api/builders.md#the-styleguide-app-target).

The library-wide score in the header and the a11y markers in the sidebar come from a report you write, see [A11y Reports](guide/a11y-reports.md).

## Features

The audit covers the component the canvas renders, its own element and everything inside it. For a variant with a [`template` or a host template](guide/compositions.md) that is the whole composition: the audit, the ARIA tree, the screen reader list and the tab order include the frame and the other parts. A form control in its field is audited with the label the field gives it, so `Form elements must have labels` does not fire for an input the frame labels. An overlay the component opens in `<body>`, such as a CDK overlay, is outside it and is not audited.

The audit runs on the Playground while the addons panel is shown, whichever of its tabs is open, since the A11y tab carries the number of violations. It runs again about half a second after the variant, the component or an input value in the Controls panel changes. A state picked in the tools menu, a pseudo-class toggle and a theme switch do not start a new audit, so change an input to audit the component in that state.

The panel has four sub-tabs.

### Violations

The axe-core audit of the variant on the canvas:

- **Score** out of 100, in a card whose ring takes the colour of the score's grade against [`a11y.thresholds`](api/ng-prism-config.md#a11y): red with a critical or serious violation above its limit or a score below three quarters of the target, amber below the target or with too many moderate violations, green otherwise. The tooltip names the target and the counts.
- **Violations**, most severe first, each with the rule's help text, its description and the rule id:

    | Level    | Badge         | Meaning                              |
    | -------- | ------------- | ------------------------------------ |
    | Critical | red           | Must fix: blocks users entirely      |
    | Serious  | red, outlined | Should fix: significant barrier      |
    | Moderate | amber         | Consider fixing: some users affected |
    | Minor    | grey          | Nice to fix: minor inconvenience     |

- **Accepted**, the [accepted violations](#accepted-violations) with their reasons.
- **Needs review**, what axe answered with "incomplete" because it could not decide, for example a contrast over a background image or under another element, with axe's reason (since 22.7.0). They do not count towards the score, but they are not passes either.
- **Passed checks**, folded into one line you can open.

The A11y tab and the Violations sub-tab carry the number of open violations, red when one of them is critical or serious and amber otherwise. A clean component's tab carries no badge.

**What the audit sees.** It measures the component and nothing the canvas draws around it (since 22.7.0). For the duration of the audit, the panel overlays (the A11y panel's own outline, the box model, any plugin's), the measuring tool, the rulers and the canvas's dot or checker pattern are hidden, so an outline over the component cannot hide a contrast violation and the result does not depend on which panel is open. They may blink away for that moment. What the component renders itself stays visible. The theme is the one you look at.

### Keyboard Navigation

The tab stops of the component, in the order the Tab key reaches them: elements with a positive `tabindex` first, then the others in document order. Each row shows `Tab 1`, `Tab 2`, …, the element's accessible name (or its tag and type), its states, such as `disabled`, and the element. A component without a focusable element reads `No focusable elements found.`

### ARIA Tree

The component as an accessibility tree: each element with its role (`generic` where it has none), its accessible name in quotes and its states and properties in brackets, such as `[expanded=false]`. A node with children folds open and closed. An element with `aria-hidden="true"` or the `hidden` attribute is dimmed, and its children are left out; one hidden only by CSS is listed like any other.

### Screen Reader

What a screen reader announces, in reading order: one numbered line per element with a role it announces (button, link, text field, heading, list, image and the other common roles), with its accessible name and its states. Elements with `aria-hidden="true"` or the `hidden` attribute are left out.

## On the canvas

While the A11y tab is open, the canvas outlines the rendered component and labels it with the role of the showcased element (`role="button"`) and, when the component holds a focusable element, its first tab stop (`Tab 1`). In a composition the outline goes around the whole composition, and the role is the one of the showcased element. The outline is gone while the [measuring tool](guide/measuring.md) is on and in capture mode.

## Per-component config

[`meta.a11y`](api/showcase-config.md#meta) on `@Showcase` configures the audit of one component. `rules` switches axe rules on or off:

```typescript
@Showcase({
    title: 'Dialog',
    meta: {
        a11y: {
            rules: {
                'color-contrast': { enabled: false }, // disable a rule
                'aria-required-attr': { enabled: true }
            }
        }
    }
})
```

`disable: true` skips the audit for the component. The A11y tab then shows `Accessibility audit disabled for this component.` instead of the sub-tabs:

```typescript
@Showcase({
    title: 'Decorative Icon',
    meta: {
        a11y: { disable: true }
    }
})
```

## Accepted violations

A violation that is known, deliberate and owned can be accepted (since 22.7.0). It is still audited and shown, under _Accepted_ with its reason, but it does not count towards the score, the gauge in the component head or the badges:

```typescript
@Showcase({
    title: 'Select',
    meta: {
        a11y: {
            // applies to every variant
            accept: [{ rule: 'aria-required-children', reason: 'The options render in a CDK overlay outside the host.' }]
        }
    },
    variants: [
        {
            name: 'Default',
            meta: {
                a11y: {
                    // this variant only, in addition to the component's
                    accept: [{ rule: 'color-contrast', reason: 'The placeholder is Concrete as in Figma, 3.35:1; design keeps it.' }]
                }
            }
        }
    ]
})
```

- `rule` is the axe rule id. An acceptance covers every node that rule reports in the variant.
- `reason` is required: an acceptance without one cannot be told apart from an oversight. An entry without a rule or a reason is ignored, with a warning in the browser console.
- A variant gets the component's acceptances and its own.

Accepting is not switching a rule off. `rules: { 'color-contrast': { enabled: false } }` means the rule is not audited at all; `accept` means it is audited and visible, but not counted. A report producer applies the same rule when it writes the library-wide report, see [A11y Reports](guide/a11y-reports.md#writing-a-report).

## Related

- [Tour of the UI](guide/styleguide-ui.md#playground-overview-and-api): the addons panel and the metrics in the component head
- [`meta`](api/showcase-config.md#meta) in the ShowcaseConfig reference, and [`a11y`](api/ng-prism-config.md#a11y) in the NgPrismConfig reference
- [A11y Reports](guide/a11y-reports.md): the library-wide score, its header pill and the markers in the sidebar
- [Audits in CI](guide/ci.md#accessibility): auditing every variant in CI
