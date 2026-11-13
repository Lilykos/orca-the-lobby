// Builds an isolated browser fixture from the real panel code: no live Orca data, no storage.
//
//   node scripts/shots/render.cjs [out.html]
//
// The panel's TypeScript is transpiled and bundled into panel/index.html, together with
// fixture.js (stubbed `orca` API, check scenarios) and demo.js (the DEMO dataset for media).
// TypeScript is found, in order, at $TYPESCRIPT_PATH (its typescript.js), as a `typescript`
// package resolvable from the repo, or through `npx --package typescript@5` (version 7 has no JS API).
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..', '..')

// TypeScript 7 is a native binary without the JavaScript API, so only 5.x/6.x qualify.
const usable = (ts) => (ts && typeof ts.transpileModule === 'function' ? ts : null)

function loadTypeScript() {
  if (process.env.TYPESCRIPT_PATH) return require(process.env.TYPESCRIPT_PATH)
  try {
    const found = usable(require(require.resolve('typescript', { paths: [root] })))
    if (found) return found
  } catch {}
  // npx installs it into its cache and puts `tsc` on PATH; typescript.js is next to it.
  const tsc = execFileSync('npx', ['--yes', '--package', 'typescript@5', '-c', 'command -v tsc'], {
    cwd: root,
    encoding: 'utf8'
  }).trim()
  return require(path.join(path.dirname(fs.realpathSync(tsc)), '..', 'lib', 'typescript.js'))
}

const ts = loadTypeScript()
const modules = new Map()
function add(id) {
  if (modules.has(id)) return
  const text = fs.readFileSync(path.join(root, id + '.ts'), 'utf8')
  modules.set(
    id,
    ts.transpileModule(text, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
  )
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))
    add(path.posix.normalize(path.posix.join(path.posix.dirname(id), match[1])))
}
add('panel/main')
const bundle = [...modules]
  .map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){\n${code}\n}`)
  .join(',\n')

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8')
const script = read('demo.js') + '\n' + read('fixture.js').replace('/*__BUNDLE__*/', () => bundle)
const html = read('../../panel/index.html').replace(
  '<script type="module" src="./main.ts"></script>',
  () => `<script>${script}</script>`
)
if (!html.includes(script)) throw new Error('panel/index.html no longer has the main.ts script tag to replace')
fs.writeFileSync(path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'lobby-fixture.html')), html)
