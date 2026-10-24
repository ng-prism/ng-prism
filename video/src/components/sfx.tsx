import { Audio, type View2D } from '@revideo/2d';
import { spawn, useTime, waitFor } from '@revideo/core';

export type SfxName = 'type' | 'click' | 'whoosh';

/**
 * Silence at the start of every file in assets/sfx. Revideo's audio mix loses about the first frame of a sound, which
 * took the whole attack of a click and all of a 23 ms key tick; the lead-in is what it loses now, and a cue starts
 * that much earlier.
 */
const LEAD_IN = 0.05;

/** How long each file runs, lead-in included and rounded up: its node stays in the scene until the sound is over. */
const LENGTH: Record<SfxName, number> = { type: 0.1, click: 0.16, whoosh: 0.45 };

/** Default volumes, low enough that the sounds stay in the background (see the volumedetect check of Task 10). */
const VOLUME: Record<SfxName, number> = { type: 0.22, click: 0.4, whoosh: 0.3 };

/**
 * Plays `name` at scene time `atSec` (assets/sfx, served at /sfx). Every cue gets a new Audio node: Revideo mixes one
 * segment per node, from the first to the last frame it plays.
 */
export function cue(view: View2D, name: SfxName, atSec: number, volume = VOLUME[name]): void {
    spawn(function* () {
        yield* waitFor(Math.max(0, atSec - LEAD_IN - useTime()));
        const audio = new Audio({ src: `/sfx/${name}.wav`, play: true, volume });
        view.add(audio);
        // The sound loads asynchronously; waiting here keeps Revideo from collecting the load outside a yield.
        yield audio.toPromise();
        yield* waitFor(LENGTH[name]);
        audio.remove();
    });
}

/** Soft key ticks while code types itself from `atSec` for `seconds`: about every 120 ms, not one per character. */
export function typingCues(view: View2D, atSec: number, seconds: number): void {
    // The uneven step keeps it from sounding like a metronome.
    const steps = [0.11, 0.11, 0.14];
    for (let at = 0, n = 0; at < seconds; at += steps[n++ % steps.length]) cue(view, 'type', atSec + at);
}
