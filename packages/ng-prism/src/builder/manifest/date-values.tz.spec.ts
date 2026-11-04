import type { ScannedComponent } from '../../plugin/plugin.types.js';
import { StaticDate } from '../scanner/static-date.js';
import { manifestMeta } from './__test-utils__/composition-fixtures.js';
import { generateRuntimeManifest } from './runtime-manifest.generator.js';

// Runs once per time zone project of jest.config.cjs: west of UTC, where a UTC midnight is still the day before, and east of it.

const OFFSETS: Record<string, number> = { 'America/New_York': 300, 'Europe/Berlin': -60 };

const COMPONENT: ScannedComponent = {
    className: 'DateFieldComponent',
    filePath: 'src/lib/date-field/date-field.component.ts',
    showcaseConfig: { title: 'Date field' },
    inputs: [{ name: 'value', type: 'date', required: false }],
    outputs: [],
    componentMeta: { selector: 'lib-date-field', standalone: true, isDirective: false }
};

/** The `value` of the one variant, as the styleguide reads it once the manifest module has run. */
function manifestValue(value: StaticDate): Date {
    const component = { ...COMPONENT, showcaseConfig: { ...COMPONENT.showcaseConfig, variants: [{ name: 'Dated', inputs: { value } }] } };
    const source = generateRuntimeManifest({ components: [component], libraryImportPath: 'my-lib', warn: () => undefined });

    return manifestMeta(source).showcaseConfig.variants![0].inputs!['value'] as Date;
}

describe('Date values across time zones', () => {
    it('runs in the zone of its project', () => {
        const zone = (globalThis as { __PRISM_TIMEZONE__?: string }).__PRISM_TIMEZONE__!;

        expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(OFFSETS[zone]);
    });

    it('keeps the local form at local midnight of the 28th', () => {
        const value = manifestValue(new StaticDate([2026, 3, 28]));

        expect([value.getFullYear(), value.getMonth(), value.getDate(), value.getHours()]).toEqual([2026, 3, 28, 0]);
    });

    it('keeps the string form at UTC midnight, as plain JavaScript does', () => {
        expect(manifestValue(new StaticDate(['2026-04-28'])).getTime()).toBe(Date.UTC(2026, 3, 28));
    });
});
