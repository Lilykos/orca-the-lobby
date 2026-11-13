import type { FamilyNode } from './family'

export const NODE_WIDTH = 112
export const NODE_HEIGHT = 90
const GAP = 12
const TOP = 86
const LEVEL = 126
const MARGIN = 12

type ChartNode = { node: FamilyNode; x: number; y: number }
type Edge = { from: string | null; to: string; kind: 'membership' | 'child' }

/** Stable top-down tree packing; only supplied parent-child links become child edges. */
export function chartLayout(roots: FamilyNode[], expanded: ReadonlySet<string>): { nodes: ChartNode[]; edges: Edge[]; width: number; height: number } {
  const nodes: ChartNode[] = []
  const edges: Edge[] = []
  const children = (node: FamilyNode): FamilyNode[] => expanded.has(node.key) ? node.children.filter((child) => !child.cyclic) : []
  const span = (node: FamilyNode): number => {
    const branches = children(node)
    return branches.length ? Math.max(NODE_WIDTH, branches.reduce((sum, child) => sum + span(child), 0) + GAP * (branches.length - 1)) : NODE_WIDTH
  }
  function place(node: FamilyNode, left: number, depth: number): void {
    const breadth = span(node)
    nodes.push({ node, x: left + (breadth - NODE_WIDTH) / 2, y: TOP + depth * LEVEL })
    let offset = left
    for (const child of children(node)) {
      edges.push({ from: node.key, to: child.key, kind: 'child' })
      place(child, offset, depth + 1)
      offset += span(child) + GAP
    }
  }
  let left = MARGIN
  for (const root of roots.filter((root) => !root.cyclic)) {
    edges.push({ from: null, to: root.key, kind: 'membership' })
    place(root, left, 0)
    left += span(root) + GAP
  }
  const byAgent = new Map(nodes.filter((item) => item.node.agent).map((item) => [item.node.agent!.id, item.node]))
  for (const item of nodes) {
    if (item.node.relationship !== 'multiple') continue
    for (const parentId of item.node.reportedParents) {
      const parent = byAgent.get(parentId)
      if (parent && parent.key !== item.node.key) edges.push({ from: parent.key, to: item.node.key, kind: 'child' })
    }
  }
  return {
    nodes, edges,
    width: Math.max(180, left - GAP + MARGIN),
    height: nodes.length ? Math.max(...nodes.map((item) => item.y + NODE_HEIGHT)) + MARGIN + 20 : TOP
  }
}

/** Only reported state counts: a blocked agent or helper, or a finished agent whose outcome is failure. */
export function needsAttention(node: FamilyNode): boolean {
  if (node.agent) return node.agent.state === 'blocked' || (node.agent.state === 'done' && node.agent.outcome === 'failure')
  return Boolean(node.child?.reported && node.child.state === 'blocked')
}

/** True when the node or anything beneath it needs attention, so its ancestors can stay as context. */
export function hasAttention(node: FamilyNode): boolean {
  return needsAttention(node) || node.children.some((child) => !child.cyclic && hasAttention(child))
}

/** The expanded branches plus every ancestor of a node that needs attention; the input is not changed. */
export function attentionBranches(roots: FamilyNode[], expanded: ReadonlySet<string>): Set<string> {
  const open = new Set(expanded)
  const visit = (node: FamilyNode): boolean => {
    const below = node.children.filter((child) => !child.cyclic).map(visit).some(Boolean)
    if (below) open.add(node.key)
    return below || needsAttention(node)
  }
  roots.filter((root) => !root.cyclic).forEach(visit)
  return open
}
