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
    /**
     * The attributes that the `colorScheme` config names for the emulated
     * scheme. Only names the DOM accepts, and none of {@link RESERVED_ATTRIBUTES}.
     */
    themeAttributes: Readonly<Record<string, string>>;
}

/** Attributes the theme hook cannot set: the scope root manages them itself. Lower case, as an HTML element stores them. */
export const RESERVED_ATTRIBUTES: ReadonlySet<string> = new Set(['class', 'style', SIM_SCOPE_ATTR]);

/** An inline declaration as it was before {@link applyScopeRoot} replaced it; an empty `value` for none. */
interface Inline {
    value: string;
    priority: string;
}

/** What {@link applyScopeRoot} changed on an element, so that it takes back exactly that. */
interface Applied {
    state: ScopeRootState | null;
    /** False while a change is under way, and after one that threw: the next call carries on from what was recorded. */
    settled: boolean;
    /** Inline style properties it set, with the declaration each replaced. */
    styles: Map<string, Inline>;
    /** Classes it added. One the element had already is not among them, so it stays. */
    classes: Set<string>;
    /** Attributes it set, with the value each had before (`null` for none). */
    attributes: Map<string, string | null>;
    /** Whether the element had a `style` and a `class` attribute before the first property or class was set, to drop one that only the simulation created. */
    had: { style?: boolean; class?: boolean };
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
 * inline declaration it had gets its value and priority back, and a `style` or
 * `class` attribute that only the simulation created goes again. Moving from
 * one state to the next changes only what differs, and the state applied
 * already changes nothing.
 *
 * Each change is recorded the moment it is made, so a call that throws halfway
 * leaves nothing behind that a later call cannot take back.
 */
export function applyScopeRoot(el: HTMLElement, next: ScopeRootState | null): void {
    const known = applied.get(el);

    if (known ? known.settled && sameScopeRoot(known.state, next) : next === null) return;

    const record: Applied = known ?? { state: null, settled: false, styles: new Map(), classes: new Set(), attributes: new Map(), had: {} };

    applied.set(el, record);
    record.settled = false;

    const styles = new Map<string, string>();

    if (next?.colorScheme) styles.set('color-scheme', next.colorScheme);
    if (next?.filter) styles.set('filter', next.filter);

    syncStyles(el, record, styles);
    syncClasses(el, record, new Set(next?.themeClass?.split(/\s+/).filter(Boolean)));
    // The scope attribute comes last, so that the hook cannot replace it.
    syncAttributes(el, record.attributes, new Map(next ? [...Object.entries(next.themeAttributes), [SIM_SCOPE_ATTR, '']] : []));

    record.state = next;
    record.settled = true;
    if (!next) applied.delete(el);
}

function syncStyles(el: HTMLElement, record: Applied, wanted: ReadonlyMap<string, string>): void {
    const set = record.styles;
    const releasing = set.size > 0;

    for (const [property, before] of set) {
        if (wanted.has(property)) continue;
        if (before.value === '') el.style.removeProperty(property);
        else el.style.setProperty(property, before.value, before.priority);
        set.delete(property);
    }
    if (releasing && set.size === 0) dropCreated(el, record, 'style');

    for (const [property, value] of wanted) {
        if (!set.has(property)) {
            if (set.size === 0) record.had.style = el.hasAttribute('style');
            set.set(property, { value: el.style.getPropertyValue(property), priority: el.style.getPropertyPriority(property) });
        }
        if (el.style.getPropertyValue(property) !== value || el.style.getPropertyPriority(property) !== '') el.style.setProperty(property, value);
    }
}

function syncClasses(el: HTMLElement, record: Applied, wanted: ReadonlySet<string>): void {
    const added = record.classes;
    const releasing = added.size > 0;

    for (const name of added) {
        if (wanted.has(name)) continue;
        el.classList.remove(name);
        added.delete(name);
    }
    if (releasing && added.size === 0) dropCreated(el, record, 'class');

    for (const name of wanted) {
        if (added.has(name) || el.classList.contains(name)) continue;
        if (added.size === 0) record.had.class = el.hasAttribute('class');
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
        const before = el.getAttribute(name);

        if (before !== value) el.setAttribute(name, value);
        // Only once the attribute is set: a name the DOM rejects throws above and leaves no record to take back.
        if (!set.has(name)) set.set(name, before);
    }
}

/** Removes the `style` or `class` attribute once it is empty, if the simulation created it. */
function dropCreated(el: HTMLElement, record: Applied, name: 'style' | 'class'): void {
    if (record.had[name] === false && el.getAttribute(name)?.trim() === '') el.removeAttribute(name);
    delete record.had[name];
}
