# The Lobby 1.3 tasks

Simplification revision proposed 2026-11-21: tasks 14–19 below extend this same release plan. Existing completed work and unrun live/platform gates remain intact. Presentation decisions are in the final section of [plan.md](plan.md); implementation has not started.

Implementation started, 2026-11-20. Tasks 01–03 assigned first; remaining tasks follow the documented dependencies. Scope and behavioral rules: [plan.md](plan.md). Check a task only after its acceptance criteria and verification pass. Sizes are relative scope, not calendar promises.

## 01 — Explicit workspace context (M)

- [x] Carry project/workspace, branch and host metadata through the existing roster/office boundary; retain host-qualified identities and older payload compatibility.
- [x] Missing fields never produce guessed labels; known labels appear consistently in a pure presentation projection.
- [x] Verify mapping fixtures for local/paired agents, duplicate paths and missing metadata, plus type checking.

Dependencies: none. Likely files: src/protocol.ts, src/office.ts, src/roster.ts, src/office.test.ts. Do not change navigation in this task.

## 02 — Attention membership and completion identity (M)

- [x] Implement pure Needs input / Failed to review / Finished to review classification, deterministic ordering and stable completion identities.
- [x] First observation establishes the documented baseline; new turns, missing times, unknown outcomes and reconnects do not create duplicate or fake results.
- [x] Verify repeated polls, first upgrade, repeated identical replies and host collisions with failing-then-passing unit tests.

Dependencies: 01. Likely files: src/attention.ts, src/attention.test.ts, src/protocol.ts.

## 03 — Persistent local Reviewed state (M)

- [x] Add validated worker requests and bounded storage for reviewed completion keys, shared across panel instances.
- [x] Review survives restart, affects only that completion, and leaves Orca unread/status unchanged; failed writes are visible and do not silently hide results.
- [x] Verify persistence, malformed storage, concurrent requests, pruning and a later completion through mounted-worker tests.

Dependencies: 02. Likely files: src/attention.ts, src/protocol.ts, src/worker.ts, src/worker.test.ts, src/attention.test.ts.

### Checkpoint A

- [x] Membership, identity and restore/review semantics pass before building additional UI. Terra reviewed `57bb255` and cleared Checkpoint A with no remaining required blockers.

## 04 — End-to-end Attention view (M)

- [x] Add grouped inbox, counts, empty state and direct Go to agent / Review details / Reviewed actions, reusing existing validated actions and drawer.
- [x] Preserve selected row, focus and scroll during updates; show truthful action availability and failure notes.
- [x] Verify keyboard review-to-next behavior, disappearing agents and live updates at narrow/wide widths using browser fixtures (280/420/900px and 100-agent updates).

Dependencies: 01–03. Likely files: panel/attention.ts, panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py.

## 05 — Shared search and project filter (M)

- [x] Add literal case-insensitive search over reported context and a project selector across functional views.
- [x] Keep query on view changes, preserve project order and necessary chart ancestors, and distinguish no matches from no agents.
- [x] Verify search normalization, missing fields, chart filtering, clear/reset, keyboard focus and busy updates.

Dependencies: 04. Likely files: panel/search.ts, panel/search.test.ts, panel/main.ts, panel/attention.ts, scripts/shots/fixture.js.

## 06 — Header, density and view preferences (M)

- [x] Add Comfortable/Compact density, compact navigation/header and collapsible Office branding without removing pixel rooms or palettes.
- [x] Migrate preferences without losing layout/order/notifications; preserve Office on upgrade and remember later view choices.
- [x] Verify malformed preferences, first-install defaults, theme, reduced motion, keyboard access and 280/420/900-width rendering.

Dependencies: 04. Likely files: src/protocol.ts, panel/main.ts, panel/index.html, src/office.test.ts, scripts/shots/fixture.js.

## 07 — Drawer hierarchy (M)

- [x] Put task/state/result/primary action first and progressively disclose calls, tokens and supplementary details.
- [x] Preserve Send drafts, confirmation state, helper details, focus return and all existing action restrictions; extract only necessary drawer code.
- [x] Verify existing drawer/action scenarios and new hierarchy with keyboard and reduced motion.

Dependencies: 04, 06. Likely files: panel/drawer.ts, panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py.

Review: Terra approved `1a65df0` with no remaining task 07 blocker. The real development-panel trial in Checkpoint B remains pending.

### Checkpoint B

- [ ] Demonstrate find → open → review on the real development panel; inspect Office, Activity and Attention at multiple widths.
- [ ] Confirm stable reading position and task identity during 100-agent fixture updates.

Development runtime smoke (2026-11-20): Orca 1.4.264; reloaded the root `local.the-lobby` dev folder after confirming its six capability kinds match the previously approved plugin. The published `lilykos.the-lobby` 1.2.0 copy remains disabled. `office.installation` returned `legacy`; the read-only office snapshot contained 13 current agents and 2 existing Reviewed keys. No preference, review, notification-policy or terminal action was changed. Hidden-panel `plugin shot` captures of the live Office settled with no render errors at 280, 420 and 900px: `/tmp/the-lobby-live-smoke-280.png`, `/tmp/the-lobby-live-smoke-420.png`, `/tmp/the-lobby-live-smoke-900.png` (kept outside the repository because they show live task content). The one-time computer-use permission query reported Accessibility granted, but `get-app-state` returned `permission_denied`; no GUI interaction was attempted. Real find/open/review, Activity/Attention navigation, keyboard/focus and 100-agent live-update checks remain pending.

## 08 — Isolate existing notification decisions (S)

- [x] Extract a small notification-policy module while preserving current transition settings, long-turn threshold and reminder behavior.
- [x] Keep event/roster deduplication and no-backlog-on-start behavior explicit; no new preferences yet.
- [x] Verify equivalent behavior with deterministic policy tests and existing worker notification tests.

Dependencies: 02. Likely files: src/notifications.ts, src/notifications.test.ts, src/worker.ts, src/worker.test.ts.

Verified in reviewed extraction commits `209ee38` and `e1f01f0`; unit and worker tests cover pure transition/reminder decisions and event/roster deduplication.

## 09 — Project mute and reminder snooze (M)

- [x] Add persistent project mute and episode-scoped reminder snooze with clear controls, expiry and resume.
- [x] Keep blocked agents visible/counted; neither mute nor snooze changes Orca-native settings or replays an old notification backlog.
- [x] Verify restart, expiry, a new turn/failure, pending notifications, cancelled writes and visibly muted/snoozed UI states.

Dependencies: 03, 04, 08. Likely files: src/protocol.ts, src/notifications.ts, src/worker.ts, panel/attention.ts, src/worker.test.ts. Test policy cases in the module's existing test file as needed.

Status: reviewed worker persistence/shutdown handling and visible Attention controls are verified by worker and browser fixtures. Mute and snooze remain local to The Lobby; the live notification trial is still pending at Checkpoint C.

## 10 — Burst notification grouping (M)

- [x] Group eligible notifications by project and kind over a non-extending two-second window; preserve useful individual messages.
- [x] Re-check eligibility/mute before dispatch and prevent duplicate delivery or indefinite retries across polling and restart.
- [x] Verify isolated events, bursts, distinct projects/kinds, state changes during the window, failure and restart using deterministic time.

Dependencies: 08–09. Likely files: src/notifications.ts, src/notifications.test.ts, src/worker.ts, src/worker.test.ts.

Status: reviewed two-second grouping and worker dispatch backend passed policy/worker tests and the combined full suite. Live notification trial remains pending at Checkpoint C; release copy remains deferred.

### Checkpoint C

- [ ] Notifications become quieter while all actionable inbox items remain discoverable; inspect behavior during a development-copy trial.

No mute/snooze control was changed and no notification was generated for this smoke. Manual trial still needed when Computer Use is available: use a disposable project and test completion to review one result and verify Orca unread/status is unchanged; switch Office/Activity/Attention and check keyboard focus at 280/420/900px; mute/unmute the disposable project and snooze/resume its eligible test episode, confirm agents and counts remain present, then restart the dev worker and confirm the choices persisted without catch-up alerts. Do not use an active user's real completion or trigger a desktop notification solely for this check.

## 11 — Integrated regression and compatibility checks (M)

- [x] Extend browser scenarios for search, review, density, migration, empty/error states, burst updates and keyboard focus; retain all existing scenarios.
- [x] Verify storage/payload bounds and startup behavior; run the full unit, TypeScript, plugin and screenshot checks in plan.md.
- [ ] Exercise real paired-server disconnect/reconnect and Windows/Linux where hosts are available; record exact outcomes and remaining limitations rather than treating simulated coverage as hardware validation.

Dependencies: 04–10. Likely files: scripts/shots/fixture.js, scripts/shots/run.py, scripts/shots/demo.js, src/worker.test.ts, docs/ROADMAP.md. Split any newly discovered production fix into its own tested task.

Integration evidence: all seven reviewed notification commits were cherry-picked in order. Combined root checks passed: 238 plugin tests, `npx --yes --package typescript tsc --noEmit`, plugin check (valid, no errors), and 101 browser scenarios across 280/320/340/420/900px, including keyboard, reduced-motion, storage-failure, notification-control and focus cases. Storage bounds passed; the public image set is 3,681 KB against the 8 MB budget. Real paired-server reconnect and Windows/Linux checks were not available; Checkpoint C and the live trial remain pending.

## 12 — Docs, website and media (M)

- [x] Update README/architecture for local Reviewed semantics, retention, permissions, mute/snooze, defaults and the actual platform/API limits.
- [x] Update website landing page, guide/FAQ, changelog and contributor credits to match the final scope.
- [x] Regenerate fixture-based screenshots/posters; check image limits, links, desktop/mobile rendering and browser errors.

Dependencies: 11; draft copy may begin earlier. Documentation batch: README.md, docs/ARCHITECTURE.md, docs/index.html, docs/guide.html, CHANGELOG.md. Media/catalog updates are a separate follow-up batch using existing scripts and docs/LISTING.md.

Draft documentation now describes reviewed 1.3 development behavior while keeping the published 1.2.0 install/version explicit. Fixture-based media includes the Attention queue and project mute/episode snooze controls; the public image set is 3,681 KB. Local targets/anchors, desktop/mobile rendering at 390px, browser console and image limits passed; paired-server/platform verification and the Checkpoint B/C live trials remain outstanding.

## 13 — Review, trial and 1.3.0 release

- [ ] Review the full diff; trial the development copy with existing settings and real work before selecting the release commit.
- [ ] On release instruction, set both version values to 1.3.0, finalize notes and verification, commit/push/tag/publish without moving old tags, and retain contributor authorship.
- [ ] Verify deployed GitHub Pages and published metadata, update the installed plugin, unload the dev copy, and verify runtime/settings before marking the release complete.

Dependencies: all required tasks and checkpoints. Likely files: orca-plugin.json, panel/main.ts, CHANGELOG.md, docs/LISTING.md, docs/ROADMAP.md; external release and local plugin operations follow verification.

## Release gate

- [ ] Required acceptance criteria pass; scope reductions, if any, are explicit.
- [ ] No regressions in Office, Activity, shared order, actions, privacy or upgrade settings.
- [ ] Development trial, code review, docs/media checks and published-release verification are recorded.
- [ ] Deferred upstream/platform work remains visible, not falsely marked complete.

## Simplification pass — proposed tasks 14–19

These tasks precede task 13 release preparation. Preserve the original live gates; a new fixture preview does not satisfy them.

### 14 — Validate the simpler layout (S)

- [ ] Capture the actual `708c385` baseline and create isolated busy/quiet layout previews with the same synthetic data at 280/420/900px; include a long title, duplicate project/task labels and unavailable navigation.
- [ ] Show compact task rows, title-to-details/Open agent distinction, collapsed Finished count and filter affordance; preserve the shared banner choice and Settings notifications.
- [ ] Review the comparison with the user before interactive implementation; record the selected layout without adding product settings.

Dependencies: none. Files: existing fixture tooling and disposable preview artifacts outside production sources. Verification: visual inspection, no overflow, proposed four-short-row target at 420×800 with banner collapsed. Scope: S. No production behavior changes in this task.

### 15 — Compact rows with explicit navigation (M)

- [ ] Implement task/project/time rows, meaningful disambiguation and separate accessible title/details and validated Open agent actions; retain unavailable-action explanations.
- [ ] Keep Reviewed explicit in result details, preserving durable error/retry handling and focus return to the next row/group after success.
- [ ] Verify keyboard navigation, removed rows, async navigation, drawer drafts/confirmations and review-to-next with failing-then-passing fixture tests.

Dependencies: 14 approved. Files: panel/attention.ts, panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py. Verification: focused interaction scenarios, full plugin tests, type/plugin checks and diff check. Scope: M.

### 16 — Progressive disclosure for finished work (M)

- [ ] Keep Needs input/failures expanded; put remaining eligible completions under native Finished disclosure with accurate count and truthful unknown outcomes.
- [ ] Preserve expansion during updates/view changes, reveal filtered completion matches, and restore the previous choice after clearing search; never auto-review or hide a nonzero count.
- [ ] Test focused summaries, last-result review, live arrivals, search/clear and removal without focus stealing or scroll jumps.

Dependencies: 15. Files: panel/attention.ts, panel/main.ts, scripts/shots/fixture.js, scripts/shots/run.py. Verification: targeted RED/GREEN scenarios, full browser run and type check. Scope: M. Checkpoint: Terra reviews row/action/disclosure behavior before shared-header work.

### 17 — Quiet header and discoverable filters (M)

- [ ] Consolidate redundant Attention totals; expose search/project controls under a visible Filter disclosure with active state and clear action that cannot conceal an applied restriction.
- [ ] Preserve shared queries, project disappearance reset, user banner/view/order/density preferences and ordinary keyboard access across all functional views.
- [ ] Verify 280/420/900px, reduced motion, themes, filter focus/live updates and real-shaped legacy preferences.

Dependencies: 16. Files: panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py. Verification: targeted RED/GREEN scenarios, full unit/type/plugin/browser checks. Scope: M.

### 18 — Calm states and busy-update accessibility (M)

- [ ] Distinguish no agents, no matches, no interventions with finished results and nothing pending; report working counts only from actual state and preserve all existing warnings.
- [ ] Avoid repeated routine live announcements; retain accessible action/error feedback and truthful ages. Preserve focus, scroll, filter input and disclosure choice during 100-agent updates.
- [ ] Verify four short intervention rows at 420×800 with banner collapsed, readable 280px content and minimum 32px controls without hover-only information.

Dependencies: 17. Files: panel/attention.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py. Verification: busy-update/quiet/error fixtures and keyboard/screen-reader semantics inspection. Scope: M. Checkpoint: Terra reviews behavior and visuals; user trials actual find → open → return and explicit review before acceptance.

### 19 — Refresh docs/media and final regression evidence (M)

- [ ] Update the existing task-12 docs/website work for the selected layout and Settings notification location; keep contributor credit, privacy and unreleased notices accurate.
- [ ] Regenerate public fixture media, check budgets/links/mobile rendering, and rerun the repository's final unit/type/plugin/browser verification commands.
- [ ] Record Terra approval and actual trial outcomes; leave unavailable paired-server/platform and accessibility-dependent checks explicitly unverified.

Dependencies: 18. Deliver as two bounded batches: docs (README.md, docs/guide.html, docs/index.html, CHANGELOG.md, tasks/todo.md), then existing fixture media scripts/assets. Verification: existing media/size/link/render commands plus final review. Scope: M per batch. No version bump, publication or installed-plugin switch without the separate release instruction.
