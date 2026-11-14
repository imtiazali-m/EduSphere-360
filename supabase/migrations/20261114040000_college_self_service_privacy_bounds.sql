
ALTER POLICY college_ops_institution_form_definitions_select ON public.institution_form_definitions
USING (
 private.has_institution_permission(institution_id,'forms','view',NULL,NULL)
 AND (
  public.has_institution_role(institution_id,ARRAY['owner','admin']::text[])
  OR (status='published' AND EXISTS (
   SELECT 1 FROM public.memberships m
   WHERE m.institution_id=institution_form_definitions.institution_id
     AND m.user_id=(SELECT auth.uid()) AND m.status='active'
     AND m.role=ANY(institution_form_definitions.audience_roles)
  ))
 )
);

ALTER POLICY college_ops_institution_form_submissions_select ON public.institution_form_submissions
USING (
 (private.has_institution_permission(institution_id,'forms','view',NULL,NULL)
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher','accountant','exam_officer']::text[]))
 OR submitted_by=(SELECT auth.uid())
);

ALTER POLICY college_ops_institution_messages_select ON public.institution_messages
USING (
 (private.has_institution_permission(institution_id,'communications','view',NULL,NULL)
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher','accountant','exam_officer']::text[]))
 OR sender_user_id=(SELECT auth.uid()) OR recipient_user_id=(SELECT auth.uid())
);

ALTER POLICY college_ops_institution_helpdesk_tickets_select ON public.institution_helpdesk_tickets
USING (
 (private.has_institution_permission(institution_id,'helpdesk','view',NULL,NULL)
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher','accountant','exam_officer']::text[]))
 OR created_by=(SELECT auth.uid()) OR assigned_to=(SELECT auth.uid())
);

ALTER POLICY college_ops_institution_helpdesk_comments_select ON public.institution_helpdesk_comments
USING (
 (private.has_institution_permission(institution_id,'helpdesk','view',NULL,NULL)
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher','accountant','exam_officer']::text[]))
 OR author_id=(SELECT auth.uid())
 OR EXISTS (
  SELECT 1 FROM public.institution_helpdesk_tickets t
  WHERE t.id=institution_helpdesk_comments.ticket_id
    AND t.institution_id=institution_helpdesk_comments.institution_id
    AND (t.created_by=(SELECT auth.uid()) OR t.assigned_to=(SELECT auth.uid()))
 )
);

ALTER POLICY college_ops_library_reading_records_select ON public.library_reading_records
USING (
 (private.has_institution_permission(
   institution_id,'library','view',
   (SELECT s.campus_id FROM public.students s
    WHERE s.id=library_reading_records.student_id AND s.institution_id=library_reading_records.institution_id),
   (SELECT private.college_department_for_student(library_reading_records.student_id))
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]))
 OR public.can_view_student(student_id)
);

ALTER POLICY college_ops_fee_receipt_ledger_select ON public.fee_receipt_ledger
USING (
 private.has_institution_permission(
  institution_id,'fees','view',
  (SELECT COALESCE(fp.campus_id,fi.campus_id,s.campus_id)
   FROM public.fee_payments fp
   LEFT JOIN public.fee_invoices fi ON fi.id=fp.invoice_id AND fi.institution_id=fp.institution_id
   LEFT JOIN public.students s ON s.id=fi.student_id AND s.institution_id=fi.institution_id
   WHERE fp.id=fee_receipt_ledger.payment_id AND fp.institution_id=fee_receipt_ledger.institution_id),
  (SELECT private.college_department_for_student(fi.student_id)
   FROM public.fee_payments fp
   LEFT JOIN public.fee_invoices fi ON fi.id=fp.invoice_id AND fi.institution_id=fp.institution_id
   WHERE fp.id=fee_receipt_ledger.payment_id AND fp.institution_id=fee_receipt_ledger.institution_id)
 )
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[])
);

ALTER POLICY college_ops_fee_receipt_sequences_select ON public.fee_receipt_sequences
USING (
 private.has_institution_permission(institution_id,'fees','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[])
);

ALTER POLICY college_ops_payment_gateway_reviews_select ON public.payment_gateway_reviews
USING (
 private.has_institution_permission(
  institution_id,'fees','view',
  (SELECT COALESCE(fp.campus_id,fi.campus_id,s.campus_id)
   FROM public.fee_payments fp
   LEFT JOIN public.fee_invoices fi ON fi.id=fp.invoice_id AND fi.institution_id=fp.institution_id
   LEFT JOIN public.students s ON s.id=fi.student_id AND s.institution_id=fi.institution_id
   WHERE fp.id=payment_gateway_reviews.payment_id AND fp.institution_id=payment_gateway_reviews.institution_id),
  (SELECT private.college_department_for_student(fi.student_id)
   FROM public.fee_payments fp
   LEFT JOIN public.fee_invoices fi ON fi.id=fp.invoice_id AND fi.institution_id=fp.institution_id
   WHERE fp.id=payment_gateway_reviews.payment_id AND fp.institution_id=payment_gateway_reviews.institution_id)
 )
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[])
);

ALTER POLICY college_ops_hostel_buildings_select ON public.hostel_buildings
USING (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]));
ALTER POLICY college_ops_hostel_rooms_select ON public.hostel_rooms
USING (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]));
ALTER POLICY college_ops_hostel_beds_select ON public.hostel_beds
USING (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]));
ALTER POLICY college_ops_hostel_guest_visits_select ON public.hostel_guest_visits
USING (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]));
ALTER POLICY college_ops_hostel_maintenance_requests_select ON public.hostel_maintenance_requests
USING (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]));

ALTER POLICY college_ops_hostel_residents_select ON public.hostel_residents
USING (
 (private.has_institution_permission(
   institution_id,'hostel','view',
   (SELECT s.campus_id FROM public.students s
    WHERE s.id=hostel_residents.student_id AND s.institution_id=hostel_residents.institution_id),
   (SELECT private.college_department_for_student(hostel_residents.student_id))
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]))
 OR public.can_view_student(student_id)
);

ALTER POLICY college_ops_hostel_movements_select ON public.hostel_movements
USING (
 (private.has_institution_permission(institution_id,'hostel','view',NULL,NULL)
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[]))
 OR EXISTS (
  SELECT 1 FROM public.hostel_residents hr
  WHERE hr.id=hostel_movements.resident_id
    AND hr.institution_id=hostel_movements.institution_id
    AND public.can_view_student(hr.student_id)
 )
);

ALTER POLICY college_ops_hostel_fee_charges_select ON public.hostel_fee_charges
USING (
 (private.has_institution_permission(
   institution_id,'hostel','view',
   (SELECT s.campus_id FROM public.hostel_residents hr
    JOIN public.students s ON s.id=hr.student_id AND s.institution_id=hr.institution_id
    WHERE hr.id=hostel_fee_charges.resident_id AND hr.institution_id=hostel_fee_charges.institution_id),
   (SELECT private.college_department_for_student(hr.student_id) FROM public.hostel_residents hr
    WHERE hr.id=hostel_fee_charges.resident_id AND hr.institution_id=hostel_fee_charges.institution_id)
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[]))
 OR EXISTS (
  SELECT 1 FROM public.hostel_residents hr
  WHERE hr.id=hostel_fee_charges.resident_id AND hr.institution_id=hostel_fee_charges.institution_id
    AND public.can_view_student(hr.student_id)
 )
);

ALTER POLICY college_ops_hostel_fee_payments_select ON public.hostel_fee_payments
USING (
 (private.has_institution_permission(
   institution_id,'hostel','view',
   (SELECT s.campus_id FROM public.hostel_fee_charges hc
    JOIN public.hostel_residents hr ON hr.id=hc.resident_id AND hr.institution_id=hc.institution_id
    JOIN public.students s ON s.id=hr.student_id AND s.institution_id=hr.institution_id
    WHERE hc.id=hostel_fee_payments.charge_id AND hc.institution_id=hostel_fee_payments.institution_id),
   (SELECT private.college_department_for_student(hr.student_id) FROM public.hostel_fee_charges hc
    JOIN public.hostel_residents hr ON hr.id=hc.resident_id AND hr.institution_id=hc.institution_id
    WHERE hc.id=hostel_fee_payments.charge_id AND hc.institution_id=hostel_fee_payments.institution_id)
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[]))
 OR EXISTS (
  SELECT 1 FROM public.hostel_fee_charges hc
  JOIN public.hostel_residents hr ON hr.id=hc.resident_id AND hr.institution_id=hc.institution_id
  WHERE hc.id=hostel_fee_payments.charge_id AND hc.institution_id=hostel_fee_payments.institution_id
    AND public.can_view_student(hr.student_id)
 )
);

ALTER POLICY college_ops_student_transport_allocations_select ON public.student_transport_allocations
USING (
 (private.has_institution_permission(
   institution_id,'transport','view',
   (SELECT s.campus_id FROM public.students s
    WHERE s.id=student_transport_allocations.student_id AND s.institution_id=student_transport_allocations.institution_id),
   (SELECT private.college_department_for_student(student_transport_allocations.student_id))
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher','accountant']::text[]))
 OR public.can_view_student(student_id)
);

ALTER POLICY college_ops_student_transport_fee_charges_select ON public.student_transport_fee_charges
USING (
 (private.has_institution_permission(
   institution_id,'transport','view',
   (SELECT s.campus_id FROM public.student_transport_allocations a
    JOIN public.students s ON s.id=a.student_id AND s.institution_id=a.institution_id
    WHERE a.id=student_transport_fee_charges.allocation_id AND a.institution_id=student_transport_fee_charges.institution_id),
   (SELECT private.college_department_for_student(a.student_id) FROM public.student_transport_allocations a
    WHERE a.id=student_transport_fee_charges.allocation_id AND a.institution_id=student_transport_fee_charges.institution_id)
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[]))
 OR EXISTS (
  SELECT 1 FROM public.student_transport_allocations a
  WHERE a.id=student_transport_fee_charges.allocation_id AND a.institution_id=student_transport_fee_charges.institution_id
    AND public.can_view_student(a.student_id)
 )
);

ALTER POLICY college_ops_student_transport_fee_payments_select ON public.student_transport_fee_payments
USING (
 (private.has_institution_permission(
   institution_id,'transport','view',
   (SELECT s.campus_id FROM public.student_transport_fee_charges c
    JOIN public.student_transport_allocations a ON a.id=c.allocation_id AND a.institution_id=c.institution_id
    JOIN public.students s ON s.id=a.student_id AND s.institution_id=a.institution_id
    WHERE c.id=student_transport_fee_payments.charge_id AND c.institution_id=student_transport_fee_payments.institution_id),
   (SELECT private.college_department_for_student(a.student_id) FROM public.student_transport_fee_charges c
    JOIN public.student_transport_allocations a ON a.id=c.allocation_id AND a.institution_id=c.institution_id
    WHERE c.id=student_transport_fee_payments.charge_id AND c.institution_id=student_transport_fee_payments.institution_id)
  )
  AND public.has_institution_role(institution_id,ARRAY['owner','admin','accountant']::text[]))
 OR EXISTS (
  SELECT 1 FROM public.student_transport_fee_charges c
  JOIN public.student_transport_allocations a ON a.id=c.allocation_id AND a.institution_id=c.institution_id
  WHERE c.id=student_transport_fee_payments.charge_id AND c.institution_id=student_transport_fee_payments.institution_id
    AND public.can_view_student(a.student_id)
 )
);

ALTER POLICY college_ops_transport_attendance_events_select ON public.transport_attendance_events
USING (
 private.has_institution_permission(
  institution_id,'transport','view',
  (SELECT s.campus_id FROM public.student_transport_allocations a
   JOIN public.students s ON s.id=a.student_id AND s.institution_id=a.institution_id
   WHERE a.id=transport_attendance_events.allocation_id AND a.institution_id=transport_attendance_events.institution_id),
  (SELECT private.college_department_for_student(a.student_id) FROM public.student_transport_allocations a
   WHERE a.id=transport_attendance_events.allocation_id AND a.institution_id=transport_attendance_events.institution_id)
 )
 AND public.has_institution_role(institution_id,ARRAY['owner','admin','teacher']::text[])
);
