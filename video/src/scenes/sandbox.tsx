import { Code, makeScene2D } from '@revideo/2d';
import { all, waitFor } from '@revideo/core';
import { STATUS } from '../brand.ts';
import { BrandBackground } from '../components/BrandBackground.tsx';
import { Caption } from '../components/Caption.tsx';
import { CodeCard } from '../components/CodeCard.tsx';
import { EndCard } from '../components/EndCard.tsx';
import { FileTree } from '../components/FileTree.tsx';
import { ensureFonts } from '../components/fonts.ts';
import { tsHighlighter } from '../components/highlighter.ts';
import { Lockup } from '../components/Lockup.tsx';
import { Recording } from '../components/Recording.tsx';
import { VersionCard } from '../components/VersionCard.tsx';
import type { RecordingInfo } from '../lib/recording-info.ts';
import { cutVariables } from './cut-variables.ts';

Code.defaultHighlighter = tsHighlighter;

/** Every building block for about two seconds, to check them against the brand without a full cut. */
export default makeScene2D('sandbox', function* (view) {
    yield* ensureFonts();
    const { recordings } = cutVariables<{ recordings: Record<string, RecordingInfo> }>();
    view.add(<BrandBackground />);

    const lockup = <Lockup height={180} />;
    view.add(lockup);
    yield* waitFor(1.5);
    lockup.remove();

    const tree = new FileTree({ entries: ['button/', 'button.component.ts', 'button.component.css', 'button.stories.ts'] });
    view.add(tree);
    yield* tree.highlight('button.stories.ts', STATUS.warn);
    yield* waitFor(0.4);
    yield* tree.strike('button.stories.ts');
    yield* tree.drop('button.stories.ts');
    yield* waitFor(0.4);
    tree.remove();

    const card = new CodeCard({
        file: 'button.component.ts',
        code: "@Component({ selector: 'ui-button' })\nexport class ButtonComponent {\n    readonly label = input('Save');\n}"
    });
    view.add(card);
    yield* card.typeTo(
        "@Showcase({\n    title: 'Button',\n    variants: [{ name: 'Primary' }, { name: 'Ghost' }]\n})\n@Component({ selector: 'ui-button' })\nexport class ButtonComponent {\n    readonly label = input('Save');\n}",
        2
    );
    yield* card.highlightLines(0, 3);
    yield* waitFor(0.6);
    yield* card.clearHighlight();
    card.remove();

    const caption = new Caption({ text: 'Every component. **Two files.**' });
    view.add(caption);
    yield* caption.show();
    yield* waitFor(1.2);
    yield* caption.hide();
    caption.remove();

    const reveal = recordings['reveal'];
    if (reveal) {
        const recording = new Recording({ info: reveal, src: `/recordings/${reveal.file}` });
        view.add(recording);
        yield* waitFor(0.6);
        yield* recording.zoomTo('variant-tabs', 2, 1);
        yield* waitFor(0.6);
        yield* recording.reset(0.8);
        recording.remove();
    }

    const version = new VersionCard({ version: '22.7' });
    view.add(version);
    yield* version.show();
    yield* waitFor(1);
    version.remove();

    const end = new EndCard({ command: 'ng add @ng-prism/core' });
    view.add(end);
    yield* all(end.show(), waitFor(2));
});
