import { TestBed } from '@angular/core/testing';
import { PrismThemeService } from './prism-theme.service.js';

const root = document.documentElement;

function create(): PrismThemeService {
    const service = TestBed.inject(PrismThemeService);

    TestBed.tick();
    return service;
}

describe('PrismThemeService', () => {
    beforeEach(() => localStorage.clear());

    afterEach(() => {
        TestBed.resetTestingModule();
        root.removeAttribute('data-prism-theme');
        root.removeAttribute('data-theme');
        root.removeAttribute('style');
        document.head.querySelector('link[rel="icon"]')?.remove();
        localStorage.clear();
    });

    it('should set data-prism-theme and the deprecated data-theme to the same value initially', () => {
        create();

        expect(root.dataset['prismTheme']).toBe('dark');
        expect(root.dataset['theme']).toBe('dark');
    });

    it('should keep both attributes in step across toggle()', () => {
        const service = create();

        service.toggle();
        TestBed.tick();
        expect(root.dataset['prismTheme']).toBe('light');
        expect(root.dataset['theme']).toBe('light');

        service.toggle();
        TestBed.tick();
        expect(root.dataset['prismTheme']).toBe('dark');
        expect(root.dataset['theme']).toBe('dark');
    });

    it('should set both attributes from the stored theme', () => {
        localStorage.setItem('ng-prism-theme', 'light');
        create();

        expect(root.dataset['prismTheme']).toBe('light');
        expect(root.dataset['theme']).toBe('light');
    });
});
