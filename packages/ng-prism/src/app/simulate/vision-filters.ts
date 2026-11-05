import type { VisionSetting } from './simulation.js';

/** The settings that are a colour matrix; `none` and `blurred` are not. */
export type VisionMatrix = Exclude<VisionSetting, 'none' | 'blurred'>;

// Machado, Oliveira and Fernandes (2009), severity 1.0, for `feColorMatrix`:
// three rows of three, each with the two zeros of the offset and the
// multiplier of alpha, and the row that leaves alpha as it is. They are
// defined for linear RGB, so the filters say `linearRGB`. Achromatopsia is
// the luminance of Rec. 709 in every row.
export const VISION_MATRICES: Readonly<Record<VisionMatrix, string>> = {
    protanopia: '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0',
    deuteranopia: '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0',
    tritanopia: '1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0',
    achromatopsia: '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0'
};

/** The radius of the blur that stands for low vision. */
export const VISION_BLUR = '1.5px';

/** The `id` of the `<filter>` for `v` in `<prism-vision-filters />`; prefixed so that it cannot clash with an id of the shown component. */
export function visionFilterId(v: VisionMatrix): string {
    return `prism-vision-${v}`;
}

/** The value of `filter` for the setting, or `null` for none. */
export function visionFilter(v: VisionSetting): string | null {
    if (v === 'none') return null;
    if (v === 'blurred') return `blur(${VISION_BLUR})`;

    return `url(#${visionFilterId(v)})`;
}
