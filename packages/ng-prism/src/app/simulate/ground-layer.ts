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
 * Moved there, the layer is part of what the stage scrolls over, and it holds
 * the range it was moved into open: a canvas that shrinks while scrolled to
 * its end (zoomed out, another variant, a narrower viewport, a taller stage)
 * would leave the stage scrolled into empty ground, and no scroll event says
 * so. Whenever the stage or `content` (the `.demo-wrap` around the component)
 * changes size, or the content is restyled or ends a transition (a zoom eases
 * its `transform`), the layer goes back to the start for a moment, so the
 * browser clamps the position to the content alone, and that position is
 * published.
 *
 * Returns what takes it back: the listeners and observers go, and the two
 * properties with them.
 */
export function pinGroundLayer(stage: HTMLElement, content: HTMLElement): () => void {
    const publish = (): void => {
        stage.style.setProperty(GROUND_SCROLL_X, `${stage.scrollLeft}px`);
        stage.style.setProperty(GROUND_SCROLL_Y, `${stage.scrollTop}px`);
    };
    // Reading the position after the reset lays the stage out without the layer's reach.
    const clamp = (): void => {
        stage.style.setProperty(GROUND_SCROLL_X, '0px');
        stage.style.setProperty(GROUND_SCROLL_Y, '0px');
        publish();
    };
    // A transition inside the component bubbles up to the content as well.
    const transitionEnded = (event: Event): void => {
        if (event.target === content) clamp();
    };
    const resizes = typeof ResizeObserver === 'function' ? new ResizeObserver(clamp) : null;
    const restyles = typeof MutationObserver === 'function' ? new MutationObserver(clamp) : null;

    clamp();
    stage.addEventListener('scroll', publish, { passive: true });
    content.addEventListener('transitionend', transitionEnded);
    resizes?.observe(stage);
    resizes?.observe(content);
    // The zoom is a custom property in the content's `style`; a transform change resizes nothing.
    restyles?.observe(content, { attributes: true, attributeFilter: ['style'] });

    return () => {
        stage.removeEventListener('scroll', publish);
        content.removeEventListener('transitionend', transitionEnded);
        resizes?.disconnect();
        restyles?.disconnect();
        stage.style.removeProperty(GROUND_SCROLL_X);
        stage.style.removeProperty(GROUND_SCROLL_Y);
    };
}
