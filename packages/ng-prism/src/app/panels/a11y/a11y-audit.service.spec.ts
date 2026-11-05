import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import axe, { type AxeResults, type Result } from 'axe-core';
import { A11yAuditService, calculateScore, runCoreAudit } from './a11y-audit.service.js';

const mockResults: AxeResults = {
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
    testEngine: { name: 'axe-core', version: '4.0.0' },
    testRunner: { name: 'axe' },
    testEnvironment: { userAgent: '', windowWidth: 0, windowHeight: 0, orientationAngle: 0, orientationType: '' },
    timestamp: '',
    url: '',
    toolOptions: {}
};

jest.mock('axe-core', () => ({
    __esModule: true,
    default: { run: jest.fn() }
}));

describe('calculateScore', () => {
    it('returns 100 with no violations', () => {
        const result = calculateScore({ ...mockResults, violations: [], passes: [] });

        expect(result.score).toBe(100);
    });

    it('deducts 25 per critical violation', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [{ id: 'v', impact: 'critical', description: '', nodes: [], tags: [], help: '', helpUrl: '' }]
        });

        expect(result.score).toBe(75);
    });

    it('deducts 10 per serious violation', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [{ id: 'v', impact: 'serious', description: '', nodes: [], tags: [], help: '', helpUrl: '' }]
        });

        expect(result.score).toBe(90);
    });

    it('deducts 5 per moderate violation', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [{ id: 'v', impact: 'moderate', description: '', nodes: [], tags: [], help: '', helpUrl: '' }]
        });

        expect(result.score).toBe(95);
    });

    it('deducts 1 per minor violation', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [{ id: 'v', impact: 'minor', description: '', nodes: [], tags: [], help: '', helpUrl: '' }]
        });

        expect(result.score).toBe(99);
    });

    it('clamps score to 0 with many violations', () => {
        const criticals = Array.from({ length: 10 }, (_, i) => ({
            id: `v${i}`,
            impact: 'critical' as const,
            description: '',
            nodes: [],
            tags: [],
            help: '',
            helpUrl: ''
        }));
        const result = calculateScore({ ...mockResults, violations: criticals });

        expect(result.score).toBe(0);
    });

    it('sums mixed impact violations', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [
                { id: 'a', impact: 'critical', description: '', nodes: [], tags: [], help: '', helpUrl: '' },
                { id: 'b', impact: 'moderate', description: '', nodes: [], tags: [], help: '', helpUrl: '' }
            ]
        });

        expect(result.score).toBe(70);
    });

    it('counts passes and incomplete correctly', () => {
        const result = calculateScore({
            ...mockResults,
            violations: [],
            passes: [
                { id: 'p1', impact: null, description: '', nodes: [], tags: [], help: '', helpUrl: '' },
                { id: 'p2', impact: null, description: '', nodes: [], tags: [], help: '', helpUrl: '' }
            ],
            incomplete: [{ id: 'i1', impact: null, description: '', nodes: [], tags: [], help: '', helpUrl: '' }]
        });

        expect(result.passes).toBe(2);
        expect(result.incomplete).toBe(1);
    });
});

describe('runCoreAudit', () => {
    // Outside a canvas stage: the node environment has no DOM, and an audit there skips the hiding.
    const mockElement = { closest: () => null } as unknown as Element;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls axe-core with the element', async () => {
        const axe = (await import('axe-core')).default;

        (axe.run as jest.Mock).mockResolvedValue(mockResults);

        await runCoreAudit(mockElement);

        expect(axe.run).toHaveBeenCalledWith(mockElement, {});
    });

    it('passes rules config to axe-core', async () => {
        const axe = (await import('axe-core')).default;

        (axe.run as jest.Mock).mockResolvedValue(mockResults);

        await runCoreAudit(mockElement, {
            rules: { 'color-contrast': { enabled: false } }
        });

        expect(axe.run).toHaveBeenCalledWith(mockElement, {
            rules: { 'color-contrast': { enabled: false } }
        });
    });

    it('propagates axe-core errors', async () => {
        const axe = (await import('axe-core')).default;

        (axe.run as jest.Mock).mockRejectedValueOnce(new Error('axe failed'));

        await expect(runCoreAudit(mockElement)).rejects.toThrow('axe failed');
    });
});

describe('accepted violations', () => {
    const contrastViolation: Result = { id: 'color-contrast', impact: 'serious', description: '', nodes: [], tags: [], help: '', helpUrl: '' };
    const contrast = { rule: 'color-contrast', reason: 'The placeholder is muted by design.' };

    it('does not count an accepted violation', () => {
        const result = calculateScore({ ...mockResults, violations: [contrastViolation] }, [contrast]);

        expect(result).toMatchObject({ score: 100, serious: 0, violations: 0 });
    });

    describe('in the audit service', () => {
        const element = { closest: () => null } as unknown as Element;
        let service: A11yAuditService;

        beforeEach(() => {
            jest.useFakeTimers();
            (axe.run as jest.Mock).mockResolvedValue({ ...mockResults, violations: [contrastViolation] });
            const injector = Injector.create({ providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } }] });

            service = runInInjectionContext(injector, () => new A11yAuditService());
        });
        afterEach(() => jest.useRealTimers());

        async function audit(): Promise<void> {
            await jest.advanceTimersByTimeAsync(500);
        }

        it('sets an accepted violation apart from the counted ones', async () => {
            service.scheduleAudit(element, { accept: [contrast] });
            await audit();

            expect(service.scoreResult()).toMatchObject({ score: 100, serious: 0 });
            expect(service.violations()).toEqual([]);
            expect(service.accepted()).toEqual([{ ...contrastViolation, reason: contrast.reason }]);
        });

        it('grades with the acceptances of the audit it last scheduled, not of the variant before', async () => {
            service.scheduleAudit(element, { accept: [contrast] });
            service.scheduleAudit(element, {});
            await audit();

            expect(service.scoreResult()).toMatchObject({ serious: 1 });
            expect(service.accepted()).toEqual([]);
        });
    });
});

describe('audit condition', () => {
    const element = { closest: () => null } as unknown as Element;
    let service: A11yAuditService;

    beforeEach(() => {
        jest.useFakeTimers();
        (axe.run as jest.Mock).mockReset();
        (axe.run as jest.Mock).mockResolvedValue(mockResults);
        const injector = Injector.create({ providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } }] });

        service = runInInjectionContext(injector, () => new A11yAuditService());
    });
    afterEach(() => jest.useRealTimers());

    it('stores the condition with the result it belongs to', async () => {
        service.scheduleAudit(element, {}, 0, 'Dark scheme');
        await jest.advanceTimersByTimeAsync(0);

        expect(service.results()).not.toBeNull();
        expect(service.condition()).toBe('Dark scheme');
        service.clear();
        expect(service.condition()).toBeNull();
    });

    it('audits the real environment unless told otherwise', async () => {
        service.scheduleAudit(element, {}, 0);
        await jest.advanceTimersByTimeAsync(0);

        expect(service.condition()).toBeNull();
    });

    it('does not name a condition before its audit has landed', async () => {
        service.scheduleAudit(element, {}, 0);
        await jest.advanceTimersByTimeAsync(0);
        service.scheduleAudit(element, {}, 500, 'Dark scheme');

        expect(service.condition()).toBeNull();
        await jest.advanceTimersByTimeAsync(500);
        expect(service.condition()).toBe('Dark scheme');
    });

    it('drops the condition of a result when the next audit runs under none', async () => {
        service.scheduleAudit(element, {}, 0, 'Light scheme');
        await jest.advanceTimersByTimeAsync(0);
        service.scheduleAudit(element, {}, 0);
        await jest.advanceTimersByTimeAsync(0);

        expect(service.condition()).toBeNull();
    });

    it('never pairs the results of a run in flight with a newer condition', async () => {
        let land!: (r: AxeResults) => void;

        (axe.run as jest.Mock).mockReturnValueOnce(new Promise<AxeResults>((resolve) => (land = resolve)));
        service.scheduleAudit(element, {}, 0, 'Dark scheme');
        await jest.advanceTimersByTimeAsync(0);
        service.scheduleAudit(element, {}, 500, 'Light scheme');
        land(mockResults);
        await jest.advanceTimersByTimeAsync(0);

        // The run that landed audited the dark scheme, and says so; the light one is still pending.
        expect(service.condition()).toBe('Dark scheme');
        await jest.advanceTimersByTimeAsync(500);
        expect(service.condition()).toBe('Light scheme');
    });

    it('keeps the condition of the last good result when an audit fails', async () => {
        service.scheduleAudit(element, {}, 0, 'Dark scheme');
        await jest.advanceTimersByTimeAsync(0);
        (axe.run as jest.Mock).mockRejectedValueOnce(new Error('axe failed'));
        service.scheduleAudit(element, {}, 0, 'Light scheme');
        await jest.advanceTimersByTimeAsync(0);

        expect(service.error()).toBe('axe failed');
        expect(service.condition()).toBe('Dark scheme');
    });
});
