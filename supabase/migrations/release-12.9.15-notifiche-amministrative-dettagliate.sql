-- K9 Studio Dogsitter — Release 12.9.15
-- Notifiche amministrative dettagliate SOLO tra Titolare/Super e Vice.
-- Dipendenti esclusi da questo audit-notifiche.
begin;

create or replace function public.k9_notify_owner_activity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text; actor_name text; role_label text;
  row_data jsonb; old_data jsonb; clean_new jsonb; clean_old jsonb;
  entity_id text; entity_label text; title_text text; action_label text;
  service_ref uuid; recipient record; key_text text;
  customer_label text; dog_label text; changed_text text := '';
  k text; ov text; nv text; field_label text; change_count int := 0;
begin
  if pg_trigger_depth()>1 or actor_id is null then return case when tg_op='DELETE' then old else new end; end if;

  select p.role,coalesce(nullif(trim(p.full_name),''),p.email,'Utente') into actor_role,actor_name
  from public.profiles p where p.id=actor_id and p.active=true;
  -- Audit dettagliato esclusivamente tra amministratori.
  if actor_role not in ('owner','vice_admin') then return case when tg_op='DELETE' then old else new end; end if;
  role_label := case actor_role when 'owner' then 'Datore di lavoro' else 'Vice Amministratore' end;

  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  clean_new := row_data - array['updated_at','last_seen_at','created_at'];
  clean_old := old_data - array['updated_at','last_seen_at','created_at'];
  if tg_op='UPDATE' and clean_new=clean_old then return new; end if;
  entity_id := coalesce(row_data->>'id',old_data->>'id','senza-id');

  -- Riferimenti leggibili cliente/animale.
  begin
    if nullif(row_data->>'customer_id','') is not null then
      select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into customer_label from public.customers where id=(row_data->>'customer_id')::uuid;
    end if;
  exception when others then customer_label:=null; end;
  begin
    if nullif(row_data->>'dog_id','') is not null then select name into dog_label from public.dogs where id=(row_data->>'dog_id')::uuid; end if;
  exception when others then dog_label:=null; end;

  entity_label := case tg_table_name
    when 'customers' then trim(coalesce(row_data->>'first_name','')||' '||coalesce(row_data->>'last_name',''))
    when 'dogs' then coalesce(nullif(row_data->>'name',''),'Animale')
    when 'profiles' then coalesce(nullif(row_data->>'full_name',''),nullif(row_data->>'email',''),'Utente')
    when 'dogsitter_services' then concat_ws(' / ',nullif(customer_label,''),nullif(dog_label,''),nullif(row_data->>'service_type',''))
    when 'dogsitter_quotes' then concat_ws(' / ',coalesce(nullif(row_data->>'customer_name',''),nullif(customer_label,'')),nullif(dog_label,''))
    when 'app_settings' then 'Impostazioni applicazione'
    else initcap(replace(tg_table_name,'_',' ')) end;
  entity_label := coalesce(nullif(trim(entity_label),''),initcap(replace(tg_table_name,'_',' ')));

  begin
    if tg_table_name='dogsitter_services' then service_ref:=nullif(row_data->>'id','')::uuid;
    elsif nullif(row_data->>'service_id','') is not null then service_ref:=(row_data->>'service_id')::uuid;
    elsif nullif(row_data->>'converted_service_id','') is not null then service_ref:=(row_data->>'converted_service_id')::uuid;
    end if;
  exception when others then service_ref:=null; end;

  action_label := case tg_op when 'INSERT' then 'creato' when 'DELETE' then 'eliminato' else 'modificato' end;
  if tg_op='UPDATE' and old_data?'deleted_at' and old_data->>'deleted_at' is null and row_data->>'deleted_at' is not null then action_label:='archiviato'; end if;
  title_text := case tg_table_name when 'customers' then 'Cliente ' when 'dogs' then 'Animale ' when 'profiles' then 'Utente ' when 'dogsitter_services' then 'Servizio ' when 'dogsitter_quotes' then 'Preventivo ' when 'app_settings' then 'Impostazioni ' else 'Attività ' end || action_label;

  -- Elenco dei soli campi realmente cambiati, con prima → dopo.
  if tg_op='UPDATE' then
    for k in select key from jsonb_object_keys(clean_new || clean_old) key loop
      if k in ('id','deleted_at','created_by','created_by_name','updated_by','organization_id','quote_id','converted_service_id') then continue; end if;
      ov:=coalesce(clean_old->>k,'—'); nv:=coalesce(clean_new->>k,'—');
      if ov is not distinct from nv then continue; end if;
      field_label:=case k
        when 'customer_amount' then 'Importo cliente' when 'employee_compensation' then 'Compenso dipendente'
        when 'employee_unit_compensation' then 'Compenso per uscita' when 'deposit_amount' then 'Acconto'
        when 'balance_due' then 'Saldo' when 'status' then 'Stato' when 'service_type' then 'Tipologia servizio'
        when 'service_date' then 'Data servizio' when 'service_time' then 'Orario' when 'periods' then 'Periodi'
        when 'operational_notes' then 'Note operative' when 'employee_id' then 'Dipendente assegnato'
        when 'payment_method' then 'Modalità pagamento' when 'deposit_payment_method' then 'Modalità acconto'
        else initcap(replace(k,'_',' ')) end;
      change_count:=change_count+1;
      changed_text:=changed_text||case when changed_text='' then '' else ' · ' end||field_label||': '||left(ov,140)||' → '||left(nv,140);
      exit when change_count>=10;
    end loop;
  end if;
  if changed_text='' then changed_text:=case tg_op when 'INSERT' then 'Nuova registrazione creata.' when 'DELETE' then 'Registrazione eliminata.' else 'Aggiornamento registrato.' end; end if;

  -- Destinatari: SOLO altro Titolare/Super o Vice. Mai dipendenti, mai autonotifica.
  for recipient in select id from public.profiles where active=true and role in ('owner','vice_admin') and id<>actor_id loop
    key_text:='admin-detail:'||txid_current()::text||':'||tg_table_name||':'||tg_op||':'||entity_id||':'||recipient.id::text;
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    values(recipient.id,actor_id,service_ref,title_text,
      actor_name||' ('||role_label||') ha '||action_label||' '||entity_label||'. Dettagli: '||changed_text||' · Data/ora: '||to_char(clock_timestamp() at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI:SS'),key_text)
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end loop;
  return case when tg_op='DELETE' then old else new end;
end$$;

-- Mantiene i trigger solo sulle entità amministrative principali.
do $$ declare tbl text; begin
  foreach tbl in array array['customers','dogs','profiles','dogsitter_services','dogsitter_quotes','app_settings'] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('drop trigger if exists k9_owner_activity_notify on public.%I',tbl);
      execute format('create trigger k9_owner_activity_notify after insert or update or delete on public.%I for each row execute function public.k9_notify_owner_activity()',tbl);
    end if;
  end loop;
end$$;
commit;
