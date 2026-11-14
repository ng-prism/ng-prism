import { GROUND_SCROLL_X, GROUND_SCROLL_Y, pinGroundLayer } from './ground-layer.js';

function scrollTo(stage: HTMLElement, left: number, top: number): void {
    stage.scrollLeft = left;
    stage.scrollTop = top;
    stage.dispatchEvent(new Event('scroll'));
}

/** A `transitionend` of `property`, which jsdom has no constructor for. */
function transitionEnd(property: string): Event {
    return Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: property });
}

/**
 * The vertical scroll of a stage as a browser keeps it: the position stays
 * within the range the content holds open, and the ground layer, translated by
 * {@link GROUND_SCROLL_Y}, holds it open as far as it reaches. jsdom has no
 * layout, so `range` stands for what the content gives.
 */
function scrollRange(stage: HTMLElement, range: { content: number }): void {
    let position = 0;

    Object.defineProperty(stage, 'scrollTop', {
        configurable: true,
        get: () => {
            const layer = Number.parseFloat(stage.style.getPropertyValue(GROUND_SCROLL_Y)) || 0;

            position = Math.min(position, Math.max(range.content, layer));
            return position;
        },
        set: (value: number) => {
            position = value;
        }
    });
}

/** The ResizeObserver jsdom lacks: records what it observes, and `resize()` calls back. */
class FakeResizeObserver {
    static last: FakeResizeObserver | null = null;
    readonly observed = new Set<Element>();

    constructor(private readonly callback: () => void) {
        FakeResizeObserver.last = this;
    }

    observe(el: Element): void {
        this.observed.add(el);
    }

    disconnect(): void {
        this.observed.clear();
    }

    resize(): void {
        if (this.observed.size > 0) this.callback();
    }
}

/** The frames requested with `requestAnimationFrame` and not yet run or cancelled. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

/** Runs the frames requested so far, as the browser does before its next paint. */
function runFrame(): void {
    const due = Array.from(frames.values());

    frames.clear();
    for (const callback of due) callback(0);
}

describe('pinGroundLayer', () => {
    let stage: HTMLElement;
    let content: HTMLElement;

    beforeEach(() => {
        stage = document.createElement('div');
        content = document.createElement('div');
        stage.appendChild(content);
        document.body.appendChild(stage);
        Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: FakeResizeObserver });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.set(nextFrame, callback);
            return nextFrame++;
        });
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            frames.delete(id);
        });
    });

    afterEach(() => {
        stage.remove();
        FakeResizeObserver.last = null;
        delete (window as { ResizeObserver?: unknown }).ResizeObserver;
        frames.clear();
        jest.restoreAllMocks();
    });

    it('publishes where the stage is scrolled to, from the start and on every scroll', () => {
        stage.scrollLeft = 12;
        stage.scrollTop = 30;

        pinGroundLayer(stage, content);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('12px');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('30px');

        scrollTo(stage, 0, 400);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('0px');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('400px');
    });

    describe('when the canvas shrinks while scrolled', () => {
        const range = { content: 218 };

        beforeEach(() => {
            range.content = 218;
            scrollRange(stage, range);
            stage.scrollTop = 218;
            pinGroundLayer(stage, content);
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('218px');
            range.content = 0;
        });

        it('stays where it is on a scroll alone: the layer holds the range open', () => {
            stage.dispatchEvent(new Event('scroll'));
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('218px');
        });

        it('lets the stage clamp in the next frame when the stage or the content changes size', () => {
            expect(FakeResizeObserver.last?.observed).toEqual(new Set([stage, content]));

            // Not inside the observer's callback, where the clamp would resize the stage again.
            FakeResizeObserver.last?.resize();
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('218px');

            runFrame();
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('0px');
        });

        it('clamps once for all the changes of size in one frame', () => {
            FakeResizeObserver.last?.resize();
            FakeResizeObserver.last?.resize();
            FakeResizeObserver.last?.resize();
            expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

            runFrame();
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('0px');

            // The next change asks for a frame of its own.
            FakeResizeObserver.last?.resize();
            expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
        });

        it('lets the stage clamp once a zoom has eased the content to its new scale', () => {
            // One inside the component bubbles up to the content, and changes nothing.
            content.appendChild(document.createElement('span')).dispatchEvent(transitionEnd('opacity'));
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('218px');

            content.dispatchEvent(transitionEnd('transform'));
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('0px');
        });

        it('lets the stage clamp when the content is restyled, for a zoom without a transition', async () => {
            content.style.setProperty('--zoom', '1');
            await Promise.resolve();
            expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('0px');
        });
    });

    it('stops following the stage and takes the properties away when released', async () => {
        stage.style.setProperty('--zoom', '1');

        const release = pinGroundLayer(stage, content);

        // A clamp still waiting for its frame goes too.
        FakeResizeObserver.last?.resize();
        expect(frames.size).toBe(1);

        release();
        expect(frames.size).toBe(0);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('');
        // What else is inline stays.
        expect(stage.style.getPropertyValue('--zoom')).toBe('1');
        expect(FakeResizeObserver.last?.observed.size).toBe(0);

        scrollTo(stage, 5, 80);
        content.dispatchEvent(transitionEnd('transform'));
        content.style.setProperty('--zoom', '2');
        await Promise.resolve();
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('');
    });
});
