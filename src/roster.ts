// The CLI supplies Orca's cross-worktree sidebar list (`orca worktree ps --json`; host
// `agents.list` covers only the focused workspace) and each workspace's Git change count. Without
// the CLI the office falls back to what events and hooks tell it.
import { execFile } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { homedir } from 'node:os'
import { listArgs, parseOutcome, parseTerminals, sendArgs, switchArgs, type TerminalRow } from './actions'
import type { RepoListRow, RosterWorktree } from './office'
import type { Change } from './protocol'

const ENVIRONMENT_PREFIX = 'environment:'

export function environmentTarget(key: string | null | undefined): { id: string; value: string } | null {
  if (!key?.startsWith(ENVIRONMENT_PREFIX)) return null
  try {
    const pair: unknown = JSON.parse(key.slice(ENVIRONMENT_PREFIX.length))
    if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string') {
      return { id: pair[0], value: pair[1] }
    }
  } catch {
    return null
  }
  return null
}

const environmentArgs = (id?: string): string[] => id ? ['--environment', id] : []
const environmentKey = (id: string, value: string): string =>
  `${ENVIRONMENT_PREFIX}${JSON.stringify([id, value])}`

/** The app's bundled CLI on Windows and macOS, or the CLI on the PATH. */
const ORCA = process.platform === 'win32'
  ? [`${process.execPath.replace(/[\\/][^\\/]+$/, '')}\\resources\\bin\\orca.exe`, 'orca.exe']
  : process.execPath.includes('/Contents/')
    ? [process.execPath.replace(/\/Contents\/.*$/, '/Contents/Resources/bin/orca'), 'orca']
    : ['orca']

// Orca's Windows worker omits APPDATA, but its CLI needs it to locate the desktop profile.
const cliEnv = process.platform === 'win32' && !process.env.APPDATA
  ? { ...process.env, APPDATA: `${homedir()}\\AppData\\Roaming` }
  : undefined

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
      execFile(command, args, { timeout: 10000, maxBuffer: 16 << 20, env: cliEnv }, (error, stdout) => {
        const code = (error as { code?: unknown } | null)?.code
        resolve({ output: stdout || (error ? null : ''), missing: code === 'ENOENT' })
      })
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

function resultArray(output: string | null, key: 'hosts' | 'repos' | 'worktrees'): unknown[] | null {
  try {
    const answer = output === null ? null : JSON.parse(output)
    const rows = answer?.result?.[key]
    return answer?.ok !== false && Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

function repoRows(output: string | null): RepoListRow[] | null {
  const rows = resultArray(output, 'repos')
  return rows?.filter((row): row is RepoListRow => !!row && typeof row === 'object') ?? null
}

function withHostName(row: RosterWorktree, name: string): RosterWorktree {
  return { ...row, repo: `${row.repo || row.displayName || row.path} · ${name}` }
}

/** The desktop roster includes SSH worktrees, but paired servers need their own query. */
export function createRoster(read: (args: string[]) => Promise<string | null>) {
  let environments: { id: string; name: string }[] = []
  let hostNames = new Map<string, string>()
  const args = ['worktree', 'ps', '--json', '--limit', '200']

  return async (): Promise<RosterWorktree[] | null> => {
    const [local, discovery] = await Promise.all([read(args), read(['host', 'list', '--json'])])
    const localRows = resultArray(local, 'worktrees') as RosterWorktree[] | null
    // Never serve stale local rows: the worker also checks this roster before typing.
    if (!localRows) return null
    const hosts = resultArray(discovery, 'hosts')
    if (hosts) {
      hostNames = new Map(hosts.flatMap((host): [string, string][] =>
        host && typeof host === 'object' && 'id' in host && typeof host.id === 'string' &&
        'name' in host && typeof host.name === 'string'
          ? [[host.id, host.name]]
          : []
      ))
      environments = hosts.flatMap((host): { id: string; name: string }[] =>
        host && typeof host === 'object' && 'kind' in host && host.kind === 'environment' &&
        'id' in host && typeof host.id === 'string' && host.id
          ? [{ id: host.id, name: 'name' in host && typeof host.name === 'string' && host.name ? host.name : host.id }]
          : []
      )
    }

    const remoteRows = await Promise.all(environments.map(async ({ id, name }) => {
      const output = await read([...args, '--environment', id])
      const rows = resultArray(output, 'worktrees') as RosterWorktree[] | null
      // Only live observations belong in the roster; stale working rows cause false alerts.
      if (!rows) return []
      const qualified = rows.filter((row) => typeof row?.path === 'string').map((row) => ({
        ...withHostName(row, name),
        path: environmentKey(id, row.path),
        repoId: environmentKey(id, row.repoId ?? row.path),
        agents: row.agents?.filter((agent) => typeof agent?.paneKey === 'string').map((agent) => ({
          ...agent,
          paneKey: environmentKey(id, agent.paneKey),
          parentPaneKey: agent.parentPaneKey ? environmentKey(id, agent.parentPaneKey) : agent.parentPaneKey
        }))
      }))
      return qualified
    }))
    const namedLocalRows = localRows.map((row) => {
      const hostId = row.hostId || 'local'
      return withHostName(row, hostId === 'local' ? 'local' : hostNames.get(hostId) ?? hostId)
    })
    return [...namedLocalRows, ...remoteRows.flat()]
  }
}

const ICON_LIMIT = 8192
const ICON_COUNT_LIMIT = 12

function publicGithubIconUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'image' ||
    !('src' in value) || typeof value.src !== 'string') return null
  try {
    const url = new URL(value.src)
    return url.protocol === 'https:' &&
      !url.username && !url.password && !url.port &&
      (url.hostname === 'github.com' || url.hostname === 'avatars.githubusercontent.com')
      ? url.href
      : null
  } catch {
    return null
  }
}

async function fetchGithubIcon(source: string): Promise<string | null> {
  const allowed = (url: URL): boolean =>
    url.protocol === 'https:' &&
    !url.username && !url.password && !url.port &&
    (url.hostname === 'github.com' || url.hostname === 'avatars.githubusercontent.com')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  let url = new URL(source)
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!allowed(url)) return null
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        credentials: 'omit',
        headers: { accept: 'image/png,image/jpeg,image/webp' }
      })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location) return null
        await response.body?.cancel()
        url = new URL(location, url)
        continue
      }
      if (!response.ok) {
        console.warn(`GitHub project icon request returned HTTP ${response.status}`)
        return null
      }
      const type = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase()
      if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
        await response.body?.cancel()
        console.warn('GitHub project icon had an unsupported content type')
        return null
      }
      const reader = response.body?.getReader()
      if (!reader) return null
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > ICON_LIMIT) {
          await reader.cancel()
          console.warn('GitHub project icon exceeded the size limit')
          return null
        }
        chunks.push(value)
      }
      return `data:${type};base64,${Buffer.concat(chunks).toString('base64')}`
    }
    return null
  } catch (error) {
    console.warn(`Could not load a GitHub project icon: ${error}`)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function createRepoReader(
  read: (args: string[]) => Promise<string | null>,
  fetchIcon: (url: string) => Promise<string | null> = fetchGithubIcon
) {
  let environments: string[] = []
  const cachedRemote = new Map<string, RepoListRow[]>()
  const cachedIcons = new Map<string, string | null>()
  return async (projectIds?: string[]): Promise<RepoListRow[] | null> => {
    const [local, discovery] = await Promise.all([
      read(['repo', 'list', '--json']),
      read(['host', 'list', '--json'])
    ])
    const localRepos = repoRows(local)
    if (!localRepos) return null
    const hosts = resultArray(discovery, 'hosts')
    if (hosts) {
      environments = hosts.flatMap((host): string[] =>
        host && typeof host === 'object' && 'kind' in host && host.kind === 'environment' &&
        'id' in host && typeof host.id === 'string' && host.id
          ? [host.id]
          : []
      )
      for (const id of cachedRemote.keys()) if (!environments.includes(id)) cachedRemote.delete(id)
    }
    const remoteRepos = await Promise.all(environments.map(async (id) => {
      const repos = repoRows(await read(['repo', 'list', '--json', ...environmentArgs(id)]))
      if (repos) cachedRemote.set(id, repos)
      return (cachedRemote.get(id) ?? []).map((repo) => {
        const repoId = typeof repo.id === 'string' ? repo.id : typeof repo.path === 'string' ? repo.path : undefined
        return {
          ...repo,
          id: repoId ? environmentKey(id, repoId) : undefined,
          path: typeof repo.path === 'string' ? environmentKey(id, repo.path) : undefined
        }
      })
    }))
    const allRepos = [...localRepos, ...remoteRepos.flat()]
    const wanted = projectIds ? new Set(projectIds) : null
    const iconUrls = new Set(allRepos
      .filter((repo) => !wanted || wanted.has(String(repo.id ?? '')) || wanted.has(String(repo.path ?? '')))
      .map((repo) => publicGithubIconUrl(repo.repoIcon))
      .filter((url): url is string => !!url))
    const newUrls = [...iconUrls]
      .filter((url) => !cachedIcons.has(url))
      .slice(0, ICON_COUNT_LIMIT - cachedIcons.size)
    await Promise.all(newUrls.map(async (url) => cachedIcons.set(url, await fetchIcon(url))))
    return allRepos.map((repo) => {
      if (wanted && !wanted.has(String(repo.id ?? '')) && !wanted.has(String(repo.path ?? '')))
        return { ...repo, repoIcon: undefined }
      const url = publicGithubIconUrl(repo.repoIcon)
      const data = url ? cachedIcons.get(url) : null
      if (!data || !repo.repoIcon || typeof repo.repoIcon !== 'object') return { ...repo, repoIcon: undefined }
      return { ...repo, repoIcon: { ...repo.repoIcon, src: data } }
    })
  }
}

/** Tests replace these, so they never run a real program. */
export const cli = {
  /** Orca's worktrees with their agents, or null when Orca cannot be asked. */
  roster: createRoster(ask),
  /** Orca's repos in its sidebar's order, or null when Orca cannot be asked. */
  repos: createRepoReader(ask),
  /** The live terminals Orca manages, or null when Orca cannot be asked. */
  terminals: async (environment?: string): Promise<TerminalRow[] | null> =>
    parseTerminals(await ask([...listArgs, ...environmentArgs(environment)])),
  /** Brings a terminal's tab to the front in Orca. */
  switchTo: async (handle: string, environment?: string) =>
    parseOutcome(await ask([...switchArgs(handle), ...environmentArgs(environment)]), 'switch'),
  activateWorkspace: async (path: string, environment: string) =>
    parseOutcome(await ask(['worktree', 'activate', '--worktree', `path:${path}`, '--json', ...environmentArgs(environment)]), 'switch'),
  /** Types text into a terminal and presses Enter; Orca submits it to an agent as a pasted prompt. */
  send: async (handle: string, text: string) => parseOutcome(await ask(sendArgs(handle, text)), 'send'),
  /** What is uncommitted in a workspace, or null when it is not a Git checkout. */
  changes: async (path: string): Promise<Change | null> => {
    if (path.startsWith(ENVIRONMENT_PREFIX)) return null
    const output = await run('git', ['-C', path, 'diff', '--shortstat', 'HEAD'])
    return output === null ? null : parseShortstat(output)
  }
}
