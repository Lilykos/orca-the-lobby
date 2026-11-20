import { overdue, type AgentState, type AgentView, type Prefs } from './protocol'

/** A turn shorter than this ends without a notification: you were probably watching. */
export const LONG_TURN_MS = 60_000

export type NotificationMessage = { title: string; body?: string }
export type NotificationPrefs = Pick<Prefs, 'notifyBlocked' | 'notifyDone'>
export type PreviousNotificationState = { state: AgentState; since: number }
export type TransitionNotificationAgent = {
  state: AgentState
  stateStartedAt: number
  name: string
  title: string | null
  outcome: string | null
}

/** Decide whether an observed state change merits a transition notification. */
export function transitionNotification(
  previous: PreviousNotificationState | undefined,
  current: TransitionNotificationAgent,
  prefs: NotificationPrefs
): NotificationMessage | null {
  if (!previous || previous.state === current.state) return null
  if (current.state === 'blocked' && prefs.notifyBlocked) {
    return { title: `${current.name} needs you`, body: current.title ?? undefined }
  }
  const long = current.stateStartedAt - previous.since > LONG_TURN_MS
  if (current.state === 'done' && previous.state === 'working' && long && prefs.notifyDone) {
    return { title: `${current.name} ${current.outcome === 'failure' ? 'failed' : 'finished'}`, body: current.title ?? undefined }
  }
  return null
}

export type ReminderAgent = Pick<AgentView, 'state' | 'lastSeenAt' | 'stateStartedAt' | 'title'> & { name: string }
export type ReminderDecision = { spell: string; notification: NotificationMessage }

/** Decide whether a quiet or blocked agent deserves its one reminder for this quiet spell. */
export function reminderNotification(
  agent: ReminderAgent,
  now: number,
  stuckMinutes: number,
  lastSpell: string | undefined
): ReminderDecision | null {
  const late = overdue(agent, now, stuckMinutes)
  if (!late) return null
  const spell = `${late.kind}:${late.since}`
  if (lastSpell === spell) return null
  const minutes = Math.floor((now - late.since) / 60_000)
  return {
    spell,
    notification: {
      title: late.kind === 'quiet' ? `${agent.name} may be stuck` : `${agent.name} still needs you`,
      body: `${late.kind === 'quiet' ? 'No activity seen' : 'Waiting on you'} for ${minutes} min${agent.title ? ` · ${agent.title}` : ''}`
    }
  }
}

export type ReminderSnooze = { episodeId: string; expiresAt: number | null; setAt: number }
export type HandledTransition = { episodeId: string; transitionId: string }
export type NotificationPolicy = {
  mutedProjects: string[]
  reminderSnoozes: ReminderSnooze[]
  /** Transition identities consumed at queue time, including candidates suppressed by mute. */
  handledTransitions: HandledTransition[]
}

export type SnoozeChoice = '15m' | '1h' | 'manual' | 'resume'
export const GROUP_WINDOW_MS = 2_000
const MAX_ID_LENGTH = 256
const MAX_MUTED_PROJECTS = 200
const MAX_REMINDER_SNOOZES = 500
const MAX_HANDLED_TRANSITIONS = 1_000

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** A bounded, restart-safe view of the controls persisted by a later worker integration. */
export function readNotificationPolicy(value: unknown, now: number): NotificationPolicy {
  const stored = object(value)
  if (!stored || !Number.isFinite(now) || now < 0) return emptyNotificationPolicy()

  const mutedProjects = Array.isArray(stored.mutedProjects)
    ? [...new Set(stored.mutedProjects.slice(0, MAX_MUTED_PROJECTS * 4).filter(validId))].sort(compareText).slice(0, MAX_MUTED_PROJECTS)
    : []

  const snoozes = new Map<string, ReminderSnooze>()
  if (Array.isArray(stored.reminderSnoozes)) {
    for (const value of stored.reminderSnoozes.slice(-MAX_REMINDER_SNOOZES * 2)) {
      const entry = object(value)
      if (!entry || !validId(entry.episodeId) || !Number.isFinite(entry.setAt) || (entry.setAt as number) < 0 || (entry.setAt as number) > now) continue
      const expiresAt = entry.expiresAt
      if (expiresAt !== null && (!Number.isFinite(expiresAt) || (expiresAt as number) <= now || (expiresAt as number) <= (entry.setAt as number))) continue
      const parsed = { episodeId: entry.episodeId, expiresAt: expiresAt as number | null, setAt: entry.setAt as number }
      const previous = snoozes.get(parsed.episodeId)
      if (!previous || parsed.setAt > previous.setAt) snoozes.set(parsed.episodeId, parsed)
    }
  }
  const reminderSnoozes = [...snoozes.values()]
    .sort((a, b) => b.setAt - a.setAt || compareText(a.episodeId, b.episodeId))
    .slice(0, MAX_REMINDER_SNOOZES)
    .sort((a, b) => compareText(a.episodeId, b.episodeId))

  const handledTransitions: HandledTransition[] = []
  if (Array.isArray(stored.handledTransitions)) {
    for (const value of stored.handledTransitions.slice(-MAX_HANDLED_TRANSITIONS * 4)) {
      const entry = object(value)
      if (!entry || !validId(entry.episodeId) || !validId(entry.transitionId)) continue
      const identity = { episodeId: entry.episodeId, transitionId: entry.transitionId }
      if (handledTransitions.some((prior) => sameTransition(prior, identity))) continue
      handledTransitions.push(identity)
    }
  }
  if (handledTransitions.length > MAX_HANDLED_TRANSITIONS) handledTransitions.splice(0, handledTransitions.length - MAX_HANDLED_TRANSITIONS)
  return { mutedProjects, reminderSnoozes, handledTransitions }
}

export function emptyNotificationPolicy(): NotificationPolicy {
  return { mutedProjects: [], reminderSnoozes: [], handledTransitions: [] }
}

export function setProjectMuted(policy: NotificationPolicy, projectId: string, muted: boolean): NotificationPolicy {
  if (!validId(projectId)) return policy
  const projects = new Set(policy.mutedProjects)
  if (muted) {
    if (!projects.has(projectId) && projects.size >= MAX_MUTED_PROJECTS) return policy
    projects.add(projectId)
  }
  else projects.delete(projectId)
  return { ...policy, mutedProjects: [...projects].sort(compareText).slice(0, MAX_MUTED_PROJECTS) }
}

export function isProjectMuted(policy: NotificationPolicy, projectId: string): boolean {
  return policy.mutedProjects.includes(projectId)
}

export function setReminderSnooze(
  policy: NotificationPolicy,
  episodeId: string,
  now: number,
  choice: SnoozeChoice
): NotificationPolicy {
  if (!validId(episodeId) || !Number.isFinite(now) || now < 0 || !['15m', '1h', 'manual', 'resume'].includes(choice)) return policy
  const reminderSnoozes = policy.reminderSnoozes.filter((entry) => entry.episodeId !== episodeId)
  if (choice !== 'resume') {
    const expiresAt = choice === '15m' ? now + 15 * 60_000 : choice === '1h' ? now + 60 * 60_000 : null
    reminderSnoozes.push({ episodeId, expiresAt, setAt: now })
  }
  return {
    ...policy,
    reminderSnoozes: reminderSnoozes
      .sort((a, b) => b.setAt - a.setAt || compareText(a.episodeId, b.episodeId))
      .slice(0, MAX_REMINDER_SNOOZES)
      .sort((a, b) => compareText(a.episodeId, b.episodeId))
  }
}

export function isReminderSnoozed(policy: NotificationPolicy, episodeId: string, now: number): boolean {
  const snooze = policy.reminderSnoozes.find((entry) => entry.episodeId === episodeId)
  return !!snooze && (snooze.expiresAt === null || now < snooze.expiresAt)
}

export type TransitionCandidate = {
  /** Stable source transition id; combine with episodeId so a later turn is always distinct. */
  transitionId: string
  episodeId: string
  projectId: string
  projectName: string
  kind: 'blocked' | 'finished' | 'failed'
  agentName: string
  notification: NotificationMessage
}
export type PendingTransitionGroup = {
  projectId: string
  projectName: string
  kind: TransitionCandidate['kind']
  firstAt: number
  deadline: number
  candidates: TransitionCandidate[]
}
export type NotificationQueue = { pending: PendingTransitionGroup[] }
export type QueueResult = { queue: NotificationQueue; policy: NotificationPolicy; notifications: NotificationMessage[] }

export function emptyNotificationQueue(): NotificationQueue {
  return { pending: [] }
}

function sameTransition(a: HandledTransition, b: HandledTransition): boolean {
  return a.episodeId === b.episodeId && a.transitionId === b.transitionId
}

function transitionIdentity(candidate: TransitionCandidate): HandledTransition {
  return { episodeId: candidate.episodeId, transitionId: candidate.transitionId }
}

function validCandidate(candidate: TransitionCandidate): boolean {
  return validId(candidate.episodeId) && validId(candidate.transitionId) && validId(candidate.projectId) &&
    (candidate.kind === 'blocked' || candidate.kind === 'finished' || candidate.kind === 'failed') &&
    typeof candidate.projectName === 'string' && typeof candidate.agentName === 'string' &&
    typeof candidate.notification?.title === 'string' && candidate.notification.title.length > 0
}

function groupKey(a: Pick<PendingTransitionGroup, 'projectId' | 'kind'>, b: Pick<TransitionCandidate, 'projectId' | 'kind'>): boolean {
  return a.projectId === b.projectId && a.kind === b.kind
}

function summarize(group: PendingTransitionGroup): NotificationMessage {
  const candidates = [...group.candidates].sort((a, b) => compareText(a.agentName, b.agentName) ||
    compareText(a.episodeId, b.episodeId) || compareText(a.transitionId, b.transitionId))
  const count = candidates.length
  const verb = group.kind === 'blocked' ? 'need you' : group.kind
  return count === 1
    ? candidates[0].notification
    : {
        title: `${count} agents ${verb}`,
        body: `${group.projectName || group.projectId} · ${candidates.map(({ agentName }) => agentName).join(', ')}`
      }
}

/** Flush only elapsed groups, rechecking mute with current controls; pending groups are never persisted. */
export function flushTransitionQueue(queue: NotificationQueue, policy: NotificationPolicy, now: number): QueueResult {
  const due = queue.pending.filter((group) => group.deadline <= now)
    .sort((a, b) => a.deadline - b.deadline || compareText(a.projectId, b.projectId) || compareText(a.kind, b.kind))
  const notifications = due
    .filter((group) => !policy.mutedProjects.includes(group.projectId))
    .map(summarize)
  const dueGroups = new Set(due)
  return {
    queue: { pending: queue.pending.filter((group) => !dueGroups.has(group)) },
    policy,
    notifications
  }
}

/** Adds one eligible transition, deduplicates it, and starts a non-extending project/kind window. */
export function queueTransition(
  queue: NotificationQueue,
  policy: NotificationPolicy,
  candidate: TransitionCandidate,
  now: number
): QueueResult {
  const elapsed = flushTransitionQueue(queue, policy, now)
  if (!validCandidate(candidate) || !Number.isFinite(now) || now < 0) return elapsed
  const identity = transitionIdentity(candidate)
  if (elapsed.policy.handledTransitions.some((prior) => sameTransition(prior, identity)) ||
      elapsed.queue.pending.some((group) => group.candidates.some((prior) => sameTransition(transitionIdentity(prior), identity)))) return elapsed
  const nextPolicy = {
    ...elapsed.policy,
    handledTransitions: [...elapsed.policy.handledTransitions, identity].slice(-MAX_HANDLED_TRANSITIONS)
  }
  if (elapsed.policy.mutedProjects.includes(candidate.projectId)) return { ...elapsed, policy: nextPolicy }

  const pending = [...elapsed.queue.pending]
  const index = pending.findIndex((group) => groupKey(group, candidate))
  if (index < 0) {
    pending.push({
      projectId: candidate.projectId,
      projectName: candidate.projectName,
      kind: candidate.kind,
      firstAt: now,
      deadline: now + GROUP_WINDOW_MS,
      candidates: [candidate]
    })
  } else {
    pending[index] = { ...pending[index], candidates: [...pending[index].candidates, candidate] }
  }
  pending.sort((a, b) => a.firstAt - b.firstAt || compareText(a.projectId, b.projectId) || compareText(a.kind, b.kind))
  return { ...elapsed, queue: { pending }, policy: nextPolicy }
}
