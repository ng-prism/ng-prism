import { Node, type NodeProps } from '@revideo/2d';
import { easeInOutCubic, type ThreadGenerator } from '@revideo/core';
import { BORDER } from '../brand.ts';
import type { RecordingInfo } from '../lib/recording-info.ts';
import { CodeCard } from './CodeCard.tsx';
import { Recording } from './Recording.tsx';

export interface SplitBeatProps extends NodeProps {
    info: RecordingInfo;
    /** The file name on the code card's tab. */
    file: string;
    /** The source without the new lines, then with them. */
    before: string;
    after: string;
}

/**
 * Left and right edge of the content, and the recording's scale: half of 1920×1080 leaves the code card about 800 px,
 * room for an 80-character line (a JSDoc comment, not the decorator, is what makes a card wide).
 */
const EDGE = 920;
const RECORDING_SCALE = 0.5;
const FONT_SIZE = 16;

/**
 * An API beat: the code on the left, the recording on the right. The new lines type themselves into the code, then the
 * recording shows what they do.
 */
export class SplitBeat extends Node {
    public readonly card: CodeCard;
    /** How many lines the typing adds. */
    public readonly addedLines: number;
    private readonly info: RecordingInfo;
    private readonly after: string;
    private shown: Recording | undefined;

    public constructor({ info, file, before, after, ...props }: SplitBeatProps) {
        super({ opacity: 0, ...props });
        this.info = info;
        this.after = after;
        this.addedLines = after.split('\n').length - before.split('\n').length;
        // Anchored at its left edge, so the card grows to the right while lines get longer.
        this.card = new CodeCard({ code: before, file, fontSize: FONT_SIZE, offset: [-1, 0], x: -EDGE, y: -60 });
        this.add(this.card);
    }

    public *type(seconds: number): ThreadGenerator {
        yield* this.card.typeTo(this.after, seconds);
    }

    /** Fades the recording in next to the code. It is created here: a recording plays from the moment it exists. */
    public *showRecording(seconds = 0.5): ThreadGenerator {
        const recording = new Recording({
            info: this.info,
            src: `/recordings/${this.info.file}`,
            offset: [1, 0],
            x: EDGE,
            y: -60,
            scale: RECORDING_SCALE,
            radius: 24,
            stroke: BORDER,
            lineWidth: 4,
            opacity: 0
        });
        this.add(recording);
        this.shown = recording;
        // The video loads asynchronously; waiting here keeps Revideo from collecting the load outside a yield.
        yield recording.toPromise();
        yield* recording.opacity(1, seconds, easeInOutCubic);
    }

    public get recording(): Recording {
        if (!this.shown) throw new Error(`The recording ${this.info.id} has not been shown yet`);
        return this.shown;
    }
}
