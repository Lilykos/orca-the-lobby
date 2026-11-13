// What the person can do to an agent from the panel, and the pure parts of doing it: which agent
// comes next, which terminal is an agent's, what to type, and how Orca's CLI answers.
import type { AgentView } from './protocol'

/** A live terminal as `orca terminal list --json` names it. */
export type TerminalRow = { handle: string; paneKey: string }

/** Longest instruction the panel may send in one go. */
export const MAX_INSTRUCTION = 8000

const RANK = { blocked: 0, working: 1, waiting: 2, done: 2 }

/** Agents that need the person first, then working ones, then the rest; within each, by arrival so the
 *  order holds still while states change. Used by the previous / next agent shortcuts. */
export function agentOrder<T extends Pick<AgentView, 'id' | 'state' | 'firstSeenAt'>>(agents: readonly T[]): T[] {
  return [...agents].sort(
    (left, right) =>
      RANK[left.state] - RANK[right.state] ||
      left.firstSeenAt - right.firstSeenAt ||
      left.id.localeCompare(right.id)
  )
}

/** The agent a step away from `current`, wrapping round; with no current agent, the first going
 *  forward and the last going back. Null when there is no one to go to. */
export function stepAgent(order: readonly string[], current: string | null, step: 1 | -1): string | null {
  if (!order.length) return null
  const at = current === null ? -1 : order.indexOf(current)
  if (at < 0) return step === 1 ? order[0] : order[order.length - 1]
  return order[(at + step + order.length) % order.length]
}

/** The live terminal an agent runs in. Structured chat sessions have none, and Orca offers no way to
 *  address one, so they get null. */
export function terminalOf(
  agent: Pick<AgentView, 'terminalId' | 'paneKey'>,
  terminals: readonly TerminalRow[]
): string | null {
  const byHandle = agent.terminalId && terminals.find((row) => row.handle === agent.terminalId)
  const byPane = agent.paneKey && terminals.find((row) => row.paneKey === agent.paneKey)
  return (byHandle || byPane || null)?.handle ?? null
}

/** Whether text may be typed into an agent's terminal now. A finished agent's terminal may be back at
 *  a shell prompt, where an instruction would run as a command. */
export function mayType(agent: Pick<AgentView, 'state'> | undefined): boolean {
  return !!agent && agent.state !== 'done'
}

/** Whether some other agent the office knows also resolves to this terminal; typing is then refused,
 *  since the text might reach the wrong one. */
export function sharedTerminal(
  agentId: string,
  handle: string,
  agents: readonly (Pick<AgentView, 'id' | 'terminalId' | 'paneKey'>)[],
  terminals: readonly TerminalRow[]
): boolean {
  return agents.some((other) => other.id !== agentId && terminalOf(other, terminals) === handle)
}

/** The command that makes this kind of agent shrink its conversation, only where it has been tried
 *  here: Claude Code reads `/compact` typed into its terminal. */
export function compactCommand(kind: string | null): string | null {
  return kind === 'claude' ? '/compact' : null
}

/** An instruction ready to send, or why it cannot be. */
export function checkInstruction(value: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false, error: 'Type an instruction first.' }
  if (text.length > MAX_INSTRUCTION) return { ok: false, error: `That is longer than ${MAX_INSTRUCTION} characters.` }
  return { ok: true, text }
}

/** `--text=` keeps an instruction that starts with a dash from being read as an option. */
export function sendArgs(handle: string, text: string): string[] {
  return ['terminal', 'send', '--terminal', handle, `--text=${text}`, '--enter', '--json']
}

export function switchArgs(handle: string): string[] {
  return ['terminal', 'switch', '--terminal', handle, '--json']
}

export const listArgs = ['terminal', 'list', '--json']

/** Orca's CLI prints a JSON envelope, also when it fails. */
function envelope(output: string | null): { ok: boolean; result?: any; error?: { code?: unknown } } | null {
  try {
    const parsed = output === null ? null : JSON.parse(output)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function parseTerminals(output: string | null): TerminalRow[] | null {
  const rows = envelope(output)?.result?.terminals
  if (!Array.isArray(rows)) return null
  return rows.flatMap((row): TerminalRow[] =>
    typeof row?.handle === 'string' && typeof row.tabId === 'string' && typeof row.leafId === 'string'
      ? [{ handle: row.handle, paneKey: `${row.tabId}:${row.leafId}` }]
      : []
  )
}

/** Plain-English reasons for the failures Orca names; anything else is reported with its code. */
const REASONS: Record<string, string> = {
  terminal_handle_stale: 'Its terminal is no longer open.',
  runtime_unavailable: 'Orca could not be reached.'
}

/** Whether Orca accepted what was sent, or why not. */
export function parseOutcome(output: string | null, sent: 'send' | 'switch'): { ok: true } | { ok: false; error: string } {
  const answer = envelope(output)
  if (!answer) return { ok: false, error: 'Orca did not answer.' }
  if (answer.ok && (sent === 'switch' || answer.result?.send?.accepted === true)) return { ok: true }
  const code = typeof answer.error?.code === 'string' ? answer.error.code : ''
  return { ok: false, error: REASONS[code] ?? (code ? `Orca refused it (${code}).` : 'Orca did not accept it.') }
}
