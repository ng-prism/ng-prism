<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `npx nx build`, `npx nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project overview

ng-prism is an Angular-native alternative to Storybook. A library annotates its
components with `@Showcase`; the ng-prism builder scans the library statically
and generates a styleguide app around them, without story files.

This repo is an Nx monorepo on npm workspaces:

- `packages/ng-prism/` is `@ng-prism/core`: decorator, builders, styleguide
  app, plugin API and schematics.
- `packages/plugin-*/` are the six official plugins (`@ng-prism/plugin-*`).
- `test-workspace/` is a separate Angular workspace that consumes the local
  packages. Its `test-lib` is the demo styleguide and the scanner's real-world
  input (skill `prism-test-workspace`).
- `video/` is a standalone npm project, outside the npm workspaces and Nx, that
  builds the product videos (the tour on the docs start page, release clips) from
  scripted recordings of `test-workspace`'s `video-lib` and Revideo scenes (skill
  `prism-product-video`).
- `docs/` is the published docsify site, `scripts/` holds the release and
  lint-fix scripts and `render-brand-assets.mjs`, which renders the README cover
  and the docs logo from `docs/assets/brand/cover.html`.

# Architecture

Code in the core runs in one of two places, and which one decides what it may
import:

- **Build time, in Node:** `src/builder/`. The `serve` and `build` builders
  (`builders.json`) load `ng-prism.config.ts`, scan the library's entry points
  with the TypeScript Compiler API (`builder/scanner/`), run the plugins'
  build-time hooks and write `ng-prism-cache/<prism-project>/prism-manifest.ts`,
  which imports the real component classes. They then hand over to the Angular
  build or dev server of the generated `<lib>-prism` app; `serve` re-scans on
  file changes.
- **Runtime, in the browser:** `src/app/`, the styleguide app that renders the
  manifest (shell, sidebar, canvas, controls, panels, services). Components
  render in the same document, without an iframe.

`src/app/` never imports from `src/builder/`; the builder may reuse
framework-free helpers from `src/app/` (the a11y summary does). Both sides
share `src/decorator/` (`@Showcase` and its types), `src/plugin/` (plugin API)
and `src/shared/` (small types such as canvas background, layout and pseudo
states). `src/schematics/` holds `ng add` and the `ng update` migrations;
`src/transformer/` strips `@Showcase` from a library's published build
(`ng-prism-strip`).

The package entry points follow the same split: `@ng-prism/core` (decorator,
plugin API, styleguide app), `/config` (`defineConfig`), `/plugin`,
`/transformer` and `/schematics/utils`. A plugin package maps its runtime half
to the `browser` export condition (`index.browser.ts`), which keeps its Node-only
build-time code out of the app bundle.

**Consumer plugin.** The repo doubles as a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) with one
plugin, `ng-prism`, in `.agents/plugins/claude/`. Its skills `showcase`, `setup` and `write-plugin` teach agents in
projects that _use_ ng-prism; they describe the public API and behaviour, not this repo. `scripts/publish.sh` sets the
plugin's `version` to the release version: Claude Code caches an installed plugin by that string, so existing installs
get new skill content with the next release. Keep `package.json` and lockfiles out of the plugin folder, since Claude
Code runs a dependency install in a plugin folder that has both. The `showcase` skill's `scripts/screenshot.mjs` is
also the script the `prism-test-workspace` skill runs.

In depth: `docs/architecture/pipeline.md` (build pipeline and both builders),
`scanner.md`, `plugin-hooks.md` and `canvas-state.md`.

# Tech stack and commands

Angular 22 (signals, standalone components), TypeScript 6, Nx 22. The packages
build with bare `ngc`, tests run on Jest 30 with SWC, lint on ESLint 9 with
angular-eslint and Prettier, styles on Stylelint. Playwright is a root
devDependency for browser automation (the `prism-test-workspace` screenshots),
and a local Verdaccio registry feeds the test workspace's installs.
`package.json` holds the exact versions.

```bash
npm run check          # Full local check: format, declared deps, Stylelint, then lint/test/build/typecheck everywhere
npm run check:fix      # Fix what check reports (see below for why not nx ... --fix)
npm run build:all      # Build the core and every plugin
npx nx test ng-prism   # One package's tests; add -- --testPathPatterns=<name> for one spec
npm run docs           # docsify site on localhost:3000
npm run publish        # Interactive release script (scripts/publish.sh)
```

The test workspace has its own `test:workspace:*` scripts; the
`prism-test-workspace` skill and `CONTRIBUTING.md` › Test Workspace describe
them.

# Linting and formatting

The full picture is in the _Linting and formatting_ section of `CONTRIBUTING.md`.
Three things are easy to get wrong and are worth repeating here:

- **Use `npm run lint:fix` / `npm run check:fix` to fix, never `nx run-many -t lint --fix`.**
  This is the one exception to the "always go through nx" rule above.
  The `lint` target is cached but declares no outputs, so a cache hit replays an
  empty result while the files it was supposed to rewrite stay untouched. The
  command then reports success on a tree it never fixed. The npm scripts call
  `scripts/fix-until-stable.mjs` directly, which additionally loops to a fixed
  point, because neither `eslint --fix` nor `stylelint --fix` converges in one
  pass. Checking (`npm run lint`, `npm run check`, the pre-push hook) stays on
  nx, where caching is correct.

- **`--max-warnings 0` decides whether a run fails, not the severity.**
  Every lint target carries it via `nx.json`'s `targetDefaults`. A `warn` rule
  is just as blocking as an `error`; the severity only controls how loud the
  finding looks in the editor.

- **Formatting is not a separate step for `.ts` and Angular templates.** Prettier
  runs as the `prettier/prettier` ESLint rule there, so one `eslint --fix` covers
  formatting and rules together. `nx format:write` remains responsible for
  everything else (`.json`, `.md`, `.yml`, `.scss`, `.css`, `.js`/`.mjs`/`.cjs`,
  and the three standalone `.html` documents). The pre-commit hook does both for
  staged files, so a normal commit needs no manual formatting run.

# Things the tooling won't catch

- Stylesheets under `packages/` are plain `.css`. The packages build with bare
  `ngc`, which inlines styles verbatim, so SCSS would reach the browser unparsed.
- Tests run in Jest's `node` environment. In `packages/ng-prism`, a test that
  needs the DOM is named `*.browser.spec.ts`, which puts it in the jsdom project
  of its `jest.config.cjs`.
- A change to public API or behaviour updates the matching pages under `docs/` in the same PR, and the consumer
  plugin's skills under `.agents/plugins/claude/skills/` where they describe it.
- ng-prism majors track Angular majors. A breaking change inside the current
  Angular major ships as a minor release, with `@deprecated` (since and removal
  version) and a migration note.

# Personal configuration

`CLAUDE.md` is a committed symlink to this file, so Claude Code, which reads
`CLAUDE.md` rather than `AGENTS.md`, gets the same instructions as every other
agent. Personal instructions for this repo go into the gitignored
`CLAUDE.local.md` (Claude Code loads it right after `CLAUDE.md`), instructions
for every project into `~/.claude/CLAUDE.md`. Don't replace the symlink with a
file of your own.

# Skills

Task guides live in `.agents/skills/` (the directory Codex and Copilot read
natively), one folder per topic with a `SKILL.md`. Claude Code only reads
`.claude/skills/`, which holds one relative symlink per skill; it loads a skill
when the task matches its description. The `nx-*` skills named in the Nx section
above are Nx's own (`.github/skills/`, and the Nx plugin for Claude Code).
`.agents/plugins/claude/skills/` holds the consumer plugin's skills (see Architecture): they are for projects that use
ng-prism, not for work on this repo, and Claude Code here loads them only when the plugin is installed.

Project skills and agents carry the `prism-` prefix; only those are committed
(see `.gitignore`). A new project skill is a folder
`.agents/skills/prism-<name>/` plus its symlink:
`ln -s ../../.agents/skills/prism-<name> .claude/skills/prism-<name>`. Personal
skills and agents in `.claude/skills/` / `.claude/agents/` without the prefix
stay local. Don't give a personal skill the `prism-` prefix or a project skill's
name: a personal skill with the same name silently overrides the project one.

| Skill                      | Covers                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| `prism-showcase-component` | Adding or editing a `@Showcase` decorator                                     |
| `prism-angular-component`  | Creating a component for the core, a plugin or the scanner fixtures           |
| `prism-scanner-module`     | Creating or extending a module under `packages/ng-prism/src/builder/scanner/` |
| `prism-plugin`             | Creating a plugin against the `NgPrismPlugin` interface                       |
| `prism-test-workspace`     | Running the demo styleguide on the local packages and checking a change in it |
| `prism-product-video`      | Making a release clip, re-recording the videos, fixing a render               |

# Subagents

Claude Code subagents in `.claude/agents/`:

| Agent                        | Purpose                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `prism-branch-code-reviewer` | Reviews the current branch against the project conventions before a PR (runs on Sonnet); leaves correctness bugs to a general code review |
