import { activePanel, canvas, controlRow } from './locators.ts';
import type { Shot } from './shot.ts';

/**
 * Release 22.7 beat "Compose real templates. Compiled, not mocked.": the Field variant renders `<input uiInput>` as
 * compiled content. An error typed into the Controls turns the field and the input red together, because the directive
 * reads the field around it. ~6.5 s.
 */
export const composition: Shot = {
    id: 'composition',
    query: 'component=FieldComponent&variant=0',
    ready: '.demo-wrap[data-prism-rendered="FieldComponent:0"]',
    async run({ page, mark, pause, click, type }) {
        if ((await page.locator('ui-field input.ui-input').count()) !== 1) throw new Error('composition: uiInput did not compile into the field');
        const errorRow = controlRow(page, 'error');
        // First, so the camera goes there: the field and the control that changes it.
        await mark('composition', page.locator('ui-field').or(errorRow));
        await mark('canvas', canvas(page));
        await mark('controls-panel', activePanel(page));
        await pause(1600);
        await click(errorRow.locator('input.ctl-text'), 1000);
        await type('Invalid address', 130);
        await pause(1800);
    }
};
