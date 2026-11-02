# Publishing Libraries

## The Problem

When you build a component library with ng-packagr, the compiled fesm2022 output contains `@Showcase` decorator calls and imports:

```js
import { Showcase } from '@ng-prism/core';
Showcase({ title: 'Pill', category: 'Atoms' })(PillComponent);
```

Downstream consumers of your library will see: `Module not found: Error: Can't resolve '@ng-prism/core'`

Tree-shaking cannot remove the decorator because the top-level call is a side effect.

## The Solution

ng-prism ships a TypeScript AST transformer that strips all `@Showcase` references from compiled output. After stripping, your published library has zero dependency on `@ng-prism/core`.

## Automatic Setup

If you installed ng-prism via `ng add @ng-prism/core`, a `strip-showcase` npm script was already added to your `package.json`:

```json
{
    "scripts": {
        "strip-showcase": "ng-prism-strip dist/my-lib"
    }
}
```

Run it after your library build:

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

Or use the convenience function:

```typescript
import { stripShowcaseDecorators } from '@ng-prism/core/transformer';

const output = stripShowcaseDecorators(source);
```

## Verification

After stripping, verify that no `@ng-prism/core` references remain:

```bash
grep -r "@ng-prism/core" dist/my-lib/
```

This should return no results. If it does, check that `ng-prism-strip` ran on the correct directory.

## How It Works

The transformer handles three decorator forms that TypeScript/ng-packagr can emit:

| Form             | Example                                 | Source              |
| ---------------- | --------------------------------------- | ------------------- |
| Lowered call     | `Showcase({...})(MyComp);`              | ng-packagr fesm2022 |
| `__decorate`     | `__decorate([Showcase({...})], MyComp)` | Legacy tsc          |
| Native decorator | `@Showcase({...}) class MyComp`         | TC39 decorators     |

It removes the decorator calls and cleans up the corresponding import statements. Files without `@Showcase` are left untouched.

## FAQ

**Does this affect ng-prism's dev server?**
No. The dev server (`ng run my-lib:prism`) scans your TypeScript source files, not the compiled output. Stripping only affects the production library build.

**Can I remove `@ng-prism/core` from my library's `package.json`?**
Yes. After stripping, your published library no longer references `@ng-prism/core`. Keep it as a `devDependency` for local development.

**Is it safe to run twice?**
Yes. The transformer is idempotent. If no `@Showcase` imports are found, the file is returned unchanged.
