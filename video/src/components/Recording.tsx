import { Rect, Video, type RectProps } from '@revideo/2d';
import { all, easeInOutCubic, type ThreadGenerator } from '@revideo/core';
import { RECORDING_SCALE, type RecordingInfo } from '../lib/recording-info.ts';

export interface RecordingProps extends RectProps {
    info: RecordingInfo;
    /** URL of the recording, e.g. `/recordings/reveal.mp4` (out/public is the public directory). */
    src: string;
    /** Seconds into the recording to start from. */
    startAt?: number;
    width?: number;
    height?: number;
}

/** A recorded shot, filling its frame, with a camera that moves to the elements the shot marked. */
export class Recording extends Rect {
    public readonly video: Video;
    private readonly info: RecordingInfo;

    public constructor({ info, src, startAt = 0, width = 1920, height = 1080, ...props }: RecordingProps) {
        super({ width, height, clip: true, ...props });
        this.info = info;
        this.video = new Video({ src, width, height, decoder: 'web', volume: 0, play: true, time: startAt });
        this.add(this.video);
    }

    /**
     * Zooms by `scale` onto the mark's rectangle. Marks are CSS px of the recorded viewport; the factor to this node's
     * units is its width over the viewport width, so nothing here assumes a frame size.
     */
    public *zoomTo(markName: string, scale: number, seconds: number): ThreadGenerator {
        const mark = this.info.focus.find((candidate) => candidate.name === markName);
        if (!mark) throw new Error(`Recording ${this.info.id} has no mark "${markName}"`);
        const viewportWidth = this.info.width / RECORDING_SCALE;
        const viewportHeight = this.info.height / RECORDING_SCALE;
        const k = this.width() / viewportWidth;
        const x = (mark.rect.x + mark.rect.width / 2 - viewportWidth / 2) * k;
        const y = (mark.rect.y + mark.rect.height / 2 - viewportHeight / 2) * k;
        // Keep the zoomed frame inside the recording: no empty edge may come into view.
        const maxX = (this.width() * (scale - 1)) / 2;
        const maxY = (this.height() * (scale - 1)) / 2;
        const clamp = (value: number, max: number) => Math.min(max, Math.max(-max, value));
        yield* all(this.video.scale(scale, seconds, easeInOutCubic), this.video.position([clamp(-x * scale, maxX), clamp(-y * scale, maxY)], seconds, easeInOutCubic));
    }

    public *reset(seconds: number): ThreadGenerator {
        yield* all(this.video.scale(1, seconds, easeInOutCubic), this.video.position([0, 0], seconds, easeInOutCubic));
    }
}
