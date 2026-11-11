import type { Type } from '@angular/core';
import type { RuntimeManifest } from '../plugin/plugin.types.js';
import { providePrism } from './provide-prism.js';

function manifestWithVariants(): RuntimeManifest {
    return {
        components: [
            {
                type: class {} as Type<unknown>,
                meta: {
                    className: 'ButtonComponent',
                    filePath: 'src/button.component.ts',
                    showcaseConfig: {
                        title: 'Button',
                        variants: [{ name: 'Plain' }, { name: 'On dark', bg: 'dark' }]
                    },
                    inputs: [],
                    outputs: [],
                    componentMeta: { selector: 'x-button', standalone: true, isDirective: false }
                }
            }
        ]
    };
}

interface DiscoveredVariant {
    name: string;
    bg: string | undefined;
}

function discoveredVariants(): DiscoveredVariant[] {
    const manifest = (globalThis as Record<string, unknown>)['__PRISM_MANIFEST__'] as { components: Array<{ variants: DiscoveredVariant[] }> };

    return manifest.components[0].variants;
}

describe('providePrism', () => {
    afterEach(() => {
        delete (globalThis as Record<string, unknown>)['__PRISM_MANIFEST__'];
    });

    it('writes showcaseDefaults.bg into __PRISM_MANIFEST__ as the bg of a variant that declares none', () => {
        providePrism(manifestWithVariants(), { showcaseDefaults: { bg: 'light' } });

        // The declared `bg` of the second variant beats the fallback; only the first takes it.
        expect(discoveredVariants().map((v) => v.bg)).toEqual(['light', 'dark']);
    });

    it('leaves a variant without a bg at transparent when the config sets no showcaseDefaults', () => {
        providePrism(manifestWithVariants());

        expect(discoveredVariants().map((v) => v.bg)).toEqual(['transparent', 'dark']);
    });
});
