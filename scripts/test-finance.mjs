import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync(path.join(root, 'src/lib/finance.ts'), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(output, { module, exports: module.exports, require })
const { outstandingInvoiceBalance, netInvoiceAmount } = module.exports

const cases = [
  ['generated balance snapshot is preferred', { amount: 1000, fine_amount: 50, discount_amount: 100, paid_amount: 300, balance: 650 }, 650],
  ['fallback includes fines and discounts', { amount: 1000, fine_amount: 50, discount_amount: 100, paid_amount: 300 }, 650],
  ['fallback treats missing numeric fields as zero', { amount: 500, paid_amount: 125 }, 375],
  ['overpayment never produces negative outstanding', { amount: 100, paid_amount: 125 }, 0],
  ['invalid snapshot falls back to invoice components', { amount: 100, fine_amount: 10, discount_amount: 5, paid_amount: 25, balance: 'not-a-number' }, 80],
  ['zero balance remains zero', { amount: 300, paid_amount: 300, balance: 0 }, 0],
]
for (const [label, invoice, expected] of cases) {
  assert.equal(outstandingInvoiceBalance(invoice), expected, label)
  console.log(`PASS  ${label}`)
}
assert.equal(netInvoiceAmount({ amount: 1000, fine_amount: 50, discount_amount: 100 }), 950)
console.log('PASS  net invoice amount includes fines and discounts')
console.log(`\n${cases.length + 1} finance calculations passed.`)
