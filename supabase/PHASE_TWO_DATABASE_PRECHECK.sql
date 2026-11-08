-- Run this query before migration 014 if discount_amount already exists (for example, after migration 007).
-- It identifies invoices that would violate the post-discount balance rule.
select
  id,
  invoice_no,
  student_name,
  amount,
  discount_amount,
  paid_amount,
  amount - discount_amount - paid_amount as calculated_balance
from public.fee_invoices
where discount_amount < 0
   or discount_amount > amount
   or paid_amount < 0
   or paid_amount > amount - discount_amount
order by created_at desc;

-- Do not change these amounts automatically. Review and correct only after verifying
-- the real invoice and payment history with the institution's finance owner.
