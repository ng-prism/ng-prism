# AI Coding Agents

ng-prism is younger than the training data of most coding agents. An agent that has never seen `@Showcase` guesses,
usually with Storybook patterns. The ng-prism plugin for [Claude Code](https://code.claude.com/docs) gives it the rules
instead: how to write a showcase that builds without warnings, how to check it in the running styleguide, how to set up
and configure ng-prism, and how to write a plugin.

## Install

There is nothing to clone. Claude Code fetches the plugin from this repository on GitHub. From a shell, one command adds
the marketplace and installs the plugin (Claude Code 2.1.292 or later):

```bash
claude plugin install ng-prism --marketplace ng-prism/ng-prism
```

On an older version it takes two:

```bash
claude plugin marketplace add ng-prism/ng-prism
claude plugin install ng-prism@ng-prism
```

In a Claude Code session, run the same two as `/plugin marketplace add ng-prism/ng-prism` and
`/plugin install ng-prism@ng-prism`.

### For the whole team

Run the two commands in the repository with `--scope project`:

```bash
claude plugin marketplace add ng-prism/ng-prism --scope project
claude plugin install ng-prism@ng-prism --scope project
```

They write the marketplace and the plugin into the project's `.claude/settings.json`, which you commit:

```json
{
    "extraKnownMarketplaces": {
        "ng-prism": {
            "source": { "source": "github", "repo": "ng-prism/ng-prism" }
        }
    },
    "enabledPlugins": {
        "ng-prism@ng-prism": true
    }
}
```

When a teammate opens the repository in Claude Code and trusts the folder, Claude Code offers to add the marketplace and
install the plugin. The one-command install doesn't work for this: it declares the marketplace in your user settings
even with `--scope project`, so your teammates' Claude Code wouldn't know where the plugin comes from.

Add `"autoUpdate": true` next to `source` in the marketplace entry, and everyone gets new plugin versions without
running an update.

## What it covers

| Skill                   | For                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ng-prism:showcase`     | Writing or changing `@Showcase` configs, also for services, pipes and compositions (`template`, `host: { template }`, `imports`), fixing `⚠ ng-prism:` build warnings, checking variants in the running styleguide |
| `ng-prism:setup`        | `ng add`, `ng-prism.config.ts`, the official plugins, theming, publishing a library without its showcases, upgrades                                                                                                |
| `ng-prism:write-plugin` | Your own plugin: build-time hooks, panels, controls, header widgets, sidebar decorations, packaging                                                                                                                |

Claude Code loads a skill when your request matches it. You can also call one directly, e.g. `/ng-prism:showcase`.

## Checking in the browser

The showcase skill starts the styleguide (`ng run <lib>:prism`) and takes a screenshot of each variant it touched, using
the Playwright of your project. For a [service](guide/services-and-pipes.md#services) or a
[pipe](guide/services-and-pipes.md#pipes) it captures the API page instead, to check that its JSDoc reads cleanly there.
If Playwright is missing, the agent asks before it installs it (`npm i -D playwright && npx playwright install chromium`). An agent with a browser tool of its own uses that instead;
otherwise it gives you the URL to check. Either way it drives the styleguide through the
[External Tooling API](guide/external-tooling.md).

## The installed version decides

The skills read the version of `@ng-prism/core` in your `node_modules` and treat the typings shipped with it as the
reference. A field the skill names but your version doesn't have yet is left alone.

The plugin's version follows the ng-prism releases. Plugins from marketplaces other than the official ones don't update
automatically by default. Fetch a new version with `claude plugin update ng-prism@ng-prism`, or turn on auto-update for
the `ng-prism` marketplace in `/plugin` under **Marketplaces**. A running session keeps the old version until you run
`/reload-plugins` or start a new one.
