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
  TRANSITION_IDENTITY_RETENTION_MS,
  setProjectMuted,
  setReminderSnooze,
  transitionNotification,
  type TransitionCandidate
} from './notifications'
import { STORE_BYTES, jsonBytes } from './office'

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
  const restored = readNotificationPolicy(JSON.parse(JSON.stringify(original.policy)), 300_000)
  assert.equal(isReminderSnoozed(restored, 'episode-a', 900_999), true)
  assert.equal(isReminderSnoozed(restored, 'episode-a', 901_000), false)
  const hour = setReminderSnooze(emptyNotificationPolicy(), 'episode-b', 1_000, '1h')
  assert.equal(hour.policy.reminderSnoozes[0].expiresAt, 3_601_000)
})

test('manual reminder snooze is episode-scoped, resume clears it, and a later episode stays eligible', () => {
  const manual = setReminderSnooze(emptyNotificationPolicy(), 'episode-a', 5_000, 'manual')
  assert.equal(isReminderSnoozed(manual.policy, 'episode-a', 500_000), true)
  assert.equal(isReminderSnoozed(manual.policy, 'episode-b', 500_000), false)
  const resumed = setReminderSnooze(manual.policy, 'episode-a', 500_000, 'resume')
  assert.equal(isReminderSnoozed(resumed.policy, 'episode-a', 500_000), false)
})

test('rejects a 501st active snooze without evicting any manual or timed control', () => {
  for (const expiresAt of [null, 3_601_000]) {
    const policy = readNotificationPolicy({
      reminderSnoozes: Array.from({ length: 500 }, (_, index) => ({
        episodeId: `episode-${index}`,
        expiresAt,
        setAt: 1_000
      }))
    }, 2_000)
    const result = setReminderSnooze(policy, 'new-episode', 2_000, 'manual')
    assert.equal(result.ok, false)
    assert.equal(result.policy, policy)
    assert.equal(result.policy.reminderSnoozes.length, 500)
    assert.equal(result.policy.reminderSnoozes.some(({ episodeId }) => episodeId === 'episode-0'), true)
  }
})

test('prunes expired snoozes before admitting a new active control', () => {
  const policy = readNotificationPolicy({
    reminderSnoozes: [
      ...Array.from({ length: 499 }, (_, index) => ({ episodeId: `active-${index}`, expiresAt: null, setAt: 1_000 })),
      { episodeId: 'expired', expiresAt: 1_901_000, setAt: 1_000 }
    ]
  }, 1_800_000)
  const result = setReminderSnooze(policy, 'new-episode', 1_902_000, '15m')
  assert.equal(result.ok, true)
  assert.equal(result.policy.reminderSnoozes.length, 500)
  assert.equal(result.policy.reminderSnoozes.some(({ episodeId }) => episodeId === 'expired'), false)
  assert.equal(result.policy.reminderSnoozes.some(({ episodeId }) => episodeId === 'new-episode'), true)
})

test('rejects malformed snoozes, drops expired entries and bounds parsed controls deterministically', () => {
  const snoozes = Array.from({ length: 500 }, (_, index) => ({
    episodeId: `episode-${index}`,
    expiresAt: null,
    setAt: index
  }))
  const parsed = readNotificationPolicy({
    mutedProjects: [...Array.from({ length: 200 }, (_, index) => `project-${String(index).padStart(3, '0')}`), '', 4],
    reminderSnoozes: [
      ...snoozes,
      { episodeId: 'expired', expiresAt: 99, setAt: 1 },
      { episodeId: 'bad-expiry', expiresAt: 'later', setAt: 1 },
      { episodeId: 'future', expiresAt: null, setAt: 2_000 }
    ],
    handledTransitions: [
      ...Array.from({ length: 1_005 }, (_, index) => ({
        episodeId: `episode-${index}`,
        transitionId: `transition-${index}`,
        consumedAt: index < 5 ? 1_000 - TRANSITION_IDENTITY_RETENTION_MS : index - 5
      })),
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
  assert.equal(parsed.reminderSnoozes.some(({ episodeId }) => episodeId === 'episode-2'), true)
  assert.equal(parsed.handledTransitions.length, 1_000)
  assert.deepEqual(parsed.handledTransitions[0], { episodeId: 'episode-5', transitionId: 'transition-5', consumedAt: 0 })
})

test('reads only own persisted fields and accepts only manual, 15-minute, or one-hour snoozes', () => {
  const inheritedPolicy = Object.create({
    mutedProjects: ['inherited-project'],
    reminderSnoozes: [{ episodeId: 'inherited-episode', expiresAt: null, setAt: 1_000 }],
    handledTransitions: [{ episodeId: 'inherited', transitionId: 'inherited' }]
  })
  const inheritedOnly = readNotificationPolicy(inheritedPolicy, 5_000)
  assert.deepEqual(inheritedOnly, emptyNotificationPolicy())
  const inheritedEntry = Object.assign(Object.create({ expiresAt: null, setAt: 1_000 }), { episodeId: 'nested-inherited' })
  const parsed = readNotificationPolicy({
    mutedProjects: ['own-project'],
    reminderSnoozes: [
      { episodeId: 'manual', expiresAt: null, setAt: 1_000 },
      { episodeId: 'fifteen', expiresAt: 901_000, setAt: 1_000 },
      { episodeId: 'hour', expiresAt: 3_601_000, setAt: 1_000 },
      { episodeId: 'too-long', expiresAt: Number.MAX_SAFE_INTEGER, setAt: 1_000 },
      { episodeId: 'unsupported-duration', expiresAt: 1_201_000, setAt: 1_000 },
      { episodeId: 'inconsistent', expiresAt: 1_000, setAt: 1_000 },
      { episodeId: 'missing-expiry', setAt: 1_000 },
      { episodeId: 'missing-set-at', expiresAt: null },
      inheritedEntry
    ]
  }, 5_000)
  assert.deepEqual(parsed.mutedProjects, ['own-project'])
  assert.deepEqual(parsed.reminderSnoozes.map(({ episodeId }) => episodeId), ['fifteen', 'hour', 'manual'])
  assert.deepEqual(parsed.handledTransitions, [])
})

test('project mute suppresses a transition immediately and unmute does not replay it', () => {
  const empty = emptyNotificationPolicy()
  const muted = setProjectMuted(empty, 'project-a', true, 0).policy
  assert.equal(isProjectMuted(muted, 'project-a'), true)
  assert.deepEqual(empty.mutedProjects, [])
  const queued = queueTransition(emptyNotificationQueue(), muted, candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 100, () => true)
  assert.deepEqual(queued.notifications, [])
  assert.deepEqual(queued.queue.pending, [])

  const unmuted = setProjectMuted(queued.policy, 'project-a', false, 200).policy
  const repeated = queueTransition(queued.queue, unmuted, candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 200, () => true)
  assert.deepEqual(repeated.notifications, [])
  assert.deepEqual(repeated.queue.pending, [])
})

test('holds one eligible event for two seconds and preserves its useful individual message', () => {
  const initialQueue = emptyNotificationQueue()
  const initialPolicy = emptyNotificationPolicy()
  const first = queueTransition(initialQueue, initialPolicy, candidate('done-1', 'episode-a', 'project-a', 'finished', 'Ada'), 1_000, () => true)
  assert.deepEqual(first.notifications, [])
  assert.deepEqual(initialQueue.pending, [])
  assert.deepEqual(initialPolicy.handledTransitions, [])
  assert.deepEqual(first.queue.pending[0], {
    projectId: 'project-a', projectName: 'PROJECT-A', kind: 'finished', firstAt: 1_000, deadline: 3_000,
    candidates: [candidate('done-1', 'episode-a', 'project-a', 'finished', 'Ada')]
  })
  assert.deepEqual(flushTransitionQueue(first.queue, first.policy, 2_999, () => true).notifications, [])
  assert.deepEqual(flushTransitionQueue(first.queue, first.policy, 3_000, () => true).notifications, [
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
    const next = queueTransition(queue, policy, candidate(id, `episode-${id}`, project, kind, agent), 10_000, () => true)
    queue = next.queue
    policy = next.policy
  }
  const flushed = flushTransitionQueue(queue, policy, 12_000, () => true)
  assert.deepEqual(flushed.notifications, [
    { title: '2 agents need you', body: 'PROJECT-A · Ada, Bea' },
    { title: 'Fay failed', body: 'Useful detail' },
    { title: 'Cy finished', body: 'Useful detail' },
    { title: 'Dee blocked', body: 'Useful detail' }
  ])
})

test('deduplicates event and roster observations by episode and transition identity', () => {
  const event = candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada')
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), event, 50, () => true)
  const repeated = queueTransition(first.queue, first.policy, { ...event, agentName: 'Updated label' }, 75, () => true)
  assert.equal(repeated.queue.pending[0].candidates.length, 1)
  assert.equal(repeated.queue.pending[0].candidates[0].agentName, 'Ada')

  const restoredPolicy = readNotificationPolicy(JSON.parse(JSON.stringify(repeated.policy)), 80)
  const afterRestart = queueTransition(repeated.queue, restoredPolicy, event, 90, () => true)
  assert.equal(afterRestart.queue.pending[0].candidates.length, 1)

  const nextTurn = queueTransition(afterRestart.queue, afterRestart.policy, candidate('blocked-1', 'episode-b', 'project-a', 'blocked', 'Ada'), 100, () => true)
  const nextTransition = queueTransition(nextTurn.queue, nextTurn.policy, candidate('failed-2', 'episode-a', 'project-a', 'failed', 'Ada'), 125, () => true)
  assert.equal(nextTransition.queue.pending.reduce((count, group) => count + group.candidates.length, 0), 3)
  assert.equal(nextTransition.queue.pending.length, 2)
})

test('retains handled identities for 24 hours, recovers after expiry, and never restores a queue backlog', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  let lastEvent: TransitionCandidate | undefined
  for (let index = 0; index < 1_000; index++) {
    const now = index * 2_100
    const event = candidate(`transition-${index}`, `episode-${index}`, `project-${index}`, 'blocked', `Agent ${index}`)
    if (index === 500) {
      policy = readNotificationPolicy(JSON.parse(JSON.stringify(policy)), now)
      const duplicate = queueTransition(emptyNotificationQueue(), policy, lastEvent!, now, () => true)
      assert.deepEqual(duplicate.queue.pending, [])
      assert.deepEqual(duplicate.notifications, [])
    }
    const next = queueTransition(queue, policy, event, now, () => true)
    assert.deepEqual(next.refusals, [])
    queue = next.queue
    policy = next.policy
    lastEvent = event
  }

  const saturated = queueTransition(queue, policy, candidate('overflow', 'episode-overflow', 'project-overflow', 'blocked', 'Overflow'), 2_100_000, () => true)
  assert.equal(saturated.refusals[0].reason, 'handled-identity-limit')
  const restartAt = 2_100_000 + TRANSITION_IDENTITY_RETENTION_MS
  const restored = readNotificationPolicy(JSON.parse(JSON.stringify(saturated.policy)), restartAt)
  assert.deepEqual(flushTransitionQueue(emptyNotificationQueue(), restored, restartAt, () => true).notifications, [])
  const recovered = queueTransition(emptyNotificationQueue(), restored, candidate('after-expiry', 'episode-new', 'project-new', 'blocked', 'New'), restartAt, () => true)
  assert.deepEqual(recovered.refusals, [])
  assert.equal(recovered.policy.handledTransitions.length, 1)
})

test('restores and updates combined multibyte controls within the total UTF-8 budget', () => {
  const now = 2_000_000
  const id = (prefix: string, index: number) => `${prefix}-${'🙂'.repeat(120)}-${index}`
  const restored = readNotificationPolicy({
    mutedProjects: Array.from({ length: 20 }, (_, index) => id('project', index)),
    reminderSnoozes: Array.from({ length: 330 }, (_, index) => ({ episodeId: id('episode', index), expiresAt: null, setAt: now })),
    handledTransitions: Array.from({ length: 300 }, (_, index) => ({
      episodeId: id('old-episode', index), transitionId: id('old-transition', index), consumedAt: now - TRANSITION_IDENTITY_RETENTION_MS
    }))
  }, now)
  assert.equal(restored.reminderSnoozes.length, 330)
  assert.equal(restored.mutedProjects.length, 20)
  assert.deepEqual(restored.handledTransitions, [])
  assert.ok(jsonBytes(restored) <= STORE_BYTES)

  let current = restored
  const addedIds: string[] = []
  let refused = false
  for (let index = 0; index < 50; index++) {
    const episodeId = id('new-episode', index)
    const result = setReminderSnooze(current, episodeId, now, 'manual')
    if (!result.ok) {
      assert.equal(result.error, 'policy-too-large')
      refused = true
      break
    }
    current = result.policy
    addedIds.push(episodeId)
    assert.ok(jsonBytes(current) <= STORE_BYTES)
  }
  assert.equal(refused, true)
  assert.equal(current.reminderSnoozes.length, 330 + addedIds.length)
  assert.equal(current.reminderSnoozes.every(({ episodeId }) => restored.reminderSnoozes.some((entry) => entry.episodeId === episodeId) || addedIds.includes(episodeId)), true)

  let queue = emptyNotificationQueue()
  let notificationRefused = false
  for (let index = 0; index < 300; index++) {
    const next = queueTransition(queue, current, candidate(`bounded-${index}`, `bounded-episode-${index}`, `bounded-project-${index}`, 'blocked', 'Ada'), now, () => true)
    if (next.refusals.length) {
      assert.equal(next.refusals[0].reason, 'policy-too-large')
      notificationRefused = true
      break
    }
    queue = next.queue
    current = next.policy
    assert.ok(jsonBytes(current) <= STORE_BYTES)
  }
  assert.equal(notificationRefused, true)

  let muteRefused = false
  for (let index = 0; index < 200; index++) {
    const projectId = id('new-project', index)
    const result = setProjectMuted(current, projectId, true, now)
    if (!result.ok) {
      assert.equal(result.error, 'policy-too-large')
      assert.equal(result.policy, current)
      muteRefused = true
      break
    }
    current = result.policy
    assert.ok(jsonBytes(current) <= STORE_BYTES)
  }
  assert.equal(muteRefused, true)
  assert.equal(current.reminderSnoozes.length, 330 + addedIds.length)

  assert.throws(() => readNotificationPolicy({
    mutedProjects: Array.from({ length: 200 }, (_, index) => id('project', index)),
    reminderSnoozes: Array.from({ length: 500 }, (_, index) => ({ episodeId: id('episode', index), expiresAt: null, setAt: now })),
    handledTransitions: Array.from({ length: 1_000 }, (_, index) => ({
      episodeId: id('handled-episode', index), transitionId: id('handled-transition', index), consumedAt: now
    }))
  }, now), /notification policy exceeds the storage byte limit/)
})

test('rechecks mute at dispatch and discards a pending group without replay after unmute', () => {
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), candidate('blocked-1', 'episode-a', 'project-a', 'blocked', 'Ada'), 0, () => true)
  const muted = setProjectMuted(first.policy, 'project-a', true, 2_000).policy
  const suppressed = flushTransitionQueue(first.queue, muted, 2_000, () => true)
  assert.deepEqual(suppressed.notifications, [])
  assert.deepEqual(suppressed.queue.pending, [])

  const unmuted = setProjectMuted(suppressed.policy, 'project-a', false, 9_000).policy
  assert.deepEqual(flushTransitionQueue(suppressed.queue, unmuted, 9_000, () => true).notifications, [])
})

test('does not extend a group deadline when more events arrive near expiry', () => {
  const first = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), candidate('b1', 'e1', 'project-a', 'blocked', 'Ada'), 100, () => true)
  const second = queueTransition(first.queue, first.policy, candidate('b2', 'e2', 'project-a', 'blocked', 'Bea'), 1_900, () => true)
  assert.equal(second.queue.pending[0].firstAt, 100)
  assert.equal(second.queue.pending[0].deadline, 2_100)
  const third = queueTransition(second.queue, second.policy, candidate('b3', 'e3', 'project-a', 'blocked', 'Cy'), 2_100, () => true)
  assert.deepEqual(third.notifications, [{ title: '2 agents need you', body: 'PROJECT-A · Ada, Bea' }])
  assert.equal(third.queue.pending[0].firstAt, 2_100)
  assert.equal(third.queue.pending[0].deadline, 4_100)
})

test('does not apply reminder snooze to transitions or replay a handled transition after restart', () => {
  const snoozed = setReminderSnooze(emptyNotificationPolicy(), 'episode-a', 0, '15m').policy
  const event = candidate('failed-1', 'episode-a', 'project-a', 'failed', 'Ada')
  const transition = queueTransition(emptyNotificationQueue(), snoozed, event, 100, () => true)
  assert.equal(transition.queue.pending.length, 1)
  assert.equal(isReminderSnoozed(transition.policy, 'episode-a', 100), true)
  assert.equal(isReminderSnoozed(transition.policy, 'episode-a', 900_000), false)
  const restored = readNotificationPolicy(JSON.parse(JSON.stringify(transition.policy)), 500_000)
  const replay = queueTransition(emptyNotificationQueue(), restored, event, 500_000, () => true)
  assert.deepEqual(replay.queue.pending, [])
  assert.deepEqual(replay.notifications, [])
  const laterFailure = queueTransition(replay.queue, replay.policy, candidate('failed-2', 'episode-a', 'project-a', 'failed', 'Ada'), 500_001, () => true)
  assert.equal(laterFailure.queue.pending.length, 1)
})

test('rechecks transition eligibility and excludes stale, completed, or removed agents at dispatch', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  for (const event of [
    candidate('blocked-a', 'episode-a', 'project-a', 'blocked', 'Ada'),
    candidate('blocked-b', 'episode-b', 'project-a', 'blocked', 'Bea'),
    candidate('done-old', 'completion-old', 'project-a', 'finished', 'Cy'),
    candidate('blocked-removed', 'episode-removed', 'project-a', 'blocked', 'Dee')
  ]) {
    const next = queueTransition(queue, policy, event, 0, () => true)
    queue = next.queue
    policy = next.policy
  }
  const current = new Set(['blocked-a', 'done-new'])
  const flushed = flushTransitionQueue(queue, policy, 2_000, (event) => current.has(event.transitionId))
  assert.deepEqual(flushed.notifications, [{ title: 'Ada blocked', body: 'Useful detail' }])
  assert.deepEqual(flushed.queue.pending, [])

  const allStale = queueTransition(emptyNotificationQueue(), emptyNotificationPolicy(), candidate('removed', 'removed-episode', 'project-a', 'blocked', 'Gone'), 0, () => true)
  const removed = flushTransitionQueue(allStale.queue, allStale.policy, 2_000, () => false)
  assert.deepEqual(removed.notifications, [])
  assert.deepEqual(removed.queue.pending, [])
})

test('refuses over-budget text and identities without truncating candidate data', () => {
  const initialQueue = emptyNotificationQueue()
  const initialPolicy = emptyNotificationPolicy()
  const tooLarge = candidate('large', 'large-episode', 'project-a', 'blocked', 'Ada')
  tooLarge.notification.body = 'é'.repeat(STORE_BYTES)
  const oversized = queueTransition(initialQueue, initialPolicy, tooLarge, 0, () => true)
  assert.equal(oversized.refusals[0].reason, 'candidate-too-large')
  assert.deepEqual(oversized.queue, initialQueue)
  assert.deepEqual(oversized.policy, initialPolicy)
  assert.equal(tooLarge.notification.body, 'é'.repeat(STORE_BYTES))

  const longId = 'x'.repeat(256)
  const accepted = queueTransition(initialQueue, initialPolicy, candidate(longId, 'episode-long', 'project-a', 'blocked', 'Ada'), 0, () => true)
  assert.equal(accepted.queue.pending[0].candidates[0].transitionId, longId)
  const rejected = queueTransition(initialQueue, initialPolicy, candidate(`${longId}x`, 'episode-long', 'project-a', 'blocked', 'Ada'), 0, () => true)
  assert.equal(rejected.refusals[0].reason, 'invalid-candidate')
})

test('bounds many projects and candidates with explicit capacity refusals', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  let refused = false
  for (let index = 0; index <= 500; index++) {
    const next = queueTransition(queue, policy, candidate(`p${index}`, `ep${index}`, `project-${index}`, 'blocked', `Agent ${index}`), 0, () => true)
    queue = next.queue
    policy = next.policy
    if (next.refusals.length) {
      refused = true
      assert.equal(next.refusals[0].reason, 'pending-queue-full')
      break
    }
  }
  assert.equal(refused, true)
  assert.ok(queue.pending.length <= 500)
  assert.ok(jsonBytes(queue.pending) <= STORE_BYTES)

  let sameGroup = emptyNotificationQueue()
  let samePolicy = emptyNotificationPolicy()
  refused = false
  for (let index = 0; index <= 500; index++) {
    const next = queueTransition(sameGroup, samePolicy, candidate(`c${index}`, `episode-${index}`, 'project-shared', 'blocked', `Agent ${index}`), 0, () => true)
    sameGroup = next.queue
    samePolicy = next.policy
    if (next.refusals.length) {
      refused = true
      assert.equal(next.refusals[0].reason, 'group-candidate-limit')
      break
    }
  }
  assert.equal(refused, true)
  assert.equal(sameGroup.pending[0].candidates.length, 500)
})

test('refuses a pending queue when UTF-8 bytes exceed the safe storage payload', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  let refused = false
  for (let index = 0; index < 200; index++) {
    const event = candidate(`bytes-${index}`, `episode-${index}`, `project-${index}`, 'blocked', `é${'🙂'.repeat(180)}`)
    event.notification.body = '界'.repeat(180)
    const next = queueTransition(queue, policy, event, 0, () => true)
    if (next.refusals.length) {
      assert.equal(next.refusals[0].reason, 'pending-queue-full')
      refused = true
      break
    }
    queue = next.queue
    policy = next.policy
  }
  assert.equal(refused, true)
  assert.ok(jsonBytes(queue.pending) <= STORE_BYTES)
})

test('refuses an oversized grouped summary instead of truncating names', () => {
  const longName = '🙂'.repeat(30_000)
  const first = candidate('wide-a', 'episode-a', 'project-a', 'blocked', longName)
  const second = candidate('wide-b', 'episode-b', 'project-a', 'blocked', longName)
  const queue = {
    pending: [{
      projectId: 'project-a', projectName: 'Project A', kind: 'blocked' as const,
      firstAt: 0, deadline: 2_000, candidates: [first, second]
    }]
  }
  const result = flushTransitionQueue(queue, emptyNotificationPolicy(), 2_000, () => true)
  assert.deepEqual(result.notifications, [])
  assert.deepEqual(result.refusals, [{ reason: 'notification-too-large' }])
  assert.equal(first.agentName, longName)
  assert.equal(second.agentName, longName)
})

test('keeps multibyte summaries within the Orca safe payload budget and in stable order', () => {
  let queue = emptyNotificationQueue()
  let policy = emptyNotificationPolicy()
  for (const [id, name] of [['b', 'Béa🙂'], ['a', 'Áda🙂'], ['c', 'Céline🙂']] as const) {
    const next = queueTransition(queue, policy, candidate(id, `episode-${id}`, 'project-a', 'blocked', name), 0, () => true)
    queue = next.queue
    policy = next.policy
  }
  const notifications = flushTransitionQueue(queue, policy, 2_000, () => true).notifications
  assert.deepEqual(notifications, [{ title: '3 agents need you', body: 'PROJECT-A · Béa🙂, Céline🙂, Áda🙂' }])
  assert.ok(notifications.every((notification) => jsonBytes(notification) <= STORE_BYTES))
})
