import type { Shot } from './shot.ts';

/**
 * Release 22.7 beat "Services and pipes get their own pages.": the API page of NotificationService. It fits the
 * viewport, so the pointer reads it from the generated usage down to the methods instead of scrolling. ~6 s.
 */
export const servicePage: Shot = {
    id: 'service-page',
    query: 'service=NotificationService&view=jsdoc',
    ready: '[data-prism-service-rendered="NotificationService"]',
    async run({ page, mark, pause, move }) {
        // The content column, not the whole page: the page's table of contents would pull the camera off to the right.
        await mark('api-page', page.locator('.prism-jsdoc-api-page__content'));
        await pause(1200);
        const usage = await page.locator('.prism-jsdoc-api-page__usage').boundingBox();
        if (usage) await move(usage.x + usage.width * 0.55, usage.y + usage.height * 0.75, 1000);
        await pause(1400);
        const show = await page.getByText('show()', { exact: true }).first().boundingBox();
        if (show) await move(show.x + show.width + 10, show.y + show.height / 2, 1000);
        await pause(1500);
    }
};
