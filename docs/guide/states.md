# States & Pseudo States

Hover, pressed and focus cannot be set through an input, and focusing an element by script does not hold either: only one element in the document can have focus, and the first click into the styleguide takes it away. ng-prism forces these pseudo states for you, in two ways. A component's **states** are declared once and combined with every variant they fit. A variant's own **`pseudo`** forces states for that one variant.

## States

Hover, pressed and focus are conditions a component is in, not different components. Written as variants they multiply: `Hovered`, `Pressed` and `Focus visible` for the filled button, and the same three again for the outlined one. They also sit in the variant ribbon, so whoever plays with the controls there looks at a button that stays hovered whatever they change.

[`states`](api/showcase-config.md#states) declares them once, and every variant can be shown in each of them where it fits:

```typescript
@Showcase<ButtonComponent>({
    title: 'Button',
    states: [
        { name: 'Hover', pseudo: { hover: '.btn' } },
        { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } },
        // The ring is an outline with an offset, drawn outside the button's box.
        { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } }
    ],
    variants: [
        { name: 'Filled', inputs: { variant: 'filled', label: 'Filled' } },
        { name: 'Outlined', inputs: { variant: 'outlined', label: 'Outlined' } },
        { name: 'Disabled', inputs: { variant: 'filled', label: 'Disabled', disabled: true } },
        { name: 'Full width', inputs: { variant: 'filled', label: 'Full width', fullWidth: true }, canvasLayout: 'stretch', states: false }
    ]
})
```

The ribbon still lists four variants. Each of them, `Full width` aside, is combined with hovered, pressed and focused wherever the state fits, see [When a state does not fit](#when-a-state-does-not-fit):

- [The Overview](guide/styleguide-ui.md#the-overview) shows the variants against the states as a matrix.
- The **State** group in the tools menu has a chip per state, to put it on the variant you are looking at, and a toggle per pseudo-class, see [State switch](guide/styleguide-ui.md#state-switch). The active state is part of the URL as `state`.
- A screenshot runner addresses each combination, see [Screenshot runners](#screenshot-runners).

### Declaring a state

A state has two fields:

- **`name`**: the column title in the Overview, the label of the chip in the tools menu and the name in a visual regression report. It has to be unique within the component.
- **`pseudo`**: the pseudo states it forces, in the same shape as a variant's [`pseudo`](#pseudo-states): `hover`, `active`, `focus`, `focus-visible` and `focus-within`, each with `true`, a selector or a list of selectors.

A variant with a `pseudo` of its own can be shown in a state as well. Both are forced then, and a pseudo-class both name is forced on the targets of both.

`states` needs the component itself to render. A component with [`renderPage`](guide/component-pages.md) has no Overview and renders a page that reads one shared renderer state, so the scanner drops `states` there with a warning.

### Order is identity

A state is identified by its position in the list. The `state` URL parameter, the render marker, `__PRISM_MANIFEST__` and a visual regression report all use that index, so reordering the list moves them. Add new states at the end.

That is also why a broken entry keeps its place. The scanner checks every entry, reports what it cannot use as a warning, and [`strictShowcase`](api/ng-prism-config.md#strictshowcase) turns that into a build error. An entry that is not an object, a name that repeats an earlier one (the first entry wins), and a `pseudo` that is missing or has nothing usable left become an empty state: it forces nothing, fits no variant and shows as an empty column, so the states behind it keep their index. An entry without a `name` is called `State 2` for the second entry, and works as a state as long as its `pseudo` is usable. The full list is under [`states`](api/showcase-config.md#states), the messages under [Build Warnings](api/build-warnings.md#showcase-values).

### Opting a variant out

`states: false` on a variant keeps it out of every combination with the component's states:

```typescript
{ name: 'Full width', inputs: { fullWidth: true }, canvasLayout: 'stretch', states: false }
```

The variant has a single cell in the Overview, spanning every column, and no state is forced on it. Its own `pseudo` still applies. A state requested for it anyway, with `?state=` or from the tools menu, stays selected but is not applied, and the combination reads `states: false`. `false` is the only valid value: anything else is reported and dropped.

## Pseudo states

Both `states` and a variant's `pseudo` name pseudo states the same way. The keys are `hover`, `active`, `focus`, `focus-visible` and `focus-within`. Each takes a target:

- **`true`**: every element of what is rendered, the host included. Closest to what a pointer resting on the component does.
- **A selector, or a list of them**: only the matching elements, matched against what is rendered: the host element and everything inside it. Use it for the element the state belongs to, such as the inner `<button>` of a host component, or a visually hidden `<input>` whose sibling draws the box.

The scanner reads them from the source like any other value. An unknown state, a target that is neither `true` nor a selector, and an empty selector are dropped with a warning that counts for `strictShowcase`. Whether a selector parses is up to the browser, which warns once when it is used.

### Your CSS does the styling

Nothing has to be written twice. In every stylesheet rule whose selector uses one of the five pseudo-classes, the pseudo-class is widened to also match a class: `:focus-visible` becomes `:is(:focus-visible, .prism-pseudo--focus-visible)`. That class goes on the targeted elements, and the component's real focus styles apply to them the way the browser applies them on real focus:

- Sibling combinators (`input:focus-visible + .box::before`), pseudo-elements, `:has()`, `:is()`, `:where()` and `:not()` keep their meaning, and so do rules inside `@media`, `@supports`, `@layer` and `@container`, a `@media (forced-colors: active)` fallback included. A forced element counts as being in the state, so `:not(:hover)` stops matching it.
- Forced and real states combine. `.pill:hover .pill__close:focus-visible` applies when the close button is forced into `:focus-visible` and the pointer really rests on the pill, and the other way round.
- The cascade does not change. The rule stays where it is in the stylesheet, and `:is()` weighs what the pseudo-class weighed, so it wins and loses against the rules around it exactly as the real state would.
- A stylesheet is rewritten once, the first time a variant or a state forces a pseudo state. Styles that arrive later, through a lazily rendered child component or a hot reload, are rewritten as they arrive.
- The classes come off when you switch to another variant, or when the state that forced them goes. Without them every widened selector matches exactly what it matched before, so the styleguide's own UI and every other variant render as before.

The selector is read token by token, so an escaped colon in a class name (`.md\:hover`, as Tailwind writes it) and an attribute value are left alone.

### Limits

- **A state after a pseudo-element stays real.** `::-webkit-scrollbar-thumb:hover` and `::part(label):hover` cannot be forced: `:is()` is not allowed in that position.
- **Real states are not switched off.** A forced variant still reacts to the pointer and the keyboard. Hovering the canvas adds real `:hover` on top, as it would on any other variant.
- **Cross-origin stylesheets cannot be read.** Their rules are not rewritten, and dev mode warns once per sheet. Serve them from the same origin, or with CORS and a `crossorigin` attribute.
- **Shadow DOM is not reached.** A component with `ViewEncapsulation.ShadowDom` keeps its styles and elements in a shadow root, which neither the rewrite nor the selectors look into.

## Per-variant pseudo states

[`pseudo`](api/showcase-config.md#pseudo) on a variant forces pseudo states for as long as that variant renders:

```typescript
@Showcase({
    title: 'Button',
    variants: [
        { name: 'Default' },
        { name: 'Hovered', pseudo: { hover: '.btn' } },
        { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } },
        { name: 'Focused', pseudo: { 'focus-visible': '.btn' } }
    ]
})
```

Targets can differ per pseudo-class:

```typescript
variants: [
    // A checkbox whose ring is drawn by `.checkbox__input:focus-visible + .checkbox__box::before`
    { name: 'Focused', pseudo: { 'focus-visible': '.checkbox__input' } },
    // Two states on two elements: the pill is hovered, its close button is focused
    { name: 'Hovered, close focused', inputs: { closeable: true }, pseudo: { hover: '.pill', 'focus-visible': '.pill__close' } },
    // Real focus on a field puts its container into :focus-within as well
    { name: 'Typing', pseudo: { focus: '.field__input', 'focus-within': '.field' } }
];
```

### States or `pseudo`

Both force pseudo states, and both stay:

- Use **`states`** for a condition that applies to many of the variants and that you want to see next to them: hover, pressed, focus. You write it once, the Overview lines every variant up against it, the Playground can switch to it without losing the variant, and a runner gets every combination. The fit rule keeps it off variants it cannot apply to.
- Use **`pseudo` on a variant** for a picture that belongs to that variant alone: its own inputs plus a forced state, or a one-off mix of targets. The demo's Textarea has a `Focused` state, and its `Typing` variant, a filled textarea with a counter and focus, stays a variant with a `pseudo` of its own. `pseudo` has no fit rule: it forces the state on the elements you name, a disabled one included.

## When a state does not fit

A state does not suit every variant. `.sg-chip__remove` exists only while a chip is removable, the button of a disabled variant cannot take focus, and a card shows its hover style only when it is clickable. Forcing the state anyway would show a picture the browser could never produce, such as a focus ring on a disabled button. A state therefore fits a rendered variant only if every pseudo-class it forces has at least one target the browser could put into that state:

- **A target has to exist.** `true` is the host and everything inside it, and a selector is matched against the host and everything inside it.
- **`focus` and `focus-visible`:** the target is not `:disabled` (which includes the fields of a `<fieldset disabled>`) and does not sit under `[inert]` inside the component. An element with `aria-disabled="true"` still counts, because the browser can focus it. For `true`, the fit is decided on what in the component could take focus at all (a button, a field, a link or an `<area>` with `href`, `summary`, `iframe`, `[tabindex]` or an editable region), so a component whose only button is disabled reads `the component is disabled`. A component with nothing focusable in it is judged on all of its elements.
- **`hover` and `active`:** the target, or something inside it, has a computed `pointer-events` other than `none`. A disabled button usually fails this, since components often set `pointer-events: none` on it. The styles are read with the variant's forced states and all of the state's own in place, so an action that takes the pointer only inside a hovered row counts when the variant or the state hovers that row, and a rule that sets `pointer-events: none` under its own `:hover` makes the state not fit, as the browser could not keep that element hovered either.
- **`focus-within`:** not filtered. Whether anything inside can take focus is not something the browser tells.

Only the targets that pass get the class. When no target of a pseudo-class does, the state does not fit and nothing is forced for it. The combination is never shown as the plain variant in its place: it is reported as not fitting, with one of these reasons. `<target>` is the selector the state forces for that pseudo-class (a list reads as its selectors joined with `, `), or `the component` for `true`:

| Reason                              | Why                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `<target> matches nothing`          | Nothing in the rendered component matches the selector                                       |
| `<target> is disabled`              | A `focus` or `focus-visible` state, and no match can take focus, a disabled one among them   |
| `<target> is inert`                 | A `focus` or `focus-visible` state, and no match can take focus, none of them disabled       |
| `<target> has pointer-events: none` | A `hover` or `active` state, and every match, with everything inside it, ignores the pointer |
| `forces no state`                   | The state forces nothing, for example because the scanner dropped its `pseudo`               |
| `states: false`                     | The variant [opts out](#opting-a-variant-out)                                                |

A state with several pseudo-classes fits only if each of them does, and the reason names the first that does not, in the order `hover`, `active`, `focus`, `focus-visible`, `focus-within`.

The reason shows where you look at the combination: the tooltip of an empty, dashed cell in the Overview, the tooltip of the chip in the tools menu (`Hover does not fit this variant: .btn has pointer-events: none`) and, for a runner, the `data-prism-excluded` attribute, see [A state that does not apply](guide/external-tooling.md#a-state-that-does-not-apply). The rule is checked again whenever the component's DOM changes, so switching the `removable` control of a chip on and off moves it between fitting and not fitting. A target that renders only later, behind `@defer` or after an HTTP call, is not there when the combination is first judged and reads as `matches nothing`.

The demo styleguide has an example of each:

| Component | State                                  | Fits                                                                         | Does not fit                                                                                        |
| --------- | -------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Chip      | `Remove hovered` on `.sg-chip__remove` | `Removable`, `Selected Removable`                                            | `Default`: `.sg-chip__remove matches nothing`                                                       |
| Card      | `Hover` on `.sg-card--clickable`       | `Clickable`                                                                  | `Basic`: `.sg-card--clickable matches nothing`                                                      |
| Button    | `Hover` and `Focus visible` on `.btn`  | every variant except `Disabled` (`Full width` opts out with `states: false`) | `Disabled`: `Hover` reads `.btn has pointer-events: none`, `Focus visible` reads `.btn is disabled` |

A state that fits no variant at all is almost certainly a selector with a typo. The Overview warns once in the browser console (`[ng-prism] State "<name>" of <Class> fits no variant; check its selectors.`) and marks the header of its column: the count `0/<n>` turns to the warning colour, and the header's tooltip reads `<name> fits no variant; check its selectors`. The scanner cannot catch this, because it does not render. An empty state, which forces nothing, is left out of both: it has no selector to check, and the scanner has reported it already.

## Selectors reach the whole composition

When a variant has a [`template` or a host template](guide/compositions.md), what is rendered is the whole composition. Both forms of a target reach the elements of the frame and of the other parts as well: `true` is every element of the composition, and `{ hover: '.lib-form-field__box' }` hovers the box of the form field the subject renders in.

```typescript
@Showcase<FormFieldComponent>({
    title: 'Form Field',
    states: [
        { name: 'Hover', pseudo: { hover: '.lib-form-field__box' } },
        { name: 'Focus visible', pseudo: { 'focus-visible': '.lib-input' } }
    ],
    variants: [{ name: 'Default', inputs: { label: 'E-Mail' }, template: '<input libInput type="email" />' }]
})
```

The fit rule looks at the same elements, so a state whose target sits in the frame fits as long as the frame has it.

## Screenshot runners

A runner drives to a combination with `state` next to `variant` in the URL, and waits for the render marker, which ends in the state's index while a state is active. `__PRISM_MANIFEST__` lists every component's states and marks the variants that opted out. A combination that does not fit still renders and sets the marker, and it carries the reason in `data-prism-excluded`, so the runner reports it as excluded instead of taking a screenshot. Capture mode applies the state, and leaves room around the component for its focus ring, as it does for a variant's own `pseudo`. The contract is under [Waiting for a render](guide/external-tooling.md#waiting-for-a-render) and [A state that does not apply](guide/external-tooling.md#a-state-that-does-not-apply), a loop that does all of this under [A worked example](guide/visual-regression.md#a-worked-example), and the [Visual Regression plugin](plugins/visual-regression.md) shows the results with one row per variant and state.

## Related

- [`states`](api/showcase-config.md#states) and [`pseudo`](api/showcase-config.md#pseudo) in the ShowcaseConfig reference, [`ShowcaseState`](api/types.md#showcasestate) and [`ForcedPseudoStates`](api/types.md#forcedpseudostates) in Types
- [Tour of the UI](guide/styleguide-ui.md#state-switch): the State group in the tools menu and the Overview matrix
- [Variants](guide/variants.md)
- [Visual Regression](guide/visual-regression.md#forced-pseudo-states): forced states in a baseline
- [Build Warnings](api/build-warnings.md#showcase-values): the messages about `states` and `pseudo`
