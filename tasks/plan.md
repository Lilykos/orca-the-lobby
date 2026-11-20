# The Lobby 1.3 implementation plan

Status: approved for development, 2026-11-20. Development uses GPT-6-Luna High Orca workers; review uses GPT-6.1 Terra High Orca workers. Baseline: released 1.2.0. This document plans the work; it does not authorize implementation or publication by itself. Executable tasks are tracked in [todo.md](todo.md).

## Objective

Make it easy to find the next agent that needs a person, review a finished result, and return to work without hunting through rooms or receiving a burst of redundant notifications. Preserve the pixel Office and Activity chart as useful views.

The release succeeds when an agent needing input can be found and opened directly from Attention; finished results can be reviewed locally; those decisions survive a restart; and busy updates preserve focus, reading position and text input.

## Capability map and build order

| Capability | Responsibility | Depends on |
| --- | --- | --- |
| workspace-context | Explicit project, branch and host labels | Existing roster and office model |
| attention | Queue membership, order, completion identity, local review state | workspace-context |
| presentation | Inbox rendering, search, density and drawer hierarchy | attention |
| notification-policy | Mute, reminder snooze, grouping and deduplication | attention identity; existing notification events |
| release-quality | Migration, integration checks, docs, media and publication | All capabilities |

Build order: workspace-context → attention → presentation → notification-policy → release-quality. Deliver one tested slice at a time; do not replace the existing panel wholesale.

## Scope

### Required for 1.3

- A third functional view, Attention, alongside Office and Activity; Settings remains accessible.
- Needs input, Failed to review, and Finished to review groups across projects.
- Explicit project/workspace/branch/host context wherever Orca reports it.
- Local Reviewed state for a particular completion, not for an agent forever.
- Search and a project filter, with Comfortable/Compact density.
- A smaller header and clearer task/state/action hierarchy; preserve pixel art and palettes.
- Per-project notification mute, temporary reminder snooze and brief notification burst grouping.
- Upgrade compatibility, tests, updated documentation, website, screenshots and contributor credit.

### Deferred

Full session history/resume; a Today dashboard or general timeline; PR/CI integrations; launching agents; bulk prompts; pricing estimates; additional provider log parsers; a full host-health dashboard; wholesale CLI-to-host-API migration; untracked-file counting as a separate fix; and a general rewrite of panel/main.ts. Fix blockers discovered in touched paths, but record unrelated work separately.

The notification sender prefix is controlled by Orca, not this plugin. Track the upstream display-name fix separately; no unsupported notification backend or plugin identity change.

## Proposed behavior

### Attention queue

| Group | Include | Remove |
| --- | --- | --- |
| Needs input | Currently listed blocked agents | Orca reports another state, or the agent leaves the live roster |
| Failed to review | Currently listed done agents with an explicit failure outcome | That completion is Reviewed, a new turn starts, or the agent leaves |
| Finished to review | Currently listed non-failed done agents that are Orca-unread or whose completion was observed after tracking began | That completion is Reviewed, a new turn starts, or the agent leaves |

Groups are mutually exclusive. Waiting, quiet, cancelled or unconfirmed outcomes must not be relabeled as blocked, failed or successful. A quiet/stuck hint is secondary information, not proof of failure. Existing Office/Activity retain their broader roster; Attention is a work queue.

On first upgrade, establish a baseline: include current blocked agents, explicit failures, and unread results, but do not invent completion events for every old finished agent. Show unknown outcomes honestly. An agent finishing is not proof that its code is correct or ready to merge.

Order groups as above. Within Needs input, longest waiting first; within result groups, newest completion first. Use identity as a deterministic tie-breaker. Preserve the focused/selected row, scroll position and input while data updates. New arrivals must not steal focus; invalid actions disappear promptly when the underlying state changes.

1.3 includes currently known live-roster agents only. When a session closes or a paired server becomes unreachable, its entries leave Attention under the existing roster rules. Do not promise a closed-session archive; that belongs to later history work.

### Identity and local state

Use an opaque, host-qualified agent identity plus a stable turn/completion discriminator. Prefer trustworthy source transition times; when absent, capture and persist one observation identity instead of generating a new key each poll. Test repeated identical replies, missing timestamps, reconnects, restart and pane reuse. Do not use a reply-text hash as the identity.

Persist reviewed completion keys in worker-owned plugin storage. Re-observing the same completion stays reviewed, but a later turn creates a fresh result. Bound metadata to the existing 24-hour activity horizon and a fixed entry cap, prune deterministically, and never add full transcript storage. A failed write must show an error and must not silently dismiss the item as saved.

Reviewed means "reviewed in the Lobby" only. It changes neither Orca unread nor the agent status, and sends no terminal input. Opening the drawer or navigating to an agent does not automatically mark it Reviewed. Announce successful review accessibly and move focus predictably to the next item or group.

### Information and actions

Reuse the existing task label, provider, portraits, drawer and navigation/action validation. Primary information is task title, state and primary action. Friendly character names are secondary. Each row shows project/workspace, branch when known, host and elapsed state time. Missing metadata is omitted or explained; do not parse display-name suffixes to reconstruct identity.

Use explicit metadata fields supplied by the roster/worker. If branch or host metadata is unavailable, search must still work with the known fields. A last observed tool may be shown as context, clearly labeled; it is not the approval question. No inline approve/deny or typing into chat sessions.

Go to agent is available directly on an inbox row where navigation is possible. Review details opens the existing drawer. Keep existing terminal-send safety checks, workspace fallbacks, remote restrictions and truthful navigation failures.

### Search, layout and migration

Search case-insensitively over task, friendly name, provider, project, workspace, branch and host; use literal normalized text, not regular expressions. Add a project selector with All projects. Apply the same query/filter to Attention, Office rosters and Activity without deleting structural chart ancestors or changing project order. Show match counts and a distinct no-matches state. Retain the query while switching views; keep it ephemeral across a fresh application session.

Comfortable density remains the upgrade default. Compact reduces spacing and secondary detail, not legibility or keyboard access. Respect palettes, Orca theme and reduced motion; states always have text/icons as well as color. Keep the user's manual room/chart order.

New installations start in Attention. Upgrades preserve Office initially; after that, remember the user's selected functional view. Never switch views automatically when an agent changes state. Settings is not a remembered startup view.

Keep the collapsible pixel banner available across Office, Activity, Attention and Settings, with one shared toggle. Move detailed calls, tokens and supplementary metadata into progressively disclosed drawer sections without removing them. Extract only the rendering sections needed by these changes; new inbox logic and notification policy get focused modules instead of being added to the large panel entry point.

### Notification policy

- Existing notify-blocked, notify-done, long-turn threshold and stuck-reminder settings remain authoritative.
- Per-project mute suppresses Lobby notifications for that project only. It never hides agents, changes Orca-native notification preferences or marks a result reviewed. Persist mute choices and show a visible muted state.
- Snooze reminders for 15 minutes, 1 hour, or until manually resumed. A blocked agent remains visible and counted. Snooze suppresses repeat stuck/needs-you reminders for the current agent episode, not a later failure or a different turn. Store an absolute expiry; restart cannot extend it accidentally. At expiry, send at most one eligible reminder if the episode still qualifies; no catch-up flood.
- Group eligible transition notifications by project and kind over a fixed two-second window measured from its first event. Additional events never extend the deadline. One event keeps a useful individual message; multiple events get one count/project summary. Distinct projects and kinds remain distinct.
- Use the same stable episode/completion identities to deduplicate events from hooks, roster and restore. Restart never replays an old backlog. Unmuting does not replay missed alerts. Update notification bookkeeping deliberately on failure; do not retry indefinitely.
- Applying mute while a group is pending must suppress it; re-check current eligibility before sending. Keep required context concise, with no new remote service or transcript upload.

## Implementation approach

Keep TypeScript, the existing DOM/canvas UI and worker model. No new framework, backend or runtime dependency is planned. The existing storage/read/notification permissions should cover this scope. Feature-detect optional supported host methods rather than assuming the newest Orca is installed. Do not raise the minimum supported version casually or replace richer CLI roster data with a poorer API response.

Proposed focused modules: src/attention.ts for queue projection/identity/review state; src/notifications.ts for notification decisions and pending groups; panel/attention.ts for inbox rendering. A shared UI helper or drawer extraction is justified only by an actual reused boundary. Retain the current plain functions and colocated *.test.ts conventions.

## Verification and release contract

Use tests that reproduce each state, persistence and notification bug before implementing its fix. Test pure projections and policy with deterministic time; use mounted-worker tests for storage/requests; use the existing browser fixture for rendered interactions.

Commands from the repository root:

```sh
orca plugin types . --json
orca plugin test .
npx --yes --package typescript tsc --noEmit
orca plugin check . --json
python3 scripts/shots/run.py
python3 scripts/shots/media.py
python3 scripts/media/render.py
python3 scripts/shots/sizes.py
git diff --check
```

Resolve the actual Orca executable for the host before running commands. Use isolated fixture data for public media. There is no separate build step.

Cover widths 280, 420 and 900; keyboard-only actions; theme/reduced motion; upgrade from real-shaped 1.2 preferences; malformed/failed storage; missing data; unknown outcomes; remote identity collisions; disconnect/reconnect; rapid repeated turns; and 100-agent busy fixtures. Preserve focus, scrolling, drafts and project order. Apply fixed storage/payload caps and verify steady polling causes no metadata growth. Record Windows/Linux and real paired-server checks as unverified until actually run.

Before release: code review, full unit/interaction/type/plugin checks, user trial in the development copy, README/architecture/privacy/troubleshooting updates, landing page/guide/FAQ updates, regenerated media, link/mobile checks, and contributor credits. Set version 1.3.0 in the manifest and About constant only at release preparation. Publication and switching the installed copy are a separate release action after the development trial; do not reuse authorization to publish 1.2.0 as authorization to publish 1.3.0.

## Checkpoints and scope control

1. Queue checkpoint: classification, identity, restore and local review are correct before adding visual polish.
2. UI checkpoint: find → open → review works with keyboard and busy updates; inspect the actual Office and Attention screens.
3. Notification checkpoint: mute/snooze/grouping and restart behavior are deterministic without losing inbox items.
4. Release checkpoint: all required acceptance criteria and public assets are verified; outstanding platform limitations are explicit.

If the release needs trimming, defer drawer restructuring first, then notification burst grouping. Keep queue correctness, identity, persistence, accessibility and data-truthfulness intact. Make any scope reduction explicit in the checklist and release notes.

## Proposed defaults to review

The plan proposes: Attention as the new-install default; Office preserved on upgrade; only currently listed agents in 1.3; 24-hour bounded review metadata; two-second notification grouping; and the snooze durations above. These are product choices, not claims that the features already exist.
