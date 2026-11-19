import type { AgentView, JournalEvent } from '../src/protocol'

export const PINNED_AGENTS_KEY = 'pinned-agent-ids'
export const PINNED_ROOM_ID = 'lobby:pinned-agents'
export const PINNED_ROOM_NAME = '★ Employees of the month ★'

export function readPinnedAgents(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : [])
}

export function taskLabel(agent: AgentView): string {
  if (agent.title?.trim()) return agent.title.trim()
  if (agent.prompt?.trim()) return `Asked excerpt: ${agent.prompt.trim()}`
  return 'Task not reported'
}

const providerTitleSuffixes: Record<string, readonly string[]> = {
  claude: ['claude code', 'claude'],
  codex: ['openai codex', 'codex'],
  copilot: ['github copilot', 'copilot'],
  cursor: ['cursor'],
  gemini: ['google gemini', 'gemini'],
  opencode: ['open code', 'opencode']
}

export function pinnedTaskLabel(agent: AgentView): string {
  const title = taskLabel(agent)
  if (!agent.title?.trim()) return title
  const match = /\s+[-–—]\s+([^–—-]+)$/.exec(title)
  const suffixes = providerTitleSuffixes[agent.agent?.toLowerCase() ?? '']
  return match && suffixes?.includes(match[1].trim().toLowerCase())
    ? title.slice(0, match.index).trimEnd()
    : title
}

export function pinnedIdentityLabel(project: string, worktree: string, agent: string): string {
  const projectName = project.trim()
  const worktreeName = worktree.trim()
  const agentName = agent.trim()
  const context = projectName && projectName !== worktreeName
    ? [projectName, worktreeName].filter(Boolean).join(' · ')
    : projectName || worktreeName
  return context ? `${context} · ${agentName}` : agentName
}

export function projectGroups(agents: readonly AgentView[]): { id: string; agents: AgentView[] }[] {
  const groups = new Map<string, AgentView[]>()
  for (const agent of agents) {
    const id = agent.projectId ?? agent.workspaceId ?? ''
    const members = groups.get(id) ?? []
    members.push(agent)
    groups.set(id, members)
  }
  return [...groups].map(([id, members]) => ({ id, agents: members }))
}

/** Projects in the order the person chose, then as Orca's sidebar lists them, then by name; the
 *  room for agents with no project comes last. */
export function orderProjects(
  ids: readonly string[],
  nameOf: (id: string) => string,
  sidebar: Readonly<Record<string, number>> = {},
  chosen: readonly string[] = []
): string[] {
  const rank = (id: string): [number, number] => {
    if (!id) return [3, 0]
    if (chosen.includes(id)) return [0, chosen.indexOf(id)]
    return id in sidebar ? [1, sidebar[id]] : [2, 0]
  }
  return [...ids].sort((a, b) => {
    const [ga, ia] = rank(a)
    const [gb, ib] = rank(b)
    return ga - gb || ia - ib || nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b)
  })
}

/** The order after moving one project a step up (-1) or down (1); unchanged at either end. */
export function moveProject(order: readonly string[], id: string, step: -1 | 1): string[] {
  const next = [...order]
  const from = next.indexOf(id)
  const to = from + step
  if (from < 0 || to < 0 || to >= next.length || !next[to]) return next
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export type EventCursor = { at: number; ids: string[] }
type TimedEvent = { id: string; observedAt: number }

export function sinceCursor<T extends TimedEvent>(events: readonly T[], cursor: EventCursor | undefined): T[] {
  if (!cursor) return [...events]
  return events.filter((event) => event.observedAt > cursor.at || (event.observedAt === cursor.at && !cursor.ids.includes(event.id)))
}

export function cursorFor(events: readonly TimedEvent[]): EventCursor | undefined {
  if (!events.length) return undefined
  const at = Math.max(...events.map((event) => event.observedAt))
  return { at, ids: events.filter((event) => event.observedAt === at).map((event) => event.id) }
}

/** Groups adjacent matching calls without changing or merging the stored observations. */
export function groupToolEvents(events: readonly JournalEvent[]): JournalEvent[][] {
  const groups: JournalEvent[][] = []
  for (const event of events) {
    const group = groups.at(-1)
    const previous = group?.at(-1)
    if (previous && previous.kind === 'tool' && event.kind === 'tool' && previous.agentId === event.agentId && previous.tool === event.tool && previous.detail === event.detail && previous.source === event.source) group!.push(event)
    else groups.push([event])
  }
  return groups
}
