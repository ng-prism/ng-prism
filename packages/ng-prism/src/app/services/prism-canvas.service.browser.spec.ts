import { TestBed } from '@angular/core/testing';
import { PrismCanvasService } from './prism-canvas.service.js';

const STORAGE_KEY = 'ng-prism-canvas';

function setSearch(search: string): void {
    window.history.replaceState({}, '', `/${search}`);
}

function createService(): PrismCanvasService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(PrismCanvasService);
}

describe('PrismCanvasService', () => {
    beforeEach(() => {
        localStorage.clear();
        setSearch('');
        document.documentElement.removeAttribute('data-prism-capture');
        document.getElementById('ng-prism-capture-styles')?.remove();
    });

    afterEach(() => {
        localStorage.clear();
        setSearch('');
    });

    describe('normal mode', () => {
        it('should restore persisted zoom', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ zoom: 2 }));
            expect(createService().zoom()).toBe(2);
        });

        it('should restore persisted guides', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ guides: true }));
            expect(createService().guides()).toBe(true);
        });

        it('should persist a zoom change', () => {
            const service = createService();

            service.setZoom(1.5);
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').zoom).toBe(1.5);
        });
    });

    describe('capture mode', () => {
        beforeEach(() => setSearch('?capture=1'));

        it('should ignore persisted zoom and stay at 1', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ zoom: 2 }));
            expect(createService().zoom()).toBe(1);
        });

        it('should ignore persisted guides', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ guides: true }));
            expect(createService().guides()).toBe(false);
        });

        it('should ignore persisted rulers', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ rulers: true }));
            expect(createService().rulers()).toBe(false);
        });

        it('should not write canvas state back to storage', () => {
            const service = createService();

            service.setZoom(1.5);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        it('should ignore a persisted viewport width', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewportWidth: 480 }));
            expect(createService().viewportWidth()).toBeNull();
        });

        it('should ignore a persisted background choice', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'light', bgChosen: true }));
            expect(createService().bgChosen()).toBe(false);
        });
    });

    describe('chosen background', () => {
        it('should start with no background chosen', () => {
            expect(createService().bgChosen()).toBe(false);
        });

        it('marks a picked background as chosen and persists it', () => {
            const service = createService();

            service.setBg('dots');
            expect(service.bgChosen()).toBe(true);

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;

            expect(stored['bgChosen']).toBe(true);
        });

        it('restores the persisted flag', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'dots', bgChosen: true }));
            expect(createService().bgChosen()).toBe(true);
        });

        it('lets a stored flag win over the background it sits next to', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'light', bgChosen: false }));
            expect(createService().bgChosen()).toBe(false);
        });

        it('migrates storage without the flag', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'light' }));
            expect(createService().bgChosen()).toBe(true);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'dots' }));
            expect(createService().bgChosen()).toBe(false);
        });

        it('treats storage without a background or flag as not chosen', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ zoom: 2 }));
            expect(createService().bgChosen()).toBe(false);
        });

        it('ignores a stored flag that is not a boolean', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: 'light', bgChosen: 'yes' }));
            expect(createService().bgChosen()).toBe(true);
        });

        it('keeps the flag across other canvas changes', () => {
            const service = createService();

            service.setBg('plain');
            service.setZoom(1.5);

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;

            expect(stored['bgChosen']).toBe(true);
        });
    });

    describe('viewport width', () => {
        it('should start unconstrained', () => {
            expect(createService().viewportWidth()).toBeNull();
        });

        it('should restore a persisted width', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewportWidth: 480 }));
            expect(createService().viewportWidth()).toBe(480);
        });

        it('should persist a width change', () => {
            const service = createService();

            service.setViewportWidth(640);
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').viewportWidth).toBe(640);
        });

        it('should clamp a width outside the legal range', () => {
            const service = createService();

            service.setViewportWidth(10);
            expect(service.viewportWidth()).toBe(100);
        });

        it('should clear the constraint when set to null', () => {
            const service = createService();

            service.setViewportWidth(640);
            service.setViewportWidth(null);
            expect(service.viewportWidth()).toBeNull();
        });

        it('should ignore a persisted width that is not a number', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewportWidth: 'wide' }));
            expect(createService().viewportWidth()).toBeNull();
        });
    });

    describe('viewport toggle', () => {
        it('should turn on at the default width', () => {
            const service = createService();

            service.toggleViewport();
            expect(service.viewportWidth()).toBe(390);
        });

        it('should turn off again', () => {
            const service = createService();

            service.toggleViewport();
            service.toggleViewport();
            expect(service.viewportWidth()).toBeNull();
        });

        it('should return to the last width rather than the default', () => {
            const service = createService();

            service.setViewportWidth(768);
            service.toggleViewport();
            service.toggleViewport();
            expect(service.viewportWidth()).toBe(768);
        });
    });

    describe('measure toggle', () => {
        it('should start with the measure tool off', () => {
            expect(createService().measure()).toBe(false);
        });

        it('should toggle the measure tool', () => {
            const service = createService();

            service.toggleMeasure();
            expect(service.measure()).toBe(true);
        });

        it('should persist the measure toggle', () => {
            const service = createService();

            service.toggleMeasure();

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;

            expect(stored['measure']).toBe(true);
        });

        it('should restore the measure toggle from storage', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ measure: true }));
            expect(createService().measure()).toBe(true);
        });
    });
});
