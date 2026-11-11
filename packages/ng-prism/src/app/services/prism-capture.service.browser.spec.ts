import { TestBed } from '@angular/core/testing';
import { CAPTURE_PARAM, parseCaptureParam, PrismCaptureService } from './prism-capture.service.js';

function setSearch(search: string): void {
    window.history.replaceState({}, '', `/${search}`);
}

function captureRules(): CSSStyleRule[] {
    const style = document.getElementById('ng-prism-capture-styles') as HTMLStyleElement | null;
    const sheet = style?.sheet;

    if (!sheet) throw new Error('capture stylesheet not injected');
    return [...sheet.cssRules].filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
}

function createService(): PrismCaptureService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(PrismCaptureService);
}

describe('parseCaptureParam', () => {
    it('should return true for a bare ?capture flag', () => {
        expect(parseCaptureParam('?capture')).toBe(true);
    });

    it('should return true for ?capture=1', () => {
        expect(parseCaptureParam('?capture=1')).toBe(true);
    });

    it('should return true for ?capture=true', () => {
        expect(parseCaptureParam('?capture=true')).toBe(true);
    });

    it('should return false for ?capture=0', () => {
        expect(parseCaptureParam('?capture=0')).toBe(false);
    });

    it('should return false for ?capture=false', () => {
        expect(parseCaptureParam('?capture=false')).toBe(false);
    });

    it('should return false when the parameter is absent', () => {
        expect(parseCaptureParam('?component=ButtonComponent')).toBe(false);
    });

    it('should ignore other parameters when reading the flag', () => {
        expect(parseCaptureParam('?component=ButtonComponent&capture=1&variant=2')).toBe(true);
    });
});

describe('PrismCaptureService', () => {
    afterEach(() => {
        setSearch('');
        document.documentElement.removeAttribute('data-prism-capture');
        document.getElementById('ng-prism-capture-styles')?.remove();
    });

    it('should be inactive when the URL carries no capture flag', () => {
        setSearch('?component=ButtonComponent');
        expect(createService().active()).toBe(false);
    });

    it('should be active when the URL carries the capture flag', () => {
        setSearch(`?component=ButtonComponent&${CAPTURE_PARAM}=1`);
        expect(createService().active()).toBe(true);
    });

    it('should mark the document element when active', () => {
        setSearch('?capture=1');
        createService();
        expect(document.documentElement.hasAttribute('data-prism-capture')).toBe(true);
    });

    it('should not mark the document element when inactive', () => {
        setSearch('');
        createService();
        expect(document.documentElement.hasAttribute('data-prism-capture')).toBe(false);
    });

    it('should inject a stylesheet that kills animations when active', () => {
        setSearch('?capture=1');
        createService();
        const style = document.getElementById('ng-prism-capture-styles');

        expect(style?.textContent).toContain('animation: none');
    });

    it('should strip the canvas background pattern but not its colour', () => {
        setSearch('?capture=1');
        createService();
        const style = document.getElementById('ng-prism-capture-styles');

        expect(style?.textContent).toContain('[data-prism-capture] .prism-canvas-stage');
        expect(style?.textContent).toContain('background-image: none !important');
    });

    it('should zero a background colour only for a transparent background', () => {
        setSearch('?capture=1');
        createService();
        const rules = captureRules();
        const colouring = rules.filter((rule) => rule.style.getPropertyValue('background-color'));

        // A declared `@Showcase({ bg })` survives capture mode: `light`, `dark`,
        // `dots` and `plain` keep their colour and lose only the non-deterministic
        // pattern. `transparent` is the sole value whose colour capture mode is
        // allowed to touch.
        expect(colouring).toHaveLength(1);
        expect(colouring[0].selectorText).toContain("data-bg='transparent'");
        expect(colouring[0].style.getPropertyValue('background-color')).toBe('transparent');
    });

    it('should not inject a stylesheet when inactive', () => {
        setSearch('');
        createService();
        expect(document.getElementById('ng-prism-capture-styles')).toBeNull();
    });

    it('should stay active after the flag is removed from the URL', () => {
        setSearch('?capture=1');
        const service = createService();

        setSearch('?component=ButtonComponent');
        expect(service.active()).toBe(true);
    });
});
