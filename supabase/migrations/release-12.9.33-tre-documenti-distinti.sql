-- Release 12.9.33
-- Separa definitivamente Documento cliente, Documento dipendente e Documento interno.

begin;

alter table public.dogsitter_document_versions
  drop constraint if exists dogsitter_document_versions_document_type_check;

alter table public.dogsitter_document_versions
  add constraint dogsitter_document_versions_document_type_check
  check (document_type in ('customer','employee','internal'));

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
  if p_document_type not in ('customer','employee','internal') then raise exception 'Tipo documento non valido'; end if;

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

  v_base:=concat_ws('_',
    public.k9_safe_file_part(c.first_name),
    public.k9_safe_file_part(c.last_name),
    nullif(public.k9_safe_file_part(d.name),''),
    to_char(s.service_date,'DD-MM-YYYY'),
    lpad(v_progressive::text,3,'0')
  );

  v_file_name:=case p_document_type
    when 'customer' then v_base||'_Cliente.pdf'
    when 'employee' then v_base||'_Dipendente.pdf'
    when 'internal' then v_base||'_Interno.pdf'
  end;

  v_id:=gen_random_uuid();
  v_storage_path:=concat(
    'documenti/',extract(year from s.service_date)::int,'/',
    s.customer_id,'/',s.id,'/',p_document_type,'/v',v_version,'/',v_file_name
  );

  insert into public.dogsitter_document_versions(
    id,service_id,customer_id,dog_id,employee_id,document_type,
    progressive,version,is_active,file_name,storage_path,status,
    customer_name,dog_name,employee_name,service_date,generated_by
  )
  values(
    v_id,s.id,s.customer_id,s.dog_id,s.employee_id,p_document_type,
    v_progressive,v_version,false,v_file_name,v_storage_path,'generating',
    trim(c.first_name||' '||c.last_name),d.name,e.full_name,s.service_date,auth.uid()
  )
  returning * into v_row;

  return to_jsonb(v_row)||jsonb_build_object(
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

revoke all on function public.create_document_version(uuid,text) from public;
grant execute on function public.create_document_version(uuid,text) to authenticated;

commit;
