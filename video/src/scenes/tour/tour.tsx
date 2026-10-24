import { Code, makeScene2D } from '@revideo/2d';
import { all, easeInOutCubic, useTime, waitFor } from '@revideo/core';
import { BrandBackground } from '../../components/BrandBackground.tsx';
import { CodeCard } from '../../components/CodeCard.tsx';
import { EndCard } from '../../components/EndCard.tsx';
import { ensureFonts } from '../../components/fonts.ts';
import { tsHighlighter } from '../../components/highlighter.ts';
import { cue } from '../../components/sfx.tsx';
import { clickAt, markAt, type RecordingInfo } from '../../lib/recording-info.ts';
import { codeSegment, revealPlan, treeSegment } from './act1.tsx';
import { cutVariables } from '../cut-variables.ts';
import { recordingBeat } from './beat.tsx';

Code.defaultHighlighter = tsHighlighter;

/** How long the end card stays. */
const END_HOLD = 5;

/**
 * The social cut, storyboard A "Der Vergleich", about 65 s. Act 1 runs on fixed times; the recorded beats follow one
 * another, and their cameras follow the clicks and marks of the recordings, so a new recording keeps them in step.
 */
export default makeScene2D('tour', function* (view) {
    yield* ensureFonts();
    const { codeBefore, codeAfter, showcaseLines, recordings } = cutVariables<{
        codeBefore: string;
        codeAfter: string;
        showcaseLines: number;
        recordings: Record<string, RecordingInfo>;
    }>();
    view.add(<BrandBackground />);
    yield view.toPromise();

    // Act 1: the problem and the answer.
    const card = new CodeCard({ code: codeBefore, file: 'button.component.ts', fontSize: 22, y: -40 });
    yield* treeSegment(view, card);
    yield* codeSegment(view, card, codeAfter, showcaseLines);
    const reveal = recordingBeat(view, card, revealPlan(recordings['reveal']));
    cue(view, 'whoosh', useTime());
    yield* all(card.scale(0.6, 0.6, easeInOutCubic), reveal.run());

    // Act 2: what you get.
    const controlsInfo = recordings['controls'];
    const controls = recordingBeat(view, reveal.recording, {
        info: controlsInfo,
        caption: 'Change inputs. **See it live.**',
        camera: [
            { at: 0.4, mark: 'controls-panel', scale: 1.5, seconds: 1 },
            // Once the variant switch has landed: the whole frame for the click and its event.
            { at: clickAt(controlsInfo, 1) + 0.6, seconds: 1 }
        ]
    });
    yield* controls.run();
    const qualityInfo = recordings['quality'];
    const quality = recordingBeat(view, controls.recording, {
        info: qualityInfo,
        caption: 'A11y, coverage, regressions: **at a glance.**',
        camera: [
            { at: clickAt(qualityInfo, 0) + 0.4, mark: 'a11y-panel', scale: 1.6, seconds: 1 },
            { at: markAt(qualityInfo, 'sidebar-markers'), mark: 'sidebar-markers', scale: 1.9, seconds: 1.1 },
            { at: qualityInfo.durationSec - 1.4, seconds: 0.9 }
        ]
    });
    yield* quality.run();
    const statesInfo = recordings['states'];
    const states = recordingBeat(view, quality.recording, {
        info: statesInfo,
        caption: 'Every state. **Every pixel.**',
        camera: [
            { at: 0.3, mark: 'canvas', scale: 1.25, seconds: 1 },
            // Back to the whole frame before the Box Model tab is clicked (the fifth click).
            { at: clickAt(statesInfo, 4) - 1, seconds: 0.8 }
        ]
    });
    yield* states.run();

    // The end card: the logo and the command that installs it.
    const end = new EndCard({ command: 'ng add @ng-prism/core' });
    view.add(end);
    // The logo is an image: let it load before the card fades in.
    yield end.toPromise();
    yield* all(states.recording.opacity(0, 0.5), end.show());
    states.recording.remove();
    yield* waitFor(END_HOLD);
});
