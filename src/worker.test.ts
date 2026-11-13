// Runs src/worker.ts's activate(orca) with the orca object Orca passes, over a mock host.
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import type { RosterWorktree } from './office'
import { sessionStore } from './context'
import type { OfficeSnapshot } from './protocol'
import { cli } from './roster'
import * as main from './worker'

// Never the real Orca CLI: each test says what Orca lists, or null for an Orca that cannot be asked.
let listed: RosterWorktree[] | null = null
cli.roster = async () => listed
cli.changes = async () => ({ files: 2, added: 12, removed: 3 })
// Terminals the pretend Orca has open, and what was typed or switched to in them.
let terminals: { handle: string; paneKey: string }[] | null = []
const typed: string[] = []
const switched: string[] = []
cli.terminals = async () => terminals
cli.switchTo = async (handle) => (switched.push(handle), { ok: true })
cli.send = async (handle, text) => (typed.push(`${handle}: ${text}`), { ok: true })

/** Wait for an observable worker result; timers and file reads can finish in either order. */
async function waitUntil(description: string, ready: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 15_000
  do {
    if (await ready()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  } while (Date.now() < deadline)
  throw new Error(`Timed out waiting for ${description}`)
}

test('records tool calls without holding the agent up, and tells panels', async () => {
  const host = mockHost({
    results: {
      'workspace.list': {
        workspaces: [
          {
            id: 'list-1',
            kind: 'worktree',
            name: 'main',
            path: '/repos/shop',
            branch: 'main',
            hostId: null
          }
        ],
        truncated: false
      }
    }
  })
  const worker = await mountWorker(main, { host })
  let stopped = false
  try {
    await worker.emit('agent.status.changed', {
      workspaceId: 'project-1::/repos/shop',
      paneKey: 'pane-1',
      terminalId: 't1',
      title: 'Fix login',
      state: 'working',
      receivedAt: Date.now()
    })
    const event = {
      agent: 'claude',
      workspaceId: 'project-1::/repos/shop',
      terminalId: 't1',
      tool: 'Bash',
      input: { command: 'npm test' },
      callId: 'c1'
    }
    assert.deepEqual(await worker.hooks.fire('agent.tool.before', event), { kind: 'continue', event })

    let office = await worker.request('office.snapshot')
    assert.equal(office.agents[0].workspaceId, '/repos/shop')
    assert.equal(office.agents[0].active[0].detail, 'npm test')

    await waitUntil('published workspace, project and working status', () => {
      const latest = worker.posts.at(-1)?.payload as OfficeSnapshot | undefined
      const status = host.callsOf('statusBar.update').at(-1) as { text?: string } | undefined
      return latest?.workspaces['/repos/shop'] === 'main' && latest.projects['/repos/shop'] === 'shop' && status?.text === '1 working'
    })
    const posted = worker.posts.at(-1)
    assert.equal(posted?.event, 'office.update')
    assert.deepEqual((posted?.payload as OfficeSnapshot).workspaces, { '/repos/shop': 'main' })
    // No `.git` file to read there, so the workspace is its own project.
    assert.deepEqual((posted?.payload as OfficeSnapshot).projects, { '/repos/shop': 'shop' })
    assert.equal((posted?.payload as OfficeSnapshot).agents[0].projectId, '/repos/shop')
    assert.deepEqual(host.callsOf('statusBar.update').at(-1), {
      id: 'office',
      text: '1 working',
      tone: 'neutral'
    })

    await worker.emit('agent.status.changed', {
      workspaceId: 'project-1::/repos/shop',
      paneKey: 'pane-1',
      terminalId: 't1',
      state: 'blocked',
      receivedAt: Date.now()
    })
    await waitUntil('blocked status bar update', () => (host.callsOf('statusBar.update').at(-1) as { text?: string } | undefined)?.text === '0 working · 1 need you')
    assert.deepEqual(host.callsOf('statusBar.update').at(-1), {
      id: 'office',
      text: '0 working · 1 need you',
      tone: 'warning'
    })

    await worker.hooks.fire('agent.tool.after', event)
    office = await worker.request('office.snapshot')
    assert.deepEqual(office.agents[0].active, [])
    assert.equal(office.agents[0].toolCount, 1)

    await worker.emit('workspace.removed', {
      workspaceId: 'list-1',
      kind: 'worktree',
      path: '/repos/shop'
    })
    assert.deepEqual((await worker.request('office.snapshot')).agents, [])

    assert.deepEqual(worker.refusals, [])
    assert.deepEqual(worker.logs, [])
    // Stopping writes the office out, so a restarted worker finds it.
    await worker.deactivate()
    stopped = true
    await waitUntil('empty office persisted on deactivation', () => {
      const stored = host.data().storage.office as OfficeSnapshot | undefined
      return Array.isArray(stored?.agents) && stored.agents.length === 0
    })
    assert.deepEqual((host.data().storage.office as OfficeSnapshot).agents, [])
  } finally {
    if (!stopped) await worker.deactivate()
  }
})

test('comes back with the agents it stored', async () => {
  const stored = {
    agents: [
      {
        id: 't9',
        terminalId: 't9',
        paneKey: null,
        workspaceId: null,
        projectId: null,
        title: 'Old hand',
        agent: 'codex',
        state: 'waiting',
        outcome: null,
        stateStartedAt: Date.now(),
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        active: [],
        recent: [],
        toolCount: 3,
        insight: {
          model: 'guessed-model',
          contextTokens: 100_000,
          contextWindowTokens: 200_000,
          todos: [],
          files: []
        }
      }
    ],
    workspaces: {}
  }
  const worker = await mountWorker(main, { host: mockHost({ storage: { office: stored } }) })
  try {
    await waitUntil('stored agent restored', async () => (await worker.request('office.snapshot')).agents.some((agent) => agent.title === 'Old hand'))
    assert.equal((await worker.request('office.snapshot')).agents[0].title, 'Old hand')
    assert.deepEqual((await worker.request('office.snapshot')).agents[0].insight, {
      model: null,
      todos: [],
      files: []
    })
  } finally {
    await worker.deactivate()
  }
})

test('shows who Orca lists, with their subagents, and nobody else', async () => {
  listed = [
    {
      path: '/work/folio/fix',
      displayName: 'fix',
      repo: 'Folio',
      repoId: 'repo-1',
      linkedItems: [
        { type: 'pr', number: 40, url: 'https://example.com/pull/40' },
        { type: 'pr', number: 40, url: 'https://example.com/pull/40' },
        { type: 'pr', number: 9, url: 'javascript:alert(1)' }
      ],
      agents: [
        {
          paneKey: 'chat-1',
          state: 'working',
          agentType: 'claude',
          prompt: 'Fix the sort',
          conversationName: 'Fix series sort',
          toolName: 'Grep',
          toolInput: 'sortSeries',
          children: [
            {
              id: 'k1',
              kind: 'agent',
              state: 'working',
              name: 'Explore',
              description: 'Find callers',
              operation: { toolName: 'Read' }
            },
            { id: 'k2', kind: 'command', state: 'working', description: 'Run tests' },
            { id: 'k3', kind: 'agent', state: 'done', name: 'Explore', description: 'Finished one' }
          ]
        },
        { paneKey: 'chat-2', state: 'done', activity: { listed: false } }
      ]
    }
  ]
  const host = mockHost({
    results: {
      'workspace.list': {
        workspaces: [
          {
            id: 'ws-1',
            kind: 'worktree',
            name: 'fix',
            path: '/work/folio/fix',
            branch: 'fix',
            hostId: null
          }
        ],
        truncated: false
      },
      'workspace.open': { opened: true },
      'notifications.show': { delivered: true }
    }
  })
  const originalChanges = cli.changes
  let changesStarted = false
  let releaseChanges!: () => void
  const changesGate = new Promise<void>((resolve) => { releaseChanges = resolve })
  cli.changes = async () => {
    changesStarted = true
    await changesGate
    return { files: 2, added: 12, removed: 3 }
  }
  const worker = await mountWorker(main, { host })
  // Whatever fails below, stop the worker: its timers would keep the test run alive.
  try {
    await waitUntil('roster and delayed Git enrichment to start', async () => {
      const state = await worker.request('office.snapshot')
      return changesStarted && state.agents.some((agent) => agent.id === 'chat-1')
    })
    assert.deepEqual((await worker.request('office.snapshot')).changes, {})
    releaseChanges()
    await waitUntil('Git enrichment and initial status announcement', async () => {
      const state = await worker.request('office.snapshot')
      return state.changes['/work/folio/fix']?.files === 2 && host.callsOf('statusBar.update').length > 0
    })

    // An agent Orca does not list stays out, whatever events say.
    await worker.emit('agent.status.changed', {
      workspaceId: 'p::/work/gone',
      paneKey: 'ghost',
      state: 'working',
      receivedAt: Date.now()
    })
    const office = await worker.request('office.snapshot')
    assert.deepEqual(
      office.agents.map((agent) => agent.id),
      ['chat-1']
    )
    const [agent] = office.agents
    assert.equal(agent.projectId, 'repo-1')
    assert.deepEqual(office.projects, { 'repo-1': 'Folio' })
    assert.deepEqual(office.workspaces, { '/work/folio/fix': 'fix' })
    assert.deepEqual(office.changes, { '/work/folio/fix': { files: 2, added: 12, removed: 3 } })
    assert.deepEqual(office.links, {
      '/work/folio/fix': [{ label: 'PR #40', url: 'https://example.com/pull/40' }]
    })
    assert.deepEqual(office.can, { open: true })
    assert.deepEqual(
      [agent.title, agent.prompt, agent.agent],
      ['Fix series sort', 'Fix the sort', 'claude']
    )
    assert.deepEqual(
      agent.active.map((call) => [call.tool, call.kind, call.detail]),
      [['Grep', 'search', 'sortSeries']]
    )
    assert.deepEqual(
      agent.helpers.map((helper) => [
        helper.kind,
        helper.name,
        helper.description,
        helper.toolKind
      ]),
      [
        ['agent', 'Explore', 'Find callers', 'read'],
        ['command', 'command', 'Run tests', null]
      ]
    )
    assert.deepEqual(agent.family.map(({ id, kind, state, reported }) => [id, kind, state, reported]), [
      ['k1', 'agent', 'working', true],
      ['k3', 'agent', 'done', true]
    ])
    assert.equal('outcome' in agent.family[1], false)

    // Its status still lands at once, between looks.
    await worker.emit('agent.status.changed', {
      workspaceId: 'p::/work/folio/fix',
      paneKey: 'chat-1',
      state: 'blocked',
      receivedAt: Date.now()
    })
    assert.equal((await worker.request('office.snapshot')).agents[0].state, 'blocked')
    // ...and the person is told once, by the name the agent goes by.
    assert.deepEqual(host.callsOf('notifications.show'), [
      { title: 'fix needs you', body: 'Fix series sort' }
    ])

  } finally {
    releaseChanges()
    try {
      await worker.deactivate()
    } finally {
      cli.changes = originalChanges
      listed = null
    }
  }
})

test('keeps quiet about what the person turned off', async () => {
  listed = [
    {
      path: '/w',
      displayName: 'w',
      agents: [{ paneKey: 'chat', state: 'working', agentType: 'claude' }]
    }
  ]
  const host = mockHost({ storage: { prefs: { notifyBlocked: false } } })
  const worker = await mountWorker(main, { host })
  try {
    await waitUntil('roster enrichment before notification check', async () => {
      const state = await worker.request('office.snapshot')
      return state.agents.some((agent) => agent.id === 'chat') && state.changes['/w']?.files === 2
    })
    await worker.emit('agent.status.changed', {
      workspaceId: 'p::/w',
      paneKey: 'chat',
      state: 'blocked',
      receivedAt: Date.now()
    })
    assert.deepEqual(host.callsOf('notifications.show'), [])
  } finally {
    try {
      await worker.deactivate()
    } finally {
      listed = null
    }
  }
})

test('clears local history without changing agents or unread', async () => {
  listed = [{ path: '/w', agents: [{ paneKey: 'chat', state: 'done', activity: { unread: true } }] }]
  const host = mockHost()
  const worker = await mountWorker(main, { host })
  try {
    // The panel never gets the history; it lives in the stored state.
    const stored = (): OfficeSnapshot | undefined => host.data().storage.office as OfficeSnapshot | undefined
    await waitUntil('initial journal observation', async () => (stored()?.journal.length ?? 0) > 0)
    assert.deepEqual((await worker.request('office.snapshot')).journal, [])
    assert.deepEqual(await worker.request('office.clearHistory'), { cleared: true })
    const office = await worker.request('office.snapshot')
    assert.deepEqual(office.journal, [])
    assert.equal(office.agents[0].unread, true)
    assert.deepEqual((host.data().storage.office as OfficeSnapshot).journal, [])
  } finally {
    try {
      await worker.deactivate()
    } finally {
      listed = null
    }
  }
})

test('reports a failed history save without breaking the live office', async () => {
  const host = mockHost({ results: { 'storage.set': () => { throw new Error('disk full') } } })
  const worker = await mountWorker(main, { host })
  try {
    await worker.emit('agent.status.changed', {
      workspaceId: 'w', paneKey: 'p', terminalId: 't', state: 'working', receivedAt: Date.now()
    })
    assert.deepEqual(await worker.request('office.clearHistory'), { cleared: false })
    const office = await worker.request('office.snapshot')
    assert.deepEqual(office.journal, [])
    assert.equal(office.agents[0].state, 'working')
  } finally {
    await worker.deactivate()
  }
})

test('acts on an agent only where it has a terminal, and only on request', async () => {
  listed = [
    {
      path: '/w',
      displayName: 'w',
      agents: [
        { paneKey: 'tab1:leaf1', state: 'working', agentType: 'claude' },
        { paneKey: 'tab2:leaf2', state: 'blocked', agentType: 'claude' },
        { paneKey: 'tab3:leaf3', state: 'working', agentType: 'codex' },
        { paneKey: 'structured-agent-session-claude_1:a', state: 'working', agentType: 'claude' }
      ]
    }
  ]
  terminals = [
    { handle: 'term_1', paneKey: 'tab1:leaf1' },
    { handle: 'term_2', paneKey: 'tab2:leaf2' },
    { handle: 'term_3', paneKey: 'tab3:leaf3' }
  ]
  typed.length = switched.length = 0
  const host = mockHost({
    results: {
      'workspace.list': {
        workspaces: [{ id: 'ws-1', kind: 'worktree', name: 'w', path: '/w', branch: 'main', hostId: null }],
        truncated: false
      },
      'workspace.open': { opened: true }
    }
  })
  const worker = await mountWorker(main, { host })
  try {
    await waitUntil('roster', async () => (await worker.request('office.snapshot')).agents.length === 4)
    // Nothing is typed or switched just by looking.
    assert.deepEqual(typed.concat(switched), [])

    const chat = 'structured-agent-session-claude_1:a'
    assert.deepEqual(await worker.request('office.actions', { agentId: 'tab1:leaf1' }), { goTo: 'terminal', send: true, compact: '/compact' })
    // A blocked agent is waiting on an answer, so no command is offered; a Codex terminal has none verified.
    assert.deepEqual(await worker.request('office.actions', { agentId: 'tab2:leaf2' }), { goTo: 'terminal', send: true, compact: null })
    assert.deepEqual(await worker.request('office.actions', { agentId: 'tab3:leaf3' }), { goTo: 'terminal', send: true, compact: null })
    assert.deepEqual(await worker.request('office.actions', { agentId: chat }), { goTo: 'workspace', send: false, compact: null })
    assert.deepEqual(await worker.request('office.actions', { agentId: 'nobody' }), { goTo: null, send: false, compact: null })

    assert.deepEqual(await worker.request('office.goTo', { agentId: 'tab1:leaf1' }), { ok: true })
    assert.deepEqual(switched, ['term_1'])
    assert.deepEqual(await worker.request('office.goTo', { agentId: chat }), {
      ok: true,
      note: 'Opened its workspace. Orca does not let plugins pick a chat tab.'
    })
    assert.deepEqual(host.callsOf('workspace.open'), [{ workspaceId: 'ws-1' }])

    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: '  run the tests ' }), { ok: true })
    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: '  ' }), { ok: false, error: 'Type an instruction first.' })
    assert.deepEqual((await worker.request('office.send', { agentId: chat, text: 'hi' })).ok, false)
    assert.deepEqual(await worker.request('office.compact', { agentId: 'tab1:leaf1' }), { ok: true })
    assert.equal((await worker.request('office.compact', { agentId: 'tab2:leaf2' })).ok, false)
    assert.equal((await worker.request('office.compact', { agentId: 'tab3:leaf3' })).ok, false)
    assert.deepEqual(typed, ['term_1: run the tests', 'term_1: /compact'])

    // A second agent that resolves to the same terminal makes typing refused: it might reach the wrong one.
    terminals = [{ handle: 'term_1', paneKey: 'tab1:leaf1' }, { handle: 'term_1', paneKey: 'tab3:leaf3' }]
    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: 'shared' }), { ok: false, error: 'Another agent uses the same terminal.' })
    terminals = [{ handle: 'term_1', paneKey: 'tab1:leaf1' }, { handle: 'term_2', paneKey: 'tab2:leaf2' }, { handle: 'term_3', paneKey: 'tab3:leaf3' }]
    // Orca's own list says it finished between the drawer opening and Send: nothing is typed.
    listed![0].agents![0].state = 'done'
    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: 'late' }), { ok: false, error: 'Orca no longer shows it at work.' })
    // Once the office has seen it finish, its terminal may be a shell: neither offered nor accepted.
    await waitUntil('finished', async () => (await worker.request('office.snapshot')).agents.find((agent) => agent.id === 'tab1:leaf1')?.state === 'done')
    assert.equal((await worker.request('office.actions', { agentId: 'tab1:leaf1' })).send, false)
    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: 'ls' }), { ok: false, error: 'It has finished; its terminal may be back at a shell.' })
    assert.equal((await worker.request('office.compact', { agentId: 'tab1:leaf1' })).ok, false)
    assert.equal(typed.length, 2)
    listed![0].agents![0].state = 'working'
    await waitUntil('working again', async () => (await worker.request('office.snapshot')).agents.find((agent) => agent.id === 'tab1:leaf1')?.state === 'working')

    // Orca closing the terminal in the meantime is reported, not hidden.
    terminals = []
    assert.deepEqual(await worker.request('office.send', { agentId: 'tab1:leaf1', text: 'again' }), {
      ok: false,
      error: 'It does not run in a terminal Orca can type into.'
    })
    assert.equal(typed.length, 2)
  } finally {
    try {
      await worker.deactivate()
    } finally {
      listed = null
      terminals = []
    }
  }
})

test('previous and next agent go needs-you first, then working, round and round', async () => {
  listed = [
    {
      path: '/w',
      displayName: 'w',
      agents: [
        { paneKey: 'tab1:leaf1', state: 'working', agentType: 'claude' },
        { paneKey: 'tab2:leaf2', state: 'blocked', agentType: 'claude' },
        { paneKey: 'tab3:leaf3', state: 'done', agentType: 'claude' }
      ]
    }
  ]
  terminals = [
    { handle: 'term_1', paneKey: 'tab1:leaf1' },
    { handle: 'term_2', paneKey: 'tab2:leaf2' },
    { handle: 'term_3', paneKey: 'tab3:leaf3' }
  ]
  switched.length = 0
  const host = mockHost()
  const worker = await mountWorker(main, { host })
  try {
    await waitUntil('roster', async () => (await worker.request('office.snapshot')).agents.length === 3)
    await worker.command('office.nextAgent')
    await worker.command('office.nextAgent')
    await worker.command('office.nextAgent')
    await worker.command('office.nextAgent')
    await worker.command('office.previousAgent')
    // Blocked, working, done, blocked again; then one step back lands on the done one.
    assert.deepEqual(switched, ['term_2', 'term_1', 'term_3', 'term_2', 'term_3'])
  } finally {
    try {
      await worker.deactivate()
    } finally {
      listed = null
      terminals = []
    }
  }
})

test('an Orca session store that never answers delays no update, and is asked one at a time', async () => {
  listed = [
    {
      path: '/w',
      displayName: 'w',
      agents: [{ paneKey: 'structured-agent-session-slow-1:leaf', state: 'working', agentType: 'claude' }]
    }
  ]
  const original = sessionStore.lookup
  let asked = 0
  sessionStore.lookup = () => (asked++, new Promise(() => {}))
  const host = mockHost()
  const worker = await mountWorker(main, { host })
  try {
    // The agent is in a published update while the store has not answered.
    await waitUntil('the store to be asked', () => asked > 0)
    await waitUntil('an update with the agent, and the status bar', () => {
      const latest = worker.posts.at(-1)?.payload as OfficeSnapshot | undefined
      return latest?.agents.length === 1 && !latest.agents[0].context && host.callsOf('statusBar.update').length > 0
    })
    assert.equal(asked, 1)
    // Another look comes (3 s on); the first read is still out, so no second one starts.
    const looks = host.callsOf('statusBar.update').length
    await worker.emit('agent.status.changed', { workspaceId: 'p::/w', paneKey: 'structured-agent-session-slow-1:leaf', state: 'blocked', receivedAt: Date.now() })
    await waitUntil('the blocked status bar update', () => host.callsOf('statusBar.update').length > looks)
    await new Promise((resolve) => setTimeout(resolve, 3500))
    assert.equal(asked, 1)
  } finally {
    sessionStore.lookup = original
    try {
      await worker.deactivate()
    } finally {
      listed = null
    }
  }
})

test('the shortcuts start from the selected agent and keep one order for a whole walk', async () => {
  listed = [
    {
      path: '/w',
      displayName: 'w',
      agents: [
        { paneKey: 'tab1:leaf1', state: 'working', agentType: 'claude' },
        { paneKey: 'tab2:leaf2', state: 'working', agentType: 'claude' },
        { paneKey: 'tab3:leaf3', state: 'working', agentType: 'claude' }
      ]
    }
  ]
  terminals = [
    { handle: 'term_1', paneKey: 'tab1:leaf1' },
    { handle: 'term_2', paneKey: 'tab2:leaf2' },
    { handle: 'term_3', paneKey: 'tab3:leaf3' }
  ]
  switched.length = 0
  const host = mockHost()
  const worker = await mountWorker(main, { host })
  try {
    await waitUntil('roster', async () => (await worker.request('office.snapshot')).agents.length === 3)
    // The agent open in the panel is where the walk goes on from, though nobody went to it.
    assert.deepEqual(await worker.request('office.select', { agentId: 'tab2:leaf2' }), { ok: true })
    await worker.command('office.nextAgent')
    assert.deepEqual(switched, ['term_3'])

    // Within a walk the order holds, though an agent changes state: a fresh order after tab2 turns
    // blocked would send the walk back to tab1, where it began, and skip tab3.
    await worker.request('office.select', { agentId: 'tab1:leaf1' })
    switched.length = 0
    const status = (paneKey: string, state: 'working' | 'blocked') =>
      worker.emit('agent.status.changed', { workspaceId: 'p::/w', paneKey, state, receivedAt: Date.now() })
    await status('tab3:leaf3', 'blocked')
    await worker.command('office.nextAgent')
    await status('tab3:leaf3', 'working')
    await status('tab2:leaf2', 'blocked')
    await worker.command('office.nextAgent')
    assert.deepEqual(switched, ['term_2', 'term_3'])

    // Picking an agent in the panel ends the walk: the next press orders afresh from there.
    await worker.request('office.select', { agentId: 'tab1:leaf1' })
    switched.length = 0
    await worker.command('office.nextAgent')
    assert.deepEqual(switched, ['term_3'])
    // An agent the office does not know changes nothing.
    await worker.request('office.select', { agentId: 'nobody' })
    switched.length = 0
    await worker.command('office.nextAgent')
    assert.deepEqual(switched, ['term_2'])
  } finally {
    try {
      await worker.deactivate()
    } finally {
      listed = null
      terminals = []
    }
  }
})
