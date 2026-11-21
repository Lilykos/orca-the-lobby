import { attentionGroups } from '../src/attention'
import { workspaceContext, type AgentView, type OfficeSnapshot } from '../src/protocol'
import { taskLabel } from './work-map'

export type AttentionActions = {
  go: (agent: AgentView, done: (error?: string) => void) => void
  canGo: (agent: AgentView) => boolean | null
  details: (agent: AgentView) => void
  review: (agent: AgentView, done: (error?: string) => void) => void
}

const elapsed = (from: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

export function attentionTimeText(agent: Pick<AgentView, 'state' | 'stateStartedAt' | 'finishedAt'> & Partial<Pick<AgentView, 'finishedAtSource'>>, now: number): string {
  if (agent.state === 'blocked') return Number.isFinite(agent.stateStartedAt) ? `Needs you for ${elapsed(agent.stateStartedAt, now)}` : 'Needs you · time unavailable'
  if (agent.state === 'done') {
    if (typeof agent.finishedAt === 'number' && Number.isFinite(agent.finishedAt)) {
      const time = elapsed(agent.finishedAt, now)
      if (agent.finishedAtSource === 'source') return `Finished ${time} ago`
      return `${agent.finishedAtSource === 'observed' || agent.finishedAtSource === null ? 'Done observed' : 'Done time recorded'} ${time} ago`
    }
    return Number.isFinite(agent.stateStartedAt) ? `Done observed ${elapsed(agent.stateStartedAt, now)} ago` : 'Finish time unavailable'
  }
  return 'Time unavailable'
}

const el = (tag: string, className = '', text = ''): HTMLElement => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

/** Rebuilds only the inbox, preserving its reading position and current control where possible. */
export function renderAttention(root: HTMLElement, office: OfficeSnapshot, reviewed: Set<string>, actions: AttentionActions, liveAgentCount = office.agents.length, filteredOut = false, nameOf: (agent: AgentView) => string = () => ''): void {
  const active = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null
  const focused = active?.dataset.focusKey
  const previousControls = [...root.querySelectorAll<HTMLButtonElement>('button[data-focus-key]:not(:disabled)')]
  const focusIndex = focused ? previousControls.findIndex((control) => control.dataset.focusKey === focused) : -1
  const scroll = root.scrollTop
  const pageScroll = document.scrollingElement?.scrollTop ?? 0
  const groups = attentionGroups(office.agents, reviewed)
  const sections = [
    ['needs-input', 'Needs input', groups.needsInput],
    ['failed', 'Failed to review', groups.failedToReview],
    ['finished', 'Finished to review', groups.finishedToReview]
  ] as const
  const fragment = document.createDocumentFragment()
  const title = el('h1', 'attention-heading', 'Attention')
  title.tabIndex = -1
  title.dataset.focusKey = 'attention-heading'
  fragment.append(title)
  const summary = el('p', 'attention-counts', `${groups.needsInput.length} need input · ${groups.failedToReview.length} failed · ${groups.finishedToReview.length} finished to review`)
  summary.setAttribute('aria-live', 'polite')
  fragment.append(summary)
  if (!groups.needsInput.length && !groups.failedToReview.length && !groups.finishedToReview.length)
    fragment.append(el('p', 'attention-empty', filteredOut ? 'No agents match these filters.' : liveAgentCount ? 'Nothing needs your attention right now.' : 'No live agents to show yet.'))
  for (const [key, label, rows] of sections) {
    if (!rows.length) continue
    const section = el('section', 'attention-group')
    const heading = el('h2', '', `${label} (${rows.length})`)
    section.append(heading)
    for (const agent of rows) {
      const card = el('article', `attention-card attention-${key}`)
      const name = taskLabel(agent)
      card.append(el('h3', 'attention-title', name), el('p', 'attention-state', agent.state === 'blocked' ? 'Needs you' : agent.outcome === 'failure' ? 'Failed' : `Finished · ${agent.outcome ?? 'outcome unknown'}`))
      if (nameOf(agent)) card.append(el('p', 'attention-name', nameOf(agent)))
      const time = document.createElement('time')
      time.className = 'attention-time'
      time.textContent = attentionTimeText(agent, Date.now())
      time.dataset.attentionTime = ''
      time.dataset.agentId = agent.id
      if (agent.state === 'done' && agent.finishedAt !== null && Number.isFinite(agent.finishedAt)) {
        const date = new Date(agent.finishedAt)
        if (Number.isFinite(date.getTime())) time.dateTime = date.toISOString()
      }
      card.append(time)
      const context = workspaceContext(agent, office)
      const meta = [agent.agent ? agent.agent[0].toUpperCase() + agent.agent.slice(1) : '', context.project, context.workspace, context.branch, context.host].filter(Boolean)
      if (meta.length) card.append(el('p', 'attention-meta', meta.join(' · ')))
      const status = el('p', 'attention-feedback')
      status.setAttribute('role', 'status')
      const button = (label: string, action: () => void, keyName: string, disabled = false): HTMLButtonElement => {
        const control = document.createElement('button')
        control.className = 'action'
        control.textContent = label
        control.dataset.focusKey = `${key}:${agent.id}:${keyName}`
        control.disabled = disabled
        control.addEventListener('click', action)
        return control
      }
      const controls = el('div', 'attention-actions')
      const canGo = actions.canGo(agent)
      const go = button('Go to agent', () => actions.go(agent, (message) => { status.textContent = message ?? '' }), 'go', !canGo)
      controls.append(go, button('Review details', () => actions.details(agent), 'details'))
      if (canGo !== true) controls.append(el('span', 'attention-unavailable', canGo === null ? 'Checking navigation…' : 'Navigation unavailable'))
      if (key !== 'needs-input') controls.append(button('Mark Reviewed', () => actions.review(agent, (error) => {
        status.textContent = error ?? 'Reviewed in The Lobby.'
        if (!error) {
          const next = controls.querySelector<HTMLElement>('[data-focus-key]')
          next?.focus({ preventScroll: true })
        }
      }), 'review'))
      card.append(controls, status)
      section.append(card)
    }
    fragment.append(section)
  }
  root.replaceChildren(fragment)
  root.scrollTop = scroll
  if (document.scrollingElement) document.scrollingElement.scrollTop = pageScroll
  if (focused) {
    const target = root.querySelector<HTMLButtonElement>(`button[data-focus-key="${CSS.escape(focused)}"]:not(:disabled)`)
    const controls = [...root.querySelectorAll<HTMLButtonElement>('button[data-focus-key]:not(:disabled)')]
    if (focused === 'attention-heading') root.querySelector<HTMLElement>('.attention-heading')?.focus({ preventScroll: true })
    else if (target) target.focus({ preventScroll: true })
    else if (controls.length) controls[Math.min(Math.max(focusIndex, 0), controls.length - 1)].focus({ preventScroll: true })
    else root.querySelector<HTMLElement>('.attention-heading')?.focus({ preventScroll: true })
  } else if (active?.classList.contains('attention-heading')) {
    root.querySelector<HTMLElement>('.attention-heading')?.focus({ preventScroll: true })
  }
}

export function refreshAttentionTimes(root: HTMLElement, agents: readonly AgentView[], now: number): void {
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  for (const node of root.querySelectorAll<HTMLElement>('[data-attention-time]')) {
    const agent = byId.get(node.dataset.agentId ?? '')
    if (agent) node.textContent = attentionTimeText(agent, now)
  }
}
