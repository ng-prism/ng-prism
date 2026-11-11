import { normalize, virtualFs } from '@angular-devkit/core';
import { callRule, HostTree, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { firstValueFrom } from 'rxjs';
import { migrate } from './index.js';

/**
 * A tree over an in-memory host instead of `Tree.empty()`: files created on an
 * empty tree are all recorded as `create` actions, which would hide whether the
 * migration touched a file. Here only the migration's own writes show up in
 * `tree.actions`.
 */
function createTree(files: Record<string, string>): Tree {
    const host = new virtualFs.SimpleMemoryHost();

    for (const [path, content] of Object.entries(files)) {
        host.write(normalize(`/${path}`), virtualFs.stringToFileBuffer(content)).subscribe();
    }
    return new HostTree(host);
}

function createContext() {
    const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() };
    const context = {
        engine: {},
        schematic: {},
        description: {},
        strategy: 0,
        logger,
        addTask: jest.fn(),
        interactive: false
    } as unknown as SchematicContext;

    return { context, logger };
}

async function run(tree: Tree, context: SchematicContext = createContext().context): Promise<Tree> {
    return firstValueFrom(callRule(migrate(), tree, context));
}

function read(tree: Tree, path: string): string {
    return tree.read(path)!.toString('utf-8');
}

function touched(tree: Tree, path: string): boolean {
    return tree.actions.some((action) => action.path === `/${path}`);
}

describe('migration v22-8-checker-bg', () => {
    it('rewrites a checker background on the component', async () => {
        const source = ["import { Showcase } from '@ng-prism/core';", '', "@Showcase({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\n');
        const tree = createTree({ 'projects/lib/src/a.ts': source });

        const result = await run(tree);

        expect(read(result, 'projects/lib/src/a.ts')).toBe(source.replace("bg: 'checker'", "bg: 'transparent'"));
    });

    it('rewrites it in variants and keeps the quote style', async () => {
        const source = [
            "import { Showcase } from '@ng-prism/core';",
            '',
            '@Showcase({',
            "    title: 'A',",
            "    variants: [{ name: 'X', bg: \"checker\" }, { name: 'Y', bg: 'checker' }, { name: 'Z', bg: 'dark' }]",
            '})',
            'export class A {}',
            ''
        ].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replace('"checker"', '"transparent"').replace("bg: 'checker'", "bg: 'transparent'"));
    });

    it('rewrites the component and its variants in one decorator', async () => {
        const source = [
            "import { Showcase } from '@ng-prism/core';",
            "@Showcase({ title: 'A', bg: 'checker', variants: [{ name: 'X', bg: 'checker' }] })",
            'export class A {}',
            ''
        ].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replaceAll("'checker'", "'transparent'"));
    });

    it('follows an aliased import', async () => {
        const source = ["import { Showcase as Demo } from '@ng-prism/core';", '', "@Demo({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replace("'checker'", "'transparent'"));
    });

    it('follows a namespace import', async () => {
        const source = ["import * as prism from '@ng-prism/core';", '', "@prism.Showcase({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replace("'checker'", "'transparent'"));
    });

    it('takes Showcase for the decorator when the file has no ng-prism import', async () => {
        const source = ["import { Showcase } from './showcase';", '', "@Showcase({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replace("'checker'", "'transparent'"));
    });

    it('leaves checker outside @Showcase alone', async () => {
        const source = [
            "import { Showcase } from '@ng-prism/core';",
            "import { Other } from './other';",
            '',
            "const legacy = { bg: 'checker' };",
            '',
            "@Other({ bg: 'checker' })",
            'export class A {}',
            '',
            "@Showcase({ title: 'B', bg: 'dark', meta: { bg: 'checker' } })",
            'export class B {}',
            ''
        ].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source);
        expect(touched(result, 'a.ts')).toBe(false);
    });

    it('does not take an aliased Showcase for the plain name', async () => {
        const source = [
            "import { Showcase as Demo } from '@ng-prism/core';",
            "import { Showcase } from './own-showcase';",
            '',
            "@Showcase({ bg: 'checker' })",
            'export class A {}',
            ''
        ].join('\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source);
    });

    it('skips node_modules, dist, .angular and the manifest cache', async () => {
        const source = ["import { Showcase } from '@ng-prism/core';", "@Showcase({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\n');
        const paths = ['node_modules/lib/a.ts', 'dist/lib/a.ts', '.angular/cache/a.ts', 'ng-prism-cache/lib-prism/a.ts', 'projects/lib/node_modules/dep/a.ts'];
        const tree = createTree(Object.fromEntries(paths.map((path) => [path, source])));

        const result = await run(tree);

        for (const path of paths) {
            expect(read(result, path)).toBe(source);
        }
        expect(result.actions).toEqual([]);
    });

    it('does not touch a file it does not change', async () => {
        const plain = ["import { Showcase } from '@ng-prism/core';", "@Showcase({ title: 'A', bg: 'dark' })", 'export class A {}', ''].join('\n');
        const unrelated = "export const legacy = { bg: 'checker' };\n";
        const changed = ["import { Showcase } from '@ng-prism/core';", "@Showcase({ title: 'C', bg: 'checker' })", 'export class C {}', ''].join('\n');
        const tree = createTree({ 'plain.ts': plain, 'unrelated.ts': unrelated, 'changed.ts': changed, 'notes.md': "bg: 'checker'" });

        const result = await run(tree);

        expect(touched(result, 'plain.ts')).toBe(false);
        expect(touched(result, 'unrelated.ts')).toBe(false);
        expect(touched(result, 'notes.md')).toBe(false);
        expect(touched(result, 'changed.ts')).toBe(true);
    });

    it('keeps a byte order mark and the line endings', async () => {
        const source = ["﻿import { Showcase } from '@ng-prism/core';", "@Showcase({ title: 'A', bg: 'checker' })", 'export class A {}', ''].join('\r\n');
        const tree = createTree({ 'a.ts': source });

        const result = await run(tree);

        expect(read(result, 'a.ts')).toBe(source.replace("'checker'", "'transparent'"));
    });

    it('is idempotent', async () => {
        const source = [
            "import { Showcase } from '@ng-prism/core';",
            "@Showcase({ title: 'A', bg: 'checker', variants: [{ name: 'X', bg: 'checker' }] })",
            'export class A {}',
            ''
        ].join('\n');
        const tree = createTree({ 'a.ts': source });

        const first = await run(tree);
        const afterFirst = read(first, 'a.ts');
        const actionsAfterFirst = first.actions.length;
        const second = await run(first);

        expect(read(second, 'a.ts')).toBe(afterFirst);
        expect(second.actions).toHaveLength(actionsAfterFirst);
    });

    it('logs each rewritten file and warns once about the captures', async () => {
        const one = [
            "import { Showcase } from '@ng-prism/core';",
            "@Showcase({ title: 'A', bg: 'checker', variants: [{ name: 'X', bg: 'checker' }] })",
            'export class A {}',
            ''
        ].join('\n');
        const two = ["import { Showcase } from '@ng-prism/core';", "@Showcase({ title: 'B', bg: 'checker' })", 'export class B {}', ''].join('\n');
        const tree = createTree({ 'a.ts': one, 'b.ts': two });
        const { context, logger } = createContext();

        await run(tree, context);

        expect(logger.info).toHaveBeenCalledTimes(2);
        expect(logger.info).toHaveBeenCalledWith("/a.ts: bg 'checker' → 'transparent' (2×)");
        expect(logger.info).toHaveBeenCalledWith("/b.ts: bg 'checker' → 'transparent' (1×)");
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn.mock.calls[0][0]).toContain('baselines');
    });

    it('stays silent when there is nothing to rewrite', async () => {
        const tree = createTree({ 'a.ts': "import { Showcase } from '@ng-prism/core';\n@Showcase({ title: 'A' })\nexport class A {}\n" });
        const { context, logger } = createContext();

        await run(tree, context);

        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });
});
