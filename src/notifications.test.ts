import { assert, test } from 'orca/testing'
import { reminderNotification, transitionNotification } from './notifications'

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
