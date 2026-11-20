import { assert, test } from 'orca/testing'
import { filterAgents, normalizeSearch } from './search'
import type { AgentView, OfficeSnapshot } from '../src/protocol'

const row = (id: string, extra: Partial<AgentView> = {}): AgentView => ({
  id, terminalId: null, paneKey: id, parentPaneKey: null, parentId: null, workspaceId: '/work', projectId: 'p',
  branch: 'main', hostId: null, hostName: 'Local', sessionId: null, completionId: null, completionTracked: false,
  title: id, prompt: null, reply: null, agent: 'codex', state: 'working', outcome: null, unread: false,
  stateStartedAt: 1, finishedAt: null, firstSeenAt: 1, lastSeenAt: 1, active: [], recent: [], toolCount: 0,
  helpers: [], family: [], insight: null, history: [], ...extra
})
const office: Pick<OfficeSnapshot, 'projects' | 'workspaces'> = { projects: { p: 'Alpha' }, workspaces: { '/work': 'Workspace' } }

test('search uses normalized literal text and explicit context, retaining chart ancestors', () => {
  const rows = [row('parent'), row('child', { parentId: 'parent', title: 'Feature [one]' }), row('other', { projectId: 'q', workspaceId: '/else', title: 'Feature one' })]
  assert.equal(normalizeSearch('  FEATuRE  [One] '), 'feature [one]')
  assert.deepEqual(filterAgents(rows, office, 'feature [one]', 'p').map((agent) => agent.id), ['parent', 'child'])
  assert.deepEqual(filterAgents(rows, office, 'feature.*', 'all'), [])
})
