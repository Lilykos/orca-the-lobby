// Per-agent context fill, compactions and tokens today. The link from an Orca agent to its log is an id
// equality, never a guess: a chat agent's pane key is `structured-agent-session-<Orca session id>:<leaf>`;
// Orca's own session store (`agent-session-journal.db`) records, for that session id, the provider's id
// (Claude Code's session id, Codex's thread id); and that id is in the log's file name. Only usage
// numbers, model ids and compaction markers are read from the log; nothing leaves the machine.
import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { usageTotal, type AgentContext, type AgentView } from './protocol'
import { claudeTally, codexDay, codexTally, dayOf, foldClaude, foldCodex, follow, type ClaudeTally, type CodexTally, type Followed } from './usage'

const STORE = `${homedir()}/Library/Application Support/orca/agent-session-journal.db`
const CHAT_PANE = 'structured-agent-session-'
/** Ids end up in SQL and file names, so only these characters are accepted. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/
/** How long Orca's answer for a session stands before it is asked again. */
const MAPPING_MS = 30000
/** How long a failure stands before it is tried again: Orca's store unreadable, or a log not found. */
const RETRY_MS = 60000
/** A followed log nobody has asked for this long is let go. */
const IDLE_MS = 600000

/** Orca's session id for a chat agent's pane key (`structured-agent-session-<id>:<leaf>`), else null. */
export function orcaSessionId(paneKey: string | null | undefined): string | null {
  if (!paneKey?.startsWith(CHAT_PANE)) return null
  const id = paneKey.slice(CHAT_PANE.length).split(':')[0]
  return SAFE_ID.test(id) ? id : null
}

/** The provider's own id for a session, as Orca's session store records it. */
export type ProviderSession = { provider: 'claude' | 'codex'; id: string; home: string | null }

/** The rows of the store query: one per Orca session, with only the provider and its id. */
export function parseProviderSessions(json: string): Map<string, ProviderSession> {
  const found = new Map<string, ProviderSession>()
  let rows: any
  try {
    rows = JSON.parse(json.trim() || '[]')
  } catch {
    return found
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    const provider = row?.provider === 'claude' || row?.provider === 'codex' ? row.provider : null
    const id = provider === 'claude' ? row.sessionId : provider === 'codex' ? row.threadId : null
    if (!provider || typeof row.id !== 'string' || typeof id !== 'string' || !SAFE_ID.test(id)) continue
    const home = typeof row.home === 'string' && row.home.startsWith('/') ? row.home.replace(/\/+$/, '') : null
    found.set(row.id, { provider, id, home })
  }
  return found
}

/** The latest id of one kind in the session's handle chain; no prompt or message text is selected.
 *  A record that is not valid JSON is skipped (see the query), as json_extract on it would fail every row. */
const latest = (key: string): string =>
  `(select json_extract(l.value, '$.handle.${key}') from json_each(r.record_json, '$.providerHandleChain') l where json_extract(l.value, '$.handle.${key}') is not null order by l.key desc limit 1)`

export function providerSessionsQuery(ids: string[]): string {
  return `select r.session_id as id, json_extract(r.record_json, '$.provider') as provider, json_extract(r.record_json, '$.accountHome.path') as home, ${latest('sessionId')} as sessionId, ${latest('threadId')} as threadId from agent_session_records r where r.session_id in (${ids.map((id) => `'${id}'`).join(',')}) and json_valid(r.record_json)`
}

/** The provider ids for these Orca session ids from the first program that can be run, or null when the
 *  store cannot be read. Another program is tried only when the first is not installed (ENOENT): a
 *  database that is locked or unreadable fails the same way again, and each try can take its timeout. */
export function askStore(commands: string[], ids: string[]): Promise<Map<string, ProviderSession> | null> {
  return new Promise((resolve) => {
    const run = (command: string, next: string[]): void => {
      execFile(command, ['-readonly', '-json', STORE, providerSessionsQuery(ids)], { timeout: 5000, maxBuffer: 4 << 20 }, (error, stdout) => {
        if (!error) resolve(parseProviderSessions(stdout))
        else if ((error as { code?: unknown }).code === 'ENOENT' && next.length) run(next[0], next.slice(1))
        else resolve(null)
      })
    }
    run(commands[0], commands.slice(1))
  })
}

/** Tests replace this, so they never run a real program. */
export const sessionStore = {
  /** The provider ids for these Orca session ids, or null when the store cannot be read.
   *  macOS ships sqlite3; the worker may start without the login shell's PATH. */
  lookup: (ids: string[]): Promise<Map<string, ProviderSession> | null> => askStore(['/usr/bin/sqlite3', 'sqlite3'], ids)
}

/** One session's log, as far as context is concerned: the latest figures, plus the usual day tallies. */
export type SessionTally = {
  provider: 'claude' | 'codex'
  claude: ClaudeTally
  codex: CodexTally
  tokens: number | null
  window: number | null
  compactions: number
}

export function sessionTally(provider: 'claude' | 'codex'): SessionTally {
  return { provider, claude: claudeTally(), codex: codexTally(), tokens: null, window: null, compactions: 0 }
}

/** Only lines that can carry a figure are parsed. */
const HINTS = {
  claude: ['"usage"', 'compact_boundary'],
  codex: ['"token_count"', '"compacted"', '"session_meta"', '"turn_context"']
}

const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null)

/** Folds one log line in; a line that is not what it expects changes nothing. */
export function tallySession(into: SessionTally, line: string): void {
  if (!HINTS[into.provider].some((hint) => line.includes(hint))) return
  let record: any
  try {
    record = JSON.parse(line)
  } catch {
    return
  }
  if (into.provider === 'claude') {
    foldClaude(into.claude, record)
    // A subagent's turns are in the same file, marked as a side chain: they do not fill this context.
    if (record?.isSidechain) return
    if (record?.type === 'system' && record.subtype === 'compact_boundary') {
      into.compactions += 1
      into.tokens = count(record.compactMetadata?.postTokens)
      return
    }
    const message = record?.message
    const usage = message?.usage
    if (record?.type !== 'assistant' || !usage || message.model === '<synthetic>') return
    // A request is its input, whether or not it came from cache; the cache fields may be absent and mean 0.
    const input = count(usage.input_tokens)
    const cached = count(usage.cache_read_input_tokens ?? 0)
    const written = count(usage.cache_creation_input_tokens ?? 0)
    if (input === null || cached === null || written === null || input + cached + written === 0) return
    into.tokens = input + cached + written
    return
  }
  foldCodex(into.codex, record)
  const payload = record?.payload
  if (record?.type === 'compacted') {
    into.compactions += 1
    into.tokens = null
  } else if (record?.type === 'event_msg' && payload?.type === 'token_count' && payload.info) {
    // Codex's total for a request adds its output; the context it filled is the input side, cached part included.
    const last = payload.info.last_token_usage
    const tokens = count(last?.input_tokens) ?? count(last?.total_tokens)
    if (tokens !== null) into.tokens = tokens
    const window = count(payload.info.model_context_window)
    if (window) into.window = window
  }
}

/** The tally as the panel shows it, with tokens for the given local day. */
export function contextOf(tally: SessionTally, day: string): AgentContext {
  const used = tally.provider === 'claude' ? tally.claude.days.get(day) : codexDay(tally.codex, day)
  return { tokens: tally.tokens, window: tally.window, compactions: tally.compactions, today: used ? usageTotal(used) : 0 }
}

/** Claude Code names a project's log folder after its working directory. */
const claudeFolder = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, '-')

/** A tail of session logs that parses each line once, for the day counts and for the context alike. */
export type SessionTail = (path: string, provider: 'claude' | 'codex') => Promise<SessionTally>

/** Follows each log it is asked for, once however many readers ask; a log nobody asks for a while is let go. */
export function createSessionTail(): SessionTail {
  const logs = new Map<string, Followed<SessionTally>>()
  const usedAt = new Map<string, number>()
  let sweptAt = Date.now()
  return (path, provider) => {
    const now = Date.now()
    usedAt.set(path, now)
    if (now - sweptAt >= IDLE_MS) {
      sweptAt = now
      for (const [other, at] of usedAt) {
        if (now - at < IDLE_MS) continue
        usedAt.delete(other)
        logs.delete(other)
      }
    }
    return follow(logs, path, () => sessionTally(provider), tallySession)
  }
}

/** Makes a reader that, asked again and again, asks Orca seldom and reads only what the logs appended.
 *  What went wrong (Orca's store unreadable, a log not found) is not searched for again for RETRY_MS. */
export function createContextReader(home: string = homedir(), tail: SessionTail = createSessionTail()) {
  const mapped = new Map<string, { at: number; session: ProviderSession | null }>()
  const paths = new Map<string, string>()
  /** When each log was last looked for in vain, by provider and id. */
  const missing = new Map<string, number>()
  let storeFailedAt = -Infinity

  const claudeLog = async (session: ProviderSession, workspace: string | null): Promise<string | null> => {
    const projects = `${session.home ?? `${home}/.claude`}/projects`
    const name = `${session.id}.jsonl`
    const guesses = workspace ? [`${projects}/${claudeFolder(workspace)}/${name}`] : []
    for (const path of guesses) if (await stat(path).catch(() => null)) return path
    for (const folder of await readdir(projects).catch(() => [])) {
      if (await stat(`${projects}/${folder}/${name}`).catch(() => null)) return `${projects}/${folder}/${name}`
    }
    return null
  }

  /** Codex files a rollout under the day it started: `YYYY/MM/DD/rollout-<time>-<thread id>.jsonl`. */
  const codexLog = async (session: ProviderSession): Promise<string | null> => {
    const root = `${session.home ?? `${home}/.codex`}/sessions`
    const newest = async (folder: string): Promise<string[]> => (await readdir(folder).catch(() => [])).sort().reverse()
    for (const year of await newest(root)) {
      for (const month of await newest(`${root}/${year}`)) {
        for (const day of await newest(`${root}/${year}/${month}`)) {
          const folder = `${root}/${year}/${month}/${day}`
          const name = (await readdir(folder).catch(() => [])).find((file) => file.endsWith(`-${session.id}.jsonl`))
          if (name) return `${folder}/${name}`
        }
      }
    }
    return null
  }

  /** Context for each agent whose Orca session record names a log; the others are left out. */
  return async function readContexts(agents: Pick<AgentView, 'id' | 'paneKey' | 'workspaceId'>[], now: number): Promise<Map<string, AgentContext>> {
    const wanted = agents.flatMap((agent) => {
      const session = orcaSessionId(agent.paneKey)
      return session ? [{ agent, session }] : []
    })
    const stale = [...new Set(wanted.map(({ session }) => session))].filter((id) => now - (mapped.get(id)?.at ?? -Infinity) >= MAPPING_MS)
    if (stale.length && now - storeFailedAt >= RETRY_MS) {
      const answer = await sessionStore.lookup(stale)
      // An unreadable store keeps what was known and is not asked again for a while; a readable one
      // that lacks a session says it has no log.
      if (answer) for (const id of stale) mapped.set(id, { at: now, session: answer.get(id) ?? null })
      else storeFailedAt = now
    }
    const day = dayOf(now)
    const found = new Map<string, AgentContext>()
    for (const { agent, session } of wanted) {
      const provider = mapped.get(session)?.session
      if (!provider) continue
      const key = `${provider.provider}\n${provider.id}`
      let path = paths.get(key)
      if (!path) {
        if (now - (missing.get(key) ?? -Infinity) < RETRY_MS) continue
        path = (provider.provider === 'claude' ? await claudeLog(provider, agent.workspaceId) : await codexLog(provider)) ?? undefined
        if (!path) {
          missing.set(key, now)
          continue
        }
        paths.set(key, path)
        missing.delete(key)
      }
      try {
        found.set(agent.id, contextOf(await tail(path, provider.provider), day))
      } catch {
        // The log is gone or unreadable: look for it again, but not before RETRY_MS.
        paths.delete(key)
        missing.set(key, now)
      }
    }
    return found
  }
}
