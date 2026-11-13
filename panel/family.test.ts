import { assert, test } from 'orca/testing'
import type { AgentView, FamilyChild } from '../src/protocol'
import { navigateToActivityPanel } from './navigation'
import { PARENT_ELSEWHERE_NOTE, PARENT_MISSING_NOTE, buildFamilyTree, familyControlFocusKey, familyExpansionKey, familyTreeNote, shouldShowFamilyTree, syncFamilyExpansion } from './family'

const agent = (id: string, title = id): AgentView => ({
  id,
  terminalId: null,
  paneKey: id,
  parentPaneKey: null,
  parentId: null,
  workspaceId: '/w',
  projectId: 'p',
  title,
  prompt: null,
  reply: null,
  agent: 'claude',
  state: 'working',
  outcome: null,
  unread: false,
  stateStartedAt: 1,
  finishedAt: null,
  firstSeenAt: 1,
  lastSeenAt: 1,
  active: [],
  recent: [],
  toolCount: 0,
  helpers: [],
  family: [],
  insight: null,
  history: []
})
const child = (id: string, overrides: Partial<FamilyChild> = {}): FamilyChild => ({
  id,
  kind: 'agent',
  name: id,
  description: 'Reported child details',
  tool: null,
  toolKind: null,
  state: 'working',
  reported: true,
  lastReportedAt: 1,
  missingSince: null,
  ...overrides
})

test('uses exact child ids, merges matching agent panels, and leaves multiple roots visible', () => {
  const root = { ...agent('root', 'same title'), family: [child('nested')] }
  const nested = agent('nested', 'same title')
  const other = agent('other', 'same title')
  const roots = buildFamilyTree([root, nested, other])
  assert.deepEqual(roots.map((node) => node.agent?.id), ['root', 'other'])
  assert.equal(roots[0].children[0].agent?.id, 'nested')
  assert.equal(roots[0].children[0].child?.id, 'nested')
  assert.equal(roots[1].relationship, 'root')
})

test('does not infer parent links from equal names or titles', () => {
  const parent = { ...agent('parent'), family: [child('different-id', { name: 'Scout' })] }
  const sameName = agent('real-agent', 'Scout')
  const roots = buildFamilyTree([parent, sameName])
  assert.deepEqual(roots.map((node) => node.agent?.id), ['parent', 'real-agent'])
  assert.equal(roots[0].children[0].agent, null)
  assert.equal(roots[0].children[0].child?.name, 'Scout')
})

test('keeps unknown identity and state visible without inventing a main agent', () => {
  const parent = {
    ...agent('parent'),
    family: [
      child('', { name: 'Unidentified agent', state: 'unknown', reported: false, missingSince: 5 }),
      child('', { name: 'Unidentified agent', state: 'unknown', reported: false, missingSince: 5 })
    ]
  }
  const [root] = buildFamilyTree([parent])
  assert.equal(root.children.length, 2)
  assert.equal(root.children[0].agent, null)
  assert.equal(root.children[0].relationship, 'child')
  assert.equal(root.children[0].child?.reported, false)
})

test('represents children reported by multiple parents once as an explicit multi-parent root', () => {
  const a = { ...agent('a'), family: [child('shared')] }
  const b = { ...agent('b'), family: [child('shared')] }
  const shared = agent('shared')
  const roots = buildFamilyTree([a, b, shared])
  assert.deepEqual(roots.map((node) => node.agent?.id), ['a', 'b', 'shared'])
  const relation = roots[2]
  assert.equal(relation.relationship, 'multiple')
  assert.deepEqual(relation.reportedParents, ['a', 'b'])
  assert.equal(roots[0].children.length, 0)
  assert.equal(roots[1].children.length, 0)
  assert.equal(shouldShowFamilyTree([a, b, shared]), true)
})


test('stops a reported cycle without losing either node', () => {
  const a = { ...agent('a'), family: [child('b')] }
  const b = { ...agent('b'), family: [child('a')] }
  const [root] = buildFamilyTree([a, b])
  assert.equal(root.agent?.id, 'a')
  assert.equal(root.children[0].agent?.id, 'b')
  assert.equal(root.children[0].children[0].cyclic, true)
  assert.deepEqual(root.children[0].children[0].children, [])
})

test('keeps branch expansion stable on updates and prunes departed branches', () => {
  const parent = { ...agent('parent'), family: [child('child')] }
  const [root] = buildFamilyTree([parent])
  const expanded = new Set<string>()
  const seen = new Set<string>()
  syncFamilyExpansion([root], expanded, seen)
  const key = familyExpansionKey(root)
  assert.equal(expanded.has(key), true)
  expanded.delete(key)
  const [updatedRoot] = buildFamilyTree([{ ...parent, family: [child('child', { description: 'Updated details' })] }])
  syncFamilyExpansion([updatedRoot], expanded, seen)
  assert.equal(expanded.has(key), false)
  assert.equal(familyControlFocusKey(root, 'branch'), familyControlFocusKey(updatedRoot, 'branch'))
  syncFamilyExpansion([], expanded, seen)
  assert.equal(seen.has(key), false)
})

test('a main-agent tree node expands and focuses its existing Activity panel', () => {
  const [root] = buildFamilyTree([agent('root')])
  const navigation = navigateToActivityPanel([], root.agent!.id)
  assert.deepEqual(navigation, { expanded: ['root'], focusTarget: 'root' })
})

test('shows the agent tree even when Orca has not reported child links', () => {
  const agents = [agent('solo'), agent('independent')]
  assert.equal(shouldShowFamilyTree(agents), true)
  assert.equal(shouldShowFamilyTree([]), false)
  assert.equal(familyTreeNote(buildFamilyTree(agents)).includes('No parent-child links reported by Orca.'), true)
  assert.equal(familyTreeNote(buildFamilyTree([{ ...agents[0], family: [child('independent')] }, agents[1]])).includes('Lines show parent → child links Orca reports'), true)
})

const linked = (id: string, parentId: string | null, overrides: Partial<AgentView> = {}): AgentView => ({
  ...agent(id),
  parentPaneKey: parentId === null ? null : `pane-${parentId}`,
  parentId,
  ...overrides
})

test('seeds an edge from a resolved parent across worktrees and keeps it separate from children', () => {
  const parent = { ...agent('parent'), workspaceId: '/w1', family: [child('command-agent')] }
  const worker = linked('worker', 'parent', { workspaceId: '/w2' })
  const [root, ...rest] = buildFamilyTree([worker, parent])
  assert.equal(rest.length, 0)
  assert.equal(root.agent?.id, 'parent')
  assert.deepEqual(root.children.map((node) => [node.agent?.id ?? null, node.child?.id ?? null]), [
    [null, 'command-agent'],
    ['worker', null]
  ])
  assert.equal(root.children[1].relationship, 'child')
  assert.deepEqual(root.children[1].reportedParents, ['parent'])
  assert.equal(root.parentNote, undefined)
})

test('a parent named by both sources produces one edge and keeps the reported child entry', () => {
  const parent = { ...agent('parent'), family: [child('worker')] }
  const [root] = buildFamilyTree([parent, linked('worker', 'parent')])
  assert.equal(root.children.length, 1)
  assert.equal(root.children[0].child?.id, 'worker')
})

test('a done parent with a working child keeps the child visible', () => {
  const parent = { ...agent('parent'), state: 'done' as const, outcome: 'success' }
  const roots = buildFamilyTree([parent, linked('worker', 'parent')])
  assert.equal(roots.length, 1)
  assert.equal(roots[0].agent?.state, 'done')
  assert.equal(roots[0].children[0].agent?.state, 'working')
  assert.equal(roots[0].children[0].cyclic, false)
})

test('an unresolved parent leaves an unlinked agent with a short note and invents no parent', () => {
  const orphan = linked('orphan', null, { parentPaneKey: 'pane-gone' })
  const peer = agent('peer')
  const roots = buildFamilyTree([orphan, peer])
  assert.deepEqual(roots.map((node) => node.agent?.id), ['orphan', 'peer'])
  assert.equal(roots[0].parentNote, PARENT_MISSING_NOTE)
  assert.equal(roots[1].parentNote, undefined)
  assert.equal(roots[0].children.length, 0)
  assert.equal(familyTreeNote(roots).includes('not shown here'), true)
})

test('a parent resolved outside the listed agents is noted as outside this view', () => {
  const [root] = buildFamilyTree([linked('worker', 'elsewhere')])
  assert.equal(root.parentNote, PARENT_ELSEWHERE_NOTE)
  assert.equal(root.relationship, 'root')
})

test('a self reference is ignored and leaves the agent as a noted root', () => {
  const [root] = buildFamilyTree([linked('loner', 'loner')])
  assert.equal(root.children.length, 0)
  assert.equal(root.parentNote, PARENT_MISSING_NOTE)
})

test('agents without the parent fields behave as before', () => {
  const old = (({ parentPaneKey: _p, parentId: _i, ...rest }) => rest as unknown as AgentView)(agent('old'))
  const roots = buildFamilyTree([old, agent('other')])
  assert.deepEqual(roots.map((node) => node.agent?.id), ['old', 'other'])
  assert.equal(roots.every((node) => node.parentNote === undefined && node.children.length === 0), true)
  assert.equal(familyTreeNote(roots).startsWith('No parent-child links reported by Orca.'), true)
})

test('a parent cycle stops without losing either agent, and a second parent source makes a multi-parent root', () => {
  const [anchor] = buildFamilyTree([linked('a', 'b'), linked('b', 'a')])
  assert.equal(anchor.relationship, 'cycle-anchor')
  assert.equal(anchor.children[0].children[0].cyclic, true)

  const a = { ...agent('a'), family: [child('shared')] }
  const roots = buildFamilyTree([a, agent('b'), linked('shared', 'b')])
  const shared = roots.find((node) => node.agent?.id === 'shared')!
  assert.equal(shared.relationship, 'multiple')
  assert.deepEqual(shared.reportedParents, ['a', 'b'])
})
