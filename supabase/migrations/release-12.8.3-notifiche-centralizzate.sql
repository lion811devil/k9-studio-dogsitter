-- K9 Studio Dogsitter — Release 12.8.3
-- Notifiche centralizzate verso il Titolare per le operazioni eseguite
-- da Vice Amministratore e Dipendenti.
--
-- ESECUZIONE: Supabase > SQL Editor > New query > incollare tutto > Run.
-- La migrazione è idempotente: può essere rieseguita senza duplicare trigger.

begin;

-- Requisiti minimi della tabella notifiche.
alter table public.app_notifications add column if not exists event_key text;
create unique index if not exists app_notifications_recipient_event_uidx
  on public.app_notifications(recipient_id,event_key)
  where event_key is not null;
create index if not exists app_notifications_recipient_idx
  on public.app_notifications(recipient_id,read_at,created_at desc);

alter table public.app_notifications enable row level security;
drop policy if exists app_notifications_select on public.app_notifications;
create policy app_notifications_select on public.app_notifications
  for select to authenticated
  using (recipient_id = auth.uid());
grant select on public.app_notifications to authenticated;

-- Funzione centrale: crea una notifica per ogni Titolare attivo quando
-- l'azione è stata eseguita da un Vice Amministratore o da un Dipendente.
create or replace function public.k9_notify_owner_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_name text;
  row_data jsonb;
  old_data jsonb;
  entity_id text;
  entity_label text;
  action_label text;
  title_text text;
  message_text text;
  service_ref uuid;
  recipient record;
  key_text text;
begin
  -- Evita notifiche generate da aggiornamenti tecnici/cascata provocati
  -- da altri trigger. Le azioni utente di primo livello hanno depth = 1.
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Nessun utente autenticato: nessuna notifica.
  if actor_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select p.role, coalesce(nullif(trim(p.full_name),''), p.email, 'Utente')
    into actor_role, actor_name
  from public.profiles p
  where p.id = actor_id;

  -- Il Titolare non riceve notifiche sulle proprie azioni.
  if actor_role not in ('vice_admin','dipendente') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  entity_id := coalesce(row_data->>'id', old_data->>'id', 'senza-id');

  -- Se un UPDATE non cambia realmente i dati applicativi, non notificare.
  -- Ignora timestamp tecnici che possono cambiare automaticamente.
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at' - 'last_seen_at') =
       (to_jsonb(old) - 'updated_at' - 'last_seen_at') then
      return new;
    end if;
  end if;

  action_label := case tg_op
    when 'INSERT' then 'creato'
    when 'DELETE' then 'eliminato'
    else 'modificato'
  end;

  -- Se deleted_at passa da NULL a valorizzato, mostra "archiviato".
  if tg_op = 'UPDATE'
     and old_data ? 'deleted_at'
     and old_data->>'deleted_at' is null
     and row_data->>'deleted_at' is not null then
    action_label := 'archiviato';
  end if;

  -- Etichetta leggibile dell'elemento interessato.
  entity_label := case tg_table_name
    when 'customers' then trim(coalesce(row_data->>'first_name','') || ' ' || coalesce(row_data->>'last_name',''))
    when 'dogs' then coalesce(nullif(row_data->>'name',''), 'Animale')
    when 'profiles' then coalesce(nullif(row_data->>'full_name',''), nullif(row_data->>'email',''), 'Utente')
    when 'dogsitter_services' then coalesce(nullif(row_data->>'service_type',''), 'Servizio')
    when 'dogsitter_quotes' then coalesce(nullif(row_data->>'customer_name',''), 'Preventivo')
    when 'dogsitter_document_versions' then coalesce(nullif(row_data->>'file_name',''), 'Documento servizio')
    when 'dogsitter_quote_document_versions' then coalesce(nullif(row_data->>'file_name',''), 'Documento preventivo')
    when 'dogsitter_quote_items' then coalesce(nullif(row_data->>'description',''), 'Voce preventivo')
    when 'service_pdf_drafts' then coalesce(nullif(row_data->>'document_type',''), 'Bozza PDF')
    when 'app_settings' then 'Impostazioni applicazione'
    else initcap(replace(tg_table_name,'_',' '))
  end;
  entity_label := coalesce(nullif(trim(entity_label),''), initcap(replace(tg_table_name,'_',' ')));

  -- Collega la notifica al servizio quando il riferimento è disponibile.
  begin
    if tg_table_name = 'dogsitter_services' then
      service_ref := nullif(row_data->>'id','')::uuid;
    elsif row_data ? 'service_id' and nullif(row_data->>'service_id','') is not null then
      service_ref := (row_data->>'service_id')::uuid;
    elsif row_data ? 'converted_service_id' and nullif(row_data->>'converted_service_id','') is not null then
      service_ref := (row_data->>'converted_service_id')::uuid;
    else
      service_ref := null;
    end if;
  exception when invalid_text_representation then
    service_ref := null;
  end;

  title_text := case tg_table_name
    when 'customers' then 'Cliente ' || action_label
    when 'dogs' then 'Animale ' || action_label
    when 'profiles' then 'Utente ' || action_label
    when 'dogsitter_services' then 'Servizio ' || action_label
    when 'dogsitter_quotes' then 'Preventivo ' || action_label
    when 'dogsitter_document_versions' then 'Documento servizio ' || action_label
    when 'dogsitter_quote_document_versions' then 'Documento preventivo ' || action_label
    when 'dogsitter_quote_items' then 'Voce preventivo ' || action_label
    when 'service_pdf_drafts' then 'Bozza PDF ' || action_label
    when 'app_settings' then 'Impostazioni modificate'
    else 'Attività ' || action_label
  end;

  message_text := actor_name || ' (' ||
    case actor_role when 'vice_admin' then 'Vice Amministratore' else 'Dipendente' end ||
    ') ha ' || action_label || ': ' || entity_label || '.';

  -- Un event_key deterministico evita duplicati della stessa azione nella
  -- stessa transazione, ma consente azioni successive sullo stesso record.
  for recipient in
    select p.id
    from public.profiles p
    where p.active = true
      and p.role = 'owner'
      and p.id <> actor_id
  loop
    key_text := 'activity:' || txid_current()::text || ':' || tg_table_name || ':' ||
                tg_op || ':' || entity_id || ':' || recipient.id::text;

    insert into public.app_notifications(
      recipient_id, actor_id, service_id, title, message, event_key
    ) values (
      recipient.id, actor_id, service_ref, title_text, message_text, key_text
    )
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Installa il trigger solo sulle tabelle effettivamente presenti.
-- Comunicazioni e workflow periodi sono esclusi perché hanno già notifiche
-- dedicate e più descrittive nelle migrazioni precedenti.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'customers',
    'dogs',
    'profiles',
    'dogsitter_services',
    'dogsitter_quotes',
    'dogsitter_document_versions',
    'dogsitter_quote_document_versions',
    'dogsitter_quote_items',
    'service_pdf_drafts',
    'app_settings'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('drop trigger if exists k9_owner_activity_notify on public.%I', tbl);
      execute format(
        'create trigger k9_owner_activity_notify after insert or update or delete on public.%I for each row execute function public.k9_notify_owner_activity()',
        tbl
      );
    end if;
  end loop;
end;
$$;

-- La versione 12.8.2 del frontend richiama questa RPC all'avvio e al rientro
-- in primo piano. Nelle release precedenti la funzione non era presente.
-- Da 12.8.3 le notifiche sono create direttamente dai trigger, quindi la RPC
-- serve come sincronizzazione compatibile e non deve generare errori.
create or replace function public.sync_missed_app_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;
  return 0;
end;
$$;

revoke all on function public.sync_missed_app_notifications() from public;
grant execute on function public.sync_missed_app_notifications() to authenticated;

-- Test manuale: crea una notifica SOLO per l'utente autenticato.
-- Utile per verificare la lettura frontend senza simulare azioni di altri ruoli.
create or replace function public.create_test_app_notification()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare nid uuid;
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  insert into public.app_notifications(recipient_id,actor_id,title,message,event_key)
  values(
    auth.uid(), auth.uid(), 'Notifica di prova',
    'Il sistema notifiche della Release 12.8.3 è attivo.',
    'manual-test-12.8.3:' || auth.uid()::text || ':' || clock_timestamp()::text
  )
  returning id into nid;
  return nid;
end;
$$;

revoke all on function public.create_test_app_notification() from public;
grant execute on function public.create_test_app_notification() to authenticated;

commit;
