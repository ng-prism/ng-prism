/**
 * What each `CanvasBg` value paints, shared by the Playground stage
 * (`prism-renderer`), the Overview cells (`prism-overview-cell`) and the
 * background swatches of the tools menu (`prism-canvas-toolbar`).
 *
 * Must be the last entry of a component's `styles` array. After encapsulation
 * these attribute selectors have the same specificity as the `.some-stage`
 * class rule they override, so source order decides.
 *
 * The consuming element supplies its own `background-color`; only `light` and
 * `dark` override it. Capture mode is unaffected: `CAPTURE_STYLES` is a global
 * stylesheet using `!important`.
 */
export const CANVAS_BG_STYLES = `
  [data-bg="dots"] {
    background-image: radial-gradient(circle, var(--prism-dot) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  [data-bg="plain"] {
    background-image: none;
  }

  /* Flat, not dotted. "light" and "dark" name the surface a component was
     designed against, and their colour is absolute rather than a theme token,
     which makes them the values to declare for a screenshot baseline. Use
     "dots" for the grid. */
  /* These two also re-point --prism-measure. Other overlays use theme colours
     on theme surfaces, but these grounds ignore the theme: "light" stays
     near-white in the dark theme and "dark" stays near-black in the light one.
     The dark theme's magenta reaches only 2.85:1 on the light ground, under the
     4.5:1 its 9px readout needs, so the measurement colour has to follow the
     ground, not the theme.

     --prism-measure-plate follows it for the same reason. It is the surface
     the measuring tool's value label paints itself on, so the label reads as a
     gap in the measurement line rather than a badge on top of it. At its
     --prism-stage fallback it would be the theme's stage under a re-pointed
     foreground: the light theme's magenta on the dark theme's stage reads
     3.71:1, the dark theme's on white 3.08:1. Pinned to the ground the same way,
     the pairs reach 4.54:1 and 6.57:1. A color-mix against the ground would
     work too, but this file already states both grounds literally, and one
     mechanism per decision is enough.

     Literal values because this file is theme-independent, like the two
     grounds below. Keep them in step with --prism-measure in canvas-overlay-tokens.ts and
     prism-default-theme.ts; semantic-colours.spec.ts fails if they drift. */
  [data-bg="light"] {
    background-color: var(--prism-void-light, #f7f5fc);
    background-image: none;
    --prism-measure: #ca00c1;
    --prism-measure-plate: var(--prism-void-light, #f7f5fc);
  }
  [data-bg="dark"] {
    background-color: var(--prism-void-dark, #07050f);
    background-image: none;
    --prism-measure: #f632ff;
    --prism-measure-plate: var(--prism-void-dark, #07050f);
  }

  /* "transparent" paints a checkerboard. In the app the checkerboard is already
     the UI's sign for "no surface", and a see-through stage would only show the
     shell behind it. Only CAPTURE_STYLES makes the stage see-through. */
  [data-bg="transparent"] {
    background-image:
      linear-gradient(45deg, var(--prism-border) 25%, transparent 25%),
      linear-gradient(-45deg, var(--prism-border) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--prism-border) 75%),
      linear-gradient(-45deg, transparent 75%, var(--prism-border) 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  }
`;
