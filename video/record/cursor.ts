// Headless Chromium draws no mouse pointer, so the recordings get one: an SVG arrow that follows mousemove.
export const CURSOR_SCRIPT = `
addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;width:22px;height:30px;pointer-events:none;opacity:0;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgb(0 0 0 / 45%))';
    cursor.innerHTML = '<svg viewBox="0 0 22 30" width="22" height="30"><path d="M2 2 L2 24 L8 18.5 L12 27.5 L16 25.8 L12 17 L20 17 Z" fill="#fff" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);
    addEventListener('mousemove', (event) => {
        cursor.style.opacity = '1';
        cursor.style.transform = 'translate(' + (event.clientX - 2) + 'px,' + (event.clientY - 2) + 'px)';
    }, true);
});
`;
