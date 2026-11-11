import {
    auditConditionLabel,
    DEFAULT_SIMULATION,
    emulatedMedia,
    FORCED_SETTINGS,
    forcedPalette,
    hasSimulationParams,
    isSimulating,
    joinLabels,
    MOTION_SETTINGS,
    parseSimulation,
    readSimulationParams,
    sameMedia,
    SCHEME_SETTINGS,
    schemeGround,
    simulationLabels,
    VISION_SETTINGS,
    writeSimulationParams
} from './simulation.js';

describe('simulation', () => {
    it('labels in menu order', () => {
        expect(simulationLabels({ motion: 'reduce', scheme: 'dark', forced: 'active', vision: 'deuteranopia' })).toEqual([
            'Reduced motion',
            'Dark scheme',
            'Forced colors (approx.)',
            'Deuteranopia'
        ]);
        expect(simulationLabels({ ...DEFAULT_SIMULATION, vision: 'blurred' })).toEqual(['Blurred vision']);
        expect(simulationLabels(DEFAULT_SIMULATION)).toEqual([]);
    });

    it('joins labels with a middle dot, the way the pill and the audit condition read', () => {
        expect(joinLabels([])).toBe('');
        expect(joinLabels(['Blurred vision'])).toBe('Blurred vision');
        expect(joinLabels(['Reduced motion', 'Dark scheme'])).toBe('Reduced motion · Dark scheme');
        // One joiner for both: the audit condition is the pill's text, minus what does not change colours.
        expect(auditConditionLabel({ ...DEFAULT_SIMULATION, scheme: 'dark', forced: 'active' })).toBe(joinLabels(['Dark scheme', 'Forced colors (approx.)']));
    });

    it('audit condition only names what changes computed styles', () => {
        expect(auditConditionLabel({ motion: 'reduce', scheme: 'system', forced: 'off', vision: 'tritanopia' })).toBeNull();
        expect(auditConditionLabel({ ...DEFAULT_SIMULATION, scheme: 'light', forced: 'active' })).toBe('Light scheme · Forced colors (approx.)');
    });

    it('emulates only what differs from System/Off/None', () => {
        expect(emulatedMedia(DEFAULT_SIMULATION)).toEqual({});
        expect(emulatedMedia({ motion: 'reduce', scheme: 'dark', forced: 'active', vision: 'none' })).toEqual({
            'prefers-reduced-motion': 'reduce',
            'prefers-color-scheme': 'dark',
            'forced-colors': 'active'
        });
    });

    it('compares emulations feature by feature', () => {
        expect(sameMedia({ 'prefers-color-scheme': 'dark' }, { 'prefers-color-scheme': 'dark' })).toBe(true);
        expect(sameMedia({}, {})).toBe(true);
        expect(sameMedia({ 'prefers-color-scheme': 'dark' }, { 'prefers-color-scheme': 'light' })).toBe(false);
        expect(sameMedia({ 'forced-colors': 'active' }, {})).toBe(false);
        expect(sameMedia({}, { 'prefers-reduced-motion': 'reduce' })).toBe(false);
    });

    it('scheme ground', () => {
        expect(schemeGround({ ...DEFAULT_SIMULATION, scheme: 'dark' })).toBe('dark');
        expect(schemeGround(DEFAULT_SIMULATION)).toBeNull();
    });

    it('forced palette: the emulated scheme, under System the system one', () => {
        expect(forcedPalette({ ...DEFAULT_SIMULATION, forced: 'active' }, 'light')).toBe('light');
        expect(forcedPalette({ ...DEFAULT_SIMULATION, forced: 'active' }, 'dark')).toBe('dark');
        expect(forcedPalette({ ...DEFAULT_SIMULATION, forced: 'active', scheme: 'dark' }, 'light')).toBe('dark');
        expect(forcedPalette({ ...DEFAULT_SIMULATION, forced: 'active', scheme: 'light' }, 'dark')).toBe('light');
        expect(forcedPalette({ ...DEFAULT_SIMULATION, scheme: 'light' }, 'dark')).toBeNull();
        expect(forcedPalette(DEFAULT_SIMULATION, 'dark')).toBeNull();
    });

    it('round-trips URL params, writing only non-defaults', () => {
        const p = new URLSearchParams('component=Button');

        writeSimulationParams({ motion: 'reduce', scheme: 'system', forced: 'off', vision: 'deuteranopia' }, p);
        expect(p.toString()).toBe('component=Button&motion=reduce&vision=deuteranopia');
        expect(readSimulationParams(p)).toEqual({ motion: 'reduce', scheme: 'system', forced: 'off', vision: 'deuteranopia' });
        expect(hasSimulationParams(p)).toBe(true);
        expect(hasSimulationParams(new URLSearchParams('component=Button'))).toBe(false);
    });

    it('replaces what an earlier simulation left in the params', () => {
        const p = new URLSearchParams('motion=reduce&component=Button&vision=blurred');

        writeSimulationParams({ ...DEFAULT_SIMULATION, vision: 'tritanopia' }, p);
        expect(p.toString()).toBe('component=Button&vision=tritanopia');
        writeSimulationParams(DEFAULT_SIMULATION, p);
        expect(p.toString()).toBe('component=Button');
    });

    it('counts a parameter as a statement even when its value is unusable', () => {
        expect(hasSimulationParams(new URLSearchParams('scheme=system'))).toBe(true);
        expect(hasSimulationParams(new URLSearchParams('scheme=sepia'))).toBe(true);
    });

    it('is simulating once anything differs from the default', () => {
        expect(isSimulating(DEFAULT_SIMULATION)).toBe(false);
        expect(isSimulating({ ...DEFAULT_SIMULATION, vision: 'blurred' })).toBe(true);
        expect(isSimulating({ ...DEFAULT_SIMULATION, forced: 'active' })).toBe(true);
    });

    it('lists the neutral value of every field first', () => {
        expect(MOTION_SETTINGS[0]).toBe(DEFAULT_SIMULATION.motion);
        expect(SCHEME_SETTINGS[0]).toBe(DEFAULT_SIMULATION.scheme);
        expect(FORCED_SETTINGS[0]).toBe(DEFAULT_SIMULATION.forced);
        expect(VISION_SETTINGS[0]).toBe(DEFAULT_SIMULATION.vision);
    });

    it('drops unknown values field by field', () => {
        expect(readSimulationParams(new URLSearchParams('motion=fast&scheme=dark&vision=x'))).toEqual({
            ...DEFAULT_SIMULATION,
            scheme: 'dark'
        });
        expect(parseSimulation({ motion: 'reduce', forced: 1 })).toEqual({ ...DEFAULT_SIMULATION, motion: 'reduce' });
        expect(parseSimulation(null)).toEqual(DEFAULT_SIMULATION);
    });
});
