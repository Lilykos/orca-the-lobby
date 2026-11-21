import { attentionGroups } from '../src/attention'
import { workspaceContext, type AgentView, type OfficeSnapshot } from '../src/protocol'
import { taskLabel } from './work-map'

export type AttentionActions = {
  go: (agent: AgentView, done: (error?: string) => void) => void
  canGo: (agent: AgentView) => boolean | null
  details: (agent: AgentView) => void
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

let finishedExpanded = false

function attentionRow(agent: AgentView, group: string, disambiguate: boolean, office: OfficeSnapshot, actions: AttentionActions): HTMLElement {
  const card = el('article', `attention-row attention-${group}${group === 'finished' ? ' attention-finished-row' : ''}`)
  card.dataset.agentId = agent.id
  const name = taskLabel(agent)
  const title = el('button', 'attention-title', name) as HTMLButtonElement
  title.type = 'button'
  title.dataset.focusKey = `attention-title:${agent.id}`
  title.setAttribute('aria-label', `Review details: ${name}`)
  title.title = name
  title.addEventListener('click', () => actions.details(agent))
  const context = workspaceContext(agent, office)
  const contextLabels = [context.project, ...(disambiguate ? [context.workspace, context.branch, context.host] : [])].filter(Boolean)
  const meta = el('p', 'attention-meta')
  if (group === 'finished' && agent.outcome !== 'success' && agent.outcome !== 'failure') contextLabels.unshift('Outcome unknown')
  if (contextLabels.length) meta.append(document.createTextNode(`${contextLabels.join(' · ')} · `))
  const time = document.createElement('time')
  time.className = 'attention-time'
  time.textContent = attentionTimeText(agent, Date.now())
  time.dataset.attentionTime = ''
  time.dataset.agentId = agent.id
  if (agent.state === 'done' && agent.finishedAt !== null && Number.isFinite(agent.finishedAt)) {
    const date = new Date(agent.finishedAt)
    if (Number.isFinite(date.getTime())) time.dateTime = date.toISOString()
  }
  meta.append(time)
  card.append(title, meta)
  const status = el('p', 'attention-feedback')
  status.setAttribute('role', 'status')
  const controls = el('div', 'attention-actions')
  const canGo = actions.canGo(agent)
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'action'
  go.textContent = 'Open agent'
  go.dataset.focusKey = `attention-open:${agent.id}`
  go.disabled = canGo !== true
  go.setAttribute('aria-label', `Open agent: ${name}`)
  go.addEventListener('click', () => actions.go(agent, (message) => { status.textContent = message ?? '' }))
  if (canGo !== true) {
    const explanation = el('span', 'attention-unavailable', canGo === null ? 'Checking navigation availability.' : 'Navigation unavailable for this agent.')
    explanation.id = `attention-unavailable:${agent.id}`
    go.setAttribute('aria-describedby', explanation.id)
    controls.append(go, explanation)
  } else controls.append(go)
  card.append(controls, status)
  return card
}

/** Rebuilds only the inbox, preserving its reading position and current control where possible. */
export function renderAttention(root: HTMLElement, office: OfficeSnapshot, reviewed: Set<string>, actions: AttentionActions, liveAgentCount = office.agents.length, filteredOut = false, nameOf: (agent: AgentView) => string = () => '', revealFinished = false): void {
  const active = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null
  const focused = active?.dataset.focusKey
  const visible = (node: HTMLElement): boolean => {
    const closedDetails = node.closest('details:not([open])')
    return node.isConnected && node.getClientRects().length > 0 && node.checkVisibility()
      && (!closedDetails || closedDetails.querySelector(':scope > summary') === node)
  }
  const canFocus = (node: HTMLElement): boolean => visible(node)
    && (node.tabIndex >= 0 || node.matches('.attention-heading, .attention-group h2'))
    && !(node instanceof HTMLButtonElement && node.disabled)
  const previousStops = [...root.querySelectorAll<HTMLElement>('[data-focus-key]')].filter(canFocus)
  const focusIndex = focused ? previousStops.findIndex((stop) => stop.dataset.focusKey === focused) : -1
  const scroll = root.scrollTop
  const pageScroll = document.scrollingElement?.scrollTop ?? 0
  const groups = attentionGroups(office.agents, reviewed)
  const sections = [
    ['needs-input', 'Needs input', groups.needsInput],
    ['failed', 'Failed', groups.failedToReview]
  ] as const
  const contextCounts = new Map<string, number>()
  for (const agent of office.agents) {
    const context = workspaceContext(agent, office)
    const key = `${taskLabel(agent)}\u0000${context.project ?? ''}`
    contextCounts.set(key, (contextCounts.get(key) ?? 0) + 1)
  }
  const fragment = document.createDocumentFragment()
  const title = el('h1', 'attention-heading', 'Attention')
  title.tabIndex = -1
  title.dataset.focusKey = 'attention-heading'
  fragment.append(title)
  if (!groups.needsInput.length && !groups.failedToReview.length) {
    if (filteredOut) fragment.append(el('p', 'attention-empty', 'No agents match these filters.'))
    else if (!liveAgentCount) fragment.append(el('p', 'attention-empty', 'No live agents to show yet.'))
    else {
      const working = office.agents.filter((agent) => agent.state === 'working').length
      const workingText = working ? ` · ${working} working` : ''
      const quiet = groups.finishedToReview.length
        ? `No one needs input right now${workingText} · ${groups.finishedToReview.length} finished to review.`
        : `Nothing needs input or review right now${workingText}.`
      fragment.append(el('p', 'attention-empty', quiet))
    }
  }
  for (const [key, label, rows] of sections) {
    if (!rows.length) continue
    const section = el('section', 'attention-group')
    const heading = el('h2', '', `${label} · ${rows.length}`)
    heading.tabIndex = -1
    heading.dataset.focusKey = `attention-group:${key}`
    section.append(heading)
    for (const agent of rows) {
      const name = taskLabel(agent)
      const context = workspaceContext(agent, office)
      const sameLabel = (contextCounts.get(`${name}\u0000${context.project ?? ''}`) ?? 0) > 1
      section.append(attentionRow(agent, key, sameLabel, office, actions))
    }
    fragment.append(section)
  }
  if (groups.finishedToReview.length) {
    const section = el('details', 'attention-group attention-finished') as HTMLDetailsElement
    section.open = revealFinished || finishedExpanded
    const unknownCount = groups.finishedToReview.filter((agent) => agent.outcome !== 'success' && agent.outcome !== 'failure').length
    const disclosure = el('summary', '', `Finished · ${groups.finishedToReview.length}${unknownCount ? ` · ${unknownCount} outcome${unknownCount === 1 ? '' : 's'} unknown` : ''}`) as HTMLElement
    disclosure.dataset.focusKey = 'attention-finished-summary'
    disclosure.addEventListener('click', () => { if (!revealFinished) finishedExpanded = !section.open })
    section.append(disclosure)
    section.addEventListener('toggle', () => {
      if (revealFinished) {
        if (!section.open) section.open = true
      } else finishedExpanded = section.open
    })
    const rows = el('div', 'attention-finished-rows')
    for (const agent of groups.finishedToReview) {
      const name = taskLabel(agent)
      const context = workspaceContext(agent, office)
      const sameLabel = (contextCounts.get(`${name}\u0000${context.project ?? ''}`) ?? 0) > 1
      rows.append(attentionRow(agent, 'finished', sameLabel, office, actions))
    }
    section.append(rows)
    fragment.append(section)
  }
  root.replaceChildren(fragment)
  root.scrollTop = scroll
  if (document.scrollingElement) document.scrollingElement.scrollTop = pageScroll
  if (focused) {
    const target = [...root.querySelectorAll<HTMLElement>('[data-focus-key]')].find((node) => node.dataset.focusKey === focused && canFocus(node))
    const stops = [...root.querySelectorAll<HTMLElement>('[data-focus-key]')].filter(canFocus)
    if (target) target.focus({ preventScroll: true })
    else if (stops.length) stops[Math.min(Math.max(focusIndex, 0), stops.length - 1)].focus({ preventScroll: true })
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
