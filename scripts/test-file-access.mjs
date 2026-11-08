import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync(path.join(root, 'src/lib/fileAccess.ts'), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(output, { module, exports: module.exports, require })
const { canUploadInstitutionFiles, canDeleteInstitutionFiles } = module.exports

const roles = ['owner', 'admin', 'teacher', 'student', 'parent', 'accountant', 'exam_officer']
for (const role of roles) {
  assert.equal(canUploadInstitutionFiles(role), ['owner', 'admin', 'teacher'].includes(role), `${role} upload permission`)
  assert.equal(canDeleteInstitutionFiles(role), ['owner', 'admin'].includes(role), `${role} delete permission`)
  console.log(`PASS  ${role}: upload=${canUploadInstitutionFiles(role)}, delete=${canDeleteInstitutionFiles(role)}`)
}
assert.equal(canUploadInstitutionFiles(null), false, 'anonymous upload denied')
assert.equal(canDeleteInstitutionFiles(undefined), false, 'missing role delete denied')
console.log('PASS  anonymous/missing role denied')
console.log(`\n${roles.length * 2 + 2} file permission checks passed.`)
