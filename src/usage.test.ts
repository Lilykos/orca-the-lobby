import { assert, test } from 'orca/testing'
import { claudeTally, codexDay, codexTally, dayOf, tallyClaude, tallyCodex } from './usage'
import { overdue, usageTotal } from './protocol'

// Local times, so the day a line falls on does not depend on the machine's time zone.
const at = (day: number, hour: number): string => new Date(2026, 10, day, hour).toISOString()

const claudeLine = (id: string, when: string, usage: object, extra: object = {}): string =>
  JSON.stringify({ type: 'assistant', timestamp: when, message: { id, model: 'claude-opus-5-5', usage }, ...extra })

test('Claude usage counts each message once, by local day and model', () => {
  const tally = claudeTally()
  const usage = { input_tokens: 2, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 }
  // A message's usage repeats on each of its content lines.
  tallyClaude(tally, claudeLine('m1', at(13, 9), usage))
  tallyClaude(tally, claudeLine('m1', at(13, 9), usage))
  tallyClaude(tally, claudeLine('m2', at(13, 10), usage, { isSidechain: true }))
  tallyClaude(tally, claudeLine('m3', at(12, 23), usage))
  tallyClaude(tally, 'not json')
  tallyClaude(tally, JSON.stringify({ type: 'user', timestamp: at(13, 9), message: { usage } }))
  const today = tally.days.get(dayOf(Date.parse(at(13, 12))))!
  assert.deepEqual(today, { input: 4, output: 20, cacheRead: 200, cacheWrite: 40, models: { 'claude-opus-5-5': 264 } })
  assert.equal(usageTotal(tally.days.get(dayOf(Date.parse(at(12, 12))))!), 132)
})

test('a streamed Claude message counts its fullest line, whichever comes first', () => {
  const tally = claudeTally()
  const streamed = (output: number): string => claudeLine('m1', at(13, 9), { input_tokens: 2, output_tokens: output, cache_read_input_tokens: 100 })
  // The first line of a streaming message carries a partial output count; later ones grow it.
  tallyClaude(tally, streamed(4))
  tallyClaude(tally, streamed(120))
  tallyClaude(tally, streamed(120))
  // A shorter repeat (out of order) changes nothing.
  tallyClaude(tally, streamed(30))
  const day = dayOf(Date.parse(at(13, 12)))
  assert.deepEqual(tally.days.get(day), { input: 2, output: 120, cacheRead: 100, cacheWrite: 0, models: { 'claude-opus-5-5': 222 } })
  // Moving to another message adds to it, and the first stays as it was.
  tallyClaude(tally, claudeLine('m2', at(13, 10), { output_tokens: 8 }))
  assert.equal(usageTotal(tally.days.get(day)!), 230)
})

test('Codex usage is the day\'s growth of its running total, without double counting cache', () => {
  const tally = codexTally()
  const count = (when: string, input: number, cached: number, output: number): string =>
    JSON.stringify({ type: 'event_msg', timestamp: when, payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } } })
  tallyCodex(tally, JSON.stringify({ type: 'session_meta', timestamp: at(12, 22), payload: { cwd: '/w' } }))
  tallyCodex(tally, JSON.stringify({ type: 'turn_context', timestamp: at(12, 22), payload: { model: 'gpt-6.1-terra' } }))
  tallyCodex(tally, count(at(12, 23), 1000, 800, 50))
  tallyCodex(tally, count(at(13, 1), 3000, 2500, 120))
  tallyCodex(tally, count(at(13, 2), 5000, 4200, 200))
  assert.equal(tally.cwd, '/w')
  assert.deepEqual(codexDay(tally, dayOf(Date.parse(at(13, 12)))), { input: 600, output: 150, cacheRead: 3400, cacheWrite: 0, models: { 'gpt-6.1-terra': 4150 } })
  assert.deepEqual(codexDay(tally, dayOf(Date.parse(at(12, 12)))), { input: 200, output: 50, cacheRead: 800, cacheWrite: 0, models: { 'gpt-6.1-terra': 1050 } })
  assert.equal(codexDay(tally, dayOf(Date.parse(at(14, 12)))), null)
})

test('an agent is overdue only past the chosen minutes, and never when the alert is off', () => {
  const now = Date.parse(at(13, 12))
  const minutes = (count: number): number => now - count * 60_000
  assert.deepEqual(overdue({ state: 'working', lastSeenAt: minutes(25), stateStartedAt: minutes(60) }, now, 20), { kind: 'quiet', since: minutes(25) })
  assert.equal(overdue({ state: 'working', lastSeenAt: minutes(5), stateStartedAt: minutes(60) }, now, 20), null)
  assert.deepEqual(overdue({ state: 'blocked', lastSeenAt: minutes(1), stateStartedAt: minutes(30) }, now, 20), { kind: 'needs-you', since: minutes(30) })
  assert.equal(overdue({ state: 'waiting', lastSeenAt: minutes(90), stateStartedAt: minutes(90) }, now, 20), null)
  assert.equal(overdue({ state: 'done', lastSeenAt: minutes(90), stateStartedAt: minutes(90) }, now, 20), null)
  assert.equal(overdue({ state: 'working', lastSeenAt: minutes(90), stateStartedAt: minutes(90) }, now, 0), null)
})
