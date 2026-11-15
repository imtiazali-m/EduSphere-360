import test from 'node:test'
import assert from 'node:assert/strict'
import { signDevicePayload, verifyDeviceSignature } from '../supabase/functions/_shared/device-signature.js'

test('accepts a valid signed attendance payload inside the timestamp window', async () => {
  const secret = 'test-device-secret-not-for-production'
  const timestamp = 1_800_000_000
  const body = JSON.stringify({ external_event_id: 'event-001', match_result: true })
  const signature = await signDevicePayload(secret, timestamp, body)
  assert.equal(await verifyDeviceSignature(secret, timestamp, body, signature, timestamp), true)
})

test('rejects a payload that has been altered after signing', async () => {
  const timestamp = 1_800_000_000
  const signature = await signDevicePayload('test-device-secret', timestamp, '{"ok":true}')
  assert.equal(await verifyDeviceSignature('test-device-secret', timestamp, '{"ok":false}', signature, timestamp), false)
})

test('rejects signatures from another device secret', async () => {
  const timestamp = 1_800_000_000
  const body = '{"event":"check_in"}'
  const signature = await signDevicePayload('device-A-secret', timestamp, body)
  assert.equal(await verifyDeviceSignature('device-B-secret', timestamp, body, signature, timestamp), false)
})

test('rejects stale requests and malformed signatures', async () => {
  const timestamp = 1_800_000_000
  const body = '{"event":"check_in"}'
  const signature = await signDevicePayload('test-device-secret', timestamp, body)
  assert.equal(await verifyDeviceSignature('test-device-secret', timestamp, body, signature, timestamp + 301), false)
  assert.equal(await verifyDeviceSignature('test-device-secret', timestamp, body, 'bad-signature', timestamp), false)
})
