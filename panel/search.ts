import { workspaceContext, type AgentView, type OfficeSnapshot } from '../src/protocol'

export const normalizeSearch = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

export function filterAgents(agents: readonly AgentView[], office: Pick<OfficeSnapshot, 'projects' | 'workspaces'>, query: string, project: string, nameOf: (agent: AgentView) => string = () => '', retainAncestors = true): AgentView[] {
  const needle = normalizeSearch(query)
  const context = (agent: AgentView): string[] => {
    const known = workspaceContext(agent, office)
    return [agent.title, agent.prompt, nameOf(agent), agent.agent, known.project, known.workspace, known.branch, known.host]
      .filter((value): value is string => Boolean(value))
  }
  const matchesProject = (agent: AgentView): boolean => project === 'all' || (agent.projectId ?? agent.workspaceId ?? '') === project
  const selected = new Set(agents.filter((agent) => matchesProject(agent) && (!needle || context(agent).some((value) => normalizeSearch(value).includes(needle)))).map((agent) => agent.id))
  // Keep only the reported ancestors needed to place matching agents in the family chart.
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  for (const id of retainAncestors ? [...selected] : []) {
    let parent = byId.get(id)?.parentId
    const seen = new Set<string>()
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      const row = byId.get(parent)
      if (!row || !matchesProject(row)) break
      selected.add(parent)
      parent = row.parentId
    }
  }
  return agents.filter((agent) => selected.has(agent.id))
}
