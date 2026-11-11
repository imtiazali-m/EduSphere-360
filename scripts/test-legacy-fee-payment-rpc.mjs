import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(root, 'supabase/migrations/20261111150000_harden_legacy_fee_payment_rpc.sql')
const sql = fs.readFileSync(migrationPath, 'utf8')

test('the existing seven-argument legacy RPC signature and defaults remain compatible', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_fee_payment\(\s*p_invoice_id uuid,\s*p_amount numeric,\s*p_payment_method text DEFAULT 'cash'::text,\s*p_transaction_reference text DEFAULT NULL::text,\s*p_bank_name text DEFAULT NULL::text,\s*p_cheque_number text DEFAULT NULL::text,\s*p_remarks text DEFAULT NULL::text\s*\)/i)
  assert.match(sql, /RETURNS uuid/i)
})

test('legacy payment calls delegate to the strict date-aware RPC using named arguments', () => {
  assert.match(sql, /FROM public\.record_fee_payment\(\s*p_invoice_id => p_invoice_id/i)
  assert.match(sql, /p_payment_reference => p_transaction_reference/i)
  assert.match(sql, /p_payment_date => \(now\(\) AT TIME ZONE 'Asia\/Karachi'\)::date/i)
  assert.match(sql, /p_notes => p_remarks/i)
  assert.match(sql, /INTO v_payment_id/i)
})

test('legacy wrapper cannot bypass strict payment validation with duplicate inserts', () => {
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.fee_payments/i)
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.fee_payment_allocations/i)
  assert.doesNotMatch(sql, /UPDATE\s+public\.fee_invoices/i)
  assert.match(sql, /public\.record_fee_payment\(/i)
})

test('legacy bank and cheque metadata is written only to the returned payment and invoice', () => {
  assert.match(sql, /SET bank_name = nullif\(btrim\(coalesce\(p_bank_name, ''\)\), ''\)/i)
  assert.match(sql, /cheque_number = nullif\(btrim\(coalesce\(p_cheque_number, ''\)\), ''\)/i)
  assert.match(sql, /WHERE id = v_payment_id\s+AND invoice_id = p_invoice_id/i)
  assert.match(sql, /GET DIAGNOSTICS v_updated = ROW_COUNT/i)
  assert.match(sql, /IF v_updated <> 1 THEN/i)
})

test('legacy wrapper uses a hardened definer search path and authenticated-only execution', () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_fee_payment\(uuid,numeric,text,text,text,text,text\) FROM PUBLIC, anon/i)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.record_fee_payment\(uuid,numeric,text,text,text,text,text\) TO authenticated/i)
})

test('the compatibility wrapper does not grant authenticated direct table updates', () => {
  const originalCompatibilityMigration = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261108032753_live_schema_compatibility.sql'),
    'utf8',
  )
  assert.match(originalCompatibilityMigration, /REVOKE INSERT,UPDATE,DELETE ON public\.fee_payments FROM authenticated/i)
  assert.ok(sql.includes('bank/cheque metadata contract'))
  assert.doesNotMatch(sql, /GRANT\s+UPDATE\s+ON\s+public\.fee_payments/i)
})
