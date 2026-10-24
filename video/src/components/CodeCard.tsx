import { Code, lines, Rect, Txt, type RectProps } from '@revideo/2d';
import { DEFAULT, waitFor, type ThreadGenerator } from '@revideo/core';
import { BORDER, FONT_MONO, TEXT, VOID } from '../brand.ts';
import { highlightAsFinished, typingSteps } from '../lib/typing.ts';
import { tsHighlighter } from './highlighter.ts';

export interface CodeCardProps extends RectProps {
    code: string;
    /** The file name on the card's tab, e.g. `button.component.ts`. */
    file?: string;
    fontSize?: number;
}

/** A code panel in the styleguide's dark code colours, with a typing effect. */
export class CodeCard extends Rect {
    public readonly code: Code;

    public constructor({ code, file, fontSize = 30, ...props }: CodeCardProps) {
        super({
            layout: true,
            direction: 'column',
            gap: fontSize * 0.6,
            padding: [fontSize * 1.1, fontSize * 1.4],
            fill: VOID,
            radius: 18,
            stroke: BORDER,
            lineWidth: 2,
            ...props
        });
        if (file) this.add(<Txt text={file} fontFamily={FONT_MONO} fontSize={fontSize * 0.62} fill={TEXT.muted} />);
        this.code = new Code({ code, highlighter: tsHighlighter, fontFamily: FONT_MONO, fontWeight: 500, fontSize, lineHeight: fontSize * 1.5 });
        this.add(this.code);
    }

    /** Types the block that `after` adds to the current code, token by token, in `seconds`. */
    public *typeTo(after: string, seconds: number): ThreadGenerator {
        const steps = typingSteps(this.code.parsed(), after);
        this.code.highlighter(highlightAsFinished(tsHighlighter, after));
        for (const step of steps) {
            this.code.code(step);
            yield* waitFor(seconds / steps.length);
        }
    }

    /** Dims every line but `from`…`to` (0-based, inclusive). */
    public *highlightLines(from: number, to: number, seconds = 0.3): ThreadGenerator {
        yield* this.code.selection(lines(from, to), seconds);
    }

    public *clearHighlight(seconds = 0.3): ThreadGenerator {
        yield* this.code.selection(DEFAULT, seconds);
    }
}
