## What & Why

<!--
What does this change, and what problem does it solve? Link the issue if there
is one: "Closes #42". If there is no issue, the description is the only context
a reviewer gets.
-->

## Type of Change

<!-- Match the PR title prefix. See Commit Guidelines in CONTRIBUTING.md. -->

- [ ] `feat`: new feature
- [ ] `fix`: bug fix
- [ ] `refactor`: no behaviour change
- [ ] `docs`: documentation only
- [ ] `test`: tests only
- [ ] `chore`: maintenance, dependencies

## Affected Packages

- [ ] `@ng-prism/core`
- [ ] Plugin(s): <!-- name them -->
- [ ] Builder / schematics
- [ ] Documentation (`docs/`)

## Breaking Change

- [ ] No
- [ ] Yes, described below, with the migration path for consumers

<!--
ng-prism majors track Angular majors. A breaking change inside the current
Angular major ships as a minor release, so the migration notes matter.
-->

## How Was This Verified?

<!--
Beyond `npm run check`: what did you run? Which showcase or variant did
you look at in the test workspace? Screenshots help for anything UI-facing.
-->

## Checklist

- [ ] `npm run check` passes clean (format, declared deps, docs, style, lint, test, test-chromium, build, typecheck; the same steps CI runs)
- [ ] PR title follows the conventional commit format (`feat: ...`, `fix: ...`, etc.)
- [ ] Tests cover the new behaviour or the fixed bug
- [ ] Docs under `docs/` are updated if public API or behaviour changed
- [ ] New components use signal APIs (`input()` / `output()`) and `inject()`
- [ ] Any new plugin runtime components are lazy-loaded (`loadComponent`)
