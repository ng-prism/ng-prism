# Publishing Libraries

## The Problem

When you build a component library with ng-packagr, the compiled fesm2022 output contains `@Showcase` decorator calls and imports:

```js
import { Showcase } from '@ng-prism/core';
Showcase({ title: 'Pill', category: 'Atoms' })(PillComponent);
```

An app that installs your library without `@ng-prism/core` then fails with `Module not found: Error: Can't resolve '@ng-prism/core'`. Tree-shaking cannot remove the decorator because the top-level call is a side effect.

## The Solution

ng-prism ships a TypeScript AST transformer that strips all `@Showcase` references from compiled output, and the `ng-prism-strip` command that runs it over a build directory. After stripping, your published library no longer depends on `@ng-prism/core`, as long as `Showcase` is the only value it imports from there.

## Automatic Setup

If you installed ng-prism via `ng add @ng-prism/core`, a `strip-showcase` npm script was already added to your `package.json`:

```json
{
    "scripts": {
        "strip-showcase": "ng-prism-strip dist/my-lib"
    }
}
```

Run it after your library build, on the directory ng-packagr writes to:

```bash
ng build my-lib
npm run strip-showcase
```

Or chain them:

```bash
ng build my-lib && npm run strip-showcase
```

## Manual Setup

If you didn't use `ng add`, add the script yourself:

```json
{
    "scripts": {
        "strip-showcase": "ng-prism-strip dist/my-lib"
    }
}
```

Adjust `dist/my-lib` to match your library's actual output path.

### Nx Workspace

In an Nx workspace, you can add a target to `project.json`:

```json
{
    "targets": {
        "strip-showcase": {
            "command": "npx ng-prism-strip dist/packages/my-lib",
            "dependsOn": ["build"]
        }
    }
}
```

## Programmatic Usage

For custom build setups, use the TypeScript transformer directly:

```typescript
import ts from 'typescript';
import { createShowcaseStripTransformer } from '@ng-prism/core/transformer';

const sourceFile = ts.createSourceFile('file.ts', source, ts.ScriptTarget.Latest);
const result = ts.transform(sourceFile, [createShowcaseStripTransformer()]);
const printer = ts.createPrinter();
const output = printer.printFile(result.transformed[0]);
result.dispose();
```

Or use the convenience functions, for one source text or for a whole directory as `ng-prism-strip` does:

```typescript
import { stripShowcaseDecorators, stripShowcaseFromDirectory } from '@ng-prism/core/transformer';

const output = stripShowcaseDecorators(source);
const { strippedFiles, totalFiles } = await stripShowcaseFromDirectory('dist/my-lib');
```

## Verification

`ng-prism-strip` reports what it changed:

```
Stripped @Showcase from 3 of 12 files.
```

Then verify that no `@ng-prism/core` references remain:

```bash
grep -r "@ng-prism/core" dist/my-lib/
```

This should return no results. If it does, check that `ng-prism-strip` ran on the correct directory. Only the `Showcase` import is removed: anything else the library imports from `@ng-prism/core` at runtime stays, and so does the dependency.

If a reference to `Showcase` would be left behind after stripping, the command stops with an error and exit code 1 instead of writing a file that would throw a `ReferenceError` at runtime:

```
Error: [ng-prism] Showcase reference 'Showcase' left in output after stripping at dist/my-lib/fesm2022/my-lib.mjs:42. The Showcase import was removed but a reference remains, which would cause a ReferenceError at runtime. This is a transformer bug; please report the input source.
```

Report it with the source of that file in the [issue tracker](https://github.com/ng-prism/ng-prism/issues).

## How It Works

The transformer handles three decorator forms that TypeScript/ng-packagr can emit:

| Form             | Example                                 | Source              |
| ---------------- | --------------------------------------- | ------------------- |
| Lowered call     | `Showcase({...})(MyComp);`              | ng-packagr fesm2022 |
| `__decorate`     | `__decorate([Showcase({...})], MyComp)` | Legacy tsc          |
| Native decorator | `@Showcase({...}) class MyComp`         | TC39 decorators     |

It removes the decorator calls and the `Showcase` import, and keeps the rest of the import statement. `ng-prism-strip` reads every `.js` and `.mjs` file in the directory and below it; a file that does not import `Showcase` from `@ng-prism/core` is left untouched.

## FAQ

**Does this affect ng-prism's dev server?**
No. The dev server (`ng run my-lib:prism`) scans your TypeScript source files, not the compiled output. Stripping only affects the production library build.

**Can I remove `@ng-prism/core` from my library's `package.json`?**
Yes. After stripping, your published library no longer references `@ng-prism/core`. Keep it as a `devDependency` for local development.

**Is it safe to run twice?**
Yes. The transformer is idempotent. If no `@Showcase` imports are found, the file is returned unchanged.
