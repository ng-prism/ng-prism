import type { View2D } from '@revideo/2d';
import { all, easeInOutCubic, spawn, useTime, type ThreadGenerator } from '@revideo/core';
import { STATUS } from '../../brand.ts';
import { Caption } from '../../components/Caption.tsx';
import { CodeCard } from '../../components/CodeCard.tsx';
import { FileTree } from '../../components/FileTree.tsx';
import { typingCues } from '../../components/sfx.tsx';
import type { RecordingInfo } from '../../lib/recording-info.ts';
import type { BeatPlan } from './beat.tsx';
import { until } from './timing.ts';

export const TREE = ['button/', 'button.component.ts', 'button.component.html', 'button.component.css', 'button.stories.ts'];
const STORIES = 'button.stories.ts';
const TYPING_SECONDS = 6;

/** 0:00–0:09: a component with its stories file, the stories file goes, the camera moves into the component. */
export function* treeSegment(view: View2D, card: CodeCard): ThreadGenerator {
    const tree = new FileTree({ entries: TREE, fontSize: 40, opacity: 0 });
    view.add(tree);
    const storiesFile = new Caption({ text: 'Every component gets **a stories file.**' });
    const noStories = new Caption({ text: 'What if it **didn’t need one?**' });
    view.add(storiesFile);
    view.add(noStories);

    yield* tree.opacity(1, 0.6);
    yield* storiesFile.show();
    yield* until(2.2);
    yield* tree.highlight(STORIES, STATUS.warn, 0.5);
    yield* until(4.6);
    yield* storiesFile.hide();
    yield* until(5.0);
    yield* all(tree.strike(STORIES, 0.6), noStories.show());
    yield* tree.drop(STORIES, 0.7);
    yield* until(7.6);
    // Into button.component.ts: the tree grows towards it and gives way to the file's code.
    spawn(function* () {
        yield* until(8.2);
        yield* noStories.hide();
    });
    const target = tree.entryPosition('button.component.ts');
    card.opacity(0);
    view.add(card);
    yield* all(
        tree.scale(2.4, 1.6, easeInOutCubic),
        tree.position(target.scale(-2.4), 1.6, easeInOutCubic),
        tree.opacity(0, 1.6, easeInOutCubic),
        (function* () {
            yield* until(8.7);
            yield* card.opacity(1, 0.6, easeInOutCubic);
        })()
    );
    tree.remove();
    storiesFile.remove();
    noStories.remove();
}

/**
 * 0:09–0:20: @Showcase types itself onto the component to soft key ticks, then stays highlighted long enough to read.
 * 10.3 s from wherever it starts.
 */
export function* codeSegment(view: View2D, card: CodeCard, codeAfter: string, showcaseLines: number): ThreadGenerator {
    const start = useTime();
    const caption = new Caption({ text: 'Annotate the **component itself.**' });
    view.add(caption);
    yield* until(start + 0.2);
    spawn(caption.show());
    yield* until(start + 1.3);
    typingCues(view, start + 1.3, TYPING_SECONDS);
    yield* card.typeTo(codeAfter, TYPING_SECONDS);
    yield* card.highlightLines(0, showcaseLines - 1, 0.5);
    yield* until(start + 10);
    yield* caption.hide();
    caption.remove();
}

/** The code gives way to the styleguide it produces: the camera on the selected component, then on its variants. */
export function revealPlan(info: RecordingInfo): BeatPlan {
    return {
        info,
        caption: 'That’s the **styleguide.**',
        camera: [
            { at: 2.0, mark: 'sidebar-button', scale: 1.7, seconds: 1.3 },
            { at: 5.6, mark: 'variant-tabs', scale: 1.9, seconds: 1.3 },
            { at: 8.3, seconds: 1 }
        ]
    };
}
