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
