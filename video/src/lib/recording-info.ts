// What the scenes know about a recording. Browser-safe: Revideo bundles everything a scene imports, so this module
// must not import Node built-ins (recordings.ts holds the Node side).

/** Device pixels per CSS px of every recording: `width` and `height` of a RecordingInfo are this times the viewport. */
export const RECORDING_SCALE = 2;

/** A rectangle of an element at a moment of a recording, in CSS px of the 1920×1080 viewport; `at` in seconds from the start. */
export interface FocusMark {
    name: string;
    at: number;
    rect: { x: number; y: number; width: number; height: number };
}

export interface RecordingInfo {
    id: string;
    /** File name inside out/recordings/. */
    file: string;
    durationSec: number;
    width: number;
    height: number;
    fps: number;
    focus: FocusMark[];
    /** Seconds from the start at which the shot clicked. */
    clicks: number[];
}

export interface RecordingsManifest {
    sourceHash: string;
    recordedAt: string;
    shots: RecordingInfo[];
}

/** When the shot clicked for the `n`-th time (0-based), so the camera follows the action rather than fixed seconds. */
export function clickAt(info: RecordingInfo, n: number): number {
    const at = info.clicks[n];
    if (at === undefined) throw new Error(`The recording ${info.id} has no click ${n} (it has ${info.clicks.length})`);
    return at;
}

/** When the shot marked the element `name`. */
export function markAt(info: RecordingInfo, name: string): number {
    const mark = info.focus.find((candidate) => candidate.name === name);
    if (!mark) throw new Error(`The recording ${info.id} has no mark "${name}"`);
    return mark.at;
}
