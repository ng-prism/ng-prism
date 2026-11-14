import { CANVAS_BG_STYLES } from '../app/canvas/canvas-bg.styles.js';
import { checkerboardStyle } from './checkerboard.js';

/** The `[data-bg="transparent"]` rule of the canvas, its local square put in where the gradients read it. */
function canvasRule(): string {
    const rule = /\[data-bg="transparent"\]\s*\{([^}]*)\}/.exec(CANVAS_BG_STYLES)![1];
    const square = /--prism-checker-square:\s*([^;]+);/.exec(rule)![1];

    return rule.replaceAll('var(--prism-checker-square)', square).replace(/\s+/g, ' ');
}

describe('checkerboardStyle', () => {
    it('paints the light ground with squares 6% towards ink, in both themes', () => {
        const style = checkerboardStyle();
        const square = 'color-mix(in srgb, var(--prism-void-light, #f7f5fc) 94%, #0f172a)';

        expect(style['background-color']).toBe('var(--prism-void-light, #f7f5fc)');
        expect(style['background-image'].split(square)).toHaveLength(5);
        expect(Object.keys(style).sort()).toEqual(['background-color', 'background-image']);
    });

    // A plugin that shows a capture on it, as the visual regression panel does, shows the board of the canvas.
    it('is the board the canvas draws for transparent', () => {
        const style = checkerboardStyle();

        expect(canvasRule()).toContain(`background-color: ${style['background-color']};`);
        expect(canvasRule()).toContain(`background-image: ${style['background-image']};`);
    });
});
