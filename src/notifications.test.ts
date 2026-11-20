import { assert, test } from 'orca/testing'
import {
  emptyNotificationQueue,
  emptyNotificationPolicy,
  flushTransitionQueue,
  isProjectMuted,
  isReminderSnoozed,
  queueTransition,
  readNotificationPolicy,
  reminderNotification,
  setProjectMuted,
  setReminderSnooze,
  transitionNotification,
  type TransitionCandidate
} from './notifications'

test('suppresses a transition notification on first observation', () => {
  assert.equal(
    transitionNotification(undefined, {
      state: 'blocked', stateStartedAt: 2_000, name: 'Folio', title: 'Fix sort', outcome: null
    }, { notifyBlocked: true, notifyDone: true }),
    null
  )
})

test('notifies for a newly blocked agent only when that setting is enabled', () => {
  const previous = { state: 'working' as const, since: 1_000 }
  const current = {
    state: 'blocked' as const, stateStartedAt: 2_000, name: 'Folio', title: 'Fix sort', outcome: null
  }
  assert.deepEqual(transitionNotification(previous, current, { notifyBlocked: true, notifyDone: true }), {
    title: 'Folio needs you', body: 'Fix sort'
  })
  assert.equal(transitionNotification(previous, current, { notifyBlocked: false, notifyDone: true }), null)
})

test('notifies only when a working turn lasts longer than the threshold', () => {
  const current = {
    state: 'done' as const, stateStartedAt: 61_001, name: 'Folio', title: 'Fix sort', outcome: 'success' as const
  }
  assert.equal(transitionNotification({ state: 'working', since: 1_001 }, current, { notifyBlocked: true, notifyDone: true }), null)
  assert.deepEqual(transitionNotification({ state: 'working', since: 1_000 }, current, { notifyBlocked: true, notifyDone: true }), {
    title: 'Folio finished', body: 'Fix sort'
  })
  assert.deepEqual(transitionNotification({ state: 'working', since: 1_000 }, { ...current, outcome: 'failure' }, { notifyBlocked: true, notifyDone: true }), {
    title: 'Folio failed', body: 'Fix sort'
  })
  assert.equal(transitionNotification({ state: 'working', since: 1_000 }, current, { notifyBlocked: true, notifyDone: false }), null)
})

test('sends one reminder per overdue quiet spell and allows the next spell', () => {
  const agent = { id: 'agent', state: 'working' as const, lastSeenAt: 1_000, stateStartedAt: 500, name: 'Folio', title: 'Fix sort' }
  assert.deepEqual(reminderNotification(agent, 1_201_000, 20, undefined), {
    spell: 'quiet:1000', notification: { title: 'Folio may be stuck', body: 'No activity seen for 20 min · Fix sort' }
  })
  assert.equal(reminderNotification(agent, 1_201_000, 20, 'quiet:1000'), null)
  assert.equal(reminderNotification({ ...agent, lastSeenAt: 2_000 }, 1_202_000, 20, 'quiet:1000')?.spell, 'quiet:2000')
})

test('reminds once when blocked and treats zero minutes as disabled', () => {
  const agent = { id: 'agent', state: 'blocked' as const, lastSeenAt: 100, stateStartedAt: 1_000, name: 'Folio', title: null }
  assert.deepEqual(reminderNotification(agent, 601_000, 10, undefined), {
    spell: 'needs-you:1000', notification: { title: 'Folio still needs you', body: 'Waiting on you for 10 min' }
  })
  assert.equal(reminderNotification(agent, 601_000, 0, undefined), null)
})

const candidate = (
  transitionId: string,
  episodeId: string,
  projectId: string,
  kind: 'blocked' | 'finished' | 'failed',
  agentName: string
): TransitionCandidate => ({
  transitionId,
  episodeId,
  projectId,
  projectName: projectId.toUpperCase(),
  kind,
  agentName,
  notification: { title: `${agentName} ${kind}`, body: 'Useful detail' }
})

test('stores reminder snoozes as absolute expiries and expires at the exact boundary after restore', () => {
  const original = setReminderSnooze(emptyNotificationPolicy(), 'episode-a', 1_000, '15m')
  const restored = readNotificationPolicy(JSON.parse(JSON.stringify(original)), 300_000)
  assert.equal(isReminderSnoozed(restored, 'episode-a', 900_999), true)
  assert.equal(isReminderSnoozed(restored, 'episode-a', 901_000), false)
  const hour = setReminderSnooze(emptyNotificationPolicy(), 'episode-b', 1_000, '1h')
  assert.equal(hour.reminderSnoozes[0].expiresAt, 3_601_000)
})

test('manual reminder snooze is episode-scoped, resume clears it, and a later episode stays eligible', () => {
  const manual = setReminderSnooze(emptyNotificationPolicy(), 'episode-a', 5_000, 'manual')
  assert.equal(isReminderSnoozed(manual, 'episode-a', 500_000), true)
  assert.equal(isReminderSnoozed(manual, 'episode-b', 500_000), false)
  const resumed = setReminderSnooze(manual, 'episode-a', 500_000, 'resume')
  assert.equal(isReminderSnoozed(resumed, 'episode-a', 500_000), false)
})

test('rejects malformed snoozes, drops expired entries and bounds parsed controls deterministically', () => {
  const snoozes = Array.from({ length: 503 }, (_, index) => ({
    episodeId: `episode-${index}`,
    expiresAt: null,
    setAt: index
  }))
  const parsed = readNotificationPolicy({
    mutedProjects: [...Array.from({ length: 205 }, (_, index) => `project-${String(index).padStart(3, '0')}`), '', 4],
    reminderSnoozes: [
      ...snoozes,
      { episodeId: 'expired', expiresAt: 99, setAt: 1 },
      { episodeId: 'bad-expiry', expiresAt: 'later', setAt: 1 },
      { episodeId: 'future', expiresAt: null, setAt: 2_000 }
    ],
    handledTransitions: [
      ...Array.from({ length: 1_005 }, (_, index) => ({ episodeId: `episode-${index}`, transitionId: `transition-${index}` })),
      null, ''
    ]
  }, 1_000)
  assert.equal(parsed.mutedProjects.length, 200)
  assert.deepEqual(parsed.mutedProjects[0], 'project-000')
  assert.deepEqual(parsed.reminderSnoozes.length, 500)
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'expired'), false)
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'bad-expiry'), false)
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'future'), false)
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'episode-3'), true)
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'episode-2'), false)
  assert.equal(parsed.handledTransitions.length, 1_000)
  assert.deepEqual(parsed.handledTransitions[0], { episodeId: 'episode-5', transitionId: 'transition-5' })
})

test('project mute suppresses a transition immediately and unmute does not replay it', () => {
  const empty = emptyNotificationPolicy()
  const muted = setProjectMuted(empty, 'project-a', true)
  assert.equal(isProjectMuted(muted, 'project-a'), true)
  assert.deepEqual(empty.mutedProjects, [])
  const queued = queueTransition(emptyNotificationQueue(), muted, candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 100)
  assert.deepEqual(queued.notifications, [])
  assert.deepEqual(queued.queue.pending, [])

  const unmuted = setProjectMuted(queued.policy, 'project-a', false)
  const repeated = queueTransition(queued.queue, unmuted, candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 200)
  assert.deepEqual(repeated.notifications, [])
  assert.deepEqual(repeated.queue.pending, [])
})

test('holds one eligible event for two seconds and preserves its useful individual message', () => {
  const initialQueue = emptyNotificationQueue()
  const initialPolicy = emptyNotificationPolicy()
  const first = queueTransition(initialQueue, initialPolicy, candidate('done-1', 'episode-a', 'project-a', 'finished', 'Ada'), 1_000)
  assert.deepEqual(first.notifications, [])
  assert.deepEqual(initialQueue.pending, [])
  assert.deepEqual(initialPolicy.handledTransitions, [])
  assert.deepEqual(first.queue.pending[0], {
    projectId: 'project-a', projectName: 'PROJECT-A', kind: 'finished', firstAt: 1_000, deadline: 3_000,
    candidates: [candidate('done-1', 'episode-a', 'project-a', 'finished', 'Ada')]
  })
  assert.deepEqual(flushTransitionQueue(first.queue, first.policy, 2_999).notifications, [])
  assert.deepEqual(flushTransitionQueue(first.queue, first.policy, 3_000).notifications, [
    { title: 'Ada finished', body: 'Useful detail' }
  ])
})

test('groups same-project same-kind arrivals but keeps project and kind boundaries separate', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  for (const [id, project, kind, agent] of [
    ['b2', 'project-a', 'blocked', 'Bea'],
    ['b1', 'project-a', 'blocked', 'Ada'],
    ['d1', 'project-a', 'finished', 'Cy'],
    ['f1', 'project-a', 'failed', 'Fay'],
    ['b3', 'project-b', 'blocked', 'Dee']
  ] as const) {
    const next = queueTransition(queue, policy, candidate(id, `episode-${id}`, project, kind, agent), 10_000)
    queue = next.queue
    policy = next.policy
  }
  const flushed = flushTransitionQueue(queue, policy, 12_000)
  assert.deepEqual(flushed.notifications, [
    { title: '2 agents need you', body: 'PROJECT-A · Ada, Bea' },
    { title: 'Fay failed', body: 'Useful detail' },
    { title: 'Cy finished', body: 'Useful detail' },
    { title: 'Dee blocked', body: 'Useful detail' }
  ])
})

test('deduplicates event and roster observations by episode and transition identity', () => {
  const event = candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada')
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), event, 50)
  const repeated = queueTransition(first.queue, first.policy, { ...event, agentName: 'Updated label' }, 75)
  assert.equal(repeated.queue.pending[0].candidates.length, 1)
  assert.equal(repeated.queue.pending[0].candidates[0].agentName, 'Ada')

  const restoredPolicy = readNotificationPolicy(JSON.parse(JSON.stringify(repeated.policy)), 80)
  const afterRestart = queueTransition(repeated.queue, restoredPolicy, event, 90)
  assert.equal(afterRestart.queue.pending[0].candidates.length, 1)

  const nextTurn = queueTransition(afterRestart.queue, afterRestart.policy, candidate('blocked-1', 'episode-b', 'project-a', 'blocked', 'Ada'), 100)
  const nextTransition = queueTransition(nextTurn.queue, nextTurn.policy, candidate('failed-2', 'episode-a', 'project-a', 'failed', 'Ada'), 125)
  assert.equal(nextTransition.queue.pending.reduce((count, group) => count + group.candidates.length, 0), 3)
  assert.equal(nextTransition.queue.pending.length, 2)
})

test('rechecks mute at dispatch and discards a pending group without replay after unmute', () => {
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 0)
  const muted = setProjectMuted(first.policy, 'project-a', true)
  const suppressed = flushTransitionQueue(first.queue, muted, 2_000)
  assert.deepEqual(suppressed.notifications, [])
  assert.deepEqual(suppressed.queue.pending, [])

  const unmuted = setProjectMuted(suppressed.policy, 'project-a', false)
  assert.deepEqual(flushTransitionQueue(suppressed.queue, unmuted, 9_000).notifications, [])
})

test('does not extend a group deadline when more events arrive near expiry', () => {
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), candidate('b1', 'e1', 'project-a', 'blocked', 'Ada'), 100)
  const second = queueTransition(first.queue, first.policy, candidate('b2', 'e2', 'project-a', 'blocked', 'Bea'), 1_900)
  assert.equal(second.queue.pending[0].firstAt, 100)
  assert.equal(second.queue.pending[0].deadline, 2_100)
  const third = queueTransition(second.queue, second.policy, candidate('b3', 'e3', 'project-a', 'blocked', 'Cy'), 2_100)
  assert.deepEqual(third.notifications, [{ title: '2 agents need you', body: 'PROJECT-A · Ada, Bea' }])
  assert.equal(third.queue.pending[0].firstAt, 2_100)
  assert.equal(third.queue.pending[0].deadline, 4_100)
})

test('does not apply reminder snooze to transitions or replay a handled transition after restart', () => {
  const snoozed = setReminderSnooze(emptyNotificationPolicy(), 'episode-a', 0, '15m')
  const event = candidate('failed-1', 'episode-a', 'project-a', 'failed', 'Ada')
  const transition = queueTransition(emptyNotificationQueue(), snoozed, event, 100)
  assert.equal(transition.queue.pending.length, 1)
  assert.equal(isReminderSnoozed(transition.policy, 'episode-a', 100), true)
  assert.equal(isReminderSnoozed(transition.policy, 'episode-a', 900_000), false)
  const restored = readNotificationPolicy(JSON.parse(JSON.stringify(transition.policy)), 500_000)
  const replay = queueTransition(emptyNotificationQueue(), restored, event, 500_000)
  assert.deepEqual(replay.queue.pending, [])
  assert.deepEqual(replay.notifications, [])
  const laterFailure = queueTransition(replay.queue, replay.policy, candidate('failed-2', 'episode-a', 'project-a', 'failed', 'Ada'), 500_001)
  assert.equal(laterFailure.queue.pending.length, 1)
})
