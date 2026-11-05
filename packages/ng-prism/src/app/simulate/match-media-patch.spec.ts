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
 * A `matchMedia` that hands out a new list on every call, like the browser's
 * own, and remembers them all: a test can tell "the original object" from "a
 * list of the patch", and count what is left on the browser's lists. Everything
 * is false but `MEDIA_TRUE` until `answer` says otherwise.
 */
class FakeBrowser {
    private readonly created: FakeList[] = [];
    private readonly answers = new Map<string, boolean>([[MEDIA_TRUE, true]]);

    readonly win = {
        matchMedia: (query: string): MediaQueryList => this.original(query)
    };

    /** What the browser answers for `query` itself, the way `original(query)` would. */
    original(query: string): MediaQueryList {
        const list = new FakeList(query, this);

        this.created.push(list);

        return list as unknown as MediaQueryList;
    }

    /** Whether the browser handed out `mql` itself, not a list of the patch. */
    owns(mql: MediaQueryList): boolean {
        return this.created.includes(mql as unknown as FakeList);
    }

    answerFor(query: string): boolean {
        return this.answers.get(query) ?? false;
    }

    /** The browser's answer for `query` changes, and every list for it says so. */
    answer(query: string, matches: boolean): void {
        this.answers.set(query, matches);
        this.fire(query);
    }

    fire(query: string): void {
        for (const list of this.created) if (list.media === query) list.fire();
    }

    /** The change listeners that are on the lists for `query`, or on all of them. */
    listeners(query?: string): number {
        return this.created.filter((list) => query === undefined || list.media === query).reduce((sum, list) => sum + list.listeners.size, 0);
    }
}

/** A `WeakRef` whose targets the test can declare collected. */
function fakeWeakRef(collected: ReadonlySet<unknown>): unknown {
    return class FakeWeakRef<T extends object> {
        constructor(private readonly target: T) {}

        deref(): T | undefined {
            return collected.has(this.target) ? undefined : this.target;
        }
    };
}

describe('patchMatchMedia', () => {
    let browser: FakeBrowser;
    let win: { matchMedia: (query: string) => MediaQueryList };
    let originalFn: (query: string) => MediaQueryList;
    const restores: (() => void)[] = [];

    function replaceGlobal(name: 'WeakRef' | 'FinalizationRegistry', value: unknown): void {
        const globals = globalThis as unknown as Record<string, unknown>;
        const before = globals[name];

        globals[name] = value;
        restores.push(() => (globals[name] = before));
    }

    beforeEach(() => {
        browser = new FakeBrowser();
        win = browser.win;
        originalFn = win.matchMedia;
    });

    afterEach(() => {
        for (const restore of restores.splice(0).reverse()) restore();
    });

    it('answers emulated queries from the emulation, others from the original', () => {
        const patch = patchMatchMedia(win, reduce);

        expect(win.matchMedia(MOTION_QUERY).matches).toBe(true);
        expect(win.matchMedia('(prefers-reduced-motion: no-preference)').matches).toBe(false);
        expect(browser.owns(win.matchMedia('(max-width: 900px)'))).toBe(true);

        patch.uninstall();

        expect(win.matchMedia).toBe(originalFn);
    });

    it('hands out the browser own list for a query that tests no emulatable feature', () => {
        const patch = patchMatchMedia(win, reduce);

        // Width, media type and features nobody emulates are as real as ever.
        expect(browser.owns(win.matchMedia('(max-width: 900px)'))).toBe(true);
        expect(browser.owns(win.matchMedia('(prefers-contrast: more)'))).toBe(true);
        expect(browser.owns(win.matchMedia('print'))).toBe(true);
        expect(browser.owns(win.matchMedia(MOTION_QUERY))).toBe(false);

        patch.uninstall();
    });

    it('wraps a query on an emulatable feature that is not emulated, and answers it for real', () => {
        const patch = patchMatchMedia(win, reduce);
        const dark = win.matchMedia('(prefers-color-scheme: dark)');
        const forced = win.matchMedia('(forced-colors: active)');

        expect(browser.owns(dark)).toBe(false);
        expect(browser.owns(forced)).toBe(false);

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

    it('makes text of the query like the browser does', () => {
        const patch = patchMatchMedia(win, reduce);
        // What an untyped caller may pass.
        const ask = win.matchMedia as (query: unknown) => MediaQueryList;

        expect(() => ask(undefined)).not.toThrow();
        expect(browser.owns(ask(undefined))).toBe(true);
        expect(browser.owns(ask(null))).toBe(true);

        const object = ask({ toString: () => MOTION_QUERY });

        expect(browser.owns(object)).toBe(false);
        expect(object.media).toBe(MOTION_QUERY);
        expect(object.matches).toBe(true);

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

        expect(mql.onchange).toEqual(expect.any(Function));

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
        expect(browser.listeners(MIXED_SETTLED)).toBe(1);

        patch.update({}); // the motion test is the browser's again, and it says no

        expect(seen).toEqual([false]);
        expect(browser.listeners(MIXED_SETTLED)).toBe(0);
        expect(browser.listeners(MIXED_QUERY)).toBe(1);

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
        expect(browser.listeners()).toBe(0);

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

    describe('subscribing to the browser', () => {
        it('adds no listener when a list is only read', () => {
            const patch = patchMatchMedia(win, reduce);

            // A service that asks on every use, say.
            for (let i = 0; i < 3; i++) expect(win.matchMedia(MOTION_QUERY).matches).toBe(true);

            const mql = win.matchMedia(MIXED_QUERY);

            mql.onchange = null;
            mql.addEventListener('click', jest.fn());
            mql.addListener(null);

            expect(browser.listeners()).toBe(0);

            patch.update({});
            patch.update(reduce);

            expect(browser.listeners()).toBe(0);

            patch.uninstall();

            expect(browser.listeners()).toBe(0);
        });

        it('adds one listener per list with the first change listener, however it comes', () => {
            const patch = patchMatchMedia(win, reduce);
            const byEvent = win.matchMedia(MOTION_QUERY);
            const byLegacy = win.matchMedia(MOTION_QUERY);
            const byHandler = win.matchMedia(MOTION_QUERY);

            byEvent.addEventListener('change', jest.fn());
            expect(browser.listeners()).toBe(1);

            byLegacy.addListener(jest.fn());
            expect(browser.listeners()).toBe(2);

            byHandler.onchange = jest.fn();
            expect(browser.listeners()).toBe(3);

            // More listeners on a list that listens already add nothing.
            byEvent.addEventListener('change', jest.fn());
            byEvent.addListener(jest.fn());
            byHandler.onchange = jest.fn();
            expect(browser.listeners()).toBe(3);

            patch.uninstall();
        });

        it('starts a late listener from the current answer, not from the one the list had when it was made', () => {
            const patch = patchMatchMedia(win, reduce);
            const mql = win.matchMedia(MIXED_QUERY);
            const listener = jest.fn();

            browser.answer(MIXED_SETTLED, true); // nobody is listening, and nobody is told
            mql.addEventListener('change', listener);
            browser.answer(MIXED_SETTLED, true); // the same answer again

            expect(listener).not.toHaveBeenCalled();

            patch.uninstall();
        });

        it('leaves no listener on the browser after uninstall', () => {
            const patch = patchMatchMedia(win, reduce);
            const listening = [MOTION_QUERY, MOTION_QUERY, MIXED_QUERY].map((query) => win.matchMedia(query));
            const removed = win.matchMedia(MOTION_QUERY);
            const listener = jest.fn();

            for (const mql of listening) mql.addEventListener('change', jest.fn());

            removed.addEventListener('change', listener);
            removed.removeEventListener('change', listener);

            expect(browser.listeners()).toBe(4);

            // Moving to the lists of other queries leaves nothing behind on the old ones.
            patch.update({});

            expect(browser.listeners()).toBe(4);

            patch.uninstall();

            expect(browser.listeners()).toBe(0);
        });
    });

    describe('lists that nobody holds on to', () => {
        it('are not kept, and the listener on the browser takes itself off when it is told', () => {
            const collected = new Set<unknown>();

            replaceGlobal('WeakRef', fakeWeakRef(collected));
            replaceGlobal('FinalizationRegistry', undefined);

            const patch = patchMatchMedia(win, reduce);
            const kept = win.matchMedia(MOTION_QUERY);
            const dropped = win.matchMedia(MOTION_QUERY);
            const seenByKept: boolean[] = [];
            const seenByDropped = jest.fn();

            kept.addEventListener('change', (event) => seenByKept.push(event.matches));
            dropped.addEventListener('change', seenByDropped);
            collected.add(dropped);

            expect(browser.listeners(MEDIA_TRUE)).toBe(2);

            // The browser's list still notifies, and the listener of the list that is gone takes itself off.
            browser.fire(MEDIA_TRUE);

            expect(browser.listeners(MEDIA_TRUE)).toBe(1);

            // Neither update nor uninstall touches it.
            patch.update({});

            expect(seenByKept).toEqual([false]);
            expect(seenByDropped).not.toHaveBeenCalled();
            expect(browser.listeners(MOTION_QUERY)).toBe(1);

            patch.uninstall();

            expect(browser.listeners()).toBe(0);
        });

        it('lose their listener on update and uninstall, though the browser list never fires', () => {
            const collected = new Set<unknown>();

            replaceGlobal('WeakRef', fakeWeakRef(collected));
            replaceGlobal('FinalizationRegistry', undefined);

            // The settled text of an emulated query is a constant, so the browser never says anything about it.
            const patch = patchMatchMedia(win, reduce);
            const first = win.matchMedia(MOTION_QUERY);
            const second = win.matchMedia(MOTION_QUERY);
            const third = win.matchMedia(MIXED_QUERY);

            for (const mql of [first, second, third]) mql.addEventListener('change', jest.fn());

            expect(browser.listeners()).toBe(3);

            collected.add(first);
            patch.update(reduce);

            expect(browser.listeners()).toBe(2);

            collected.add(second);
            collected.add(third);
            patch.uninstall();

            expect(browser.listeners()).toBe(0);
        });

        it('lose their listener as soon as the registry reports them collected', () => {
            const registered: { target: object; held: unknown }[] = [];
            let report: (held: unknown) => void = () => undefined;

            replaceGlobal(
                'FinalizationRegistry',
                class FakeRegistry {
                    constructor(cleanup: (held: unknown) => void) {
                        report = cleanup;
                    }

                    register(target: object, held: unknown): void {
                        registered.push({ target, held });
                    }
                }
            );

            const patch = patchMatchMedia(win, reduce);
            const mql = win.matchMedia(MOTION_QUERY);

            mql.addEventListener('change', jest.fn());

            expect(browser.listeners()).toBe(1);
            expect(registered).toHaveLength(1);
            expect(registered[0].target).toBe(mql);
            // What the registry holds on to must not be the list, or the list would never be collected.
            expect(registered[0].held).not.toBe(mql);

            report(registered[0].held);

            expect(browser.listeners()).toBe(0);

            // Whatever comes after is as before.
            patch.update({});
            patch.uninstall();

            expect(browser.listeners()).toBe(0);
        });
    });
});
