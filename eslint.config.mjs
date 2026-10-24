import { join } from 'node:path';
import js from '@eslint/js';
import globals from 'globals';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {
        // Each entry is either root-anchored (only <workspaceRoot>/<name>)
        // or prefixed with `**/` for any depth, depending on where the
        // generated directory is created. In flat-config ignores a bare name
        // without `**/` matches only at the root, unlike .gitignore:
        // `nx build` writes to packages/*/dist, Jest to
        // packages/*/test-output/jest/coverage. Both would slip through
        // without `**/`.
        ignores: [
            // Generated build/test output, per package, hence `**/`.
            '**/dist',
            '**/out-tsc',
            '**/node_modules',
            '**/coverage',
            // Angular build cache, created per Angular workspace, here
            // test-workspace/.angular.
            '**/.angular',
            // `join(workspaceRoot, 'ng-prism-cache')` (see
            // builder/shared/prism-pipeline.ts): never per package, but per
            // workspace, and since test-workspace is linted too there are
            // two: the generated prism-manifest.ts also lives under
            // test-workspace/ng-prism-cache/, not only at the repo root.
            '**/ng-prism-cache',

            // Fixed directories at the workspace root. Nothing creates them
            // per package, so root-anchored without `**/`.
            '.nx',
            '.claude',
            '.superpowers',
            '.posts',
            // The product-video project: a standalone npm project with its
            // own tsconfig and Revideo's JSX, checked by its own
            // `npm --prefix video run check`, not by this config.
            'video',
            // Verdaccio local-registry storage, always tmp/local-registry/
            // storage at the repo root. Same reasoning as the `/tmp` entry in
            // .prettierignore; unlike dist/out-tsc/coverage above, not per
            // package.
            'tmp',

            // Generated or fixed-shape CommonJS tooling. ESLint never went
            // beyond `**/*.ts`/`**/*.html` here, so no rule ever hit these
            // files; that was an accident, now it is a decision (an earlier
            // autofix silently removed a `/* eslint-disable */` from
            // jest.config.cjs because it had no effect). jest.preset.js and
            // the seven jest.config.cjs files are Nx-generated boilerplate; a
            // Node rule set for them would be undone by the next Nx generator
            // run. eslint.config.mjs is the lint config itself.
            // scripts/check-declared-deps.mjs is not ignored (see its `files`
            // block below): it is hand-written logic, not boilerplate, and
            // runs in `npm run check` and CI.
            'jest.preset.js',
            '**/jest.config.cjs',
            'eslint.config.mjs',

            '**/plugin-registry.ts',
            '**/.DS_Store'
        ]
    },

    // ──── TypeScript ────
    { ...js.configs.recommended, files: ['**/*.ts'] },
    { ...importPlugin.flatConfigs.recommended, files: ['**/*.ts'] },
    { ...prettierRecommended, files: ['**/*.ts'] },
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
    ...angular.configs.tsRecommended.map((config) => ({
        ...config,
        files: ['**/*.ts'],
        processor: angular.processInlineTemplates
    })),
    {
        files: ['**/*.ts'],
        plugins: {
            '@stylistic': stylistic,
            'unused-imports': unusedImports
        },
        settings: {
            'import/resolver': {
                typescript: {
                    // Absolute, anchored at this file. Every target inferred by
                    // @nx/eslint/plugin runs with `cwd: <projectRoot>`, where
                    // relative paths resolve to nothing
                    // (`packages/ng-prism/packages/*/tsconfig.lib.json`). The
                    // resolver then finds nothing, import/order puts the
                    // affected specifiers in a different group, and the same
                    // file lints differently depending on where it is run from.
                    // Seen on test-ui-kit-prism/src/main.ts: clean from the repo
                    // root, an import/order finding from inside test-workspace.
                    project: [join(import.meta.dirname, 'tsconfig.base.json'), join(import.meta.dirname, 'packages/*/tsconfig.lib.json')],
                    noWarnOnMultipleProjects: true
                },
                node: true
            }
        },
        rules: {
            // no-unsafe-optional-chaining and no-case-declarations are `error`
            // in js.configs.recommended and stay there; they are not style
            // rules. no-unsafe-optional-chaining catches `(a?.b).c`, a
            // guaranteed TypeError once the optional short-circuits;
            // no-case-declarations catches a `const` in a `case` that leaks
            // into the whole switch block. With `--max-warnings 0`,
            // downgrading to `warn` would only turn the message yellow; the run
            // fails either way, so keep the severity that fits.

            // unused-imports/no-unused-vars covers the same case, also
            // autofixes unused imports and already honours the `_` prefix
            // convention (see below). With both rules on, every unused value
            // is reported twice with different ignore patterns:
            // @typescript-eslint/no-unused-vars does not know the `_` prefix
            // and fires on correctly named parameters too.
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': ['warn', { allow: ['arrowFunctions'] }],
            '@angular-eslint/no-output-on-prefix': 'off',
            '@angular-eslint/prefer-standalone': 'off',
            '@angular-eslint/prefer-on-push-component-change-detection': ['warn'],

            // Cross-package resolution goes through npm workspaces and
            // customConditions: ["@org/source"], which the resolver does not
            // follow. The typecheck target covers it.
            'import/no-unresolved': 'off',

            // ──── Stylistic ────
            //
            // Only rules that eslint-config-prettier does not turn off, i.e.
            // the ones Prettier has no opinion on. Everything
            // eslint-config-prettier (via eslint-plugin-prettier/recommended,
            // spread above) disables stays disabled: this config comes after
            // that spread, so any rule set here would re-enable it.
            //
            // Measured: with the 17 rules that used to be here
            // (array-bracket-spacing, arrow-parens, semi, eol-last,
            // object-curly-spacing, padded-blocks, etc.), `eslint --fix` over
            // the whole tree changes the same zero files as without them. They
            // enforce what prettier/prettier already enforces, as a second
            // fixer on the same spot. That class of rule has bitten before:
            // array-element-newline and object-property-newline had to be
            // removed after `eslint --fix` logged "Circular fixes detected
            // ... conflicting rules in your configuration", mangled the file
            // and left errors behind. No gain against a real risk, so only
            // these four remain.
            '@stylistic/curly-newline': ['warn', { consistent: true }],
            '@stylistic/spaced-comment': ['warn', 'always', { exceptions: ['*'] }],
            '@stylistic/multiline-comment-style': 'off',
            '@stylistic/padding-line-between-statements': [
                'warn',
                { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
                { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] }
            ],

            // ──── Imports ────
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_'
                }
            ],
            'import/no-absolute-path': 'warn',
            'import/no-useless-path-segments': 'warn',
            'import/first': 'warn',
            'import/newline-after-import': 'warn',
            'import/no-duplicates': 'warn',
            'import/order': [
                'warn',
                {
                    named: true,
                    alphabetize: { order: 'asc', caseInsensitive: true },
                    'newlines-between': 'never'
                }
            ]
        }
    },

    // ──── Fixtures and mocks ────
    //
    // The files under __fixtures__ are scanner input, not production
    // components: they carry foreign selectors like my-button or lib-button
    // because that is what the tests cover. Unused parameters and locals are
    // part of their purpose (they declare a shape nobody reads), so
    // no-unused-vars is off here. In specs (below) the same finding is a
    // real defect.
    {
        files: ['**/__fixtures__/**/*.ts', '**/__mocks__/**/*.ts'],
        rules: {
            '@angular-eslint/prefer-on-push-component-change-detection': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'unused-imports/no-unused-vars': 'off'
        }
    },

    // ──── Specs ────
    //
    // Specs are ordinary code. An unused local or an unused parameter without
    // the `_` prefix is a defect here like anywhere else, so there is no
    // blanket `unused-imports/no-unused-vars: 'off'` as for fixtures/mocks
    // above. The general rule and the `_` convention apply unchanged.
    {
        files: ['**/*.spec.ts'],
        rules: {
            '@angular-eslint/prefer-on-push-component-change-detection': 'off',
            '@typescript-eslint/no-empty-function': 'off',

            // A couple of specs spy on a built-in module (e.g.
            // `jest.spyOn(require('node:fs'), 'readFileSync')`) to observe
            // calls the source file under test makes. That needs the exact
            // module object Node's require cache hands out; the source
            // files import the same built-in via static ESM `import`, which
            // after SWC's transform is a distinct object, so spying on it
            // does not see those calls (verified: swapping the require()
            // for a static import makes the spy-based assertion fail). No
            // static import reaches the live, requireable object here, so
            // require() stays.
            '@typescript-eslint/no-require-imports': 'off'
        }
    },

    // ──── Node scripts ────
    //
    // scripts/ is plain hand-written ESM with no Angular or browser code.
    // builder/ is different: Node and browser code share directories there,
    // so a directory override would be wrong in both directions, and a Node
    // context override for builder/ is out of scope. scripts/ has no such
    // problem and gets a small real rule set instead of an ignore.
    // test-workspace/*.mjs are the two measurement scripts (measure-pipeline,
    // measure-watch-rebuilds), same case. So are the helper scripts under
    // .agents/: the ones agent skills ship next to their SKILL.md and the
    // screenshot script of the Claude Code plugin (.agents/plugins/claude).
    //
    // globals.nodeBuiltin instead of a hand-kept list: the scripts only need
    // process and console today, but a list with just those would flag the
    // first Buffer, URL or fetch as no-undef, which looks like a real
    // finding and isn't.
    {
        ...js.configs.recommended,
        files: ['scripts/**/*.mjs', 'test-workspace/*.mjs', '.agents/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 'latest',
            globals: globals.nodeBuiltin
        }
    },

    // ──── Angular templates ────
    //
    // Covers two things: the external templates under packages/, and the
    // virtual .html files that `angular.processInlineTemplates` (on the
    // **/*.ts block above) creates from every inline `template:`. Those live
    // under a path segment ending in .ts, so they match the same `**/*.html`
    // globs. That is the only reason inline templates get formatted at all.
    //
    // The three real .html files in the tree are not Angular templates:
    // docs/index.html is the docsify page, the two index.html files are the
    // app shells of test-lib-prism and test-ui-kit-prism. ESLint has no
    // parser for full HTML documents (the Angular template parser fails on
    // `<!doctype html>`), and formatted with `parser: 'angular'` they would
    // differ from what the Prettier CLI produces for the same file, so
    // `nx format:check` and this run would disagree forever. They go through
    // the Prettier entry in lint-staged instead.
    ...angular.configs.templateRecommended.map((config) => ({
        ...config,
        files: ['packages/**/*.html', 'test-workspace/**/*.html'],
        ignores: ['**/index.html']
    })),
    { ...prettierRecommended, files: ['packages/**/*.html', 'test-workspace/**/*.html'], ignores: ['**/index.html'] },
    {
        files: ['packages/**/*.html', 'test-workspace/**/*.html'],
        ignores: ['**/index.html'],
        rules: {
            'prettier/prettier': ['error', { parser: 'angular' }]
        }
    }
];
