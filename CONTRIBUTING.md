# Contributing to ng-prism

Thank you for your interest in contributing to ng-prism! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Plugin Development](#plugin-development)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Be kind, constructive, and professional in all interactions. Also expect direct, detailed reviews of your code; that is a different thing.

## Getting Started

### Prerequisites

- **Node.js** ^22.22.3, ^24.15.0 or >= 26 (the range Angular 22 requires; CI runs on 22)
- **npm** >= 10
- **Git**

### First-Time Setup

This walkthrough takes a fresh clone to a fully running test workspace. Follow each step in order.

#### 1. Clone and install root dependencies

```bash
git clone https://github.com/ng-prism/ng-prism.git
cd ng-prism
npm install
```

`npm install` activates npm workspaces under `packages/*` and installs all monorepo dev dependencies (Nx, Angular SDK, Jest, etc.).

#### 2. Verify the core builds and tests

```bash
npm run check       # Format + declared-deps check + docs check + style + lint + test + test-chromium + build + typecheck for all packages
```

`test-chromium` drives a real browser, so install Chromium once with `npx playwright install chromium`. CI runs these same steps (see [Run the Check Suite](#3-run-the-check-suite)). It must pass before continuing, because the test-workspace setup depends on a working core build.

#### 3. Start the local registry (separate terminal)

The `test-workspace/` resolves transitive dependencies through a local Verdaccio registry. Open a second terminal and keep it running:

```bash
npx nx run ng-prism-workspace:local-registry
```

Wait until `http address - http://localhost:4873/` appears. This terminal stays open for the entire dev session.

Why Verdaccio? See [Why a local registry?](#why-a-local-registry) below.

#### 4. Install and bootstrap the test workspace

Back in your first terminal:

```bash
npm run test:workspace:install
```

This does two things:

- `npm install` inside `test-workspace/` (resolves `@ng-prism/*` via `file:` links, everything else via Verdaccio, which proxies to npmjs.org)
- Creates `ng-prism.config.ts` from `ng-prism.config.example.ts` if it doesn't exist (the actual config file is gitignored)

#### 5. Run the demo

```bash
npm run test:workspace:serve
```

The Prism dev server starts on `http://localhost:4400`. Open it to verify your setup works end-to-end.

You're done; your local setup is ready for development.

## Development Setup

ng-prism is an Nx 22 monorepo using npm workspaces. All packages live under `packages/`.

### Key Dependencies

| Dependency | Version | Purpose                              |
| ---------- | ------- | ------------------------------------ |
| Angular    | 22      | Framework                            |
| TypeScript | 6.0     | Language                             |
| Nx         | 22      | Monorepo tooling, task orchestration |
| Jest + SWC | 30      | Testing                              |

### Test Workspace

The `test-workspace/` directory is a real Angular workspace used as a live demo and integration test target for the local `@ng-prism/*` packages (linked via `file:../packages/*`).

#### Why a local registry?

`test-workspace/` resolves transitive dependencies through a local Verdaccio registry (`http://localhost:4873`). This serves two purposes:

1. **Isolated transitive resolution**: Angular and other transitive deps of the in-repo packages are fetched through Verdaccio, which proxies to `https://registry.npmjs.org/` for unknown packages (see `.verdaccio/config.yml`).
2. **No global config pollution**: `test-workspace/.npmrc` pins the registry to `localhost:4873` for this directory only. Your global `~/.npmrc` (e.g. a corporate registry) stays untouched. The `local-registry` Nx target also passes `location: none` so Verdaccio itself leaves your global config alone.

#### The `ng-prism.config.ts` file

`test-workspace/ng-prism.config.ts` configures plugins, theme, and other Prism options. It is gitignored because it is environment/setup specific. The schematic that ships with `@ng-prism/core` creates a minimal version, and contributors may add or remove plugins as they like.

`test-workspace/ng-prism.config.example.ts` is committed as a reference. It enables all six official plugins (figma, jsdoc, perf, coverage, box-model, visual-regression). The `test:workspace:install` script copies it to `ng-prism.config.ts` on first run if the latter doesn't exist.

#### Scripts reference

| Script                   | Purpose                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:workspace:setup`   | Build `ng-prism` core (skip-nx-cache), prerequisite for serve/build                                                                                                                                        |
| `test:workspace:install` | `npm install` inside `test-workspace/` and copy `ng-prism.config.example.ts` to `ng-prism.config.ts` if missing. Requires Verdaccio running.                                                               |
| `test:workspace:update`  | Rebuild `ng-prism` + all plugins (Nx-cached), purge Angular esbuild cache, and re-resolve the `file:` deps offline. Use this after editing source. Does **not** require Verdaccio for incremental updates. |
| `test:workspace:serve`   | Start the Prism dev server on `http://localhost:4400`                                                                                                                                                      |
| `test:workspace:build`   | Production build of the Prism app                                                                                                                                                                          |
| `test:workspace:kill`    | Free port 4400 if a previous serve crashed                                                                                                                                                                 |
| `test:workspace:clean`   | **Destructive.** Removes `test-workspace/node_modules`, `package-lock.json`, `ng-prism.config.ts` and reverts `angular.json` + `package.json` to git state. Use only for a full re-setup.                  |
| `test:workspace:reset`   | `clean` + `setup` + `install` in one. Use after a broken state. Requires Verdaccio running.                                                                                                                |

#### Common workflows

**Iterating on `packages/ng-prism/` (or any plugin) while serving the demo:**

```bash
# Terminal A (only needed for first install/full reset): Verdaccio
npx nx run ng-prism-workspace:local-registry

# Terminal B: after editing source, refresh test-workspace + restart serve
npm run test:workspace:update    # rebuild + re-sync file: deps + clear Angular cache
npm run test:workspace:serve     # hard-refresh the browser (Cmd+Shift+R) when reloaded
```

`test:workspace:update` uses `npm install --prefer-offline` so it does **not** require Verdaccio to be running once the initial install has populated the npm cache. If you've added a brand-new dependency (rare), start Verdaccio and use `test:workspace:install` instead.

**Pulled latest `main` and something broke:**

```bash
# Terminal A: Verdaccio running
npm run test:workspace:reset
npm run test:workspace:serve
```

**Accidentally ran `test:workspace:clean`:**

Same as above: `npm run test:workspace:reset` puts the workspace back into a runnable state.

#### Troubleshooting

| Symptom                                                                    | Likely cause + fix                                                                                                                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` (in test-workspace) hangs indefinitely with a spinner        | Verdaccio is not running. Start it: `npx nx run ng-prism-workspace:local-registry`.                                                                                           |
| `Cannot find module '@angular-devkit/build-angular/package.json'` on serve | `test-workspace/node_modules` is missing. Run `npm run test:workspace:install`.                                                                                               |
| `Angular compilation initialization failed. Error: Debug Failure` on serve | `ng-prism.config.ts` is missing. Copy the example: `cp test-workspace/ng-prism.config.example.ts test-workspace/ng-prism.config.ts`, or run `npm run test:workspace:install`. |
| `EPERM open ~/.npmrc` when starting Verdaccio                              | Nx tried to mutate your global config. The `local-registry` target in root `package.json` should have `"location": "none"`; verify it.                                        |
| Changes in `packages/ng-prism/` not picked up in the test workspace        | Re-run `npm run test:workspace:setup` to rebuild the core, then restart serve.                                                                                                |
| Port 4400 already in use                                                   | `npm run test:workspace:kill`.                                                                                                                                                |

### Viewing Documentation Locally

```bash
npm run docs   # Starts docsify on http://localhost:3000
```

### Product Films

The tour on the docs start page and the clip per release are rendered on your machine with [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML and GSAP). The picture is the real styleguide: its DOM and used CSS, lifted from a build of `test-workspace` and animated with a camera and a cursor. A film is described in one file, `.videos/reference/<film>/film.mjs`; the skill's scripts measure it, voice it (ElevenLabs), generate the HyperFrames project, render it and encode the web version, a YouTube version, a thumbnail and English subtitles. `test-workspace`'s `video-lib` holds showcases written to fit the films' code cards.

The agent skill `prism-video` (`.agents/skills/prism-video/`) has the house style, the title and end card, and the scripts. They need Node 22 or later, the root Playwright, `hyperframes` and `gsap` (exact devDependencies), and `ffmpeg` (`brew install ffmpeg`). Chrome for HyperFrames comes once with `node .agents/skills/prism-video/scripts/hf.mjs browser ensure`. Run HyperFrames only through that `hf.mjs`: it turns telemetry and update checks off and refuses the commands that upload or sign in. `.videos/` is gitignored; only the tour is committed, as `docs/assets/video/tour.mp4` with `tour-poster.jpg`.

## Project Structure

```
ng-prism/
├── packages/
│   ├── ng-prism/              # Core library (@ng-prism/core)
│   │   └── src/
│   │       ├── decorator/     # @Showcase decorator + types
│   │       ├── plugin/        # Plugin API types, defineConfig()
│   │       ├── builder/       # Angular Builder (scanner, watcher, manifest)
│   │       ├── schematics/    # ng add schematic
│   │       └── app/           # Styleguide runtime app
│   ├── plugin-box-model/      # @ng-prism/plugin-box-model
│   ├── plugin-coverage/       # @ng-prism/plugin-coverage
│   ├── plugin-figma/          # @ng-prism/plugin-figma
│   ├── plugin-jsdoc/          # @ng-prism/plugin-jsdoc
│   ├── plugin-perf/           # @ng-prism/plugin-perf
│   └── plugin-visual-regression/  # @ng-prism/plugin-visual-regression
├── test-workspace/            # Integration test workspace
├── docs/                      # Documentation (docsify)
└── scripts/                   # Build & publish scripts
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature
```

Use a descriptive branch name with a prefix:

| Prefix      | Use for                   |
| ----------- | ------------------------- |
| `feat/`     | New features              |
| `fix/`      | Bug fixes                 |
| `refactor/` | Code refactoring          |
| `docs/`     | Documentation changes     |
| `test/`     | Test additions or fixes   |
| `chore/`    | Maintenance, dependencies |

### 2. Make Your Changes

- Work in small, focused increments
- Keep changes scoped to a single concern
- Run tests frequently

### 3. Run the Check Suite

Before opening a PR, run the checks CI runs on GitHub:

```bash
npm run check       # nx format:check + check-declared-deps + check-docs + stylelint + lint + test + test-chromium + build + typecheck for all packages
```

CI runs the same list. It runs `test-chromium` as a step of its own on the main
job, after installing Chromium, because the Nx Cloud agents that run the other
targets have no browser. It also appends `e2e-ci` to the final `nx run-many`, a
target no project currently defines. That one predates this toolchain and is
skipped silently, so it changes nothing either way.

If `check` fails on formatting, lint, or style, auto-fix what can be auto-fixed with:

```bash
npm run check:fix   # eslint --fix, then nx format:write, then stylelint --fix
```

Then commit the fixes. `check:fix` and `lint:fix` both route through
`scripts/fix-until-stable.mjs`, the same script the pre-commit hook uses: it
reruns a tool until the files stop changing, because neither `eslint --fix` nor
`stylelint --fix` reliably converges in one pass (`import/order` needs two on
some files; `property-no-vendor-prefix` against `order/properties-order` leaves
a duplicate declaration that only the second pass clears). It gives up after 5
passes, which points to misconfiguration rather than a reason to raise the limit.

`lint:fix` does not go through `nx run-many`. The `lint` target
is cached but declares no outputs, so a cache hit replays an empty result while
the files it was supposed to rewrite stay untouched, so the command would report
success on a tree it never fixed. Fixing is not a cacheable operation; linting
is, which is why `npm run lint` and the pre-push hook still use Nx.

### Linting and formatting

Three tools with clearly separated responsibilities:

| File type                                     | Formatted by                        | Linted by                                                      |
| --------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `.ts`                                         | Prettier, running as an ESLint rule | ESLint (typescript-eslint, angular-eslint, @stylistic, import) |
| Angular templates (`.html` under `packages/`) | Prettier, running as an ESLint rule | ESLint (angular-eslint template rules)                         |
| `index.html` (docsify page, app shells)       | Prettier                            | - (see below)                                                  |
| `.css`, `.scss`                               | Prettier                            | Stylelint                                                      |
| `.json`, `.md`, `.yml`, `.js`, `.cjs`, `.mjs` | Prettier                            | - (except `scripts/**/*.mjs`*)                                 |

This covers `test-workspace/` as well. It is not a side project: its components
are the input the scanner is developed against, and leaving them outside the
toolchain meant a file could be committed unformatted and only fail later in
CI's `nx format:check`. Nx infers `lint` targets for `test-lib`, `test-ui-kit`
and `test-workspace` from the same root `eslint.config.mjs` as everything else.

The three standalone `.html` documents (`docs/index.html` and the two app
shells under `test-workspace/projects/*-prism/src/`) are reached by Prettier
only. ESLint has no parser for a complete HTML document (the angular-eslint
template parser is for templates, not documents), so they run through the
Prettier entry in `lint-staged` instead. Inline `template:` strings, by
contrast, _are_ linted: `angular.processInlineTemplates` extracts them as
virtual `.html` files, which is why they match the template rules above.

\* `scripts/**/*.mjs` is linted too, with plain `eslint:recommended`, no Angular or
`@stylistic` rules, since it's Node code with no browser or Angular surface.
The same applies to `test-workspace/*.mjs`, the two measurement scripts, and to
the helper scripts under `.agents/`: the ones agent skills ship next to their
`SKILL.md` and the screenshot script of the Claude Code plugin.
Nothing infers a `lint` target for the workspace root automatically (Nx only
does that for a root project with a standalone `src`/`lib`), so it runs from
an explicit `lint` target declared on `ng-prism-workspace` in `package.json`'s
`nx.targets`, scoped to `eslint scripts jest.config.ts .agents`, which is also how
`jest.config.ts` itself ends up linted. `nx run-many -t lint` picks it up like
any other project's `lint` target, so `npm run lint`, `npm run check`, and CI
all reach it.

Stylelint covers `.scss` as well: the eight partials under
`test-workspace/projects/test-lib/src/lib/styles/`. They need their own parser
and rule set (`@use`, `@mixin` and `//` comments are not CSS), which
`stylelint-config-standard-scss` supplies through an `overrides` entry in
`.stylelintrc.cjs`. One rule is narrowed there: `scss/dollar-variable-empty-line-before`
forbids a blank line between consecutive `$` variables, and its autofix
collapsed the intended grouping in `_variables.scss` into one undivided
block. Between two variables the rule is therefore set to `ignore`; everywhere
else it applies unchanged.

Every target runs `eslint ... --max-warnings 0` (set once in `nx.json`'s
`targetDefaults`). Without it the `warn` severities in `eslint.config.mjs` could
not fail anything: `eslint` exits 0 with warnings, so a `warn`-level finding
would have passed the pre-push hook and CI alike. Severity therefore expresses
how loud a finding is in the editor, not whether it blocks.

Prettier does not run separately for TypeScript and HTML. It runs as an
ESLint rule via `eslint-plugin-prettier`. One `eslint --fix` therefore handles
formatting and rules in a single pass, and no two tools rewrite the same file
one after another.

When a fix pass is needed, the order is always **ESLint, then Prettier, then
Stylelint**, because `stylelint-config-recess-order` reorders properties, and Prettier
would otherwise touch the result again. `npm run check:fix` does this for you.

A pre-commit hook runs the three tools on staged files, and a pre-push hook
lints every package plus the workspace root (`scripts/` and `jest.config.ts`,
see above). Nx serves the unchanged ones from cache, so this costs little
more than linting only what changed, and it cannot pick the wrong base.

A commit-msg hook (`scripts/strip-ai-coauthors.mjs`) drops the co-author
trailers Claude Code and Copilot add to a commit message. Once such a commit
is on `main`, GitHub lists the tool among the repo's contributors.

Editor setup: VS Code picks up `.vscode/settings.json` automatically. It is
tracked in git via a negation rule in `.gitignore` (`.vscode/*` is
ignored, then `!.vscode/settings.json` un-ignores this one file). Install the
recommended extensions when prompted.

WebStorm and IntelliJ have no equivalent: `/.idea` is gitignored wholesale, so
none of its settings can travel with the repo. Enable these three manually, on
each machine:

- **ESLint**: Languages & Frameworks → JavaScript → Code Quality Tools →
  ESLint: "Automatic ESLint configuration", check "Run eslint --fix on save",
  pattern `**/*.{ts,html}`
- **Prettier**: Languages & Frameworks → JavaScript → Prettier: check "Run on
  save", pattern `**/*.{json,css,md,yml,js,cjs,mjs}`
- **Stylelint**: Languages & Frameworks → Style Sheets → Stylelint: leave
  "Run stylelint --fix on save" **off**, and set the pattern to `**/*.css` so
  you still get the diagnostics inline.

Neither editor fixes `.css` on save, by design. A single `stylelint --fix` pass does not converge
(`property-no-vendor-prefix` against `order/properties-order` leaves behind a
duplicate declaration that only a second pass clears), and no editor offers a
"repeat until stable" save action. Both would also have to guarantee that
Prettier runs before Stylelint, which neither can order reliably. So the editors
show Stylelint's findings and Prettier formats the file; the actual fixing
happens at commit time, where `lint-staged` runs Prettier first and then loops
`scripts/fix-until-stable.mjs` until the file stops changing. The editor
setup is only a convenience.

Two of the three wholesale reformats during the linting rollout carry a small
amount of real change alongside the formatting; `.git-blame-ignore-revs` lists
what changed in each commit. To keep `git blame` pointing at the author of a line
rather than at the reformat, tell git to skip those commits:

    git config blame.ignoreRevsFile .git-blame-ignore-revs

For fast iteration on a single package during development, run targets directly:

```bash
npx nx test ng-prism         # Unit tests for one project
npx nx build ng-prism        # Build one project
npx nx typecheck ng-prism    # Typecheck one project
npx nx test plugin-figma     # Same for a plugin
```

These are faster than the full `check` because they only run on the named project. Use them while iterating, then run `npm run check` once before pushing.

### 4. Submit a Pull Request

Without write access to the repository, you push your branch to a fork. With the [GitHub CLI](https://cli.github.com/), one command creates the fork and rewires the remotes of your existing clone (`origin` → your fork, `upstream` → `ng-prism/ng-prism`):

```bash
gh repo fork --remote
git push -u origin <your-branch>
gh pr create
```

Without `gh`, click **Fork** on GitHub, then run `git remote rename origin upstream` and `git remote add origin https://github.com/<your-username>/ng-prism.git` before pushing. Maintainers with write access skip the fork and push to `origin` directly.

Open the PR against `main`. See [Pull Request Process](#pull-request-process) for details.

## Coding Standards

### Language

- **Code, filenames, identifiers:** English
- **Documentation:** English

### TypeScript

- Use `.js` extensions in all imports (ESM-compatible)
- Use `index.ts` barrel files for public API exports
- Avoid code comments unless they explain non-obvious logic
- Follow SOLID principles (SRP, OCP, LSP, ISP, DIP)

### Angular

- Use **standalone components** exclusively
- Use Signal-based APIs: `input()`, `output()`, `signal()`, `computed()`
- Do **not** use legacy `@Input()` / `@Output()` decorators
- Use `inject()` instead of constructor injection
- Keep template and styles in sibling files: `templateUrl: './x.component.html'`
  and `styleUrl: './x.component.css'`, never inline `template:` or `styles:`
- Stylesheets under `packages/` are plain **`.css`**, not `.scss`. These packages
  are built with bare `ngc`, which has no style preprocessor: it inlines a
  referenced file verbatim, so SCSS syntax would reach the browser unchanged and
  be silently dropped.

### General

- No unnecessary abstractions for one-time operations
- No speculative code for hypothetical future requirements
- Prefer simple, readable code over clever solutions

## Testing

### Framework

Tests use **Jest 30** with **SWC** for fast TypeScript transformation.

### Conventions

- Test files are colocated with source: `foo.spec.ts` next to `foo.ts`
- Test fixtures go in `__fixtures__/` directories
- Helpers that several specs share go in `__test-utils__/` directories. Both are left out of the library build and of the declared-dependencies check (`npm run check:deps`), so a fixture or helper may import a package that only the root `package.json` declares, as a devDependency
- Test environment is `node` (not `jsdom`) unless specifically required
- In `packages/ng-prism`, a spec whose `Date`s depend on the time zone is named `*.tz.spec.ts`: `jest.config.cjs` runs it in two projects, `America/New_York` and `Europe/Berlin`, through `jest.timezone-environment.cjs`, which sets `TZ` before the spec runs and gives the zone to the spec as `__PRISM_TIMEZONE__`
- In `packages/ng-prism`, a spec that checks the canvas simulation against a real browser is named `*.chromium.spec.ts`. It runs in Node and drives Chromium through Playwright (`src/app/simulate/__test-utils__/chromium.ts`), in a target of its own, `test-chromium` (`jest.chromium.config.cjs`), and not in `test`: in CI, `test` runs on Nx Cloud agents, which have no browser. `npm run check` runs it as well, so install Chromium once with `npx playwright install chromium`

### Running Tests

```bash
# All tests for a package
npx nx test ng-prism

# Single test file
npx nx test ng-prism -- --testPathPatterns=scanner

# The specs against real Chromium (*.chromium.spec.ts)
npx nx run ng-prism:test-chromium

# All packages
npx nx run-many -t test
```

### Writing Tests

- Test behavior, not implementation details
- Use descriptive test names that read as specifications
- Keep test fixtures minimal and focused

## Documentation

`docs/` is the published docsify site. Every topic is described in full on exactly one page, its owner page; any other page gives it a sentence at most and links there. A change to public API or behaviour updates the owner page in the same PR.

### Page Roles

- **Reference** (`docs/api/`) is complete and terse: type, values, default, restrictions, warnings, since and deprecated, at most one short example and a link to the owner page of the topic. No reasoning at length, no how-tos.
- **Guides** (`docs/guide/`) explain a task or a concept with examples. A field they use links to the reference instead of repeating its type and default.
- **Architecture** (`docs/architecture/`) explains the internals for contributors and plugin authors. Whatever a user needs to use ng-prism is on a guide or a reference page; an architecture page links to it at most.
- Nothing internal on a user page: no spec file names, internal constants or measurements from development.
- English and factual, without chains of dashes. `defineConfig` is always imported from `@ng-prism/core/config`, as `ng add` writes it, and example URLs use port 4400.
- The prerequisites are spelled out once, in [Installation › Prerequisites](docs/guide/installation.md#prerequisites), and read the same everywhere else: Angular 22, Node.js 22+.

### Versions

- Guides and reference say only "since x.y" and "deprecated since x.y, removed in z". Anything else about how a release changed things ("Up to 22.5.0 …", "before …", "now lives …", "has moved …") goes under that release in [Upgrade Notes 22.x](docs/guide/upgrade-notes-22.md), or is dropped.
- What was never in a stable release does not exist: a note that only concerns users of a beta is dropped.

### Owner Pages

| Topic                                                                                            | Owner page                                                                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Type, default and rules of a `@Showcase` field                                                   | [api/showcase-config.md](docs/api/showcase-config.md)                                                  |
| Shape of a type (`Variant`, `ShowcaseState`, `CanvasBg`, the discovery types …)                  | [api/types.md](docs/api/types.md)                                                                      |
| Sidebar order (`category`, `section`, the order fields, `tags`, `status`)                        | [guide/showcase-decorator.md](docs/guide/showcase-decorator.md)                                        |
| Input types and their controls, defaults, inheritance, aliases, `InputsOf`                       | [guide/inputs-and-controls.md](docs/guide/inputs-and-controls.md)                                      |
| States, pseudo states, when a state fits a variant, exclusion reasons                            | [guide/states.md](docs/guide/states.md)                                                                |
| `bg` and `canvasLayout`: behaviour, both defaults, the `checker` deprecation                     | [api/showcase-config.md](docs/api/showcase-config.md)                                                  |
| Viewport width, canvas tools, the names of the UI parts, the phone layout                        | [guide/styleguide-ui.md](docs/guide/styleguide-ui.md)                                                  |
| `content`                                                                                        | [guide/content-projection.md](docs/guide/content-projection.md)                                        |
| `template`, host template, `imports`                                                             | [guide/compositions.md](docs/guide/compositions.md)                                                    |
| `host` as a string or an object, `DirectiveHost`                                                 | [guide/directive-hosting.md](docs/guide/directive-hosting.md)                                          |
| Composition, `renderPage` or component page: which to use                                        | [guide/component-pages.md](docs/guide/component-pages.md)                                              |
| `partOf`: its rules in the reference, how a part shows in the guide                              | [api/showcase-config.md](docs/api/showcase-config.md#partof) and [guide/parts.md](docs/guide/parts.md) |
| What the scanner can read statically                                                             | [guide/scanner-reads.md](docs/guide/scanner-reads.md)                                                  |
| Every build message, with its cause and fix                                                      | [api/build-warnings.md](docs/api/build-warnings.md)                                                    |
| The contract for external tools: anchors, render marker, capture mode, the room for a focus ring | [guide/external-tooling.md](docs/guide/external-tooling.md)                                            |
| CI patterns: report, gate, deploy                                                                | [guide/ci.md](docs/guide/ci.md)                                                                        |
| A11y report schema                                                                               | [guide/a11y-reports.md](docs/guide/a11y-reports.md)                                                    |
| VRT report schema                                                                                | [plugins/visual-regression.md](docs/plugins/visual-regression.md)                                      |
| Config fields, deprecated ones included                                                          | [api/ng-prism-config.md](docs/api/ng-prism-config.md)                                                  |
| Theme tokens, the `theme` example                                                                | [guide/theming.md](docs/guide/theming.md)                                                              |
| Builder options, `entryPoint`, `cacheDir`, the watcher                                           | [api/builders.md](docs/api/builders.md)                                                                |
| Where the manifest is written, path mapping                                                      | [architecture/pipeline.md](docs/architecture/pipeline.md) (the setup snippet in Installation may stay) |
| `ng add` of the plugins                                                                          | [plugins/overview.md](docs/plugins/overview.md)                                                        |
| Hook signatures, the types that define a plugin                                                  | [api/ng-prism-plugin.md](docs/api/ng-prism-plugin.md)                                                  |
| Hook order, the services and pipes gate, Node and browser, the two-zone principle                | [architecture/plugin-hooks.md](docs/architecture/plugin-hooks.md)                                      |
| Badge, icon, UI primitives, status grading                                                       | [api/plugin-ui.md](docs/api/plugin-ui.md)                                                              |
| How a panel looks                                                                                | [plugins/panel-design.md](docs/plugins/panel-design.md)                                                |
| What the JSDoc plugin reads: tags, overloads, members                                            | [plugins/jsdoc.md](docs/plugins/jsdoc.md)                                                              |
| URL parameters                                                                                   | [guide/url-state.md](docs/guide/url-state.md)                                                          |
| `ng-prism-strip`                                                                                 | [guide/library-publishing.md](docs/guide/library-publishing.md)                                        |
| Breaking changes, deprecations, version history                                                  | [guide/upgrade-notes-22.md](docs/guide/upgrade-notes-22.md)                                            |

### Adding and Moving Pages

- A new page gets its entry in `docs/_sidebar.md`.
- A page that moves or is merged into another keeps its old URL working until the next major: a redirect in the `prism-redirects` block of `docs/index.html`, and a stub at the old path that links the absolute URL of the new page's raw `.md`, because agents fetch raw Markdown and never run the redirect.
- `npm run check:docs` checks links and anchors, the sidebar, the redirects, the stubs and version history outside the upgrade pages. It must report no errors before a PR that touches `docs/` is merged.

## Commit Guidelines

This project follows **Conventional Commits**.

### Format

```
<type>: <description>
```

### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs`     | Documentation only changes                              |
| `test`     | Adding or correcting tests                              |
| `chore`    | Maintenance tasks, dependency updates                   |
| `release`  | Version bump and release                                |

### Examples

```
feat: add buildInfo config option for version pill in header
fix: resolve tsconfig path aliases in manifest scanner
refactor: remove reflect-metadata from Showcase decorator
docs: update plugin API reference
```

### Rules

- Use the imperative mood ("add feature" not "added feature")
- Keep the first line under 72 characters
- Reference issues when applicable: `fix: resolve scanner crash (#42)`

## Pull Request Process

### Before Submitting

1. Run the full check suite: `npm run check`, which must pass clean (this is what CI runs)
2. Update documentation in `docs/` if your change affects public APIs or behavior
3. Rebase on `upstream/main` (or `origin/main` with write access) if your branch has fallen behind

### PR Requirements

- **Title:** Follow the commit message format (`feat: ...`, `fix: ...`, etc.)
- **Description:** Explain _what_ changed and _why_
- **Scope:** Keep PRs focused: one feature or fix per PR
- **Tests:** Include tests for new functionality or bug fixes
- **Docs:** Update relevant documentation

### Review Process

- All PRs require review before merging
- CI must pass (lint, test, build via GitHub Actions)
- Address review feedback with new commits (don't force-push during review)

## Plugin Development

ng-prism has a plugin architecture. Plugins live under `packages/plugin-*/` and are published as `@ng-prism/plugin-*`.

### Creating a Plugin

1. Create a new package under `packages/plugin-<name>/`
2. Implement the `NgPrismPlugin` interface
3. Export a factory function (e.g., `myPlugin(options?)`)
4. Use lazy-loading for Angular components (`loadComponent` instead of `component`)

### Plugin Hooks

Which hooks there are, in which order and where they run is described in [Plugin Hooks](docs/architecture/plugin-hooks.md), their signatures in [NgPrismPlugin](docs/api/ng-prism-plugin.md).

### Plugin Conventions

An official plugin builds with `ngc` and depends on `ng-prism:build`; how a plugin declares its peer dependencies, splits its Node and browser entry points, keeps its runtime components lazy-loaded and reads options per component from `@Showcase({ meta })` is described in [Writing a Plugin](docs/plugins/writing-plugins.md).

Refer to existing plugins (e.g., `plugin-figma`, `plugin-jsdoc`) as reference implementations.

## Reporting Issues

### Bug Reports

When filing a bug, please include:

- **ng-prism version** and **Angular version**
- **Steps to reproduce** the issue
- **Expected behavior** vs. **actual behavior**
- **Error messages** or stack traces if applicable
- **Minimal reproduction** (a GitHub repo or StackBlitz is ideal)

### Feature Requests

For feature requests, please describe:

- The **problem** you're trying to solve
- Your **proposed solution** (if you have one)
- Any **alternatives** you've considered

### Where to Report

Open an issue on the [GitHub repository](https://github.com/ng-prism/ng-prism/issues). The issue forms for bugs, feature requests, and documentation problems ask for the information listed above.

Suspected security vulnerabilities do **not** belong in public issues. See [SECURITY.md](SECURITY.md) for the private reporting channel.

---

## License

By contributing to ng-prism, you agree that your contributions will be licensed under the [MIT License](LICENSE).
