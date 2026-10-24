// The ng-prism brand as the videos use it. Values come from docs/assets/brand/cover.html and the dark theme in
// packages/ng-prism/src/app/theme/prism-default-theme.ts; keep them in step with those two.

export const BG = '#080d19';
export const VOID = '#050911';
export const SURFACE = '#111827';
export const BORDER = '#1f2b3e';

/** The brand gradient, left to right: offset (0 to 1) and colour. */
export const GRADIENT_STOPS: ReadonlyArray<readonly [offset: number, color: string]> = [
    [0, '#00cfea'],
    [0.38, '#078bfa'],
    [0.68, '#244bff'],
    [1, '#a20cf0']
];

/** The radial glows behind the cover: centre in fractions of width and height, radius in fractions of width. */
export const GLOWS: ReadonlyArray<{ x: number; y: number; radius: number; color: string }> = [
    { x: 0.14, y: 0.46, radius: 0.35, color: 'rgba(0, 207, 234, 0.2)' },
    { x: 0.4, y: 0.6, radius: 0.37, color: 'rgba(36, 75, 255, 0.2)' },
    { x: 0.82, y: 0.4, radius: 0.5, color: 'rgba(162, 12, 240, 0.2)' }
];

export const CODE_COLORS = { tag: '#e879f9', attr: '#67e8f9', str: '#86efac', com: '#7c8ba1' } as const;
export const TEXT = { primary: '#f1f5f9', secondary: '#cbd5e1', muted: '#94a3b8' } as const;
export const STATUS = { warn: '#ffb984', danger: '#fe6ba6' } as const;

export const FONT_SANS = 'Inter';
export const FONT_MONO = 'JetBrains Mono';
