// Supplementary Claude transcript todo lists and changed files. Claude Code writes one `.jsonl` per session
// under `~/.claude/projects/<workspace path, dashed>/`; the worker reads what is appended to it
// and nothing leaves the machine.
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import type { AgentView, Insight, Todo } from './protocol'

/** An insight, plus what tells whose transcript it is. */
export type Digest = Insight & {
  title: string | null
  lastPrompt: string | null
}

/** A first read starts this far from the end: enough for the current state of a long session. */
const TAIL = 1_500_000
const CHUNK = 4_000_000
/** Sessions untouched for longer are nobody's who is in the office now. */
const FRESH_MS = 24 * 60 * 60 * 1000
const NEWEST = 8
const FILES = 8

export function emptyDigest(): Digest {
  return {
    model: null,
    todos: [],
    files: [],
    title: null,
    lastPrompt: null
  }
}

/** Folds one transcript line into the digest; a line that is not what it expects changes nothing. */
export function digest(into: Digest, line: string): void {
  let record: any
  try {
    record = JSON.parse(line)
  } catch {
    return
  }
  if (record?.type === 'ai-title' && typeof record.aiTitle === 'string') into.title = record.aiTitle
  if (record?.type === 'last-prompt' && typeof record.lastPrompt === 'string') {
    into.lastPrompt = record.lastPrompt
  }
  // A subagent's turns are in the same file, marked as a side chain: they are not this agent's.
  if (record?.type !== 'assistant' || record.isSidechain) return
  const message = record.message
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    if (block?.type !== 'tool_use' || typeof block.name !== 'string') continue
    if (block.name === 'TodoWrite' && Array.isArray(block.input?.todos)) {
      into.todos = block.input.todos
        .filter((todo: any) => typeof todo?.content === 'string')
        .map((todo: any): Todo => ({
          text: todo.content,
          status:
            todo.status === 'completed' || todo.status === 'in_progress' ? todo.status : 'pending'
        }))
    }
    const path = block.input?.file_path ?? block.input?.notebook_path
    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(block.name) && typeof path === 'string') {
      const name = path.split(/[\\/]/).pop() || path
      into.files = [name, ...into.files.filter((other) => other !== name)].slice(0, FILES)
    }
  }
}

const start = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)

/** Finds a possible transcript for supplementary notes, using title/prompt similarity. */
export function assign(
  agents: (Pick<AgentView, 'id' | 'title' | 'prompt'> & Partial<Pick<AgentView, 'agent'>>)[],
  digests: Digest[]
): Map<string, Digest> {
  const candidates = agents.filter((agent) => !agent.agent || agent.agent === 'claude')
  const mine = new Map<string, Digest>()
  const free = new Set(digests)
  const take = (agent: { id: string }, found: Digest | undefined): void => {
    if (!found || mine.has(agent.id)) return
    mine.set(agent.id, found)
    free.delete(found)
  }
  for (const agent of candidates) {
    take(agent, agent.title ? [...free].find((item) => item.title === agent.title) : undefined)
  }
  for (const agent of candidates) {
    const asked = start(agent.prompt)
    take(agent, asked ? [...free].find((item) => start(item.lastPrompt) === asked) : undefined)
  }
  if (candidates.length === 1) take(candidates[0], digests[0])
  return mine
}

/** Transcript model identity is heuristic; keep it out of agent Insight until Orca links sessions. */
export function supplementaryInsight(found: Digest): Insight {
  return {
    model: null,
    todos: found.todos,
    files: found.files
  }
}

type Tracked = { offset: number; carry: string; decoder: TextDecoder; digest: Digest }

/** Makes a reader that, asked again and again, reads only what was appended since. */
export function createReader(home: string = homedir()) {
  const tracked = new Map<string, Tracked>()

  const follow = async (path: string, size: number): Promise<Digest> => {
    const first = !tracked.has(path)
    const file = tracked.get(path) ?? {
      offset: Math.max(0, size - TAIL),
      carry: '',
      decoder: new TextDecoder(),
      digest: emptyDigest()
    }
    tracked.set(path, file)
    // A file that shrank was rewritten: start it over.
    if (size < file.offset) Object.assign(file, { offset: 0, carry: '', digest: emptyDigest() })
    if (size === file.offset) return file.digest

    const length = Math.min(size - file.offset, CHUNK)
    const buffer = new Uint8Array(length)
    const handle = await open(path, 'r')
    try {
      await handle.read(buffer, 0, length, file.offset)
    } finally {
      await handle.close()
    }
    const cutIn = first && file.offset > 0
    file.offset += length
    const lines = (file.carry + file.decoder.decode(buffer, { stream: true })).split('\n')
    file.carry = lines.pop() ?? ''
    // Starting mid-file lands mid-line: the first piece is the end of a line, not a line.
    if (cutIn) lines.shift()
    for (const line of lines) if (line) digest(file.digest, line)
    return file.digest
  }

  /** The newest transcripts of a workspace, newest first. */
  const inWorkspace = async (workspace: string, now: number): Promise<Digest[]> => {
    const folder = `${home}/.claude/projects/${workspace.replace(/[^a-zA-Z0-9]/g, '-')}`
    const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith('.jsonl'))
    const files = await Promise.all(
      names.map(async (name) => ({
        path: `${folder}/${name}`,
        ...(await stat(`${folder}/${name}`))
      }))
    )
    const fresh = files
      .filter((file) => now - file.mtimeMs < FRESH_MS)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, NEWEST)
    const digests: Digest[] = []
    for (const file of fresh) digests.push(await follow(file.path, file.size))
    return digests
  }

  /** Best-effort transcript supplements, matched by title/prompt rather than session identity. */
  return async function read(agents: AgentView[], now: number): Promise<Map<string, Insight>> {
    const insights = new Map<string, Insight>()
    const claudes = agents.filter(
      (agent) => agent.workspaceId && (agent.agent ?? 'claude') === 'claude'
    )
    for (const workspace of new Set(claudes.map((agent) => agent.workspaceId as string))) {
      const here = claudes.filter((agent) => agent.workspaceId === workspace)
      const digests = await inWorkspace(workspace, now).catch(() => [])
      // This can match supplementary lists but not session metrics: titles and prompts are not
      // provider-session identity, and paneKey has no such meaning in Orca's API contract.
      const supplementary = assign(here, digests)
      for (const agent of here) {
        const found = supplementary.get(agent.id)
        if (!found) continue
        insights.set(agent.id, supplementaryInsight(found))
      }
    }
    return insights
  }
}
