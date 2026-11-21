# Changelog

## Unreleased

Development notes for the unreleased 1.3.0 proposal. The catalog install command still serves published 1.2.0; do not treat these notes as a release announcement.

- Add **Attention** for blocked agents, explicit failures and unread or newly observed completions, with Lobby-local **Reviewed** state that never changes Orca's unread or status data.
- Present Attention as compact task-first rows: titles open details, validated **Open agent** stays separate, and **Mark Reviewed** is an explicit result-drawer action. Keep Finished counted while collapsed; search reveals matching results and clear restores the user's disclosure choice.
- Add a native **Filter** disclosure with an active-filter count and always-visible **Clear** while results are restricted; distinguish empty-roster, no-match and no-intervention states.
- Share literal search and project filtering across Attention, Office and Activity; add Comfortable / Compact density and remember the selected functional view.
- Preserve Office as the initial view for 1.2 upgrades and open Attention by default only on genuinely new installations.
- Put task, state, result and available action first in the drawer; progressively disclose calls, tokens and supplementary details.
- Keep source finish timestamps distinguishable from local observation times. Completion identity remains ambiguous when Orca reports no turn/session discriminator and the transition was not observed.
- Add project-local notification mute and episode reminder snooze for 15 minutes, 1 hour or until resumed. Mute affects all Lobby notifications for the project; snooze affects reminders only. Neither hides agents or changes Orca settings, and resuming/unmuting does not replay missed alerts.
- Group eligible notifications by project and kind over a fixed two-second window from the first event; preserve individual messages for single events and summarize bursts. Bound policy storage and report read/write failures without claiming unsaved changes succeeded.
- Preserve the pixel Office, Office on 1.2 upgrades, manual project order, palettes, reduced motion, and existing contributor credit.

## 1.2.0

- Show agents on paired Orca servers in separate rooms, labeled by host; improve Windows CLI discovery. Thanks to @titilambert ([#1](https://github.com/Lilykos/orca-the-lobby/pull/1)).
- Hide unreachable paired-server agents until reconnection instead of showing stale working states and triggering misleading alerts.
- Report failed navigation when Orca accepts a command but cannot bring the target into view.
- Restore per-agent context and tokens on Orca 1.4.261+ by reading its current chat database, retaining support for older versions.

## 1.1.0

- **Projects in your order**: rooms and charts follow Orca's sidebar order instead of the alphabet, and follow it when you reorder the sidebar. **↑** / **↓** on a room or chart set your own order, shared by Office and Activity and kept between sessions; **Use the sidebar order again** in Settings goes back.
- **Fix**: agents who arrive in a room together walk in one behind the other instead of on top of each other, names included.

## 1.0.0

First public release.

- **Office**: one pixel-art room per project checkout (worktrees share it), agents as people at desks or the coffee machine, a thought icon for what they are doing, a time-of-day window and room decorations. List or Grid layout.
- **Speech bubbles**: **Need you!**, **Stuck?** and the first line of a finished agent's reply (or **Failed**).
- **Activity**: a connected org chart per project from the parent/child links Orca reports, **All / Needs attention** view, sideways panning by trackpad, keyboard or drag, and a **Reset view** button.
- **Agent drawer**: state, asked and result excerpts, calls, tasks, files and PRs; context fill, compactions and tokens per agent; tokens per workspace and project for the day, with cache split out.
- **Actions**: **Go to agent** (terminal or workspace), an instruction box and **Compact conversation** for Claude Code terminals, and Previous / Next agent shortcuts (`Mod+Alt+↑` / `Mod+Alt+↓`).
- **Alerts**: desktop notifications when an agent needs you, finishes a long turn or seems stuck (Off, or after 10, 20, 30 or 60 minutes), and a status bar count of working agents and agents that need you.
- **Settings**: six color palettes, notification switches, animation switch and a button to clear the local activity history.
- **Local only**: no network access, no analytics; see the README's data and privacy section.
- Requires Orca 1.4.248 or newer.
