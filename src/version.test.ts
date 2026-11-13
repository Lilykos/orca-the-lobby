import { assert, test } from 'orca/testing'
import { readFile } from 'node:fs/promises'

test('the About card shows the version in orca-plugin.json', async () => {
  const manifest = JSON.parse(await readFile('orca-plugin.json', 'utf8'))
  const panel = await readFile('panel/main.ts', 'utf8')
  assert.equal(/const VERSION = '([^']+)'/.exec(panel)?.[1], manifest.version)
})
