import { assert, test } from 'orca/testing'
import type { FamilyNode } from './family'
import { chartLayout, needsAttention, attentionBranches } from './chart'

const node = (key: string, children: FamilyNode[] = [], cyclic = false): FamilyNode => ({ key, agent: null, child: null, parentId: null, relationship: 'root', reportedParents: [], cyclic, children })

test('places peers side by side and distinguishes project membership from child edges', () => {
  const roots = [node('a', [node('c')]), node('b')]
  const layout = chartLayout(roots, new Set(['a']))
  assert.equal(layout.nodes.length, 3)
  assert.equal(layout.edges.filter((edge) => edge.kind === 'membership').length, 2)
  assert.deepEqual(layout.edges.filter((edge) => edge.kind === 'child').map((edge) => [edge.from, edge.to]), [['a', 'c']])
  const positions = new Map(layout.nodes.map((item) => [item.node.key, item]))
  assert.equal(positions.get('a')!.y, positions.get('b')!.y)
  assert.ok(positions.get('a')!.x < positions.get('b')!.x)
  assert.ok(positions.get('c')!.y > positions.get('a')!.y)
})

test('collapsed branches and cycles do not create ghost nodes or connections', () => {
  const root = node('a', [node('b', [node('cycle', [], true)])])
  assert.equal(chartLayout([root], new Set()).nodes.length, 1)
  const layout = chartLayout([root], new Set(['a', 'b']))
  assert.equal(layout.nodes.length, 2)
  assert.equal(layout.edges.filter((edge) => edge.kind === 'child').length, 1)
})

test('multi-parent nodes retain each explicit reported edge without duplicating the node', () => {
  const a = { ...node('a'), agent: { id: 'a' } as FamilyNode['agent'] }
  const b = { ...node('b'), agent: { id: 'b' } as FamilyNode['agent'] }
  const shared = { ...node('shared'), agent: { id: 'shared' } as FamilyNode['agent'], relationship: 'multiple' as const, reportedParents: ['a', 'b'] }
  const layout = chartLayout([a, b, shared], new Set())
  assert.equal(layout.nodes.length, 3)
  assert.deepEqual(layout.edges.filter((edge) => edge.kind === 'child').map((edge) => [edge.from, edge.to]), [['a', 'shared'], ['b', 'shared']])
})

test('attention uses reported blocked states and actual failure outcomes only', () => {
  const agent = (state: string, outcome: string | null) => ({ ...node('agent'), agent: { state, outcome } as FamilyNode['agent'] })
  const helper = (state: string, reported: boolean) => ({ ...node('helper'), child: { state, reported } as FamilyNode['child'] })
  assert.equal(needsAttention(agent('blocked', null)), true)
  assert.equal(needsAttention(agent('done', 'failure')), true)
  assert.equal(needsAttention(agent('done', 'success')), false)
  assert.equal(needsAttention(agent('working', null)), false)
  assert.equal(needsAttention(helper('blocked', true)), true)
  assert.equal(needsAttention(helper('blocked', false)), false)
  assert.equal(needsAttention(helper('done', true)), false)
})

test('attention reveals nested ancestors while preserving existing expanded branches', () => {
  const attention = { ...node('c'), agent: { state: 'blocked', outcome: null } as FamilyNode['agent'] }
  const roots = [node('a', [node('b', [attention])]), node('d', [node('e')])]
  const expanded = attentionBranches(roots, new Set(['d']))
  assert.deepEqual([...expanded].sort(), ['a', 'b', 'd'])
  assert.deepEqual([...attentionBranches([node('empty')], new Set())], [])
})
