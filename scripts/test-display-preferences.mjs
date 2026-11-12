import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DASHBOARD_DISPLAY_PREFERENCES_KEY,
  DEFAULT_DASHBOARD_DISPLAY_PREFERENCES,
  normalizeDisplayPreferences,
  readDisplayPreferences,
  writeDisplayPreferences,
} from '../src/lib/displayPreferences.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    values,
  }
}

test('defaults to Modern, Light, standard text, expanded sidebar and normal motion', () => {
  assert.deepEqual(readDisplayPreferences(createStorage()), DEFAULT_DASHBOARD_DISPLAY_PREFERENCES)
})

test('reads all supported settings from the device preference key', () => {
  const storage = createStorage({
    [DASHBOARD_DISPLAY_PREFERENCES_KEY]: JSON.stringify({
      viewMode: 'classic',
      theme: 'dark',
      fontSize: 'largest',
      sidebar: 'compact',
      reducedMotion: true,
    }),
  })
  assert.deepEqual(readDisplayPreferences(storage), {
    viewMode: 'classic',
    theme: 'dark',
    fontSize: 'largest',
    sidebar: 'compact',
    reducedMotion: true,
  })
})

test('normalizes unsupported or malformed setting values to safe defaults', () => {
  assert.deepEqual(normalizeDisplayPreferences({
    viewMode: 'other',
    theme: 'auto',
    fontSize: 'tiny',
    sidebar: 'hidden',
    reducedMotion: 'yes',
  }), DEFAULT_DASHBOARD_DISPLAY_PREFERENCES)
})

test('a damaged preference record falls back without throwing', () => {
  const storage = createStorage({ [DASHBOARD_DISPLAY_PREFERENCES_KEY]: '{not-json' })
  assert.deepEqual(readDisplayPreferences(storage), DEFAULT_DASHBOARD_DISPLAY_PREFERENCES)
})

test('storage read failure falls back without blocking the dashboard', () => {
  const storage = { getItem() { throw new Error('Storage access denied') }, setItem() {} }
  assert.deepEqual(readDisplayPreferences(storage), DEFAULT_DASHBOARD_DISPLAY_PREFERENCES)
})

test('writes normalized settings using the versioned device-local key', () => {
  const storage = createStorage()
  const written = writeDisplayPreferences(storage, {
    viewMode: 'classic',
    theme: 'dark',
    fontSize: 'large',
    sidebar: 'compact',
    reducedMotion: true,
  })
  assert.equal(written, true)
  assert.deepEqual(JSON.parse(storage.values.get(DASHBOARD_DISPLAY_PREFERENCES_KEY)), {
    viewMode: 'classic',
    theme: 'dark',
    fontSize: 'large',
    sidebar: 'compact',
    reducedMotion: true,
  })
})

test('storage write failure is non-fatal', () => {
  const storage = { getItem() { return null }, setItem() { throw new Error('Quota exceeded') } }
  assert.equal(writeDisplayPreferences(storage, DEFAULT_DASHBOARD_DISPLAY_PREFERENCES), false)
  assert.equal(writeDisplayPreferences(null, DEFAULT_DASHBOARD_DISPLAY_PREFERENCES), false)
})
