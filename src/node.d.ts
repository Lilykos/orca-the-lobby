// The worker runs in Node; these are the only built-ins it uses, typed here so the plugin needs
// no node_modules.
declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function readdir(path: string): Promise<string[]>
  export function stat(path: string): Promise<{ size: number; mtimeMs: number }>
  // Only the context tests write files.
  export function mkdir(path: string, options: { recursive: true }): Promise<unknown>
  export function mkdtemp(prefix: string): Promise<string>
  export function writeFile(path: string, data: string): Promise<void>
  export function open(
    path: string,
    flags: 'r'
  ): Promise<{
    read(
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number
    ): Promise<{ bytesRead: number }>
    close(): Promise<void>
  }>
}
declare module 'node:os' {
  export function homedir(): string
  export function tmpdir(): string
}
declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: string[],
    options: { timeout: number; maxBuffer: number },
    callback: (error: Error | null, stdout: string) => void
  ): void
}
declare const process: { execPath: string }

declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(data: string): { digest(encoding: 'hex'): string } }
}
