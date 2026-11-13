// The CLI supplies Orca's cross-worktree sidebar list (`orca worktree ps --json`; host
// `agents.list` covers only the focused workspace) and each workspace's Git change count. Without
// the CLI the office falls back to what events and hooks tell it.
import { execFile } from 'node:child_process'
import { listArgs, parseOutcome, parseTerminals, sendArgs, switchArgs, type TerminalRow } from './actions'
import type { RosterWorktree } from './office'
import type { Change } from './protocol'

/** Next to the app on macOS, else whatever `orca` is on the PATH. */
const ORCA = [process.execPath.replace(/\/Contents\/.*$/, '/Contents/Resources/bin/orca'), 'orca']

/** A program's output, or null when it failed, timed out or is not there. */
function run(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 5000, maxBuffer: 16 << 20 }, (error, stdout) =>
      resolve(error ? null : stdout)
    )
  })
}

/** What an Orca command printed, also when it failed (the CLI explains a refusal as JSON on stdout);
 *  null when Orca could not be run or did not answer. The next way of reaching Orca is tried only
 *  when the first is not installed: once a command has run, running it again could type twice. */
async function ask(args: string[]): Promise<string | null> {
  for (const command of ORCA) {
    const { output, missing } = await new Promise<{ output: string | null; missing: boolean }>((resolve) => {
      execFile(command, args, { timeout: 10000, maxBuffer: 16 << 20 }, (error, stdout) =>
        resolve({ output: stdout || (error ? null : ''), missing: (error as { code?: unknown } | null)?.code === 'ENOENT' })
      )
    })
    if (!missing) return output
  }
  return null
}

/** ` 3 files changed, 120 insertions(+), 30 deletions(-)`, as git prints it; empty when clean. */
export function parseShortstat(text: string): Change {
  const count = (word: string): number => Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0)
  return { files: count('file'), added: count('insertion'), removed: count('deletion') }
}

/** Tests replace these, so they never run a real program. */
export const cli = {
  /** Orca's worktrees with their agents, or null when Orca cannot be asked. */
  roster: async (): Promise<RosterWorktree[] | null> => {
    for (const command of ORCA) {
      const output = await run(command, ['worktree', 'ps', '--json', '--limit', '200'])
      try {
        const worktrees = output === null ? null : JSON.parse(output)?.result?.worktrees
        if (Array.isArray(worktrees)) return worktrees
      } catch {
        // Not JSON: try the next way of reaching Orca.
      }
    }
    return null
  },
  /** The live terminals Orca manages, or null when Orca cannot be asked. */
  terminals: async (): Promise<TerminalRow[] | null> => parseTerminals(await ask(listArgs)),
  /** Brings a terminal's tab to the front in Orca. */
  switchTo: async (handle: string) => parseOutcome(await ask(switchArgs(handle)), 'switch'),
  /** Types text into a terminal and presses Enter; Orca submits it to an agent as a pasted prompt. */
  send: async (handle: string, text: string) => parseOutcome(await ask(sendArgs(handle, text)), 'send'),
  /** What is uncommitted in a workspace, or null when it is not a Git checkout. */
  changes: async (path: string): Promise<Change | null> => {
    const output = await run('git', ['-C', path, 'diff', '--shortstat', 'HEAD'])
    return output === null ? null : parseShortstat(output)
  }
}
