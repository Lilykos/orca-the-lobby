import type { AgentState } from '../src/protocol'

export function toggleActivityPanel(expanded: readonly string[], agentId: string): string[] {
  return expanded.includes(agentId)
    ? expanded.filter((id) => id !== agentId)
    : [...expanded, agentId]
}

export function navigateToActivityPanel(
  expanded: readonly string[],
  agentId: string
): { expanded: string[]; focusTarget: string } {
  return {
    expanded: expanded.includes(agentId) ? [...expanded] : [...expanded, agentId],
    focusTarget: agentId
  }
}

export function retainActivityPanels(
  expanded: readonly string[],
  agentIds: readonly string[]
): string[] {
  const live = new Set(agentIds)
  return expanded.filter((id) => live.has(id))
}

export function focusTarget<T>(
  items: readonly { key: string; target: T }[],
  key: string | undefined
): T | undefined {
  return key === undefined ? undefined : items.find((item) => item.key === key)?.target
}

export function viewActivityFocusKey(agentId: string): string {
  return `office-view-activity:${agentId}`
}

export function modelOrAgentLabel(
  model: string | null,
  agentType: string | null
): { text: string; title: string } {
  if (model) return { text: model, title: `Model: ${model}` }
  if (agentType) return { text: `${agentType[0].toUpperCase()}${agentType.slice(1)}`, title: `Agent type: ${agentType}` }
  return { text: '', title: '' }
}

export type StatusTone = AgentState | 'failed' | 'unread' | 'outcome'

export function stateLabel(state: AgentState): string {
  return state === 'blocked' ? 'needs you' : state
}

export function currentStatus(
  state: AgentState,
  outcome: string | null,
  unread: boolean
): { label: string; tone: StatusTone } {
  if (state === 'done' && unread && (!outcome || outcome === 'success'))
    return { label: 'done · new', tone: 'unread' }
  if (state !== 'done' || !outcome || outcome === 'success')
    return {
      label: stateLabel(state),
      tone: state
    }
  if (outcome === 'failure') return { label: 'failed', tone: 'failed' }
  return { label: outcome, tone: 'outcome' }
}

export function activityTimeText(
  state: AgentState,
  stateStartedAt: number,
  finishedAt: number | null,
  now: number,
  duration: (from: number, now: number) => string,
  clock: (at: number) => string,
  finishedAtSource?: 'source' | 'observed' | 'unknown' | null
): string {
  if (state === 'done') {
    if (typeof finishedAt !== 'number' || !Number.isFinite(finishedAt)) return 'Done: time unavailable'
    const label = finishedAtSource === 'source' ? 'Finished at' : finishedAtSource === 'observed' ? 'Done observed at' : 'Done time recorded at'
    return `${label}: ${clock(finishedAt)}`
  }
  const label = state === 'working' ? 'Working for' : state === 'blocked' ? 'Needs you for' : 'Waiting for'
  return Number.isFinite(stateStartedAt)
    ? `${label}: ${duration(stateStartedAt, now)}`
    : `${label}: time unavailable`
}

export function tabTargetIndex(index: number, key: string, count: number): number | null {
  if (!count) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0
  return delta ? (index + delta + count) % count : null
}

export function shouldRefreshOffice(previousPage: string, nextPage: string): boolean {
  return previousPage !== 'office' && nextPage === 'office'
}

export function shouldRenderOfficeFrame(page: string): boolean {
  return page === 'office'
}

export function timeRefreshBucket(now: number): number {
  return Math.floor(now / 1000)
}

/** Keep keyboard focus through redraws without pulling the viewport back to that control. */
export function restoreFocus(target: { focus(options?: FocusOptions): void } | undefined): void {
  target?.focus({ preventScroll: true })
}

/** How many agents are working, need you, finished, and failed. Waiting agents are in none. */
export function agentCounts(agents: { state: AgentState; outcome: string | null }[]): { working: number; needsYou: number; done: number; failed: number } {
  const counts = { working: 0, needsYou: 0, done: 0, failed: 0 }
  for (const agent of agents) {
    if (agent.state === 'working') counts.working += 1
    else if (agent.state === 'blocked') counts.needsYou += 1
    else if (agent.state === 'done') counts[agent.outcome === 'failure' ? 'failed' : 'done'] += 1
  }
  return counts
}
