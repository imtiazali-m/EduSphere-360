-- Paper approval is a guarded transaction that validates published questions and marks totals.
begin;

create policy assessment_paper_items_delete on public.assessment_paper_items
for delete to authenticated
using (
 exists(
  select 1 from public.assessment_papers p
  where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id
    and p.status='draft'
    and (
      public.has_institution_role(p.institution_id,array['owner','admin','exam_officer']::text[])
      or (public.has_institution_role(p.institution_id,array['teacher']::text[]) and p.created_by=(select auth.uid()))
    )
 )
);

create or replace function public.approve_assessment_paper(p_institution_id uuid,p_paper_id uuid)
returns public.assessment_papers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_paper public.assessment_papers;
  v_count integer;
  v_unpublished integer;
  v_total numeric(10,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','exam_officer']::text[]) then
    raise exception 'Only an institution owner, administrator or examination officer can approve a question paper.';
  end if;

  select * into v_paper
    from public.assessment_papers
   where id=p_paper_id and institution_id=p_institution_id
   for update;
  if not found then raise exception 'Question paper not found.'; end if;
  if v_paper.status not in ('draft','review') then
    raise exception 'Only a draft or reviewed question paper can be approved.';
  end if;

  select count(*),
         count(*) filter(where q.status<>'published'),
         coalesce(sum(coalesce(pi.marks_override,q.marks)),0)
    into v_count,v_unpublished,v_total
    from public.assessment_paper_items pi
    join public.question_bank_items q
      on q.id=pi.question_id and q.institution_id=pi.institution_id
   where pi.institution_id=p_institution_id and pi.paper_id=p_paper_id;

  if v_count=0 then raise exception 'Add at least one question before approving the paper.'; end if;
  if v_unpublished>0 then raise exception 'Every question in an approved paper must be published in the question bank.'; end if;
  if round(v_total,2)<>round(v_paper.maximum_marks,2) then
    raise exception 'Selected questions total % marks, but the paper maximum is %.',v_total,v_paper.maximum_marks;
  end if;

  update public.assessment_papers
     set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
   where id=p_paper_id and institution_id=p_institution_id
   returning * into v_paper;
  return v_paper;
end;
$function$;
revoke all on function public.approve_assessment_paper(uuid,uuid) from public,anon;
grant execute on function public.approve_assessment_paper(uuid,uuid) to authenticated;

commit;
