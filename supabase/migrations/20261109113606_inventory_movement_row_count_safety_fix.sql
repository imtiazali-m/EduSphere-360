create or replace function public.record_inventory_movement(
 p_institution_id uuid,p_item_record_id uuid,p_movement_type text,p_quantity numeric,
 p_unit_cost numeric default null,p_movement_date date default current_date,
 p_reference_code text default null,p_notes text default null
) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_user uuid:=auth.uid();v_opening numeric:=0;v_delta numeric:=0;v_current numeric:=0;v_new numeric:=0;
 v_movement_id uuid;v_rows integer:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if not public.has_institution_role(p_institution_id,array['owner','admin']) then raise exception 'Only the institution owner or administrator can record stock movements';end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero';end if;
 if p_movement_type not in('stock_in','stock_out','allocation','return','adjustment','write_off') then raise exception 'Unsupported stock movement type';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':'||p_item_record_id::text,0));
 select coalesce(r.quantity,0) into v_opening from public.institutional_records r
 where r.id=p_item_record_id and r.institution_id=p_institution_id and r.module_key='inventory' for update;
 get diagnostics v_rows=row_count;
 if v_rows=0 then raise exception 'The selected item does not exist in this institution inventory';end if;
 select coalesce(sum(case when movement_type in('stock_in','return','adjustment') then quantity when movement_type in('stock_out','allocation','write_off') then -quantity else 0 end),0)
 into v_delta from public.inventory_movements where institution_id=p_institution_id and item_record_id=p_item_record_id;
 v_current:=v_opening+v_delta;
 if p_movement_type in('stock_out','allocation','write_off') and p_quantity>v_current then raise exception 'Insufficient stock. Current available quantity is %',v_current;end if;
 v_new:=v_current+case when p_movement_type in('stock_in','return','adjustment') then p_quantity else -p_quantity end;
 insert into public.inventory_movements(institution_id,item_record_id,movement_type,quantity,unit_cost,movement_date,reference_code,notes,recorded_by)
 values(p_institution_id,p_item_record_id,p_movement_type,p_quantity,p_unit_cost,coalesce(p_movement_date,current_date),nullif(btrim(p_reference_code),''),nullif(btrim(p_notes),''),v_user)
 returning id into v_movement_id;
 return jsonb_build_object('movement_id',v_movement_id,'item_record_id',p_item_record_id,'movement_type',p_movement_type,'quantity',p_quantity,'previous_stock',v_current,'current_stock',v_new);
end $$;
revoke all on function public.record_inventory_movement(uuid,uuid,text,numeric,numeric,date,text,text) from public,anon;
grant execute on function public.record_inventory_movement(uuid,uuid,text,numeric,numeric,date,text,text) to authenticated;