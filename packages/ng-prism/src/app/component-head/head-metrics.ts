import type { StatusTone } from '../../plugin/status.js';
import { deriveA11ySummary } from '../panels/a11y/a11y-summary.js';
import type { A11yScoreResult, A11yThresholds } from '../panels/a11y/a11y.types.js';

/**
 * How a metric compares to its threshold.
 *
 * `none` means there is no verdict to give: either the value is missing, or
 * it is a plain fact with no threshold to compare against, like a count of
 * variants. Those render grey and stay out of the gauge's tally, which counts
 * the metrics that actually passed something.
 */
export type MetricVariant = 'ok' | 'warn' | 'danger' | 'none';

/** One measured value, already formatted for display. */
export interface HeadMetric {
    id: string;
    label: string;
    value: string;
    /** What the value is graded against, for the readout's Threshold column. */
    threshold: string;
    variant: MetricVariant;
    /** What the value was measured under, when that is not the plain environment: `under Dark scheme`. */
    note?: string;
}

/** What the head knows about the component it introduces. */
export interface HeadMetricInput {
    /** The component's `showcaseConfig.meta`, where plugins leave their verdicts. */
    meta: Record<string, unknown> | null;
    /** The live audit of the current variant, or `null` before it ran. */
    a11y: A11yScoreResult | null;
    a11yThresholds: A11yThresholds;
    /** What the canvas simulates while the live audit runs, as the simulation names it, or `null` for the real environment. Noted only on a score that was measured. */
    a11yCondition: string | null;
}

interface CoverageMeta {
    found?: boolean;
    score?: number;
    summary?: { variant?: string };
    thresholds?: { lines: number; branches: number; functions: number; statements: number };
}

interface VrtMeta {
    found?: boolean;
    summary?: { value: string; variant: string };
}

const isVerdict = (v: unknown): v is 'ok' | 'warn' | 'danger' => v === 'ok' || v === 'warn' || v === 'danger';

/**
 * The head's metrics, in source order: coverage, the a11y score, the visual
 * regression headline.
 *
 * It reads verdicts rather than computing them. Coverage and visual regression
 * take what their plugins derived at build time from their own thresholds; the
 * a11y score is the live audit graded by `deriveA11ySummary`, the rule the tab,
 * the sidebar and the header use. A figure without a verdict stays `none`
 * instead of being graded on a scale of the head's own.
 */
export function headMetrics(input: HeadMetricInput): HeadMetric[] {
    const coverage = input.meta?.['coverage'] as CoverageMeta | undefined;
    const vrt = input.meta?.['visualRegression'] as VrtMeta | undefined;
    const t = coverage?.thresholds;
    const coverageTarget = t ? Math.round((t.lines + t.branches + t.functions + t.statements) / 4) : null;
    const hasCoverage = coverage?.found === true && typeof coverage.score === 'number';
    const a11y = input.a11y;

    return [
        {
            id: 'coverage',
            label: 'Coverage',
            value: hasCoverage ? `${coverage.score}%` : '—',
            threshold: coverageTarget === null ? '—' : `≥ ${coverageTarget}%`,
            variant: hasCoverage && isVerdict(coverage.summary?.variant) ? coverage.summary.variant : 'none'
        },
        {
            id: 'a11y',
            label: 'A11y score',
            value: a11y === null ? '—' : String(a11y.score),
            threshold: `≥ ${input.a11yThresholds.score}`,
            variant: a11y === null ? 'none' : deriveA11ySummary(a11y, input.a11yThresholds).variant,
            ...(a11y !== null && input.a11yCondition ? { note: `under ${input.a11yCondition}` } : {})
        },
        {
            id: 'vrt',
            label: 'VRT diff',
            value: vrt?.found && vrt.summary ? vrt.summary.value : '—',
            threshold: 'no changes',
            variant: vrt?.found && isVerdict(vrt.summary?.variant) ? vrt.summary.variant : 'none'
        }
    ];
}

/** What the gauge chip shows: one metric and the tone of the chip. */
export interface GaugeChip {
    metric: HeadMetric;
    variant: StatusTone;
    /** Metrics that carry a verdict, for the tooltip. */
    measured: number;
}

const SEVERITY: Record<MetricVariant, number> = {
    none: 0,
    ok: 0,
    warn: 1,
    danger: 2
};

/**
 * The chip's tooltip and the tail of its accessible name: the shown metric's
 * note first, so a figure measured under a simulation never reads as the plain
 * one, then how many metrics the readout lists.
 */
export function chipTitle(chip: GaugeChip): string {
    const { metric, measured } = chip;
    const count = `${measured} ${measured === 1 ? 'metric' : 'metrics'} measured. Show all`;

    return metric.note ? `${metric.note.charAt(0).toUpperCase()}${metric.note.slice(1)}. ${count}` : count;
}

/**
 * The short tag the chip shows after its value, or `null` for a figure measured
 * in the real environment. The tooltip and the accessible name carry the whole
 * condition ({@link chipTitle}); this is what a glance, a touch or a keyboard
 * user sees, so a simulated score is never taken for the plain one. `approx.`
 * stays in it where the condition approximates, so a forced-colors score is not
 * read as the real high-contrast mode.
 */
export function chipMarker(chip: GaugeChip): string | null {
    const note = chip.metric.note;

    if (!note) return null;
    return note.includes('approx.') ? 'sim · approx.' : 'sim';
}

/**
 * The one metric the chip shows: the worst, ties resolved by source order so
 * the chip does not flicker between two equally bad ones; when everything is
 * fine, the first measured one in the ok tone. `null` when nothing is
 * measured, and the head shows no gauge.
 *
 * A pure function instead of a computed inside the component: components using
 * signal inputs cannot be rendered through TestBed in this repo's Jest setup.
 */
export function gaugeChip(metrics: readonly HeadMetric[]): GaugeChip | null {
    const measured = metrics.filter((m) => m.variant !== 'none');

    if (measured.length === 0) return null;

    let worst = measured[0];

    for (const m of measured) {
        if (SEVERITY[m.variant] > SEVERITY[worst.variant]) worst = m;
    }

    return { metric: worst, variant: worst.variant as StatusTone, measured: measured.length };
}

/**
 * The tone of the dot on ⓘ in the compact head, where the gauge chip has moved
 * into the ⓘ card: the gauge's tone when it warns or alarms, `null` otherwise,
 * so a dot always means something needs a look.
 */
export function infoDotTone(metrics: readonly HeadMetric[]): 'warn' | 'danger' | null {
    const variant = gaugeChip(metrics)?.variant;

    return variant === 'warn' || variant === 'danger' ? variant : null;
}

/**
 * What the ⓘ button says about its dot, or `null` while it has none: that a
 * metric needs attention, and, when the metric that does was measured under a
 * simulation, which one and under what. The card behind the button lists the
 * same note on the row.
 */
export function infoDotReason(metrics: readonly HeadMetric[]): string | null {
    if (infoDotTone(metrics) === null) return null;
    const metric = gaugeChip(metrics)!.metric;

    return metric.note ? `${metric.label} needs attention ${metric.note}` : 'a metric needs attention';
}
