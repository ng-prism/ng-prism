/*
 * The brand gradient from the 22.7 logo. One value in both themes: the
 * wordmark sits on the navy header band in either, and the brand guide asks for
 * an identical gradient across themes.
 */
const BRAND_GRADIENT = 'linear-gradient(90deg, #00CFEA 0%, #078BFA 38%, #244BFF 68%, #A20CF0 100%)';

/*
 * Deprecated since 22.7.0, removed in 23.0.0: `--prism-spectrum`,
 * `--prism-primary-from`, `--prism-primary-to` and the three `--prism-mark-*`
 * roles. Core no longer reads them; they stay defined (the marks as aliases of
 * the status colours) so a consuming stylesheet that does keeps working.
 */
const DEPRECATED_ALIASES: Record<string, string> = {
    '--prism-mark-nominal': 'var(--prism-success)',
    '--prism-mark-attention': 'var(--prism-warn)',
    '--prism-mark-critical': 'var(--prism-danger)',
    '--prism-spectrum': 'var(--prism-brand-gradient)',
    '--prism-primary-from': '#2563eb',
    '--prism-primary-to': '#00cfea'
};

export const PRISM_DARK_THEME: Record<string, string> = {
    '--prism-code-tag': '#e879f9',
    '--prism-code-attr': '#67e8f9',
    '--prism-code-str': '#86efac',
    '--prism-code-com': '#7c8ba1',

    '--prism-void': '#050911',
    '--prism-bg': '#080d19',
    '--prism-bg-surface': '#111827',
    '--prism-bg-elevated': '#1a2335',
    '--prism-stage': '#0e1524',
    '--prism-stage-edge': 'rgba(255, 255, 255, 0.08)',

    '--prism-text': '#f1f5f9',
    '--prism-text-2': '#cbd5e1',
    '--prism-text-muted': '#94a3b8',
    '--prism-text-ghost': '#64748b',

    /* Text and indicator blue; brand blue #2563eb only reaches 3–3.9:1 as text here. */
    '--prism-primary': '#60a5fa',
    '--prism-primary-fill': '#2563eb',
    '--prism-primary-fill-hover': '#1d4ed8',
    '--prism-on-primary': '#ffffff',
    /* The active switch track: the blue half of the brand light, ending on the fill blue so it holds 3:1 on these surfaces. */
    '--prism-toggle-on': 'linear-gradient(90deg, #078bfa, #2563eb)',
    '--prism-link': 'var(--prism-primary)',
    '--prism-accent': '#a78bfa',

    '--prism-border': '#1f2b3e',
    '--prism-border-strong': '#64748b',

    '--prism-glow': 'rgba(37, 99, 235, 0.18)',
    '--prism-glow-strong': 'rgba(37, 99, 235, 0.35)',

    '--prism-input-bg': 'rgba(148, 163, 184, 0.08)',
    '--prism-dot': 'rgba(96, 165, 250, 0.16)',

    '--prism-success': '#0ae2cb',
    '--prism-warn': '#ffb984',
    '--prism-danger': '#fe6ba6',
    '--prism-success-bg': 'color-mix(in srgb, var(--prism-success) 16%, transparent)',
    '--prism-warn-bg': 'color-mix(in srgb, var(--prism-warn) 16%, transparent)',
    '--prism-danger-bg': 'color-mix(in srgb, var(--prism-danger) 16%, transparent)',
    '--prism-primary-bg': 'color-mix(in srgb, var(--prism-primary) 16%, transparent)',

    '--prism-brand-gradient': BRAND_GRADIENT,
    '--prism-brand-ink': 'var(--prism-brand-gradient)',
    '--prism-brand-glow':
        'radial-gradient(closest-side at 22% 55%, rgba(0, 207, 234, 0.22), transparent), radial-gradient(closest-side at 55% 50%, rgba(36, 75, 255, 0.2), transparent), radial-gradient(closest-side at 85% 50%, rgba(162, 12, 240, 0.18), transparent)',
    '--prism-facet-cyan': '#22d3ee',
    '--prism-facet-blue': '#60a5fa',
    '--prism-facet-violet': '#a78bfa',
    '--prism-facet-magenta': '#e879f9',

    '--prism-shadow-sm': '0 1px 2px rgb(0 0 0 / 35%)',
    '--prism-shadow-md': '0 8px 28px -10px rgb(0 0 0 / 65%)',

    '--prism-measure': '#f632ff',

    ...DEPRECATED_ALIASES
};

export const PRISM_LIGHT_THEME: Record<string, string> = {
    '--prism-code-tag': '#a21caf',
    '--prism-code-attr': '#0e7490',
    '--prism-code-str': '#127a3a',
    '--prism-code-com': '#5b6b80',

    '--prism-void': '#eef2f7',
    '--prism-bg': '#f1f5f9',
    '--prism-bg-surface': '#ffffff',
    '--prism-bg-elevated': '#ffffff',
    '--prism-stage': '#fafbfd',
    '--prism-stage-edge': 'rgba(15, 23, 42, 0.10)',

    '--prism-text': '#0f172a',
    '--prism-text-2': '#334155',
    '--prism-text-muted': '#5b6b80',
    '--prism-text-ghost': '#94a3b8',

    /* Brand blue as fill; the text role takes its hover shade, which holds on tints too. */
    '--prism-primary': '#1d4ed8',
    '--prism-primary-fill': '#2563eb',
    '--prism-primary-fill-hover': '#1d4ed8',
    '--prism-on-primary': '#ffffff',
    /* The active switch track: the blue half of the brand light. */
    '--prism-toggle-on': 'linear-gradient(90deg, #078bfa, #244bff)',
    '--prism-link': 'var(--prism-primary)',
    '--prism-accent': '#7c3aed',

    '--prism-border': '#e2e8f0',
    '--prism-border-strong': '#7b8aa0',

    '--prism-glow': 'rgba(37, 99, 235, 0.12)',
    '--prism-glow-strong': 'rgba(37, 99, 235, 0.25)',

    '--prism-input-bg': 'rgba(15, 23, 42, 0.04)',
    '--prism-dot': 'rgba(37, 99, 235, 0.14)',

    /*
     * Dark text on a tint taken from a vivid shade of the same hue: tinting the
     * dark text colour itself reads olive and wine-red.
     */
    '--prism-success': '#06776a',
    '--prism-warn': '#a05602',
    '--prism-danger': '#8e024d',
    '--prism-success-bg': 'color-mix(in srgb, #0edbc5 14%, transparent)',
    '--prism-warn-bg': 'color-mix(in srgb, #ffa65f 14%, transparent)',
    '--prism-danger-bg': 'color-mix(in srgb, #ff7cad 14%, transparent)',
    '--prism-primary-bg': 'color-mix(in srgb, var(--prism-primary-fill) 10%, transparent)',

    '--prism-brand-gradient': BRAND_GRADIENT,
    /* The same sequence in deeper steps: #00cfea is 1.8:1 on this chrome, an indicator needs 3:1. */
    '--prism-brand-ink': 'linear-gradient(90deg, #0891b2 0%, #2563eb 38%, #6d28d9 68%, #a20cf0 100%)',
    '--prism-brand-glow':
        'radial-gradient(closest-side at 22% 55%, rgba(0, 207, 234, 0.2), transparent), radial-gradient(closest-side at 55% 50%, rgba(36, 75, 255, 0.14), transparent), radial-gradient(closest-side at 85% 50%, rgba(162, 12, 240, 0.14), transparent)',
    '--prism-facet-cyan': '#0891b2',
    '--prism-facet-blue': '#2563eb',
    '--prism-facet-violet': '#7c3aed',
    '--prism-facet-magenta': '#c026d3',

    '--prism-shadow-sm': '0 1px 2px rgb(15 23 42 / 12%)',
    '--prism-shadow-md': '0 10px 30px -12px rgb(15 23 42 / 28%), 0 2px 6px -2px rgb(15 23 42 / 10%)',

    '--prism-measure': '#ca00c1',

    ...DEPRECATED_ALIASES
};

export const PRISM_BASE_TOKENS: Record<string, string> = {
    '--font-sans': "'Inter', system-ui, sans-serif",
    '--font-mono': "'JetBrains Mono', ui-monospace, monospace",

    '--fs-xs': '10px',
    '--fs-sm': '11.5px',
    '--fs-md': '12.5px',
    '--fs-lg': '13.5px',
    '--fs-xl': '15px',
    '--fs-2xl': '22px',

    '--sp-1': '2px',
    '--sp-2': '4px',
    '--sp-3': '8px',
    '--sp-4': '12px',
    '--sp-5': '16px',
    '--sp-6': '24px',
    '--sp-7': '40px',

    '--radius-xs': '3px',
    '--radius-sm': '5px',
    '--radius-md': '7px',
    '--radius-lg': '10px',

    '--ease-default': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--dur-fast': '0.12s',
    '--dur-base': '0.2s',
    '--dur-slow': '0.3s',

    /**
     * One cycle of the brand light in the header: the glow behind the logo
     * swells, a soft light runs along the top edge, then both rest. A consuming
     * app slows it down or holds it still in ng-prism.config.ts:
     *
     *   theme: { '--prism-brand-motion': 'none' }
     *
     * Any value that is not a time (`none`, `0`) leaves the animation without a
     * duration, so the header shows its static look. Under
     * `prefers-reduced-motion: reduce` it stays still regardless.
     */
    '--prism-brand-motion': '24s',

    /**
     * Chrome density. A consuming app compacts or loosens the entire interface
     * with one token in ng-prism.config.ts:
     *
     *   theme: { '--density': '0.8' }
     *
     * The band heights below resolve it on <html>, where every token is set,
     * so a --density on a descendant such as prism-shell doesn't reach them.
     * There is no signal, service or menu behind this.
     */
    '--density': '1',

    '--band-header': 'calc(40px * var(--density))',
    '--band-head': 'calc(36px * var(--density))',
    '--band-rail': 'calc(28px * var(--density))',
    '--band-tabs': 'calc(34px * var(--density))',

    '--prism-void-light': '#f7f5fc',
    '--prism-void-dark': '#07050f',

    /**
     * The text a component inherits on a fixed ground: `light` and
     * `transparent` set the first, `dark` the second. They are the themes' own
     * text colours, kept as tokens of their own because the grounds do not
     * follow the theme, and a project that retunes a ground retunes its text
     * with it, to 4.5:1 on that ground.
     */
    '--prism-void-light-text': '#0f172a',
    '--prism-void-dark-text': '#f1f5f9',

    /**
     * What the canvas draws on a fixed ground besides the component: the
     * measurement (line, grips, label, the pin row's chips) and the surface,
     * text, contours and active tool of the tool rail, the pills, the pin row
     * and the rulers. `light` and `transparent` read the first set, `dark` the
     * second, in both themes. A project whose ground is a mid-tone sets all of
     * a ground's tokens together, since each is held against the ground or
     * against `-overlay-bg`:
     *
     *   theme: { '--prism-void-dark': '#005fe3', '--prism-void-dark-measure': '#ffffff', ... }
     *
     * `-overlay-fg`, `-overlay-muted` and `-overlay-primary` need 4.5:1 on
     * `-overlay-bg`, `-overlay-border` 3:1, `-measure` 4.5:1 on the ground and
     * on `-overlay-bg`. The active tool's tint is mixed from `-overlay-primary`.
     * The simulation of forced colors paints fixed values of its own, so these
     * do not reach it.
     */
    '--prism-void-light-measure': '#ca00c1',
    '--prism-void-light-overlay-bg': '#ffffff',
    '--prism-void-light-overlay-fg': '#0f172a',
    '--prism-void-light-overlay-muted': '#334155',
    '--prism-void-light-overlay-border': '#7b8aa0',
    '--prism-void-light-overlay-primary': '#1d4ed8',
    '--prism-void-dark-measure': '#f632ff',
    '--prism-void-dark-overlay-bg': '#1a2335',
    '--prism-void-dark-overlay-fg': '#f1f5f9',
    '--prism-void-dark-overlay-muted': '#cbd5e1',
    '--prism-void-dark-overlay-border': '#64748b',
    '--prism-void-dark-overlay-primary': '#60a5fa',

    '--prism-text-light': '#f1f5f9',

    /**
     * Kept as an alias rather than removed: it is exported through
     * PRISM_BASE_TOKENS, so a consuming stylesheet may reference it even though
     * nothing inside this package does.
     */
    '--prism-header-height': 'var(--band-header)',

    '--prism-font-sans': 'var(--font-sans)',
    '--prism-font-mono': 'var(--font-mono)'
};

export const PRISM_DEFAULT_THEME = PRISM_DARK_THEME;
