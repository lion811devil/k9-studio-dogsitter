-- Release 12.2.1 — Correzione Registro attività e affidabilità notifiche
-- Eseguire una sola volta nel SQL Editor di Supabase.

begin;

alter table public.app_notifications add column if not exists event_key text;
create unique index if not exists app_notifications_recipient_event_uidx
  on public.app_notifications(recipient_id,event_key)
  where event_key is not null;
create index if not exists app_notifications_recipient_idx
  on public.app_notifications(recipient_id,read_at,created_at desc);

alter table public.app_notifications enable row level security;
drop policy if exists app_notifications_select on public.app_notifications;
create policy app_notifications_select on public.app_notifications
  for select to authenticated using(recipient_id=auth.uid());
grant select on public.app_notifications to authenticated;

-- Ripristina le notifiche per ogni comunicazione interna.
create or replace function public.create_communication_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare r record; emp uuid; actor_name text;
begin
  if new.status <> 'sent' then return new; end if;
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=new.author_id;
  if new.author_role='dipendente' then
    for r in select id from public.profiles where active=true and role in ('owner','vice_admin') loop
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message,event_key)
      values(r.id,new.author_id,new.service_id,new.id,'Nuova comunicazione dal dipendente',actor_name||': '||left(new.message,220),'communication:'||new.id::text||':'||r.id::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
    end loop;
  else
    select employee_id into emp from public.dogsitter_services where id=new.service_id;
    if emp is not null then
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message,event_key)
      values(emp,new.author_id,new.service_id,new.id,'Nuova comunicazione interna',actor_name||': '||left(new.message,220),'communication:'||new.id::text||':'||emp::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists service_communications_notify on public.service_communications;
create trigger service_communications_notify
after insert on public.service_communications
for each row execute function public.create_communication_notifications();

-- Tutti gli amministratori ricevono l'avviso di avvio periodo, incluso chi esegue l'azione.
create or replace function public.start_service_period(p_service_id uuid,p_period_index integer) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if not (public.current_role() in ('owner','vice_admin') or (public.current_role()='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  perform public.sync_service_period_workflows(p_service_id);
  update public.service_period_workflows
  set status='in_corso',started_at=coalesce(started_at,now()),started_by=coalesce(started_by,auth.uid()),updated_at=now()
  where service_id=p_service_id and period_index=p_period_index and status='programmato'
  returning * into w;
  if not found then raise exception 'Il periodo non è disponibile per l’avvio'; end if;
  update public.dogsitter_services set status='in_corso' where id=p_service_id and status not in ('chiuso','annullato');
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=auth.uid();
  insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
  select p.id,auth.uid(),p_service_id,'Periodo iniziato',actor_name||' ha iniziato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')',
         'period-start:'||w.id::text||':'||p.id::text
  from public.profiles p where p.active=true and p.role in ('owner','vice_admin')
  on conflict(recipient_id,event_key) where event_key is not null do nothing;
  return w;
end$$;

-- Tutti gli amministratori ricevono l'avviso di fine periodo, incluso chi esegue l'azione.
create or replace function public.end_service_period(p_service_id uuid,p_period_index integer,p_report_text text default null,p_incident_notes text default null) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text; remaining integer;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if not (public.current_role() in ('owner','vice_admin') or (public.current_role()='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  update public.service_period_workflows
  set status='da_verificare',ended_at=now(),ended_by=auth.uid(),report_text=nullif(trim(p_report_text),''),incident_notes=nullif(trim(p_incident_notes),''),updated_at=now()
  where service_id=p_service_id and period_index=p_period_index and status='in_corso'
  returning * into w;
  if not found then raise exception 'Il periodo non risulta in corso'; end if;
  select count(*) into remaining from public.service_period_workflows where service_id=p_service_id and status not in ('da_verificare','chiuso','annullato');
  update public.dogsitter_services
  set status=case when remaining=0 then 'da_verificare' else 'in_corso' end,
      report_text=case when remaining=0 then coalesce(nullif(trim(p_report_text),''),report_text) else report_text end,
      incident_notes=case when remaining=0 then coalesce(nullif(trim(p_incident_notes),''),incident_notes) else incident_notes end
  where id=p_service_id;
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=auth.uid();
  insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
  select p.id,auth.uid(),p_service_id,'Periodo terminato',actor_name||' ha terminato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')',
         'period-end:'||w.id::text||':'||p.id::text
  from public.profiles p where p.active=true and p.role in ('owner','vice_admin')
  on conflict(recipient_id,event_key) where event_key is not null do nothing;
  return w;
end$$;

-- Notifica economica visibile a tutti gli amministratori, incluso chi registra l'acconto.
create or replace function public.k9_sync_quote_financials_internal(p_quote_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  q public.dogsitter_quotes%rowtype;
  service_id uuid;
  previous_data jsonb;
  current_data jsonb;
  customer_label text;
begin
  select * into q from public.dogsitter_quotes where id=p_quote_id and deleted_at is null;
  if not found then raise exception 'Preventivo non trovato'; end if;

  service_id:=q.converted_service_id;
  if service_id is null then
    select id into service_id from public.dogsitter_services where quote_id=q.id and deleted_at is null limit 1;
  end if;
  if service_id is null then return null; end if;

  select jsonb_build_object(
    'customer_amount',customer_amount,
    'deposit_amount',coalesce(deposit_amount,0),
    'deposit_received_at',deposit_received_at,
    'deposit_payment_method',deposit_payment_method,
    'deposit_reference',deposit_reference,
    'balance_due',coalesce(balance_due,customer_amount),
    'quote_payment_status',quote_payment_status,
    'customer_payment_status',customer_payment_status,
    'payment_method',payment_method
  ) into previous_data
  from public.dogsitter_services where id=service_id;

  update public.dogsitter_services
  set quote_id=q.id,
      customer_amount=coalesce(q.total_amount,0),
      payment_method=coalesce(q.payment_terms,payment_method),
      deposit_amount=coalesce(q.deposit_amount,0),
      deposit_received_at=q.deposit_received_at,
      deposit_payment_method=q.deposit_payment_method,
      deposit_reference=q.deposit_reference,
      balance_due=coalesce(q.balance_due,greatest(0,coalesce(q.total_amount,0)-coalesce(q.deposit_amount,0))),
      quote_payment_status=q.payment_status,
      customer_payment_status=case when coalesce(q.balance_due,greatest(0,coalesce(q.total_amount,0)-coalesce(q.deposit_amount,0)))<=0 then 'incassato' else 'da_incassare' end
  where id=service_id and deleted_at is null;
  if not found then return null; end if;

  update public.dogsitter_quotes set converted_service_id=service_id where id=q.id and converted_service_id is distinct from service_id;

  select jsonb_build_object(
    'customer_amount',customer_amount,
    'deposit_amount',coalesce(deposit_amount,0),
    'deposit_received_at',deposit_received_at,
    'deposit_payment_method',deposit_payment_method,
    'deposit_reference',deposit_reference,
    'balance_due',coalesce(balance_due,customer_amount),
    'quote_payment_status',quote_payment_status,
    'customer_payment_status',customer_payment_status,
    'payment_method',payment_method
  ) into current_data
  from public.dogsitter_services where id=service_id;

  if previous_data is distinct from current_data and auth.uid() is not null then
    perform public.k9_write_financial_audit(q.id,service_id,previous_data,current_data);
    select trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) into customer_label from public.customers c where c.id=q.customer_id;
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    select p.id,auth.uid(),service_id,
           'Pagamento preventivo aggiornato',
           coalesce(nullif(customer_label,''),'Cliente')||' · Acconto '||to_char(coalesce(q.deposit_amount,0),'FM999999990D00')||' € · Residuo '||to_char(coalesce(q.balance_due,greatest(0,coalesce(q.total_amount,0)-coalesce(q.deposit_amount,0))),'FM999999990D00')||' €',
           'quote-financial:'||q.id::text||':'||txid_current()::text||':'||p.id::text
    from public.profiles p where p.active=true and p.role in ('owner','vice_admin')
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;
  return service_id;
end$$;

-- Test manuale dalla schermata Notifiche.
create or replace function public.create_test_app_notification() returns uuid
language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessione non valida'; end if;
  insert into public.app_notifications(recipient_id,actor_id,title,message,event_key)
  values(auth.uid(),auth.uid(),'Notifica di prova','Il sistema di notifiche interne è attivo.','manual-test:'||auth.uid()::text||':'||clock_timestamp()::text)
  returning id into new_id;
  return new_id;
end$$;

revoke all on function public.create_test_app_notification() from public;
grant execute on function public.create_test_app_notification() to authenticated;
revoke all on function public.start_service_period(uuid,integer) from public;
revoke all on function public.end_service_period(uuid,integer,text,text) from public;
grant execute on function public.start_service_period(uuid,integer) to authenticated;
grant execute on function public.end_service_period(uuid,integer,text,text) to authenticated;

-- Una notifica iniziale conferma che la migrazione è stata installata.
insert into public.app_notifications(recipient_id,title,message,event_key)
select p.id,'Sistema notifiche attivo','Le notifiche interne sono state verificate e risultano disponibili.','notification-system-12.2.1:'||p.id::text
from public.profiles p where p.active=true
on conflict(recipient_id,event_key) where event_key is not null do nothing;

notify pgrst,'reload schema';
commit;
