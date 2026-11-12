-- Preserve the seven-argument legacy fee-payment RPC without retaining
-- its weaker duplicate payment implementation. Delegate every payment to
-- the validated six-argument operation, then attach legacy bank/cheque fields
-- to the exact payment row it returned.
--
-- This migration is staged for review; it is not applied to the live project.

CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash'::text,
  p_transaction_reference text DEFAULT NULL::text,
  p_bank_name text DEFAULT NULL::text,
  p_cheque_number text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment_id uuid;
  v_updated integer;
BEGIN
  -- The named-argument call selects the strict, date-aware overload. It owns
  -- authentication, finance-role, method, exact-cents, future-date,
  -- invoice-locking and outstanding-balance validation.
  SELECT payment.payment_id
    INTO v_payment_id
    FROM public.record_fee_payment(
      p_invoice_id => p_invoice_id,
      p_amount => p_amount,
      p_payment_method => p_payment_method,
      p_payment_reference => p_transaction_reference,
      p_payment_date => (now() AT TIME ZONE 'Asia/Karachi')::date,
      p_notes => p_remarks
    ) AS payment;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'The validated fee-payment operation did not return a payment ID.';
  END IF;

  -- Authenticated clients intentionally have no direct UPDATE privilege on
  -- fee_payments. This narrow SECURITY DEFINER wrapper preserves the old
  -- bank/cheque metadata contract without opening direct table writes.
  UPDATE public.fee_payments
     SET bank_name = nullif(btrim(coalesce(p_bank_name, '')), ''),
         cheque_number = nullif(btrim(coalesce(p_cheque_number, '')), '')
   WHERE id = v_payment_id
     AND invoice_id = p_invoice_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'The validated payment was recorded, but its legacy payment metadata could not be attached.';
  END IF;

  RETURN v_payment_id;
END;
$function$;

-- Keep the existing legacy API role contract. The stricter implementation
-- called by this wrapper performs the tenant finance-role authorization.
REVOKE ALL ON FUNCTION public.record_fee_payment(uuid,numeric,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid,numeric,text,text,text,text,text) TO authenticated;
