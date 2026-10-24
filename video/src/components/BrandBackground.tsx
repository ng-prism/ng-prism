import { Circle, Gradient, Node, Rect, type NodeProps } from '@revideo/2d';
import { BG, GLOWS } from '../brand.ts';
import { brandGradient } from './brand-paint.ts';

export interface BrandBackgroundProps extends NodeProps {
    width?: number;
    height?: number;
    /** The 3 px gradient edge along the bottom, as on the README cover. */
    edge?: boolean;
}

/** The navy ground with the three radial glows of docs/assets/brand/cover.html. */
export class BrandBackground extends Node {
    public constructor({ width = 1920, height = 1080, edge = true, ...props }: BrandBackgroundProps) {
        super(props);
        this.add(<Rect width={width} height={height} fill={BG} />);
        for (const glow of GLOWS) {
            const radius = glow.radius * width;
            this.add(
                <Circle
                    x={(glow.x - 0.5) * width}
                    y={(glow.y - 0.5) * height}
                    size={radius * 2}
                    fill={
                        new Gradient({
                            type: 'radial',
                            fromRadius: 0,
                            toRadius: radius,
                            stops: [
                                { offset: 0, color: glow.color },
                                { offset: 1, color: 'rgba(8, 13, 25, 0)' }
                            ]
                        })
                    }
                />
            );
        }
        if (edge) this.add(<Rect width={width} height={3} y={height / 2 - 1.5} fill={brandGradient(width)} />);
    }
}
