import { overdue, type AgentState, type AgentView, type Prefs } from './protocol'
import { jsonBytes, STORE_BYTES } from './office'

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
export type HandledTransition = { kind: 'transition' | 'reminder'; episodeId: string; transitionId: string; consumedAt: number }
export type NotificationPolicy = {
  mutedProjects: string[]
  reminderSnoozes: ReminderSnooze[]
  /** Transition identities consumed at queue time, including candidates suppressed by mute. */
  handledTransitions: HandledTransition[]
}

export type SnoozeChoice = '15m' | '1h' | 'manual' | 'resume'
export type SnoozeUpdateResult =
  | { ok: true; policy: NotificationPolicy }
  | { ok: false; policy: NotificationPolicy; error: 'invalid-update' | 'snooze-limit' | 'policy-too-large' }
export type MuteUpdateResult =
  | { ok: true; policy: NotificationPolicy }
  | { ok: false; policy: NotificationPolicy; error: 'invalid-update' | 'mute-limit' | 'policy-too-large' }
export const GROUP_WINDOW_MS = 2_000
/** Persist consumed transition identities for one day, matching the activity horizon. */
export const TRANSITION_IDENTITY_RETENTION_MS = 24 * 60 * 60_000
const MAX_ID_LENGTH = 256
const MAX_MUTED_PROJECTS = 200
const MAX_REMINDER_SNOOZES = 500
const MAX_HANDLED_TRANSITIONS = 1_000
export const MAX_PENDING_GROUPS = 500
export const MAX_GROUP_CANDIDATES = 500
export const MAX_NOTIFICATION_BYTES = STORE_BYTES

export class NotificationPolicyRestoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotificationPolicyRestoreError'
  }
}

function restoreError(reason: string): never {
  throw new NotificationPolicyRestoreError(`notification policy restore failed: ${reason}`)
}

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

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined
}

function copyNotificationPolicy(policy: NotificationPolicy): NotificationPolicy {
  return {
    mutedProjects: [...policy.mutedProjects],
    reminderSnoozes: policy.reminderSnoozes.map((entry) => ({ ...entry })),
    handledTransitions: policy.handledTransitions.map((entry) => ({ ...entry }))
  }
}

/**
 * A bounded, restart-safe view of persisted controls. Throws when live controls exceed count or byte limits;
 * callers must surface that restore error instead of saving a partial policy.
 */
export function readNotificationPolicy(value: unknown, now: number): NotificationPolicy {
  if (value === null || value === undefined) return emptyNotificationPolicy()
  if (!Number.isFinite(now) || now < 0) restoreError('invalid restore time')
  const stored = object(value)
  if (!stored) restoreError('stored policy is not an object')

  const mutedValue = own(stored, 'mutedProjects')
  const snoozeValue = own(stored, 'reminderSnoozes')
  const handledValue = own(stored, 'handledTransitions')
  if (!Array.isArray(mutedValue) || !Array.isArray(snoozeValue) || !Array.isArray(handledValue)) {
    restoreError('required control arrays are missing or malformed')
  }
  const muted = new Set<string>()
  for (const projectId of mutedValue) {
    if (!validId(projectId)) restoreError('a project mute has an invalid identifier')
    muted.add(projectId)
  }
  const mutedProjects = [...muted].sort(compareText)
  if (mutedProjects.length > MAX_MUTED_PROJECTS) restoreError('project mute limit exceeded')

  const snoozes = new Map<string, ReminderSnooze>()
  for (const value of snoozeValue) {
    const entry = object(value)
    if (!entry) restoreError('a reminder snooze is not an object')
    const episodeId = own(entry, 'episodeId')
    const setAt = own(entry, 'setAt')
    const expiresAt = own(entry, 'expiresAt')
    if (!validId(episodeId) || !Number.isFinite(setAt) || (setAt as number) < 0 || (setAt as number) > now || expiresAt === undefined) {
      restoreError('a reminder snooze has invalid identity or timestamps')
    }
    if (expiresAt !== null && (!Number.isFinite(expiresAt) ||
        ((expiresAt as number) !== (setAt as number) + 15 * 60_000 &&
         (expiresAt as number) !== (setAt as number) + 60 * 60_000))) {
      restoreError('a reminder snooze has an unsupported expiry')
    }
    if (expiresAt !== null && (expiresAt as number) <= now) continue
    const parsed = { episodeId, expiresAt: expiresAt as number | null, setAt: setAt as number }
    const previous = snoozes.get(parsed.episodeId)
    if (!previous || parsed.setAt > previous.setAt) snoozes.set(parsed.episodeId, parsed)
  }
  if (snoozes.size > MAX_REMINDER_SNOOZES) restoreError('reminder snooze limit exceeded')
  const reminderSnoozes = [...snoozes.values()].sort((a, b) => compareText(a.episodeId, b.episodeId))

  const handledTransitions: HandledTransition[] = []
  for (const value of handledValue) {
    const entry = object(value)
    if (!entry) restoreError('a handled transition is not an object')
    const episodeId = own(entry, 'episodeId')
    const transitionId = own(entry, 'transitionId')
    const kind = own(entry, 'kind')
    const consumedAt = own(entry, 'consumedAt')
    if ((kind !== 'transition' && kind !== 'reminder') || !validId(episodeId) || !validId(transitionId)) {
      restoreError('a handled notification has an invalid identity')
    }
    if (!Number.isFinite(consumedAt) || (consumedAt as number) < 0 || (consumedAt as number) > now) {
      restoreError('a handled notification has an invalid observation time')
    }
    if (now - (consumedAt as number) >= TRANSITION_IDENTITY_RETENTION_MS) continue
    const identity: HandledTransition = { kind, episodeId, transitionId, consumedAt: consumedAt as number }
    const priorIndex = handledTransitions.findIndex((prior) => sameTransition(prior, identity))
    if (priorIndex >= 0) {
      if (identity.consumedAt > handledTransitions[priorIndex].consumedAt) handledTransitions[priorIndex] = identity
      continue
    }
    handledTransitions.push(identity)
  }
  handledTransitions.sort((a, b) => a.consumedAt - b.consumedAt || compareText(a.episodeId, b.episodeId) || compareText(a.transitionId, b.transitionId))
  if (handledTransitions.length > MAX_HANDLED_TRANSITIONS) restoreError('handled transition limit exceeded')
  const policy = { mutedProjects, reminderSnoozes, handledTransitions }
  if (jsonBytes(policy) > STORE_BYTES) restoreError('serialized policy exceeds the storage byte limit')
  return policy
}

export function emptyNotificationPolicy(): NotificationPolicy {
  return { mutedProjects: [], reminderSnoozes: [], handledTransitions: [] }
}

export function setProjectMuted(policy: NotificationPolicy, projectId: string, muted: boolean, now: number): MuteUpdateResult {
  if (!validId(projectId) || !Number.isFinite(now) || now < 0) return { ok: false, policy: copyNotificationPolicy(policy), error: 'invalid-update' }
  const projects = new Set(policy.mutedProjects)
  if (muted) {
    if (!projects.has(projectId) && projects.size >= MAX_MUTED_PROJECTS) return { ok: false, policy: copyNotificationPolicy(policy), error: 'mute-limit' }
    projects.add(projectId)
  }
  else projects.delete(projectId)
  const next = pruneHandledTransitions({ ...policy, mutedProjects: [...projects].sort(compareText) }, now)
  if (jsonBytes(next) > STORE_BYTES) return { ok: false, policy: copyNotificationPolicy(policy), error: 'policy-too-large' }
  return { ok: true, policy: next }
}

export function isProjectMuted(policy: NotificationPolicy, projectId: string): boolean {
  return policy.mutedProjects.includes(projectId)
}

export function setReminderSnooze(
  policy: NotificationPolicy,
  episodeId: string,
  now: number,
  choice: SnoozeChoice
): SnoozeUpdateResult {
  if (!validId(episodeId) || !Number.isFinite(now) || now < 0 || !['15m', '1h', 'manual', 'resume'].includes(choice)) {
    return { ok: false, policy: copyNotificationPolicy(policy), error: 'invalid-update' }
  }
  const reminderSnoozes = policy.reminderSnoozes.map((entry) => ({ ...entry })).filter((entry) =>
    entry.expiresAt === null || entry.expiresAt > now
  )
  const existing = reminderSnoozes.some((entry) => entry.episodeId === episodeId)
  const withoutEpisode = reminderSnoozes.filter((entry) => entry.episodeId !== episodeId)
  if (choice !== 'resume' && !existing && withoutEpisode.length >= MAX_REMINDER_SNOOZES) {
    return { ok: false, policy: copyNotificationPolicy(policy), error: 'snooze-limit' }
  }
  if (choice === 'resume') {
    const next = pruneHandledTransitions({ ...policy, reminderSnoozes: withoutEpisode }, now)
    if (jsonBytes(next) > STORE_BYTES) return { ok: false, policy: copyNotificationPolicy(policy), error: 'policy-too-large' }
    return { ok: true, policy: next }
  }
  const expiresAt = choice === '15m' ? now + 15 * 60_000 : choice === '1h' ? now + 60 * 60_000 : null
  const nextSnoozes = [...withoutEpisode, { episodeId, expiresAt, setAt: now }]
  if (nextSnoozes.length > MAX_REMINDER_SNOOZES) return { ok: false, policy: copyNotificationPolicy(policy), error: 'snooze-limit' }
  const next = pruneHandledTransitions({
    ...policy,
    reminderSnoozes: nextSnoozes.sort((a, b) => compareText(a.episodeId, b.episodeId))
  }, now)
  if (jsonBytes(next) > STORE_BYTES) return { ok: false, policy: copyNotificationPolicy(policy), error: 'policy-too-large' }
  return { ok: true, policy: next }
}

export function isReminderSnoozed(policy: NotificationPolicy, episodeId: string, now: number): boolean {
  const snooze = policy.reminderSnoozes.find((entry) => entry.episodeId === episodeId)
  return !!snooze && (snooze.expiresAt === null || now < snooze.expiresAt)
}

export type ReminderReceiptResult =
  | { ok: true; policy: NotificationPolicy; alreadyRecorded: boolean }
  | { ok: false; policy: NotificationPolicy; error: 'invalid-update' | 'notification-limit' | 'policy-too-large' }

export function hasReminderReceipt(policy: NotificationPolicy, episodeId: string, spell: string): boolean {
  return policy.handledTransitions.some((entry) =>
    entry.kind === 'reminder' && entry.episodeId === episodeId && entry.transitionId === spell
  )
}

/** Records a delivered or deliberately dismissed reminder spell so restart/resume cannot catch it up. */
export function recordReminderReceipt(
  policy: NotificationPolicy,
  episodeId: string,
  spell: string,
  now: number
): ReminderReceiptResult {
  if (!validId(episodeId) || !validId(spell) || !Number.isFinite(now) || now < 0) {
    return { ok: false, policy: copyNotificationPolicy(policy), error: 'invalid-update' }
  }
  const next = pruneHandledTransitions(policy, now)
  const identity: NotificationIdentity = { kind: 'reminder', episodeId, transitionId: spell }
  if (next.handledTransitions.some((entry) => sameTransition(entry, identity))) {
    return { ok: true, policy: next, alreadyRecorded: true }
  }
  if (next.handledTransitions.length >= MAX_HANDLED_TRANSITIONS) {
    return { ok: false, policy: copyNotificationPolicy(policy), error: 'notification-limit' }
  }
  const recorded = {
    ...next,
    handledTransitions: [...next.handledTransitions, { ...identity, consumedAt: now }]
  }
  if (jsonBytes(recorded) > STORE_BYTES) return { ok: false, policy: copyNotificationPolicy(policy), error: 'policy-too-large' }
  return { ok: true, policy: recorded, alreadyRecorded: false }
}

export type TransitionCandidate = {
  /** Stable source transition id; combine with episodeId so a later turn is always distinct. */
  transitionId: string
  episodeId: string
  /** Captured once when this actual state transition is first observed; retries reuse this time. */
  readonly observedAt: number
  projectId: string
  projectName: string
  kind: 'blocked' | 'finished' | 'failed'
  agentName: string
  notification: NotificationMessage
}

export type TransitionSourceIdentity = Pick<TransitionCandidate, 'transitionId' | 'episodeId' | 'projectId' | 'projectName'>

/** Build an enqueueable event only from a real previous/current state transition. */
export function notificationForTransition(
  previous: PreviousNotificationState | undefined,
  current: TransitionNotificationAgent,
  prefs: NotificationPrefs,
  identity: TransitionSourceIdentity,
  observedAt: number
): TransitionCandidate | null {
  const notification = transitionNotification(previous, current, prefs)
  if (!notification) return null
  const kind: TransitionCandidate['kind'] = current.state === 'blocked'
    ? 'blocked'
    : current.outcome === 'failure' ? 'failed' : 'finished'
  return {
    ...identity,
    observedAt,
    kind,
    agentName: current.name,
    notification: { ...notification }
  }
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
export type QueueRefusal = { reason: 'invalid-candidate' | 'stale-candidate' | 'identity-not-consumed' | 'candidate-too-large' | 'pending-queue-full' | 'group-candidate-limit' | 'notification-too-large' | 'handled-identity-limit' | 'policy-too-large' }
export type QueueResult = { queue: NotificationQueue; policy: NotificationPolicy; notifications: NotificationMessage[]; refusals: QueueRefusal[] }

export function emptyNotificationQueue(): NotificationQueue {
  return { pending: [] }
}

type NotificationIdentity = Pick<HandledTransition, 'kind' | 'episodeId' | 'transitionId'>

function sameTransition(a: NotificationIdentity, b: NotificationIdentity): boolean {
  return a.kind === b.kind && a.episodeId === b.episodeId && a.transitionId === b.transitionId
}

function copyCandidate(candidate: TransitionCandidate): TransitionCandidate {
  return {
    transitionId: candidate.transitionId,
    episodeId: candidate.episodeId,
    observedAt: candidate.observedAt,
    projectId: candidate.projectId,
    projectName: candidate.projectName,
    kind: candidate.kind,
    agentName: candidate.agentName,
    notification: { ...candidate.notification }
  }
}

function copyQueue(queue: NotificationQueue): NotificationQueue {
  return {
    pending: queue.pending.map((group) => ({
      ...group,
      candidates: group.candidates.map(copyCandidate)
    }))
  }
}

function pruneHandledTransitions(policy: NotificationPolicy, now: number): NotificationPolicy {
  return {
    ...copyNotificationPolicy(policy),
    handledTransitions: policy.handledTransitions.filter((entry) =>
      Number.isFinite(entry.consumedAt) && entry.consumedAt <= now && now - entry.consumedAt < TRANSITION_IDENTITY_RETENTION_MS
    ).map((entry) => ({ ...entry }))
  }
}

function transitionIdentity(candidate: TransitionCandidate): NotificationIdentity {
  return { kind: 'transition', episodeId: candidate.episodeId, transitionId: candidate.transitionId }
}

function validCandidate(candidate: TransitionCandidate): boolean {
  return validId(candidate.episodeId) && validId(candidate.transitionId) && validId(candidate.projectId) &&
    Number.isFinite(candidate.observedAt) && candidate.observedAt >= 0 &&
    (candidate.kind === 'blocked' || candidate.kind === 'finished' || candidate.kind === 'failed') &&
    typeof candidate.projectName === 'string' && typeof candidate.agentName === 'string' &&
    typeof candidate.notification?.title === 'string' && candidate.notification.title.length > 0 &&
    (candidate.notification.body === undefined || typeof candidate.notification.body === 'string')
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

/**
 * Integration contract: use notificationForTransition(previous, current, ...) before enqueue, capture observedAt once on that real transition,
 * and reuse it on retries; persist consumed identities before dispatch and retain them for 24 hours; discard pending groups on restart;
 * recheck live eligibility and mute at dispatch; schedule at most one qualifying reminder at snooze expiry;
 * resume/unmute never triggers historical catch-up.
 */
/** Flush elapsed groups after rechecking current eligibility and mute; pending groups are transient. */
export function flushTransitionQueue(
  queue: NotificationQueue,
  policy: NotificationPolicy,
  now: number,
  isEligible: (candidate: TransitionCandidate) => boolean
): QueueResult {
  const ownedQueue = copyQueue(queue)
  const currentPolicy = Number.isFinite(now) && now >= 0 ? pruneHandledTransitions(policy, now) : copyNotificationPolicy(policy)
  const due = ownedQueue.pending.filter((group) => group.deadline <= now)
    .sort((a, b) => a.deadline - b.deadline || compareText(a.projectId, b.projectId) || compareText(a.kind, b.kind))
  const notifications: NotificationMessage[] = []
  const refusals: QueueRefusal[] = []
  for (const group of due) {
    if (currentPolicy.mutedProjects.includes(group.projectId)) continue
    const eligible = { ...group, candidates: group.candidates.filter((candidate) => isEligible(copyCandidate(candidate))) }
    if (eligible.candidates.length === 0) continue
    const notification = summarize(eligible)
    if (jsonBytes(notification) > MAX_NOTIFICATION_BYTES) refusals.push({ reason: 'notification-too-large' })
    else notifications.push(notification)
  }
  const dueGroups = new Set(due)
  return {
    queue: { pending: ownedQueue.pending.filter((group) => !dueGroups.has(group)) },
    policy: currentPolicy,
    notifications,
    refusals
  }
}

/** Adopt an event only after its consumed identity has been persisted by the caller. */
export function adoptConsumedTransition(
  queue: NotificationQueue,
  policy: NotificationPolicy,
  candidate: TransitionCandidate,
  now: number,
  isEligible: (candidate: TransitionCandidate) => boolean
): QueueResult {
  const elapsed = flushTransitionQueue(queue, policy, now, isEligible)
  const refuse = (reason: QueueRefusal['reason']): QueueResult => ({ ...elapsed, refusals: [...elapsed.refusals, { reason }] })
  if (!Number.isFinite(now) || now < 0 || !validCandidate(candidate)) return refuse('invalid-candidate')
  const admitted = copyCandidate(candidate)
  if (jsonBytes(admitted) > MAX_NOTIFICATION_BYTES) return refuse('candidate-too-large')
  if (admitted.observedAt > now || now - admitted.observedAt >= TRANSITION_IDENTITY_RETENTION_MS) return refuse('stale-candidate')
  const identity = transitionIdentity(admitted)
  if (!elapsed.policy.handledTransitions.some((prior) => sameTransition(prior, identity))) return refuse('identity-not-consumed')
  if (!isEligible(copyCandidate(admitted)) || elapsed.policy.mutedProjects.includes(admitted.projectId)) return elapsed
  if (elapsed.queue.pending.some((group) => group.candidates.some((prior) => sameTransition(transitionIdentity(prior), identity)))) return elapsed

  const pending = [...elapsed.queue.pending]
  const index = pending.findIndex((group) => groupKey(group, admitted))
  const deadline = index < 0 ? admitted.observedAt + GROUP_WINDOW_MS : pending[index].deadline
  if (index < 0) {
    pending.push({
      projectId: admitted.projectId,
      projectName: admitted.projectName,
      kind: admitted.kind,
      firstAt: admitted.observedAt,
      deadline: admitted.observedAt + GROUP_WINDOW_MS,
      candidates: [admitted]
    })
  } else {
    if (pending[index].candidates.length >= MAX_GROUP_CANDIDATES) return refuse('group-candidate-limit')
    pending[index] = { ...pending[index], candidates: [...pending[index].candidates, admitted] }
  }
  if (pending.length > MAX_PENDING_GROUPS || jsonBytes(pending) > STORE_BYTES) return refuse('pending-queue-full')
  pending.sort((a, b) => a.firstAt - b.firstAt || compareText(a.projectId, b.projectId) || compareText(a.kind, b.kind))
  const adopted = { ...elapsed, queue: { pending } }
  return deadline <= now
    ? flushTransitionQueue(adopted.queue, adopted.policy, now, isEligible)
    : adopted
}

/** Adds one eligible transition, deduplicates it, and starts a non-extending project/kind window. */
export function queueTransition(
  queue: NotificationQueue,
  policy: NotificationPolicy,
  candidate: TransitionCandidate,
  now: number,
  isEligible: (candidate: TransitionCandidate) => boolean
): QueueResult {
  const elapsed = flushTransitionQueue(queue, policy, now, isEligible)
  const refuse = (reason: QueueRefusal['reason']): QueueResult => ({ ...elapsed, refusals: [...elapsed.refusals, { reason }] })
  if (!Number.isFinite(now) || now < 0 || !validCandidate(candidate)) return refuse('invalid-candidate')
  const admitted = copyCandidate(candidate)
  if (jsonBytes(admitted) > MAX_NOTIFICATION_BYTES) return refuse('candidate-too-large')
  if (admitted.observedAt > now || now - admitted.observedAt >= TRANSITION_IDENTITY_RETENTION_MS) return refuse('stale-candidate')
  if (!isEligible(copyCandidate(admitted))) return elapsed
  const identity = transitionIdentity(admitted)
  if (elapsed.policy.handledTransitions.some((prior) => sameTransition(prior, identity)) ||
      elapsed.queue.pending.some((group) => group.candidates.some((prior) => sameTransition(transitionIdentity(prior), identity)))) return elapsed
  if (elapsed.policy.handledTransitions.length >= MAX_HANDLED_TRANSITIONS) return refuse('handled-identity-limit')
  const nextPolicy = {
    ...elapsed.policy,
    handledTransitions: [...elapsed.policy.handledTransitions, { ...identity, consumedAt: now }]
  }
  if (nextPolicy.handledTransitions.length > MAX_HANDLED_TRANSITIONS) return refuse('handled-identity-limit')
  if (jsonBytes(nextPolicy) > STORE_BYTES) return refuse('policy-too-large')
  if (elapsed.policy.mutedProjects.includes(admitted.projectId)) return { ...elapsed, policy: nextPolicy }

  const pending = [...elapsed.queue.pending]
  const index = pending.findIndex((group) => groupKey(group, admitted))
  if (index < 0) {
    pending.push({
      projectId: admitted.projectId,
      projectName: admitted.projectName,
      kind: admitted.kind,
      firstAt: now,
      deadline: now + GROUP_WINDOW_MS,
      candidates: [admitted]
    })
  } else {
    if (pending[index].candidates.length >= MAX_GROUP_CANDIDATES) return refuse('group-candidate-limit')
    pending[index] = { ...pending[index], candidates: [...pending[index].candidates, admitted] }
  }
  if (pending.length > MAX_PENDING_GROUPS || jsonBytes(pending) > STORE_BYTES) return refuse('pending-queue-full')
  pending.sort((a, b) => a.firstAt - b.firstAt || compareText(a.projectId, b.projectId) || compareText(a.kind, b.kind))
  return { ...elapsed, queue: { pending }, policy: nextPolicy }
}
