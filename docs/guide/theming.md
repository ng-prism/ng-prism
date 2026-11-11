# Theming

The styleguide is drawn with CSS custom properties, the tokens on this page. You override them in `ng-prism.config.ts`: [`theme`](api/ng-prism-config.md#theme) for both themes, [`darkTheme`](api/ng-prism-config.md#darktheme) and [`lightTheme`](api/ng-prism-config.md#lighttheme) for one of them. The tasks come first, then every token with its default.

## Quick Override

```typescript
// ng-prism.config.ts
import { defineConfig } from '@ng-prism/core/config';

export default defineConfig({
    theme: {
        '--prism-primary': '#0ea5e9',
        '--prism-bg': '#0f172a',
        '--prism-font-sans': '"Inter", system-ui, sans-serif'
    }
});
```

Values in `theme` are merged on top of the built-in defaults. You only need to specify the properties you want to change.

Overriding `--prism-primary` alone also recolours everything that reads the primary: fills (primary buttons, checkboxes) through `--prism-primary-fill` and `--prism-primary-fill-hover`, the active toggle track (`--prism-toggle-on`, which follows the fill), the selection tints and the tab and sidebar indicators (`--prism-brand-ink` becomes your primary). Any of them you set yourself wins. Two things stay ng-prism's: the wordmark keeps the brand gradient, and the tool rail on the absolute `light` and `dark` canvas grounds keeps its own blue, picked for contrast on those grounds. Text on those fills stays `--prism-on-primary` (white); with a light primary of your own, set `--prism-on-primary` too so the label keeps 4.5:1.

**Keep the contrast.** The defaults hold these floors, and colours of your own should too: every text role 4.5:1 on every surface (`--prism-void`, `--prism-bg`, `--prism-bg-surface`, `--prism-bg-elevated`, `--prism-stage`); status colours 4.5:1 on their own `-bg` tint as well; control contours, fills and facet colours 3:1; warning and danger at least ΔE 45 and ΔL\* 14 apart. The lightness gap is the part that is easy to lose: these colours appear at 5–11px, where lightness carries far more of the distinction than hue, and for a reader with deuteranopia it is all that is left.

## Theme-Specific Overrides

Use `darkTheme` and `lightTheme` to set values that only apply in one mode:

```typescript
export default defineConfig({
    theme: {
        '--prism-primary': '#0056CE',
        '--prism-font-sans': "'Inter', system-ui, sans-serif"
    },
    darkTheme: {
        '--prism-bg': '#0a1628',
        '--prism-bg-surface': '#112240'
    },
    lightTheme: {
        '--prism-bg': '#f1f5f9',
        '--prism-bg-surface': '#ffffff'
    }
});
```

**Merge order:** `built-in defaults → darkTheme/lightTheme → theme`. The `theme` property always wins when the same key appears in both.

## The Header Band

The header is a navy brand band in both themes, also while the styleguide runs light. It renders with the dark tokens, including your `darkTheme` overrides, so a header widget from any plugin reads colours that fit the band without code of its own. A `lightTheme` value does not reach it. Menus that open out of the header follow the active theme again.

### Brand Motion

The header's brand light moves, slowly enough that it rarely draws the eye. Once per cycle the glow behind the logo swells, a soft light leaves the mark along the top edge and fades out towards the header actions, and then the band rests until the next cycle. Only `transform` and `opacity` animate, so the browser runs it on the compositor.

`--prism-brand-motion` is the length of one cycle. A longer time makes it slower and rarer, and `none` switches it off:

```typescript
export default defineConfig({
    theme: {
        '--prism-brand-motion': '40s' // calmer; 'none' holds the header still
    }
});
```

Any value that is not a time (`none`, `0`, `off`) leaves the animation without a duration, and the header shows its static look: the brand edge and the glow as they are without motion. Set the token in `theme` (or `darkTheme`), since the header renders with the dark set. With `prefers-reduced-motion: reduce` set in the operating system, the header stays still whatever the token says. Capture mode holds it still as well.

## Density

Four bands of the chrome take their height from one scalar, `--density` (see [Band Heights](#band-heights-and-density)). Setting it rescales the whole chrome. There is no menu behind it; set it through `theme`:

```typescript
export default defineConfig({
    theme: {
        '--density': '0.8' // compact; '1.25' for spacious
    }
});
```

`--density` defaults to `1` and is the same in the dark and the light theme, so `darkTheme` and `lightTheme` need not repeat it.

The styleguide sets every token, `--density` and the band heights included, as an inline style on `<html>`. A custom property that uses `var()` is resolved on the element that declares it, so the band heights are computed on `<html>`, and only a `--density` on `<html>` changes them. A rule such as `prism-shell { --density: 0.8 }` has no effect, and a stylesheet rule on `html` loses against the inline style.

## Dark and Light Themes

The styleguide starts dark. The sun or moon in the header switches to the light theme and back. The choice is stored in `localStorage` (`ng-prism-theme`) and set as `data-prism-theme` on `<html>`, as `dark` or `light` (since 22.8.0). Key styles of your own that follow the styleguide's theme, on a component page for example, on that attribute. The styleguide also sets `data-theme` to the same value, deprecated since 22.8.0, removed in 23.0.0: a library whose own theme hangs on `data-theme` would follow the styleguide's theme through it.

Both themes map the same tokens to different values, listed side by side below. Your `theme` overrides apply to both; use `darkTheme` or `lightTheme` for overrides that apply to one of them only.

## Scoping

Because the showcase renders without an iframe, your library's styles and ng-prism's chrome share one document. The chrome's component styles use Angular's default emulated encapsulation, so their selectors do not match elements of your component.

The theme tokens are not scoped. The styleguide sets them as inline custom properties on `<html>`, next to the `data-prism-theme` attribute, so every element in the document inherits them, your rendered component included. That only matters where your styles read a custom property of the same name. Most tokens carry the `--prism-` prefix, but the base tokens `--font-sans`, `--font-mono`, `--fs-*`, `--sp-*`, `--radius-*`, `--ease-default`, `--dur-*`, `--density` and `--band-*` do not. If your library declares one of these names on `:root` or `html`, ng-prism's inline value wins inside the styleguide; declared on your component's host or below it, yours wins.

## Tokens

Every token with its default. `@ng-prism/core` exports the defaults as `PRISM_DARK_THEME` (also `PRISM_DEFAULT_THEME`), `PRISM_LIGHT_THEME` and `PRISM_BASE_TOKENS`, the tokens that are the same in both themes. Six older tokens are deprecated, see [`theme`](api/ng-prism-config.md#theme).

### Brand

| Property                                             | Default (dark)                                                               | Default (light)                                                              | Description                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-brand-gradient`                             | `linear-gradient(90deg, #00CFEA 0%, #078BFA 38%, #244BFF 68%, #A20CF0 100%)` | same                                                                         | The logo gradient: the wordmark and the header's top edge. Identical in both themes.                                                                    |
| `--prism-brand-ink`                                  | `var(--prism-brand-gradient)`                                                | `linear-gradient(90deg, #0891b2 0%, #2563eb 38%, #6d28d9 68%, #a20cf0 100%)` | The gradient as a stroke on the current surface: tab indicators, the active sidebar entry, the active view segment. Every stop holds 3:1 on the chrome. |
| `--prism-brand-glow`                                 | three soft radial gradients in cyan, blue and magenta                        | the same, a little fainter                                                   | The refracted light behind the logo and the empty state                                                                                                 |
| `--prism-facet-cyan`, `-blue`, `-violet`, `-magenta` | `#22d3ee`, `#60a5fa`, `#a78bfa`, `#e879f9`                                   | `#0891b2`, `#2563eb`, `#7c3aed`, `#c026d3`                                   | The logo's facet colours for icons (sidebar sections). Each holds 3:1 on every surface.                                                                 |
| `--prism-brand-motion`                               | `24s`                                                                        | same                                                                         | One cycle of the brand light in the header; see [Brand Motion](#brand-motion). `none` holds it still.                                                   |

### Color Properties

| Property                                 | Default (dark)                                              | Default (light)                                                  | Description                                                                |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `--prism-primary`                        | `#60a5fa`                                                   | `#1d4ed8`                                                        | Text and indicator role: links, active tabs, active icons, selection tints |
| `--prism-primary-fill`                   | `#2563eb`                                                   | `#2563eb`                                                        | Fill role: primary buttons, active toggles, checked checkboxes             |
| `--prism-primary-fill-hover`             | `#1d4ed8`                                                   | `#1d4ed8`                                                        | Hover state of the fill                                                    |
| `--prism-on-primary`                     | `#ffffff`                                                   | `#ffffff`                                                        | Text and knobs on the fill (5.2:1)                                         |
| `--prism-toggle-on`                      | `linear-gradient(90deg, #078bfa, #2563eb)`                  | `linear-gradient(90deg, #078bfa, #244bff)`                       | Track of a switched-on toggle; follows an overridden primary or fill       |
| `--prism-link`                           | `var(--prism-primary)`                                      | same                                                             | Links in the chrome                                                        |
| `--prism-primary-bg`                     | `color-mix(in srgb, var(--prism-primary) 16%, transparent)` | `color-mix(in srgb, var(--prism-primary-fill) 10%, transparent)` | Selection and active-state tint                                            |
| `--prism-accent`                         | `#a78bfa`                                                   | `#7c3aed`                                                        | Secondary accent                                                           |
| `--prism-bg`                             | `#080d19`                                                   | `#f1f5f9`                                                        | Chrome: header, sidebar, component head, variant ribbon, panel tab bar     |
| `--prism-bg-surface`                     | `#111827`                                                   | `#ffffff`                                                        | Content: addon panel, cards, canvas surround                               |
| `--prism-bg-elevated`                    | `#1a2335`                                                   | `#ffffff`                                                        | Popovers, the tool rail (with `--prism-shadow-md`)                         |
| `--prism-void`                           | `#050911`                                                   | `#eef2f7`                                                        | Deepest background behind everything                                       |
| `--prism-shadow-sm`, `--prism-shadow-md` | dark, strong                                                | slate-tinted, soft                                               | Elevation of segments and popovers                                         |

Why two primaries: the brand blue `#2563eb` reaches only 3–3.9:1 as text on the dark surfaces, but 5.2:1 under white text as a fill in both themes. So fills keep the brand blue, and text and indicators take a shade that holds 4.5:1 on every surface, including the tints.

### Text Properties

| Property             | Default (dark) | Default (light) | Description                                                                        |
| -------------------- | -------------- | --------------- | ---------------------------------------------------------------------------------- |
| `--prism-text`       | `#f1f5f9`      | `#0f172a`       | Primary text                                                                       |
| `--prism-text-2`     | `#cbd5e1`      | `#334155`       | Secondary text                                                                     |
| `--prism-text-muted` | `#94a3b8`      | `#5b6b80`       | Muted text, labels, metadata. Holds 4.5:1 on every surface.                        |
| `--prism-text-ghost` | `#64748b`      | `#94a3b8`       | Decoration and placeholders only; never for text someone has to read (under 4.5:1) |

### Status Colors

| Property                                                     | Default (dark)                                        | Default (light)                                      | Description                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-success`                                            | `#0ae2cb`                                             | `#06776a`                                            | Within its threshold                                                                                                                                                                     |
| `--prism-warn`                                               | `#ffb984`                                             | `#a05602`                                            | Past its warning threshold                                                                                                                                                               |
| `--prism-danger`                                             | `#fe6ba6`                                             | `#8e024d`                                            | Past its critical threshold                                                                                                                                                              |
| `--prism-success-bg`, `--prism-warn-bg`, `--prism-danger-bg` | `color-mix(in srgb, var(--prism-x) 16%, transparent)` | `color-mix(in srgb, <vivid shade> 14%, transparent)` | Soft badge surfaces. In the light theme the tint comes from a vivid shade of the hue (`#0edbc5`, `#ffa65f`, `#ff7cad`), because a tint of the dark text colour reads olive and wine-red. |

Every status colour holds 4.5:1 on every surface and on its own `-bg` tint. Warning and danger stay at least ΔE 45 and ΔL\* 14 apart, so they remain tellable apart for a reader with deuteranopia.

### Code Syntax Colors

| Property            | Default (dark) | Default (light) | Description                |
| ------------------- | -------------- | --------------- | -------------------------- |
| `--prism-code-tag`  | `#e879f9`      | `#a21caf`       | HTML/XML tag names         |
| `--prism-code-attr` | `#67e8f9`      | `#0e7490`       | Attribute names, JSON keys |
| `--prism-code-str`  | `#86efac`      | `#127a3a`       | String values              |
| `--prism-code-com`  | `#7c8ba1`      | `#5b6b80`       | Comments                   |

### Border & Glow Properties

| Property                | Default (dark)             | Default (light)          | Description                                                        |
| ----------------------- | -------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `--prism-border`        | `#1f2b3e`                  | `#e2e8f0`                | Dividers and decorative outlines                                   |
| `--prism-border-strong` | `#64748b`                  | `#7b8aa0`                | Contours of controls (toggles, checkboxes, inputs); 3:1 everywhere |
| `--prism-glow`          | `rgba(37, 99, 235, .18)`   | `rgba(37, 99, 235, .12)` | Subtle glow for interactive focus                                  |
| `--prism-glow-strong`   | `rgba(37, 99, 235, .35)`   | `rgba(37, 99, 235, .25)` | Stronger glow                                                      |
| `--prism-input-bg`      | `rgba(148, 163, 184, .08)` | `rgba(15, 23, 42, .04)`  | Background for form inputs in the Controls panel                   |
| `--prism-dot`           | `rgba(96, 165, 250, .16)`  | `rgba(37, 99, 235, .14)` | Canvas dot-grid color                                              |

### Base Tokens (theme-independent)

These tokens are set once and do not change between dark/light mode.

| Property                | Default              | Description                                                             |
| ----------------------- | -------------------- | ----------------------------------------------------------------------- |
| `--prism-void-light`    | `#f7f5fc`            | Fixed light canvas background (for explicit `light` canvas mode)        |
| `--prism-void-dark`     | `#07050f`            | Fixed dark canvas background (for explicit `dark` canvas mode)          |
| `--prism-text-light`    | `#f1f5f9`            | Light text for overlays on dark backgrounds                             |
| `--prism-header-height` | `var(--band-header)` | Alias of `--band-header`; see [Band Heights](#band-heights-and-density) |

### Measurement and Stage Tokens

| Property                | Default (dark)                    | Default (light)                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-measure`       | `#f632ff`                         | `#ca00c1`                         | The role for measurements, as opposed to status. Core paints the canvas viewport constraint with it (the edge grips, their guide lines and the dimension line), and the measuring tool uses it for every mark it draws: the measurement line, its end ticks, the dotted snap echo, the floating value label and the pin row's chips below the canvas. Plugins drawing measurement or dimension UI should reach for it rather than picking their own. The canvas re-points this token on the two absolute backgrounds (`bg: 'light'` and `bg: 'dark'`), because those grounds do not follow the theme, and under simulated forced colors to the light or dark value of the palette; an override set here still applies everywhere else. |
| `--prism-measure-plate` | _(falls back to `--prism-stage`)_ | _(falls back to `--prism-stage`)_ | The surface the measuring tool's value label paints itself on, so the number reads as a gap in the measurement line rather than a badge on top of it. Unset by default and resolved through `var(--prism-measure-plate, var(--prism-stage))`, because on the four theme-following backgrounds the stage _is_ the ground. The canvas re-points it on `bg: 'light'` and `bg: 'dark'` alongside `--prism-measure`. Override it only together with `--prism-measure`; the two are a foreground/background pair at 4.5:1.                                                                                                                                                                                                                   |
| `--prism-stage`         | `#0e1524`                         | `#fafbfd`                         | Background colour of the canvas stage, independent of the variant's `bg` (`dots`/`plain`/`light`/`dark`/etc. paint on top of it). Kept distinct from `--prism-bg-surface`, which surrounds it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--prism-stage-edge`    | `rgba(255,255,255,0.08)`          | `rgba(15,23,42,0.10)`             | The stage's boundary colour, drawn as an outline inside the stage, so it takes no room from the component.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### Canvas overlays

The tool rail, the pills, the pin row and the rulers sit on the canvas, so they follow the canvas ground rather than the app theme. Six tokens carry their colours: `--prism-canvas-overlay-bg`, `-fg`, `-muted`, `-border`, `-primary` and `-active`. On the three grounds that follow the theme (`dots`, `plain`, `transparent`) they resolve to the theme's elevated surface, text, text-2, border-strong, primary and primary tint. On the two absolute grounds (`bg: 'light'` and `bg: 'dark'`) the shell sets them to fixed light or dark values, so a rail stays light on a light canvas under the dark theme and the other way round. Under simulated [forced colors](guide/styleguide-ui.md#forced-colors) the ground is the palette's `Canvas`, and they take the fixed values of its light or dark palette. They are set on `.prism-canvas-wrap`; override them there only if you restyle the canvas chrome.

### Spacing Scale

A 7-step scale used throughout the chrome's own padding, gaps and margins. It applies only to ng-prism's own surfaces, not to your rendered component.

| Property | Value |
| -------- | ----- |
| `--sp-1` | 2px   |
| `--sp-2` | 4px   |
| `--sp-3` | 8px   |
| `--sp-4` | 12px  |
| `--sp-5` | 16px  |
| `--sp-6` | 24px  |
| `--sp-7` | 40px  |

### Band Heights and Density

Four chrome regions size themselves off one shared scalar, `--density` (default `1`), rather than off individual fixed pixel values. How to change it is under [Density](#density).

| Property        | Formula                       | Height at `--density: 1` | Region                                         |
| --------------- | ----------------------------- | ------------------------ | ---------------------------------------------- |
| `--band-header` | `calc(40px * var(--density))` | 40px                     | The top app header                             |
| `--band-head`   | `calc(36px * var(--density))` | 36px                     | The component head (title, status chip, gauge) |
| `--band-rail`   | `calc(28px * var(--density))` | 28px                     | The variant ribbon                             |
| `--band-tabs`   | `calc(34px * var(--density))` | 34px                     | The addon panel's tab bar                      |

### Typography

| Property            | Default                                     | Description                                       |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| `--font-sans`       | `'Inter', system-ui, sans-serif`            | Base sans-serif font stack                        |
| `--font-mono`       | `'JetBrains Mono', ui-monospace, monospace` | Base monospace font stack                         |
| `--prism-font-sans` | `var(--font-sans)`                          | Sans-serif font stack (UI chrome)                 |
| `--prism-font-mono` | `var(--font-mono)`                          | Monospace font stack (code snippets, JSON editor) |

### Font Sizes

| Property   | Size   |
| ---------- | ------ |
| `--fs-xs`  | 10px   |
| `--fs-sm`  | 11.5px |
| `--fs-md`  | 12.5px |
| `--fs-lg`  | 13.5px |
| `--fs-xl`  | 15px   |
| `--fs-2xl` | 22px   |

### Border Radius

| Property      | Size |
| ------------- | ---- |
| `--radius-xs` | 3px  |
| `--radius-sm` | 5px  |
| `--radius-md` | 7px  |
| `--radius-lg` | 10px |

### Timing

| Property         | Value                          |
| ---------------- | ------------------------------ |
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--dur-fast`     | 0.12s                          |
| `--dur-base`     | 0.2s                           |
| `--dur-slow`     | 0.3s                           |

## Related

- [`theme`](api/ng-prism-config.md#theme), [`darkTheme`](api/ng-prism-config.md#darktheme), [`lightTheme`](api/ng-prism-config.md#lighttheme): the config fields, and the deprecated tokens.
- [Configuration](guide/configuration.md): the rest of `ng-prism.config.ts`.
- [Component Pages](guide/component-pages.md#following-the-theme): a page of your own that follows the theme.
- [Panel Design](plugins/panel-design.md): the tokens in a plugin's panel.
