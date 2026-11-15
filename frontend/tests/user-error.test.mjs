import { test } from 'node:test'
import assert from 'node:assert/strict'
import { userErrorMessage, UserInputError } from '../src/lib/user-error.ts'

test('server and runtime diagnostics never reach user-facing messages', () => {
  for (const status of [undefined, 400, 401, 403, 404, 409, 413, 422, 429, 500, 503]) {
    const error = Object.assign(new Error('SELECT secret FROM internal_table at /private/path'), { status })
    const message = userErrorMessage(error)
    assert.doesNotMatch(message, /SELECT|secret|internal_table|private/)
    assert.ok(message.length > 0)
  }
})

test('errors retain useful recovery actions', () => {
  assert.match(userErrorMessage(Object.assign(new Error(), { status: 409 })), /Refresh/)
  assert.match(userErrorMessage(Object.assign(new Error(), { status: 413 })), /10 MB/)
  assert.match(userErrorMessage(Object.assign(new Error(), { status: 401 })), /Sign in/)
})

test('local validation keeps its specific recovery instructions', () => {
  const error = new UserInputError('Choose a PDF first.')
  assert.equal(userErrorMessage(error), 'Choose a PDF first.')
})
