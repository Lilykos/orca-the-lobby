import { assert, test } from 'orca/testing'
import {
  MAX_INSTRUCTION,
  agentOrder,
  checkInstruction,
  compactCommand,
  parseOutcome,
  parseTerminals,
  sendArgs,
  stepAgent,
  switchArgs,
  terminalOf
} from './actions'
import type { AgentState } from './protocol'

const agent = (id: string, state: AgentState, firstSeenAt: number) => ({ id, state, firstSeenAt })

test('agents are ordered needs-you, working, then the rest, each by arrival', () => {
  const order = agentOrder([
    agent('done-old', 'done', 1),
    agent('work-late', 'working', 30),
    agent('wait', 'waiting', 5),
    agent('block', 'blocked', 40),
    agent('work-early', 'working', 10),
    agent('done-new', 'done', 3)
  ]).map((item) => item.id)
  assert.deepEqual(order, ['block', 'work-early', 'work-late', 'done-old', 'done-new', 'wait'])
})

test('the order holds still for equal arrival times and does not change its input', () => {
  const input = [agent('b', 'working', 1), agent('a', 'working', 1)]
  assert.deepEqual(agentOrder(input).map((item) => item.id), ['a', 'b'])
  assert.equal(input[0].id, 'b')
})

test('stepping goes round both ways and starts at an end without a current agent', () => {
  const order = ['a', 'b', 'c']
  assert.equal(stepAgent(order, 'a', 1), 'b')
  assert.equal(stepAgent(order, 'c', 1), 'a')
  assert.equal(stepAgent(order, 'a', -1), 'c')
  assert.equal(stepAgent(order, 'b', -1), 'a')
  assert.equal(stepAgent(order, null, 1), 'a')
  assert.equal(stepAgent(order, null, -1), 'c')
  assert.equal(stepAgent(order, 'gone', 1), 'a')
  assert.equal(stepAgent([], 'a', 1), null)
  assert.equal(stepAgent(['only'], 'only', 1), 'only')
})

test('an agent runs in the live terminal named by its id or its pane, never a guess', () => {
  const terminals = [
    { handle: 'term_1', paneKey: 'tab1:leaf1' },
    { handle: 'term_2', paneKey: 'tab2:leaf2' }
  ]
  assert.equal(terminalOf({ terminalId: 'term_2', paneKey: null }, terminals), 'term_2')
  assert.equal(terminalOf({ terminalId: null, paneKey: 'tab1:leaf1' }, terminals), 'term_1')
  assert.equal(terminalOf({ terminalId: 'term_9', paneKey: 'tab2:leaf2' }, terminals), 'term_2')
  // A chat session has a pane key but no terminal, and a closed terminal is no longer listed.
  assert.equal(terminalOf({ terminalId: null, paneKey: 'structured-agent-session-claude_1:a' }, terminals), null)
  assert.equal(terminalOf({ terminalId: 'term_9', paneKey: null }, terminals), null)
  assert.equal(terminalOf({ terminalId: null, paneKey: null }, terminals), null)
})

test('only Claude Code is offered a compact command', () => {
  assert.equal(compactCommand('claude'), '/compact')
  for (const other of ['codex', 'pi', 'gemini', '', null]) assert.equal(compactCommand(other), null)
})

test('an instruction is trimmed, and empty or oversize ones are refused', () => {
  assert.deepEqual(checkInstruction('  run the tests\n'), { ok: true, text: 'run the tests' })
  assert.deepEqual(checkInstruction('line one\nline two'), { ok: true, text: 'line one\nline two' })
  for (const bad of ['', '   \n', undefined, 7, null]) assert.equal(checkInstruction(bad).ok, false)
  assert.equal(checkInstruction('x'.repeat(MAX_INSTRUCTION)).ok, true)
  assert.equal(checkInstruction('x'.repeat(MAX_INSTRUCTION + 1)).ok, false)
})

test('commands pass the text as one option, so a leading dash or quote stays text', () => {
  assert.deepEqual(sendArgs('term_1', '--force "now"'), [
    'terminal', 'send', '--terminal', 'term_1', '--text=--force "now"', '--enter', '--json'
  ])
  assert.deepEqual(switchArgs('term_1'), ['terminal', 'switch', '--terminal', 'term_1', '--json'])
})

test('the terminal list gives handles and pane keys, skipping rows it cannot place', () => {
  const output = JSON.stringify({
    ok: true,
    result: { terminals: [{ handle: 'term_1', tabId: 'a', leafId: 'b' }, { handle: 'term_2', tabId: 'a' }, null] }
  })
  assert.deepEqual(parseTerminals(output), [{ handle: 'term_1', paneKey: 'a:b' }])
  for (const bad of [null, '', 'not json', '{"ok":false}', '[]']) assert.equal(parseTerminals(bad), null)
})

test('Orca accepting a send or a switch is told apart from a refusal, in plain words', () => {
  assert.deepEqual(parseOutcome(JSON.stringify({ ok: true, result: { send: { accepted: true } } }), 'send'), { ok: true })
  assert.deepEqual(parseOutcome(JSON.stringify({ ok: true, result: { focus: { navigated: true } } }), 'switch'), { ok: true })
  assert.equal(parseOutcome(JSON.stringify({ ok: true, result: { send: { accepted: false } } }), 'send').ok, false)
  assert.deepEqual(
    parseOutcome(JSON.stringify({ ok: false, error: { code: 'terminal_handle_stale', message: 'technical' } }), 'send'),
    { ok: false, error: 'Its terminal is no longer open.' }
  )
  assert.deepEqual(parseOutcome(JSON.stringify({ ok: false, error: { code: 'odd_thing' } }), 'switch'), {
    ok: false,
    error: 'Orca refused it (odd_thing).'
  })
  assert.deepEqual(parseOutcome(null, 'send'), { ok: false, error: 'Orca did not answer.' })
  assert.deepEqual(parseOutcome('garbage', 'send'), { ok: false, error: 'Orca did not answer.' })
})
