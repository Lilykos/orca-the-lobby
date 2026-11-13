# Orca community catalog listing

What to submit for The Lobby, checked against the catalog's rules (<https://onorca.dev/plugins/add/>, the [listing policy](https://github.com/stablyai/orca/blob/main/docs/reference/plugin-listing-policy.md) and [plugin authoring](https://github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md), read 2026-11-13).

## How listing works

There is no form and no queue. The directory lists a public GitHub repository that has the `orca-plugin` topic and a `vX.Y.Z` tag, usually within an hour, if the manifest passes Orca's validator and the safety checks. It lists the newest tag, pinned to its exact commit and content hash; pushes without a new tag change nothing. The plugin's status page is `https://orca.dev/plugins/Lilykos/orca-the-lobby`. Community plugins are checked by machine, not reviewed.

```sh
gh repo edit Lilykos/orca-the-lobby --add-topic orca-plugin
git tag v1.0.0 && git push origin v1.0.0
```

## Entry

| Field | Value |
| --- | --- |
| Name | The Lobby |
| Catalog id | `lilykos.the-lobby` (`<repository owner, lowercased>.<manifest id>`; manifest `id` is `the-lobby`, `publisher` is left out) |
| Repository | <https://github.com/Lilykos/orca-the-lobby> |
| Version | 1.0.0 (tag `v1.0.0` must match the manifest `version`) |
| License | MIT (`LICENSE`) |
| Execution | `trusted-worker` (shown as "Full access" on the card) |
| Requires | Orca >= 1.4.248 (`engines.orca`) |
| Categories | `panels`, `commands`, `integrations` (the catalog derives these from what the manifest contributes; The Lobby contributes a panel, two commands with keybindings, a status bar item, events and hooks) |
| Topics | `orca-plugin` (required); also `orca`, `pixel-art`, `ai-agents`, `claude-code`, `codex` |

### One-line description

This is the manifest `description` (219 characters):

> See every agent in every worktree in one live view: pixel people in a room per project, who needs you or seems stuck, org charts of who started whom, and context and tokens per agent. Everything is read on your machine.

### Longer description

Run a dozen agents in parallel worktrees and still know, at a glance, who is working, who is stuck and who needs you. The Lobby turns every agent Orca runs into a little pixel person in a lobby that lives in the sidebar: one room per project (worktrees of a repo share it), working agents at desks with an icon for what they are doing, finished ones at the coffee machine. Counts show how many are working, need you, are done or failed.

- **Know who needs you.** Speech bubbles say **Need you!**, **Stuck?** or **Failed**, or show the first line of a finished agent's reply. A Needs attention filter dims everything else, and an optional desktop notification fires when an agent has had no activity, or has still needed you, for 10 to 60 minutes.
- **See who started whom.** The Activity tab draws an org chart per project from the exact parent and worker links Orca reports, also across worktrees. Nothing is guessed.
- **Act without hunting through tabs.** Open any agent to jump to its terminal, send an instruction to an agent running in a terminal, or compact a Claude Code conversation. Previous / Next agent shortcuts (Cmd/Ctrl+Alt+Up/Down) step through the agents that need you first.
- **Watch the context fill.** Context and tokens per agent, and tokens today per project, are read from Claude Code and Codex logs on your machine.
- **Charm and care.** A day and night window, five extra palettes plus Orca's own theme, and reduced motion respected.

Everything is read from your machine (the Orca CLI, Git, and Claude Code and Codex session logs) and nothing leaves it: no network access, no analytics. It acts only when you press something: it opens a workspace or brings a terminal forward on **Go to agent**, and types into a terminal only on **Send** or a confirmed **Compact conversation**. Plugins cannot type into Orca chat agents, and Claude Code's logs state no context window, so Claude agents show tokens without a percentage; the README lists the other limits.

### Capabilities declared

`agent:read`, `workspace:read`, `storage:own`, `workspace:write` (Go to agent, Previous / Next agent), `notifications:show` (optional notifications), `terminal:send` (instruction box and Compact, only on request). Each is explained in the README's Permissions section.

## Screenshots

Alt text and captions, in the order to show them. Files are in `docs/images/`.

| # | File | Alt text / caption |
| --- | --- | --- |
| cover | `docs/images/catalog/cover.png` | The Lobby: the pixel title and orca mascot, a tagline, and two project rooms with Need you!, Stuck? and Failed speech bubbles |
| icon | `docs/images/icon.png` | The Lobby icon: the orca mascot |
| 1 | `docs/images/catalog/office.png` | Every agent, every worktree, one glance |
| 2 | `docs/images/catalog/attention.png` | Know who needs you |
| 3 | `docs/images/catalog/activity.png` | See who started whom |
| 4 | `docs/images/catalog/drawer.png` | Jump in without hunting tabs |
| 5 | `docs/images/catalog/context.png` | Context and tokens, per agent |
| 6 | `docs/images/catalog/palettes.png` | Day or night, Orca's theme or five palettes |

### Image requirements (important)

The catalog's rules for manifest images: a `cover` at 16:10 and at least 800x500, and up to six `screenshots` at least 1280x800. Good entries (`klausbegnis.agent-center`, `palulabs.office-tycoon`) use a 1600x1000 cover, a 256x256 `icon` and screenshots of 1280x800 or larger, each with alt text. The agreed README images do **not** all meet this: `cover.png` is 1280x640 (2:1, not 16:10) and the panel screenshots are 420 and 900 wide. Use them for the README, and produce a separate catalog set (for example in `docs/catalog/`, which is in the repository so the directory can copy it from the release):

- `cover.png` 1600x1000, `icon.png` 256x256
- six 1600x1000 posters in docs/images/catalog/ (regenerate with scripts/media; see scripts/media/README.md)

PNG, JPEG, WebP and GIF are fine; no TTF/OTF fonts, executables, archives or symlinks anywhere in the repository.

## Manifest fields to add before tagging

The manifest does not yet have the catalog-facing fields. Add them before `v1.0.0` (this follows `palulabs/orca-tycoon`'s manifest):

```json
"license": "MIT",
"author": { "name": "Lilykos", "url": "https://github.com/Lilykos" },
"repository": "https://github.com/Lilykos/orca-the-lobby",
"homepage": "https://lilykos.github.io/orca-the-lobby/",
"icon": "docs/images/icon.png",
"cover": { "path": "docs/images/catalog/cover.png", "alt": "..." },
"screenshots": [{ "path": "docs/images/catalog/....png", "alt": "..." }]
```

Leave `publisher` out: Orca derives it from the repository owner, and a `publisher` that differs from the owner gets the plugin left out.

## Checklist

- [ ] Repository `Lilykos/orca-the-lobby` is public, not a fork, not archived.
- [ ] `orca-plugin.json` at the root, manifest format 2, `license` set and a detectable `LICENSE` file.
- [ ] No `publisher`, or one equal to the repository owner (`Lilykos`/`lilykos`); nothing starting with `orca`, `official`, `github`.
- [ ] Catalog image fields added and files committed at the right sizes (see above); alt text on each.
- [ ] `orca plugin test .`, `tsc --noEmit` and `orca plugin check .` pass; `git diff --check` clean.
- [ ] No binary files, symlinks or minified/obfuscated code. Source is readable TypeScript.
- [ ] Free to use: no paywall, license key or trial.
- [ ] No tracking or data collection (true: no network access; stated in the README).
- [ ] Name, icons and screenshots contain no real brand marks or explicit content; screenshots use demo data only (no real projects, prompts or paths).
- [ ] README and CHANGELOG describe 1.0.0; `version` in the manifest is `1.0.0`.
- [ ] Add the topic: `gh repo edit Lilykos/orca-the-lobby --add-topic orca-plugin`.
- [ ] Tag and push: `git tag v1.0.0 && git push origin v1.0.0`.
- [ ] Open `https://orca.dev/plugins/Lilykos/orca-the-lobby` (or use "Check status" on <https://onorca.dev/plugins/add/>) and fix whatever it lists.
- [ ] After listing: `orca plugin install Lilykos/orca-the-lobby` works, and the plugin appears in Settings → Plugins with the community catalog added (`https://github.com/stablyai/orca-community-plugins.git`, ref `main`).
- [ ] For later releases: bump `version`, update the CHANGELOG, push a new `vX.Y.Z` tag. A listed version never changes (first seen wins); a moved tag is refused.
