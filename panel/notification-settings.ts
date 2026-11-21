import type { AgentView, NotificationControlState } from '../src/protocol'

export type NotificationProjectRow = {
  projectId: string
  name: string
  state: NotificationControlState | null
  loading: boolean
  busy: boolean
  message: string
  retryKind?: 'read' | 'write'
  retry?: () => void
}
export type NotificationReminderRow = NotificationProjectRow & { agent: AgentView }
export type NotificationControlActions = {
  mute: (row: NotificationProjectRow) => void
  snooze: (row: NotificationReminderRow, choice: '15m' | '1h' | 'manual' | 'resume') => void
}

const el = (tag: string, className = '', text = ''): HTMLElement => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export function renderNotificationControls(root: HTMLElement, projects: NotificationProjectRow[], reminders: NotificationReminderRow[], actions: NotificationControlActions): void {
  const active = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null
  const focused = active?.dataset.focusKey
  const enabled = 'button[data-focus-key]:not(:disabled)'
  const focusIndex = active ? [...root.querySelectorAll(enabled)].indexOf(active) : -1
  const pageScroll = document.scrollingElement?.scrollTop ?? 0
  const projectGroup = el('div', 'notification-group')
  projectGroup.append(el('h3', '', 'Project notifications'))
  if (!projects.length) projectGroup.append(el('p', 'notification-note', 'No live projects.'))
  for (const row of projects) {
    const targetKey = `notification:project:${row.projectId}`
    const rowElement = el('article', 'notification-row')
    rowElement.dataset.notificationTarget = targetKey
    const detail = el('div', 'notification-detail')
    const controls = el('div', 'notification-actions')
    detail.append(el('h4', 'notification-title', row.name))
    const status = el('p', 'notification-project-status')
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    status.textContent = `${row.loading ? 'Loading notification settings…' : row.busy ? 'Saving notification settings…' : row.state?.status === 'ready' ? row.state.muted ? 'Notifications muted' : 'Notifications active' : 'Notification settings unavailable'}${row.retryKind === 'write' && !row.busy ? ' · save failed' : ''}`
    detail.append(status)
    if (row.message || row.state?.status === 'error') {
      const error = el('p', 'notification-error', row.message || row.state?.error || 'Notification settings are unavailable.')
      error.setAttribute('role', 'status')
      error.setAttribute('aria-live', 'polite')
      detail.append(error)
    }
    if (row.state?.status === 'ready') {
      const button = el('button', 'action', row.state.muted ? 'Unmute project notifications' : 'Mute project notifications') as HTMLButtonElement
      button.dataset.focusKey = `${targetKey}:mute`
      button.setAttribute('aria-pressed', String(Boolean(row.state.muted)))
      button.disabled = row.loading || row.busy
      button.addEventListener('click', () => actions.mute(row))
      controls.append(button)
    }
    if (row.retry) {
      const button = el('button', 'action', row.retryKind === 'write' ? 'Retry save' : 'Retry loading notification settings') as HTMLButtonElement
      button.dataset.focusKey = `${targetKey}:${row.retryKind === 'write' ? 'retry-write' : 'retry'}`
      button.disabled = row.busy || row.loading
      button.addEventListener('click', row.retry)
      controls.append(button)
    }
    rowElement.append(detail, controls)
    projectGroup.append(rowElement)
  }
  const reminderGroup = el('div', 'notification-group')
  reminderGroup.append(el('h3', '', 'Current-episode reminders'))
  if (!reminders.length) reminderGroup.append(el('p', 'notification-note', 'No blocked or quiet episodes eligible for reminders.'))
  for (const row of reminders) {
    const targetKey = `notification:agent:${row.agent.id}`
    const rowElement = el('article', 'notification-row')
    rowElement.dataset.notificationTarget = targetKey
    const detail = el('div', 'notification-detail')
    const controls = el('div', 'notification-actions')
    detail.append(el('h4', 'notification-title', `${row.name} · ${row.agent.state === 'blocked' ? 'Needs you' : 'Quiet'}`))
    const status = el('p', 'notification-agent-status')
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    if (row.loading) status.textContent = 'Loading reminder settings…'
    else if (row.busy) status.textContent = 'Saving reminder settings…'
    else if (row.state?.status === 'ready' && row.state.snoozed) {
      status.append(document.createTextNode('Reminders snoozed until '))
      if (row.state.expiresAt === null) status.append(document.createTextNode('resumed'))
      else {
        const time = document.createElement('time')
        time.dateTime = new Date(row.state.expiresAt).toISOString()
        time.textContent = new Date(row.state.expiresAt).toLocaleString()
        status.append(time)
      }
    } else status.textContent = row.state?.status === 'ready' ? 'Reminders active' : 'Reminder settings unavailable'
    if (row.retryKind === 'write' && !row.busy) status.append(document.createTextNode(' · save failed'))
    detail.append(status)
    if (row.message || row.state?.status === 'error') {
      const error = el('p', 'notification-error', row.message || row.state?.error || 'Reminder settings are unavailable.')
      error.setAttribute('role', 'status')
      error.setAttribute('aria-live', 'polite')
      detail.append(error)
    }
    if (row.state?.status === 'ready' && row.state.episodeId) {
      const choices: ['15m' | '1h' | 'manual' | 'resume', string][] = [['15m', 'Snooze 15 minutes'], ['1h', 'Snooze 1 hour'], ['manual', 'Snooze until resumed']]
      if (row.state.snoozed) choices.push(['resume', 'Resume reminders'])
      for (const [choice, label] of choices) {
        const button = el('button', 'action', label) as HTMLButtonElement
        button.dataset.focusKey = `${targetKey}:${choice === 'resume' ? 'resume' : `snooze:${choice}`}`
        button.disabled = row.loading || row.busy
        button.addEventListener('click', () => actions.snooze(row, choice))
        controls.append(button)
      }
    }
    if (row.retry) {
      const button = el('button', 'action', row.retryKind === 'write' ? 'Retry save' : 'Retry loading reminder settings') as HTMLButtonElement
      button.dataset.focusKey = `${targetKey}:${row.retryKind === 'write' ? 'retry-write' : 'retry'}`
      button.disabled = row.busy || row.loading
      button.addEventListener('click', row.retry)
      controls.append(button)
    }
    rowElement.append(detail, controls)
    reminderGroup.append(rowElement)
  }
  root.replaceChildren(projectGroup, reminderGroup)
  if (document.scrollingElement) document.scrollingElement.scrollTop = pageScroll
  if (active) {
    const controls = [...root.querySelectorAll<HTMLButtonElement>(enabled)]
    const target = controls.find((control) => control.dataset.focusKey === focused)
      ?? controls[Math.min(Math.max(focusIndex, 0), controls.length - 1)] ?? root
    target.focus({ preventScroll: true })
  }
}
