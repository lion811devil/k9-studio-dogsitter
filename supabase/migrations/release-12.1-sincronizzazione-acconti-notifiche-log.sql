-- Release 12.1 — Sincronizzazione economica Preventivo ↔ Servizio
-- Eseguire una sola volta nel SQL Editor di Supabase.

begin;

alter table public.dogsitter_services
  add column if not exists quote_id uuid,
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists deposit_received_at date,
  add column if not exists deposit_payment_method text,
  add column if not exists deposit_reference text,
  add column if not exists balance_due numeric(12,2) not null default 0,
  add column if not exists quote_payment_status text;

-- Collega il servizio al preventivo senza eliminare il preventivo stesso.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='dogsitter_services_quote_id_fkey'
      and conrelid='public.dogsitter_services'::regclass
  ) then
    alter table public.dogsitter_services
      add constraint dogsitter_services_quote_id_fkey
      foreign key (quote_id) references public.dogsitter_quotes(id) on delete set null;
  end if;
end $$;

create unique index if not exists dogsitter_services_quote_id_uidx
  on public.dogsitter_services(quote_id)
  where quote_id is not null;

-- Recupera i collegamenti creati nelle release precedenti.
update public.dogsitter_services s
set quote_id=q.id
from public.dogsitter_quotes q
where q.converted_service_id=s.id
  and s.quote_id is null;

create or replace function public.k9_write_financial_audit(
  p_quote_id uuid,
  p_service_id uuid,
  p_old jsonb,
  p_new jsonb
) returns void
language plpgsql security definer set search_path=public as $$
begin
  -- Il Registro attività già esistente usa queste colonne.
  -- Il blocco exception evita che un'installazione storica diversa interrompa la sincronizzazione.
  begin
    insert into public.audit_log(user_id,table_name,action,details,created_at)
    values(
      auth.uid(),
      'dogsitter_quotes',
      'PAYMENT_SYNC',
      jsonb_build_object(
        'quote_id',p_quote_id,
        'service_id',p_service_id,
        'old',coalesce(p_old,'{}'::jsonb),
        'new',coalesce(p_new,'{}'::jsonb)
      ),
      now()
    );
  exception
    when undefined_table or undefined_column then null;
  end;
end $$;

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
  select * into q
  from public.dogsitter_quotes
  where id=p_quote_id and deleted_at is null;

  if not found then
    raise exception 'Preventivo non trovato';
  end if;

  service_id:=q.converted_service_id;
  if service_id is null then
    select id into service_id
    from public.dogsitter_services
    where quote_id=q.id and deleted_at is null
    limit 1;
  end if;

  if service_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'customer_amount',customer_amount,
    'deposit_amount',coalesce(deposit_amount,0),
    'balance_due',coalesce(balance_due,customer_amount),
    'customer_payment_status',customer_payment_status,
    'payment_method',payment_method
  ) into previous_data
  from public.dogsitter_services
  where id=service_id;

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
      customer_payment_status=case
        when coalesce(q.balance_due,greatest(0,coalesce(q.total_amount,0)-coalesce(q.deposit_amount,0)))<=0 then 'incassato'
        else 'da_incassare'
      end
  where id=service_id and deleted_at is null;

  if not found then
    return null;
  end if;

  update public.dogsitter_quotes
  set converted_service_id=service_id
  where id=q.id and converted_service_id is distinct from service_id;

  select jsonb_build_object(
    'customer_amount',customer_amount,
    'deposit_amount',coalesce(deposit_amount,0),
    'balance_due',coalesce(balance_due,customer_amount),
    'customer_payment_status',customer_payment_status,
    'payment_method',payment_method
  ) into current_data
  from public.dogsitter_services
  where id=service_id;

  if previous_data is distinct from current_data and auth.uid() is not null then
    perform public.k9_write_financial_audit(q.id,service_id,previous_data,current_data);
  end if;

  select trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))
  into customer_label
  from public.customers c where c.id=q.customer_id;

  if previous_data is distinct from current_data and auth.uid() is not null then
  insert into public.app_notifications(
    recipient_id,actor_id,service_id,title,message,event_key
  )
  select p.id,auth.uid(),service_id,
         'Pagamento preventivo aggiornato',
         coalesce(nullif(customer_label,''),'Cliente')||
         ' · Acconto '||to_char(coalesce(q.deposit_amount,0),'FM999999990D00')||
         ' € · Residuo '||to_char(coalesce(q.balance_due,greatest(0,coalesce(q.total_amount,0)-coalesce(q.deposit_amount,0))),'FM999999990D00')||' €',
         'quote-financial:'||q.id::text||':'||txid_current()::text||':'||p.id::text
  from public.profiles p
  where p.active=true
    and p.role in ('owner','vice_admin')
    and p.id is distinct from auth.uid()
  on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;

  return service_id;
end $$;

create or replace function public.sync_quote_financials(p_quote_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
begin
  if public.current_role() not in ('owner','vice_admin') then
    raise exception 'Permesso negato';
  end if;
  return public.k9_sync_quote_financials_internal(p_quote_id);
end $$;

create or replace function public.k9_quote_financial_sync_trigger()
returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.converted_service_id is not null and (
    old.total_amount is distinct from new.total_amount or
    old.payment_terms is distinct from new.payment_terms or
    old.payment_status is distinct from new.payment_status or
    old.deposit_amount is distinct from new.deposit_amount or
    old.deposit_received_at is distinct from new.deposit_received_at or
    old.deposit_payment_method is distinct from new.deposit_payment_method or
    old.deposit_reference is distinct from new.deposit_reference or
    old.balance_due is distinct from new.balance_due
  ) then
    perform public.k9_sync_quote_financials_internal(new.id);
  end if;
  return new;
end $$;

drop trigger if exists dogsitter_quotes_sync_linked_service_financials on public.dogsitter_quotes;
create trigger dogsitter_quotes_sync_linked_service_financials
after update of total_amount,payment_terms,payment_status,deposit_amount,deposit_received_at,deposit_payment_method,deposit_reference,balance_due,converted_service_id
on public.dogsitter_quotes
for each row execute function public.k9_quote_financial_sync_trigger();

-- Sincronizza subito tutti i preventivi già trasformati.
do $$ declare r record; begin
  for r in select id from public.dogsitter_quotes where converted_service_id is not null and deleted_at is null loop
    perform public.k9_sync_quote_financials_internal(r.id);
  end loop;
end $$;

revoke all on function public.sync_quote_financials(uuid) from public;
grant execute on function public.sync_quote_financials(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
