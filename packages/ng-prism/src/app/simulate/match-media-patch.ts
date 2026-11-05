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

/**
 * Makes `win.matchMedia` answer for the emulated features, so component code
 * that asks `matchMedia('(prefers-reduced-motion: reduce)')` sees the same
 * environment as the rewritten stylesheets do.
 *
 * A query that tests an emulated feature gets a list of its own, see
 * {@link EmulatedMediaQueryList}. Every other query gets the browser's list
 * itself, not a copy: the shell asks `(max-width: 900px)` for its mobile layout
 * and has to keep the real answer, change events included.
 *
 * The decision is made when the list is asked for. A list for a feature the
 * emulation did not cover then is the browser's and stays so.
 */
export function patchMatchMedia(win: { matchMedia: MatchMedia }, emulated: EmulatedMedia): MatchMediaPatch {
    const original = win.matchMedia;
    // The browser's `matchMedia` throws when it is called on anything but the window.
    const ask: MatchMedia = (query) => original.call(win, query);
    // Held weakly: a component that drops its list lets it go. The references of
    // the lists that went are swept by the next `update` or `uninstall`.
    const handedOut = new Set<Ref<EmulatedMediaQueryList>>();
    let current = emulated;
    let installed = true;

    function each(visit: (list: EmulatedMediaQueryList) => void): void {
        for (const ref of handedOut) {
            const list = ref.deref();

            if (list) visit(list);
            else handedOut.delete(ref);
        }
    }

    win.matchMedia = (query) => {
        if (!mentionsEmulated(query, current)) return ask(query);

        const list = new EmulatedMediaQueryList(query, ask, current);

        handedOut.add(weak(list));

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
 * A `MediaQueryList` whose answer is the browser's answer for the query with
 * every emulated feature test settled ({@link substituteMedia}). What is not
 * emulated, the width of the viewport for one, stays live: the list follows the
 * `change` events of the browser's list for the settled query and passes them
 * on. When an emulation moves the settled query, it follows the list of the new
 * one.
 */
class EmulatedMediaQueryList extends EventTarget {
    onchange: ChangeListener | null = null;

    private settled: string;
    private real: MediaQueryList;
    private unfollow: () => void;
    // The answer the listeners were last told, which is what decides whether
    // there is a change to tell them about.
    private reported: boolean;

    constructor(
        readonly media: string,
        private readonly ask: MatchMedia,
        emulated: EmulatedMedia
    ) {
        super();
        this.settled = substituteMedia(media, emulated);
        this.real = ask(this.settled);
        this.reported = this.real.matches;
        this.unfollow = this.follow();
        // The handler attribute is one more listener, so it is called once per change, like the others.
        this.addEventListener('change', (event) => this.onchange?.call(this, event as MediaQueryListEvent));
    }

    get matches(): boolean {
        return this.real.matches;
    }

    addListener(listener: ChangeListener | null): void {
        this.addEventListener('change', listener as EventListener | null);
    }

    removeListener(listener: ChangeListener | null): void {
        this.removeEventListener('change', listener as EventListener | null);
    }

    /** Answers for `emulated` from here on, and fires `change` if that is another answer. */
    update(emulated: EmulatedMedia): void {
        const settled = substituteMedia(this.media, emulated);

        if (settled !== this.settled) {
            this.unfollow();
            this.settled = settled;
            this.real = this.ask(settled);
            this.unfollow = this.follow();
        }

        this.refresh();
    }

    /** Stops following the browser's list. `matches` still reads from it. */
    release(): void {
        this.unfollow();
    }

    private refresh(): void {
        const matches = this.real.matches;

        if (matches === this.reported) return;

        this.reported = matches;
        // `MediaQueryListEvent` is not there in every environment, and `matches` and `media` are all a listener reads.
        this.dispatchEvent(Object.assign(new Event('change'), { matches, media: this.media }));
    }

    /**
     * Subscribes to the current real list and returns the way to cancel. The
     * browser keeps a list alive while it has listeners, so the listener must
     * not hold this list, or the list could never be collected: it holds a weak
     * reference and takes itself off once the list is gone.
     */
    private follow(): () => void {
        const real = this.real;
        const self = weak(this);
        const listener = (): void => {
            const list = self.deref();

            if (list) list.refresh();
            else real.removeEventListener('change', listener);
        };

        real.addEventListener('change', listener);

        return () => real.removeEventListener('change', listener);
    }
}
