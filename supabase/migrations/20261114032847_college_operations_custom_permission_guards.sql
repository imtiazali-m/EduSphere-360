-- Enforce custom college job-profile permissions for newly integrated operations modules.
-- Existing permissive membership policies remain the first access gate. These restrictive
-- policies add module/action/scope checks for users who have an assigned custom role.
-- Self-service reads for a user's own student, support, message and request records are preserved.

DO $guards$
DECLARE r record; v_definition text; v_marker text;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('public.issue_fee_receipt(uuid,uuid,text)','Owner, administrator or accountant access is required to issue receipts','if not private.has_institution_permission(p_institution_id,''fees'',''create'',
 (select coalesce(fp.campus_id,fi.campus_id,s.campus_id) from public.fee_payments fp
  left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id
  left join public.students s on s.id=fi.student_id and s.institution_id=fi.institution_id
  where fp.id=p_payment_id and fp.institution_id=p_institution_id),
 (select private.college_department_for_student(fi.student_id) from public.fee_payments fp
  left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id
  where fp.id=p_payment_id and fp.institution_id=p_institution_id)) then
 raise exception ''Your college role cannot issue fee receipts for this student.'';
end if;'),
('public.log_scheduled_report_execution(uuid,uuid,text,text,text,integer,jsonb)','Owner, administrator or accountant access is required to run institution reports','if not private.has_institution_permission(p_institution_id,''reports'',''create'',null,null) then
 raise exception ''Your college role cannot execute scheduled reports.'';
end if;'),
('public.record_facility_asset_lifecycle(uuid,uuid,text,date,jsonb)','Only an institution owner or administrator can change asset lifecycle records','if not private.has_institution_permission(p_institution_id,''facilities'',''edit'',
 (select r.campus_id from public.facility_assets fa left join public.rooms r on r.id=fa.room_id and r.institution_id=fa.institution_id where fa.id=p_asset_id and fa.institution_id=p_institution_id),
 null) then
 raise exception ''Your college role cannot update this asset lifecycle record.'';
end if;'),
('public.record_hostel_fee_payment(uuid,uuid,numeric,text,text)','Owner, administrator or accountant access is required to record hostel fee payments','if not private.has_institution_permission(p_institution_id,''hostel'',''create'',
 (select s.campus_id from public.hostel_fee_charges hc join public.hostel_residents hr on hr.id=hc.resident_id and hr.institution_id=hc.institution_id join public.students s on s.id=hr.student_id and s.institution_id=hr.institution_id where hc.id=p_charge_id and hc.institution_id=p_institution_id),
 (select private.college_department_for_student(hr.student_id) from public.hostel_fee_charges hc join public.hostel_residents hr on hr.id=hc.resident_id and hr.institution_id=hc.institution_id where hc.id=p_charge_id and hc.institution_id=p_institution_id)) then
 raise exception ''Your college role cannot record this hostel payment.'';
end if;'),
('public.record_payment_gateway_review(uuid,uuid,text,text,text,text)','Owner, administrator or accountant access is required','if not private.has_institution_permission(p_institution_id,''fees'',''edit'',
 (select coalesce(fp.campus_id,fi.campus_id,s.campus_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id left join public.students s on s.id=fi.student_id and s.institution_id=fi.institution_id where fp.id=p_payment_id and fp.institution_id=p_institution_id),
 (select private.college_department_for_student(fi.student_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id where fp.id=p_payment_id and fp.institution_id=p_institution_id)) then
 raise exception ''Your college role cannot review this payment gateway record.'';
end if;'),
('public.record_student_transport_fee_payment(uuid,uuid,numeric,text,text)','Owner, administrator or accountant access is required','if not private.has_institution_permission(p_institution_id,''transport'',''create'',
 (select s.campus_id from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where c.id=p_charge_id and c.institution_id=p_institution_id),
 (select private.college_department_for_student(a.student_id) from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id where c.id=p_charge_id and c.institution_id=p_institution_id)) then
 raise exception ''Your college role cannot record this transport payment.'';
end if;'),
('public.review_institution_form_submission(uuid,uuid,text,text)','Only an institution owner or administrator can review form submissions','if not private.has_institution_permission(p_institution_id,''forms'',''approve'',null,null) then
 raise exception ''Your college role cannot review form submissions.'';
end if;'),
('public.review_possible_duplicate(uuid,text,uuid,uuid,text,text,text)','Only an institution owner or administrator can review possible duplicates','if not private.has_institution_permission(p_institution_id,''data_management'',''approve'',null,null) then
 raise exception ''Your college role cannot decide possible duplicate matches.'';
end if;'),
('public.set_fee_receipt_sequence(uuid,text,bigint)','Only an authenticated owner or administrator can change receipt numbering','if not private.has_institution_permission(p_institution_id,''fees'',''edit'',null,null) then
 raise exception ''Your college role cannot change institution-wide receipt numbering.'';
end if;'),
('public.update_institution_helpdesk_ticket(uuid,uuid,text,boolean,text)','Only an owner or administrator can manage support tickets','if not private.has_institution_permission(p_institution_id,''helpdesk'',''edit'',null,null) then
 raise exception ''Your college role cannot update support tickets.'';
end if;')) AS g(signature_text,error_text,guard_body)
  LOOP
    SELECT pg_get_functiondef(r.signature_text::regprocedure) INTO v_definition;
    IF v_definition IS NULL THEN RAISE EXCEPTION 'Missing function signature: %',r.signature_text; END IF;
    v_marker := 'raise exception ' || quote_literal(r.error_text) || ';' || E'\n end if;';
    IF position(v_marker IN v_definition)=0 THEN RAISE EXCEPTION 'Could not locate expected base-role guard in %',r.signature_text; END IF;
    IF position('private.has_institution_permission' IN v_definition)=0 THEN
      v_definition := replace(v_definition,v_marker,v_marker || E'\n\n  ' || r.guard_body);
      EXECUTE v_definition;
    END IF;
  END LOOP;
END
$guards$;

DO $policies$
DECLARE r record; v_policy text; v_extra text;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('facility_assets','facilities','(select r.campus_id from public.rooms r where r.id=facility_assets.room_id and r.institution_id=facility_assets.institution_id)','null::uuid',null),
('facility_asset_lifecycle_events','facilities','(select r.campus_id from public.facility_assets fa left join public.rooms r on r.id=fa.room_id and r.institution_id=fa.institution_id where fa.id=facility_asset_lifecycle_events.asset_id and fa.institution_id=facility_asset_lifecycle_events.institution_id)','null::uuid',null),
('hostel_buildings','hostel','null::uuid','null::uuid',null),
('hostel_rooms','hostel','null::uuid','null::uuid',null),
('hostel_beds','hostel','null::uuid','null::uuid',null),
('hostel_guest_visits','hostel','null::uuid','null::uuid',null),
('hostel_maintenance_requests','hostel','null::uuid','null::uuid',null),
('hostel_movements','hostel','null::uuid','null::uuid',null),
('hostel_residents','hostel','(select s.campus_id from public.students s where s.id=hostel_residents.student_id and s.institution_id=hostel_residents.institution_id)','(select private.college_department_for_student(hostel_residents.student_id))','public.can_view_student(hostel_residents.student_id)'),
('hostel_fee_charges','hostel','(select s.campus_id from public.hostel_residents hr join public.students s on s.id=hr.student_id and s.institution_id=hr.institution_id where hr.id=hostel_fee_charges.resident_id and hr.institution_id=hostel_fee_charges.institution_id)','(select private.college_department_for_student(hr.student_id) from public.hostel_residents hr where hr.id=hostel_fee_charges.resident_id and hr.institution_id=hostel_fee_charges.institution_id)','exists (select 1 from public.hostel_residents hr where hr.id=hostel_fee_charges.resident_id and hr.institution_id=hostel_fee_charges.institution_id and public.can_view_student(hr.student_id))'),
('hostel_fee_payments','hostel','(select s.campus_id from public.hostel_fee_charges hc join public.hostel_residents hr on hr.id=hc.resident_id and hr.institution_id=hc.institution_id join public.students s on s.id=hr.student_id and s.institution_id=hr.institution_id where hc.id=hostel_fee_payments.charge_id and hc.institution_id=hostel_fee_payments.institution_id)','(select private.college_department_for_student(hr.student_id) from public.hostel_fee_charges hc join public.hostel_residents hr on hr.id=hc.resident_id and hr.institution_id=hc.institution_id where hc.id=hostel_fee_payments.charge_id and hc.institution_id=hostel_fee_payments.institution_id)','exists (select 1 from public.hostel_fee_charges hc join public.hostel_residents hr on hr.id=hc.resident_id and hr.institution_id=hc.institution_id where hc.id=hostel_fee_payments.charge_id and hc.institution_id=hostel_fee_payments.institution_id and public.can_view_student(hr.student_id))'),
('procurement_requests','procurement','null::uuid','null::uuid','requested_by=(select auth.uid())'),
('procurement_request_items','procurement','null::uuid','null::uuid',null),
('purchase_orders','procurement','null::uuid','null::uuid',null),
('purchase_order_items','procurement','null::uuid','null::uuid',null),
('supplier_directory','procurement','null::uuid','null::uuid',null),
('supplier_quotes','procurement','null::uuid','null::uuid',null),
('supplier_invoices','procurement','null::uuid','null::uuid',null),
('goods_receipts','procurement','null::uuid','null::uuid',null),
('goods_receipt_items','procurement','null::uuid','null::uuid',null),
('cafeteria_menu_items','cafeteria','null::uuid','null::uuid',null),
('cafeteria_daily_availability','cafeteria','null::uuid','null::uuid',null),
('cafeteria_meal_plans','cafeteria','null::uuid','null::uuid',null),
('cafeteria_sales','cafeteria','null::uuid','null::uuid',null),
('cafeteria_sale_items','cafeteria','null::uuid','null::uuid',null),
('institution_form_definitions','forms','null::uuid','null::uuid',null),
('institution_form_submissions','forms','null::uuid','null::uuid','submitted_by=(select auth.uid())'),
('institution_helpdesk_tickets','helpdesk','null::uuid','null::uuid','created_by=(select auth.uid()) or assigned_to=(select auth.uid())'),
('institution_helpdesk_comments','helpdesk','null::uuid','null::uuid','author_id=(select auth.uid()) or exists (select 1 from public.institution_helpdesk_tickets t where t.id=institution_helpdesk_comments.ticket_id and t.institution_id=institution_helpdesk_comments.institution_id and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid())))'),
('library_reading_records','library','(select s.campus_id from public.students s where s.id=library_reading_records.student_id and s.institution_id=library_reading_records.institution_id)','(select private.college_department_for_student(library_reading_records.student_id))','public.can_view_student(library_reading_records.student_id)'),
('fee_receipt_ledger','fees','(select coalesce(fp.campus_id,fi.campus_id,s.campus_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id left join public.students s on s.id=fi.student_id and s.institution_id=fi.institution_id where fp.id=fee_receipt_ledger.payment_id and fp.institution_id=fee_receipt_ledger.institution_id)','(select private.college_department_for_student(fi.student_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id where fp.id=fee_receipt_ledger.payment_id and fp.institution_id=fee_receipt_ledger.institution_id)',null),
('fee_receipt_sequences','fees','null::uuid','null::uuid',null),
('payment_gateway_reviews','fees','(select coalesce(fp.campus_id,fi.campus_id,s.campus_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id left join public.students s on s.id=fi.student_id and s.institution_id=fi.institution_id where fp.id=payment_gateway_reviews.payment_id and fp.institution_id=payment_gateway_reviews.institution_id)','(select private.college_department_for_student(fi.student_id) from public.fee_payments fp left join public.fee_invoices fi on fi.id=fp.invoice_id and fi.institution_id=fp.institution_id where fp.id=payment_gateway_reviews.payment_id and fp.institution_id=payment_gateway_reviews.institution_id)',null),
('scheduled_report_execution_history','reports','null::uuid','null::uuid',null),
('institution_duplicate_review_decisions','data_management','null::uuid','null::uuid',null),
('student_transport_allocations','transport','(select s.campus_id from public.students s where s.id=student_transport_allocations.student_id and s.institution_id=student_transport_allocations.institution_id)','(select private.college_department_for_student(student_transport_allocations.student_id))','public.can_view_student(student_transport_allocations.student_id)'),
('student_transport_fee_charges','transport','(select s.campus_id from public.student_transport_allocations a join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where a.id=student_transport_fee_charges.allocation_id and a.institution_id=student_transport_fee_charges.institution_id)','(select private.college_department_for_student(a.student_id) from public.student_transport_allocations a where a.id=student_transport_fee_charges.allocation_id and a.institution_id=student_transport_fee_charges.institution_id)','exists (select 1 from public.student_transport_allocations a where a.id=student_transport_fee_charges.allocation_id and a.institution_id=student_transport_fee_charges.institution_id and public.can_view_student(a.student_id))'),
('student_transport_fee_payments','transport','(select s.campus_id from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where c.id=student_transport_fee_payments.charge_id and c.institution_id=student_transport_fee_payments.institution_id)','(select private.college_department_for_student(a.student_id) from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id where c.id=student_transport_fee_payments.charge_id and c.institution_id=student_transport_fee_payments.institution_id)','exists (select 1 from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id where c.id=student_transport_fee_payments.charge_id and c.institution_id=student_transport_fee_payments.institution_id and public.can_view_student(a.student_id))'),
('transport_attendance_events','transport','(select s.campus_id from public.student_transport_allocations a join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where a.id=transport_attendance_events.allocation_id and a.institution_id=transport_attendance_events.institution_id)','(select private.college_department_for_student(a.student_id) from public.student_transport_allocations a where a.id=transport_attendance_events.allocation_id and a.institution_id=transport_attendance_events.institution_id)',null),
('institution_messages','communications','null::uuid','null::uuid','sender_user_id=(select auth.uid()) or recipient_user_id=(select auth.uid())')) AS t(table_name,module_key,campus_expression,department_expression,select_extra)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=r.table_name) THEN
      RAISE EXCEPTION 'Expected operations table public.% is missing',r.table_name;
    END IF;

    v_policy := 'college_ops_' || r.table_name || '_select';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname=v_policy) THEN
      v_extra := coalesce(r.select_extra,'false');
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_institution_permission(institution_id,%L,''view'',%s,%s) OR (%s))',
        v_policy,r.table_name,r.module_key,r.campus_expression,r.department_expression,v_extra
      );
    END IF;

    v_policy := 'college_ops_' || r.table_name || '_insert';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname=v_policy) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_institution_permission(institution_id,%L,''create'',%s,%s))',
        v_policy,r.table_name,r.module_key,r.campus_expression,r.department_expression
      );
    END IF;

    v_policy := 'college_ops_' || r.table_name || '_update';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname=v_policy) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_institution_permission(institution_id,%L,''edit'',%s,%s)) WITH CHECK (private.has_institution_permission(institution_id,%L,''edit'',%s,%s))',
        v_policy,r.table_name,r.module_key,r.campus_expression,r.department_expression,r.module_key,r.campus_expression,r.department_expression
      );
    END IF;

    v_policy := 'college_ops_' || r.table_name || '_delete';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname=v_policy) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_institution_permission(institution_id,%L,''delete'',%s,%s))',
        v_policy,r.table_name,r.module_key,r.campus_expression,r.department_expression
      );
    END IF;
  END LOOP;
END
$policies$;
