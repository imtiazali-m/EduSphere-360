revoke all on function public.approve_facility_room_reservation(uuid,uuid) from public,anon;
grant execute on function public.approve_facility_room_reservation(uuid,uuid) to authenticated,service_role;

revoke all on function public.allocate_hostel_bed(uuid,uuid,uuid,date,date,text) from public,anon;
grant execute on function public.allocate_hostel_bed(uuid,uuid,uuid,date,date,text) to authenticated,service_role;

revoke all on function public.transfer_hostel_resident(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.transfer_hostel_resident(uuid,uuid,uuid,text) to authenticated,service_role;

revoke all on function public.record_hostel_movement(uuid,uuid,text,text) from public,anon;
grant execute on function public.record_hostel_movement(uuid,uuid,text,text) to authenticated,service_role;

revoke all on function public.submit_procurement_request(uuid,uuid) from public,anon;
grant execute on function public.submit_procurement_request(uuid,uuid) to authenticated,service_role;

revoke all on function public.review_procurement_request(uuid,uuid,text,text) from public,anon;
grant execute on function public.review_procurement_request(uuid,uuid,text,text) to authenticated,service_role;

revoke all on function public.select_supplier_quote(uuid,uuid) from public,anon;
grant execute on function public.select_supplier_quote(uuid,uuid) to authenticated,service_role;

revoke all on function public.approve_purchase_order(uuid,uuid) from public,anon;
grant execute on function public.approve_purchase_order(uuid,uuid) to authenticated,service_role;

revoke all on function public.post_goods_receipt(uuid,uuid) from public,anon;
grant execute on function public.post_goods_receipt(uuid,uuid) to authenticated,service_role;

revoke all on function public.record_cafeteria_sale(uuid,text,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.record_cafeteria_sale(uuid,text,text,text,text,text,jsonb,text) to authenticated,service_role;

revoke all on function public.set_fee_receipt_sequence(uuid,text,bigint) from public,anon;
grant execute on function public.set_fee_receipt_sequence(uuid,text,bigint) to authenticated,service_role;

revoke all on function public.issue_fee_receipt(uuid,uuid,text) from public,anon;
grant execute on function public.issue_fee_receipt(uuid,uuid,text) to authenticated,service_role;

revoke all on function public.issue_fee_receipts_bulk(uuid,uuid[],text) from public,anon;
grant execute on function public.issue_fee_receipts_bulk(uuid,uuid[],text) to authenticated,service_role;

revoke all on function public.log_scheduled_report_execution(uuid,uuid,text,text,text,integer,jsonb) from public,anon;
grant execute on function public.log_scheduled_report_execution(uuid,uuid,text,text,text,integer,jsonb) to authenticated,service_role;

revoke all on function public.record_facility_asset_lifecycle(uuid,uuid,text,date,jsonb) from public,anon;
grant execute on function public.record_facility_asset_lifecycle(uuid,uuid,text,date,jsonb) to authenticated,service_role;

revoke all on function public.record_payment_gateway_review(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.record_payment_gateway_review(uuid,uuid,text,text,text,text) to authenticated,service_role;

revoke all on function public.review_possible_duplicate(uuid,text,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.review_possible_duplicate(uuid,text,uuid,uuid,text,text,text) to authenticated,service_role;

revoke all on function public.update_institution_helpdesk_ticket(uuid,uuid,text,boolean,text) from public,anon;
grant execute on function public.update_institution_helpdesk_ticket(uuid,uuid,text,boolean,text) to authenticated,service_role;

revoke all on function public.record_hostel_fee_payment(uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.record_hostel_fee_payment(uuid,uuid,numeric,text,text) to authenticated,service_role;
