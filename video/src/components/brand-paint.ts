import { Gradient } from '@revideo/2d';
import { GRADIENT_STOPS } from '../brand.ts';

/** The brand gradient as a fill, running across `width` px centred on the node. */
export function brandGradient(width: number): Gradient {
    return new Gradient({
        type: 'linear',
        from: [-width / 2, 0],
        to: [width / 2, 0],
        stops: GRADIENT_STOPS.map(([offset, color]) => ({ offset, color }))
    });
}
