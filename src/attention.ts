import type { AgentView } from './protocol'

export const REVIEWED_RETENTION_MS = 24 * 60 * 60 * 1000
export const REVIEWED_LIMIT = 500
const COMPLETION_KEY = /^[a-f0-9]{64}$/

export type AttentionGroups = {
  needsInput: AgentView[]
  failedToReview: AgentView[]
  finishedToReview: AgentView[]
}

export type ReviewedState = { version: 1; entries: Record<string, number> }
export const isCompletionId = (value: unknown): value is string => typeof value === 'string' && COMPLETION_KEY.test(value)

/** The current live roster as a work queue; known non-completions stay out. */
export function attentionGroups(agents: AgentView[], reviewed: Set<string>): AttentionGroups {
  const needsInput = agents.filter((agent) => agent.state === 'blocked')
    .sort((a, b) => a.stateStartedAt - b.stateStartedAt || a.id.localeCompare(b.id))
  const failedToReview: AgentView[] = []
  const finishedToReview: AgentView[] = []
  for (const agent of agents) {
    const outcome = agent.outcome?.toLowerCase()
    if (agent.state !== 'done' || ['cancellation', 'cancelled', 'canceled', 'cancel', 'interruption', 'interrupted', 'unconfirmed', 'superseded'].includes(outcome ?? '') || !agent.completionId || reviewed.has(agent.completionId)) continue
    if (agent.outcome === 'failure') failedToReview.push(agent)
    else if (agent.unread || agent.completionTracked) finishedToReview.push(agent)
  }
  const newestFirst = (a: AgentView, b: AgentView): number =>
    (b.finishedAt ?? b.stateStartedAt) - (a.finishedAt ?? a.stateStartedAt) ||
    a.completionId!.localeCompare(b.completionId!)
  failedToReview.sort(newestFirst)
  finishedToReview.sort(newestFirst)
  return { needsInput, failedToReview, finishedToReview }
}

/** Parse and prune persisted state. Keys are SHA-256 completion ids; values are absolute times. */
export function readReviewed(value: unknown, now: number): ReviewedState {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) {
    return { version: 1, entries: {} }
  }
  const source = (value as { entries?: unknown }).entries
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { version: 1, entries: {} }
  const entries = Object.entries(source as Record<string, unknown>)
    .filter(([key, at]) => COMPLETION_KEY.test(key) && typeof at === 'number' && Number.isFinite(at) && at > now - REVIEWED_RETENTION_MS)
    .sort(([keyA, atA], [keyB, atB]) => (atB as number) - (atA as number) || keyA.localeCompare(keyB))
    .slice(0, REVIEWED_LIMIT)
  const kept = Object.fromEntries(entries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB))) as Record<string, number>
  return { version: 1, entries: kept }
}

/** Builds a fresh set; callers persist it before replacing worker state. */
export function reviewedState(current: Set<string>, now: number, previous?: ReviewedState): ReviewedState {
  const entries: Record<string, number> = { ...(previous?.entries ?? {}) }
  for (const key of current) if (!(key in entries)) entries[key] = now
  return readReviewed({ version: 1, entries }, now)
}
