import { VISION_BLUR, VISION_MATRICES, visionFilter, visionFilterId, type VisionMatrix } from './vision-filters.js';

const MATRICES = Object.keys(VISION_MATRICES) as VisionMatrix[];

describe('visionFilter', () => {
    it('is no filter for none, a blur for blurred and the filter reference for a deficiency', () => {
        expect(visionFilter('none')).toBeNull();
        expect(visionFilter('blurred')).toBe('blur(1.5px)');
        expect(visionFilter('blurred')).toBe(`blur(${VISION_BLUR})`);
        expect(visionFilter('protanopia')).toBe('url(#prism-vision-protanopia)');
        expect(visionFilter('deuteranopia')).toBe('url(#prism-vision-deuteranopia)');
        expect(visionFilter('tritanopia')).toBe('url(#prism-vision-tritanopia)');
        expect(visionFilter('achromatopsia')).toBe('url(#prism-vision-achromatopsia)');
    });

    it('references the id the filter markup carries', () => {
        for (const matrix of MATRICES) expect(visionFilter(matrix)).toBe(`url(#${visionFilterId(matrix)})`);
    });
});

describe('visionFilterId', () => {
    it('is prefixed so that it cannot clash with an id of the component', () => {
        expect(visionFilterId('tritanopia')).toBe('prism-vision-tritanopia');
    });
});

describe('VISION_MATRICES', () => {
    it('has one matrix per deficiency, no more', () => {
        expect(MATRICES.sort()).toEqual(['achromatopsia', 'deuteranopia', 'protanopia', 'tritanopia']);
    });

    it('holds 20 values for feColorMatrix, with the exact numbers of Machado et al. (2009)', () => {
        for (const matrix of MATRICES) expect(VISION_MATRICES[matrix].split(/\s+/)).toHaveLength(20);

        expect(VISION_MATRICES.deuteranopia.startsWith('0.367322 0.860646 -0.227968 0 0')).toBe(true);
        expect(VISION_MATRICES.protanopia).toBe('0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0');
        expect(VISION_MATRICES.deuteranopia).toBe('0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0');
        expect(VISION_MATRICES.tritanopia).toBe('1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0');
    });

    it('takes the luminance of Rec. 709 in every row of the achromatopsia matrix', () => {
        expect(VISION_MATRICES.achromatopsia).toBe('0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0');
    });

    it('leaves alpha alone: the last row of every matrix is 0 0 0 1 0', () => {
        for (const matrix of MATRICES) expect(VISION_MATRICES[matrix].endsWith(' 0 0 0 1 0')).toBe(true);
    });

    it('keeps white white: no row of a deficiency matrix tints it by more than rounding', () => {
        for (const matrix of MATRICES) {
            const values = VISION_MATRICES[matrix].split(/\s+/).map(Number);

            for (const row of [0, 1, 2]) {
                const sum = values[row * 5] + values[row * 5 + 1] + values[row * 5 + 2];

                expect(sum).toBeCloseTo(1, 2);
            }
        }
    });
});
