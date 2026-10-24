import type { Page } from 'playwright';

// The styleguide's selectors the shots share. Panel tabs are named "Label" or "Label, <badge>", hence the prefix match.
export const panelTab = (page: Page, label: string) => page.locator('[role=tablist][aria-label=Panels] [role=tab]', { hasText: new RegExp(`^${label}`) });
export const variantTab = (page: Page, name: string) => page.locator('[role=tablist][aria-label=Variants] [role=tab]', { hasText: name });
export const activePanel = (page: Page) => page.locator('[role=tabpanel].panel-body');
export const canvas = (page: Page) => page.locator('.prism-canvas-stage');
export const controlRow = (page: Page, name: string) => page.locator('.ctl-row', { has: page.locator('.ctl-name', { hasText: new RegExp(`^${name}$`) }) });
export const stateMenuButton = (page: Page) => page.locator('button[aria-label="Canvas, state, zoom and width"]');
export const stateChip = (page: Page, name: string) => page.locator('#prism-tools button[aria-pressed]', { hasText: new RegExp(`^\\s*${name}\\s*$`) });
