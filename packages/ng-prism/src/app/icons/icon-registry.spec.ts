import { ICON_NAMES, ICONS } from './icon-registry.js';

describe('icon registry', () => {
    it('should carry a dedicated glyph for the measure tool', () => {
        // Dedicated in both senses the rail needs. A `ruler` key has to exist,
        // and it has to draw something of its own: crosshair, move and
        // ruler-dimension are already spoken for by guides, rulers and the
        // viewport width, and a `ruler` holding a copy of any of them would
        // satisfy a bare `toContain` while putting two identical icons side by
        // side on the same rail.
        expect(ICON_NAMES).toContain('ruler');
        expect(ICONS.ruler).toBeTruthy();

        const taken = ['crosshair', 'move', 'ruler-dimension'].map((name) => ICONS[name]);

        expect(taken).not.toContain(ICONS.ruler);
    });

    it('should carry a glyph for the Services section', () => {
        expect(ICON_NAMES).toContain('plug');
        expect(ICONS.plug).toBeTruthy();
    });

    it('should carry a glyph for the Pipes section', () => {
        expect(ICON_NAMES).toContain('pipette');
        expect(ICONS.pipette).toBeTruthy();
    });

    it('should carry a glyph for the navigation toggle on a phone', () => {
        expect(ICON_NAMES).toContain('menu');
        expect(ICONS.menu).toBeTruthy();
    });

    it('should carry a glyph of its own for each pseudo state the tools menu forces', () => {
        // hover, active, focus, focus-visible, focus-within: five chips side by
        // side, so five different drawings.
        const names = ['mouse-pointer', 'mouse-pointer-click', 'scan', 'keyboard', 'box-select'];

        for (const name of names) expect(ICON_NAMES).toContain(name);
        expect(new Set(names.map((name) => ICONS[name])).size).toBe(names.length);
    });
});
