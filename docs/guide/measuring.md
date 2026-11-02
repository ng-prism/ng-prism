# Measuring

Guides and rulers show where things sit on the canvas. The measuring tool answers a narrower question: exactly how many pixels lie between two points, in this layout, right now. It is not a correctness check. It does not know what the right answer would have been, it reports the one that is rendered.

## Turning it on

The measuring tool is the **Measure** button on the [canvas rail](guide/styleguide-ui.md#canvas-rail-and-tools), next to guides, rulers and the viewport width. Like them it is a preference of your working environment, not a statement about the component on screen: it is kept in the browser's `localStorage` and is on again the next time you open the styleguide, for any component and any variant.

The [phone layout](guide/styleguide-ui.md#on-a-phone) leaves the tool out, along with guides, rulers and the viewport width, and hides the pins. They come back as you left them once the window is wide again. [Capture mode](guide/external-tooling.md#capture-isolation-mode) hides the tool and its pins as well, so a screenshot never shows a measurement.

## Measuring a distance

Press and drag from one point to another; releasing the pointer finishes the measurement. A click without moving starts none: a zero-length measurement says nothing, so it is discarded instead of landing in the pin row for you to clear by hand. Only the primary button starts a measurement. A right-click is ignored, because the context menu would take the pointer away and leave a half-finished measurement following the cursor.

While you drag, each endpoint latches onto the nearest border, padding or content edge of the element under the pointer, as long as one is within 8 screen pixels. Screen pixels, not CSS pixels, so the reach of your hand is the same at 50% and at 200% zoom.

A latched endpoint draws a short dotted tick along the edge it locked onto. The tick is shorter and fainter than the measurement line, and it tells you which edge was meant: a 2px border puts the border, padding and content edges 2 pixels apart, and without the tick you could not tell which of the three the point took.

Hold **Shift** while dragging and the measurement is pulled onto the nearest of the eight 45-degree directions: horizontal, vertical or one of the four diagonals, as Shift does in Photoshop, Illustrator and Figma. It makes an exactly straight measurement reachable by hand. Releasing Shift frees the drag again at once, also mid-drag.

Shift works on the snapped point, not instead of it, so the two do not fight. Drag horizontally while the endpoint latches onto a left edge at x=338, and you keep that x and get an exactly flat line. Only an edge across the forced direction cannot survive: forcing the vertical off a top edge moves the point off that edge, so its dotted tick is dropped. A diagonal moves the point on both axes and drops any tick.

The projection is orthogonal, not length-preserving. A drag 240 across and 7 down, held flat with Shift, reports 240, the length of the line actually drawn.

> On the keyboard, Shift enlarges the arrow-key step to 10 pixels instead. The two never meet: one needs a pointer held down, the other needs none.

A point with nothing in reach drops wherever the pointer is, in the open space between elements. The tool measures open space as readily as an edge.

### How values are printed

- **In CSS pixels:** the distance the component renders at, whatever the zoom.
- **Whole pixels where the document pins nothing.** An endpoint latched to an edge keeps that edge's exact position on the axis the edge decides, and the other axis is rounded to a whole pixel, as is a point that latched onto nothing. So a toggle knob centred at 2.5px in its track reads 2.5, while a free point does not report stray fractions of where the component happens to sit.
- **At most one decimal,** and whole values without one. That shows a gap of 2.5 rather than 3 and reads at a glance. Two readings that differ only in the second decimal print the same number, so `left 6.8, right 6.8` is not a promise of symmetry.
- **A measurement held with Shift keeps its fractions,** since a diagonal between two whole points is rarely a whole number and rounding it would give up the exact angle.

The value sits at the midpoint of the line when the line is long enough to hold it; on a short line it moves aside instead of colliding with its own end ticks. Each result is also announced through a polite live region, so a screen reader hears it as well. The four-sided readout below is spoken with each side named and the unit added (`top 16 px, right 8 px`).

## Comparing two elements

Hold Alt without clicking and whatever sits under the pointer is outlined in the dashed shape an anchor takes, at half the weight: a preview of what a click would fix, so you see the choice before you make it. The preview appears only while nothing is anchored yet.

Alt-click an element to fix it as the anchor. The outline firms up and stops following the pointer, which tells you the click registered, and the anchor stays outlined with a dashed rectangle before anything else is hovered. That dashed outline is also what tells the two ends of a one-sided reading apart. From there, hold Alt and move the pointer over other elements: whatever is underneath gets a solid outline, and every gap between the two is drawn, up to four lines, one per side.

The same four numbers give two different readings:

- **One element inside the other:** the four lines are insets, the padding of a container on every side at once. It does not matter which of the two you anchored: anchoring a heading and hovering its card reads the same insets as anchoring the card and hovering the heading.
- **Two elements apart:** only the sides that face open space draw a line. A side with nothing between the boxes draws nothing, and two elements that overlap on both axes report nothing at all, which is the correct answer: there is no gap to put a number on.

The anchor stays across repeated Alt-hovers: let go of Alt, move elsewhere, hold Alt again, and you still compare against the same element. It changes only on a new Alt-click, on switching the variant or the component, or on turning the tool off. Hovering the anchor itself draws no spans, since there is no distance from an element to itself, but its dashed outline stays.

## Keeping measurements

A finished drag is pinned right away; there is no separate step. It lands in a row below the canvas as a chip with its value and its own remove button.

Pins outlive switching the tool off and on. The toggle only drops a drag in progress and the Alt-click anchor, so an accidental click on the rail button does not cost you the measurements you took. Selecting another variant or component clears them: a pinned number describes this rendering, and carried into another layout it would present a stale measurement as current. Pins are never stored, so a reload starts as clean as a switch of variants does.

## Keyboard

Arrow keys nudge the moving endpoint of a measurement you are dragging, one CSS pixel per press, ten with Shift. Enter pins the measurement without waiting for the pointer to come back up. Escape discards it.

All four only act on a measurement a pointer has started, see below.

## What it does not do

**It cannot be started from the keyboard.** A measurement only ever begins with a pointer-down. Arrow keys, Enter and Escape act on a measurement a pointer has opened; pressed with nothing running, they do nothing, and Tab is not taken over by the tool. If you rely on keyboard operation, treat this as a hard limit for now. [Canvas State](architecture/canvas-state.md#no-keyboard-start-yet) explains what is planned.

**It measures geometry, not the cascade.** A point knows which edge it landed on, not which CSS property drew that edge. Whether a 16px space is `padding`, `border` or `margin` is what the [Box Model](plugins/box-model.md) plugin tells you: it reads the three from `getComputedStyle` rather than from pixels on screen. Neither tool goes further: a gap made by a flex or grid `gap` is no box-model property, and both read it as plain geometry. While the measuring tool is on, no panel overlay is drawn, the box model's included, so the two never compete for the canvas; [Canvas State](architecture/canvas-state.md#core-chrome-not-a-plugin-overlay) explains why that split is meant to be temporary.

**It does not judge a value.** A measurement is reported, not graded. There is no design-token scale it checks a number against, and no warning for a gap that misses one. Whether 18px should have been 16px is still your call.

## Related

- [Tour of the UI](guide/styleguide-ui.md#canvas-rail-and-tools): the canvas rail and the other tools on it
- [Box Model](plugins/box-model.md): margin, border and padding of an element
- [Canvas State](architecture/canvas-state.md#measuring): how the tool works, for contributors
