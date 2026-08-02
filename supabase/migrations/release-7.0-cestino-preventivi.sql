begin;

alter table public.dogsitter_quotes
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists converted_service_id uuid;

alter table public.dogsitter_quotes drop constraint if exists dogsitter_quotes_source_service_id_fkey;
alter table public.dogsitter_quotes add constraint dogsitter_quotes_source_service_id_fkey
  foreign key (source_service_id) references public.dogsitter_services(id) on delete set null;
alter table public.dogsitter_quotes drop constraint if exists dogsitter_quotes_converted_service_id_fkey;
alter table public.dogsitter_quotes add constraint dogsitter_quotes_converted_service_id_fkey
  foreign key (converted_service_id) references public.dogsitter_services(id) on delete set null;

create index if not exists dogsitter_quotes_deleted_at_idx
  on public.dogsitter_quotes(deleted_at);

create or replace function public.archive_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare
  v_status text;
  v_converted uuid;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  case p_table
    when 'customers' then
      update public.customers set deleted_at=now(),deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Cliente non trovato'; end if;
      update public.dogs set deleted_at=coalesce(deleted_at,now()),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
      update public.dogsitter_services set deleted_at=coalesce(deleted_at,now()),deleted_by=coalesce(deleted_by,auth.uid()) where customer_id=p_id;
    when 'dogs' then
      update public.dogs set deleted_at=now(),deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Cane non trovato'; end if;
      update public.dogsitter_services set deleted_at=coalesce(deleted_at,now()),deleted_by=coalesce(deleted_by,auth.uid()) where dog_id=p_id;
    when 'dogsitter_services' then
      update public.dogsitter_services set deleted_at=now(),deleted_by=auth.uid() where id=p_id and deleted_at is null;
      if not found then raise exception 'Servizio non trovato'; end if;
    when 'dogsitter_quotes' then
      select status,converted_service_id into v_status,v_converted
      from public.dogsitter_quotes where id=p_id and deleted_at is null;
      if not found then raise exception 'Preventivo non trovato'; end if;
      if v_converted is not null then raise exception 'Il preventivo è collegato a un servizio e non può essere eliminato'; end if;
      if v_status not in ('bozza','rifiutato','scaduto') then
        raise exception 'Puoi eliminare solo preventivi in Bozza, Rifiutati o Scaduti';
      end if;
      update public.dogsitter_quotes set deleted_at=now(),deleted_by=auth.uid() where id=p_id;
    else raise exception 'Tipo non consentito';
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
      if exists(select 1 from public.dogsitter_services s join public.customers c on c.id=s.customer_id join public.dogs d on d.id=s.dog_id where s.id=p_id and (c.deleted_at is not null or d.deleted_at is not null)) then raise exception 'Ripristina prima cliente e cane'; end if;
      update public.dogsitter_services set deleted_at=null,deleted_by=null where id=p_id;
    when 'dogsitter_quotes' then
      if exists(select 1 from public.dogsitter_quotes q join public.customers c on c.id=q.customer_id left join public.dogs d on d.id=q.dog_id where q.id=p_id and (c.deleted_at is not null or (q.dog_id is not null and d.deleted_at is not null))) then raise exception 'Ripristina prima cliente e cane'; end if;
      update public.dogsitter_quotes set deleted_at=null,deleted_by=null where id=p_id;
    else raise exception 'Tipo non consentito';
  end case;
  if not found then raise exception 'Elemento non trovato'; end if;
end$$;

create or replace function public.purge_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_owner_role() then raise exception 'Solo il titolare può eliminare definitivamente'; end if;
  case p_table
    when 'dogsitter_services' then
      delete from public.dogsitter_documents where service_id=p_id;
      delete from public.dogsitter_services where id=p_id and deleted_at is not null;
    when 'dogs' then
      delete from public.dogsitter_documents where dog_id=p_id;
      delete from public.dogsitter_services where dog_id=p_id and deleted_at is not null;
      delete from public.dogs where id=p_id and deleted_at is not null;
    when 'customers' then
      delete from public.dogsitter_documents where customer_id=p_id;
      delete from public.dogsitter_services where customer_id=p_id and deleted_at is not null;
      delete from public.dogs where customer_id=p_id and deleted_at is not null;
      delete from public.customers where id=p_id and deleted_at is not null;
    when 'dogsitter_quotes' then
      delete from public.dogsitter_quotes where id=p_id and deleted_at is not null and converted_service_id is null;
    else raise exception 'Tipo non consentito';
  end case;
  if not found then raise exception 'Elemento non trovato o non presente nel Cestino'; end if;
end$$;

create or replace function public.list_trash() returns jsonb
language sql security definer set search_path=public as $$
select case when public.is_admin_role() then coalesce(jsonb_agg(x order by x.deleted_at desc),'[]'::jsonb) else '[]'::jsonb end
from (
 select c.id,'customers'::text table_name,'Cliente'::text type_label,trim(c.first_name||' '||c.last_name) label,c.deleted_at from public.customers c where c.deleted_at is not null
 union all
 select d.id,'dogs','Cane',d.name,d.deleted_at from public.dogs d where d.deleted_at is not null
 union all
 select s.id,'dogsitter_services','Servizio',coalesce(s.service_type,'Servizio')||' · '||to_char(s.service_date,'DD/MM/YYYY'),s.deleted_at from public.dogsitter_services s where s.deleted_at is not null
 union all
 select q.id,'dogsitter_quotes','Preventivo',trim(c.first_name||' '||c.last_name)||' · '||to_char(q.quote_date,'DD/MM/YYYY'),q.deleted_at
 from public.dogsitter_quotes q join public.customers c on c.id=q.customer_id where q.deleted_at is not null
) x;
$$;

grant execute on function public.archive_entity(text,uuid) to authenticated;
grant execute on function public.restore_entity(text,uuid) to authenticated;
grant execute on function public.purge_entity(text,uuid) to authenticated;
grant execute on function public.list_trash() to authenticated;

notify pgrst, 'reload schema';
commit;
