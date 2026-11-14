import { CHECKERBOARD_GROUND, CHECKERBOARD_IMAGE, CHECKERBOARD_SQUARE } from '../../shared/checkerboard.js';

/**
 * What each `CanvasBg` value paints, shared by the Playground stage
 * (`prism-renderer`), the Overview cells (`prism-overview-cell`) and the
 * background swatches of the tools menu (`prism-canvas-toolbar`).
 *
 * Must be the last entry of a component's `styles` array. After encapsulation
 * these attribute selectors have the same specificity as the `.some-stage`
 * class rule they override, so source order decides.
 *
 * The consuming element supplies its own `background-color`; only `light`,
 * `dark` and `transparent` override it, and those three do not follow the
 * styleguide's theme, nor does the text colour they hand to the component.
 * Capture mode is unaffected: `CAPTURE_STYLES` is a global stylesheet using
 * `!important`, and it leaves that text colour in place.
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

     The measurement colour is read from a theme token of the ground,
     --prism-void-light-measure and --prism-void-dark-measure, so that a project
     whose ground is a mid-tone can set the one that holds on it. The literal
     after each is its default, which this file states because it is a plain
     stylesheet and has no theme to read: it is the value in PRISM_BASE_TOKENS
     (prism-default-theme.ts), and semantic-colours.spec.ts fails if they drift.
     The tool rail, the pills and the pin row read their own tokens of the
     ground the same way (canvasOverlayTokens). Under forced colors the stage
     takes the wrap's fixed values back with inherit instead.

     --prism-ground-text is the text colour a component inherits on the ground,
     taken from --prism-void-light-text and --prism-void-dark-text. Without it
     the component would inherit the shell's --prism-text, which follows the
     theme: white on the light ground in the dark theme, so an icon painted
     with currentColor vanished on it. It is a relay and not a "color" on the
     stage, because the stage also holds the crosshair, the pills and the
     measurement label, which are chrome and keep the theme's text. Only
     .demo-wrap and .cell__mount read it, and fall back to --prism-text on the
     grounds that do not set it ("dots" and "plain"). An overlay that a plugin
     renders inside .demo-wrap sits below it and inherits it too, unless it
     sets a colour of its own. */
  [data-bg="light"] {
    background-color: var(--prism-void-light, #f7f5fc);
    background-image: none;
    --prism-measure: var(--prism-void-light-measure, #ca00c1);
    --prism-measure-plate: var(--prism-void-light, #f7f5fc);
    --prism-ground-text: var(--prism-void-light-text, #0f172a);
  }
  [data-bg="dark"] {
    background-color: var(--prism-void-dark, #07050f);
    background-image: none;
    --prism-measure: var(--prism-void-dark-measure, #f632ff);
    --prism-measure-plate: var(--prism-void-dark, #07050f);
    --prism-ground-text: var(--prism-void-dark-text, #f1f5f9);
  }

  /* "transparent" is the surface of a page the component stands on without a
     surface of its own, and that page is a light one. Its checkerboard is
     therefore fixed and light in both themes, like "light", and not drawn from
     the theme's stage and border, which turned it navy under the dark theme and
     put a component's dark text on it. Only CAPTURE_STYLES makes the stage
     see-through, in a capture.

     The squares are the ground mixed 6% towards ink in sRGB (#e9e8ef by
     default), so a project that retunes --prism-void-light retunes them too.
     6% and not 8%, which would take the faintest layer of the measuring tool
     (55%) under 2.5:1 on a square. The measurement colours are those of "light"
     for the reason given there, and canvasOverlayTokens returns its overlays;
     semantic-colours.spec.ts reads the square out of this rule and measures
     both against them. --prism-checker-square is local to the rule. The
     board comes from shared/checkerboard.ts, which plugins get as
     checkerboardStyle(). */
  [data-bg="transparent"] {
    --prism-checker-square: ${CHECKERBOARD_SQUARE};
    --prism-measure: var(--prism-void-light-measure, #ca00c1);
    --prism-measure-plate: var(--prism-void-light, #f7f5fc);
    --prism-ground-text: var(--prism-void-light-text, #0f172a);
    background-color: ${CHECKERBOARD_GROUND};
    background-image: ${CHECKERBOARD_IMAGE};
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  }
`;
