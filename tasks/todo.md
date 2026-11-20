# The Lobby 1.3 tasks

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

- [ ] Membership, identity and restore/review semantics pass before building additional UI. **Under review:** Terra identified remaining fixes; restore this checkbox after the regressions pass and review clears.

## 04 — End-to-end Attention view (M)

- [ ] Add grouped inbox, counts, empty state and direct Go to agent / Review details / Reviewed actions, reusing existing validated actions and drawer.
- [ ] Preserve selected row, focus and scroll during updates; show truthful action availability and failure notes.
- [ ] Verify keyboard review-to-next behavior, disappearing agents and live updates at narrow/wide widths using browser fixtures.

Dependencies: 01–03. Likely files: panel/attention.ts, panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py.

## 05 — Shared search and project filter (M)

- [ ] Add literal case-insensitive search over reported context and a project selector across functional views.
- [ ] Keep query on view changes, preserve project order and necessary chart ancestors, and distinguish no matches from no agents.
- [ ] Verify search normalization, missing fields, chart filtering, clear/reset, keyboard focus and busy updates.

Dependencies: 04. Likely files: panel/search.ts, panel/search.test.ts, panel/main.ts, panel/attention.ts, scripts/shots/fixture.js.

## 06 — Header, density and view preferences (M)

- [ ] Add Comfortable/Compact density, compact navigation/header and collapsible Office branding without removing pixel rooms or palettes.
- [ ] Migrate preferences without losing layout/order/notifications; preserve Office on upgrade and remember later view choices.
- [ ] Verify malformed preferences, first-install defaults, theme, reduced motion, keyboard access and 280/420/900-width rendering.

Dependencies: 04. Likely files: src/protocol.ts, panel/main.ts, panel/index.html, src/office.test.ts, scripts/shots/fixture.js.

## 07 — Drawer hierarchy (M)

- [ ] Put task/state/result/primary action first and progressively disclose calls, tokens and supplementary details.
- [ ] Preserve Send drafts, confirmation state, helper details, focus return and all existing action restrictions; extract only necessary drawer code.
- [ ] Verify existing drawer/action scenarios and new hierarchy with keyboard and reduced motion.

Dependencies: 04, 06. Likely files: panel/drawer.ts, panel/main.ts, panel/index.html, scripts/shots/fixture.js, scripts/shots/run.py.

### Checkpoint B

- [ ] Demonstrate find → open → review on the real development panel; inspect Office, Activity and Attention at multiple widths.
- [ ] Confirm stable reading position and task identity during 100-agent fixture updates.

## 08 — Isolate existing notification decisions (S)

- [ ] Extract a small notification-policy module while preserving current transition settings, long-turn threshold and reminder behavior.
- [ ] Keep event/roster deduplication and no-backlog-on-start behavior explicit; no new preferences yet.
- [ ] Verify equivalent behavior with deterministic policy tests and existing worker notification tests.

Dependencies: 02. Likely files: src/notifications.ts, src/notifications.test.ts, src/worker.ts, src/worker.test.ts.

## 09 — Project mute and reminder snooze (M)

- [ ] Add persistent project mute and episode-scoped reminder snooze with clear controls, expiry and resume.
- [ ] Keep blocked agents visible/counted; neither mute nor snooze changes Orca-native settings or replays an old notification backlog.
- [ ] Verify restart, expiry, a new turn/failure, pending notifications, cancelled writes and visibly muted/snoozed UI states.

Dependencies: 03, 04, 08. Likely files: src/protocol.ts, src/notifications.ts, src/worker.ts, panel/attention.ts, src/worker.test.ts. Test policy cases in the module's existing test file as needed.

## 10 — Burst notification grouping (M)

- [ ] Group eligible notifications by project and kind over a non-extending two-second window; preserve useful individual messages.
- [ ] Re-check eligibility/mute before dispatch and prevent duplicate delivery or indefinite retries across polling and restart.
- [ ] Verify isolated events, bursts, distinct projects/kinds, state changes during the window, failure and restart using deterministic time.

Dependencies: 08–09. Likely files: src/notifications.ts, src/notifications.test.ts, src/worker.ts, src/worker.test.ts.

### Checkpoint C

- [ ] Notifications become quieter while all actionable inbox items remain discoverable; inspect behavior during a development-copy trial.

## 11 — Integrated regression and compatibility checks (M)

- [ ] Extend browser scenarios for search, review, density, migration, empty/error states, burst updates and keyboard focus; retain all existing scenarios.
- [ ] Verify storage/payload bounds and startup behavior; run the full unit, TypeScript, plugin and screenshot checks in plan.md.
- [ ] Exercise real paired-server disconnect/reconnect and Windows/Linux where hosts are available; record exact outcomes and remaining limitations rather than treating simulated coverage as hardware validation.

Dependencies: 04–10. Likely files: scripts/shots/fixture.js, scripts/shots/run.py, scripts/shots/demo.js, src/worker.test.ts, docs/ROADMAP.md. Split any newly discovered production fix into its own tested task.

## 12 — Docs, website and media (M)

- [ ] Update README/architecture for local Reviewed semantics, retention, permissions, mute/snooze, defaults and the actual platform/API limits.
- [ ] Update website landing page, guide/FAQ, changelog and contributor credits to match the final scope.
- [ ] Regenerate fixture-based screenshots/posters; check image limits, links, desktop/mobile rendering and browser errors.

Dependencies: 11; draft copy may begin earlier. Documentation batch: README.md, docs/ARCHITECTURE.md, docs/index.html, docs/guide.html, CHANGELOG.md. Media/catalog updates are a separate follow-up batch using existing scripts and docs/LISTING.md.

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
