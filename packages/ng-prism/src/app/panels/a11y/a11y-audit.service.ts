import { computed, DestroyRef, inject, Injectable, type Signal, signal } from '@angular/core';
import type { AxeResults, Result, RunOptions } from 'axe-core';
import type { A11yAcceptance } from '../../../decorator/showcase.types.js';
import { withCanvasChromeHidden } from '../../renderer/canvas-audit.js';
import { type AcceptedViolation, partitionViolations } from './a11y-acceptances.js';
import type { A11yCoreConfig, A11yScoreResult } from './a11y.types.js';

/** The score of an audit; a violation one of `acceptances` covers does not count. */
export function calculateScore(results: AxeResults, acceptances: readonly A11yAcceptance[] = []): A11yScoreResult {
    const violations = partitionViolations(results.violations, acceptances).counted;
    const critical = violations.filter((v) => v.impact === 'critical').length;
    const serious = violations.filter((v) => v.impact === 'serious').length;
    const moderate = violations.filter((v) => v.impact === 'moderate').length;
    const minor = violations.filter((v) => v.impact === 'minor').length;
    const deductions = critical * 25 + serious * 10 + moderate * 5 + minor * 1;

    return {
        score: Math.max(0, 100 - deductions),
        violations: violations.length,
        critical,
        serious,
        moderate,
        minor,
        passes: results.passes.length,
        incomplete: results.incomplete.length
    };
}

/**
 * axe-core is a dependency of `@ng-prism/core` and loaded lazily, so a failure
 * here means the chunk could not be fetched, not that anything is missing.
 */
async function loadAxe() {
    try {
        return await import('axe-core');
    } catch (cause) {
        throw new Error(
            'Could not load axe-core, so the accessibility audit is unavailable. It ships with @ng-prism/core; check that the install is intact and the chunk is reachable.',
            { cause }
        );
    }
}

export async function runCoreAudit(element: Element, config?: A11yCoreConfig): Promise<AxeResults> {
    const axe = await loadAxe();

    const options: RunOptions = {};

    if (config?.rules) {
        const keys = Object.keys(config.rules);

        if (keys.length > 0) {
            options.rules = Object.fromEntries(keys.map((id) => [id, config.rules![id]]));
        }
    }

    return withCanvasChromeHidden(element, () => axe.default.run(element, options));
}

@Injectable({ providedIn: 'root' })
export class A11yAuditService {
    readonly results = signal<AxeResults | null>(null);
    readonly running = signal(false);
    readonly error = signal<string | null>(null);

    private readonly auditedCondition = signal<string | null>(null);

    /**
     * What the current results were audited under (a simulated scheme or forced
     * colors, as the simulation names it), or `null` for the real environment.
     * Set with the results, so a run that lands after the condition changed
     * keeps the one it audited and never grades a newer one. Since 22.8.0.
     */
    readonly condition: Signal<string | null> = this.auditedCondition.asReadonly();

    /** The acceptances the current results were audited under: set with them, so a later audit's never grade an earlier result. */
    private readonly acceptances = signal<readonly A11yAcceptance[]>([]);

    private readonly partition = computed(() => partitionViolations(this.results()?.violations ?? [], this.acceptances()));

    /** The violations that count. */
    readonly violations = computed<Result[]>(() => this.partition().counted);

    /** The violations an acceptance covers, with its reason. Since 22.7.0. */
    readonly accepted = computed<AcceptedViolation[]>(() => this.partition().accepted);

    readonly scoreResult = computed(() => {
        const r = this.results();

        return r ? calculateScore(r, this.acceptances()) : null;
    });

    private timer: ReturnType<typeof setTimeout> | null = null;
    private destroyed = false;
    /** The number of the latest request. Each `scheduleAudit` and `clear` counts one up. */
    private requested = 0;
    /** The number of the request whose results are shown; a run older than it lands too late. */
    private shown = 0;
    /** The run in flight, settled or not: axe-core rejects a run while another one is going. */
    private queue: Promise<void> = Promise.resolve();

    constructor() {
        inject(DestroyRef).onDestroy(() => {
            this.destroyed = true;
            this.clear();
        });
    }

    /**
     * `condition` names what the canvas simulates while the audit runs, and is kept with its results.
     *
     * Runs never overlap: a request waits for the run in flight and is skipped
     * once a newer one has come in, so the latest request runs last. `running`
     * stays on until it has landed.
     */
    scheduleAudit(element: Element, config?: A11yCoreConfig, debounceMs = 500, condition: string | null = null): void {
        if (this.destroyed) return;
        if (this.timer) clearTimeout(this.timer);

        const request = ++this.requested;

        this.running.set(true);
        this.error.set(null);

        this.timer = setTimeout(() => {
            const next = (): Promise<void> | undefined => this.run(request, element, config, condition);

            this.timer = null;
            // Either way: a run that failed in a way nobody foresaw must not hold up the ones behind it.
            this.queue = this.queue.then(next, next);
        }, debounceMs);
    }

    private run(request: number, element: Element, config: A11yCoreConfig | undefined, condition: string | null): Promise<void> | undefined {
        if (this.destroyed || request !== this.requested) return undefined;

        return runCoreAudit(element, config).then(
            (result) => {
                if (this.destroyed || request < this.shown) return;
                // An overtaken run still shows what it audited, labelled with its condition, until the newer one lands.
                this.shown = request;
                this.acceptances.set(config?.accept ?? []);
                this.auditedCondition.set(condition);
                this.results.set(result);
                if (request === this.requested) this.running.set(false);
            },
            (err) => {
                // The newer request reports for itself.
                if (this.destroyed || request !== this.requested) return;
                this.error.set(err instanceof Error ? err.message : String(err));
                this.running.set(false);
            }
        );
    }

    clear(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        // Whatever is in flight now lands too late.
        this.shown = ++this.requested;
        this.results.set(null);
        this.acceptances.set([]);
        this.auditedCondition.set(null);
        this.running.set(false);
        this.error.set(null);
    }
}
