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

## Simplification revision — 2026-11-21 (proposed, not implemented)

### Objective and current baseline

Make Attention useful during real work: identify the next intervention, reach the agent, and return without managing another busy dashboard. This revision updates presentation within the existing 1.3 scope. The existing identity, classification, Reviewed, permissions, persistence and notification contracts remain authoritative. Earlier live/platform and release gates remain open.

Baseline is `708c385`, including `d2d639f`: notification controls already live in Settings, the banner has one shared toggle across views, and Attention has state colors. Preserve those changes; do not rebuild the older notification-heavy inbox shown in previous screenshots. Inspect current fixtures and source before implementing.

Assumptions: preserve Office's pixel character and all three functional views; reduce default information rather than add another density setting; retain existing user banner/view/order choices; do not change backend semantics to make the screen look quieter.

### Presentation decisions

1. **Compact Attention rows.** Replace large cards with a task title (up to two lines), a secondary line with project and waiting/completion age, and a clear action. Retain a text state label where group context is insufficient. Omit repeated state phrases, character-name paragraphs, provider and routine local-host labels. Show workspace/branch/host only when needed to distinguish otherwise identical entries; keep all known metadata searchable and available in details. Missing titles fall back honestly to reported context, never generated summaries or inferred approval questions.
2. **Separate navigation from details.** A task-title button opens Lobby details; one visible `Open agent` action uses the existing validated navigation. Avoid a whole clickable card containing other buttons. When navigation is unavailable, the task title still opens details and an accessible explanation states the limitation. Opening never marks Reviewed or sends input. Move explicit `Mark Reviewed` into result details, with its existing durable acknowledgement, errors and predictable next-item focus. No bulk dismissal, automatic review or new keyboard shortcuts.
3. **Prioritize intervention without hiding results.** Keep Needs input and explicit failures expanded. Show other eligible completions in a native disclosure labeled `Finished · N`, collapsed on a fresh panel session. Unknown outcomes remain honestly labeled. Search with completion matches reveals those matches; clear search restores the preceding disclosure choice. User expansion survives live updates and view switches within the panel session. New arrivals never expand it or steal focus automatically. The disclosure always shows its count, including unread eligible results; collapsing does not alter classification, review state or notifications.
4. **Calm header and filters.** Keep the existing shared banner preference, brand and navigation. Do not forcibly collapse an existing user's chosen banner. Use one compact Attention heading/count area, not a live-agent count plus queue summary plus repeated totals. Keep a visible `Filter` disclosure for search/project controls, with an active-filter count and an always-accessible clear action when active. A hidden filter can never silently restrict results. Preserve shared query/project state across views and existing disappearance/reset behavior. Use native disclosure and ordinary Tab behavior rather than another menu system.
5. **Useful quiet and degraded states.** Separate no agents, no filter matches, no intervention needed with finished results, and nothing pending. Show a small working-agent count from reported state where useful. Do not say everything is fine when failures exist or pretend polling proves a remote host healthy. Preserve existing data/save warnings and navigation errors. A nonzero Finished count must remain visible in the quiet state.
6. **Keep secondary controls where they belong.** Settings remains the canonical notification-control location. Keep persisted mute/snooze status there, with at most a small existing status indicator in task context if it can be sourced accurately without adding requests. Do not add a second settings surface, a project menu, a notification popover or duplicate controls in this pass. The drawer keeps existing task/state/result/action hierarchy and supplementary disclosure; no further drawer rewrite.

### Delivery order and review gates

Extend the existing checklist with tasks 14–19. Start with a fixture-based static comparison at 280/420/900px using identical synthetic data, showing both a busy queue and a quiet queue. This is the cheapest place to judge whether the proposed layout is actually clearer. Review that preview before implementing interactive behavior. Then deliver compact rows/details, completion disclosure, header/filter behavior, and integrated verification/docs/media. Keep each behavioral change separately reviewable; do not refactor the worker or general panel entry point along the way.

Use Luna High for development and Terra High for review through Orca workers, as already requested. Shared panel files require sequential development. A reviewer may inspect a settled slice while the next independent documentation task proceeds, but no concurrent edits to panel/main.ts.

### Acceptance and verification

- In a 420px-wide by 800px-high fixture with branding collapsed, render at least four short intervention rows without scrolling. This is a fixture target, not permission to truncate essential context or force users' banner preferences.
- A user can identify blocked versus failed work and reach a navigable agent with one action. Details remain available with one action; unavailable navigation does not create a dead end.
- The collapsed Finished section has a visible, accurate count. Search finds collapsed matches; clearing restores disclosure state. Reviewing a result keeps the next sensible focus target and never changes Orca unread/status.
- At 280px there is no horizontal overflow; task titles remain readable, controls have at least 32px height, and essential information does not depend on hover or color. Keyboard and screen-reader names describe each action's task.
- Gated async saves/reads, state changes, removed rows, focused disclosure/filter controls and 100-agent updates preserve draft/input, focus and reading position. Avoid announcing routine time/count changes on every poll; announce user action outcomes and actionable errors.
- Preserve current review/notification durability, request validation, migration, project order, shared banner preference, density choices, reduced motion and remote restrictions. Add targeted failing-then-passing browser tests for changed behavior; retain existing regression coverage rather than deleting assertions to accommodate a redesign.
- Run the existing unit/type/plugin/browser checks, regenerate fixture media only after layout approval, validate links/assets/mobile pages, and have Terra review the final diff. Record the real trial separately; headless fixtures do not complete Checkpoints B/C.

### Scope limits and release decision

No new dashboard, counters page, history, AI summary, backend, dependency, persistent preference family, remote service or hidden bulk action. Do not change default notification settings. Improve Office/Activity shared chrome only where needed for consistency; preserve their content and ordering. Release preparation remains separate and requires the user's instruction after the trial. If the visual comparison does not make the next action clearer, revise it before coding rather than compensate by adding features.
