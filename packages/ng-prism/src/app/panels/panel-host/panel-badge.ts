import type { PanelBadge, PanelDefinition, RuntimeComponent } from '../../../plugin/plugin.types.js';
import type { PrismTabBadge } from '../../shared/prism-tabs.component.js';
import type { A11yScoreResult, A11yThresholds } from '../a11y/a11y.types.js';

/**
 * The live figures the built-in tabs badge themselves with.
 *
 * Passed in rather than injected so this stays a pure function. The panel host
 * reads them from its own services and hands them over; that is the whole
 * reason the built-in chain could not simply be expressed as
 * {@link PanelDefinition.badge} callbacks: `a11y` reports a running audit, not
 * anything the component's meta holds.
 *
 * The thresholds travel with the audit result rather than being baked in here.
 * The navigation marker grades the build-time report against the configured
 * numbers; a tab grading the live audit on its own scale would put an amber
 * icon in the sidebar next to a red badge on the tab for the same component.
 *
 * Unlike the sidebar, which only ever shows the build-time report, the tab's
 * figures are live and may have been audited under a simulation: the condition
 * travels with the result and ends up in the badge's label.
 */
export interface PanelBadgeContext {
    inputCount: number;
    eventCount: number;
    a11yResult: A11yScoreResult | null;
    /** What the canvas simulated while `a11yResult` was audited, or `null` for the real environment. */
    a11yCondition: string | null;
    a11yThresholds: A11yThresholds;
}

/**
 * The badge a panel's tab carries, if any.
 *
 * A panel that declares its own {@link PanelDefinition.badge} wins outright,
 * which is what lets a plugin put a number on its own tab without the panel
 * host learning about it. The chain below it predates that hook and stays for
 * the tabs it already covers.
 *
 * Returning `null` is the common case and the important one: a badge that is
 * always present stops being a signal, so every branch here has a way to say
 * "nothing worth reporting" rather than falling back to a zero.
 */
export function resolvePanelBadge(panel: PanelDefinition, component: RuntimeComponent | null, context: PanelBadgeContext): PanelBadge | null {
    if (panel.badge) {
        // No component means no subject to report on; calling the hook with a
        // placeholder would invite it to invent a number.
        return component ? panel.badge(component) : null;
    }

    if (panel.id === 'controls') {
        return countBadge(context.inputCount, 'input');
    }

    if (panel.id === 'events') {
        return countBadge(context.eventCount, 'event');
    }

    if (panel.id === 'a11y') {
        return a11yViolationBadge(context.a11yResult, context.a11yCondition);
    }

    return null;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function countBadge(n: number, noun: string): PanelBadge | null {
    return n > 0 ? { kind: 'count', text: String(n), label: plural(n, noun) } : null;
}

/** The tab badge the tab bar renders. Same shape as {@link PrismTabBadge}. */
export type NormalizedPanelBadge = PrismTabBadge;

/**
 * Reads a badge the way the tab bar renders it, including badges written
 * before 22.7 that only set `variant`.
 */
export function normalizePanelBadge(badge: PanelBadge | null): NormalizedPanelBadge | null {
    if (badge === null) return null;
    if (!badge.kind && badge.variant === 'ok') return null;

    const kind = badge.kind ?? (badge.variant === 'warn' || badge.variant === 'danger' ? 'issues' : 'count');
    const label = badge.label ?? badge.text;

    if (kind === 'count') return { kind, text: badge.text, label };
    if (badge.text === '0') return null;

    const legacyTone = badge.variant === 'warn' || badge.variant === 'danger' ? badge.variant : undefined;

    return { kind, text: badge.text, tone: badge.tone ?? legacyTone ?? 'danger', label };
}

/**
 * What to tell the author of a panel whose badge still sets `variant`, or
 * `null` when it does not. The panel host logs it once per panel; the badge
 * keeps rendering through {@link normalizePanelBadge} until 23.0.0.
 */
export function deprecatedBadgeVariantNotice(panelId: string, badge: PanelBadge | null): string | null {
    if (badge?.variant === undefined) return null;
    return `The badge of panel "${panelId}" sets variant, which is deprecated since 22.7.0 and will be removed in 23.0.0. It is mapped to kind and tone until then; set those instead.`;
}

/**
 * The a11y tab's badge, also shown on the Violations sub-tab: a number of open
 * findings, not the score. The score is graded in the gauge, the sidebar and
 * the panel. The tone follows the most severe violation, the same split the
 * build gate draws.
 *
 * The count is the live audit's, where the sidebar's marker is the build-time
 * report's. `condition` names what the canvas simulated while it ran (see
 * `PrismSimulationService.auditCondition`) and goes into the label, which is the
 * tab's accessible name, so a count under a simulation is not read as the
 * plain one.
 */
export function a11yViolationBadge(result: A11yScoreResult | null, condition: string | null = null): PanelBadge | null {
    if (result === null) return null;
    const violations = result.critical + result.serious + result.moderate + result.minor;

    if (violations === 0) return null;
    return {
        kind: 'issues',
        text: String(violations),
        tone: result.critical + result.serious > 0 ? 'danger' : 'warn',
        label: condition ? `${plural(violations, 'violation')} under ${condition}` : plural(violations, 'violation')
    };
}
