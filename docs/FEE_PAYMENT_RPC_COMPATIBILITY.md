# Legacy fee-payment RPC hardening

## Finding

The connected Supabase database contains two authenticated `SECURITY DEFINER` overloads named `public.record_fee_payment`.

- The six-argument overload accepts `p_payment_reference`, `p_payment_date`, and `p_notes`. It validates authenticated finance role, method, exact two-decimal amounts, Pakistan-local future dates, invoice balance and overpayment, then writes the payment, allocation, audit event and invoice status atomically.
- The seven-argument legacy overload accepts `p_transaction_reference`, `p_bank_name`, `p_cheque_number`, and `p_remarks`. Its previous body duplicated payment logic but did not enforce the newer method/date/exact-cents checks.

The current application calls the six-argument overload. The old migration explicitly preserved authenticated execution of the seven-argument overload, so silently dropping that API or revoking it could break older clients.

The authenticated role has **no direct UPDATE privilege** on `fee_payments`. The old function's SECURITY DEFINER status is therefore necessary to preserve bank/cheque metadata without broadening table grants.

## Change

The migration preserves the legacy function signature, parameter names, return type and defaults, but replaces its implementation with a narrow compatibility wrapper:

1. Call the stricter six-argument overload with named parameters. The date is derived from the current `Asia/Karachi` local date because the legacy API has no payment-date argument.
2. Delegate authentication, tenant finance-role checks, method validation, exact-cents validation, invoice locking and balance validation to that strict operation.
3. Attach optional bank and cheque metadata only to the exact payment ID returned for the requested invoice.
4. Require exactly one updated payment row; failure raises an exception so the entire transaction rolls back.
5. Use an empty search path and retain the existing authenticated-only function grant, with PUBLIC/anon execution revoked.

It intentionally does not add authenticated UPDATE privileges on `fee_payments` or duplicate payment, allocation, invoice-balance or audit writes.

## Verification and release safety

`scripts/test-legacy-fee-payment-rpc.mjs` statically checks the compatibility signature, delegation, strict date mapping, narrow metadata update, rollback guard and grants. The focused GitHub Actions workflow also runs the full project verifier and production build.

This is a **source-only staged migration**. It does not modify the connected database, live grants, existing RPCs, payment records or Cloudflare production. Apply only after SQL review and a Supabase remote dry-run confirms the 30 existing migration versions will not be replayed. After deployment, test both named-argument APIs using disposable invoices: valid cash/bank/cheque payments, invalid method, fractional cents, future date, overpayment, non-finance role denial, legacy metadata persistence and transaction rollback.
