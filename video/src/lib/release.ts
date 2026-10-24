// A release clip is described per release in releases/<version>.json, not by new scenes. Browser-safe: the release
// scene imports the types and the camera.
import { parseEmphasis } from './emphasis.ts';
import type { RecordingInfo } from './recording-info.ts';

/**
 * One beat of a release clip. A `ui` beat shows its recording with a caption; an `api` beat types the decorator into
 * `source` on the left and plays the recording on the right. `source` is relative to test-workspace/projects/video-lib/src.
 * `zoom` moves the camera onto the first element the shot marked: without it a `ui` beat shows the whole frame and an
 * `api` beat zooms by 1.3.
 */
export type ReleaseBeat = { kind: 'ui'; shot: string; caption: string; zoom?: number } | { kind: 'api'; shot: string; source: string; caption: string; zoom?: number };

export interface ReleaseClip {
    version: string;
    beats: ReleaseBeat[];
}

/**
 * How far a beat may zoom before its recording goes soft: the recordings are 2× the frame, which a `ui` beat shows at
 * full size and an `api` beat at half size.
 */
const MAX_ZOOM: Record<ReleaseBeat['kind'], number> = { ui: 2, api: 4 };

/** The camera zoom of an `api` beat without its own. */
export const DEFAULT_API_ZOOM = 1.3;

/** How long an `api` beat types its decorator: 0.4 s a line, the tour's pace, but at least 1.5 s and at most 5 s. */
export function apiTypingSeconds(addedLines: number): number {
    return Math.min(5, Math.max(1.5, addedLines * 0.4));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Checks a release description; returns it unchanged, or throws with what is wrong. */
export function parseRelease(json: unknown, knownShots: ReadonlySet<string>): ReleaseClip {
    if (!isRecord(json)) throw new Error('A release description is a JSON object');
    if (typeof json.version !== 'string' || !/^\d+\.\d+$/.test(json.version)) throw new Error('Version must look like 22.7');
    if (!Array.isArray(json.beats) || json.beats.length < 1 || json.beats.length > 3) throw new Error('A release clip has 1 to 3 beats');
    json.beats.forEach((beat: unknown, index) => {
        const n = index + 1;
        if (!isRecord(beat)) throw new Error(`Beat ${n} is not an object`);
        if (beat.kind !== 'ui' && beat.kind !== 'api') throw new Error(`Beat ${n} has the unknown kind "${String(beat.kind)}" (ui or api)`);
        if (typeof beat.shot !== 'string' || !knownShots.has(beat.shot)) throw new Error(`Unknown shot "${String(beat.shot)}" in beat ${n}`);
        if (typeof beat.caption !== 'string' || beat.caption.trim() === '') throw new Error(`Beat ${n} needs a caption`);
        // The scene splits the caption the same way; here an odd `**` fails before a browser starts.
        try {
            parseEmphasis(beat.caption);
        } catch (error) {
            throw new Error(`Beat ${n}: ${(error as Error).message}`);
        }
        if (beat.kind === 'api' && (typeof beat.source !== 'string' || beat.source.trim() === '')) throw new Error(`Beat ${n} (api) needs a source`);
        const max = MAX_ZOOM[beat.kind];
        if (beat.zoom !== undefined && !(typeof beat.zoom === 'number' && beat.zoom > 1 && beat.zoom <= max)) {
            throw new Error(`Beat ${n} (${beat.kind}) has the zoom ${String(beat.zoom)}: above 1, at most ${max}`);
        }
    });
    return json as unknown as ReleaseClip;
}

/** A camera move of a beat, as `recordingBeat` takes it. */
export interface BeatCameraMove {
    at: number;
    mark?: string;
    scale?: number;
    seconds: number;
}

/**
 * The camera of a `ui` beat: onto the first element the shot marked while the caption is still being read, back to the
 * whole frame before the beat ends. No camera without a zoom.
 */
export function uiCamera(info: Pick<RecordingInfo, 'id' | 'durationSec' | 'focus'>, zoom: number | undefined): BeatCameraMove[] {
    if (zoom === undefined) return [];
    const first = info.focus[0];
    if (!first) throw new Error(`The recording ${info.id} has no mark to zoom onto`);
    return [
        { at: 0.6, mark: first.name, scale: zoom, seconds: 1 },
        { at: info.durationSec - 1.4, seconds: 0.9 }
    ];
}
