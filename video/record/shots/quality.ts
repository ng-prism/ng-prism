import { activePanel, panelTab } from './locators.ts';
import type { Shot } from './shot.ts';

/**
 * Tour beat "A11y, coverage, regressions: at a glance.": the contrast violation of the Ghost variant, then the sidebar
 * markers. The A11y tab is opened by click after the audit ran: with the panel already open, its focus-order overlay
 * covers the component and axe reports the contrast only as "needs review". ~10 s.
 */
export const quality: Shot = {
    id: 'quality',
    query: 'component=ButtonComponent&variant=1',
    ready: '.demo-wrap[data-prism-rendered="ButtonComponent:1"]',
    async run({ page, mark, pause, click, move }) {
        await pause(1600);
        await click(panelTab(page, 'A11y'), 900);
        await page.getByText('color-contrast', { exact: true }).waitFor();
        await mark('a11y-panel', activePanel(page));
        await pause(2500);
        const flagged = page.locator('button.sb-item:has(.sb-health)');
        await mark('sidebar-markers', flagged);
        for (const marker of await page.locator('.sb-health').all()) {
            const box = await marker.boundingBox();
            if (box) await move(box.x - 6, box.y + box.height / 2, 1000);
            await pause(1200);
        }
        await pause(600);
    }
};
