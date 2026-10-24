import { canvas } from './locators.ts';
import type { Shot } from './shot.ts';

/** Release 22.7 beat "A new look. Dark and light.": the theme switches to light and back. ~6.5 s. */
export const look: Shot = {
    id: 'look',
    query: 'component=ButtonComponent&variant=0',
    ready: '.demo-wrap[data-prism-rendered="ButtonComponent:0"]',
    async run({ page, mark, pause, click }) {
        const themeButton = page.locator('button[aria-label^="Switch to"]');
        if ((await themeButton.getAttribute('aria-label')) !== 'Switch to light mode') throw new Error('look must start in dark mode');
        await mark('header', page.locator('prism-header'));
        await mark('canvas', canvas(page));
        await pause(1500);
        await click(themeButton, 900);
        await pause(2400);
        await click(themeButton, 500);
        await pause(1300);
    }
};
