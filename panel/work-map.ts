import type { AgentView, JournalEvent } from '../src/protocol'

export function taskLabel(agent: AgentView): string {
  if (agent.title?.trim()) return agent.title.trim()
  if (agent.prompt?.trim()) return `Asked excerpt: ${agent.prompt.trim()}`
  return 'Task not reported'
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
