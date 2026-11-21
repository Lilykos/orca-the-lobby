# Roadmap

Ideas for releases after 1.0.0, written 2026-11-14. Nothing here is committed to; each item says what "done" means so it can be picked up on its own. Release steps are in the README's Develop section and the version must be bumped in `orca-plugin.json` and `panel/main.ts`.

Suggested order: 1 and 2 first (small, felt every day), then 3 and 12, then whichever feature is wanted most.

## Soon

### 1.3.0 release candidate: Attention and everyday polish

The approved plan is in [tasks/plan.md](../tasks/plan.md), with the implementation checklist in [tasks/todo.md](../tasks/todo.md). Attention has compact task-first rows, a counted collapsed Finished disclosure, explicit result-drawer review, shared Filter disclosure and distinct quiet states; local Reviewed state, search/project filtering, visual density, drawer hierarchy, project mute, episode reminder snooze and burst grouping are implemented and reviewed on the development branch. The 1.3.0 release candidate is prepared but not published. The real GUI trial, paired-server behavior and Windows/Linux runtime behavior remain unverified; the source-folder development panel-load issue is documented in [Architecture](ARCHITECTURE.md). Session history, a general timeline, PR/CI integrations and broader host-health work remain later-release candidates.

### Release 1.2.0 checklist: paired servers and Orca compatibility

- [x] Fix stale paired-server states and unsuccessful navigation in the local development branch.
- [x] Support Orca's current chat database, retaining compatibility with older versions.
- [x] Add regression coverage; run the 145 tests, TypeScript check and plugin validation on macOS.
- [x] Remove Unix-only binaries from the SQLite fallback test and use PATH-based SQLite discovery in database integration tests.
- [ ] Validate on real Windows/Linux hosts and exercise a real paired server. No Windows/Linux runtime or paired server was available for this release; simulated disconnect/reconnect tests pass.
- [x] Run all 56 screenshot scenarios and refresh affected fixtures, website images and catalog posters.
- [x] Finish reviewing the README, architecture notes, troubleshooting, permissions and privacy statements against the final behavior.
- [x] Update the GitHub Pages website: landing page, guide, FAQ, screenshots and any catalog/listing copy affected by paired-server support and the database change.
- [x] Preview the landing page and guide, check local links and anchors, and verify mobile layout without horizontal overflow.
- [x] Verify the live GitHub Pages site after deployment (built successfully; current content, mobile layout and images checked).
- [x] Merge PR #1 together with the local fixes, preserving @titilambert’s original commits and adding contributor credit to the README, changelog and release notes.
- [x] Finalize the changelog for 1.2.0 and choose the release version; keep `orca-plugin.json` and `panel/main.ts` in sync.
- [x] Push, tag and publish v1.2.0; verify the published GitHub release.
- [x] Update and enable the existing installed plugin as lilykos.the-lobby 1.2.0, unload the development folder and verify the running panel and logs.
- [ ] Track the Orca-side notification fix so the visible prefix uses **The Lobby** instead of the plugin id. Orca 1.4.264 still hard-codes the id; this remains unresolved.

The checklist records remaining release work; unchecked items have not been verified or published.

### 1. Count untracked files as changes

**Why.** Agents create new files all the time; `git diff --shortstat HEAD` (`src/roster.ts:65`) ignores them, so the count looks too low.

**Do.** Also run `git ls-files --others --exclude-standard` in the same workspace and add its line count as "N new files". Keep one git call per workspace per poll if possible.

**Done when.** A workspace with only a new untracked file shows a change; the roster and drawer show new files separately from changed lines; the README's "Uncommitted changes ignore untracked files" limit is removed; a test covers the parsing.

### 2. Show what a blocked agent is waiting on

**Why.** **Need you!** says that, not what. Orca does not tell plugins, but the last tool call before blocking (from `agent.tool.before`) usually is the answer.

**Do.** When an agent turns `blocked`, keep its most recent unfinished tool call. Show it in the drawer and the hover card as "Waiting on: Bash `…`" (clipped to the existing 80 characters). If there is none, show nothing rather than a guess.

**Done when.** A blocked agent with a pending tool call shows it; one without shows only today's text; the label is cleared when the agent leaves `blocked`; tests cover both cases. The README limit "Orca does not say what a blocked agent is asking" is reworded to say this is inferred.

### 3. Split `panel/main.ts`

**Why.** About 1,900 lines; every change touches it.

**Do.** Move the drawer and the Settings tab into their own modules, like `scene.ts` and `chart.ts`. No behavior change.

**Done when.** `main.ts` is mostly wiring; tests, `tsc --noEmit` and `scripts/shots/run.py` give identical results and screenshots.

### 4. Check Linux and Windows

**Why.** Only macOS has been tried.

**Do.** Run the plugin on Linux (and Windows if available). Fix anything that breaks outside the macOS-only context line.

**Done when.** The README says which platforms are tested and what each lacks.

## Features

### 5. Today summary

The worker already keeps `office.today` (`finished`, `failed`, `blockedMs`) and a 24-hour journal. Add a small view (a strip in the Office or a section in Activity): agents finished, failed, time spent waiting on you, busiest project, tokens today. Done when it resets at local midnight and matches the journal.

### 6. Cost estimate (optional)

Tokens are already split by model and by input, output, cache read and cache write. Add a price table and show "≈ $X today", off by default and labeled as an estimate. Done when unknown models show no price rather than a wrong one, and the README says where prices come from and when they were checked.

### 7. Act on several agents

Send one instruction to every working terminal agent in a project, or jump to the next failed agent. Same safety rules as today's Send: only terminals no other agent shares, never to a blocked agent, confirm before sending. Done when a confirmation lists the agents that will receive it.

### 8. Context warning

A notification when an agent passes 90% context, once per session, with a setting to turn it off. Done when it never fires for agents whose fill is unknown.

### 9. More providers

Tokens for providers beyond Claude Code and Codex (for example Gemini CLI or opencode), only once someone asks and the log format is checked. Done when each new provider has a fixture test from a real log.

## Upkeep

### 10. Track Orca's plugin API

Several limits are Orca's: no approve/deny, no chat tab selection, no model field, no blocked question. Watch Orca releases, and open upstream issues for the ones that matter most. Each one Orca adds replaces a workaround.

### 11. Guard the session-store read

The context line reads Orca's undocumented `agent-session-journal.db` (`src/context.ts`). Add a check that notices when the expected table or columns are missing and logs one clear message instead of silently showing nothing.

### 12. CI

A GitHub Action that runs `tsc --noEmit` on every push and pull request, plus `orca plugin test .` and `orca plugin check .` if the Orca CLI can be installed on a runner.

### 13. README catalog line

The README says the plugin is listed in the community catalog "once published there". It now has the `orca-plugin` topic and a status page (`orca.dev/plugins/Lilykos/orca-the-lobby`); reword the line in the next release.
