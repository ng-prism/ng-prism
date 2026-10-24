import { Img, type ImgProps } from '@revideo/2d';
import logo from '../../../docs/logo_withtext_big.png';

/** Pixel size of docs/logo_withtext_big.png. */
const LOGO_WIDTH = 895;
const LOGO_HEIGHT = 219;

export interface LockupProps extends Omit<ImgProps, 'src' | 'width' | 'height' | 'size'> {
    /** Height in px; at most the PNG's own 219 px in a 1080p frame, since an enlarged PNG goes soft. */
    height?: number;
}

/** The ng-prism logo with its wordmark, the high-resolution PNG from docs/. */
export function Lockup({ height = LOGO_HEIGHT, ...props }: LockupProps) {
    // Both sizes: with one, Revideo would wait for the image to measure it.
    return <Img src={logo} height={height} width={(height * LOGO_WIDTH) / LOGO_HEIGHT} {...props} />;
}
