begin;

alter table public.customers add column if not exists deleted_at timestamptz;
alter table public.customers add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogs add column if not exists deleted_at timestamptz;
alter table public.dogs add column if not exists deleted_by uuid references public.profiles(id);
alter table public.dogsitter_services add column if not exists deleted_at timestamptz;
alter table public.dogsitter_services add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists customers_deleted_at_idx on public.customers(deleted_at);
create index if not exists dogs_deleted_at_idx on public.dogs(deleted_at);
create index if not exists services_deleted_at_idx on public.dogsitter_services(deleted_at);

create or replace function public.archive_entity(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
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
) x;
$$;

create or replace function public.employee_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
 if public.current_role()<>'dipendente' then raise exception 'Permesso negato'; end if;
 select jsonb_build_object(
 'customers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'first_name',c.first_name,'last_name',c.last_name,'phone',c.phone,'address',c.address,'city',c.city,'emergency_contact',c.emergency_contact,'operational_notes',c.operational_notes,'status',c.status)) from public.customers c where c.assigned_employee_id=auth.uid() and c.status='attivo' and c.deleted_at is null),'[]'::jsonb),
 'dogs',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'customer_id',d.customer_id,'name',d.name,'breed',d.breed,'feeding_notes',d.feeding_notes,'medical_notes',d.medical_notes,'behavior_notes',d.behavior_notes,'routine_notes',d.routine_notes,'active',d.active)) from public.dogs d join public.customers c on c.id=d.customer_id where c.assigned_employee_id=auth.uid() and d.active and d.deleted_at is null and c.deleted_at is null),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'customer_id',s.customer_id,'dog_id',s.dog_id,'service_type',s.service_type,'service_date',s.service_date,'service_time',s.service_time,'planned_duration_minutes',s.planned_duration_minutes,'daily_visits',s.daily_visits,'employee_compensation',s.employee_compensation,'employee_payment_status',s.employee_payment_status,'status',s.status,'operational_notes',s.operational_notes,'report_text',s.report_text,'incident_notes',s.incident_notes,'started_at',s.started_at,'completed_at',s.completed_at)) from public.dogsitter_services s where s.employee_id=auth.uid() and s.deleted_at is null),'[]'::jsonb)
 ) into r; return r;
end$$;

grant execute on function public.archive_entity(text,uuid) to authenticated;
grant execute on function public.restore_entity(text,uuid) to authenticated;
grant execute on function public.purge_entity(text,uuid) to authenticated;
grant execute on function public.list_trash() to authenticated;

commit;
