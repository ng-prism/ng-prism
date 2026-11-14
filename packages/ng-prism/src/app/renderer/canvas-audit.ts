/** Set on `.prism-canvas-stage` while the live a11y audit runs; the renderer's stylesheet drops the stage's pattern for it. */
export const CANVAS_AUDITING_ATTR = 'data-prism-auditing';

/**
 * Runs `run` with everything the canvas draws around `element` hidden: panel
 * overlays (the a11y outline, the box model, any plugin's), the measure tool,
 * the rulers and the stage's dot or checkerboard pattern. axe works out the
 * stacking itself, so an overlay on top of the subject reads as covering its
 * text and a colour-contrast check comes back undecided ("bgOverlap"), as
 * does any text over a background image.
 *
 * Hidden are the siblings of `element` and of each of its ancestors up to the
 * stage, inline and restored afterwards: an overlay sits beside the subject in
 * `.demo-wrap` and measures itself against that parent, so it is not wrapped.
 * What the subject renders itself stays visible, a CDK overlay in `<body>`
 * included (axe audits the subject's subtree, so such an overlay is not
 * audited either way). Synchronous, so the hiding does not wait for change
 * detection, and undone however `run` ends. An element outside a canvas stage
 * is audited as it is.
 */
export async function withCanvasChromeHidden<T>(element: Element, run: () => Promise<T>): Promise<T> {
    const stage = element.closest('.prism-canvas-stage');

    if (!stage) return run();
    const hidden: { el: HTMLElement; visibility: string }[] = [];

    for (let node: Element | null = element; node && node !== stage; node = node.parentElement) {
        for (const sibling of Array.from(node.parentElement?.children ?? [])) {
            if (sibling === node || !(sibling instanceof HTMLElement)) continue;
            hidden.push({ el: sibling, visibility: sibling.style.visibility });
            sibling.style.visibility = 'hidden';
        }
    }
    stage.setAttribute(CANVAS_AUDITING_ATTR, '');
    try {
        return await run();
    } finally {
        stage.removeAttribute(CANVAS_AUDITING_ATTR);
        for (const { el, visibility } of hidden) el.style.visibility = visibility;
    }
}
