import { SIM_SCOPE_ATTR } from './scope-selector.js';

/**
 * What the simulation puts on a scope root: the shown component's host element
 * in the canvas or an Overview cell, and the CDK overlay container. The
 * rewritten stylesheets reach the scope through {@link SIM_SCOPE_ATTR}; what
 * a stylesheet cannot say goes on the root itself.
 */
export interface ScopeRootState {
    /** `color-scheme` on the root: the emulated scheme, or the palette forced colors are approximated in. `null` sets none. */
    colorScheme: 'light' | 'dark' | null;
    /** `filter` on the root, which draws the vision simulation. `null` sets none. */
    filter: string | null;
    /** The class or classes, separated by spaces, that the `colorScheme` config names for the emulated scheme. */
    themeClass: string | null;
    /** The attributes that the `colorScheme` config names for the emulated scheme. */
    themeAttributes: Readonly<Record<string, string>>;
}

/** What {@link applyScopeRoot} changed on an element, so that it takes back exactly that. */
interface Applied {
    state: ScopeRootState | null;
    /** Inline style properties it set, with the value each had before (`''` for none). */
    styles: Map<string, string>;
    /** Classes it added. One the element had already is not among them, so it stays. */
    classes: Set<string>;
    /** Attributes it set, with the value each had before (`null` for none). */
    attributes: Map<string, string | null>;
}

const applied = new WeakMap<HTMLElement, Applied>();

/** Whether two states put the same on a root; `null` is no scope root. */
export function sameScopeRoot(a: ScopeRootState | null, b: ScopeRootState | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;

    const names = Object.keys(a.themeAttributes);

    return (
        a.colorScheme === b.colorScheme &&
        a.filter === b.filter &&
        a.themeClass === b.themeClass &&
        names.length === Object.keys(b.themeAttributes).length &&
        names.every((name) => a.themeAttributes[name] === b.themeAttributes[name])
    );
}

/**
 * Makes `el` a scope root with `next`, or no scope root for `null`.
 *
 * Remembers per element what it set and what was there before, and takes back
 * only that: a class the component had already stays, an attribute or an
 * inline style it had gets its value back. Moving from one state to the next
 * changes only what differs, and the state applied already changes nothing.
 */
export function applyScopeRoot(el: HTMLElement, next: ScopeRootState | null): void {
    const record: Applied = applied.get(el) ?? { state: null, styles: new Map(), classes: new Set(), attributes: new Map() };

    if (sameScopeRoot(record.state, next)) return;

    const styles = new Map<string, string>();

    if (next?.colorScheme) styles.set('color-scheme', next.colorScheme);
    if (next?.filter) styles.set('filter', next.filter);

    syncStyles(el, record.styles, styles);
    syncClasses(el, record.classes, new Set(next?.themeClass?.split(/\s+/).filter(Boolean)));
    // The scope attribute comes last, so that the hook cannot replace it.
    syncAttributes(el, record.attributes, new Map(next ? [...Object.entries(next.themeAttributes), [SIM_SCOPE_ATTR, '']] : []));

    record.state = next;
    if (next) applied.set(el, record);
    else applied.delete(el);
}

function syncStyles(el: HTMLElement, set: Map<string, string>, wanted: ReadonlyMap<string, string>): void {
    for (const [property, before] of set) {
        if (wanted.has(property)) continue;
        if (before === '') el.style.removeProperty(property);
        else el.style.setProperty(property, before);
        set.delete(property);
    }
    for (const [property, value] of wanted) {
        if (!set.has(property)) set.set(property, el.style.getPropertyValue(property));
        if (el.style.getPropertyValue(property) !== value) el.style.setProperty(property, value);
    }
}

function syncClasses(el: HTMLElement, added: Set<string>, wanted: ReadonlySet<string>): void {
    for (const name of added) {
        if (wanted.has(name)) continue;
        el.classList.remove(name);
        added.delete(name);
    }
    for (const name of wanted) {
        if (added.has(name) || el.classList.contains(name)) continue;
        el.classList.add(name);
        added.add(name);
    }
}

function syncAttributes(el: HTMLElement, set: Map<string, string | null>, wanted: ReadonlyMap<string, string>): void {
    for (const [name, before] of set) {
        if (wanted.has(name)) continue;
        if (before === null) el.removeAttribute(name);
        else el.setAttribute(name, before);
        set.delete(name);
    }
    for (const [name, value] of wanted) {
        if (!set.has(name)) set.set(name, el.getAttribute(name));
        if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    }
}
