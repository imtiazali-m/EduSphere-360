import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url)
const migrationDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const ledgerUrl = new URL('../docs/REMOTE_MIGRATION_LEDGER_2026-11-16.json', import.meta.url)
const ledger = JSON.parse(readFileSync(ledgerUrl, 'utf8'))

const sqlFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const timestampedFiles = sqlFiles
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .map((file) => ({ version: file.slice(0, 14), file }))

const legacySqlFiles = sqlFiles.filter((file) => !/^\d{14}_.+\.sql$/.test(file))
const remote = ledger.remote_applied_migrations
const localVersions = new Set(timestampedFiles.map((entry) => entry.version))
const remoteVersions = new Set(remote.map((entry) => entry.version))

function normalizeMigrationName(value) {
  return String(value ?? '')
    .replace(/^\d{14}_/, '')
    .replace(/^\d{8}_/, '')
    .replace(/\.sql$/, '')
}

const localByName = new Map(timestampedFiles.map((entry) => [
  normalizeMigrationName(entry.file),
  entry,
]))
const remoteByName = new Map(remote.map((entry) => [
  normalizeMigrationName(entry.name),
  entry,
]))

const unmatchedLocalVersions = timestampedFiles
  .filter((entry) => !remoteVersions.has(entry.version))
  .map((entry) => entry.version)

const unmatchedRemoteVersions = remote
  .filter((entry) => !localVersions.has(entry.version))
  .map((entry) => entry.version)

const unmatchedLocalNames = timestampedFiles
  .filter((entry) => !remoteByName.has(normalizeMigrationName(entry.file)))
  .map((entry) => ({
    version: entry.version,
    name: normalizeMigrationName(entry.file),
  }))

const unmatchedRemoteNames = remote
  .filter((entry) => !localByName.has(normalizeMigrationName(entry.name)))
  .map((entry) => ({
    version: entry.version,
    name: normalizeMigrationName(entry.name),
  }))

const sameNameVersionMismatches = timestampedFiles
  .flatMap((entry) => {
    const name = normalizeMigrationName(entry.file)
    const remoteEntry = remoteByName.get(name)
    return remoteEntry && remoteEntry.version !== entry.version
      ? [{ name, local_version: entry.version, remote_version: remoteEntry.version }]
      : []
  })
  .sort((a, b) => a.name.localeCompare(b.name))

test('the snapshot identifies the repository and remote project baseline', () => {
  assert.equal(ledger.repository, 'imtiazali-m/EduSphere-360')
  assert.equal(ledger.main_sha, 'b3cf18201dd1b2aa4bab04e7f7713eb96bf156e0')
  assert.equal(ledger.supabase_project_ref, 'osqhgsqrqhollxxtwrgy')
  assert.equal(ledger.snapshot_date, '2026-11-16')
})

test('all timestamped migration files match the recorded main-branch snapshot', () => {
  assert.deepEqual(timestampedFiles, ledger.local_timestamped_migrations)
  assert.equal(timestampedFiles.length, ledger.reconciliation.local_timestamped_count)
  assert.equal(new Set(timestampedFiles.map((entry) => entry.version)).size, timestampedFiles.length)
})

test('legacy numbered SQL files remain separately identified and are not treated as timestamped migrations', () => {
  assert.deepEqual(legacySqlFiles, ledger.legacy_sql_files)
  assert.equal(legacySqlFiles.length, ledger.reconciliation.legacy_sql_count)
})

test('remote migration versions are unique, ordered, and match the captured live ledger', () => {
  const versions = remote.map((entry) => entry.version)
  assert.equal(new Set(versions).size, versions.length)
  assert.deepEqual(versions, [...versions].sort())
  assert.equal(remote.length, ledger.reconciliation.remote_count)
})

test('exact local/remote version-prefix drift matches the recorded reconciliation', () => {
  assert.deepEqual(unmatchedLocalVersions, ledger.reconciliation.unmatched_local_versions)
  assert.deepEqual(unmatchedRemoteVersions, ledger.reconciliation.unmatched_remote_versions)
})

test('name-normalized gaps and same-name version mismatches match the recorded reconciliation', () => {
  assert.deepEqual(unmatchedLocalNames, ledger.reconciliation.unmatched_local_names)
  assert.deepEqual(unmatchedRemoteNames, ledger.reconciliation.unmatched_remote_names)
  assert.deepEqual(sameNameVersionMismatches, ledger.reconciliation.same_name_version_mismatches
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name)))
})

test('the snapshot records drift as a release blocker rather than authorizing replay', () => {
  assert.equal(unmatchedLocalVersions.length, 8)
  assert.equal(unmatchedRemoteVersions.length, 17)
  assert.equal(unmatchedLocalNames.length, 1)
  assert.equal(unmatchedRemoteNames.length, 10)
  assert.equal(sameNameVersionMismatches.length, 7)
  assert.match(ledger.source_note, /not permission to apply, replay, repair or mark migrations/i)
})
