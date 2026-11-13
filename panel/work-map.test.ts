import { assert, test } from 'orca/testing'
import { taskLabel, projectGroups, cursorFor, sinceCursor, groupToolEvents } from './work-map'
import type { AgentView, JournalEvent } from '../src/protocol'

const agent = (id: string, projectId: string | null, workspaceId: string | null): AgentView => ({
  id, projectId, workspaceId, title: null, prompt: null, terminalId: null, paneKey: null, parentPaneKey: null, parentId: null,
  agent: 'codex', reply: null, state: 'working', outcome: null, unread: false,
  stateStartedAt: 1, finishedAt: null, firstSeenAt: 1, lastSeenAt: 1,
  active: [], recent: [], toolCount: 0, helpers: [], family: [], insight: null, history: []
})

test('task title precedes a visibly identified prompt excerpt and does not invent a title', () => {
  assert.equal(taskLabel({ ...agent('a', null, null), title: 'Update layout', prompt: 'Build it' }), 'Update layout')
  assert.equal(taskLabel({ ...agent('a', null, null), prompt: 'Build it' }), 'Asked excerpt: Build it')
  assert.equal(taskLabel(agent('a', null, null)), 'Task not reported')
})

test('project groups preserve input order and isolate unmapped workspaces', () => {
  const groups = projectGroups([agent('a', 'p', '/a'), agent('b', null, '/b'), agent('c', 'p', '/c'), agent('d', null, null)])
  assert.deepEqual(groups.map((g) => [g.id, g.agents.map((a) => a.id)]), [['p', ['a', 'c']], ['/b', ['b']], ['', ['d']]])
})

test('a cursor keeps later events and unseen events at the same timestamp', () => {
  const events = [
    { id: 'a', observedAt: 100 }, { id: 'b', observedAt: 100 }, { id: 'c', observedAt: 101 }
  ]
  assert.deepEqual(sinceCursor(events, { at: 100, ids: ['a'] }).map((event) => event.id), ['b', 'c'])
  assert.deepEqual(cursorFor(events), { at: 101, ids: ['c'] })
  assert.deepEqual(cursorFor(events.slice(0, 2)), { at: 100, ids: ['a', 'b'] })
})

test('groups only consecutive matching tool observations without losing the individual events', () => {
  const tool = (id: string, overrides: Partial<JournalEvent> = {}): JournalEvent => ({ id, agentId: 'a', projectId: 'p', workspaceId: '/w', kind: 'tool', source: 'roster', coverage: 'sampled', observedAt: Number(id), tool: 'Edit', detail: 'file', ...overrides })
  const events = [tool('1'), tool('2'), tool('3', { kind: 'state' }), tool('4'), tool('5', { source: 'hook' }), tool('6', { agentId: 'b' }), tool('7', { detail: 'other' }), tool('8', { kind: 'result' }), tool('9', { detail: 'other' })]
  assert.deepEqual(groupToolEvents(events).map((group) => group.map((event) => event.id)), [['1', '2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9']])
})
