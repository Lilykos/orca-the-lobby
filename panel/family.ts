import type { AgentView, FamilyChild } from '../src/protocol'

export type FamilyNode = {
  key: string
  /** An agent row is linked only when Orca's child id exactly matches its id. */
  agent: AgentView | null
  child: FamilyChild | null
  parentId: string | null
  relationship: 'root' | 'child' | 'multiple' | 'cycle-anchor'
  reportedParents: string[]
  cyclic: boolean
  /** Set on a root whose agent names a parent Orca did not resolve to an agent in this view. */
  parentNote?: string
  children: FamilyNode[]
}

export const PARENT_MISSING_NOTE = 'Parent not in current roster'
export const PARENT_ELSEWHERE_NOTE = 'Parent is outside this view'

/** Builds only the links Orca reports: an agent's resolved `parentId` (exact `parentPaneKey` match)
 *  and the agent children in its `family`. The two stay separate sources and never join by name. */
export function buildFamilyTree(agents: AgentView[]): FamilyNode[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  const edges = new Map<string, Array<{ parentId: string; child: FamilyChild }>>()
  const childrenByParent = new Map<string, FamilyChild[]>()
  for (const parent of agents) {
    const unique = new Set<string>()
    for (const [index, child] of (parent.family ?? []).entries()) {
      if (child.kind === 'agent') {
        const edgeKey = child.id || `unknown:${index}`
        if (unique.has(edgeKey)) continue
        unique.add(edgeKey)
        childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), child])
        if (child.id) edges.set(child.id, [...(edges.get(child.id) ?? []), { parentId: parent.id, child }])
      }
    }
  }
  // A resolved parent link seeds an edge unless that parent's own children already name the agent.
  // Its node carries no FamilyChild, since Orca reported no child entry for it.
  const parentLinks = new WeakSet<FamilyChild>()
  for (const agent of agents) {
    const parentId = agent.parentId
    if (!parentId || parentId === agent.id || !byId.has(parentId)) continue
    const siblings = childrenByParent.get(parentId) ?? []
    if (siblings.some((sibling) => sibling.id === agent.id)) continue
    const link: FamilyChild = {
      id: agent.id,
      kind: 'agent',
      name: agent.title ?? agent.id,
      description: '',
      tool: null,
      toolKind: null,
      state: agent.state,
      reported: true,
      lastReportedAt: agent.lastSeenAt,
      missingSince: null
    }
    parentLinks.add(link)
    childrenByParent.set(parentId, [...siblings, link])
    edges.set(agent.id, [...(edges.get(agent.id) ?? []), { parentId, child: link }])
  }
  const parentsFor = new Map<string, string[]>()
  for (const [id, rows] of edges) parentsFor.set(id, [...new Set(rows.map((row) => row.parentId))].sort())

  const childNodes = (parent: AgentView, path: Set<string>): FamilyNode[] => {
    const unique = new Set<string>()
    const nodes: FamilyNode[] = []
    for (const [index, child] of (childrenByParent.get(parent.id) ?? []).entries()) {
      // Commands are work attached to the agent, not agent-family nodes.
      if (child.id && unique.has(child.id)) continue
      if (child.id) unique.add(child.id)
      const linked = child.id ? byId.get(child.id) ?? null : null
      const reportedParents = child.id ? parentsFor.get(child.id) ?? [] : [parent.id]
      // A child listed under more than one parent cannot be represented as one tree edge without
      // choosing a parent. It appears once as an explicitly multi-parent root instead.
      if (linked && reportedParents.length > 1) continue
      const cyclic = Boolean(linked && path.has(linked.id))
      const nextPath = new Set(path)
      if (linked) nextPath.add(linked.id)
      nodes.push({
        key: `child:${parent.id}:${child.id || `unknown-${index}`}`,
        agent: linked,
        child: parentLinks.has(child) ? null : child,
        parentId: parent.id,
        relationship: 'child',
        reportedParents,
        cyclic,
        children: linked && !cyclic ? childNodes(linked, nextPath) : []
      })
    }
    return nodes
  }

  const roots = agents.filter((agent) => (parentsFor.get(agent.id)?.length ?? 0) !== 1)
  const anchors = new Set<string>()
  const reached = new Set<string>()
  const markReachable = (agent: AgentView, path: Set<string>): void => {
    if (path.has(agent.id) || reached.has(agent.id)) return
    reached.add(agent.id)
    const nextPath = new Set(path).add(agent.id)
    for (const child of childrenByParent.get(agent.id) ?? []) {
      const nested = byId.get(child.id)
      if (!nested || (parentsFor.get(nested.id)?.length ?? 0) > 1) continue
      markReachable(nested, nextPath)
    }
  }
  roots.forEach((root) => markReachable(root, new Set()))
  for (const agent of [...agents].sort((a, b) => a.id.localeCompare(b.id))) {
    if (reached.has(agent.id)) continue
    roots.push(agent)
    anchors.add(agent.id)
    markReachable(agent, new Set())
  }
  return roots.map((agent) => {
    const reportedParents = parentsFor.get(agent.id) ?? []
    const relationship = reportedParents.length > 1
      ? 'multiple'
      : anchors.has(agent.id) ? 'cycle-anchor' : 'root'
    return {
      key: `root:${agent.id}`,
      agent,
      child: null,
      parentId: null,
      relationship,
      reportedParents,
      cyclic: false,
      ...unresolvedParent(agent, byId),
      children: childNodes(agent, new Set([agent.id]))
    }
  })
}

function unresolvedParent(agent: AgentView, byId: Map<string, AgentView>): { parentNote?: string } {
  if (!agent.parentPaneKey || (agent.parentId && agent.parentId !== agent.id && byId.has(agent.parentId))) return {}
  return { parentNote: agent.parentId && agent.parentId !== agent.id ? PARENT_ELSEWHERE_NOTE : PARENT_MISSING_NOTE }
}

export function familyExpansionKey(node: FamilyNode): string {
  return node.key
}

export function shouldShowFamilyTree(agents: AgentView[]): boolean {
  return agents.length > 0
}

export function familyTreeNote(roots: FamilyNode[]): string {
  const hasLinks = roots.some((node) => node.children.length > 0 || node.relationship === 'multiple')
  const unresolved = roots.some((node) => node.parentNote)
  return `${hasLinks ? 'Lines show parent → child links Orca reports; other parent relationships are not assumed.' : 'No parent-child links reported by Orca.'}${unresolved ? ' Some agents name a parent that is not shown here.' : ''} Commands stay under Calls; child outcomes and message routing are not provided.`
}

export function childDetailKey(node: FamilyNode): string {
  return `detail:${node.key}`
}

export function familyControlFocusKey(node: FamilyNode, control: 'agent' | 'child' | 'detail' | 'branch'): string {
  return `family-${control}:${node.key}`
}

/** Defaults new branches open once, then keeps the person's choice stable across data updates. */
export function syncFamilyExpansion(
  nodes: FamilyNode[],
  expanded: Set<string>,
  seen: Set<string>
): void {
  const present = new Set<string>()
  const visit = (node: FamilyNode): void => {
    present.add(node.key)
    if (node.children.length && !seen.has(node.key)) expanded.add(node.key)
    seen.add(node.key)
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  for (const key of expanded) if (!present.has(key)) expanded.delete(key)
  for (const key of seen) if (!present.has(key)) seen.delete(key)
}
