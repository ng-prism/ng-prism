import { Layout, Txt, type LayoutProps } from '@revideo/2d';
import { easeOutCubic, type ThreadGenerator } from '@revideo/core';
import { FONT_SANS, TEXT } from '../brand.ts';
import { Lockup } from './Lockup.tsx';

export interface VersionCardProps extends LayoutProps {
    /** The release, e.g. `22.7`. */
    version: string;
}

const SIZE = 120;

/** The opening card of a release clip: "ng-prism 22.7", the lockup followed by the version. */
export class VersionCard extends Layout {
    public constructor({ version, ...props }: VersionCardProps) {
        super({ layout: true, direction: 'row', alignItems: 'center', gap: SIZE * 0.3, opacity: 0, ...props });
        // The logo's wordmark at about the size of the version next to it.
        this.add(<Lockup height={SIZE * 1.6} />);
        this.add(<Txt text={version} fontFamily={FONT_SANS} fontWeight={800} fontSize={SIZE} letterSpacing={-SIZE * 0.045} fill={TEXT.primary} />);
    }

    public *show(seconds = 0.5): ThreadGenerator {
        yield* this.opacity(1, seconds, easeOutCubic);
    }
}
