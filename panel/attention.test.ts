import { assert, test } from 'orca/testing'
import { attentionTimeText } from './attention'

test('reports observed needs-you and done durations without inventing a finish time', () => {
  assert.equal(attentionTimeText({ state: 'blocked', stateStartedAt: 10_000, finishedAt: null }, 70_000), 'Needs you for 1m')
  assert.equal(attentionTimeText({ state: 'done', stateStartedAt: 10_000, finishedAt: 20_000 }, 80_000), 'Finished 1m ago')
  assert.equal(attentionTimeText({ state: 'done', stateStartedAt: 10_000, finishedAt: null }, 80_000), 'Done observed 1m ago')
  assert.equal(attentionTimeText({ state: 'done', stateStartedAt: Number.NaN, finishedAt: null }, 80_000), 'Finish time unavailable')
})
