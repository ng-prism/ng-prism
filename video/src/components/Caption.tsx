import { Gradient, Layout, Node, Rect, Txt, type NodeProps } from '@revideo/2d';
import { all, easeOutCubic, type ThreadGenerator } from '@revideo/core';
import { FONT_SANS, TEXT } from '../brand.ts';
import { parseEmphasis } from '../lib/emphasis.ts';
import { brandGradient } from './brand-paint.ts';

export interface CaptionProps extends NodeProps {
    /** The caption, with `**…**` around the part in the brand gradient. */
    text: string;
    width?: number;
    height?: number;
    fontSize?: number;
}

/** The lower third: a dark scrim and one line of text, its emphasised part filled with the brand gradient. */
export class Caption extends Node {
    private readonly line: Layout;

    public constructor({ text, width = 1920, height = 1080, fontSize = 52, ...props }: CaptionProps) {
        super({ opacity: 0, ...props });
        const scrimHeight = height * 0.3;
        this.add(
            <Rect
                width={width}
                height={scrimHeight}
                y={height / 2 - scrimHeight / 2}
                fill={
                    new Gradient({
                        type: 'linear',
                        from: [0, -scrimHeight / 2],
                        to: [0, scrimHeight / 2],
                        stops: [
                            { offset: 0, color: 'rgba(5, 9, 17, 0)' },
                            { offset: 0.5, color: 'rgba(5, 9, 17, 0.88)' },
                            { offset: 1, color: 'rgba(5, 9, 17, 0.94)' }
                        ]
                    })
                }
            />
        );
        // Spaces at the edge of a Txt collapse in a layout, so the space between the parts is the row's gap.
        this.line = new Layout({ layout: true, direction: 'row', alignItems: 'baseline', gap: fontSize * 0.27, y: height / 2 - height * 0.105 });
        for (const part of parseEmphasis(text)) {
            this.line.add(
                <Txt
                    text={part.text.trim()}
                    fontFamily={FONT_SANS}
                    fontWeight={part.emphasis ? 800 : 700}
                    fontSize={fontSize}
                    letterSpacing={-fontSize * 0.02}
                    fill={part.emphasis ? brandGradient(part.text.length * fontSize * 0.56) : TEXT.primary}
                />
            );
        }
        this.add(this.line);
    }

    public *show(seconds = 0.3): ThreadGenerator {
        this.line.position.y(this.line.position.y() + 14);
        yield* all(this.opacity(1, seconds, easeOutCubic), this.line.position.y(this.line.position.y() - 14, seconds, easeOutCubic));
    }

    public *hide(seconds = 0.3): ThreadGenerator {
        yield* this.opacity(0, seconds);
    }
}
