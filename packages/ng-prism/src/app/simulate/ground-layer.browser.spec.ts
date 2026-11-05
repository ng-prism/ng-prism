import { GROUND_SCROLL_X, GROUND_SCROLL_Y, pinGroundLayer } from './ground-layer.js';

function scrollTo(stage: HTMLElement, left: number, top: number): void {
    stage.scrollLeft = left;
    stage.scrollTop = top;
    stage.dispatchEvent(new Event('scroll'));
}

describe('pinGroundLayer', () => {
    let stage: HTMLElement;

    beforeEach(() => {
        stage = document.createElement('div');
        document.body.appendChild(stage);
    });

    afterEach(() => stage.remove());

    it('publishes where the stage is scrolled to, from the start and on every scroll', () => {
        stage.scrollLeft = 12;
        stage.scrollTop = 30;

        pinGroundLayer(stage);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('12px');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('30px');

        scrollTo(stage, 0, 400);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('0px');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('400px');
    });

    it('stops following the scroll and takes the properties away when released', () => {
        stage.style.setProperty('--zoom', '1');

        const release = pinGroundLayer(stage);

        release();
        expect(stage.style.getPropertyValue(GROUND_SCROLL_X)).toBe('');
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('');
        // What else is inline stays.
        expect(stage.style.getPropertyValue('--zoom')).toBe('1');

        scrollTo(stage, 5, 80);
        expect(stage.style.getPropertyValue(GROUND_SCROLL_Y)).toBe('');
    });
});
