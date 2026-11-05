import { deriveA11ySummary } from '../panels/a11y/a11y-summary.js';
import { DEFAULT_A11Y_THRESHOLDS } from '../panels/a11y/a11y-thresholds.js';
import type { A11yScoreResult } from '../panels/a11y/a11y.types.js';
import { chipMarker, chipTitle, gaugeChip, type HeadMetric, headMetrics, infoDotReason, infoDotTone } from './head-metrics.js';

const audit = (patch: Partial<A11yScoreResult> = {}): A11yScoreResult => ({
    score: 100,
    violations: 0,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    passes: 4,
    incomplete: 0,
    ...patch
});

const thresholds80 = { lines: 80, branches: 80, functions: 80, statements: 80 };

const coverage = (score: number, variant?: 'ok' | 'warn' | 'danger') => ({
    coverage: { found: true, score, thresholds: thresholds80, ...(variant ? { summary: { variant, label: '' } } : {}) }
});

const byId = (metrics: HeadMetric[], id: string) => metrics.find((m) => m.id === id)!;

describe('headMetrics', () => {
    it('lists coverage, a11y and visual regression in that order', () => {
        expect(headMetrics({ meta: null, a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }).map((m) => m.id)).toEqual([
            'coverage',
            'a11y',
            'vrt'
        ]);
    });

    it('takes the coverage verdict the plugin derived, not a fixed 90', () => {
        const metric = byId(headMetrics({ meta: coverage(85, 'ok'), a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'coverage');

        expect(metric).toEqual({ id: 'coverage', label: 'Coverage', value: '85%', threshold: '≥ 80%', variant: 'ok' });
    });

    it('gives no coverage verdict when the plugin wrote no summary', () => {
        expect(byId(headMetrics({ meta: coverage(85), a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'coverage').variant).toBe('none');
    });

    it('grades the live a11y score with the rule the tab and the sidebar use', () => {
        const metric = byId(headMetrics({ meta: null, a11y: audit({ score: 90, serious: 1 }), a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'a11y');

        expect(metric).toEqual({ id: 'a11y', label: 'A11y score', value: '90', threshold: '≥ 80', variant: 'danger' });
    });

    it('reads the visual regression headline as the plugin derived it', () => {
        const meta = { visualRegression: { found: true, summary: { value: '10.26%', variant: 'danger' } } };

        expect(byId(headMetrics({ meta, a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'vrt')).toEqual({
            id: 'vrt',
            label: 'VRT diff',
            value: '10.26%',
            threshold: 'no changes',
            variant: 'danger'
        });
    });

    it('shows a dash for what is not measured', () => {
        const metrics = headMetrics({ meta: null, a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null });

        expect(metrics.every((m) => m.value === '—' && m.variant === 'none')).toBe(true);
    });

    it('notes the condition on the a11y metric', () => {
        const thresholds = DEFAULT_A11Y_THRESHOLDS;
        const m = headMetrics({ meta: null, a11y: audit({ score: 92 }), a11yThresholds: thresholds, a11yCondition: 'Forced colors (approx.)' });

        expect(byId(m, 'a11y').note).toBe('under Forced colors (approx.)');
        expect(byId(headMetrics({ meta: null, a11y: audit({ score: 92 }), a11yThresholds: thresholds, a11yCondition: null }), 'a11y').note).toBeUndefined();
    });

    it('notes the condition on the a11y metric alone', () => {
        const metrics = headMetrics({ meta: coverage(85, 'ok'), a11y: audit(), a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: 'Dark scheme' });

        expect(metrics.filter((m) => m.note !== undefined).map((m) => m.id)).toEqual(['a11y']);
    });

    it('notes no condition on a score that was not measured', () => {
        const metric = byId(headMetrics({ meta: null, a11y: null, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: 'Dark scheme' }), 'a11y');

        expect(metric.value).toBe('—');
        expect('note' in metric).toBe(false);
    });

    it('leaves the note key off when nothing is simulated', () => {
        const metric = byId(headMetrics({ meta: null, a11y: audit(), a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'a11y');

        expect('note' in metric).toBe(false);
    });

    /** Same input, same tone: the gauge never grades a figure differently from the tab, the sidebar or the header. */
    it.each([audit({ score: 95 }), audit({ score: 85 }), audit({ score: 70 }), audit({ score: 59 }), audit({ score: 98, critical: 1 })])(
        'agrees with the a11y summary for %o',
        (result) => {
            const metric = byId(headMetrics({ meta: null, a11y: result, a11yThresholds: DEFAULT_A11Y_THRESHOLDS, a11yCondition: null }), 'a11y');

            expect(metric.variant).toBe(deriveA11ySummary(result, DEFAULT_A11Y_THRESHOLDS).variant);
        }
    );
});

describe('gaugeChip', () => {
    const metric = (id: string, variant: HeadMetric['variant']): HeadMetric => ({ id, label: id, value: '1', threshold: '', variant });

    it('shows the worst metric', () => {
        expect(gaugeChip([metric('a', 'ok'), metric('b', 'danger'), metric('c', 'warn')])).toEqual({ metric: metric('b', 'danger'), variant: 'danger', measured: 3 });
    });

    it('breaks ties by order', () => {
        expect(gaugeChip([metric('a', 'warn'), metric('b', 'warn')])?.metric.id).toBe('a');
    });

    it('shows the first measured metric when everything is fine', () => {
        expect(gaugeChip([metric('a', 'none'), metric('b', 'ok'), metric('c', 'ok')])).toEqual({ metric: metric('b', 'ok'), variant: 'ok', measured: 2 });
    });

    it('has nothing to show when nothing is measured', () => {
        expect(gaugeChip([metric('a', 'none'), metric('b', 'none')])).toBeNull();
    });
});

describe('chipTitle', () => {
    const chip = (metric: Partial<HeadMetric>, measured = 2) => ({
        metric: { id: 'a11y', label: 'A11y score', value: '92', threshold: '', variant: 'ok' as const, ...metric },
        variant: 'ok' as const,
        measured
    });

    it('counts the measured metrics', () => {
        expect(chipTitle(chip({}, 1))).toBe('1 metric measured. Show all');
        expect(chipTitle(chip({}))).toBe('2 metrics measured. Show all');
    });

    it('names the condition the shown metric was measured under', () => {
        expect(chipTitle(chip({ note: 'under Dark scheme' }))).toBe('Under Dark scheme. 2 metrics measured. Show all');
    });
});

describe('chipMarker', () => {
    const chip = (note?: string) => ({
        metric: { id: 'a11y', label: 'A11y score', value: '92', threshold: '', variant: 'ok' as const, ...(note ? { note } : {}) },
        variant: 'ok' as const,
        measured: 1
    });

    it('has no marker for a figure measured in the real environment', () => {
        expect(chipMarker(chip())).toBeNull();
    });

    it('marks a simulated figure with a short tag', () => {
        expect(chipMarker(chip('under Dark scheme'))).toBe('sim');
        expect(chipMarker(chip('under Light scheme'))).toBe('sim');
    });

    it('says approx. where the condition approximates, so it is not read as the real mode', () => {
        expect(chipMarker(chip('under Forced colors (approx.)'))).toBe('sim · approx.');
        expect(chipMarker(chip('under Dark scheme · Forced colors (approx.)'))).toBe('sim · approx.');
    });
});

describe('infoDotReason', () => {
    const metric = (id: string, variant: HeadMetric['variant'], note?: string): HeadMetric => ({
        id,
        label: id,
        value: '1',
        threshold: '',
        variant,
        ...(note ? { note } : {})
    });

    it('is null while the ⓘ shows no dot', () => {
        expect(infoDotReason([metric('a', 'ok', 'under Dark scheme'), metric('b', 'none')])).toBeNull();
        expect(infoDotReason([])).toBeNull();
    });

    it('says a metric needs attention when the worst one was measured in the real environment', () => {
        expect(infoDotReason([metric('a', 'ok'), metric('b', 'warn')])).toBe('a metric needs attention');
    });

    it('names the condition when the worst metric was measured under a simulation', () => {
        expect(infoDotReason([metric('a', 'ok'), metric('a11y', 'danger', 'under Dark scheme')])).toBe('a11y needs attention under Dark scheme');
    });
});

describe('infoDotTone', () => {
    const metric = (id: string, variant: HeadMetric['variant']): HeadMetric => ({ id, label: id, value: '1', threshold: '', variant });

    it('should be danger when the worst metric is', () => {
        expect(infoDotTone([metric('a', 'warn'), metric('b', 'danger')])).toBe('danger');
    });

    it('should be warn when the worst metric is', () => {
        expect(infoDotTone([metric('a', 'ok'), metric('b', 'warn')])).toBe('warn');
    });

    it('should be null when everything is fine or nothing is measured', () => {
        expect(infoDotTone([metric('a', 'ok')])).toBeNull();
        expect(infoDotTone([metric('a', 'none')])).toBeNull();
        expect(infoDotTone([])).toBeNull();
    });
});
