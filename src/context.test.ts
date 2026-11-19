import { assert, test } from 'orca/testing'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { askStore, contextOf, createContextReader, orcaSessionId, parseProviderSessions, providerSessionsQuery, sessionStore, sessionTally, tallySession } from './context'
import { CONTEXT_HIGH, CONTEXT_WARN, contextFill } from './protocol'
import { dayOf } from './usage'

// Local times, so the day a line falls on does not depend on the machine's time zone.
const at = (day: number, hour: number): string => new Date(2026, 10, day, hour).toISOString()
const today = dayOf(Date.parse(at(13, 12)))

const claudeTurn = (id: string, usage: object, extra: object = {}, model = 'claude-opus-5-5'): string =>
  JSON.stringify({ type: 'assistant', timestamp: at(13, 9), message: { id, model, usage }, ...extra })
const boundary = (extra: object = {}): string =>
  JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(13, 10), compactMetadata: { trigger: 'auto', preTokens: 900000, postTokens: 40000 }, ...extra })
const tokenCount = (when: string, last: number, total: number, window: number | null = 258400): string =>
  JSON.stringify({ type: 'event_msg', timestamp: when, payload: { type: 'token_count', info: { last_token_usage: { total_tokens: last }, total_token_usage: { input_tokens: total, cached_input_tokens: 0, output_tokens: 0 }, model_context_window: window } } })

test('an agent is tied to Orca\'s session only through the id in its chat pane key', () => {
  assert.equal(orcaSessionId('structured-agent-session-13c735e6-eff4-40d9-ad35-a20fd4ace9fd:6c47c7b5-fa5b'), '13c735e6-eff4-40d9-ad35-a20fd4ace9fd')
  assert.equal(orcaSessionId('structured-agent-session-claude_bf59ac5b_8367:a402'), 'claude_bf59ac5b_8367')
  assert.equal(orcaSessionId('tab-1:leaf-2'), null)
  assert.equal(orcaSessionId(null), null)
  assert.equal(orcaSessionId("structured-agent-session-x';drop table y;--:leaf"), null)
})

test('the session store query yields only provider ids, and its rows parse to the latest id', () => {
  const sql = providerSessionsQuery(['a-1', 'b_2'])
  assert.ok(sql.includes("in ('a-1','b_2')") && !sql.includes('prompt') && !sql.includes('record_json as'))
  assert.ok(sql.includes('json_valid(r.record_json)'))
  const rows = JSON.stringify([
    { id: 'a-1', provider: 'claude', home: '/Users/me/.claude/', sessionId: 'c-9', threadId: null },
    { id: 'b_2', provider: 'codex', home: null, sessionId: null, threadId: 't-7' },
    { id: 'no-handle', provider: 'claude', home: null, sessionId: null, threadId: null },
    { id: 'pi-1', provider: 'pi', home: null, sessionId: 'x', threadId: 'y' },
    { id: 'bad', provider: 'claude', home: null, sessionId: '../etc', threadId: null }
  ])
  const found = parseProviderSessions(rows)
  assert.deepEqual([...found.keys()], ['a-1', 'b_2'])
  assert.deepEqual(found.get('a-1'), { provider: 'claude', id: 'c-9', home: '/Users/me/.claude' })
  assert.deepEqual(found.get('b_2'), { provider: 'codex', id: 't-7', home: null })
  assert.equal(parseProviderSessions('not json').size, 0)
  assert.equal(parseProviderSessions('').size, 0)
})

test('Claude context is the latest request\'s input, restarts at a compaction, and ignores side chains', () => {
  const tally = sessionTally('claude')
  tallySession(tally, claudeTurn('m1', { input_tokens: 3, cache_read_input_tokens: 90000, cache_creation_input_tokens: 2000, output_tokens: 500 }))
  assert.equal(tally.tokens, 92003)
  tallySession(tally, claudeTurn('m2', { input_tokens: 9, cache_read_input_tokens: 5, cache_creation_input_tokens: 5 }, { isSidechain: true }))
  tallySession(tally, claudeTurn('m3', { input_tokens: 9, cache_read_input_tokens: 5 }, {}, '<synthetic>'))
  tallySession(tally, claudeTurn('m4', { input_tokens: 0, output_tokens: 0 }))
  tallySession(tally, 'not json but has "usage"')
  assert.equal(tally.tokens, 92003)
  tallySession(tally, boundary())
  assert.deepEqual([tally.compactions, tally.tokens], [1, 40000])
  tallySession(tally, boundary({ compactMetadata: { trigger: 'manual' } }))
  assert.deepEqual([tally.compactions, tally.tokens], [2, null])
  tallySession(tally, boundary({ isSidechain: true }))
  assert.equal(tally.compactions, 2)
  tallySession(tally, claudeTurn('m5', { input_tokens: 1, cache_read_input_tokens: 40000 }))
  assert.equal(tally.tokens, 40001)
  assert.equal(tally.window, null)
  assert.deepEqual(contextOf(tally, today), { tokens: 40001, window: null, compactions: 2, today: 132537 })
})

test('Codex context is the latest request against the window the log states', () => {
  const tally = sessionTally('codex')
  tallySession(tally, JSON.stringify({ type: 'turn_context', timestamp: at(13, 8), payload: { model: 'gpt-6.1-terra' } }))
  tallySession(tally, tokenCount(at(13, 9), 25000, 25000))
  tallySession(tally, tokenCount(at(13, 10), 30000, 55000))
  assert.deepEqual([tally.tokens, tally.window, tally.compactions], [30000, 258400, 0])
  tallySession(tally, JSON.stringify({ type: 'compacted', timestamp: at(13, 11), payload: { message: '' } }))
  assert.deepEqual([tally.tokens, tally.compactions], [null, 1])
  tallySession(tally, tokenCount(at(13, 12), 12000, 67000))
  tallySession(tally, JSON.stringify({ type: 'event_msg', timestamp: at(13, 12), payload: { type: 'token_count', info: null } }))
  assert.deepEqual(contextOf(tally, today), { tokens: 12000, window: 258400, compactions: 1, today: 67000 })
  assert.deepEqual(contextOf(tally, dayOf(Date.parse(at(14, 12)))), { tokens: 12000, window: 258400, compactions: 1, today: 0 })
})

test('Codex context is the input side of the latest request, not its total with the output', () => {
  const tally = sessionTally('codex')
  const request = (input: number, output: number, total: number): string =>
    JSON.stringify({ type: 'event_msg', timestamp: at(13, 9), payload: { type: 'token_count', info: { last_token_usage: { input_tokens: input, cached_input_tokens: input - 10, output_tokens: output, total_tokens: total }, total_token_usage: { input_tokens: total, cached_input_tokens: 0, output_tokens: 0 }, model_context_window: 100000 } } })
  tallySession(tally, request(60000, 9000, 69000))
  assert.equal(tally.tokens, 60000)
  assert.deepEqual(contextFill(contextOf(tally, today)), { percent: 60, level: 'ok' })
})

test('the fill shows only with a window, and warns from 70% and alarms from 90%', () => {
  const fill = (tokens: number | null, window: number | null) => contextFill({ tokens, window, compactions: 0, today: 0 })
  assert.equal(CONTEXT_WARN, 70)
  assert.equal(CONTEXT_HIGH, 90)
  assert.equal(fill(512000, null), null)
  assert.equal(fill(null, 700000), null)
  assert.equal(contextFill(null), null)
  assert.deepEqual(fill(512000, 700000), { percent: 73, level: 'warn' })
  assert.deepEqual(fill(69, 100), { percent: 69, level: 'ok' })
  assert.deepEqual(fill(70, 100), { percent: 70, level: 'warn' })
  assert.deepEqual(fill(89, 100), { percent: 89, level: 'warn' })
  assert.deepEqual(fill(90, 100), { percent: 90, level: 'high' })
})

test('the reader finds each agent\'s log by id, reads it once, then only what was appended', async () => {
  const home = await mkdtemp(`${tmpdir()}/lobby-context-`)
  await mkdir(`${home}/.claude/projects/-w-one`, { recursive: true })
  await mkdir(`${home}/.claude/projects/-elsewhere`, { recursive: true })
  await mkdir(`${home}/.codex/sessions/2026/11/12`, { recursive: true })
  const claude = [claudeTurn('m1', { input_tokens: 10, cache_read_input_tokens: 1000 }), boundary()]
  await writeFile(`${home}/.claude/projects/-w-one/claude-id-1.jsonl`, claude.join('\n') + '\n')
  // Another agent's log in the same folder, newer, and one with the right id in an unexpected folder.
  await writeFile(`${home}/.claude/projects/-w-one/other-id.jsonl`, claudeTurn('x', { input_tokens: 999999 }) + '\n')
  await writeFile(`${home}/.claude/projects/-elsewhere/claude-id-2.jsonl`, claudeTurn('m9', { input_tokens: 7 }) + '\n')
  await writeFile(`${home}/.codex/sessions/2026/11/12/rollout-2026-11-12T10-00-00-thread-1.jsonl`, [tokenCount(at(13, 9), 50000, 50000), tokenCount(at(13, 10), 60000, 110000)].join('\n') + '\n')

  const asked: string[][] = []
  const known = new Map([
    ['orca-claude', { provider: 'claude' as const, id: 'claude-id-1', home: `${home}/.claude` }],
    ['orca-moved', { provider: 'claude' as const, id: 'claude-id-2', home: `${home}/.claude` }],
    ['orca-codex', { provider: 'codex' as const, id: 'thread-1', home: null }],
    ['orca-nolog', { provider: 'claude' as const, id: 'gone', home: `${home}/.claude` }]
  ])
  sessionStore.lookup = async (ids) => {
    asked.push(ids)
    return new Map(ids.flatMap((id) => (known.has(id) ? [[id, known.get(id)!] as const] : [])))
  }
  const read = createContextReader(home)
  const now = Date.parse(at(13, 12))
  const agents = [
    { id: 'a', paneKey: 'structured-agent-session-orca-claude:leaf', workspaceId: '/w/one' },
    { id: 'b', paneKey: 'structured-agent-session-orca-moved:leaf', workspaceId: '/w/one' },
    { id: 'c', paneKey: 'structured-agent-session-orca-codex:leaf', workspaceId: '/w/one' },
    { id: 'd', paneKey: 'structured-agent-session-orca-nolog:leaf', workspaceId: '/w/one' },
    { id: 'e', paneKey: 'structured-agent-session-orca-unknown:leaf', workspaceId: '/w/one' },
    { id: 'f', paneKey: 'terminal-tab:leaf', workspaceId: '/w/one' }
  ]
  const first = await read(agents, now)
  assert.deepEqual([...first.keys()].sort(), ['a', 'b', 'c'])
  assert.deepEqual(first.get('a'), { tokens: 40000, window: null, compactions: 1, today: 1010 })
  assert.deepEqual(first.get('b'), { tokens: 7, window: null, compactions: 0, today: 7 })
  assert.deepEqual(first.get('c'), { tokens: 60000, window: 258400, compactions: 0, today: 110000 })
  assert.equal(asked.length, 1)

  // Asked again soon: Orca is not asked, and a line appended to the log is picked up.
  await writeFile(`${home}/.claude/projects/-w-one/claude-id-1.jsonl`, [...claude, claudeTurn('m2', { input_tokens: 5, cache_read_input_tokens: 45000 })].join('\n') + '\n')
  const second = await read(agents, now + 5000)
  assert.equal(asked.length, 1)
  assert.deepEqual(second.get('a'), { tokens: 45005, window: null, compactions: 1, today: 1010 + 45005 })

  // An unreadable store keeps what was known.
  sessionStore.lookup = async () => null
  assert.equal((await read(agents, now + 60000)).get('c')?.tokens, 60000)
})

test('an unreadable store is not asked again before the interval, nor a missing log searched for again', async () => {
  const home = await mkdtemp(`${tmpdir()}/lobby-context-`)
  const original = sessionStore.lookup
  const agents = [{ id: 'a', paneKey: 'structured-agent-session-orca-claude:leaf', workspaceId: '/w/one' }]
  const now = Date.parse(at(13, 12))
  try {
    let asked = 0
    let answer: Map<string, { provider: 'claude'; id: string; home: string }> | null = null
    sessionStore.lookup = async () => (asked++, answer)
    const read = createContextReader(home)

    // No store: asked once, then not again for a minute; then once more.
    assert.equal((await read(agents, now)).size, 0)
    assert.equal((await read(agents, now + 3000)).size, 0)
    assert.equal((await read(agents, now + 30000)).size, 0)
    assert.equal(asked, 1)
    assert.equal((await read(agents, now + 60000)).size, 0)
    assert.equal(asked, 2)

    // The store comes back and names a log that is not on disk yet: searched for once, then after a minute.
    answer = new Map([['orca-claude', { provider: 'claude', id: 'late-id', home: `${home}/.claude` }]])
    assert.equal((await read(agents, now + 120000)).size, 0)
    assert.equal(asked, 3)
    await mkdir(`${home}/.claude/projects/-w-one`, { recursive: true })
    await writeFile(`${home}/.claude/projects/-w-one/late-id.jsonl`, claudeTurn('m1', { input_tokens: 10, cache_read_input_tokens: 90 }) + '\n')
    assert.equal((await read(agents, now + 150000)).size, 0)
    assert.deepEqual((await read(agents, now + 180000)).get('a'), { tokens: 100, window: null, compactions: 0, today: 100 })
    // Found, it stays found; and once the file is gone it is looked for again only after the interval.
    assert.equal((await read(agents, now + 183000)).get('a')?.tokens, 100)
  } finally {
    sessionStore.lookup = original
  }
})

test('the store is asked with another sqlite3 only when the first is not installed', async () => {
  const home = await mkdtemp(`${tmpdir()}/lobby-command-fallback-`)
  const db = `${home}/store.db`
  await writeFile(db, '')
  const called: string[] = []
  const execute: typeof execFile = (command, _args, _options, done) => {
    called.push(command)
    if (command === 'missing') done(Object.assign(new Error('missing'), { code: 'ENOENT' }), '')
    else if (command === 'locked') done(new Error('locked'), '')
    else done(null, '[]')
  }
  assert.equal(await askStore(['locked', 'available'], ['x'], [db], execute), null)
  assert.deepEqual(called.splice(0), ['locked'])
  assert.equal((await askStore(['missing', 'available'], ['x'], [db], execute))?.size, 0)
  assert.deepEqual(called.splice(0), ['missing', 'available'])
  assert.equal(await askStore(['missing'], ['x'], [db], execute), null)
})

test('prefers the current session database and falls back only when it is absent', async () => {
  const home = await mkdtemp(`${tmpdir()}/lobby-stores-`)
  const current = `${home}/domain.db`
  const legacy = `${home}/journal.db`
  const make = (db: string, id: string): Promise<boolean> => new Promise((resolve) => {
    const record = JSON.stringify({ provider: 'codex', providerHandleChain: [{ handle: { threadId: id } }] })
    execFile('sqlite3', [db, `create table agent_session_records (session_id text, record_json text); insert into agent_session_records values ('chat', '${record}');`],
      { timeout: 5000, maxBuffer: 1 << 20 }, (error) => resolve(!error))
  })
  if (!(await make(current, 'current-thread')) || !(await make(legacy, 'legacy-thread'))) return
  const commands = ['sqlite3']
  assert.equal((await askStore(commands, ['chat'], [current, legacy]))?.get('chat')?.id, 'current-thread')
  assert.equal((await askStore(commands, ['chat'], [`${home}/absent.db`, legacy]))?.get('chat')?.id, 'legacy-thread')
  assert.equal((await askStore(commands, ['missing-chat'], [current, legacy]))?.size, 0)
  await writeFile(`${home}/broken.db`, 'not a database')
  assert.equal(await askStore(commands, ['chat'], [`${home}/broken.db`, legacy]), null)
})

test('one malformed record in the store does not hide the others', async () => {
  const run = (args: string[]): Promise<string | null> =>
    new Promise((resolve) => execFile('sqlite3', args, { timeout: 5000, maxBuffer: 1 << 20 }, (error, stdout) => resolve(error ? null : stdout)))
  const home = await mkdtemp(`${tmpdir()}/lobby-store-`)
  const db = `${home}/store.db`
  const good = JSON.stringify({ provider: 'claude', accountHome: { path: '/h/.claude' }, providerHandleChain: [{ handle: { sessionId: 'old' } }, { handle: { sessionId: 'new' } }] })
  const made = await run([db, `create table agent_session_records (session_id text, record_json text); insert into agent_session_records values ('good-1', '${good}'), ('bad-1', '{not json');`])
  if (made === null) return // no sqlite3 here: the query text is checked above
  const rows = await run(['-readonly', '-json', db, providerSessionsQuery(['good-1', 'bad-1'])])
  const found = parseProviderSessions(rows ?? '')
  assert.deepEqual([...found.keys()], ['good-1'])
  assert.deepEqual(found.get('good-1'), { provider: 'claude', id: 'new', home: '/h/.claude' })
})
