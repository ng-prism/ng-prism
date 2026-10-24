import { Layout, Rect, Txt, type LayoutProps } from '@revideo/2d';
import { all, easeOutCubic, type ThreadGenerator } from '@revideo/core';
import { FONT_MONO, TEXT } from '../brand.ts';
import { brandGradient } from './brand-paint.ts';
import { Lockup } from './Lockup.tsx';

export interface EndCardProps extends LayoutProps {
    /** The command on the pill, e.g. `ng add @ng-prism/core`. */
    command: string;
}

const COMMAND_SIZE = 46;

/** The closing frame: the ng-prism lockup above the command that installs it, centred. */
export class EndCard extends Layout {
    public constructor({ command, ...props }: EndCardProps) {
        super({ layout: true, direction: 'column', alignItems: 'center', gap: 48, opacity: 0, ...props });
        this.add(<Lockup height={200} />);
        this.add(
            <Rect layout padding={[22, 44]} radius={999} fill="#0d1424" lineWidth={3} stroke={brandGradient(command.length * COMMAND_SIZE * 0.62)}>
                <Txt text={command} fontFamily={FONT_MONO} fontWeight={500} fontSize={COMMAND_SIZE} fill={TEXT.primary} />
            </Rect>
        );
        this.add(<Txt text="github.com/ng-prism/ng-prism" fontFamily={FONT_MONO} fontSize={32} fill={TEXT.muted} />);
    }

    public *show(seconds = 0.6): ThreadGenerator {
        const y = this.position.y();
        this.position.y(y + 40);
        yield* all(this.opacity(1, seconds, easeOutCubic), this.position.y(y, seconds * 1.4, easeOutCubic));
    }
}
