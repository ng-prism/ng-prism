import type { Node, View2D } from '@revideo/2d';
import { spawn, useTime, type ThreadGenerator } from '@revideo/core';
import { Caption } from '../../components/Caption.tsx';
import { Recording } from '../../components/Recording.tsx';
import { cue } from '../../components/sfx.tsx';
import type { RecordingInfo } from '../../lib/recording-info.ts';
import { crossfade, until } from './timing.ts';

/** A camera move at `at` seconds into the recording: onto a mark, or back to the whole frame without one. */
export interface CameraMove {
    at: number;
    mark?: string;
    scale?: number;
    seconds: number;
}

export interface BeatPlan {
    info: RecordingInfo;
    caption: string;
    camera: CameraMove[];
}

/**
 * One recorded beat: the recording crossfades in over `previous` when `run` starts, its caption comes and goes, the
 * camera follows the plan, and every click of the recording clicks audibly. `run` returns shortly before the
 * recording ends, with the recording still on screen for the next beat.
 */
export function recordingBeat(view: View2D, previous: Node, plan: BeatPlan): { readonly recording: Recording; run: () => ThreadGenerator } {
    let recording: Recording | undefined;
    function* run(): ThreadGenerator {
        const start = useTime();
        const end = start + plan.info.durationSec;
        for (const at of plan.info.clicks) cue(view, 'click', start + at);
        // Created here, inside the thread: the video starts loading in its constructor.
        recording = new Recording({ info: plan.info, src: `/recordings/${plan.info.file}`, opacity: 0 });
        view.add(recording);
        const caption = new Caption({ text: plan.caption });
        view.add(caption);
        // The video loads asynchronously; waiting here keeps Revideo from collecting the load outside a yield.
        yield recording.toPromise();
        spawn(crossfade(previous, recording, 0.5));
        spawn(function* () {
            yield* until(start + 0.2);
            yield* caption.show();
            yield* until(end - 0.7);
            yield* caption.hide();
            caption.remove();
        });
        for (const move of plan.camera) {
            yield* until(start + move.at);
            if (move.mark) yield* recording.zoomTo(move.mark, move.scale ?? 1.6, move.seconds);
            else yield* recording.reset(move.seconds);
        }
        yield* until(end - 0.3);
    }
    return {
        get recording() {
            if (!recording) throw new Error(`The beat with ${plan.info.id} has not run yet`);
            return recording;
        },
        run
    };
}
