import type { Locator, Page } from 'playwright';

export type { FocusMark } from '../../src/lib/recordings.ts';

/**
 * What a shot drives the page with. All durations are in video time: the recorder slows the page's animations down
 * and scales every wait, so a shot is written as if it ran in real time.
 */
export interface ShotContext {
    page: Page;
    /** Stores where `target` is right now (the rectangle around all its matches), for the camera of the scene that shows this recording. */
    mark(name: string, target: Locator): Promise<void>;
    pause(ms: number): Promise<void>;
    /** Glides the visible pointer to (x, y) in CSS px. */
    move(x: number, y: number, ms: number): Promise<void>;
    /** Glides the pointer to the centre of `target` and clicks there; the click time goes into the manifest. */
    click(target: Locator, ms?: number): Promise<void>;
    /** Types `text` into the focused element, one character every `perCharMs`. */
    type(text: string, perCharMs: number): Promise<void>;
}

export interface Shot {
    id: string;
    /** The query string of the styleguide URL, without `?`. */
    query: string;
    /** Selector that must be present before recording starts. */
    ready: string;
    run(ctx: ShotContext): Promise<void>;
}
