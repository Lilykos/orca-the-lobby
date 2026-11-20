import { assert, test } from 'orca/testing'
import {
  activityTimeText,
  agentCounts,
  currentStatus,
  focusTarget,
  restoreFocus,
  modelOrAgentLabel,
  navigateToActivityPanel,
  retainActivityPanels,
  shouldRefreshOffice,
  shouldRenderOfficeFrame,
  tabTargetIndex,
  timeRefreshBucket,
  toggleActivityPanel,
  viewActivityFocusKey
} from './navigation'

test('activity panels expand independently and toggle closed', () => {
  const expanded = toggleActivityPanel(toggleActivityPanel([], 'a'), 'b')
  assert.deepEqual(expanded, ['a', 'b'])
  assert.deepEqual(toggleActivityPanel(expanded, 'a'), ['b'])
})

test('expanded activity panels survive updates and are pruned after agent departures', () => {
  assert.deepEqual(retainActivityPanels(['a', 'b'], ['a', 'c']), ['a'])
  assert.deepEqual(retainActivityPanels(['a'], []), [])
})

test('View activity expands and requests focus on the destination agent heading', () => {
  assert.deepEqual(navigateToActivityPanel(['other'], 'target'), {
    expanded: ['other', 'target'],
    focusTarget: 'target'
  })
  assert.deepEqual(navigateToActivityPanel(['target'], 'target'), {
    expanded: ['target'],
    focusTarget: 'target'
  })
})

test('a redraw restores focus to the same row/control key after reordering', () => {
  const row = { id: 'agent-a' }
  const button = { id: 'open-workspace' }
  assert.equal(
    focusTarget([{ key: 'agent-a:workspace', target: button }, { key: 'agent-a', target: row }], 'agent-a'),
    row
  )
  assert.equal(focusTarget([{ key: 'agent-a', target: row }], 'removed-agent'), undefined)
})

test('View activity keeps a stable focus key so a rebuilt Office row can restore it', () => {
  const key = viewActivityFocusKey('agent-a')
  const rebuiltButton = { id: 'view-activity-after-redraw' }
  assert.equal(key, 'office-view-activity:agent-a')
  assert.equal(focusTarget([{ key, target: rebuiltButton }], key), rebuiltButton)
})

test('compact agent label shows a verified model or only the provider name', () => {
  assert.deepEqual(modelOrAgentLabel('claude-opus-4', 'claude'), {
    text: 'claude-opus-4',
    title: 'Model: claude-opus-4'
  })
  assert.deepEqual(modelOrAgentLabel(null, 'claude'), {
    text: 'Claude',
    title: 'Agent type: claude'
  })
  assert.deepEqual(modelOrAgentLabel(null, null), {
    text: '',
    title: ''
  })
})

test('status labels reflect reported state, failure and unread outcome only', () => {
  assert.deepEqual(currentStatus('working', null, false), { label: 'working', tone: 'working' })
  assert.deepEqual(currentStatus('blocked', null, false), { label: 'needs you', tone: 'blocked' })
  assert.deepEqual(currentStatus('waiting', null, false), { label: 'waiting', tone: 'waiting' })
  assert.deepEqual(currentStatus('done', 'success', false), { label: 'done', tone: 'done' })
  assert.deepEqual(currentStatus('done', 'failure', false), { label: 'failed', tone: 'failed' })
  assert.deepEqual(currentStatus('done', 'failure', true), { label: 'failed', tone: 'failed' })
  assert.deepEqual(currentStatus('done', 'success', true), { label: 'done · new', tone: 'unread' })
  assert.deepEqual(currentStatus('done', 'cancellation', false), { label: 'cancellation', tone: 'outcome' })
  assert.deepEqual(currentStatus('done', 'cancellation', true), { label: 'cancellation', tone: 'outcome' })
  assert.deepEqual(currentStatus('done', null, true), { label: 'done · new', tone: 'unread' })
})

test('panel timing uses state starts and only reports a finish time when provided', () => {
  const duration = (from: number, now: number): string => `${now - from}ms`
  const clock = (at: number): string => `clock-${at}`
  assert.equal(activityTimeText('working', 100, null, 110, duration, clock), 'Working for: 10ms')
  assert.equal(activityTimeText('blocked', 200, null, 225, duration, clock), 'Needs you for: 25ms')
  assert.equal(activityTimeText('waiting', 300, null, 340, duration, clock), 'Waiting for: 40ms')
  assert.equal(activityTimeText('done', 400, 500, 600, duration, clock, 'source'), 'Finished at: clock-500')
  assert.equal(activityTimeText('done', 400, 500, 600, duration, clock, 'observed'), 'Done observed at: clock-500')
  assert.equal(activityTimeText('done', 400, 500, 600, duration, clock, 'unknown'), 'Done time recorded at: clock-500')
  assert.equal(activityTimeText('done', 400, null, 600, duration, clock), 'Done: time unavailable')
  assert.equal(activityTimeText('done', 400, Number.NaN, 600, duration, clock), 'Done: time unavailable')
})

test('wraps keyboard navigation across the first and last tabs', () => {
  assert.equal(tabTargetIndex(0, 'ArrowLeft', 3), 2)
  assert.equal(tabTargetIndex(2, 'ArrowRight', 3), 0)
})

test('supports Home and End while ignoring unrelated keys', () => {
  assert.equal(tabTargetIndex(1, 'Home', 3), 0)
  assert.equal(tabTargetIndex(1, 'End', 3), 2)
  assert.equal(tabTargetIndex(1, 'Enter', 3), null)
})

test('refreshes the Office roster when returning from another page', () => {
  assert.equal(shouldRefreshOffice('activity', 'office'), true)
  assert.equal(shouldRefreshOffice('settings', 'office'), true)
  assert.equal(shouldRefreshOffice('office', 'office'), false)
})

test('clock refresh advances independently of animation and hidden Office drawing', () => {
  assert.notEqual(timeRefreshBucket(999), timeRefreshBucket(1000))
  assert.equal(shouldRenderOfficeFrame('office'), true)
  assert.equal(shouldRenderOfficeFrame('activity'), false)
  assert.equal(shouldRenderOfficeFrame('settings'), false)
})

test('restoring a rebuilt control preserves the user scroll position', () => {
  let scrollTop = 100
  let focused = false
  const control = {
    focus(options?: FocusOptions): void {
      focused = true
      if (!options?.preventScroll) scrollTop = 900
    }
  }
  restoreFocus(control)
  assert.equal(focused, true)
  assert.equal(scrollTop, 100)
  restoreFocus(undefined)
})

test('counts working, needs-you, done and failed agents, leaving waiting ones out', () => {
  assert.deepEqual(agentCounts([
    { state: 'working', outcome: null },
    { state: 'working', outcome: null },
    { state: 'blocked', outcome: null },
    { state: 'waiting', outcome: null },
    { state: 'done', outcome: 'success' },
    { state: 'done', outcome: null },
    { state: 'done', outcome: 'failure' }
  ]), { working: 2, needsYou: 1, done: 2, failed: 1 })
  assert.deepEqual(agentCounts([]), { working: 0, needsYou: 0, done: 0, failed: 0 })
})
