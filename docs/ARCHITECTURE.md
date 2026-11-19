# Architecture

How The Lobby works inside. For what it does, see the [README](../README.md).

## Shape

Two halves, talking through Orca's plugin messages (the contract is declared once in `src/protocol.ts`):

- **Worker** (`src/worker.ts`, trusted worker): asks Orca who its agents are, listens to status and tool-call events, keeps the office state, and posts `office.update` to the panel. Its status bar item keeps it running while the plugin is enabled. A restart drops memory, so the state is also kept in `orca.storage`.
- **Panel** (`panel/index.html`, `panel/main.ts`): draws the Office, Activity and Settings tabs and the agent drawer. It asks the worker for `office.snapshot`, `office.actions`, `office.goTo`, `office.send`, `office.compact`, `office.select` and `office.clearHistory`.

Orca transpiles the TypeScript when it loads the plugin; there is no build step and no runtime font or image asset. All artwork is drawn with rectangles on canvas (`panel/scene.ts`, `panel/banner.ts`).

## Source map

| File | Role |
| --- | --- |
| `src/office.ts` | The office state: one record per agent, changed only by its functions; no Orca calls, so tests run it as plain data. Bounded journal, pruning, storage shape. |
| `src/roster.ts` | The Orca CLI (`worktree ps`, `terminal list/switch/send`) and `git diff --shortstat`. |
| `src/actions.ts` | Pure parts of drawer actions and the previous/next agent order: terminal matching, instruction checks, CLI answers. |
| `src/transcript.ts` | Claude Code transcripts: tasks and changed files (heuristic). |
| `src/usage.ts` | Tokens for the local day from Claude Code and Codex logs, per workspace and project. |
| `src/context.ts` | Per-agent context fill, compactions and tokens via an exact id chain. |
| `panel/scene.ts` | Room layout, people, desks, bubbles and status wording. |
| `panel/family.ts`, `panel/chart.ts` | The Activity org chart: tree from reported parent/child links, and its geometry. |
| `panel/palettes.ts`, `panel/names.ts`, `panel/navigation.ts`, `panel/work-map.ts` | Palettes, friendly names, tab/focus helpers, task labels. |

## Data flow

1. **Roster.** The worker runs `orca worktree ps --json` every 3 s while an agent is working and every 20 s when idle (soon after any status or tool event, never closer than 3 s). It also asks `agents.list` for the focused workspace when workspace focus changes, and hears `agent.status.changed`, `agent.tool.before` / `after`, `workspace.changed` and `workspace.removed`. The hooks only record the call and return at once.
2. **Fallback.** If the CLI is unavailable, only events and the focused workspace's `agents.list` are used; chat calls are unavailable and finished agents linger for four hours. Project grouping then reads a workspace's `.git` file to find the main checkout.
3. **Enrichment** (per roster pass, in the background): Claude transcript notes, uncommitted changes (every 15 s per workspace), tokens today (every 30 s) and per-agent context.
4. **Publish.** Updates are batched (one post per burst; Orca allows 200 posts per 10 s) and saved to storage every few seconds. The journal is stripped from what the panel receives and trimmed to fit Orca's 256 KiB storage limit when saved.

## Context chain

Per-agent context never comes from titles, times or folders, only an exact id chain:

1. A chat agent's pane key is `structured-agent-session-<Orca session id>:<leaf>`.
2. Orca's session store (`agent-session-journal.db`, read-only through `sqlite3`, selecting only the provider and its session id) records that session's Claude Code session id or Codex thread id.
3. That id is in the log's file name (`~/.claude/projects/*/<id>.jsonl`, `~/.codex/sessions/YYYY/MM/DD/rollout-…-<id>.jsonl`).

From that one log the drawer shows the latest request's tokens (cache included; for Codex the input side of the last request), the compactions the log records, and the session's tokens today (only the current provider session, the latest in Orca's record). The percentage uses the window the log states: Codex logs do, Claude Code logs do not.

The read runs in the background and never holds up a panel update or notification. Orca's store is asked at most every 30 s per session; after a failure (no `sqlite3`, a locked or missing database) not again for a minute, and a log that is not found is searched for once a minute. `/usr/bin/sqlite3` is tried first, then `sqlite3` on the PATH. A store record that is not valid JSON is skipped. Each log is read once and shared with the tokens-today counts. The store is an Orca internal, not a documented API, so a future release could change it; the lines then simply disappear.

## Drawer actions

- **Terminal match**: an agent is matched to a terminal by the terminal id or pane key Orca reports; a chat session has none, so nothing is typed into one.
- **Typing** goes through `orca terminal send --text=… --enter` (the host's `terminal.sendText` only works for the focused workspace), and only if the agent is still shown at work, in a terminal no other agent shares. `/compact` is offered for Claude Code only, and not while the agent is blocked, since a typed command would be taken as the answer.
- **Previous / Next agent** keep one fixed order for a run of presses (2.5 s window) even if an agent changes state meanwhile.

## Rooms and bubbles

Rooms are keyed by project checkout and host; worktrees on the same host share one. Project names include the host name (or `local`) so rooms for the same project on different machines remain distinguishable. Rooms and charts share one order: the person's own (`prefs.projectOrder`, set with ↑ ↓), else Orca's sidebar (`orca repo list --json`, which lists repos in sidebar order; matched by repo id, or by path without the roster), else by name. Finished agents stand in deterministic spots around the coffee machine (up to four); decorations are picked from a stable room seed and placed only in clear space. A speaker's bubble replaces its thought icon; needing you beats stuck, which beats a finished reply. Bubbles stay inside the room, slide or give way to more important ones, and cut long text with an ellipsis, never in the middle of an emoji. The window follows local time in six four-hour periods.

## Activity chart

Dashed lines come from project membership; solid lines only from a parent reported by Orca (matched by exact agent key, also across worktrees) or children listed under an agent. A parent that is not in the roster leaves the agent unlinked with a short note. Needs attention de-emphasizes everything not blocked or failed but removes nothing, so the hierarchy stays readable.

## Palettes

`panel/palettes.ts`: Orca default follows the host theme; the others are panel-local and adapted from the official Catppuccin palette, the Dracula specification and GitHub Primer primitives.
