import { activePanel, canvas, panelTab, stateChip, stateMenuButton } from './locators.ts';
import type { Shot } from './shot.ts';

/**
 * Tour beat "Every state. Every pixel.": the declared states one after the other, then the box model, which draws its
 * overlay for the element under the pointer. ~12 s.
 */
export const states: Shot = {
    id: 'states',
    query: 'component=ButtonComponent&variant=0',
    ready: '.demo-wrap[data-prism-rendered="ButtonComponent:0"]',
    async run({ page, mark, pause, click, move }) {
        await mark('canvas', canvas(page));
        await pause(1400);
        await click(stateMenuButton(page), 800);
        await pause(400);
        await mark('state-chips', page.locator('#prism-tools button.is-rec'));
        for (const name of ['Hover', 'Focus visible', 'Pressed']) {
            await click(stateChip(page, name), 600);
            await pause(1100);
        }
        await page.keyboard.press('Escape');
        await pause(400);
        await click(panelTab(page, 'Box Model'), 900);
        await pause(300);
        const button = await page.locator('ui-button button').boundingBox();
        if (button) await move(button.x + button.width * 0.6, button.y + button.height * 0.55, 800);
        await mark('box-model-panel', activePanel(page));
        await pause(1800);
    }
};
