import { applyScopeRoot, type ScopeRootState } from './scope-root.js';

const DARK: ScopeRootState = { colorScheme: 'dark', filter: 'blur(1.5px)', themeClass: 'tl-dark', themeAttributes: { 'data-mode': 'dark' } };
const BARE: ScopeRootState = { colorScheme: null, filter: null, themeClass: null, themeAttributes: {} };

describe('applyScopeRoot', () => {
    let el: HTMLElement;

    beforeEach(() => {
        el = document.createElement('lib-button');
    });

    it('applies and removes attribute, color-scheme, filter and theme hook', () => {
        applyScopeRoot(el, DARK);
        expect(el.hasAttribute('data-prism-sim')).toBe(true);
        expect(el.style.colorScheme).toBe('dark');
        expect(el.style.filter).toBe('blur(1.5px)');
        expect(el.classList.contains('tl-dark')).toBe(true);
        expect(el.getAttribute('data-mode')).toBe('dark');

        applyScopeRoot(el, null);
        expect(el.hasAttribute('data-prism-sim') || el.classList.contains('tl-dark') || el.hasAttribute('data-mode')).toBe(false);
        expect(el.style.colorScheme).toBe('');
        expect(el.style.filter).toBe('');
        // The `style` and `class` attributes only the simulation created go as well.
        expect(el.attributes).toHaveLength(0);
    });

    it('marks a scope root that sets nothing else', () => {
        applyScopeRoot(el, BARE);
        expect(el.hasAttribute('data-prism-sim')).toBe(true);
        expect(el.getAttribute('style')).toBeNull();
        expect(el.className).toBe('');
    });

    it('keeps a class the component had before', () => {
        el.classList.add('tl-dark');
        applyScopeRoot(el, DARK);
        applyScopeRoot(el, null);
        expect(el.classList.contains('tl-dark')).toBe(true);
    });

    it('gives an attribute and inline styles back the values they had before', () => {
        el.setAttribute('data-mode', 'light');
        el.style.colorScheme = 'light';
        el.style.filter = 'opacity(0.5)';

        applyScopeRoot(el, DARK);
        expect(el.getAttribute('data-mode')).toBe('dark');
        applyScopeRoot(el, null);
        expect(el.getAttribute('data-mode')).toBe('light');
        expect(el.style.colorScheme).toBe('light');
        expect(el.style.filter).toBe('opacity(0.5)');
    });

    it('gives an inline declaration its priority back', () => {
        el.style.setProperty('filter', 'opacity(0.5)', 'important');

        applyScopeRoot(el, DARK);
        expect(el.style.filter).toBe('blur(1.5px)');
        expect(el.style.getPropertyPriority('filter')).toBe('');
        applyScopeRoot(el, null);
        expect(el.style.filter).toBe('opacity(0.5)');
        expect(el.style.getPropertyPriority('filter')).toBe('important');
    });

    it('keeps a style and a class attribute the component had, even when they end up empty', () => {
        el.setAttribute('style', '');
        el.setAttribute('class', '');
        applyScopeRoot(el, DARK);
        applyScopeRoot(el, null);
        expect(el.getAttribute('style')).toBe('');
        expect(el.getAttribute('class')).toBe('');
    });

    it('takes back what a failing apply set before it failed', () => {
        el.classList.add('own');
        const failing: ScopeRootState = { ...DARK, themeAttributes: { 'data mode': 'dark' } };

        expect(() => applyScopeRoot(el, failing)).toThrow();
        // Styles and the class went on before the attribute threw.
        expect(el.style.colorScheme).toBe('dark');
        expect(el.classList.contains('tl-dark')).toBe(true);

        applyScopeRoot(el, null);
        expect(el.outerHTML).toBe('<lib-button class="own"></lib-button>');
    });

    it('does not take a failed apply as done', () => {
        const failing: ScopeRootState = { ...DARK, themeAttributes: { 'data mode': 'dark' } };

        expect(() => applyScopeRoot(el, failing)).toThrow();
        expect(() => applyScopeRoot(el, failing)).toThrow();
        applyScopeRoot(el, DARK);
        expect(el.hasAttribute('data-prism-sim')).toBe(true);
        expect(el.getAttribute('data-mode')).toBe('dark');
        applyScopeRoot(el, null);
        expect(el.attributes).toHaveLength(0);
    });

    it('moves from one state to the next and takes back only what the next one drops', () => {
        el.classList.add('own');
        applyScopeRoot(el, DARK);
        applyScopeRoot(el, { colorScheme: 'light', filter: null, themeClass: 'tl-light', themeAttributes: {} });

        expect(el.style.colorScheme).toBe('light');
        expect(el.style.filter).toBe('');
        expect(Array.from(el.classList)).toEqual(['own', 'tl-light']);
        expect(el.hasAttribute('data-mode')).toBe(false);
        expect(el.hasAttribute('data-prism-sim')).toBe(true);
    });

    it('does nothing for the state it has already applied', () => {
        applyScopeRoot(el, DARK);
        const observer = new MutationObserver(() => undefined);

        observer.observe(el, { attributes: true });
        applyScopeRoot(el, { ...DARK, themeAttributes: { ...DARK.themeAttributes } });
        expect(observer.takeRecords()).toEqual([]);
        observer.disconnect();
    });

    it('adds every class of a list the hook names', () => {
        applyScopeRoot(el, { ...BARE, themeClass: 'theme dark' });
        expect(Array.from(el.classList)).toEqual(['theme', 'dark']);
        applyScopeRoot(el, null);
        expect(el.className).toBe('');
    });

    it('leaves an element alone that it never touched', () => {
        el.classList.add('tl-dark');
        el.setAttribute('data-prism-sim', '');
        applyScopeRoot(el, null);
        expect(el.classList.contains('tl-dark')).toBe(true);
        expect(el.hasAttribute('data-prism-sim')).toBe(true);
    });
});
