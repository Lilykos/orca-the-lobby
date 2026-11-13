import { assert, test } from 'orca/testing'
import { assign, digest, emptyDigest, supplementaryInsight } from './transcript'
import type { AgentView } from './protocol'

const digestWith = (title: string) => {
  const found = emptyDigest()
  digest(
    found,
    JSON.stringify({
      timestamp: '2026-11-11T08:30:00.000Z',
      type: 'assistant',
      message: {
        model: 'claude-model',
        usage: { input_tokens: 100, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 },
        content: []
      }
    })
  )
  found.title = title
  return found
}

test('transcript parsing keeps tasks and files without attaching an unmapped model', () => {
  const found = emptyDigest()
  digest(found, JSON.stringify({
    type: 'assistant',
    message: {
      model: 'claude-model',
      usage: { input_tokens: 100, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 },
      content: [
        { type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: 'Keep task', status: 'in_progress' }] } },
        { type: 'tool_use', name: 'Edit', input: { file_path: '/repo/actual.ts' } }
      ]
    }
  }))
  assert.equal(found.model, null)
  assert.deepEqual(found.todos, [{ text: 'Keep task', status: 'in_progress' }])
  assert.deepEqual(found.files, ['actual.ts'])
  assert.deepEqual(Object.keys(found).sort(), ['files', 'lastPrompt', 'model', 'title', 'todos'])
})

test('fuzzy transcript matches preserve work summaries but do not attribute a model', () => {
  const found = digestWith('Fix issue')
  found.files = ['main.ts']
  found.todos = [{ text: 'Keep this task', status: 'pending' }]
  const agent = {
    id: 'agent-a',
    paneKey: 'pane-a',
    title: 'Fix issue',
    prompt: 'do the fix'
  } satisfies Pick<AgentView, 'id' | 'paneKey' | 'title' | 'prompt'>
  const match = assign([agent], [found]).get(agent.id)
  assert.equal(match, found)
  assert.deepEqual(supplementaryInsight(match!), {
    model: null,
    todos: [{ text: 'Keep this task', status: 'pending' }],
    files: ['main.ts']
  })
})

test('Codex agents are excluded from Claude transcript matches', () => {
  const codex = {
    id: 'codex', paneKey: 'pane-a', title: 'Fix issue', prompt: 'do the fix', agent: 'codex'
  } satisfies Pick<AgentView, 'id' | 'paneKey' | 'title' | 'prompt' | 'agent'>
  assert.equal(assign([codex], [digestWith('Fix issue')]).has('codex'), false)
  // The parser does not add any token-count or window fields to the insight contract.
  assert.deepEqual(Object.keys(supplementaryInsight(digestWith('Fix issue'))).sort(), ['files', 'model', 'todos'])
})
