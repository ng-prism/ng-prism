import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PrismVisionFiltersComponent } from './prism-vision-filters.component.js';
import { VISION_MATRICES, visionFilterId, type VisionMatrix } from './vision-filters.js';

const MATRICES = Object.keys(VISION_MATRICES) as VisionMatrix[];

describe('PrismVisionFiltersComponent', () => {
    async function render(): Promise<HTMLElement> {
        TestBed.resetTestingModule();
        await resolveComponentResources((url) => readFile(join(__dirname, basename(url)), 'utf-8'));
        const fixture = TestBed.createComponent(PrismVisionFiltersComponent);

        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it('renders one filter per matrix with the exact values', async () => {
        const filters = Array.from((await render()).querySelectorAll('filter'));

        expect(filters.map((filter) => filter.id)).toEqual(MATRICES.map(visionFilterId));
        for (const matrix of MATRICES) {
            const filter = filters.find((candidate) => candidate.id === visionFilterId(matrix));
            const color = filter?.querySelector('feColorMatrix');

            expect(color?.getAttribute('type')).toBe('matrix');
            expect(color?.getAttribute('values')).toBe(VISION_MATRICES[matrix]);
        }
    });

    it('works in linear RGB, as the matrices of Machado et al. are defined for it', async () => {
        const filters = Array.from((await render()).querySelectorAll('filter'));

        expect(filters).toHaveLength(MATRICES.length);
        for (const filter of filters) expect(filter.getAttribute('color-interpolation-filters')).toBe('linearRGB');
    });

    it('creates the elements in the SVG namespace, or the browser would not know a filter', async () => {
        const element = await render();

        expect(element.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(element.querySelector('filter')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(element.querySelector('feColorMatrix')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });

    it('lays its host out as its contents, from its own stylesheet rather than an inline style', async () => {
        const css = await readFile(join(__dirname, 'prism-vision-filters.component.css'), 'utf-8').catch(() => '');

        expect((await render()).getAttribute('style')).toBeNull();
        expect(css).toMatch(/:host\s*\{\s*display: contents;\s*\}/);
    });

    it('is hidden from assistive technology, takes no focus and no space', async () => {
        const svg = (await render()).querySelector('svg');

        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.getAttribute('focusable')).toBe('false');
        expect(svg?.getAttribute('width')).toBe('0');
        expect(svg?.getAttribute('height')).toBe('0');
        expect(svg?.style.position).toBe('absolute');
        expect(svg?.style.overflow).toBe('hidden');
    });
});
