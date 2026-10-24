import type { Shot } from './shot.ts';

/**
 * The styleguide the code turns into: Button selected, a calm pointer over the sidebar, then the variant tabs. The
 * first seconds stay still, for the caption. ~10 s.
 */
export const reveal: Shot = {
    id: 'reveal',
    query: 'component=ButtonComponent&variant=0',
    ready: '.demo-wrap[data-prism-rendered="ButtonComponent:0"]',
    async run({ page, mark, pause, move }) {
        const sidebarButton = page.locator('button.sb-item.sb-item--active');
        // The tabs themselves: the tablist spans the whole width, its centre is empty header.
        const variantTabs = page.locator('[role=tablist][aria-label=Variants] [role=tab]');
        await mark('sidebar-button', sidebarButton);
        await mark('variant-tabs', variantTabs);
        await pause(2200);
        const item = await sidebarButton.boundingBox();
        if (item) await move(item.x + item.width * 0.7, item.y + item.height / 2, 1700);
        await pause(2000);
        const tab = await variantTabs.first().boundingBox();
        if (tab) await move(tab.x + tab.width / 2, tab.y + tab.height + 14, 1500);
        await pause(2500);
    }
};
