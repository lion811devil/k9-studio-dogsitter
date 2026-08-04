begin;

create table if not exists public.service_period_workflows (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.dogsitter_services(id) on delete cascade,
  period_index integer not null check (period_index >= 0),
  start_date date not null,
  end_date date not null,
  status text not null default 'programmato' check (status in ('programmato','in_corso','da_verificare','chiuso','annullato')),
  started_at timestamptz,
  ended_at timestamptz,
  started_by uuid references public.profiles(id) on delete set null,
  ended_by uuid references public.profiles(id) on delete set null,
  report_text text,
  incident_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_id, period_index)
);
create index if not exists service_period_workflows_service_idx on public.service_period_workflows(service_id,period_index);
alter table public.service_period_workflows enable row level security;

drop policy if exists service_period_workflows_select on public.service_period_workflows;
create policy service_period_workflows_select on public.service_period_workflows for select to authenticated using (
  public.current_role() in ('owner','vice_admin') or exists (
    select 1 from public.dogsitter_services s where s.id=service_id and s.employee_id=auth.uid() and s.deleted_at is null
  )
);
grant select on public.service_period_workflows to authenticated;

create table if not exists public.service_pdf_drafts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.dogsitter_services(id) on delete cascade,
  document_type text not null check (document_type in ('customer','employee')),
  draft_data jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(service_id,document_type)
);
alter table public.service_pdf_drafts enable row level security;
drop policy if exists service_pdf_drafts_admin_all on public.service_pdf_drafts;
create policy service_pdf_drafts_admin_all on public.service_pdf_drafts for all to authenticated
  using (public.current_role() in ('owner','vice_admin'))
  with check (public.current_role() in ('owner','vice_admin'));
grant select,insert,update,delete on public.service_pdf_drafts to authenticated;

create or replace function public.sync_service_period_workflows(p_service_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.dogsitter_services%rowtype; p jsonb; idx integer:=0;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  for p in select value from jsonb_array_elements(
    case when jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array' and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>0
      then s.periods else jsonb_build_array(jsonb_build_object('start_date',s.service_date,'end_date',coalesce(s.end_date,s.service_date))) end
  ) loop
    insert into public.service_period_workflows(service_id,period_index,start_date,end_date)
    values(p_service_id,idx,(p->>'start_date')::date,coalesce(nullif(p->>'end_date',''),p->>'start_date')::date)
    on conflict(service_id,period_index) do update set start_date=excluded.start_date,end_date=excluded.end_date,updated_at=now();
    idx:=idx+1;
  end loop;
  delete from public.service_period_workflows where service_id=p_service_id and period_index>=idx and status='programmato';
end$$;

create or replace function public.sync_service_period_workflows_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.sync_service_period_workflows(new.id);
  return new;
end$$;
drop trigger if exists dogsitter_services_sync_period_workflows on public.dogsitter_services;
create trigger dogsitter_services_sync_period_workflows after insert or update of periods,service_date,end_date on public.dogsitter_services
for each row execute function public.sync_service_period_workflows_trigger();

do $$ declare r record; begin
  for r in select id from public.dogsitter_services where deleted_at is null loop
    perform public.sync_service_period_workflows(r.id);
  end loop;
end $$;

create or replace function public.start_service_period(p_service_id uuid,p_period_index integer) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if not (public.current_role() in ('owner','vice_admin') or (public.current_role()='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  perform public.sync_service_period_workflows(p_service_id);
  update public.service_period_workflows set status='in_corso',started_at=coalesce(started_at,now()),started_by=coalesce(started_by,auth.uid()),updated_at=now()
  where service_id=p_service_id and period_index=p_period_index and status='programmato' returning * into w;
  if not found then raise exception 'Il periodo non è disponibile per l’avvio'; end if;
  update public.dogsitter_services set status='in_corso' where id=p_service_id and status not in ('chiuso','annullato');
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=auth.uid();
  insert into public.app_notifications(recipient_id,actor_id,service_id,title,message)
  select p.id,auth.uid(),p_service_id,'Periodo iniziato',actor_name||' ha iniziato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')'
  from public.profiles p where p.active=true and p.role in ('owner','vice_admin') and p.id<>auth.uid();
  return w;
end$$;

create or replace function public.end_service_period(p_service_id uuid,p_period_index integer,p_report_text text default null,p_incident_notes text default null) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text; remaining integer;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if not (public.current_role() in ('owner','vice_admin') or (public.current_role()='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  update public.service_period_workflows set status='da_verificare',ended_at=now(),ended_by=auth.uid(),report_text=nullif(trim(p_report_text),''),incident_notes=nullif(trim(p_incident_notes),''),updated_at=now()
  where service_id=p_service_id and period_index=p_period_index and status='in_corso' returning * into w;
  if not found then raise exception 'Il periodo non risulta in corso'; end if;
  select count(*) into remaining from public.service_period_workflows where service_id=p_service_id and status not in ('da_verificare','chiuso','annullato');
  update public.dogsitter_services set status=case when remaining=0 then 'da_verificare' else 'in_corso' end,
    report_text=case when remaining=0 then coalesce(nullif(trim(p_report_text),''),report_text) else report_text end,
    incident_notes=case when remaining=0 then coalesce(nullif(trim(p_incident_notes),''),incident_notes) else incident_notes end
  where id=p_service_id;
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=auth.uid();
  insert into public.app_notifications(recipient_id,actor_id,service_id,title,message)
  select p.id,auth.uid(),p_service_id,'Periodo terminato',actor_name||' ha terminato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')'
  from public.profiles p where p.active=true and p.role in ('owner','vice_admin') and p.id<>auth.uid();
  return w;
end$$;

revoke all on function public.sync_service_period_workflows(uuid) from public;
revoke all on function public.start_service_period(uuid,integer) from public;
revoke all on function public.end_service_period(uuid,integer,text,text) from public;
grant execute on function public.start_service_period(uuid,integer) to authenticated;
grant execute on function public.end_service_period(uuid,integer,text,text) to authenticated;


alter table public.app_notifications add column if not exists event_key text;
create unique index if not exists app_notifications_recipient_event_uidx on public.app_notifications(recipient_id,event_key) where event_key is not null;

create or replace function public.refresh_operational_reminders() returns integer
language plpgsql security definer set search_path=public as $$
declare created_count integer:=0; r record; actor_role text;
begin
  actor_role:=public.current_role();
  if actor_role='dipendente' then
    for r in select s.id,s.service_type,d.name dog_name from public.dogsitter_services s left join public.dogs d on d.id=s.dog_id
      where s.employee_id=auth.uid() and s.deleted_at is null and s.status in ('programmato','in_corso')
      and exists(select 1 from jsonb_array_elements(coalesce(s.periods,'[]'::jsonb)) p where (p->>'start_date')::date=current_date+1)
    loop
      insert into public.app_notifications(recipient_id,service_id,title,message,event_key)
      values(auth.uid(),r.id,'Servizio in programma domani',coalesce(r.dog_name,'Cane')||' · '||coalesce(r.service_type,'Servizio'),'tomorrow-service:'||r.id||':'||(current_date+1)::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
      if found then created_count:=created_count+1; end if;
    end loop;
  elsif actor_role in ('owner','vice_admin') then
    for r in select s.id,s.service_type,d.name dog_name from public.dogsitter_services s left join public.dogs d on d.id=s.dog_id
      where s.deleted_at is null and s.status='da_verificare'
    loop
      insert into public.app_notifications(recipient_id,service_id,title,message,event_key)
      values(auth.uid(),r.id,'Servizio da verificare',coalesce(r.dog_name,'Cane')||' · '||coalesce(r.service_type,'Servizio'),'verify-service:'||r.id)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
      if found then created_count:=created_count+1; end if;
    end loop;
    for r in select q.id,q.valid_until,c.first_name,c.last_name from public.dogsitter_quotes q join public.customers c on c.id=q.customer_id
      where q.deleted_at is null and q.status in ('bozza','inviato') and q.valid_until<=current_date+2
    loop
      insert into public.app_notifications(recipient_id,title,message,event_key)
      values(auth.uid(),'Preventivo in scadenza',coalesce(r.first_name||' '||r.last_name,'Cliente')||' · scadenza '||to_char(r.valid_until,'DD/MM/YYYY'),'quote-expiry:'||r.id||':'||r.valid_until::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
      if found then created_count:=created_count+1; end if;
    end loop;
  end if;
  return created_count;
end$$;
revoke all on function public.refresh_operational_reminders() from public;
grant execute on function public.refresh_operational_reminders() to authenticated;

notify pgrst,'reload schema';
commit;
