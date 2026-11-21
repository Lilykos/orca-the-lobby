# Architecture

How The Lobby works inside. For what it does, see the [README](../README.md).

## Shape

Two halves, talking through Orca's plugin messages (the contract is declared once in `src/protocol.ts`):

- **Worker** (`src/worker.ts`, trusted worker): asks Orca who its agents are, listens to status and tool-call events, keeps the office state, and posts `office.update` to the panel. Its status bar item keeps it running while the plugin is enabled. A restart drops memory, so the state is also kept in `orca.storage`.
- **Panel** (`panel/index.html`, `panel/main.ts`): draws Attention, Office, Activity and Settings, the shared filters, and the agent drawer. `panel/attention.ts` renders the queue; the panel asks the worker for `office.snapshot`, `office.actions`, navigation/send/compact requests, local review, preference patches and history clearing.

Orca transpiles the TypeScript when it loads the plugin; there is no build step and no runtime font or image asset. All artwork is drawn with rectangles on canvas (`panel/scene.ts`, `panel/banner.ts`).

## Source map

| File | Role |
| --- | --- |
| `src/office.ts` | The office state: one record per agent, changed only by its functions; no Orca calls, so tests run it as plain data. Bounded journal, pruning, storage shape. |
| `src/roster.ts` | The Orca CLI (`worktree ps`, `terminal list/switch/send`) and `git diff --shortstat`. |
| `src/actions.ts` | Pure parts of drawer actions and the previous/next agent order: terminal matching, instruction checks, CLI answers. |
| `src/attention.ts` | Current-roster queue groups, completion review classification and bounded local Reviewed state. |
| `src/transcript.ts` | Claude Code transcripts: tasks and changed files (heuristic). |
| `src/usage.ts` | Tokens for the local day from Claude Code and Codex logs, per workspace and project. |
| `src/context.ts` | Per-agent context fill, compactions and tokens via an exact id chain. |
| `panel/scene.ts` | Room layout, people, desks, bubbles and status wording. |
| `panel/family.ts`, `panel/chart.ts` | The Activity org chart: tree from reported parent/child links, and its geometry. |
| `panel/attention.ts` | Attention queue rows, action feedback and predictable review focus. |
| `panel/search.ts`, `panel/palettes.ts`, `panel/names.ts`, `panel/navigation.ts`, `panel/work-map.ts` | Shared search/filter projection, palettes, friendly names, tab/focus helpers and task labels. |

## Data flow

1. **Roster.** The worker runs `orca worktree ps --json` every 3 s while an agent is working and every 20 s when idle (soon after any status or tool event, never closer than 3 s). It also asks `agents.list` for the focused workspace when workspace focus changes, and hears `agent.status.changed`, `agent.tool.before` / `after`, `workspace.changed` and `workspace.removed`. The hooks only record the call and return at once.
2. **Fallback.** If the CLI is unavailable, only events and the focused workspace's `agents.list` are used; chat calls are unavailable and finished agents linger for four hours. Project grouping then reads a workspace's `.git` file to find the main checkout.
3. **Enrichment** (per roster pass, in the background): Claude transcript notes, uncommitted changes (every 15 s per workspace), tokens today (every 30 s) and per-agent context.
4. **Publish.** Updates are batched (one post per burst; Orca allows 200 posts per 10 s) and saved to storage every few seconds. The journal is stripped from panel snapshots; the complete office storage value is deterministically bounded by UTF-8 bytes before it is written.

## Attention and local review

Attention projects the current live roster into three mutually exclusive groups: blocked agents need input; done agents with an explicit failure outcome need failure review; other done agents appear for review only when Orca reports unread state or the worker observed a completion after tracking began. Known cancellation, interruption, unconfirmed and superseded outcomes are excluded. A done state with no outcome is labeled as unknown, not successful.

The worker captures completion identity from source finish time and reported turn/session discriminators when available. When source time is missing it captures one local observation identity and persists it across polls and restart. A hidden turn transition with no reported discriminator is inherently ambiguous when the same pane and state reappear; the worker does not claim certainty in that case. `finishedAtSource` is kept through storage compaction so the panel can label a source finish as “Finished” and a local fallback as “Done observed”.

Reviewed markers are SHA-256 completion keys in worker-owned plugin storage, capped at 500 entries and retained for 24 hours. A review request is validated against the current completion and committed before success is reported. It changes neither Orca's unread flag nor the agent's state. The saved office and journal are bounded to 200,000 serialized UTF-8 bytes; if required identities cannot fit, the worker refuses the write rather than truncate identity keys and logs the capacity error.

## Preferences and presentation

Panel preference changes are validated field patches serialized by the worker, which rereads the latest stored object before merging and acknowledging a write. Existing settings are preserved during upgrades: a confirmed 1.2 installation without an explicit selected view opens Office, while a genuinely fresh installation defaults to Attention. After startup, the last functional view (Office, Activity or Attention) is remembered; Settings is not. Comfortable density is the migration default.

Settings puts Appearance first, followed by global notification choices and a collapsed native project/episode controls disclosure, then Local data and a compact About footer. The disclosure keeps counts plus read/save errors and Retry visible while closed. Clearing local activity history uses an inline Cancel/Clear confirmation before calling the existing worker clear request.

Attention uses compact task-first rows: the title opens details and a separate validated Open agent action navigates when available. Needs input and failure groups stay expanded; a native Finished disclosure keeps its count visible while collapsed. Search reveals matching Finished results, and clearing search restores the user's disclosure choice. Mark Reviewed remains an explicit result-drawer action. The Filter disclosure shows its active count, while Clear stays visible whenever search/project selection restricts results. Quiet states distinguish an empty roster, no matches and no intervention while retaining any Finished count.

Search and project selection share one normalized projection across Attention, Office and Activity. Activity retains reported ancestors needed to locate matching descendants, and the Office and chart manual project order is unchanged. The drawer leads with task, state, result and available primary action, then places calls, context/tokens and other supplemental information behind a native disclosure.

## Notification policy

The worker stores project mutes and episode-scoped reminder snoozes separately from user preferences and Orca settings. A project mute suppresses all Lobby notifications for that project; a 15-minute, one-hour or manual snooze suppresses repeat quiet/blocked reminders for the current episode only. It does not suppress transition alerts, hide/count fewer agents, or catch up on alerts when resumed/unmuted. Snooze expiry is absolute, and a later episode has a separate identity.

Eligible state-transition alerts are grouped by project and kind for a fixed two seconds from the first event; one event keeps its individual message, while a burst produces a project/count summary. Event, roster and restore observations share stable identities so a transition is not replayed on restart. The policy is limited to 200 muted projects, 500 snoozes and 1,000 handled transition/reminder identities; pending groups are capped at 500. Its complete serialized value must fit the 200,000-byte storage budget. A malformed, unreadable or over-capacity policy leaves controls unavailable or unsaved with a visible error; the panel exposes retry, and an unsuccessful write is not acknowledged as saved.

## Verification and release state

The manifest and About are prepared for 1.3.0; publication is a separate step. Automated browser verification uses isolated synthetic fixtures on macOS. The real GUI trial, paired-server behavior and Windows/Linux runtime behavior remain unverified. In Orca 1.4.264, the source-folder development load accepted worker requests but its panel shot failed with “The plugin panel could not be loaded”; this is a development-loader issue under investigation, not a result from the packaged release. Local Claude transcript enrichment reads titles and recent prompts for heuristic matching plus TodoWrite entries and edited file names; it remains on the machine, and prompt text is not added to the activity journal.

## Context chain

Per-agent context never comes from titles, times or folders, only an exact id chain:

1. A chat agent's pane key is `structured-agent-session-<Orca session id>:<leaf>`.
2. Orca's session store (`agent-session-domain.db` on Orca 1.4.261+, with `agent-session-journal.db` used only when the new file is absent, read-only through `sqlite3`, selecting only the provider and its session id) records that session's Claude Code session id or Codex thread id.
3. That id is in the log's file name (`~/.claude/projects/*/<id>.jsonl`, `~/.codex/sessions/YYYY/MM/DD/rollout-…-<id>.jsonl`).

From that one log the drawer shows the latest request's tokens (cache included; for Codex the input side of the last request), the compactions the log records, and the session's tokens today (only the current provider session, the latest in Orca's record). The percentage uses the window the log states: Codex logs do, Claude Code logs do not.

The read runs in the background and never holds up a panel update or notification. Orca's store is asked at most every 30 s per session; after a failure (no `sqlite3`, a locked or missing database) not again for a minute, and a log that is not found is searched for once a minute. `/usr/bin/sqlite3` is tried first, then `sqlite3` on the PATH. A store record that is not valid JSON is skipped. Each log is read once and shared with the tokens-today counts. The store is an Orca internal, not a documented API, so a future release could change it; the lines then simply disappear.

## Drawer actions

- **Terminal match**: an agent is matched to a terminal by the terminal id or pane key Orca reports; a chat session has none, so nothing is typed into one.
- **Typing** goes through `orca terminal send --text=… --enter` (the host's `terminal.sendText` only works for the focused workspace), and only if the agent is still shown at work, in a terminal no other agent shares. `/compact` is offered for Claude Code only, and not while the agent is blocked, since a typed command would be taken as the answer.
- **Previous / Next agent** keep one fixed order for a run of presses (2.5 s window) even if an agent changes state meanwhile.

Paired-server agents are qualified by environment id. Unreachable servers return no agents until they reconnect; old working states are never replayed as live observations. Navigation checks both command acceptance and whether Orca actually navigated.

## Rooms and bubbles

Rooms are keyed by project checkout and host; worktrees on the same host share one. Project names include the host name (or `local`) so rooms for the same project on different machines remain distinguishable. Rooms and charts share one order: the person's own (`prefs.projectOrder`, set with ↑ ↓), else Orca's sidebar (`orca repo list --json`, which lists repos in sidebar order; matched by repo id, or by path without the roster), else by name. Finished agents stand in deterministic spots around the coffee machine (up to four); decorations are picked from a stable room seed and placed only in clear space. A speaker's bubble replaces its thought icon; needing you beats stuck, which beats a finished reply. Bubbles stay inside the room, slide or give way to more important ones, and cut long text with an ellipsis, never in the middle of an emoji. The window follows local time in six four-hour periods.

## Activity chart

Dashed lines come from project membership; solid lines only from a parent reported by Orca (matched by exact agent key, also across worktrees) or children listed under an agent. A parent that is not in the roster leaves the agent unlinked with a short note. Needs attention de-emphasizes everything not blocked or failed but removes nothing, so the hierarchy stays readable.

The functional views also share literal, normalized search over reported task/prompt, friendly name, provider and explicit project, workspace, branch and host fields. A selected project is applied independently of search text; if that project disappears from the live roster, the filter returns to All projects.

## Palettes

`panel/palettes.ts`: Orca default follows the host theme; the others are panel-local and adapted from the official Catppuccin palette, the Dracula specification and GitHub Primer primitives.
