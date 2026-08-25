begin;

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogsitter_quotes add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogsitter_document_versions add column if not exists deleted_at timestamptz;
alter table public.dogsitter_document_versions add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogsitter_quote_document_versions add column if not exists deleted_at timestamptz;
alter table public.dogsitter_quote_document_versions add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogsitter_receipts add column if not exists deleted_at timestamptz;
alter table public.dogsitter_receipts add column if not exists deleted_by uuid references public.profiles(id);
alter table public.app_notifications add column if not exists deleted_at timestamptz;
alter table public.app_notifications add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists profiles_deleted_at_idx on public.profiles(deleted_at);
create index if not exists quotes_deleted_at_idx on public.dogsitter_quotes(deleted_at);
create index if not exists document_versions_deleted_at_idx on public.dogsitter_document_versions(deleted_at);
create index if not exists quote_document_versions_deleted_at_idx on public.dogsitter_quote_document_versions(deleted_at);
create index if not exists receipts_deleted_at_idx on public.dogsitter_receipts(deleted_at);
create index if not exists notifications_deleted_at_idx on public.app_notifications(deleted_at);

create or replace function public.archive_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_now timestamptz:=now(); v_linked_service uuid;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  case p_table
    when 'customers' then
      update public.customers set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Cliente non trovato'; end if;
      update public.dogs set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_services set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_quotes set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_quote_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_receipts set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
    when 'dogs' then
      update public.dogs set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Animale non trovato'; end if;
      update public.dogsitter_services set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
      update public.dogsitter_quotes set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
      update public.dogsitter_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
      update public.dogsitter_quote_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
      update public.dogsitter_receipts set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
    when 'dogsitter_services' then
      update public.dogsitter_services set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Servizio non trovato'; end if;
      update public.dogsitter_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where service_id=p_id;
      update public.dogsitter_receipts set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where service_id=p_id;
    when 'dogsitter_quotes' then
      select converted_service_id into v_linked_service from public.dogsitter_quotes where id=p_id;
      if v_linked_service is not null and exists(select 1 from public.dogsitter_services where id=v_linked_service and deleted_at is null) then
        raise exception 'Il preventivo è collegato a un servizio attivo. Sposta prima il servizio nel Cestino.';
      end if;
      update public.dogsitter_quotes set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Preventivo non trovato'; end if;
      update public.dogsitter_quote_document_versions set deleted_at=coalesce(deleted_at,v_now),deleted_by=coalesce(deleted_by,auth.uid()) where quote_id=p_id;
    when 'profiles' then
      if exists(select 1 from public.profiles where id=p_id and (role='owner' or coalesce(is_owner,false)=true)) then raise exception 'Il Titolare è protetto'; end if;
      if exists(select 1 from public.dogsitter_services where employee_id=p_id and deleted_at is null and status not in ('chiuso','annullato')) then raise exception 'Riassegna prima i servizi operativi del dipendente'; end if;
      update public.profiles set deleted_at=v_now,deleted_by=auth.uid(),active=false where id=p_id and deleted_at is null;
      if not found then raise exception 'Account non trovato'; end if;
    when 'dogsitter_document_versions' then
      update public.dogsitter_document_versions set deleted_at=v_now,deleted_by=auth.uid(),is_active=false where id=p_id and deleted_at is null;
      if not found then raise exception 'Documento non trovato'; end if;
    when 'dogsitter_quote_document_versions' then
      update public.dogsitter_quote_document_versions set deleted_at=v_now,deleted_by=auth.uid(),is_active=false where id=p_id and deleted_at is null;
      if not found then raise exception 'PDF preventivo non trovato'; end if;
    when 'dogsitter_receipts' then
      update public.dogsitter_receipts set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Ricevuta non trovata'; end if;
    when 'app_notifications' then
      update public.app_notifications set deleted_at=v_now,deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Notifica non trovata'; end if;
    else raise exception 'Tipo non consentito nel Cestino';
  end case;
end$$;

create or replace function public.restore_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  case p_table
    when 'customers' then update public.customers set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogs' then
      if exists(select 1 from public.dogs d join public.customers c on c.id=d.customer_id where d.id=p_id and c.deleted_at is not null) then raise exception 'Ripristina prima il cliente'; end if;
      update public.dogs set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogsitter_services' then
      if exists(select 1 from public.dogsitter_services s join public.customers c on c.id=s.customer_id left join public.dogs d on d.id=s.dog_id where s.id=p_id and (c.deleted_at is not null or (d.id is not null and d.deleted_at is not null))) then raise exception 'Ripristina prima cliente e animale'; end if;
      update public.dogsitter_services set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogsitter_quotes' then
      if exists(select 1 from public.dogsitter_quotes q join public.customers c on c.id=q.customer_id left join public.dogs d on d.id=q.dog_id where q.id=p_id and (c.deleted_at is not null or (d.id is not null and d.deleted_at is not null))) then raise exception 'Ripristina prima cliente e animale'; end if;
      update public.dogsitter_quotes set deleted_at=null,deleted_by=null where id=p_id;
    when 'profiles' then update public.profiles set deleted_at=null,deleted_by=null,active=true where id=p_id;
    when 'dogsitter_document_versions' then update public.dogsitter_document_versions set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogsitter_quote_document_versions' then update public.dogsitter_quote_document_versions set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogsitter_receipts' then update public.dogsitter_receipts set deleted_at=null,deleted_by=null where id=p_id;
    when 'app_notifications' then update public.app_notifications set deleted_at=null,deleted_by=null where id=p_id;
    else raise exception 'Tipo non consentito';
  end case;
  if not found then raise exception 'Elemento non trovato'; end if;
end$$;

create or replace function public.purge_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_owner_role() then raise exception 'Solo il titolare può eliminare definitivamente'; end if;
  case p_table
    when 'dogsitter_document_versions' then delete from public.dogsitter_document_versions where id=p_id and deleted_at is not null;
    when 'dogsitter_quote_document_versions' then delete from public.dogsitter_quote_document_versions where id=p_id and deleted_at is not null;
    when 'dogsitter_receipts' then delete from public.dogsitter_receipts where id=p_id and deleted_at is not null;
    when 'app_notifications' then delete from public.app_notifications where id=p_id and deleted_at is not null;
    when 'dogsitter_quotes' then
      delete from public.dogsitter_quote_document_versions where quote_id=p_id and deleted_at is not null;
      update public.dogsitter_services set quote_id=null where quote_id=p_id and deleted_at is not null;
      delete from public.dogsitter_quotes where id=p_id and deleted_at is not null;
    when 'dogsitter_services' then
      delete from public.service_communication_reads where message_id in (select id from public.service_communications where service_id=p_id);
      delete from public.service_communications where service_id=p_id;
      delete from public.service_period_workflows where service_id=p_id;
      delete from public.service_pdf_drafts where service_id=p_id;
      delete from public.dogsitter_document_versions where service_id=p_id and deleted_at is not null;
      delete from public.dogsitter_receipts where service_id=p_id and deleted_at is not null;
      update public.dogsitter_quotes set converted_service_id=null where converted_service_id=p_id;
      delete from public.dogsitter_services where id=p_id and deleted_at is not null;
    when 'dogs' then
      delete from public.dogsitter_quote_document_versions where dog_id=p_id and deleted_at is not null;
      delete from public.dogsitter_document_versions where dog_id=p_id and deleted_at is not null;
      delete from public.dogsitter_receipts where dog_id=p_id and deleted_at is not null;
      delete from public.dogsitter_quotes where dog_id=p_id and deleted_at is not null;
      delete from public.dogsitter_services where dog_id=p_id and deleted_at is not null;
      delete from public.dogs where id=p_id and deleted_at is not null;
    when 'customers' then
      delete from public.dogsitter_quote_document_versions where customer_id=p_id and deleted_at is not null;
      delete from public.dogsitter_document_versions where customer_id=p_id and deleted_at is not null;
      delete from public.dogsitter_receipts where customer_id=p_id and deleted_at is not null;
      delete from public.dogsitter_quotes where customer_id=p_id and deleted_at is not null;
      delete from public.dogsitter_services where customer_id=p_id and deleted_at is not null;
      delete from public.dogs where customer_id=p_id and deleted_at is not null;
      delete from public.customers where id=p_id and deleted_at is not null;
    when 'profiles' then raise exception 'Account gestito tramite Auth';
    else raise exception 'Tipo non consentito';
  end case;
end$$;

create or replace function public.list_trash() returns jsonb
language sql security definer set search_path=public as $$
select case when public.is_admin_role() then coalesce(jsonb_agg(x order by x.deleted_at desc),'[]'::jsonb) else '[]'::jsonb end
from (
 select c.id,'customers'::text table_name,'Cliente'::text type_label,trim(c.first_name||' '||c.last_name) label,c.deleted_at,c.id customer_id,null::uuid dog_id,null::uuid service_id,null::uuid quote_id,null::text storage_path from public.customers c where c.deleted_at is not null
 union all select d.id,'dogs','Animale',d.name,d.deleted_at,d.customer_id,d.id,null::uuid,null::uuid,null::text from public.dogs d where d.deleted_at is not null
 union all select s.id,'dogsitter_services','Servizio',coalesce(s.service_type,'Servizio')||' · '||to_char(s.service_date,'DD/MM/YYYY'),s.deleted_at,s.customer_id,s.dog_id,s.id,s.quote_id,null::text from public.dogsitter_services s where s.deleted_at is not null
 union all select q.id,'dogsitter_quotes','Preventivo','Preventivo · '||to_char(q.quote_date,'DD/MM/YYYY'),q.deleted_at,q.customer_id,q.dog_id,q.converted_service_id,q.id,null::text from public.dogsitter_quotes q where q.deleted_at is not null
 union all select p.id,'profiles',case when p.role='vice_admin' then 'Vice amministratore' else 'Dipendente' end,coalesce(p.full_name,p.email,'Account'),p.deleted_at,null::uuid,null::uuid,null::uuid,null::uuid,null::text from public.profiles p where p.deleted_at is not null
 union all select d.id,'dogsitter_document_versions',case d.document_type when 'customer' then 'Documento cliente' when 'employee' then 'Documento dipendente' when 'internal' then 'Documento interno' else 'Documento' end,d.file_name,d.deleted_at,d.customer_id,d.dog_id,d.service_id,null::uuid,d.storage_path from public.dogsitter_document_versions d where d.deleted_at is not null
 union all select d.id,'dogsitter_quote_document_versions','PDF preventivo',d.file_name,d.deleted_at,d.customer_id,d.dog_id,null::uuid,d.quote_id,d.storage_path from public.dogsitter_quote_document_versions d where d.deleted_at is not null
 union all select r.id,'dogsitter_receipts','Ricevuta',r.file_name,r.deleted_at,r.customer_id,r.dog_id,r.service_id,r.quote_id,r.storage_path from public.dogsitter_receipts r where r.deleted_at is not null
 union all select n.id,'app_notifications','Notifica',coalesce(n.title,'Notifica'),n.deleted_at,null::uuid,null::uuid,n.service_id,null::uuid,null::text from public.app_notifications n where n.deleted_at is not null
) x;
$$;

revoke all on function public.archive_entity(text,uuid) from public, anon, authenticated;
revoke all on function public.restore_entity(text,uuid) from public, anon, authenticated;
revoke all on function public.purge_entity(text,uuid) from public, anon, authenticated;
revoke all on function public.list_trash() from public, anon, authenticated;
grant execute on function public.archive_entity(text,uuid) to authenticated;
grant execute on function public.restore_entity(text,uuid) to authenticated;
grant execute on function public.purge_entity(text,uuid) to authenticated;
grant execute on function public.list_trash() to authenticated;
notify pgrst, 'reload schema';
commit;
