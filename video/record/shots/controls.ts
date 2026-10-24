import { activePanel, canvas, controlRow, panelTab } from './locators.ts';
import type { Shot } from './shot.ts';

/**
 * Tour beat "Change inputs. See it live.": type a label, switch the variant input, click the button. Every change gets
 * time to land on the canvas before the next one. ~10.5 s.
 */
export const controls: Shot = {
    id: 'controls',
    query: 'component=ButtonComponent&variant=0',
    ready: '.demo-wrap[data-prism-rendered="ButtonComponent:0"]',
    async run({ page, mark, pause, click, type }) {
        await mark('controls-panel', activePanel(page));
        await mark('canvas', canvas(page));
        await pause(1600);
        await click(controlRow(page, 'label').locator('input.ctl-text'), 900);
        await page.keyboard.press('ControlOrMeta+A');
        await type('Ship it', 130);
        await pause(1500);
        await click(controlRow(page, 'variant').locator('button', { hasText: /^\s*ghost\s*$/ }), 1000);
        await pause(1700);
        await click(page.locator('ui-button button'), 1000);
        await page.waitForFunction(() =>
            [...document.querySelectorAll('[role=tablist][aria-label=Panels] [role=tab]')].some((tab) =>
                /^Events.*\d/.test(tab.textContent?.replace(/\s+/g, ' ').trim() ?? '')
            )
        );
        await mark('events-tab', panelTab(page, 'Events'));
        await pause(1900);
    }
};
