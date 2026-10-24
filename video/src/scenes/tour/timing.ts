import type { Node } from '@revideo/2d';
import { all, easeInOutCubic, useTime, waitFor, type ThreadGenerator } from '@revideo/core';

/** Waits until scene time `t`, so a cut is written against the timeline of the design, not as a sum of waits. */
export function* until(t: number): ThreadGenerator {
    yield* waitFor(Math.max(0, t - useTime()));
}

/** Fades `from` out and `to` in, then removes `from`. */
export function* crossfade(from: Node, to: Node, seconds = 0.4): ThreadGenerator {
    yield* all(from.opacity(0, seconds, easeInOutCubic), to.opacity(1, seconds, easeInOutCubic));
    from.remove();
}
