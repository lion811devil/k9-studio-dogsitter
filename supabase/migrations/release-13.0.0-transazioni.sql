-- K9 Studio Dogsitter 13.0.0 — tre operazioni atomiche, senza modifiche di schema o dati esistenti.
-- Eseguire una sola volta dopo backup, PRIMA del frontend. Non rieseguire migrazioni storiche.
-- SECURITY INVOKER: le RLS e i trigger esistenti restano applicabili.
begin;

create or replace function public.k9_save_quote_v13(p_id uuid,p_payload jsonb,p_items jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.dogsitter_quotes%rowtype; v_id uuid; v_subtotal numeric;
begin
  if auth.uid() is null or not coalesce(public.is_admin_role(),false) then raise exception 'Permesso negato'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Dati preventivo non validi'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Inserire almeno una voce'; end if;
  if exists(select 1 from jsonb_to_recordset(p_items) as i(description text,quantity numeric,unit_price numeric,position integer) where nullif(trim(description),'') is null or quantity is null or quantity<=0 or unit_price is null or unit_price<0) then raise exception 'Voci preventivo non valide'; end if;
  if p_id is not null then
    select * into q from public.dogsitter_quotes where id=p_id and deleted_at is null for update;
    if not found then raise exception 'Preventivo non trovato'; end if;
  end if;
  q:=jsonb_populate_record(q,p_payload);
  select sum(i.quantity*i.unit_price) into v_subtotal from jsonb_to_recordset(p_items) as i(quantity numeric,unit_price numeric);
  if q.discount_rate is null or q.discount_rate<0 or q.discount_rate>100 or q.total_amount is null or abs(q.total_amount-round(v_subtotal*(1-q.discount_rate/100),2))>0.01 then raise exception 'Totale preventivo incoerente'; end if;
  if coalesce(q.deposit_amount,0)<0 or coalesce(q.deposit_amount,0)>q.total_amount or coalesce(q.employee_compensation,0)>q.total_amount then raise exception 'Importi preventivo non validi'; end if;
  q.balance_due:=case when lower(coalesce(q.payment_status,''))='pagato' then 0 else greatest(0,q.total_amount-coalesce(q.deposit_amount,0)) end;
  if q.balance_due=0 then q.payment_status:='Pagato'; end if;
  if p_id is null then
    insert into public.dogsitter_quotes (
    customer_id, dog_id, source_service_id, quote_date, valid_until, status, payment_terms, notes, total_amount, subtotal_amount, discount_rate, frequency, daily_visits, start_date, end_date, planned_duration_minutes, billing_mode, time_slot_1, time_slot_2, time_slot_3, time_slot_4, periods, client_status, payment_status, deposit_amount, deposit_received_at, deposit_payment_method, deposit_reference, balance_due, employee_unit_compensation, employee_compensation, keys_status, keys_mode, customer_updates, auth_vet, auth_transport
  ) values (
    q.customer_id, q.dog_id, q.source_service_id, q.quote_date, q.valid_until, q.status, q.payment_terms, q.notes, q.total_amount, q.subtotal_amount, q.discount_rate, q.frequency, q.daily_visits, q.start_date, q.end_date, q.planned_duration_minutes, q.billing_mode, q.time_slot_1, q.time_slot_2, q.time_slot_3, q.time_slot_4, q.periods, q.client_status, q.payment_status, q.deposit_amount, q.deposit_received_at, q.deposit_payment_method, q.deposit_reference, q.balance_due, q.employee_unit_compensation, q.employee_compensation, q.keys_status, q.keys_mode, q.customer_updates, q.auth_vet, q.auth_transport
  ) returning id into v_id;
  else
    update public.dogsitter_quotes set
    customer_id=q.customer_id,
    dog_id=q.dog_id,
    source_service_id=q.source_service_id,
    quote_date=q.quote_date,
    valid_until=q.valid_until,
    status=q.status,
    payment_terms=q.payment_terms,
    notes=q.notes,
    total_amount=q.total_amount,
    subtotal_amount=q.subtotal_amount,
    discount_rate=q.discount_rate,
    frequency=q.frequency,
    daily_visits=q.daily_visits,
    start_date=q.start_date,
    end_date=q.end_date,
    planned_duration_minutes=q.planned_duration_minutes,
    billing_mode=q.billing_mode,
    time_slot_1=q.time_slot_1,
    time_slot_2=q.time_slot_2,
    time_slot_3=q.time_slot_3,
    time_slot_4=q.time_slot_4,
    periods=q.periods,
    client_status=q.client_status,
    payment_status=q.payment_status,
    deposit_amount=q.deposit_amount,
    deposit_received_at=q.deposit_received_at,
    deposit_payment_method=q.deposit_payment_method,
    deposit_reference=q.deposit_reference,
    balance_due=q.balance_due,
    employee_unit_compensation=q.employee_unit_compensation,
    employee_compensation=q.employee_compensation,
    keys_status=q.keys_status,
    keys_mode=q.keys_mode,
    customer_updates=q.customer_updates,
    auth_vet=q.auth_vet,
    auth_transport=q.auth_transport
  where id=p_id and deleted_at is null returning id into v_id;
    if v_id is null then raise exception 'Preventivo non aggiornato'; end if;
    delete from public.dogsitter_quote_items where quote_id=v_id;
  end if;
  insert into public.dogsitter_quote_items(quote_id,description,quantity,unit_price,position)
    select v_id,i.description,i.quantity,i.unit_price,coalesce(i.position,1)
    from jsonb_to_recordset(p_items) as i(description text,quantity numeric,unit_price numeric,position integer);
  if p_id is not null and exists(select 1 from public.dogsitter_quotes where id=v_id and converted_service_id is not null) then
    perform public.sync_quote_financials(v_id);
  end if;
  return v_id;
end $$;

create or replace function public.k9_save_service_v13(p_id uuid,p_payload jsonb,p_quote_id uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.dogsitter_services%rowtype; q public.dogsitter_quotes%rowtype; v_id uuid; v_old_status text; v_old_quote uuid;
begin
  if auth.uid() is null or not coalesce(public.is_admin_role(),false) then raise exception 'Permesso negato'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dati servizio non validi'; end if;
  -- Ordine dei lock uniforme: preventivo, poi servizio.
  if p_quote_id is not null then
    select * into q from public.dogsitter_quotes where id=p_quote_id and deleted_at is null for update;
    if not found then raise exception 'Preventivo non trovato'; end if;
    if q.converted_service_id is not null and q.converted_service_id is distinct from p_id and exists(select 1 from public.dogsitter_services where id=q.converted_service_id) then raise exception 'Preventivo già collegato a un servizio'; end if;
    if exists(select 1 from public.dogsitter_services where quote_id=q.id and id is distinct from p_id) then raise exception 'Preventivo già utilizzato; controllare anche il Cestino'; end if;
  end if;
  if p_id is not null then
    select * into s from public.dogsitter_services where id=p_id and deleted_at is null for update;
    if not found then raise exception 'Servizio non trovato'; end if;
    v_old_status:=s.status; v_old_quote:=s.quote_id;
    if v_old_quote is not null and v_old_quote is distinct from p_quote_id then raise exception 'Collegamento al preventivo non coerente'; end if;
    if p_quote_id is null and exists(select 1 from public.dogsitter_quotes where converted_service_id=p_id and deleted_at is null) then raise exception 'Preventivo collegato non indicato'; end if;
  end if;
  s:=jsonb_populate_record(s,p_payload);
  s.quote_id:=p_quote_id;
  if s.status='chiuso' and v_old_status is distinct from 'chiuso' then raise exception 'Usare la procedura di chiusura e verifica periodi'; end if;
  if v_old_status='chiuso' and s.status is distinct from 'chiuso' then raise exception 'Servizio archiviato: impossibile riaprirlo tramite modifica'; end if;
  if s.customer_amount is null or s.customer_amount<0 or s.employee_compensation is null or s.employee_compensation<0 or s.employee_compensation>s.customer_amount then raise exception 'Importi servizio non validi'; end if;
  if p_quote_id is not null then
    if q.customer_id is distinct from s.customer_id or q.dog_id is distinct from s.dog_id then raise exception 'Cliente o animale diverso dal preventivo'; end if;
    if abs(coalesce(q.total_amount,0)-s.customer_amount)>0.009 then raise exception 'Totale diverso dal preventivo'; end if;
    s.customer_amount:=q.total_amount; s.deposit_amount:=coalesce(q.deposit_amount,0);
    s.deposit_received_at:=q.deposit_received_at; s.deposit_payment_method:=q.deposit_payment_method; s.deposit_reference:=q.deposit_reference;
    s.quote_payment_status:=q.payment_status;
    s.balance_due:=case when lower(coalesce(q.payment_status,''))='pagato' then 0 else greatest(0,q.total_amount-s.deposit_amount) end;
    s.customer_payment_status:=case when s.balance_due=0 then 'incassato' else 'da_incassare' end;
    if p_id is null then s.payment_method:=coalesce(q.payment_terms,s.payment_method); end if;
  else
    s.deposit_amount:=coalesce(s.deposit_amount,0);
    s.balance_due:=case when s.customer_payment_status='incassato' then 0 else greatest(0,s.customer_amount-s.deposit_amount) end;
  end if;
  if p_id is null then
    insert into public.dogsitter_services (
    customer_id, dog_id, employee_id, status, service_type, frequency, service_time, planned_duration_minutes, periods, service_date, end_date, daily_visits, time_slot_1, time_slot_2, time_slot_3, time_slot_4, billing_mode, unit_rate, discount_rate, customer_amount, employee_unit_compensation, employee_compensation, payment_method, payment_method_other, client_status, customer_payment_status, keys_status, keys_mode, customer_updates, auth_vet, auth_transport, operational_notes, quote_id, deposit_amount, deposit_received_at, deposit_payment_method, deposit_reference, balance_due, quote_payment_status
  ) values (
    s.customer_id, s.dog_id, s.employee_id, s.status, s.service_type, s.frequency, s.service_time, s.planned_duration_minutes, s.periods, s.service_date, s.end_date, s.daily_visits, s.time_slot_1, s.time_slot_2, s.time_slot_3, s.time_slot_4, s.billing_mode, s.unit_rate, s.discount_rate, s.customer_amount, s.employee_unit_compensation, s.employee_compensation, s.payment_method, s.payment_method_other, s.client_status, s.customer_payment_status, s.keys_status, s.keys_mode, s.customer_updates, s.auth_vet, s.auth_transport, s.operational_notes, s.quote_id, s.deposit_amount, s.deposit_received_at, s.deposit_payment_method, s.deposit_reference, s.balance_due, s.quote_payment_status
  ) returning id into v_id;
  else
    update public.dogsitter_services set
    customer_id=s.customer_id,
    dog_id=s.dog_id,
    employee_id=s.employee_id,
    status=s.status,
    service_type=s.service_type,
    frequency=s.frequency,
    service_time=s.service_time,
    planned_duration_minutes=s.planned_duration_minutes,
    periods=s.periods,
    service_date=s.service_date,
    end_date=s.end_date,
    daily_visits=s.daily_visits,
    time_slot_1=s.time_slot_1,
    time_slot_2=s.time_slot_2,
    time_slot_3=s.time_slot_3,
    time_slot_4=s.time_slot_4,
    billing_mode=s.billing_mode,
    unit_rate=s.unit_rate,
    discount_rate=s.discount_rate,
    customer_amount=s.customer_amount,
    employee_unit_compensation=s.employee_unit_compensation,
    employee_compensation=s.employee_compensation,
    payment_method=s.payment_method,
    payment_method_other=s.payment_method_other,
    client_status=s.client_status,
    customer_payment_status=s.customer_payment_status,
    keys_status=s.keys_status,
    keys_mode=s.keys_mode,
    customer_updates=s.customer_updates,
    auth_vet=s.auth_vet,
    auth_transport=s.auth_transport,
    operational_notes=s.operational_notes,
    quote_id=s.quote_id,
    deposit_amount=s.deposit_amount,
    deposit_received_at=s.deposit_received_at,
    deposit_payment_method=s.deposit_payment_method,
    deposit_reference=s.deposit_reference,
    balance_due=s.balance_due,
    quote_payment_status=s.quote_payment_status
  where id=p_id and deleted_at is null returning id into v_id;
    if v_id is null then raise exception 'Servizio non aggiornato'; end if;
  end if;
  if p_quote_id is not null then
    update public.dogsitter_quotes set converted_service_id=v_id,status='accettato',balance_due=s.balance_due where id=p_quote_id;
    if not found then raise exception 'Collegamento preventivo non salvato'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.k9_register_payment_v13(p_service_id uuid,p_method text,p_other text,p_close boolean)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.dogsitter_services%rowtype; q public.dogsitter_quotes%rowtype; v_quote uuid; v_count integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin_role(),false) then raise exception 'Permesso negato'; end if;
  if nullif(trim(p_method),'') is null or (p_method='Altro' and nullif(trim(p_other),'') is null) then raise exception 'Indicare il metodo di pagamento'; end if;
  select quote_id into v_quote from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if v_quote is null then select id into v_quote from public.dogsitter_quotes where converted_service_id=p_service_id and deleted_at is null; end if;
  if v_quote is not null then
    select * into q from public.dogsitter_quotes where id=v_quote and deleted_at is null for update;
    if not found then raise exception 'Preventivo non trovato'; end if;
    if q.converted_service_id is not null and q.converted_service_id<>p_service_id then raise exception 'Collegamento preventivo incoerente'; end if;
  end if;
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null for update;
  if not found or s.status in ('chiuso','annullato') then raise exception 'Servizio non operativo'; end if;
  if s.quote_id is not null and s.quote_id is distinct from v_quote then raise exception 'Collegamento modificato: aggiornare la pagina'; end if;
  if coalesce(p_close,false) then
    v_count:=case when jsonb_typeof(s.periods)='array' then greatest(1,jsonb_array_length(s.periods)) else 1 end;
    if exists(select 1 from generate_series(0,v_count-1) as idx(i) where not exists(select 1 from public.service_period_workflows w where w.service_id=p_service_id and w.period_index=idx.i and w.status in ('chiuso','annullato'))) then raise exception 'Periodi non completati e verificati'; end if;
  end if;
  if v_quote is not null then
    update public.dogsitter_quotes set payment_status='Pagato',balance_due=0 where id=v_quote;
    if not found then raise exception 'Pagamento preventivo non salvato'; end if;
  end if;
  update public.dogsitter_services set customer_payment_status='incassato',balance_due=0,
    quote_payment_status=case when v_quote is not null then 'Pagato' else quote_payment_status end,
    payment_method=p_method,payment_method_other=case when p_method='Altro' then p_other else null end,
    status=case when coalesce(p_close,false) then 'chiuso' else status end,
    completed_at=case when coalesce(p_close,false) then now() else completed_at end
    where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Pagamento servizio non salvato'; end if;
  return p_service_id;
end $$;

revoke all on function public.k9_save_quote_v13(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.k9_save_service_v13(uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.k9_register_payment_v13(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.k9_save_quote_v13(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.k9_save_service_v13(uuid,jsonb,uuid) to authenticated;
grant execute on function public.k9_register_payment_v13(uuid,text,text,boolean) to authenticated;
commit;
