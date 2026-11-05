import type { PanelDefinition, RuntimeComponent } from '../../../plugin/plugin.types.js';
import { DEFAULT_A11Y_THRESHOLDS } from '../a11y/a11y-thresholds.js';
import type { A11yScoreResult } from '../a11y/a11y.types.js';
import { a11yViolationBadge, deprecatedBadgeVariantNotice, normalizePanelBadge, type PanelBadgeContext, resolvePanelBadge } from './panel-badge.js';

const EMPTY_CONTEXT: PanelBadgeContext = {
    inputCount: 0,
    eventCount: 0,
    a11yResult: null,
    a11yCondition: null,
    a11yThresholds: DEFAULT_A11Y_THRESHOLDS
};

/** An audit result that is clean apart from the score it is asked to carry. */
function auditResult(overrides: Partial<A11yScoreResult> = {}): A11yScoreResult {
    return {
        score: 100,
        violations: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        passes: 0,
        incomplete: 0,
        ...overrides
    };
}

function panel(id: string, badge?: PanelDefinition['badge']): PanelDefinition {
    return { id, label: id, ...(badge ? { badge } : {}) };
}

const COMPONENT = { meta: {} } as unknown as RuntimeComponent;

describe('resolvePanelBadge', () => {
    it('lets a panel speak for itself', () => {
        const own = panel('visual-regression', () => ({
            text: '3',
            variant: 'danger' as const
        }));

        expect(resolvePanelBadge(own, COMPONENT, EMPTY_CONTEXT)).toEqual({
            text: '3',
            variant: 'danger'
        });
    });

    it('passes the active component to the panel', () => {
        const seen: unknown[] = [];
        const own = panel('x', (component) => {
            seen.push(component);
            return null;
        });

        resolvePanelBadge(own, COMPONENT, EMPTY_CONTEXT);
        expect(seen).toEqual([COMPONENT]);
    });

    it('honours a panel that says there is nothing to report', () => {
        expect(
            resolvePanelBadge(
                panel('x', () => null),
                COMPONENT,
                EMPTY_CONTEXT
            )
        ).toBeNull();
    });

    it('lets a panel override a built-in of the same id', () => {
        // The built-in chain is a fallback, not a floor. A plugin that replaces a
        // panel id owns its tab entirely.
        const own = panel('a11y', () => ({ text: 'AA', variant: 'ok' as const }));
        const badge = resolvePanelBadge(own, COMPONENT, {
            ...EMPTY_CONTEXT,
            a11yResult: auditResult({ score: 42 })
        });

        expect(badge).toEqual({ text: 'AA', variant: 'ok' });
    });

    it('asks nothing of a panel when no component is active', () => {
        let called = false;
        const own = panel('x', () => {
            called = true;
            return { text: '1' };
        });

        expect(resolvePanelBadge(own, null, EMPTY_CONTEXT)).toBeNull();
        expect(called).toBe(false);
    });

    it('counts inputs on the controls tab', () => {
        expect(
            resolvePanelBadge(panel('controls'), COMPONENT, {
                ...EMPTY_CONTEXT,
                inputCount: 6
            })
        ).toEqual({ kind: 'count', text: '6', label: '6 inputs' });
    });

    it('leaves the controls tab bare when there is nothing to control', () => {
        expect(resolvePanelBadge(panel('controls'), COMPONENT, EMPTY_CONTEXT)).toBeNull();
    });

    it('counts open violations on the a11y tab, not the score', () => {
        const badge = resolvePanelBadge(panel('a11y'), COMPONENT, {
            ...EMPTY_CONTEXT,
            a11yResult: auditResult({ score: 90, moderate: 2, minor: 1 })
        });

        expect(badge).toEqual({ kind: 'issues', text: '3', tone: 'warn', label: '3 violations' });
    });

    it('takes the a11y tone from the most severe violation', () => {
        const badge = resolvePanelBadge(panel('a11y'), COMPONENT, {
            ...EMPTY_CONTEXT,
            a11yResult: auditResult({ score: 95, serious: 1 })
        });

        expect(badge).toEqual({ kind: 'issues', text: '1', tone: 'danger', label: '1 violation' });
    });

    it('names the condition the live violations were audited under', () => {
        const badge = resolvePanelBadge(panel('a11y'), COMPONENT, {
            ...EMPTY_CONTEXT,
            a11yResult: auditResult({ score: 90, moderate: 2, minor: 1 }),
            a11yCondition: 'Forced colors (approx.)'
        });

        expect(badge).toEqual({ kind: 'issues', text: '3', tone: 'warn', label: '3 violations under Forced colors (approx.)' });
    });

    it('leaves a clean a11y tab bare whatever the score', () => {
        expect(resolvePanelBadge(panel('a11y'), COMPONENT, { ...EMPTY_CONTEXT, a11yResult: auditResult({ score: 100 }) })).toBeNull();
        expect(resolvePanelBadge(panel('a11y'), COMPONENT, EMPTY_CONTEXT)).toBeNull();
    });

    it('counts recorded events on the events tab', () => {
        expect(resolvePanelBadge(panel('events'), COMPONENT, { ...EMPTY_CONTEXT, eventCount: 2 })).toEqual({ kind: 'count', text: '2', label: '2 events' });
        expect(resolvePanelBadge(panel('events'), COMPONENT, EMPTY_CONTEXT)).toBeNull();
    });

    it('has nothing to say about the coverage tab', () => {
        // A percentage is not a number of open findings; the coverage plugin
        // declares no badge either.
        expect(resolvePanelBadge(panel('coverage'), COMPONENT, EMPTY_CONTEXT)).toBeNull();
    });

    it('has nothing to say about a panel it does not know', () => {
        expect(resolvePanelBadge(panel('figma'), COMPONENT, EMPTY_CONTEXT)).toBe(null);
    });
});

/**
 * Plugins written before 22.7 return `{ text, variant }`. Their badges keep
 * rendering, mapped onto the two kinds: a plain figure is a neutral count, a
 * judgement is a pill of open findings, and `ok` stays as invisible as it was.
 */
describe('normalizePanelBadge', () => {
    it('reads a warn or danger variant as open findings in that tone', () => {
        expect(normalizePanelBadge({ text: '3', variant: 'warn' })).toEqual({ kind: 'issues', text: '3', tone: 'warn', label: '3' });
        expect(normalizePanelBadge({ text: '1', variant: 'danger' })).toEqual({ kind: 'issues', text: '1', tone: 'danger', label: '1' });
    });

    it('hides findings that number zero', () => {
        expect(normalizePanelBadge({ text: '0', variant: 'danger' })).toBeNull();
        expect(normalizePanelBadge({ kind: 'issues', text: '0' })).toBeNull();
    });

    it('reads a plain figure as a neutral count', () => {
        expect(normalizePanelBadge({ text: '7' })).toEqual({ kind: 'count', text: '7', label: '7' });
        expect(normalizePanelBadge({ text: '7', variant: 'default' })).toEqual({ kind: 'count', text: '7', label: '7' });
    });

    it('keeps an ok variant invisible', () => {
        expect(normalizePanelBadge({ text: '90', variant: 'ok' })).toBeNull();
    });

    it('defaults open findings to the danger tone', () => {
        expect(normalizePanelBadge({ kind: 'issues', text: '2' })?.tone).toBe('danger');
    });

    it('names the badge with its label for assistive technology', () => {
        expect(normalizePanelBadge({ kind: 'issues', text: '2', tone: 'warn', label: '2 violations' })?.label).toBe('2 violations');
    });

    it('passes no badge through as none', () => {
        expect(normalizePanelBadge(null)).toBeNull();
    });
});

describe('deprecatedBadgeVariantNotice', () => {
    it('names the panel whose badge still sets variant', () => {
        expect(deprecatedBadgeVariantNotice('my-panel', { text: '3', variant: 'warn' })).toBe(
            'The badge of panel "my-panel" sets variant, which is deprecated since 22.7.0 and will be removed in 23.0.0. It is mapped to kind and tone until then; set those instead.'
        );
    });

    it('also reports an ok variant, which renders nothing', () => {
        expect(deprecatedBadgeVariantNotice('my-panel', { text: '90', variant: 'ok' })).not.toBeNull();
    });

    it('stays quiet for a badge without variant or no badge at all', () => {
        expect(deprecatedBadgeVariantNotice('my-panel', { kind: 'issues', text: '2', tone: 'warn' })).toBeNull();
        expect(deprecatedBadgeVariantNotice('my-panel', null)).toBeNull();
    });
});

describe('a11yViolationBadge', () => {
    it('counts the open violations and keeps the label plain in the real environment', () => {
        expect(a11yViolationBadge(auditResult({ serious: 1 }))).toEqual({ kind: 'issues', text: '1', tone: 'danger', label: '1 violation' });
        expect(a11yViolationBadge(auditResult({ serious: 1 }), null)).toEqual({ kind: 'issues', text: '1', tone: 'danger', label: '1 violation' });
    });

    it('appends the condition to the label, where the tab bar takes its accessible name from', () => {
        expect(a11yViolationBadge(auditResult({ minor: 2 }), 'Dark scheme')).toEqual({
            kind: 'issues',
            text: '2',
            tone: 'warn',
            label: '2 violations under Dark scheme'
        });
    });

    it('has no badge for a clean or missing audit, whatever the condition', () => {
        expect(a11yViolationBadge(auditResult(), 'Dark scheme')).toBeNull();
        expect(a11yViolationBadge(null, 'Dark scheme')).toBeNull();
    });
});
