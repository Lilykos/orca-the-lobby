// The plugin's own worker: it asks Orca who its agents are (src/roster.ts), hears their status and
// tool calls, keeps the office in src/office.ts and tells the panel. Its status bar item keeps it running while the plugin is
// enabled; a restart drops memory, so the office is also kept in orca.storage.
import { readFile } from 'node:fs/promises'
import type { OrcaWorkerApi } from 'orca/worker'
import {
  applyListed,
  applyRepos,
  applyRoster,
  applyStatus,
  applyToolAfter,
  applyToolBefore,
  createOffice,
  clearHistory,
  keepTerminals,
  placeWorkspace,
  projectRoot,
  prune,
  removeWorkspace,
  restore,
  snapshot,
  storable,
  forPanel,
  STORE_BYTES
} from './office'
import { agentOrder, checkInstruction, compactCommand, mayType, sharedTerminal, stepAgent, terminalOf } from './actions'
import { createContextReader, createSessionTail } from './context'
import {
  PREFS_KEY,
  overdue,
  readPrefs,
  type ActionResult,
  type AgentActions,
  type AgentView,
  type AgentState,
  type Prefs
} from './protocol'
import { cli, environmentTarget } from './roster'
import { createReader } from './transcript'
import { createUsageCounter, dayOf } from './usage'

const STORED = 'office'
/** Tool calls come in bursts and `panels.post` allows 200 per 10 s: one post per burst. */
const POST_MS = 150
const SAVE_MS = 3000
/** How often Orca's list is asked for: while agents work, and while all is quiet. */
const LOOK_BUSY_MS = 3000
const LOOK_IDLE_MS = 20000
/** How often each workspace's uncommitted changes are counted. */
const CHANGES_MS = 15000
/** How often Orca's sidebar order is read, so a project dragged there moves here too. */
const REPOS_MS = 10000
/** How often today's tokens are counted from the agents' logs. */
const USAGE_MS = 30000
/** A turn shorter than this ends without a notification: you were probably watching. */
const WORTH_TELLING_MS = 60000
/** Presses of the previous / next shortcuts closer together than this walk one fixed order. */
const WALK_MS = 2500

let stop = (): void => {}

export default function activate(orca: OrcaWorkerApi): void {
  const office = createOffice()
  let postTimer: ReturnType<typeof setTimeout> | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let statusText = ''
  let lookTimer: ReturnType<typeof setTimeout> | undefined
  let looking = false
  let lookedAt = 0
  let stopped = false
  let countedAt = 0
  /** Each agent's state as last seen by `announce`, so a change is told once. */
  const told = new Map<string, { state: AgentState; since: number }>()
  /** The quiet spell each agent was last nudged about, so one spell is told once. */
  const nudged = new Map<string, string>()
  // One pass over each log serves both the day counts and the context.
  const tail = createSessionTail()
  const countUsage = createUsageCounter(undefined, tail)
  let usageAt = 0
  let reposAt = 0
  const readTranscripts = createReader()
  const readContexts = createContextReader(undefined, tail)
  let reading = false
  const granted = (capability: string): boolean => orca.grantedCapabilities.includes(capability)
  let prefs: Prefs = readPrefs(null)
  const loadPrefs = (): void =>
    void orca.storage
      .get(PREFS_KEY)
      .then((value) => (prefs = readPrefs(value)))
      .catch(() => {})
  loadPrefs()
  // The panel writes preference changes; hear them at once.
  orca.storage.onDidChange(({ key }) => key === PREFS_KEY && loadPrefs())
  office.can = { open: granted('workspace:write') }
  let listing = false
  const looked = new Set<string>()
  let listed: { id: string; name: string; path: string; branch: string | null }[] = []

  // Events name a workspace `<project>::<path>` and `workspace.list` by another id; the path is
  // in both, so the office keys its rooms by path.
  const roomOf = (workspaceId: string | null): string | null => {
    if (workspaceId === null) return null
    const cut = workspaceId.indexOf('::')
    if (cut >= 0) return workspaceId.slice(cut + 2)
    return listed.find((workspace) => workspace.id === workspaceId)?.path ?? workspaceId
  }

  let writes: Promise<void> = Promise.resolve()
  const persist = (): Promise<void> => {
    const state = storable(snapshot(office))
    const write = writes.then(() => orca.storage.set(STORED, state))
    writes = write.catch(() => {})
    return write
  }
  const save = (): void => {
    saveTimer = undefined
    void persist().catch((error) => orca.log(`save: ${error}`))
  }

  const publish = (): void => {
    postTimer = undefined
    prune(office, Date.now())
    const state = forPanel(snapshot(office))
    const size = JSON.stringify(state).length
    if (size > STORE_BYTES) orca.log(`office.update is ${size} bytes, near Orca's 256 KiB limit`)
    orca.panels.post('office.update', state)
    saveTimer ??= setTimeout(save, SAVE_MS)

    const working = state.agents.filter((agent) => agent.state === 'working').length
    const blocked = state.agents.filter((agent) => agent.state === 'blocked').length
    const text = blocked ? `${working} working · ${blocked} need you` : `${working} working`
    if (text === statusText) return
    statusText = text
    // Desktop app only: a headless Orca has no status bar.
    void orca.host
      .call('statusBar.update', { id: 'office', text, tone: blocked ? 'warning' : 'neutral' })
      .catch(() => {})
  }

  const changed = (): void => {
    postTimer ??= setTimeout(publish, POST_MS)
  }

  /** Asks Orca for its list, then again later: soon while agents work, seldom while none does. */
  const look = async (): Promise<void> => {
    lookTimer = undefined
    looking = true
    lookedAt = Date.now()
    const worktrees = await cli.roster().catch(() => null)
    if (worktrees) applyRoster(office, worktrees, Date.now())
    else office.rostered = false
    await enrich().catch((error) => orca.log(`enrich: ${error}`))
    looking = false
    if (stopped) return
    announce()
    changed()
    const busy = [...office.agents.values()].some((agent) => agent.state === 'working')
    lookSoon(busy ? LOOK_BUSY_MS : LOOK_IDLE_MS)
  }

  /** Reads each agent's context in the background: Orca's session store can take seconds to answer,
   *  and nothing else waits for it. One read at a time; the panel hears of the result when it is in. */
  const readContext = (agents: AgentView[]): void => {
    if (reading) return
    reading = true
    readContexts(agents, Date.now())
      .then((contexts) => {
        if (stopped) return
        let different = false
        for (const { id } of agents) {
          const agent = office.agents.get(id)
          const context = contexts.get(id) ?? null
          if (!agent || JSON.stringify(agent.context ?? null) === JSON.stringify(context)) continue
          agent.context = context
          different = true
        }
        if (different) changed()
      })
      .catch((error) => orca.log(`context: ${error}`))
      .finally(() => {
        reading = false
      })
  }

  /** Adds supplementary Claude transcript notes and each workspace's uncommitted changes. */
  const enrich = async (): Promise<void> => {
    const agents = [...office.agents.values()]
    const insights = await readTranscripts(agents, Date.now())
    for (const agent of agents) {
      const fresh = insights.get(agent.id)
      if (fresh) agent.insight = fresh
    }
    readContext(agents)
    if (Date.now() - reposAt >= REPOS_MS) {
      reposAt = Date.now()
      const repos = await cli.repos().catch(() => null)
      if (repos) applyRepos(office, repos)
    }
    if (Date.now() - usageAt >= USAGE_MS) {
      usageAt = Date.now()
      const paths = [...new Set([...agents.map((agent) => agent.workspaceId), ...office.workspaces.keys()])]
      try {
        office.usage = { day: dayOf(usageAt), workspaces: await countUsage(paths.filter((path): path is string => !!path), usageAt) }
      } catch (error) {
        orca.log(`usage: ${error}`)
      }
    }
    if (Date.now() - countedAt < CHANGES_MS) return
    countedAt = Date.now()
    for (const path of new Set(agents.map((agent) => agent.workspaceId))) {
      if (!path) continue
      const change = await cli.changes(path)
      if (change) office.changes.set(path, change)
      else office.changes.delete(path)
    }
  }

  /** Tells the person, if they allowed it, when an agent starts needing them or ends a long turn. */
  const announce = (): void => {
    for (const agent of office.agents.values()) {
      const was = told.get(agent.id)
      told.set(agent.id, { state: agent.state, since: agent.stateStartedAt })
      if (!was || was.state === agent.state || !granted('notifications:show')) continue
      const name =
        (agent.workspaceId && office.workspaces.get(agent.workspaceId)) || agent.title || 'An agent'
      const long = agent.stateStartedAt - was.since > WORTH_TELLING_MS
      const title =
        agent.state === 'blocked' && prefs.notifyBlocked
          ? `${name} needs you`
          : agent.state === 'done' && was.state === 'working' && long && prefs.notifyDone
            ? `${name} ${agent.outcome === 'failure' ? 'failed' : 'finished'}`
            : null
      if (title) {
        void orca.host
          .call('notifications.show', { title, body: agent.title ?? undefined })
          .catch(() => {})
      }
    }
    nudge()
  }

  /** Tells the person once per quiet spell when an agent seems stuck or still needs them. */
  const nudge = (): void => {
    const now = Date.now()
    for (const agent of office.agents.values()) {
      const late = overdue(agent, now, prefs.stuckMinutes)
      const spell = late && `${late.kind}:${late.since}`
      if (!late || nudged.get(agent.id) === spell) continue
      nudged.set(agent.id, spell!)
      if (!granted('notifications:show')) continue
      const name =
        (agent.workspaceId && office.workspaces.get(agent.workspaceId)) || agent.title || 'An agent'
      const minutes = Math.floor((now - late.since) / 60_000)
      void orca.host
        .call('notifications.show', {
          title: late.kind === 'quiet' ? `${name} may be stuck` : `${name} still needs you`,
          body: `${late.kind === 'quiet' ? 'No activity seen' : 'Waiting on you'} for ${minutes} min${agent.title ? ` · ${agent.title}` : ''}`
        })
        .catch(() => {})
    }
    for (const id of nudged.keys()) if (!office.agents.has(id)) nudged.delete(id)
  }

  /** Brings the next look forward, never closer than LOOK_BUSY_MS to the last one. */
  const lookSoon = (wait = 0): void => {
    if (looking || stopped) return
    clearTimeout(lookTimer)
    lookTimer = setTimeout(() => void look(), Math.max(wait, lookedAt + LOOK_BUSY_MS - Date.now()))
  }

  /** Finds which project a workspace belongs to, once: worktrees of one checkout share a room. */
  const place = (path: string | null): void => {
    if (!path || looked.has(path) || office.rostered) return
    looked.add(path)
    void readFile(`${path}/.git`, 'utf8')
      .catch(() => null)
      .then((gitFile) => {
        placeWorkspace(office, path, projectRoot(path, gitFile))
        changed()
      })
  }

  /** Workspace names for the agent details; asked again when an agent shows up in an unknown one. */
  const nameWorkspaces = async (): Promise<void> => {
    if (listing) return
    listing = true
    try {
      listed = (await orca.host.call('workspace.list')).workspaces
      for (const { name, path } of listed) office.workspaces.set(path, name)
      changed()
    } catch (error) {
      orca.log(`workspace.list: ${error}`)
    } finally {
      listing = false
    }
  }

  orca.events.on('agent.status.changed', (event) => {
    const workspaceId = roomOf(event.workspaceId)
    applyStatus(office, { ...event, workspaceId })
    place(workspaceId)
    if (workspaceId && !office.workspaces.has(workspaceId)) void nameWorkspaces()
    announce()
    changed()
    lookSoon()
  })

  // `agents.list` and the context name the focused workspace but not its id: match it by name.
  orca.events.on('workspace.changed', async ({ context }) => {
    if (!context) return
    await nameWorkspaces()
    const focused = listed.filter(
      (workspace) => workspace.name === context.displayName && workspace.branch === context.branch
    )
    const workspaceId = focused.length === 1 ? focused[0].path : null
    const { agents } = await orca.host.call('agents.list')
    applyListed(office, workspaceId, agents, Date.now())
    place(workspaceId)
    if (workspaceId) {
      keepTerminals(
        office,
        workspaceId,
        context.terminals.map((terminal) => terminal.id)
      )
    }
    changed()
  })

  orca.events.on('workspace.removed', ({ path }) => {
    removeWorkspace(office, path)
    changed()
  })

  // Claude Code waits on this hook: only record the call and return at once, never deny.
  orca.hooks.on('agent.tool.before', (event) => {
    const workspaceId = roomOf(event.workspaceId)
    applyToolBefore(office, { ...event, workspaceId }, Date.now())
    place(workspaceId)
    changed()
    lookSoon()
  })

  orca.hooks.on('agent.tool.after', (event) => {
    applyToolAfter(office, { ...event, workspaceId: roomOf(event.workspaceId) }, Date.now())
    changed()
  })

  orca.panels.handle('office.snapshot', () => forPanel(snapshot(office)))

  orca.panels.handle('office.clearHistory', async () => {
    await loaded
    clearHistory(office)
    try {
      await persist()
      changed()
      return { cleared: true }
    } catch (error) {
      orca.log(`clear history: ${error}`)
      changed()
      return { cleared: false }
    }
  })

  /** Shows an agent's workspace in Orca. */
  const openWorkspace = async (agentId: string): Promise<boolean> => {
    const path = office.agents.get(agentId)?.workspaceId
    if (!listed.some((workspace) => workspace.path === path)) await nameWorkspaces()
    const workspace = listed.find((other) => other.path === path)
    if (!workspace) return false
    await orca.host.call('workspace.open', { workspaceId: workspace.id })
    return true
  }

  /** The live terminal an agent runs in, or why there is none. Chat sessions have no terminal. */
  const terminalFor = async (agentId: string): Promise<{ handle: string; environment?: string } | { error: string }> => {
    const agent = office.agents.get(agentId)
    if (!agent) return { error: 'That agent has left.' }
    const remote = environmentTarget(agent.workspaceId)
    const pane = environmentTarget(agent.paneKey)
    if (remote && pane?.id !== remote.id) return { error: 'Orca did not report a terminal on that server.' }
    const terminals = await cli.terminals(remote?.id)
    if (!terminals) return { error: 'Orca could not be reached.' }
    const handle = terminalOf(pane ? { paneKey: pane.value, terminalId: null } : agent, terminals)
    return handle ? { handle, environment: remote?.id } : { error: 'Orca did not report a live terminal for this agent.' }
  }

  orca.panels.handle('office.actions', async ({ agentId }): Promise<AgentActions> => {
    const agent = office.agents.get(agentId)
    const none: AgentActions = { goTo: null, send: false, compact: null }
    if (!agent) return none
    const mayGo = granted('workspace:write')
    const maySend = granted('terminal:send') && !environmentTarget(agent.workspaceId)
    const terminal = mayGo || maySend ? 'handle' in (await terminalFor(agentId)) : false
    const send = maySend && terminal && mayType(agent)
    return {
      goTo: !mayGo ? null : terminal ? 'terminal' : agent.workspaceId ? 'workspace' : null,
      send,
      // A blocked agent is waiting on an answer: a command typed now would be taken as that answer.
      compact: send && agent.state !== 'blocked' ? compactCommand(agent.agent) : null
    }
  })

  /** The agent the shortcuts step from: the last one the person went to or selected in the panel. */
  let cursor: string | null = null
  /** The order a run of presses walks, kept for a moment so an agent changing state mid-walk neither
   *  skips nor repeats anyone. Any other way of choosing an agent ends the walk. */
  let walk: { ids: string[]; at: number } | null = null

  /** The agent's terminal if it has one and Orca switches to it, else its workspace. */
  const goTo = async (agentId: string, stepping = false): Promise<ActionResult> => {
    if (!granted('workspace:write')) return { ok: false, error: 'Opening workspaces is not allowed.' }
    cursor = agentId
    if (!stepping) walk = null
    const found = await terminalFor(agentId)
    if ('handle' in found) {
      const switched = await cli.switchTo(found.handle, found.environment)
      if (switched.ok) return { ok: true }
    }
    const agent = office.agents.get(agentId)
    const remote = environmentTarget(agent?.workspaceId)
    if (remote) {
      const opened = await cli.activateWorkspace(remote.value, remote.id)
      if (!opened.ok) return { ok: false, error: `Could not open its remote workspace: ${opened.error}` }
    } else if (!(await openWorkspace(agentId))) {
      return { ok: false, error: 'Orca does not know where it is.' }
    }
    return 'handle' in found
      ? { ok: true, note: 'Opened its workspace; its terminal would not come forward.' }
      : (environmentTarget(agent?.paneKey)?.value ?? agent?.paneKey)?.startsWith('structured-agent-session-')
        ? { ok: true, note: 'Opened its workspace. Orca does not let plugins pick a chat tab.' }
        : { ok: true, note: `Opened its workspace. ${found.error}` }
  }

  orca.panels.handle('office.goTo', ({ agentId }) => goTo(agentId))

  orca.panels.handle('office.select', ({ agentId }) => {
    if (typeof agentId === 'string' && office.agents.has(agentId)) {
      cursor = agentId
      walk = null
    }
    return { ok: true }
  })

  /** Types into an agent's terminal. Only ever called for something the person just asked for, and
   *  only while Orca's own list still shows that agent at work in a terminal no other agent shares. */
  const type = async (agentId: string, text: string): Promise<ActionResult> => {
    if (!granted('terminal:send')) return { ok: false, error: 'Typing into terminals is not allowed.' }
    if (environmentTarget(office.agents.get(agentId)?.workspaceId)) return { ok: false, error: 'Sending to paired servers is not supported.' }
    if (!mayType(office.agents.get(agentId))) return { ok: false, error: 'It has finished; its terminal may be back at a shell.' }
    const listed = await cli.roster()
    const paneKey = office.agents.get(agentId)?.paneKey
    const row = listed?.flatMap((worktree) => worktree.agents ?? []).find((other) => other.paneKey === paneKey)
    if (!listed) return { ok: false, error: 'Orca could not be reached.' }
    if (!row || row.state === 'done') return { ok: false, error: 'Orca no longer shows it at work.' }
    const terminals = await cli.terminals()
    const agent = office.agents.get(agentId)
    const handle = agent && terminals ? terminalOf(agent, terminals) : null
    if (!terminals) return { ok: false, error: 'Orca could not be reached.' }
    if (!handle) return { ok: false, error: 'It does not run in a terminal Orca can type into.' }
    if (sharedTerminal(agentId, handle, [...office.agents.values()], terminals)) return { ok: false, error: 'Another agent uses the same terminal.' }
    const sent = await cli.send(handle, text)
    return sent.ok ? { ok: true } : sent
  }

  orca.panels.handle('office.send', ({ agentId, text }) => {
    const checked = checkInstruction(text)
    return checked.ok ? type(agentId, checked.text) : { ok: false, error: checked.error }
  })

  orca.panels.handle('office.compact', async ({ agentId }) => {
    const agent = office.agents.get(agentId)
    const command = agent && agent.state !== 'blocked' ? compactCommand(agent.agent) : null
    return command ? type(agentId, command) : { ok: false, error: 'This agent has no compact command.' }
  })

  /** Previous / next agent: needs-you first, then working, then the rest. */
  const step = async (direction: 1 | -1): Promise<string> => {
    const now = Date.now()
    if (!walk || now - walk.at > WALK_MS) walk = { ids: agentOrder([...office.agents.values()]).map((agent) => agent.id), at: now }
    walk.at = now
    // Someone who left mid-walk drops out; the order of everyone else holds.
    walk.ids = walk.ids.filter((id) => office.agents.has(id))
    const id = stepAgent(walk.ids, cursor, direction)
    const agent = id === null ? undefined : office.agents.get(id)
    if (!agent) return 'No agents to go to.'
    const name = (agent.workspaceId && office.workspaces.get(agent.workspaceId)) || agent.title || 'An agent'
    const result = await goTo(agent.id, true)
    return result.ok ? `${name}${result.note ? ` · ${result.note}` : ''}` : `${name} · ${result.error}`
  }
  orca.commands.register('office.previousAgent', () => step(-1))
  orca.commands.register('office.nextAgent', () => step(1))

  const loaded = orca.storage
    .get(STORED)
    .then((stored) => {
      restore(office, stored, Date.now())
      for (const agent of snapshot(office).agents) place(agent.workspaceId)
      return nameWorkspaces()
    })
    .catch((error) => orca.log(`restore: ${error}`))
    .then(() => lookSoon())

  stop = () => {
    stopped = true
    clearTimeout(lookTimer)
    clearTimeout(postTimer)
    if (saveTimer) {
      clearTimeout(saveTimer)
      save()
    }
  }
}

export function deactivate(): void {
  stop()
}
