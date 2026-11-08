export interface InvoiceBalanceFields {
  amount?: number | string | null
  fine_amount?: number | string | null
  discount_amount?: number | string | null
  paid_amount?: number | string | null
  balance?: number | string | null
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Prefer the database-generated balance snapshot. Recompute from the same
 * invoice formula only when the snapshot is absent or invalid.
 */
export function outstandingInvoiceBalance(invoice: InvoiceBalanceFields) {
  if (invoice.balance !== null && invoice.balance !== undefined && invoice.balance !== '') {
    const snapshot = Number(invoice.balance)
    if (Number.isFinite(snapshot)) return Math.max(0, snapshot)
  }

  const totalDue = numeric(invoice.amount) + numeric(invoice.fine_amount) - numeric(invoice.discount_amount)
  return Math.max(0, totalDue - numeric(invoice.paid_amount))
}

export function netInvoiceAmount(invoice: InvoiceBalanceFields) {
  return Math.max(0, numeric(invoice.amount) + numeric(invoice.fine_amount) - numeric(invoice.discount_amount))
}
