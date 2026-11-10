import {
    carriesColor,
    DEPRECATED_SYSTEM_COLORS,
    FORCED_PALETTES,
    isSystemColor,
    keepsSystemColor,
    KEPT_SYSTEM_COLORS,
    rgbChannels,
    substituteSystemColors,
    SYSTEM_COLORS
} from './forced-palette.js';

describe('FORCED_PALETTES', () => {
    it.each(['light', 'dark'] as const)('has a literal value for every system color, %s', (name) => {
        const palette = FORCED_PALETTES[name];

        expect(Object.keys(palette).sort()).toEqual([...SYSTEM_COLORS].sort());
        for (const value of Object.values(palette)) expect(value).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, 0?\.\d+\))$/);
    });

    it('names the system colors in lower case, as they are matched', () => {
        expect(SYSTEM_COLORS).toEqual(expect.arrayContaining(['canvas', 'canvastext', 'highlight', 'buttonborder', 'accentcolortext']));
        for (const name of SYSTEM_COLORS) expect(name).toBe(name.toLowerCase());
    });

    it('leaves out InactiveCaptionText, which Chromium does not remap', () => {
        expect(SYSTEM_COLORS).not.toContain('inactivecaptiontext');
        expect(isSystemColor('InactiveCaptionText')).toBe(false);
    });

    it('holds the colors Chromium does not remap at their normal value', () => {
        for (const name of ['light', 'dark'] as const) {
            expect(FORCED_PALETTES[name]).toMatchObject({
                accentcolor: '#0075ff',
                accentcolortext: '#ffffff',
                selecteditem: '#b3d7ff',
                selecteditemtext: '#000000',
                mark: '#ffff00',
                marktext: '#000000'
            });
        }
    });

    it('gives visited and active links the color of a link', () => {
        for (const name of ['light', 'dark'] as const) {
            expect(FORCED_PALETTES[name].visitedtext).toBe(FORCED_PALETTES[name].linktext);
            expect(FORCED_PALETTES[name].activetext).toBe(FORCED_PALETTES[name].linktext);
        }
    });
});

describe('DEPRECATED_SYSTEM_COLORS and KEPT_SYSTEM_COLORS', () => {
    it('are subsets of SYSTEM_COLORS, in lower case', () => {
        for (const name of [...DEPRECATED_SYSTEM_COLORS, ...KEPT_SYSTEM_COLORS]) expect(SYSTEM_COLORS).toContain(name);
    });

    it('name the deprecated colors, none of the ones of CSS Color 4', () => {
        expect(DEPRECATED_SYSTEM_COLORS).toContain('window');
        expect(DEPRECATED_SYSTEM_COLORS).toContain('background');
        expect(DEPRECATED_SYSTEM_COLORS).not.toContain('canvas');
        expect(DEPRECATED_SYSTEM_COLORS).not.toContain('accentcolor');
    });

    it('leave standing every system color but the two accent colors', () => {
        expect(KEPT_SYSTEM_COLORS.size).toBe(SYSTEM_COLORS.length - 2);
        expect(KEPT_SYSTEM_COLORS).not.toContain('accentcolor');
        expect(KEPT_SYSTEM_COLORS).not.toContain('accentcolortext');
    });
});

describe('substituteSystemColors', () => {
    it('replaces a system color by its value in the palette, whatever its case', () => {
        expect(substituteSystemColors('1px solid ButtonText', 'dark')).toBe('1px solid #ffffff');
        expect(substituteSystemColors('1px solid ButtonText', 'light')).toBe('1px solid #000000');
        expect(substituteSystemColors('HIGHLIGHT', 'light')).toBe('rgba(5, 0, 73, 0.8)');
        expect(substituteSystemColors('highlight', 'dark')).toBe('rgba(0, 230, 255, 0.8)');
    });

    it('replaces every occurrence, inside functions too', () => {
        expect(substituteSystemColors('light-dark(Highlight, Mark)', 'dark')).toBe('light-dark(rgba(0, 230, 255, 0.8), #ffff00)');
        expect(substituteSystemColors('Canvas Canvas', 'dark')).toBe('#000000 #000000');
        expect(substituteSystemColors('0 0 0 1px Field,0 0 0 2px var(--x,CanvasText)', 'light')).toBe('0 0 0 1px #ffffff,0 0 0 2px var(--x,#000000)');
        expect(substituteSystemColors('color-mix(in srgb, Highlight 50%, Canvas)', 'light')).toBe('color-mix(in srgb, rgba(5, 0, 73, 0.8) 50%, #ffffff)');
    });

    it('takes a hyphen, a digit or an underscore for part of the name', () => {
        expect(substituteSystemColors('var(--canvas-bg) canvas-x', 'dark')).toBe('var(--canvas-bg) canvas-x');
        expect(substituteSystemColors('--canvas: Canvas', 'dark')).toBe('--canvas: #000000');
        expect(substituteSystemColors('x-canvas canvas_2 canvas2 2canvas', 'dark')).toBe('x-canvas canvas_2 canvas2 2canvas');
        expect(substituteSystemColors('é-canvas canvasé', 'dark')).toBe('é-canvas canvasé');
    });

    it('leaves a name with an escape alone, as the scanner does elsewhere', () => {
        expect(substituteSystemColors('can\\vas Canvas\\ x', 'dark')).toBe('can\\vas Canvas\\ x');
        expect(substituteSystemColors('\\43 anvas', 'dark')).toBe('\\43 anvas');
    });

    it('skips strings and url()', () => {
        expect(substituteSystemColors('url("Canvas.png") "Field"', 'dark')).toBe('url("Canvas.png") "Field"');
        expect(substituteSystemColors("url('Canvas.png') 'Field' Field", 'dark')).toBe("url('Canvas.png') 'Field' #000000");
        expect(substituteSystemColors('URL(Canvas.png) Canvas', 'dark')).toBe('URL(Canvas.png) #000000');
        expect(substituteSystemColors('url( "a)Canvas" ) Canvas', 'dark')).toBe('url( "a)Canvas" ) #000000');
        expect(substituteSystemColors('"a\\"Canvas" Canvas', 'dark')).toBe('"a\\"Canvas" #000000');
        expect(substituteSystemColors('url(a\\)Canvas) Canvas', 'dark')).toBe('url(a\\)Canvas) #000000');
        expect(substituteSystemColors('"unterminated Canvas', 'dark')).toBe('"unterminated Canvas');
        expect(substituteSystemColors('url(unterminated Canvas', 'dark')).toBe('url(unterminated Canvas');
    });

    it('treats a function that merely ends in url as any other', () => {
        expect(substituteSystemColors('my-url(Canvas) xurl(Canvas)', 'dark')).toBe('my-url(#000000) xurl(#000000)');
    });

    it('leaves a value without a system color as it is', () => {
        expect(substituteSystemColors('', 'dark')).toBe('');
        expect(substituteSystemColors('red var(--x) rgb(0 0 0 / 50%) #fff', 'dark')).toBe('red var(--x) rgb(0 0 0 / 50%) #fff');
    });
});

describe('isSystemColor', () => {
    it('is true for a bare system color in any case, trimmed', () => {
        expect(isSystemColor(' canvastext ')).toBe(true);
        expect(isSystemColor('ButtonBorder')).toBe(true);
        expect(isSystemColor('ACCENTCOLOR')).toBe(true);
    });

    it('is true for light-dark() of two system colors', () => {
        expect(isSystemColor('light-dark(Highlight, Mark)')).toBe(true);
        expect(isSystemColor('LIGHT-DARK( Canvas ,CanvasText )')).toBe(true);
    });

    it('is false for anything else', () => {
        expect(isSystemColor('red')).toBe(false);
        expect(isSystemColor('var(--x)')).toBe(false);
        expect(isSystemColor('')).toBe(false);
        expect(isSystemColor('Canvas Canvas')).toBe(false);
        expect(isSystemColor('canvas-x')).toBe(false);
        expect(isSystemColor('light-dark(Highlight, red)')).toBe(false);
        expect(isSystemColor('light-dark(Highlight)')).toBe(false);
        expect(isSystemColor('color-mix(in srgb, Highlight, Canvas)')).toBe(false);
        expect(isSystemColor('"Canvas"')).toBe(false);
    });

    it('counts the deprecated colors, unless told not to', () => {
        expect(isSystemColor('Background')).toBe(true);
        expect(isSystemColor('Background', { deprecated: true })).toBe(true);
        expect(isSystemColor('background', { deprecated: false })).toBe(false);
        expect(isSystemColor('WindowText', { deprecated: false })).toBe(false);
        expect(isSystemColor('Canvas', { deprecated: false })).toBe(true);
        expect(isSystemColor('light-dark(Canvas, Window)', { deprecated: false })).toBe(false);
        expect(isSystemColor('light-dark(Canvas, CanvasText)', { deprecated: false })).toBe(true);
    });
});

describe('keepsSystemColor', () => {
    it('is true for a system color Chromium leaves standing under forced-color-adjust: auto', () => {
        expect(keepsSystemColor('Highlight')).toBe(true);
        expect(keepsSystemColor(' canvastext ')).toBe(true);
        expect(keepsSystemColor('Mark')).toBe(true);
        expect(keepsSystemColor('light-dark(Highlight, Canvas)')).toBe(true);
    });

    it('is false for the system colors Chromium forces', () => {
        expect(keepsSystemColor('AccentColor')).toBe(false);
        expect(keepsSystemColor('accentcolortext')).toBe(false);
        expect(keepsSystemColor('light-dark(Highlight, AccentColor)')).toBe(false);
    });

    it('is false for anything that is no system color', () => {
        expect(keepsSystemColor('red')).toBe(false);
        expect(keepsSystemColor('var(--x)')).toBe(false);
        expect(keepsSystemColor('InactiveCaptionText')).toBe(false);
        expect(keepsSystemColor('')).toBe(false);
    });

    it('counts the deprecated colors, unless told not to', () => {
        expect(keepsSystemColor('Window')).toBe(true);
        expect(keepsSystemColor('Window', { deprecated: false })).toBe(false);
        expect(keepsSystemColor('Canvas', { deprecated: false })).toBe(true);
        expect(keepsSystemColor('light-dark(Canvas, WindowText)', { deprecated: false })).toBe(false);
    });
});

describe('carriesColor', () => {
    it('is true for the properties that take a color', () => {
        for (const property of [
            'color',
            'background',
            'background-color',
            'background-image',
            'border',
            'border-color',
            'border-top-color',
            'border-inline-start-color',
            'border-block-end',
            'outline',
            'outline-color',
            'text-decoration',
            'text-decoration-color',
            'text-emphasis',
            'text-emphasis-color',
            'column-rule',
            'column-rule-color',
            'box-shadow',
            'text-shadow',
            'caret-color',
            'accent-color',
            'scrollbar-color',
            'fill',
            'stroke',
            'stop-color',
            'flood-color',
            'lighting-color',
            '-webkit-text-fill-color',
            '-webkit-text-stroke',
            '-webkit-text-stroke-color',
            '-webkit-tap-highlight-color',
            'filter'
        ]) {
            expect([property, carriesColor(property)]).toEqual([property, true]);
        }
    });

    it('is false for any other, a custom property included', () => {
        for (const property of [
            'transition',
            'transition-property',
            'will-change',
            'font',
            'font-family',
            'display',
            'content',
            'animation',
            '--tok',
            '--background',
            '--Color'
        ]) {
            expect([property, carriesColor(property)]).toEqual([property, false]);
        }
    });

    it('does not take a property that merely starts like a family for one', () => {
        expect(carriesColor('borderline')).toBe(false);
        expect(carriesColor('outlined')).toBe(false);
        expect(carriesColor('colorful')).toBe(false);
    });

    it('ignores case', () => {
        expect(carriesColor('COLOR')).toBe(true);
        expect(carriesColor('Border-Top-Color')).toBe(true);
        expect(carriesColor('Transition')).toBe(false);
    });
});

describe('rgbChannels', () => {
    it('is the channels of an opaque color as r g b', () => {
        expect(rgbChannels('#ffffff')).toBe('255 255 255');
        expect(rgbChannels('#000000')).toBe('0 0 0');
        expect(rgbChannels('#ff7f00')).toBe('255 127 0');
    });

    it('rejects what is not a six digit hex color', () => {
        expect(() => rgbChannels('rgba(5, 0, 73, 0.8)')).toThrow();
        expect(() => rgbChannels('#fff')).toThrow();
        expect(() => rgbChannels('Canvas')).toThrow();
    });
});
