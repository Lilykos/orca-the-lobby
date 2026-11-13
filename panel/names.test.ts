import { assert, test } from 'orca/testing'
import { assignAgentNames, readAgentNames } from './names'

test('keeps friendly names stable regardless of snapshot order', () => {
  const first = assignAgentNames(['agent-1', 'agent-2', 'agent-3'])
  const refreshed = assignAgentNames(['agent-3', 'agent-1', 'agent-2'])
  assert.deepEqual([...first], [...refreshed])
})

test('gives visible agents distinct friendly names', () => {
  const names = [...assignAgentNames(Array.from({ length: 50 }, (_, index) => `worker-${index}`)).values()]
  assert.equal(new Set(names).size, names.length)
  assert.ok(names.every((name) => /^[A-Z][a-z]+$/.test(name)))
})

test('a colliding arrival before existing IDs does not rename them', () => {
  const existingIds = Array.from({ length: 40 }, (_, index) => `worker-${index}`)
  const before = assignAgentNames(existingIds)
  const after = assignAgentNames(['000-new', ...existingIds], before)
  for (const id of existingIds) assert.equal(after.get(id), before.get(id))
  assert.ok(after.get('000-new'))
})

test('survivors keep persisted names while departed names are released', () => {
  const ids = Array.from({ length: 40 }, (_, index) => `worker-${index}`)
  const first = assignAgentNames(ids)
  const survivors = ids.slice(1)
  const afterDeparture = assignAgentNames(survivors, first)
  const restarted = assignAgentNames(ids, readAgentNames(Object.fromEntries(afterDeparture)))
  for (const id of survivors) assert.equal(afterDeparture.get(id), first.get(id))
  assert.equal(afterDeparture.has(ids[0]), false)
  for (const id of survivors) assert.equal(restarted.get(id), first.get(id))
})

test('reuses names across many generations without accumulating numeric suffixes', () => {
  let names = new Map<string, string>()
  for (let generation = 0; generation < 20; generation++) {
    const ids = Array.from({ length: 50 }, (_, index) => `${generation}:${index}`)
    names = assignAgentNames(ids, names)
    assert.equal(names.size, 50)
    assert.equal(new Set(names.values()).size, 50)
    assert.ok([...names.values()].every((name) => !/\d/.test(name)))
  }
})
