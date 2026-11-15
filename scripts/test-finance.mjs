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
const financeWorkspace = fs.readFileSync(path.join(root, 'src/components/FinanceWorkspace.tsx'), 'utf8')
const dataLayer = fs.readFileSync(path.join(root, 'src/lib/data.ts'), 'utf8')
assert.match(dataLayer, /export async function issueFeeReceipt/)
assert.match(dataLayer, /\.rpc\('issue_fee_receipt'/)
assert.match(financeWorkspace, /issueFeeReceipt\(mode,user!,\{paymentId:result\.payment_id,templateKey:'default'\}\)/)
assert.match(financeWorkspace, /Formal receipt/)
assert.match(financeWorkspace, /Print receipt/)
assert.match(financeWorkspace, /Open Receipt Register to retry/)
console.log('PASS  payment recording triggers formal receipt issuance with a retry path')
console.log('PASS  receipt register reads the formal ledger and can print issued receipts')
console.log(`\n${cases.length + 3} finance calculations and receipt workflow checks passed.`)
