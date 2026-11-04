import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { BuilderContext } from '@angular-devkit/architect';
import ts from 'typescript';
import { createPipelineState, runPrismPipeline } from './prism-pipeline.js';

const FIXTURES_DIR = join(__dirname, '..', 'scanner', '__fixtures__');
const MULTI_ENTRY_FIXTURES_DIR = join(__dirname, '__fixtures__', 'multi-entry-lib');
const CONFIG_FIXTURE = join(__dirname, '__fixtures__', 'ng-prism.config.ts');

function createTempWorkspace(): string {
    const tmp = mkdtempSync(join(tmpdir(), 'ng-prism-pipeline-'));

    cpSync(FIXTURES_DIR, join(tmp, 'lib'), { recursive: true });
    cpSync(CONFIG_FIXTURE, join(tmp, 'ng-prism.config.ts'));
    return tmp;
}

function createMultiEntryWorkspace(): string {
    const tmp = mkdtempSync(join(tmpdir(), 'ng-prism-pipeline-multi-'));

    cpSync(MULTI_ENTRY_FIXTURES_DIR, join(tmp, 'lib'), { recursive: true });
    cpSync(CONFIG_FIXTURE, join(tmp, 'ng-prism.config.ts'));
    return tmp;
}

function createMockContext(workspaceRoot: string) {
    return {
        workspaceRoot,
        reportStatus: jest.fn(),
        logger: { info: jest.fn(), warn: jest.fn() }
    } as unknown as BuilderContext;
}

function writeA11yReport(root: string, score: number, className = 'ButtonComponent'): void {
    writeFileSync(
        join(root, 'a11y-report.json'),
        JSON.stringify({
            // total meets every threshold, otherwise checkA11yThresholds throws
            // before the merge runs.
            total: {
                score: 95,
                violations: 0,
                critical: 0,
                serious: 0,
                moderate: 0,
                minor: 0,
                passes: 40,
                incomplete: 0,
                auditedComponents: 1,
                auditedVariants: 5
            },
            components: {
                [className]: {
                    score,
                    violations: 1,
                    critical: 0,
                    serious: 0,
                    moderate: 1,
                    minor: 0,
                    passes: 20,
                    incomplete: 0
                }
            }
        }),
        'utf-8'
    );
}

/** A report whose total has two serious violations: over a limit of 0, under one of 5. */
function writeSeriousA11yReport(root: string): void {
    const score = { score: 80, violations: 2, critical: 0, serious: 2, moderate: 0, minor: 0, passes: 20, incomplete: 0 };

    writeFileSync(
        join(root, 'a11y-report.json'),
        JSON.stringify({ total: { ...score, auditedComponents: 1, auditedVariants: 1 }, components: { ButtonComponent: score } }),
        'utf-8'
    );
}

function writeA11yConfig(root: string, a11y: string): void {
    writeFileSync(join(root, 'ng-prism.config.ts'), `export default { a11y: ${a11y} };`, 'utf-8');
}

function readManifest(root: string): string {
    return readFileSync(join(root, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');
}

describe('runPrismPipeline integration', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const defaultOptions = {
        entryPoint: 'lib/public-api.ts',
        libraryImportPath: 'my-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };

    it('should return correct componentCount', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        expect(result.componentCount).toBe(9);
    });

    it('names where it reads the a11y report, for serve to watch, whether or not it exists', async () => {
        tmp = createTempWorkspace();

        const result = await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

        expect(result.a11yReportPath).toBe(join(tmp, 'a11y-report.json'));

        writeA11yConfig(tmp, "{ reportPath: 'coverage/a11y.json' }");

        const configured = await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

        expect(configured.a11yReportPath).toBe(join(tmp, 'coverage', 'a11y.json'));
    });

    it('should write prism-manifest.ts to expected path', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        expect(existsSync(result.manifestPath)).toBe(true);
        expect(result.manifestPath).toBe(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'));
    });

    it('should generate manifest with component imports', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain(
            'import { ButtonComponent, CardComponent, SignalButtonComponent, ModelInputComponent, HighlightDirective, InvalidBgComponent, InvalidStatusComponent, DeprecatedBgComponent, SectionedComponent } from "my-lib"'
        );
    });

    it('should include component type references (not strings)', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('type: ButtonComponent,');
        expect(content).toContain('type: CardComponent,');
        expect(content).toContain('type: SignalButtonComponent,');
    });

    it('should write to default cache path when cacheDir option is undefined', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        expect(result.manifestPath).toBe(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'));
        expect(existsSync(result.manifestPath)).toBe(true);
    });

    it('should write to cacheDir override when provided', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const customCacheDir = join(tmp, '.custom-cache');

        const result = await runPrismPipeline({ ...defaultOptions, cacheDir: customCacheDir }, ctx, createPipelineState());

        expect(result.manifestPath).toBe(join(customCacheDir, 'my-lib-prism', 'prism-manifest.ts'));
        expect(existsSync(result.manifestPath)).toBe(true);
    });

    it('should call reportStatus and logger.info', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(defaultOptions, ctx, createPipelineState());

        expect(ctx.reportStatus).toHaveBeenCalledWith('Loading ng-prism config...');
        expect(ctx.reportStatus).toHaveBeenCalledWith('Scanning components...');
        expect(ctx.reportStatus).toHaveBeenCalledWith('Running plugin hooks...');
        expect(ctx.reportStatus).toHaveBeenCalledWith('Generating runtime manifest...');
        expect(ctx.reportStatus).toHaveBeenCalledWith('');
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Generated manifest with 9 component(s)'));
    });

    it('merges the per-component a11y entry into showcaseConfig.meta', async () => {
        tmp = createTempWorkspace();
        // 70 sits in the warn band (from 0.75 of the default target 80 up);
        // below 60 the summary is critical since 22.7.
        writeA11yReport(tmp, 70);

        await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

        const content = readManifest(tmp);

        expect(content).toContain('a11y:');
        expect(content).toContain('variant: "warn"');
    });

    it("keeps a component's own meta.a11y next to the report entry", async () => {
        tmp = createTempWorkspace();
        writeFileSync(
            join(tmp, 'lib', 'a11y-rules.component.ts'),
            `import { Component } from '@angular/core';

function Showcase(config: object): ClassDecorator {
    return () => {};
}

@Showcase({
    title: 'Rules',
    meta: { a11y: { rules: { 'color-contrast': { enabled: false } }, disable: false } }
})
@Component({ selector: 'lib-rules', standalone: true, template: '' })
export class RulesComponent {}
`,
            'utf-8'
        );
        writeFileSync(join(tmp, 'lib', 'a11y-rules-api.ts'), "export { RulesComponent } from './a11y-rules.component.js';\n", 'utf-8');
        writeA11yReport(tmp, 70, 'RulesComponent');

        await runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/a11y-rules-api.ts' }, createMockContext(tmp), createPipelineState());

        const content = readManifest(tmp);

        // The panel reads `rules` and `disable` from here; the report entry goes beside them.
        expect(content).toMatch(/"color-contrast": \{\s*enabled: false,\s*\}/);
        expect(content).toContain('disable: false');
        expect(content).toContain('found: true');
        expect(content).toContain('variant: "warn"');
    });

    describe('a11y gate', () => {
        it('grades without failing the build with gate: false', async () => {
            tmp = createTempWorkspace();
            writeSeriousA11yReport(tmp);
            writeA11yConfig(tmp, '{ thresholds: { serious: 0 }, gate: false }');

            await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

            const content = readManifest(tmp);

            expect(content).toContain('variant: "danger"');
            expect(content).toMatch(/thresholds: \{[^}]*serious: 0/);
        });

        it('gates with the grading thresholds while gate is not set, and names gate in the error', async () => {
            tmp = createTempWorkspace();
            writeSeriousA11yReport(tmp);
            writeA11yConfig(tmp, '{ thresholds: { serious: 0 } }');

            await expect(runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState())).rejects.toThrow(
                /a11y thresholds violated: serious: 2 \(threshold 0\)\..*config\.a11y\.gate/
            );
        });

        it('gates with its own limits and grades with the thresholds', async () => {
            tmp = createTempWorkspace();
            writeSeriousA11yReport(tmp);
            writeA11yConfig(tmp, '{ thresholds: { serious: 0 }, gate: { serious: 5, score: 0 } }');

            await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

            expect(readManifest(tmp)).toMatch(/thresholds: \{[^}]*serious: 0/);
        });

        it('warns instead of failing in warn mode, and still writes the report data', async () => {
            tmp = createTempWorkspace();
            writeSeriousA11yReport(tmp);
            writeA11yConfig(tmp, '{ thresholds: { serious: 0 } }');
            const ctx = createMockContext(tmp);

            await runPrismPipeline({ ...defaultOptions, a11yGate: 'warn' }, ctx, createPipelineState());

            expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/a11y thresholds violated: serious: 2 \(threshold 0\)/));
            expect(readManifest(tmp)).toContain('variant: "danger"');
        });

        it('has nothing to gate without a report', async () => {
            tmp = createTempWorkspace();
            writeA11yConfig(tmp, '{ gate: { serious: 0 } }');

            await expect(runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState())).resolves.toBeDefined();
        });
    });

    it('fails on a dropped @Showcase value when strictShowcase is on, before writing a manifest', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'ng-prism.config.ts'), 'export default { strictShowcase: true };', 'utf-8');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            await expect(runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/unevaluable-api.ts' }, createMockContext(tmp), createPipelineState())).rejects.toThrow(
                /strictShowcase is enabled and 10 @Showcase value\(s\) were dropped/
            );
            expect(existsSync(join(tmp, 'ng-prism-cache'))).toBe(false);
        } finally {
            warn.mockRestore();
        }
    });

    it('fails on a partOf that matches no component when strictShowcase is on', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'ng-prism.config.ts'), 'export default { strictShowcase: true };', 'utf-8');
        writeFileSync(join(tmp, 'lib', 'orphan-api.ts'), "export { OrphanComponent, SelectComponent } from './parts-select.component.js';\n", 'utf-8');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            await expect(runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/orphan-api.ts' }, createMockContext(tmp), createPipelineState())).rejects.toThrow(
                /strictShowcase is enabled and 1 @Showcase value/
            );
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('OrphanComponent › partOf — no component or directive with @Showcase has the selector "lib-missing"')
            );
        } finally {
            warn.mockRestore();
        }
    });

    it('does not fail strictShowcase over what a resolved part drops', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'ng-prism.config.ts'), 'export default { strictShowcase: true };', 'utf-8');
        writeFileSync(join(tmp, 'lib', 'part-api.ts'), "export { OptionComponent, SelectComponent } from './parts-select.component.js';\n", 'utf-8');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            const result = await runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/part-api.ts' }, createMockContext(tmp), createPipelineState());

            // The part is nested on its parent, so only the parent counts.
            expect(result.componentCount).toBe(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('OptionComponent › variants — has no effect on a part'));
        } finally {
            warn.mockRestore();
        }
    });

    it('writes a part on its parent in the runtime manifest, not as a component of its own', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'lib', 'part-api.ts'), "export { OptionComponent, SelectComponent } from './parts-select.component.js';\n", 'utf-8');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            await runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/part-api.ts' }, createMockContext(tmp), createPipelineState());

            const source = readManifest(tmp);

            expect(source.match(/^ {6}type: .*$/gm)).toEqual(['      type: SelectComponent,']);
            expect(source).toMatch(/ {6}parts: \[\s*\{\s*meta: \{\s*className: "OptionComponent"/);
            expect(source).not.toMatch(/import \{[^}]*\bOptionComponent\b/);
        } finally {
            warn.mockRestore();
        }
    });

    it('only warns about a dropped @Showcase value while strictShowcase is off', async () => {
        tmp = createTempWorkspace();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            const result = await runPrismPipeline({ ...defaultOptions, entryPoint: 'lib/unevaluable-api.ts' }, createMockContext(tmp), createPipelineState());

            expect(result.componentCount).toBe(6);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('UnevaluableShowcaseComponent › variants[1] "Auto hint" › inputs.maxFileSize'));
        } finally {
            warn.mockRestore();
        }
    });

    it('leaves components untouched when no report exists', async () => {
        tmp = createTempWorkspace();

        await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

        expect(readManifest(tmp)).not.toContain('a11y:');
    });

    it('does not overwrite plugin meta written by runPluginHooks when merging the a11y entry', async () => {
        // The a11y merge runs after runPluginHooks specifically so a plugin's
        // `showcaseConfig.meta` survives it. Swapping the order of the two
        // blocks in `runPrismPipeline` (or having the a11y merge replace
        // `meta` outright instead of spreading it) would silently drop
        // whatever a plugin wrote, and every other test in this file uses a
        // config with no a11y report or a plugin that leaves no trace in
        // `showcaseConfig.meta`, so none of them would catch it.
        tmp = createTempWorkspace();
        // 70 sits in the warn band (from 0.75 of the default target 80 up);
        // below 60 the summary is critical since 22.7.
        writeA11yReport(tmp, 70);
        // `Object.assign` rather than object-spread: this file is transpiled and
        // then dynamically `import()`-ed from a temp path outside the workspace
        // (see config-loader.ts), which Jest's own transform also reaches for,
        // and its helper injection for object spread can't resolve `@swc/helpers`
        // from that temp path. The pre-existing `test-meta-plugin` fixture beside
        // this one works around the same thing the same way.
        writeFileSync(
            join(tmp, 'ng-prism.config.ts'),
            `export default {
        plugins: [
          {
            name: 'test-showcase-meta-plugin',
            onComponentScanned(component) {
              var meta = Object.assign({}, component.showcaseConfig.meta, { fromPlugin: 'still-here' });
              var showcaseConfig = Object.assign({}, component.showcaseConfig, { meta: meta });
              return Object.assign({}, component, { showcaseConfig: showcaseConfig });
            },
          },
        ],
      };`,
            'utf-8'
        );

        await runPrismPipeline(defaultOptions, createMockContext(tmp), createPipelineState());

        const content = readManifest(tmp);

        expect(content).toContain('fromPlugin: "still-here"');
        expect(content).toContain('a11y:');
    });
});

describe('runPrismPipeline multi-entry-point integration', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const multiOptions = {
        entryPoint: 'lib',
        libraryImportPath: 'multi-entry-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };

    it('should discover and scan secondary entry points', async () => {
        tmp = createMultiEntryWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(multiOptions, ctx, createPipelineState());

        expect(result.componentCount).toBe(2);
    });

    it('should generate grouped imports per entry point', async () => {
        tmp = createMultiEntryWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(multiOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('from "multi-entry-lib/atoms/icon"');
        expect(content).toContain('from "multi-entry-lib/atoms/pill"');
        expect(content).not.toContain('from "multi-entry-lib";');
    });

    it('should include component type references', async () => {
        tmp = createMultiEntryWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(multiOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('type: PillComponent,');
        expect(content).toContain('type: IconComponent,');
    });

    it('should auto-detect library root from a file entryPoint and discover secondaries', async () => {
        tmp = createMultiEntryWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline({ ...multiOptions, entryPoint: 'lib/public-api.ts' }, ctx, createPipelineState());

        expect(result.componentCount).toBe(2);

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'my-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('from "multi-entry-lib/atoms/icon"');
        expect(content).toContain('from "multi-entry-lib/atoms/pill"');
        expect(content).not.toContain('from "multi-entry-lib";');
    });
});

describe('runPrismPipeline entry point resolution', () => {
    let tmp: string;
    let warn: jest.SpyInstance;

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warn.mockRestore();
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const options = {
        libraryImportPath: 'my-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };

    function writeBadgeComponent(dir: string): void {
        writeFileSync(
            join(dir, 'badge.component.ts'),
            [
                "import { Component, input } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                "@Showcase({ title: 'Badge', variants: [{ name: 'Default' }] })",
                "@Component({ selector: 'ui-badge', standalone: true, template: '<span></span>' })",
                'export class BadgeComponent {',
                "    label = input<string>('');",
                '}'
            ].join('\n'),
            'utf-8'
        );
    }

    it('scans the primary entry file of a library directory without secondary entry points', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'lib', 'ng-package.json'), JSON.stringify({ dest: '../dist/my-lib', lib: { entryFile: './public-api.ts' } }), 'utf-8');

        const fromFile = await runPrismPipeline({ ...options, entryPoint: 'lib/public-api.ts' }, createMockContext(tmp), createPipelineState());
        const fromDirectory = await runPrismPipeline({ ...options, entryPoint: 'lib' }, createMockContext(tmp), createPipelineState());

        expect(fromDirectory.componentCount).toBeGreaterThan(0);
        expect(fromDirectory.componentCount).toBe(fromFile.componentCount);
    });

    it('scans the primary entry point next to the secondary ones', async () => {
        tmp = createMultiEntryWorkspace();
        writeBadgeComponent(join(tmp, 'lib'));
        writeFileSync(join(tmp, 'lib', 'public-api.ts'), "export { BadgeComponent } from './badge.component.js';\n", 'utf-8');

        const result = await runPrismPipeline({ ...options, libraryImportPath: 'multi-entry-lib', entryPoint: 'lib' }, createMockContext(tmp), createPipelineState());

        expect(result.componentCount).toBe(3);
        expect(readManifest(tmp)).toContain('from "multi-entry-lib";');
        expect(readManifest(tmp)).toContain('type: BadgeComponent,');
    });

    it('keeps a component the primary entry point re-exports under its secondary entry point, without a warning', async () => {
        tmp = createMultiEntryWorkspace();
        writeFileSync(join(tmp, 'lib', 'public-api.ts'), "export * from './atoms/pill/public-api.js';\n", 'utf-8');

        const result = await runPrismPipeline({ ...options, libraryImportPath: 'multi-entry-lib', entryPoint: 'lib' }, createMockContext(tmp), createPipelineState());

        expect(result.componentCount).toBe(2);
        expect(readManifest(tmp)).toContain('from "multi-entry-lib/atoms/pill"');
        expect(readManifest(tmp)).not.toContain('from "multi-entry-lib";');
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('multiple entry points'));
    });

    it('warns when the entryPoint resolves to no entry file at all', async () => {
        tmp = createTempWorkspace();

        const result = await runPrismPipeline({ ...options, entryPoint: 'lib' }, createMockContext(tmp), createPipelineState());

        expect(result.componentCount).toBe(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('⚠ ng-prism: entryPoint "lib" resolves to no entry file'));
    });
});

describe('runPrismPipeline services', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const options = {
        entryPoint: 'lib/public-api.ts',
        libraryImportPath: 'my-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };
    const HINT =
        'ng-prism: 1 service(s) with @Showcase found, but no plugin shows services; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.';

    /** A library of one component and one service, whose setup function the entry point exports. */
    function createServicesWorkspace(config: string): string {
        const root = mkdtempSync(join(tmpdir(), 'ng-prism-pipeline-services-'));
        const lib = join(root, 'lib');

        mkdirSync(lib);
        writeFileSync(join(root, 'ng-prism.config.ts'), config, 'utf-8');
        writeFileSync(
            join(lib, 'public-api.ts'),
            ["export { BadgeComponent } from './badge.component.js';", "export { provideToast, ToastService } from './toast.service.js';", ''].join('\n'),
            'utf-8'
        );
        writeFileSync(
            join(lib, 'badge.component.ts'),
            [
                "import { Component } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                "@Showcase({ title: 'Badge' })",
                "@Component({ selector: 'ui-badge', standalone: true, template: '<span></span>' })",
                'export class BadgeComponent {}',
                ''
            ].join('\n'),
            'utf-8'
        );
        writeFileSync(
            join(lib, 'toast.service.ts'),
            [
                "import { Injectable } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                'export function provideToast(): unknown[] {',
                '    return [];',
                '}',
                "@Showcase({ title: 'Toast Service', setup: () => [provideToast] })",
                "@Injectable({ providedIn: 'root' })",
                'export class ToastService {',
                '    show(message: string): void {}',
                '}',
                ''
            ].join('\n'),
            'utf-8'
        );
        return root;
    }

    /** `Object.assign` rather than spread, for the reason the a11y test above gives. */
    const SERVICE_PANEL_CONFIG = `export default {
      plugins: [
        {
          name: 'test-service-panel-plugin',
          panels: [{ id: 'api', label: 'API', placement: 'view', appliesTo: ['service'] }],
          onServiceScanned(service) {
            return Object.assign({}, service, { meta: { fromPlugin: 'service-hook' } });
          },
        },
      ],
    };`;

    function hintsLogged(ctx: BuilderContext): unknown[][] {
        return (ctx.logger.info as jest.Mock).mock.calls.filter(([message]) => String(message).includes('no plugin shows services'));
    }

    it('drops services and logs a hint when no panel shows services', async () => {
        tmp = createServicesWorkspace('export default { plugins: [] };');
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.serviceCount).toBe(0);
        expect(result.componentCount).toBe(1);
        expect(ctx.logger.info).toHaveBeenCalledWith(HINT);
        expect(hintsLogged(ctx)).toHaveLength(1);
        expect(readManifest(tmp)).not.toContain('services:');
        expect(readManifest(tmp)).not.toContain('ToastService');
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\) at /));
    });

    it('does not count a panel that applies to components only as one that shows services', async () => {
        tmp = createServicesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', appliesTo: ['component'] }] }] };"
        );
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.serviceCount).toBe(0);
        expect(hintsLogged(ctx)).toHaveLength(1);
    });

    it('logs the hint once per builder run, not on every rebuild of serve', async () => {
        tmp = createServicesWorkspace('export default { plugins: [] };');
        const ctx = createMockContext(tmp);
        const state = createPipelineState();

        await runPrismPipeline(options, ctx, state);
        await runPrismPipeline(options, ctx, state);

        expect(hintsLogged(ctx)).toHaveLength(1);

        await runPrismPipeline(options, ctx, createPipelineState());

        expect(hintsLogged(ctx)).toHaveLength(2);
    });

    it('only counts the services when nothing shows them, so what it cannot read in them does not fail strictShowcase', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            tmp = createServicesWorkspace('export default { strictShowcase: true, plugins: [] };');
            const servicePath = join(tmp, 'lib', 'toast.service.ts');

            writeFileSync(servicePath, readFileSync(servicePath, 'utf-8').replace('setup: () => [provideToast]', 'setup: provideToast'), 'utf-8');

            const result = await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

            expect(result.serviceCount).toBe(0);
            expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('ToastService › setup'));

            writeFileSync(join(tmp, 'ng-prism.config.ts'), SERVICE_PANEL_CONFIG.replace('export default {', 'export default {\n      strictShowcase: true,'), 'utf-8');

            await expect(runPrismPipeline(options, createMockContext(tmp), createPipelineState())).rejects.toThrow(/strictShowcase is enabled and 1 @Showcase value/);
        } finally {
            warn.mockRestore();
        }
    });

    it('writes the API of a component into the manifest only when a plugin asks for it', async () => {
        tmp = createServicesWorkspace('export default { plugins: [] };');

        await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        expect(readManifest(tmp)).not.toContain('api:');

        writeFileSync(join(tmp, 'ng-prism.config.ts'), "export default { plugins: [{ name: 'api-reader', componentApi: true }] };", 'utf-8');
        await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        expect(readManifest(tmp)).toContain('api:');
    });

    it('does not count an addon panel that applies to services as one that shows services', async () => {
        tmp = createServicesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A', appliesTo: ['service'] }, { id: 'b', label: 'B', placement: 'addon', appliesTo: ['component', 'service'] }] }] };"
        );
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.serviceCount).toBe(0);
        expect(hintsLogged(ctx)).toHaveLength(1);
    });

    it('does not turn the hint into a diagnostic: strictShowcase stays quiet about dropped services', async () => {
        tmp = createServicesWorkspace('export default { strictShowcase: true };');
        const ctx = createMockContext(tmp);

        await expect(runPrismPipeline(options, ctx, createPipelineState())).resolves.toMatchObject({ serviceCount: 0 });
    });

    it('keeps services when a plugin panel applies to services', async () => {
        tmp = createServicesWorkspace(SERVICE_PANEL_CONFIG);
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.serviceCount).toBe(1);
        expect(hintsLogged(ctx)).toHaveLength(0);
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\), 1 service\(s\) at /));
    });

    it('keeps services when one panel applies to both components and services', async () => {
        tmp = createServicesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A', placement: 'view', appliesTo: ['component', 'service'] }] }] };"
        );

        const result = await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        expect(result.serviceCount).toBe(1);
    });

    it('runs onServiceScanned and writes the services into the runtime manifest as data', async () => {
        tmp = createServicesWorkspace(SERVICE_PANEL_CONFIG);

        await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        const content = readManifest(tmp);

        expect(content).toContain('services: [');
        expect(content).toContain('className: "ToastService"');
        expect(content).toContain('fromPlugin: "service-hook"');
        expect(content).toContain('importPath: "my-lib"');
        expect(content).toContain('name: "provideToast"');
        expect(content).toContain('import { BadgeComponent } from "my-lib";');
        expect(content).not.toMatch(/import \{[^}]*ToastService/);
    });

    it('lists services in the log line before the pages', async () => {
        tmp = createServicesWorkspace(SERVICE_PANEL_CONFIG.replace('export default {', "export default {\n  pages: [{ type: 'custom', title: 'Intro', data: {} }],"));
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pageCount).toBe(1);
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\), 1 service\(s\) and 1 page\(s\) at /));
    });

    it('writes no services and logs no hint for a library that has none', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline({ ...options, libraryImportPath: 'my-lib' }, ctx, createPipelineState());

        expect(result.serviceCount).toBe(0);
        expect(hintsLogged(ctx)).toHaveLength(0);
        expect(readManifest(tmp)).not.toContain('services:');
    });
});

describe('runPrismPipeline pipes', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const options = {
        entryPoint: 'lib/public-api.ts',
        libraryImportPath: 'my-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };
    const HINT =
        'ng-prism: 1 pipe(s) with @Showcase found, but no plugin shows pipes; add jsDocPlugin() from @ng-prism/plugin-jsdoc 22.7.0 or newer to ng-prism.config.ts to list them.';

    /** A library of one component, one pipe whose setup function the entry point exports, and one service. */
    function createPipesWorkspace(config: string): string {
        const root = mkdtempSync(join(tmpdir(), 'ng-prism-pipeline-pipes-'));
        const lib = join(root, 'lib');

        mkdirSync(lib);
        writeFileSync(join(root, 'ng-prism.config.ts'), config, 'utf-8');
        writeFileSync(
            join(lib, 'public-api.ts'),
            [
                "export { BadgeComponent } from './badge.component.js';",
                "export { provideTimeAgo, TimeAgoPipe } from './time-ago.pipe.js';",
                "export { ToastService } from './toast.service.js';",
                ''
            ].join('\n'),
            'utf-8'
        );
        writeFileSync(
            join(lib, 'badge.component.ts'),
            [
                "import { Component } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                "@Showcase({ title: 'Badge' })",
                "@Component({ selector: 'ui-badge', standalone: true, template: '<span></span>' })",
                'export class BadgeComponent {}',
                ''
            ].join('\n'),
            'utf-8'
        );
        writeFileSync(
            join(lib, 'time-ago.pipe.ts'),
            [
                "import { Pipe, type PipeTransform } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                'export function provideTimeAgo(): unknown[] {',
                '    return [];',
                '}',
                "@Showcase({ title: 'Time ago', setup: () => [provideTimeAgo] })",
                "@Pipe({ name: 'timeAgo' })",
                'export class TimeAgoPipe implements PipeTransform {',
                '    transform(value: Date): string {',
                "        return '';",
                '    }',
                '}',
                ''
            ].join('\n'),
            'utf-8'
        );
        writeFileSync(
            join(lib, 'toast.service.ts'),
            [
                "import { Injectable } from '@angular/core';",
                'function Showcase(config: Record<string, unknown>): ClassDecorator {',
                '    return () => {};',
                '}',
                "@Showcase({ title: 'Toast Service' })",
                "@Injectable({ providedIn: 'root' })",
                'export class ToastService {',
                '    show(message: string): void {}',
                '}',
                ''
            ].join('\n'),
            'utf-8'
        );
        return root;
    }

    /** `Object.assign` rather than spread, for the reason the a11y test above gives. */
    const PIPE_PANEL_CONFIG = `export default {
      plugins: [
        {
          name: 'test-pipe-panel-plugin',
          panels: [{ id: 'api', label: 'API', placement: 'view', appliesTo: ['pipe'] }],
          onPipeScanned(pipe) {
            return Object.assign({}, pipe, { meta: { fromPlugin: 'pipe-hook' } });
          },
        },
      ],
    };`;

    function hintsLogged(ctx: BuilderContext): unknown[][] {
        return (ctx.logger.info as jest.Mock).mock.calls.filter(([message]) => String(message).includes('no plugin shows pipes'));
    }

    it('drops pipes and logs a hint when no view panel applies to pipes', async () => {
        tmp = createPipesWorkspace('export default { plugins: [] };');
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pipeCount).toBe(0);
        expect(result.componentCount).toBe(1);
        expect(ctx.logger.info).toHaveBeenCalledWith(HINT);
        expect(hintsLogged(ctx)).toHaveLength(1);
        expect(readManifest(tmp)).not.toContain('pipes:');
        expect(readManifest(tmp)).not.toContain('TimeAgoPipe');
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\) at /));
    });

    it('does not count a panel that applies to components or services only as one that shows pipes', async () => {
        tmp = createPipesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', appliesTo: ['component'] }, { id: 'c', label: 'C', placement: 'view', appliesTo: ['service'] }] }] };"
        );
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pipeCount).toBe(0);
        expect(result.serviceCount).toBe(1);
        expect(hintsLogged(ctx)).toHaveLength(1);
    });

    it('does not count an addon panel that applies to pipes as one that shows pipes', async () => {
        tmp = createPipesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A', appliesTo: ['pipe'] }, { id: 'b', label: 'B', placement: 'addon', appliesTo: ['component', 'pipe'] }] }] };"
        );
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pipeCount).toBe(0);
        expect(hintsLogged(ctx)).toHaveLength(1);
    });

    it('does not turn the hint into a diagnostic: strictShowcase stays quiet about dropped pipes', async () => {
        tmp = createPipesWorkspace('export default { strictShowcase: true };');
        const ctx = createMockContext(tmp);

        await expect(runPrismPipeline(options, ctx, createPipelineState())).resolves.toMatchObject({ pipeCount: 0 });
    });

    it('keeps pipes when a view panel applies to pipes', async () => {
        tmp = createPipesWorkspace(PIPE_PANEL_CONFIG);
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pipeCount).toBe(1);
        expect(hintsLogged(ctx)).toHaveLength(0);
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\), 1 pipe\(s\) at /));
    });

    it('keeps pipes when one view panel applies to components, services and pipes', async () => {
        tmp = createPipesWorkspace(
            "export default { plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A', placement: 'view', appliesTo: ['component', 'service', 'pipe'] }] }] };"
        );

        const result = await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        expect(result.pipeCount).toBe(1);
        expect(result.serviceCount).toBe(1);
    });

    it('judges services and pipes on their own: a panel that shows pipes does not show services', async () => {
        tmp = createPipesWorkspace(PIPE_PANEL_CONFIG);
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pipeCount).toBe(1);
        expect(result.serviceCount).toBe(0);
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('1 service(s) with @Showcase found, but no plugin shows services'));
        expect(readManifest(tmp)).not.toContain('ToastService');
    });

    it('runs onPipeScanned and writes the pipes into the runtime manifest as data', async () => {
        tmp = createPipesWorkspace(PIPE_PANEL_CONFIG);

        await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        const content = readManifest(tmp);

        expect(content).toContain('pipes: [');
        expect(content).toContain('className: "TimeAgoPipe"');
        expect(content).toContain('pipeName: "timeAgo"');
        expect(content).toContain('fromPlugin: "pipe-hook"');
        expect(content).toContain('importPath: "my-lib"');
        expect(content).toContain('name: "provideTimeAgo"');
        expect(content).toContain('import { BadgeComponent } from "my-lib";');
        expect(content).not.toMatch(/import \{[^}]*TimeAgoPipe/);
    });

    it('lists pipes in the log line after the services and before the pages', async () => {
        tmp = createPipesWorkspace(
            "export default { pages: [{ type: 'custom', title: 'Intro', data: {} }], plugins: [{ name: 'p', panels: [{ id: 'a', label: 'A', placement: 'view', appliesTo: ['service', 'pipe'] }] }] };"
        );
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(options, ctx, createPipelineState());

        expect(result.pageCount).toBe(1);
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/with 1 component\(s\), 1 service\(s\), 1 pipe\(s\) and 1 page\(s\) at /));
    });

    it('writes no pipes and logs no hint for a library that has none', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline({ ...options, libraryImportPath: 'my-lib' }, ctx, createPipelineState());

        expect(result.pipeCount).toBe(0);
        expect(hintsLogged(ctx)).toHaveLength(0);
        expect(readManifest(tmp)).not.toContain('pipes:');
    });
});

describe('runPrismPipeline deprecated options', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('warns about deprecated config options it finds', async () => {
        tmp = createTempWorkspace();
        writeFileSync(join(tmp, 'ng-prism.config.ts'), "export default { themeStylesheet: 'theme.css' };\n", 'utf-8');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            await runPrismPipeline(
                { entryPoint: 'lib/public-api.ts', libraryImportPath: 'my-lib', prismProject: 'my-lib-prism', configFile: 'ng-prism.config.ts' },
                createMockContext(tmp),
                createPipelineState()
            );

            expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^⚠ ng-prism: ng-prism\.config\.ts sets "themeStylesheet", which is deprecated/));
        } finally {
            warn.mockRestore();
        }
    });
});

describe('runPrismPipeline tsconfig paths', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const options = {
        entryPoint: 'lib/public-api.ts',
        libraryImportPath: 'my-lib',
        prismProject: 'my-lib-prism',
        configFile: 'ng-prism.config.ts'
    };

    /** A workspace whose library re-exports a component through a `paths` alias set in an extended tsconfig. */
    function createAliasedWorkspace(): string {
        const root = createTempWorkspace();

        writeFileSync(join(root, 'tsconfig.base.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@shared/*': ['shared/*'] } } }));
        writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ extends: './tsconfig.base.json' }));
        mkdirSync(join(root, 'shared'));
        writeFileSync(
            join(root, 'shared', 'aliased.component.ts'),
            [
                "import { Component } from '@angular/core';",
                'function Showcase(config: { title: string }): ClassDecorator {',
                '    return () => {};',
                '}',
                "@Showcase({ title: 'Aliased' })",
                "@Component({ selector: 'aliased', template: '' })",
                'export class AliasedComponent {}',
                ''
            ].join('\n')
        );

        const entry = join(root, 'lib', 'public-api.ts');

        writeFileSync(entry, `${readFileSync(entry, 'utf-8')}export { AliasedComponent } from '@shared/aliased.component';\n`);
        return root;
    }

    it('should resolve imports through the paths of an extended tsconfig', async () => {
        tmp = createAliasedWorkspace();

        await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

        expect(readManifest(tmp)).toContain('type: AliasedComponent,');
    });

    it('should not enumerate the files the tsconfig includes', async () => {
        tmp = createAliasedWorkspace();
        const readDirectory = jest.spyOn(ts.sys, 'readDirectory');

        try {
            await runPrismPipeline(options, createMockContext(tmp), createPipelineState());

            expect(readDirectory).not.toHaveBeenCalled();
        } finally {
            readDirectory.mockRestore();
        }
    });
});

describe('createPipelineState', () => {
    it('should return independent state objects', () => {
        const a = createPipelineState();
        const b = createPipelineState();

        expect(a).not.toBe(b);
        expect(a.scanner).toBeUndefined();
        expect(b.scanner).toBeUndefined();
        expect(a.lastEntrySetKey).toBeUndefined();
        expect(b.lastEntrySetKey).toBeUndefined();
    });

    it('should populate scanner state after pipeline run', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();

        try {
            await runPrismPipeline(
                {
                    entryPoint: 'lib/public-api.ts',
                    libraryImportPath: 'my-lib',
                    prismProject: 'my-lib-prism',
                    configFile: 'ng-prism.config.ts'
                },
                ctx,
                state
            );

            expect(state.scanner).toBeDefined();
            expect(state.lastEntrySetKey).toBeDefined();
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should reuse the same scanner across pipeline invocations', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();

        try {
            const options = {
                entryPoint: 'lib/public-api.ts',
                libraryImportPath: 'my-lib',
                prismProject: 'my-lib-prism',
                configFile: 'ng-prism.config.ts'
            };

            await runPrismPipeline(options, ctx, state);
            const firstScanner = state.scanner;

            await runPrismPipeline(options, ctx, state);
            const secondScanner = state.scanner;

            expect(firstScanner).toBeDefined();
            expect(secondScanner).toBe(firstScanner);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('runPrismPipeline skip-write behavior', () => {
    it('should return written: true on first invocation', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        try {
            const result = await runPrismPipeline(
                {
                    entryPoint: 'lib/public-api.ts',
                    libraryImportPath: 'my-lib',
                    prismProject: 'my-lib-prism',
                    configFile: 'ng-prism.config.ts'
                },
                ctx,
                createPipelineState()
            );

            expect(result.written).toBe(true);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should return written: false when content is unchanged', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();
        const options = {
            entryPoint: 'lib/public-api.ts',
            libraryImportPath: 'my-lib',
            prismProject: 'my-lib-prism',
            configFile: 'ng-prism.config.ts'
        };

        try {
            await runPrismPipeline(options, ctx, state);
            const second = await runPrismPipeline(options, ctx, state);

            expect(second.written).toBe(false);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should leave file mtime unchanged when skip-write triggers', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();
        const options = {
            entryPoint: 'lib/public-api.ts',
            libraryImportPath: 'my-lib',
            prismProject: 'my-lib-prism',
            configFile: 'ng-prism.config.ts'
        };

        try {
            const first = await runPrismPipeline(options, ctx, state);
            const mtimeAfterFirst = statSync(first.manifestPath).mtimeMs;

            await new Promise((resolve) => setTimeout(resolve, 20));

            await runPrismPipeline(options, ctx, state);
            const mtimeAfterSecond = statSync(first.manifestPath).mtimeMs;

            expect(mtimeAfterSecond).toBe(mtimeAfterFirst);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should preserve the manifest file inode across rewrites (file watchers depend on this)', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();
        const options = {
            entryPoint: 'lib/public-api.ts',
            libraryImportPath: 'my-lib',
            prismProject: 'my-lib-prism',
            configFile: 'ng-prism.config.ts'
        };

        try {
            const first = await runPrismPipeline(options, ctx, state);
            const firstInode = statSync(first.manifestPath).ino;

            const buttonFile = join(tmp, 'lib', 'button.component.ts');
            const content = readFileSync(buttonFile, 'utf-8');
            const { writeFileSync } = await import('fs');

            writeFileSync(buttonFile, content.replace("title: 'Button',", "title: 'MutatedButton',"));

            const second = await runPrismPipeline(options, ctx, state);

            expect(second.written).toBe(true);
            expect(statSync(second.manifestPath).ino).toBe(firstInode);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should log "Generated" when written, "Verified (unchanged)" when skipped', async () => {
        const tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);
        const state = createPipelineState();
        const options = {
            entryPoint: 'lib/public-api.ts',
            libraryImportPath: 'my-lib',
            prismProject: 'my-lib-prism',
            configFile: 'ng-prism.config.ts'
        };

        try {
            await runPrismPipeline(options, ctx, state);
            expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Generated manifest'));

            (ctx.logger.info as jest.Mock).mockClear();

            await runPrismPipeline(options, ctx, state);
            expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Verified (unchanged) manifest'));
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});
