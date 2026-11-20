import { assert, test } from 'orca/testing'
import { taskLabel, pinnedTaskLabel, pinnedIdentityLabel, projectGroups, orderProjects, moveProject, cursorFor, sinceCursor, groupToolEvents } from './work-map'
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

test('pinned task titles omit only a matching provider suffix', () => {
  assert.equal(pinnedTaskLabel({ ...agent('a', null, null), agent: 'copilot', title: 'Ship the fix - GitHub Copilot' }), 'Ship the fix')
  assert.equal(pinnedTaskLabel({ ...agent('b', null, null), agent: 'claude', title: 'Review changes — Claude Code' }), 'Review changes')
  assert.equal(pinnedTaskLabel({ ...agent('c', null, null), agent: 'codex', title: 'Review changes - GitHub Copilot' }), 'Review changes - GitHub Copilot')
  assert.equal(pinnedTaskLabel({ ...agent('d', null, null), agent: 'copilot', prompt: 'Build it' }), 'Asked excerpt: Build it')
})

test('pinned identity labels include project and worktree before the friendly name', () => {
  assert.equal(pinnedIdentityLabel('Orca', 'feature/lobby', 'Indy'), 'Orca · feature/lobby · Indy')
  assert.equal(pinnedIdentityLabel('Orca', 'Orca', 'Indy'), 'Orca · Indy')
  assert.equal(pinnedIdentityLabel('', 'feature/lobby', 'Indy'), 'feature/lobby · Indy')
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

test('orders projects as chosen, then by the sidebar, then by name, with no project last', () => {
  const name = (id: string): string => id.toUpperCase()
  assert.deepEqual(orderProjects(['', 'c', 'b', 'a', 'z'], name, { b: 0, a: 1 }), ['b', 'a', 'c', 'z', ''])
  assert.deepEqual(orderProjects(['', 'c', 'b', 'a'], name, { b: 0, a: 1 }, ['a', 'gone']), ['a', 'b', 'c', ''])
})

test('moves a project one step, never past either end or below the room with no project', () => {
  assert.deepEqual(moveProject(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(moveProject(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c'])
  assert.deepEqual(moveProject(['a', 'b', ''], 'b', 1), ['a', 'b', ''])
  assert.deepEqual(moveProject(['a'], 'x', 1), ['a'])
})
