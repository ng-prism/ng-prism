import { Code, makeScene2D, type Node, type View2D } from '@revideo/2d';
import { all, spawn, useTime, waitFor, type ThreadGenerator } from '@revideo/core';
import { BrandBackground } from '../components/BrandBackground.tsx';
import { Caption } from '../components/Caption.tsx';
import { EndCard } from '../components/EndCard.tsx';
import { ensureFonts } from '../components/fonts.ts';
import { tsHighlighter } from '../components/highlighter.ts';
import { cue, typingCues } from '../components/sfx.tsx';
import { SplitBeat } from '../components/SplitBeat.tsx';
import { VersionCard } from '../components/VersionCard.tsx';
import type { RecordingInfo } from '../lib/recording-info.ts';
import { apiTypingSeconds, DEFAULT_API_ZOOM, uiCamera, type ReleaseClip } from '../lib/release.ts';
import { cutVariables } from './cut-variables.ts';
import { recordingBeat } from './tour/beat.tsx';
import { crossfade, until } from './tour/timing.ts';

Code.defaultHighlighter = tsHighlighter;

const VERSION_HOLD = 2;
const END_HOLD = 4;

/**
 * An API beat: the caption first, then the new lines type themselves into the source, and the recording next to it
 * shows what they bring, the camera `zoom` times closer on the first element the shot marked.
 */
function* apiBeat(view: View2D, previous: Node, split: SplitBeat, info: RecordingInfo, caption: string, zoom: number): ThreadGenerator {
    const start = useTime();
    view.add(split);
    const text = new Caption({ text: caption });
    view.add(text);
    yield* crossfade(previous, split, 0.5);
    spawn(text.show());
    yield* until(start + 1.6);
    const typing = apiTypingSeconds(split.addedLines);
    typingCues(view, useTime(), typing);
    yield* split.type(typing);
    yield* split.card.highlightLines(0, split.addedLines - 1, 0.4);
    yield* waitFor(0.6);
    cue(view, 'whoosh', useTime());
    const shown = useTime();
    for (const at of info.clicks) cue(view, 'click', shown + at);
    yield* split.showRecording(0.5);
    const firstMark = info.focus[0];
    if (firstMark) yield* split.recording.zoomTo(firstMark.name, zoom, 1);
    yield* until(shown + info.durationSec - 0.7);
    yield* text.hide();
    text.remove();
    yield* until(shown + info.durationSec - 0.3);
}

/** A release clip from its description (releases/<version>.json): version card, one to three beats, end card. */
export default makeScene2D('release', function* (view) {
    yield* ensureFonts();
    const { clip, code, recordings } = cutVariables<{
        clip: ReleaseClip;
        code: Record<string, { before: string; after: string }>;
        recordings: Record<string, RecordingInfo>;
    }>();
    view.add(<BrandBackground />);
    yield view.toPromise();

    const version = new VersionCard({ version: clip.version });
    view.add(version);
    // The logo is an image: let it load before the card fades in.
    yield version.toPromise();
    yield* version.show();
    yield* waitFor(VERSION_HOLD);

    let previous: Node = version;
    for (const beat of clip.beats) {
        const info = recordings[beat.shot];
        if (beat.kind === 'ui') {
            const ui = recordingBeat(view, previous, { info, caption: beat.caption, camera: uiCamera(info, beat.zoom) });
            yield* ui.run();
            previous = ui.recording;
        } else {
            const { before, after } = code[beat.source];
            const split = new SplitBeat({ info, file: beat.source.split('/').at(-1) ?? beat.source, before, after });
            yield* apiBeat(view, previous, split, info, beat.caption, beat.zoom ?? DEFAULT_API_ZOOM);
            previous = split;
        }
    }

    const end = new EndCard({ command: 'ng update @ng-prism/core' });
    view.add(end);
    // The logo is an image: let it load before the card fades in.
    yield end.toPromise();
    yield* all(previous.opacity(0, 0.5), end.show());
    previous.remove();
    yield* waitFor(END_HOLD);
});
