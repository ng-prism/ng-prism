/** How far the stage is scrolled sideways, in px, while its ground layer is pinned. */
export const GROUND_SCROLL_X = '--prism-sim-scroll-x';

/** How far the stage is scrolled down, in px, while its ground layer is pinned. */
export const GROUND_SCROLL_Y = '--prism-sim-scroll-y';

/**
 * Keeps the vision ground layer of the Playground's stage over the part of the
 * stage on screen.
 *
 * The layer is positioned in the stage, so it scrolls with the content, while
 * the stage's own background stays where it is: once the canvas is scrolled,
 * the layer would leave the unfiltered background showing. The stylesheet
 * moves it back by {@link GROUND_SCROLL_X} and {@link GROUND_SCROLL_Y}, which
 * this keeps on the stage, so that it covers the scrollport and lines up with
 * the background it copies.
 *
 * Returns what takes it back: the listener goes, and the two properties with it.
 */
export function pinGroundLayer(stage: HTMLElement): () => void {
    const publish = (): void => {
        stage.style.setProperty(GROUND_SCROLL_X, `${stage.scrollLeft}px`);
        stage.style.setProperty(GROUND_SCROLL_Y, `${stage.scrollTop}px`);
    };

    publish();
    stage.addEventListener('scroll', publish, { passive: true });

    return () => {
        stage.removeEventListener('scroll', publish);
        stage.style.removeProperty(GROUND_SCROLL_X);
        stage.style.removeProperty(GROUND_SCROLL_Y);
    };
}
