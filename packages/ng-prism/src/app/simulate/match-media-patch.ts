import { mentionsEmulated, substituteMedia } from './media-condition.js';
import type { EmulatedMedia } from './simulation.js';

/** What the simulation holds on to while the patch is installed. */
export interface MatchMediaPatch {
    /**
     * Switches to another emulation. The lists handed out so far follow it and
     * fire `change` where their answer moved.
     */
    update(emulated: EmulatedMedia): void;
    /**
     * Puts the original `matchMedia` back. The lists handed out so far answer
     * for real from then on and stop firing.
     */
    uninstall(): void;
}

type MatchMedia = (query: string) => MediaQueryList;
type ChangeListener = (this: MediaQueryList, event: MediaQueryListEvent) => unknown;

/** What `deref` gives back is `undefined` once the target was collected. */
interface Ref<T extends object> {
    deref(): T | undefined;
}

// Without `WeakRef` the patch keeps what it handed out until `uninstall`, which
// is only a longer life for the lists, not a different answer.
function weak<T extends object>(target: T): Ref<T> {
    return typeof WeakRef === 'function' ? new WeakRef(target) : { deref: () => target };
}

// Every feature an emulation can take, for asking whether a query tests one of
// them at all. Typed as complete, so that a new feature cannot go without it.
const EMULATABLE: Required<EmulatedMedia> = {
    'prefers-reduced-motion': 'reduce',
    'prefers-color-scheme': 'dark',
    'forced-colors': 'active'
};

/**
 * Makes `win.matchMedia` answer for the emulated features, so component code
 * that asks `matchMedia('(prefers-reduced-motion: reduce)')` sees the same
 * environment as the rewritten stylesheets do.
 *
 * A query that tests any feature an emulation can take gets a list of its own,
 * see {@link EmulatedMediaQueryList}, whether or not that feature is emulated
 * right now: until it is, the list answers what the browser answers, and it
 * fires `change` once an `update` emulates it. Every other query gets the
 * browser's list itself, not a copy: the shell asks `(max-width: 900px)` for its
 * mobile layout and has to keep the real answer, change events included.
 *
 * Only lists asked for while the patch is installed follow it. One that a
 * component got before stays the browser's.
 */
export function patchMatchMedia(win: { matchMedia: MatchMedia }, emulated: EmulatedMedia): MatchMediaPatch {
    const original = win.matchMedia;
    // The browser's `matchMedia` throws when it is called on anything but the window.
    const ask: MatchMedia = (query) => original.call(win, query);
    // What the lists subscribed to, not the lists: one that nobody listens to and
    // nobody holds on to is collected, see {@link Subscription}.
    const handedOut = new Set<Subscription>();
    // Where there is a registry, a collected list leaves the set right away.
    // Elsewhere the next `update` or `uninstall` takes it out.
    const collected = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry<Subscription>((subscription) => handedOut.delete(subscription)) : null;
    let current = emulated;
    let installed = true;

    function each(visit: (list: EmulatedMediaQueryList) => void): void {
        for (const subscription of handedOut) {
            const list = subscription.list;

            if (list) visit(list);
            else handedOut.delete(subscription);
        }
    }

    win.matchMedia = (query) => {
        // Whatever the caller passes, the browser makes text of it, and so does the patch.
        const text = String(query);

        if (!mentionsEmulated(text, EMULATABLE)) return ask(query);

        const list = new EmulatedMediaQueryList(text, ask, current);

        handedOut.add(list.subscription);
        collected?.register(list, list.subscription);

        return list;
    };

    return {
        update(next) {
            if (!installed) return;

            current = next;
            each((list) => list.update(next));
        },
        uninstall() {
            if (!installed) return;

            installed = false;
            win.matchMedia = original;
            // The real answer for the query as asked, once, and then silence.
            each((list) => {
                list.update({});
                list.release();
            });
            handedOut.clear();
        }
    };
}

/**
 * The listener an {@link EmulatedMediaQueryList} has on a browser's list, and
 * what the patch holds of the list.
 *
 * A list that nobody listens to is held weakly: a service that asks on every
 * use drops each list after reading `matches`, and the patch must not keep them
 * all. From its first listener on, the subscription holds the list itself, until
 * `release`. The browser keeps a list alive while it has listeners, and component
 * code relies on it when it keeps only the callback, as in
 * `matchMedia(query).addEventListener('change', cb)`.
 */
class Subscription {
    private real: MediaQueryList | null = null;
    private held: EmulatedMediaQueryList | null = null;
    private readonly listener = (): void => this.held?.refresh();

    constructor(private readonly ref: Ref<EmulatedMediaQueryList>) {}

    /** The list, or `undefined` once it was collected. One that listens is never collected. */
    get list(): EmulatedMediaQueryList | undefined {
        return this.held ?? this.ref.deref();
    }

    get following(): boolean {
        return this.real !== null;
    }

    /** Listens to `real` for `list` from here on instead of what it listened to, and holds `list` until `release`. */
    follow(list: EmulatedMediaQueryList, real: MediaQueryList): void {
        this.real?.removeEventListener('change', this.listener);
        this.held = list;
        this.real = real;
        real.addEventListener('change', this.listener);
    }

    release(): void {
        this.real?.removeEventListener('change', this.listener);
        this.real = null;
        this.held = null;
    }
}

/**
 * A `MediaQueryList` whose answer is the browser's answer for the query with
 * every emulated feature test settled ({@link substituteMedia}). What is not
 * emulated, the width of the viewport for one, stays live: once someone listens,
 * the list follows the `change` events of the browser's list for the settled
 * query and passes them on. When an emulation moves the settled query, it
 * follows the list of the new one.
 *
 * It subscribes lazily. A caller that only reads `matches`, a service that asks
 * on every use, has no use for events, and every subscription is a listener on
 * the browser's list that has to be taken off again.
 */
class EmulatedMediaQueryList extends EventTarget {
    readonly subscription = new Subscription(weak(this));

    private settled: string;
    private real: MediaQueryList;
    // The answer the listeners were last told, which is what decides whether
    // there is a change to tell them about.
    private reported: boolean;
    private handler: ChangeListener | null = null;
    private handlerHooked = false;
    private released = false;

    constructor(
        readonly media: string,
        private readonly ask: MatchMedia,
        emulated: EmulatedMedia
    ) {
        super();
        this.settled = substituteMedia(media, emulated);
        this.real = ask(this.settled);
        this.reported = this.real.matches;
    }

    get matches(): boolean {
        return this.real.matches;
    }

    get onchange(): ChangeListener | null {
        return this.handler;
    }

    set onchange(handler: ChangeListener | null) {
        this.handler = handler;

        // The handler attribute is one more listener, so it is called once per change, like the others.
        if (handler && !this.handlerHooked) {
            this.handlerHooked = true;
            this.addEventListener('change', this.callHandler);
        }
    }

    override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, listener, options);

        if (type === 'change' && listener) this.listen();
    }

    // `null` is a valid argument that does nothing; Node's `EventTarget` warns about it.
    addListener(listener: ChangeListener | null): void {
        if (listener) this.addEventListener('change', listener as EventListener);
    }

    removeListener(listener: ChangeListener | null): void {
        if (listener) this.removeEventListener('change', listener as EventListener);
    }

    /** Answers for `emulated` from here on, and fires `change` if that is another answer. */
    update(emulated: EmulatedMedia): void {
        const settled = substituteMedia(this.media, emulated);

        if (settled !== this.settled) {
            this.settled = settled;
            this.real = this.ask(settled);

            if (this.subscription.following) this.subscription.follow(this, this.real);
        }

        this.refresh();
    }

    /** Fires `change` if the browser's list answers other than what the listeners were last told. */
    refresh(): void {
        const matches = this.real.matches;

        if (matches === this.reported) return;

        this.reported = matches;
        // `MediaQueryListEvent` is not there in every environment, and `matches` and `media` are all a listener reads.
        this.dispatchEvent(Object.assign(new Event('change'), { matches, media: this.media }));
    }

    /** Stops following the browser's list for good. `matches` still reads from it. */
    release(): void {
        this.released = true;
        this.subscription.release();
    }

    private readonly callHandler = (event: Event): void => {
        this.handler?.call(this, event as MediaQueryListEvent);
    };

    private listen(): void {
        if (this.released || this.subscription.following) return;

        // Nobody was told what happened until now, so the first listener starts from the current answer.
        this.reported = this.real.matches;
        this.subscription.follow(this, this.real);
    }
}
