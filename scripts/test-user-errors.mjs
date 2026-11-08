import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync(path.join(root, 'src/lib/userErrors.ts'), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(output, { module, exports: module.exports, require })
const { userFacingError } = module.exports

const tests = [
  ['RLS diagnostics are translated', new Error('new row violates row-level security policy for table students'), 'Could not save.', /does not have permission/],
  ['Postgres permission errors are translated', Object.assign(new Error('permission denied for table students'), { code: '42501' }), 'Could not save.', /does not have permission/],
  ['Duplicate constraints are translated', Object.assign(new Error('duplicate key value violates unique constraint students_admission_no_key'), { code: '23505' }), 'Could not save.', /already exists/],
  ['Foreign-key errors are translated', Object.assign(new Error('insert or update violates foreign key constraint'), { code: '23503' }), 'Could not save.', /linked record could not be found/],
  ['Network errors are translated', new TypeError('Failed to fetch'), 'Could not load.', /internet connection was interrupted/],
  ['Authentication failures are translated', new Error('Invalid login credentials'), 'Unable to sign in.', /email address or password is incorrect/],
  ['Email verification is explained', new Error('Email not confirmed'), 'Unable to sign in.', /verify your email/],
  ['SQL schema details use a safe fallback', new Error('column student_id does not exist'), 'Could not load.', /^Could not load\.$/],
  ['Application validation text is preserved', new Error('Attendance has already been recorded for this student on the selected date.'), 'Could not save.', /Attendance has already been recorded/],
  ['Unknown errors use the safe fallback', { message: 'Unexpected server failure', code: 'PGRST999' }, 'Could not save.', /^Could not save\.$/],
  ['Expired sessions are actionable', { message: 'Unauthorized', status: 401 }, 'Could not save.', /session has expired/],
  ['Forbidden requests do not leak details', { message: 'Forbidden by row security', status: 403 }, 'Could not save.', /does not have permission/],
  ['Server errors use a safe fallback', { message: 'upstream internal server error in postgres', status: 500 }, 'Could not save.', /^Could not save\.$/],
  ['Unsupported uploads are explained', { message: 'mime type application/zip not supported' }, 'Could not upload.', /file type is not supported/],
  ['Oversized uploads are explained', { message: 'EntityTooLarge: payload too large' }, 'Could not upload.', /larger than the allowed limit/],
]
for (const [label, error, fallback, expected] of tests) {
  const actual = userFacingError(error, fallback)
  assert.match(actual, expected, label)
  if (/security policy|permission denied|constraint|column .* does not exist|PGRST/i.test(String(error?.message ?? error))) {
    assert.ok(!actual.includes(String(error?.message ?? error)), `${label}: raw provider message leaked`)
  }
  console.log(`PASS  ${label}`)
}
console.log(`\n${tests.length} user-facing error tests passed.`)
