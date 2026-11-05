import { computed, effect, Injectable, signal } from '@angular/core';
import { deprecatedTokenNotice } from '../theme/deprecated-tokens.js';
import { FAVICON_SVG_DATA_URI } from '../theme/favicon.js';
import { resolveThemeTokens, type ThemeOverrides } from '../theme/resolve-theme-tokens.js';

const STORAGE_KEY = 'ng-prism-theme';

@Injectable({ providedIn: 'root' })
export class PrismThemeService {
    readonly theme = signal<'dark' | 'light'>(this.readStoredTheme());
    readonly isDark = computed(() => this.theme() === 'dark');

    private readonly overrides = signal<ThemeOverrides>({});

    /** Every token of the active mode, including the user's overrides. */
    readonly appTokens = computed(() => resolveThemeTokens(this.theme(), this.overrides()).tokens);

    /**
     * The dark set, for the header: since 22.7 it is a navy brand band in both
     * themes. Bound as an inline style on the header host, so tokens composed
     * from others (tints, status surfaces) are evaluated there again rather than
     * inherited already resolved against the light theme.
     */
    readonly headerTokens = computed(() => resolveThemeTokens('dark', this.overrides()).tokens);

    private readonly warnedDeprecations = new Set<string>();

    constructor() {
        this.applyFavicon();
        effect(() => {
            const t = this.theme();

            // The styleguide itself reads data-prism-theme only. data-theme stays for consumers that already key on it.
            // data-theme: deprecated since 22.8.0, removed in 23.0.0 — use data-prism-theme
            document.documentElement.dataset['prismTheme'] = t;
            document.documentElement.dataset['theme'] = t;
            localStorage.setItem(STORAGE_KEY, t);
            this.applyTokens();
        });
    }

    toggle(): void {
        this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
    }

    applyConfigOverrides(config: { theme?: Record<string, string>; darkTheme?: Record<string, string>; lightTheme?: Record<string, string> }): void {
        this.overrides.set({ theme: config.theme, darkTheme: config.darkTheme, lightTheme: config.lightTheme });
        this.applyTokens();
    }

    private applyTokens(): void {
        const { tokens, deprecatedOverrides } = resolveThemeTokens(this.theme(), this.overrides());
        const style = document.documentElement.style;

        for (const [key, value] of Object.entries(tokens)) {
            style.setProperty(key, value);
        }
        for (const token of deprecatedOverrides) {
            if (this.warnedDeprecations.has(token)) continue;
            this.warnedDeprecations.add(token);
            console.warn(`[ng-prism] ${deprecatedTokenNotice(token)}`);
        }
    }

    private applyFavicon(): void {
        let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;

        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.type = 'image/svg+xml';
        link.href = FAVICON_SVG_DATA_URI;
    }

    private readStoredTheme(): 'dark' | 'light' {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);

            if (stored === 'light') return 'light';
        } catch {
            // No storage access: fall through to the default theme below.
        }
        return 'dark';
    }
}
