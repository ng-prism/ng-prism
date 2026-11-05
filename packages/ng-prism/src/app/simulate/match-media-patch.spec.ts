import { patchMatchMedia } from './match-media-patch.js';
import { MEDIA_TRUE } from './media-condition.js';
import type { EmulatedMedia } from './simulation.js';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const reduce: EmulatedMedia = { 'prefers-reduced-motion': 'reduce' };

// A motion test next to a live width test, and what the patch asks the browser instead.
const MIXED_QUERY = `${MOTION_QUERY} and (min-width: 600px)`;
const MIXED_SETTLED = `${MEDIA_TRUE} and (min-width: 600px)`;

type Listener = (event: Event) => void;

/** The browser's list for one query: answers from the browser's table, tells its listeners when the table changes. */
class FakeList {
    readonly listeners = new Set<Listener>();

    constructor(
        readonly media: string,
        private readonly browser: FakeBrowser
    ) {}

    get matches(): boolean {
        return this.browser.answerFor(this.media);
    }

    addEventListener(type: string, listener: Listener): void {
        if (type === 'change') this.listeners.add(listener);
    }

    removeEventListener(type: string, listener: Listener): void {
        if (type === 'change') this.listeners.delete(listener);
    }

    fire(): void {
        const event = Object.assign(new Event('change'), { matches: this.matches, media: this.media });

        for (const listener of Array.from(this.listeners)) listener(event);
    }
}

/**
 * A `matchMedia` with one list per query, like the browser's own, so that a
 * test can tell "the original object" from "a list of the patch". Everything
 * is false but `MEDIA_TRUE` until `answer` says otherwise.
 */
class FakeBrowser {
    private readonly lists = new Map<string, FakeList>();
    private readonly answers = new Map<string, boolean>([[MEDIA_TRUE, true]]);

    readonly win = {
        matchMedia: (query: string): MediaQueryList => this.list(query) as unknown as MediaQueryList
    };

    list(query: string): FakeList {
        let list = this.lists.get(query);

        if (!list) this.lists.set(query, (list = new FakeList(query, this)));

        return list;
    }

    answerFor(query: string): boolean {
        return this.answers.get(query) ?? false;
    }

    /** The browser's answer for `query` changes, and it says so. */
    answer(query: string, matches: boolean): void {
        this.answers.set(query, matches);
        this.list(query).fire();
    }

    /** What the browser answers for `query` itself, the way `original(query)` would. */
    original(query: string): MediaQueryList {
        return this.list(query) as unknown as MediaQueryList;
    }
}

describe('patchMatchMedia', () => {
    let browser: FakeBrowser;
    let win: { matchMedia: (query: string) => MediaQueryList };
    let originalFn: (query: string) => MediaQueryList;
    let restoreWeakRef: (() => void) | null = null;

    beforeEach(() => {
        browser = new FakeBrowser();
        win = browser.win;
        originalFn = win.matchMedia;
    });

    afterEach(() => {
        restoreWeakRef?.();
        restoreWeakRef = null;
    });

    it('answers emulated queries from the emulation, others from the original', () => {
        const patch = patchMatchMedia(win, reduce);

        expect(win.matchMedia(MOTION_QUERY).matches).toBe(true);
        expect(win.matchMedia('(prefers-reduced-motion: no-preference)').matches).toBe(false);
        expect(win.matchMedia('(max-width: 900px)')).toBe(browser.original('(max-width: 900px)'));

        patch.uninstall();

        expect(win.matchMedia).toBe(originalFn);
    });

    it('hands out the browser own list for a query that tests no emulatable feature', () => {
        const patch = patchMatchMedia(win, reduce);

        // Width, media type and features nobody emulates are as real as ever.
        expect(win.matchMedia('(max-width: 900px)')).toBe(browser.original('(max-width: 900px)'));
        expect(win.matchMedia('(prefers-contrast: more)')).toBe(browser.original('(prefers-contrast: more)'));
        expect(win.matchMedia('print')).toBe(browser.original('print'));
        expect(win.matchMedia(MOTION_QUERY)).not.toBe(browser.original(MOTION_QUERY));

        patch.uninstall();
    });

    it('wraps a query on an emulatable feature that is not emulated, and answers it for real', () => {
        const patch = patchMatchMedia(win, reduce);
        const dark = win.matchMedia('(prefers-color-scheme: dark)');
        const forced = win.matchMedia('(forced-colors: active)');

        expect(dark).not.toBe(browser.original('(prefers-color-scheme: dark)'));
        expect(forced).not.toBe(browser.original('(forced-colors: active)'));

        browser.answer('(prefers-color-scheme: dark)', true);

        expect(dark.matches).toBe(true);
        expect(forced.matches).toBe(false);

        patch.uninstall();
    });

    it('asks the original on the window', () => {
        // The browser's own `matchMedia` throws when it is called on anything else.
        const receivers: unknown[] = [];
        const target = {
            matchMedia(this: unknown, query: string): MediaQueryList {
                receivers.push(this);

                return browser.original(query);
            }
        };
        const patch = patchMatchMedia(target, reduce);

        target.matchMedia(MOTION_QUERY);
        target.matchMedia('(max-width: 900px)');

        expect(receivers).toEqual([target, target]);

        patch.uninstall();
    });

    it('hands out an event target that carries the query as asked', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia('( PREFERS-REDUCED-MOTION : reduce )');

        expect(mql).toBeInstanceOf(EventTarget);
        expect(mql.media).toBe('( PREFERS-REDUCED-MOTION : reduce )');
        expect(mql.matches).toBe(true);
        expect(mql.onchange).toBeNull();

        patch.uninstall();
    });

    it('fires change on lists handed out before update and uninstall', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MOTION_QUERY);
        const seen: boolean[] = [];

        mql.addEventListener('change', (event) => seen.push(event.matches));
        mql.onchange = null;

        patch.update({}); // the real answer: false
        patch.update(reduce);
        patch.uninstall();

        expect(seen).toEqual([false, true, false]);
        expect(mql.matches).toBe(false);
    });

    it('builds the change event from matches and media, without MediaQueryListEvent', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MOTION_QUERY);
        const events: Event[] = [];

        mql.addEventListener('change', (event) => events.push(event));
        patch.update({});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('change');
        expect(events[0]).toMatchObject({ matches: false, media: MOTION_QUERY });
        expect(events[0].target).toBe(mql);

        patch.uninstall();
    });

    it('supports the legacy addListener and onchange, each called once per change', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MOTION_QUERY);
        const legacy: boolean[] = [];
        const handler: boolean[] = [];
        const whoseThis: unknown[] = [];

        mql.addListener((event) => legacy.push(event.matches));
        mql.onchange = function (this: MediaQueryList, event) {
            handler.push(event.matches);
            whoseThis.push(this);
        };

        patch.update({});

        expect(legacy).toEqual([false]);
        expect(handler).toEqual([false]);
        expect(whoseThis).toEqual([mql]);

        patch.update(reduce);

        expect(legacy).toEqual([false, true]);
        expect(handler).toEqual([false, true]);

        patch.uninstall();
    });

    it('stops calling a listener that was removed, with either API', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MOTION_QUERY);
        const calls = jest.fn();
        const legacy = jest.fn();
        const unset = jest.fn();

        mql.addEventListener('change', calls);
        mql.addListener(legacy);
        mql.onchange = unset;
        mql.removeEventListener('change', calls);
        mql.removeListener(legacy);
        mql.onchange = null;
        patch.update({});

        expect(calls).not.toHaveBeenCalled();
        expect(legacy).not.toHaveBeenCalled();
        expect(unset).not.toHaveBeenCalled();

        patch.uninstall();
    });

    it('fires nothing while the answer stays', () => {
        const patch = patchMatchMedia(win, { 'prefers-color-scheme': 'dark' });
        const mql = win.matchMedia('(prefers-color-scheme: dark)');
        const listener = jest.fn();

        mql.addEventListener('change', listener);
        // Dark stays dark, and a feature that was not asked about changes.
        patch.update({ 'prefers-color-scheme': 'dark', 'prefers-reduced-motion': 'reduce' });

        expect(listener).not.toHaveBeenCalled();

        patch.update({ 'prefers-color-scheme': 'light' });

        expect(listener).toHaveBeenCalledTimes(1);

        patch.uninstall();
    });

    it('answers a list obtained after update with the new emulation', () => {
        const patch = patchMatchMedia(win, { 'prefers-color-scheme': 'dark' });

        patch.update({ 'prefers-color-scheme': 'light' });

        expect(win.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
        expect(win.matchMedia('(prefers-color-scheme: light)').matches).toBe(true);

        patch.uninstall();
    });

    it('starts emulating a feature that update adds, on lists handed out before', () => {
        const patch = patchMatchMedia(win, reduce);
        const dark = win.matchMedia('(prefers-color-scheme: dark)');
        const seen: boolean[] = [];

        dark.addEventListener('change', (event) => seen.push(event.matches));

        expect(dark.matches).toBe(false); // the browser's answer, as nothing emulates the scheme yet

        patch.update({ 'prefers-reduced-motion': 'reduce', 'prefers-color-scheme': 'dark' });

        expect(dark.matches).toBe(true);
        expect(seen).toEqual([true]);

        patch.uninstall();

        expect(dark.matches).toBe(false);
        expect(seen).toEqual([true, false]);
    });

    it('starts emulating a feature that update adds, on lists asked for after', () => {
        const patch = patchMatchMedia(win, {});

        expect(win.matchMedia(MOTION_QUERY).matches).toBe(false);

        patch.update(reduce);

        expect(win.matchMedia(MOTION_QUERY).matches).toBe(true);

        patch.uninstall();
    });

    it('forwards a change of the live part of the query', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MIXED_QUERY);
        const seen: boolean[] = [];

        mql.addEventListener('change', (event) => seen.push(event.matches));

        expect(mql.matches).toBe(false);

        browser.answer(MIXED_SETTLED, true); // the viewport grew past 600px
        browser.answer(MIXED_SETTLED, false);

        expect(seen).toEqual([true, false]);

        patch.uninstall();
    });

    it('moves to the real list of the new query when update changes it', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MIXED_QUERY);
        const seen: boolean[] = [];

        browser.answer(MIXED_SETTLED, true);
        mql.addEventListener('change', (event) => seen.push(event.matches));

        expect(mql.matches).toBe(true);
        expect(browser.list(MIXED_SETTLED).listeners.size).toBe(1);

        patch.update({}); // the motion test is the browser's again, and it says no

        expect(seen).toEqual([false]);
        expect(browser.list(MIXED_SETTLED).listeners.size).toBe(0);
        expect(browser.list(MIXED_QUERY).listeners.size).toBe(1);

        browser.answer(MIXED_SETTLED, false); // nobody is listening there any more
        browser.answer(MIXED_QUERY, true);

        expect(seen).toEqual([false, true]);
        expect(mql.matches).toBe(true);

        patch.uninstall();
    });

    it('answers for real after uninstall and stops listening', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MIXED_QUERY);
        const listener = jest.fn();

        browser.answer(MIXED_SETTLED, true);
        mql.addEventListener('change', listener);
        patch.uninstall();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0]).toMatchObject({ matches: false });
        expect(browser.list(MIXED_SETTLED).listeners.size).toBe(0);
        expect(browser.list(MIXED_QUERY).listeners.size).toBe(0);

        browser.answer(MIXED_QUERY, true);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(mql.matches).toBe(true); // `matches` is the browser's answer, whenever it is read
    });

    it('does nothing once uninstalled', () => {
        const patch = patchMatchMedia(win, reduce);
        const mql = win.matchMedia(MOTION_QUERY);
        const listener = jest.fn();

        mql.addEventListener('change', listener);
        patch.uninstall();
        listener.mockClear();

        patch.update({});
        patch.update(reduce);
        patch.uninstall();

        expect(listener).not.toHaveBeenCalled();
        expect(win.matchMedia).toBe(originalFn);
    });

    it('does not keep a list that nobody holds on to', () => {
        // A WeakRef whose targets the test can declare collected.
        const collected = new Set<unknown>();

        class FakeWeakRef<T extends object> {
            constructor(private readonly target: T) {}

            deref(): T | undefined {
                return collected.has(this.target) ? undefined : this.target;
            }
        }

        const RealWeakRef = globalThis.WeakRef;

        globalThis.WeakRef = FakeWeakRef as unknown as WeakRefConstructor;
        restoreWeakRef = () => (globalThis.WeakRef = RealWeakRef);

        const patch = patchMatchMedia(win, reduce);
        const kept = win.matchMedia(MOTION_QUERY);
        const dropped = win.matchMedia(MOTION_QUERY);
        const seenByKept: boolean[] = [];
        const seenByDropped = jest.fn();

        kept.addEventListener('change', (event) => seenByKept.push(event.matches));
        dropped.addEventListener('change', seenByDropped);
        collected.add(dropped);

        expect(browser.list(MEDIA_TRUE).listeners.size).toBe(2);

        // The browser's list still notifies, and the listener of the list that is gone takes itself off.
        browser.list(MEDIA_TRUE).fire();

        expect(browser.list(MEDIA_TRUE).listeners.size).toBe(1);

        // Neither update nor uninstall touches it.
        patch.update({});

        expect(seenByKept).toEqual([false]);
        expect(seenByDropped).not.toHaveBeenCalled();
        expect(browser.list(MOTION_QUERY).listeners.size).toBe(1);

        patch.uninstall();

        expect(browser.list(MOTION_QUERY).listeners.size).toBe(0);
    });
});
