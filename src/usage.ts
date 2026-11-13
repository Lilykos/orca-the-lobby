// Today's token counts from the agents' own logs on this machine. Claude Code writes one `.jsonl` per
// session under `~/.claude/projects/<workspace path, dashed>/`; Codex writes one per session under
// `~/.codex/sessions/YYYY/MM/DD/`. Only usage numbers and model ids are read; nothing leaves the
// machine. Counts are per workspace, not per agent: Orca's agent ids do not name these files.
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import type { Usage } from './protocol'

/** A first read of a long log folds one chunk, then lets the worker's other work run. */
const CHUNK = 1_000_000

export function emptyUsage(): Usage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, models: {} }
}

/** Adds `more` to `into`, or takes it away again with `sign` -1. */
export function addUsage(into: Usage, more: Usage, sign: 1 | -1 = 1): Usage {
  into.input += sign * more.input
  into.output += sign * more.output
  into.cacheRead += sign * more.cacheRead
  into.cacheWrite += sign * more.cacheWrite
  for (const [model, tokens] of Object.entries(more.models)) {
    const left = (into.models[model] ?? 0) + sign * tokens
    if (left > 0) into.models[model] = left
    else delete into.models[model]
  }
  return into
}

/** The local calendar day of a time, as `YYYY-MM-DD`. */
export function dayOf(at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0)

/** One Claude Code session file: usage per local day, each message counted once (the largest of its lines). */
export type ClaudeTally = { days: Map<string, Usage>; seen: Map<string, { day: string; usage: Usage }> }

export function claudeTally(): ClaudeTally {
  return { days: new Map(), seen: new Map() }
}

const totalOf = (usage: Usage): number => usage.input + usage.output + usage.cacheRead + usage.cacheWrite

/** Folds one Claude transcript line in. A message's usage repeats on each of its content lines, and
 *  while it streams the first line's output count can be partial: the fullest line is the one kept. */
export function tallyClaude(into: ClaudeTally, line: string): void {
  let record: any
  try {
    record = JSON.parse(line)
  } catch {
    return
  }
  foldClaude(into, record)
}

/** `tallyClaude` for a line already parsed. */
export function foldClaude(into: ClaudeTally, record: any): void {
  const message = record?.message
  const usage = message?.usage
  if (record?.type !== 'assistant' || !usage || typeof record.timestamp !== 'string') return
  const id = typeof message.id === 'string' ? message.id : null
  const at = Date.parse(record.timestamp)
  if (!Number.isFinite(at)) return
  const add: Usage = {
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
    cacheWrite: count(usage.cache_creation_input_tokens),
    models: {}
  }
  const total = totalOf(add)
  if (!total) return
  if (typeof message.model === 'string' && !message.model.startsWith('<')) add.models[message.model] = total
  const day = dayOf(at)
  const before = id ? into.seen.get(id) : undefined
  if (before) {
    if (total <= totalOf(before.usage)) return
    addUsage(into.days.get(before.day)!, before.usage, -1)
  }
  if (id) into.seen.set(id, { day, usage: add })
  into.days.set(day, addUsage(into.days.get(day) ?? emptyUsage(), add))
}

/** One Codex session file: its folder, model, and running totals at the end of each local day. */
export type CodexTally = { cwd: string | null; model: string | null; days: Map<string, Usage> }

export function codexTally(): CodexTally {
  return { cwd: null, model: null, days: new Map() }
}

/** Folds one Codex session line in. Codex reports running totals for the whole session. */
export function tallyCodex(into: CodexTally, line: string): void {
  let record: any
  try {
    record = JSON.parse(line)
  } catch {
    return
  }
  foldCodex(into, record)
}

/** `tallyCodex` for a line already parsed. */
export function foldCodex(into: CodexTally, record: any): void {
  const payload = record?.payload
  if (record?.type === 'session_meta' && typeof payload?.cwd === 'string') into.cwd = payload.cwd
  if (record?.type === 'turn_context' && typeof payload?.model === 'string') into.model = payload.model
  const total = payload?.info?.total_token_usage
  if (record?.type !== 'event_msg' || payload?.type !== 'token_count' || !total) return
  const at = Date.parse(record.timestamp)
  if (!Number.isFinite(at)) return
  // Codex's input includes the cached part; keep only what was not served from cache.
  const cached = count(total.cached_input_tokens)
  into.days.set(dayOf(at), {
    input: Math.max(0, count(total.input_tokens) - cached),
    output: count(total.output_tokens),
    cacheRead: cached,
    cacheWrite: count(total.cache_write_input_tokens),
    models: {}
  })
}

/** A Codex session's tokens on one day: its last total that day, less its last total before it. */
export function codexDay(tally: CodexTally, day: string): Usage | null {
  const end = tally.days.get(day)
  if (!end) return null
  const before = [...tally.days.keys()].filter((other) => other < day).sort().pop()
  const start = before ? tally.days.get(before)! : emptyUsage()
  const used: Usage = {
    input: Math.max(0, end.input - start.input),
    output: Math.max(0, end.output - start.output),
    cacheRead: Math.max(0, end.cacheRead - start.cacheRead),
    cacheWrite: Math.max(0, end.cacheWrite - start.cacheWrite),
    models: {}
  }
  const total = used.input + used.output + used.cacheRead + used.cacheWrite
  if (tally.model && total) used.models[tally.model] = total
  return used
}

export type Followed<T> = { offset: number; carry: string; decoder: TextDecoder; tally: T; pending: Promise<unknown> }

/** Reads a log file from where it was last read to its end, folding each new line into its tally.
 *  Asked twice at once for one file, the second waits for the first, so no byte is folded twice. */
export function follow<T>(files: Map<string, Followed<T>>, path: string, fresh: () => T, fold: (tally: T, line: string) => void): Promise<T> {
  const file = files.get(path) ?? { offset: 0, carry: '', decoder: new TextDecoder(), tally: fresh(), pending: Promise.resolve() }
  files.set(path, file)
  const run = file.pending.then(() => readNew(file, path, fresh, fold))
  file.pending = run.catch(() => {})
  return run
}

async function readNew<T>(file: Followed<T>, path: string, fresh: () => T, fold: (tally: T, line: string) => void): Promise<T> {
  const size = (await stat(path)).size
  // A file that shrank was rewritten: count it again from the start.
  if (size < file.offset) Object.assign(file, { offset: 0, carry: '', decoder: new TextDecoder(), tally: fresh() })
  const handle = await open(path, 'r')
  try {
    while (file.offset < size) {
      const length = Math.min(size - file.offset, CHUNK)
      const buffer = new Uint8Array(length)
      await handle.read(buffer, 0, length, file.offset)
      file.offset += length
      const lines = (file.carry + file.decoder.decode(buffer, { stream: true })).split('\n')
      file.carry = lines.pop() ?? ''
      for (const line of lines) if (line) fold(file.tally, line)
      if (file.offset < size) await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    await handle.close()
  }
  return file.tally
}

/** What a pass over one session log yields for the day counts; context's tally carries more. */
export type LogTally = { claude: ClaudeTally; codex: CodexTally }
/** Follows a session log and returns its tally: the one place a log is read and parsed. */
export type LogTail = (path: string, provider: 'claude' | 'codex') => Promise<LogTally>

/** A tail that keeps only the day tallies; the worker passes the context reader's richer one instead. */
export function createLogTail(): LogTail {
  const claude = new Map<string, Followed<ClaudeTally>>()
  const codex = new Map<string, Followed<CodexTally>>()
  return async (path, provider) =>
    provider === 'claude'
      ? { claude: await follow(claude, path, claudeTally, tallyClaude), codex: codexTally() }
      : { claude: claudeTally(), codex: await follow(codex, path, codexTally, tallyCodex) }
}

/** Makes a counter that, asked again and again, reads only what was appended since. */
export function createUsageCounter(home: string = homedir(), tail: LogTail = createLogTail()) {
  /** Session files in a folder written since the start of the day. */
  const touched = async (folder: string, since: number): Promise<string[]> => {
    const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith('.jsonl'))
    const files = await Promise.all(names.map(async (name) => {
      const info = await stat(`${folder}/${name}`).catch(() => null)
      return info && info.mtimeMs >= since ? `${folder}/${name}` : null
    }))
    return files.filter((file): file is string => file !== null)
  }

  /** Today's tokens for each of the given workspace paths that used any. */
  return async function countToday(workspaces: string[], now: number): Promise<Map<string, Usage>> {
    const day = dayOf(now)
    const midnight = new Date(now).setHours(0, 0, 0, 0)
    const found = new Map<string, Usage>()
    const add = (workspace: string, usage: Usage | null | undefined): void => {
      if (usage) found.set(workspace, addUsage(found.get(workspace) ?? emptyUsage(), usage))
    }
    for (const workspace of new Set(workspaces)) {
      const folder = `${home}/.claude/projects/${workspace.replace(/[^a-zA-Z0-9]/g, '-')}`
      for (const file of await touched(folder, midnight)) {
        add(workspace, (await tail(file, 'claude')).claude.days.get(day))
      }
    }
    // Codex files sit under the day a session started, so one that crossed midnight is in yesterday's.
    const known = new Set(workspaces)
    for (const start of [midnight - 1, now]) {
      const date = new Date(start)
      const folder = `${home}/.codex/sessions/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
      for (const file of await touched(folder, midnight)) {
        const { codex } = await tail(file, 'codex')
        if (codex.cwd && known.has(codex.cwd)) add(codex.cwd, codexDay(codex, day))
      }
    }
    return found
  }
}
