begin;

create sequence if not exists public.k9_document_progressive_seq start 1;

create table if not exists public.dogsitter_document_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.dogsitter_services(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  dog_id uuid references public.dogs(id),
  employee_id uuid references public.profiles(id),
  document_type text not null check (document_type in ('customer','employee')),
  progressive bigint not null,
  version integer not null check (version > 0),
  is_active boolean not null default true,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'generating' check (status in ('generating','generated','inviato','archived')),
  customer_name text not null,
  dog_name text,
  employee_name text,
  service_date date not null,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  sent_channel text,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(service_id, document_type, version)
);

create index if not exists document_versions_service_idx on public.dogsitter_document_versions(service_id,document_type,version desc);
create index if not exists document_versions_customer_idx on public.dogsitter_document_versions(customer_id,created_at desc);
create index if not exists document_versions_status_idx on public.dogsitter_document_versions(status,created_at desc);

alter table public.dogsitter_document_versions enable row level security;

drop policy if exists "admins read document versions" on public.dogsitter_document_versions;
create policy "admins read document versions" on public.dogsitter_document_versions
for select to authenticated using (public.is_admin_role());

drop policy if exists "admins manage document versions" on public.dogsitter_document_versions;
create policy "admins manage document versions" on public.dogsitter_document_versions
for all to authenticated using (public.is_admin_role()) with check (public.is_admin_role());

create or replace function public.k9_safe_file_part(p_value text) returns text
language sql immutable as $$
  select trim(both '_' from regexp_replace(
    translate(coalesce(p_value,''),'àáâäãåèéêëìíîïòóôöõùúûüçñÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇÑ','aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]+','_','g'));
$$;

create or replace function public.create_document_version(p_service_id uuid,p_document_type text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  s public.dogsitter_services%rowtype;
  c public.customers%rowtype;
  d public.dogs%rowtype;
  e public.profiles%rowtype;
  v_version integer;
  v_progressive bigint;
  v_base text;
  v_file_name text;
  v_storage_path text;
  v_id uuid;
  v_row public.dogsitter_document_versions%rowtype;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  if p_document_type not in ('customer','employee') then raise exception 'Tipo documento non valido'; end if;

  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  select * into c from public.customers where id=s.customer_id;
  select * into d from public.dogs where id=s.dog_id;
  select * into e from public.profiles where id=s.employee_id;

  select coalesce(max(version),0)+1,
         coalesce(min(progressive),nextval('public.k9_document_progressive_seq'))
    into v_version,v_progressive
  from public.dogsitter_document_versions
  where service_id=p_service_id and document_type=p_document_type;

  v_base := concat_ws('_',
    public.k9_safe_file_part(c.first_name),
    public.k9_safe_file_part(c.last_name),
    nullif(public.k9_safe_file_part(d.name),''),
    to_char(s.service_date,'DD-MM-YYYY'),
    lpad(v_progressive::text,3,'0')
  );
  if p_document_type='employee' then v_file_name:=v_base||'_Interno.pdf'; else v_file_name:=v_base||'.pdf'; end if;
  v_id:=gen_random_uuid();
  v_storage_path:=concat('documenti/',extract(year from s.service_date)::int,'/',s.customer_id,'/',s.id,'/',p_document_type,'/v',v_version,'/',v_file_name);

  update public.dogsitter_document_versions
     set is_active=false
   where service_id=p_service_id and document_type=p_document_type and is_active=true;

  insert into public.dogsitter_document_versions(
    id,service_id,customer_id,dog_id,employee_id,document_type,progressive,version,is_active,
    file_name,storage_path,status,customer_name,dog_name,employee_name,service_date,generated_by
  ) values (
    v_id,s.id,s.customer_id,s.dog_id,s.employee_id,p_document_type,v_progressive,v_version,true,
    v_file_name,v_storage_path,'generating',trim(c.first_name||' '||c.last_name),d.name,e.full_name,s.service_date,auth.uid()
  ) returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object(
    'customer_amount',s.customer_amount,
    'employee_compensation',s.employee_compensation,
    'employee_payment_status',s.employee_payment_status,
    'customer_payment_status',s.customer_payment_status,
    'service_type',s.service_type,
    'service_time',s.service_time,
    'planned_duration_minutes',s.planned_duration_minutes,
    'daily_visits',s.daily_visits,
    'operational_notes',s.operational_notes,
    'report_text',s.report_text,
    'incident_notes',s.incident_notes,
    'started_at',s.started_at,
    'completed_at',s.completed_at
  );
end$$;

create or replace function public.create_document_pair(p_service_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_customer jsonb;
  v_employee jsonb;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_services set status='chiuso' where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  v_customer:=public.create_document_version(p_service_id,'customer');
  v_employee:=public.create_document_version(p_service_id,'employee');
  return jsonb_build_array(v_customer,v_employee);
end$$;

create or replace function public.finalize_document_version(p_document_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_document_versions
     set status='generated',generated_at=now()
   where id=p_document_id and status='generating';
  if not found then raise exception 'Documento non trovato o già finalizzato'; end if;
end$$;

create or replace function public.mark_document_version_sent(p_document_id uuid,p_channel text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_document_versions
     set status='inviato',sent_at=now(),sent_by=auth.uid(),sent_channel=nullif(trim(p_channel),'')
   where id=p_document_id and document_type='customer';
  if not found then raise exception 'PDF cliente non trovato'; end if;
end$$;

create or replace function public.archive_document_version(p_document_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_document_versions
     set status='archived',is_active=false,archived_at=now(),archived_by=auth.uid()
   where id=p_document_id;
  if not found then raise exception 'Documento non trovato'; end if;
end$$;

grant select on public.dogsitter_document_versions to authenticated;
grant execute on function public.create_document_version(uuid,text) to authenticated;
grant execute on function public.create_document_pair(uuid) to authenticated;
grant execute on function public.finalize_document_version(uuid) to authenticated;
grant execute on function public.mark_document_version_sent(uuid,text) to authenticated;
grant execute on function public.archive_document_version(uuid) to authenticated;

commit;
