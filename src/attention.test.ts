import { assert, test } from 'orca/testing'
import type { AgentView } from './protocol'
import { attentionGroups, readReviewed, REVIEWED_LIMIT, REVIEWED_RETENTION_MS } from './attention'

const agent = (id: string, state: AgentView['state'], fields: Partial<AgentView> = {}): AgentView => ({
  id, terminalId: null, paneKey: id, parentPaneKey: null, parentId: null,
  workspaceId: null, projectId: null, branch: null, hostId: null, hostName: null, sessionId: null,
  title: id, prompt: null, reply: null, agent: null, state, outcome: null, unread: false,
  stateStartedAt: 1, finishedAt: null, completionId: null, completionTracked: false,
  firstSeenAt: 1, lastSeenAt: 1, active: [], recent: [], toolCount: 0, helpers: [], family: [], insight: null, history: [],
  ...fields
})
test('classifies only blocked, explicit failures and eligible current completions in deterministic order', () => {
  const agents = [
    agent('blocked-new', 'blocked', { stateStartedAt: 20 }),
    agent('done-old', 'done', { completionId: 'a'.repeat(64), completionTracked: true, finishedAt: 20 }),
    agent('unknown-old', 'done', { completionId: 'b'.repeat(64), finishedAt: 30 }),
    agent('failed', 'done', { outcome: 'failure', completionId: 'c'.repeat(64), finishedAt: 10 }),
    agent('unread', 'done', { unread: true, completionId: 'd'.repeat(64), finishedAt: 5 }),
    agent('blocked-old', 'blocked', { stateStartedAt: 10 }),
    agent('waiting', 'waiting'),
    agent('cancelled', 'done', { outcome: 'cancelled', completionId: 'e'.repeat(64), completionTracked: true }),
    agent('canceled-us', 'done', { outcome: 'canceled', completionId: 'f'.repeat(64), completionTracked: true }),
    agent('cancellation', 'done', { outcome: 'cancellation', completionId: '0'.repeat(64), completionTracked: true })
  ]
  const groups = attentionGroups(agents, new Set(['c'.repeat(64)]))
  assert.deepEqual({
    needsInput: groups.needsInput.map((item) => item.id),
    failedToReview: groups.failedToReview.map((item) => item.id),
    finishedToReview: groups.finishedToReview.map((item) => item.id)
  }, {
    needsInput: ['blocked-old', 'blocked-new'],
    failedToReview: [],
    finishedToReview: ['done-old', 'unread']
  })
})

test('validates and deterministically bounds local review metadata to one day', () => {
  const id = 'a'.repeat(64)
  const loaded = readReviewed({ version: 1, entries: { [id]: 1000, invalid: 2000, ['b'.repeat(64)]: 1000 - REVIEWED_RETENTION_MS - 1 } }, 1000)
  assert.deepEqual(loaded, { version: 1, entries: { [id]: 1000 } })
  const many = Object.fromEntries(Array.from({ length: REVIEWED_LIMIT + 1 }, (_, i) => [i.toString(16).padStart(64, '0'), i + 1]))
  const bounded = readReviewed({ version: 1, entries: many }, REVIEWED_LIMIT + 2)
  assert.equal(Object.keys(bounded.entries).length, REVIEWED_LIMIT)
  assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).byteLength < 100_000)
  assert.deepEqual(readReviewed({ version: 4, entries: { [id]: 5 } }, 10), { version: 1, entries: {} })
})
