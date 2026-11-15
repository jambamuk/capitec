import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activitySeries,
} from '../src/features/overview/chart-data.ts'

function report(patch = {}) {
  return {
    from: '2026-11-11',
    toExclusive: '2026-11-12',
    asOf: '2026-11-10T22:10:30Z',
    receivedFrom: '2026-11-10T21:56:00Z',
    bucket: 'hour',
    transactions: { activity: [], arrivals: [] },
    ...patch,
  }
}

test('quiet periods are zero-filled using South African calendar boundaries', () => {
  const rows = activitySeries(report())
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, '00:00')
  assert.equal(rows[0].credits, 0)
  assert.equal(rows[0].moneyIn, '0.00')
})

test('a later payment bucket remains visible and exact amounts are preserved', () => {
  const data = report({
    transactions: {
      activity: [
        {
          at: '2026-11-11T21:00:00Z',
          credits: 0,
          debits: 1,
          moneyIn: '0.00',
          moneyOut: '900719925474099.99',
        },
      ],
      arrivals: [],
    },
  })
  const rows = activitySeries(data)
  assert.equal(rows.length, 24)
  assert.equal(rows.at(-1).label, '23:00')
  assert.equal(rows.at(-1).moneyOut, '900719925474099.99')
  assert.equal(
    rows.reduce((sum, row) => sum + row.debits, 0),
    1,
  )
})

test('the exclusive end never introduces an extra day', () => {
  const rows = activitySeries(
    report({ bucket: 'day', asOf: '2026-11-11T22:00:00Z' }),
  )
  assert.equal(rows.length, 1)
})
