import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import type { BuilderContext } from '@angular-devkit/architect';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createPipelineState, runPrismPipeline } from '../builder/shared/prism-pipeline.js';

const TEST_WORKSPACE_DIR = join(__dirname, '..', '..', '..', '..', 'test-workspace');

// Installed or generated locally, so copying them would tie the spec to the
// state of the developer's workspace (and cost ~385 MB per copy). The pipeline
// does not need `node_modules` here: CI never installs it for test-workspace.
const EXCLUDED_ENTRIES = new Set(['node_modules', 'dist', '.angular', 'ng-prism-cache']);

// The one package a showcase of test-lib imports from outside the library: the
// scan reads the class from its `.d.ts`, so it is linked from the repo's own.
const LINKED_PACKAGES = ['@angular/cdk'];

/** The classes the compositions of test-lib bring in, with or without a showcase of their own. */
const COMPOSITION_CLASSES = [
    'FormFieldComponent',
    'InputDirective',
    'IconComponent',
    'RadioGroupComponent',
    'RadioComponent',
    'ListItemComponent',
    'ListGroupComponent',
    'ListItemMetaDirective'
];

function createTempWorkspace(): string {
    const tmp = mkdtempSync(join(tmpdir(), 'ng-prism-integration-'));

    cpSync(TEST_WORKSPACE_DIR, tmp, {
        recursive: true,
        filter: (src) => !EXCLUDED_ENTRIES.has(relative(TEST_WORKSPACE_DIR, src))
    });

    for (const name of LINKED_PACKAGES) {
        mkdirSync(join(tmp, 'node_modules', dirname(name)), { recursive: true });
        symlinkSync(dirname(require.resolve(`${name}/package.json`)), join(tmp, 'node_modules', name), 'dir');
    }

    mkdirSync(join(tmp, 'projects', 'test-lib-prism', 'src'), {
        recursive: true
    });
    writeFileSync(join(tmp, 'projects', 'test-lib-prism', 'src', 'main.ts'), 'export {};\n', 'utf-8');

    const angularJson = JSON.parse(readFileSync(join(tmp, 'angular.json'), 'utf-8'));

    angularJson.projects['test-lib-prism'] = {
        projectType: 'application',
        root: 'projects/test-lib-prism',
        sourceRoot: 'projects/test-lib-prism/src',
        architect: {
            'prism-serve': {
                builder: '@ng-prism/core:serve',
                options: { libraryProject: 'test-lib' }
            },
            'prism-build': {
                builder: '@ng-prism/core:build',
                options: { libraryProject: 'test-lib' }
            }
        }
    };
    writeFileSync(join(tmp, 'angular.json'), JSON.stringify(angularJson, null, 2), 'utf-8');

    writeFileSync(
        join(tmp, 'ng-prism.config.ts'),
        [
            'export default {',
            '  plugins: [',
            '    {',
            "      name: 'test-integration-plugin',",
            '      onComponentScanned(component: Record<string, unknown>) {',
            "        const meta = component['meta'] as Record<string, unknown> ?? {};",
            "        meta['tested'] = true;",
            '        return Object.assign({}, component, { meta });',
            '      },',
            '    },',
            '  ],',
            '};'
        ].join('\n'),
        'utf-8'
    );

    return tmp;
}

function createMockContext(workspaceRoot: string) {
    return {
        workspaceRoot,
        reportStatus: jest.fn(),
        logger: { info: jest.fn() },
        getProjectMetadata: jest.fn().mockResolvedValue({
            sourceRoot: 'projects/test-lib-prism/src'
        })
    } as unknown as BuilderContext;
}

describe('test-workspace integration', () => {
    let tmp: string;

    afterEach(() => {
        if (tmp && existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    const pipelineOptions = {
        entryPoint: 'projects/test-lib/src/public-api.ts',
        libraryImportPath: 'test-lib',
        prismProject: 'test-lib-prism',
        configFile: 'ng-prism.config.ts'
    };

    it('should discover only @Showcase components from the library', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        expect(result.componentCount).toBe(22);
    });

    it('should write prism-manifest.ts into prism project', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        expect(existsSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'))).toBe(true);
    });

    it('should generate correct import statement', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('from "test-lib"');
        expect(content).toContain('ButtonComponent');
    });

    it('should include component type references', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('type: ButtonComponent,');
    });

    it('should exclude non-showcased components', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).not.toContain('InternalComponent');
    });

    it('should preserve showcase metadata in manifest', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        expect(content).toContain('title: "Button"');
        expect(content).toContain('category: "Inputs"');
        expect(content).toContain('variants:');
        expect(content).toContain('selector: "lib-button"');
        expect(content).toContain('standalone: true');
    });

    it('should apply plugin hooks from config', async () => {
        tmp = createTempWorkspace();
        const ctx = createMockContext(tmp);

        const result = await runPrismPipeline(pipelineOptions, ctx, createPipelineState());

        expect(result.componentCount).toBe(22);
        expect(ctx.reportStatus).toHaveBeenCalledWith('Loading ng-prism config...');
        expect(ctx.reportStatus).toHaveBeenCalledWith('Running plugin hooks...');
        expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Generated manifest with 22 component(s)'));
    });

    it('should compile the compositions of the form field, input, radio group and radio showcases', async () => {
        tmp = createTempWorkspace();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            await runPrismPipeline(pipelineOptions, createMockContext(tmp), createPipelineState());

            const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');
            const warnings = warn.mock.calls.map(([message]) => String(message)).filter((message) => message.startsWith('⚠ ng-prism:'));

            expect(content).toContain('class FormFieldComponent__PrismComposition {');
            expect(content).toContain('class InputDirective__PrismComposition {');
            expect(content).toContain('class RadioGroupComponent__PrismComposition {');
            // A component subject that prism-subject marks among its siblings in a host template.
            expect(content).toContain('class RadioComponent__PrismComposition {');
            expect(content).toContain('<lib-radio data-prism-subject [value]="this.value()">Medium</lib-radio>');
            expect(content).toContain('import { CdkTextareaAutosize } from "@angular/cdk/text-field";');
            expect(content).toMatch(/imports: \[FormFieldComponent, [^\]]*\bIconComponent\b[^\]]*\]/);
            expect(warnings.filter((message) => COMPOSITION_CLASSES.some((name) => message.includes(name)))).toEqual([]);
        } finally {
            warn.mockRestore();
        }
    });

    it('should declare the outputs of a directive host so that they pass on a payload', async () => {
        tmp = createTempWorkspace();

        await runPrismPipeline(pipelineOptions, createMockContext(tmp), createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        // `copied` carries a string and `copyFailed` an object: `output()` alone takes only `void`, and the Prism app's build fails.
        expect(content).toContain('(copied)="copied.emit($event)" (copyFailed)="copyFailed.emit($event)"');
        expect(content).toMatch(/class CopyToClipboardDirective__PrismHost \{[^}]*\n {2}copied = output<any>\(\);\n {2}copyFailed = output<any>\(\);/);
    });

    it('should nest a part on its parent instead of giving it a page', async () => {
        tmp = createTempWorkspace();

        await runPrismPipeline(pipelineOptions, createMockContext(tmp), createPipelineState());

        const content = readFileSync(join(tmp, 'ng-prism-cache', 'test-lib-prism', 'prism-manifest.ts'), 'utf-8');

        // Item, group and meta text are parts of lib-list: they sit in the parts of the list, in the order of their titles.
        const parts = content.slice(content.indexOf('parts: ['));
        const positions = ['ListGroupComponent', 'ListItemComponent', 'ListItemMetaDirective'].map((name) => parts.indexOf(`className: "${name}"`));

        expect(content).toMatch(/parts: \[\s*\{\s*meta: \{\s*className: "ListGroupComponent"/);
        expect(positions).not.toContain(-1);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        // The directive part keeps its host: the element its usage line on the API tab is written on.
        expect(parts).toMatch(/className: "ListItemMetaDirective",[\s\S]*?host: "<span>12<\/span>"/);
    });

    it('end-to-end: core ng-add then plugin ng-add wires config + deps', async () => {
        const corePkgRoot = resolve(__dirname, '../..');
        const jsdocPkgRoot = resolve(corePkgRoot, '../plugin-jsdoc');

        const coreRunner = new SchematicTestRunner('@ng-prism/core', resolve(corePkgRoot, 'schematics/collection.json'));
        const jsdocRunner = new SchematicTestRunner('@ng-prism/plugin-jsdoc', resolve(jsdocPkgRoot, 'schematics/collection.json'));

        let tree = Tree.empty();

        tree.create(
            'angular.json',
            JSON.stringify({
                $schema: './node_modules/@angular/cli/lib/config/workspace-schema.json',
                version: 1,
                projects: {
                    'my-lib': {
                        projectType: 'library',
                        root: 'projects/my-lib',
                        sourceRoot: 'projects/my-lib/src',
                        architect: {
                            build: {
                                builder: '@angular-devkit/build-angular:ng-packagr',
                                options: { project: 'projects/my-lib/ng-package.json' }
                            }
                        }
                    }
                }
            }) + '\n'
        );
        tree.create('tsconfig.json', '{}');
        tree.create('package.json', JSON.stringify({ name: 'host' }) + '\n');

        tree = await coreRunner.runSchematic('ng-add', { project: 'my-lib' }, tree);
        tree = await jsdocRunner.runSchematic('ng-add', {}, tree);

        const config = tree.read('ng-prism.config.ts')!.toString('utf-8');

        expect(config).toContain(`import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';`);
        expect(config).toContain('plugins: [jsDocPlugin()]');

        const pkg = JSON.parse(tree.read('package.json')!.toString('utf-8')) as {
            devDependencies?: Record<string, string>;
        };

        expect(pkg.devDependencies?.['highlight.js']).toBeDefined();
        expect(pkg.devDependencies?.['ngx-highlightjs']).toBeDefined();
    });
});
