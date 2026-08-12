-- K9 Studio Dogsitter — Release 12.8.4
-- Consolidamento generale: notifiche, documenti, sicurezza RPC e manutenzione.
-- Idempotente: può essere rieseguita.

begin;

-- Classificazione generica dell’animale mantenendo la tabella storica 'dogs'.
alter table public.dogs add column if not exists animal_type text not null default 'Cane';


create or replace function public.current_role() returns text
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and active=true limit 1
$$;
create or replace function public.is_admin_role() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.current_role() in ('owner','vice_admin'),false)
$$;
revoke all on function public.current_role() from public;
revoke all on function public.is_admin_role() from public;
grant execute on function public.current_role() to authenticated,service_role;
grant execute on function public.is_admin_role() to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 1) NOTIFICHE: solo il Titolare per attività di Vice/Dipendente.
--    Esclude tabelle tecniche che producevano rumore/duplicati.
-- ---------------------------------------------------------------------------
create or replace function public.k9_notify_owner_activity()
returns trigger
language plpgsql
security definer
set search_path=public
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
  if pg_trigger_depth()>1 or actor_id is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select p.role,coalesce(nullif(trim(p.full_name),''),p.email,'Utente')
    into actor_role,actor_name
  from public.profiles p where p.id=actor_id;

  if actor_role not in ('vice_admin','dipendente') then
    return case when tg_op='DELETE' then old else new end;
  end if;

  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  entity_id:=coalesce(row_data->>'id',old_data->>'id','senza-id');

  if tg_op='UPDATE' and
     (to_jsonb(new)-'updated_at'-'last_seen_at')=(to_jsonb(old)-'updated_at'-'last_seen_at') then
    return new;
  end if;

  action_label:=case tg_op when 'INSERT' then 'creato' when 'DELETE' then 'eliminato' else 'modificato' end;
  if tg_op='UPDATE' and old_data?'deleted_at' and old_data->>'deleted_at' is null and row_data->>'deleted_at' is not null then
    action_label:='archiviato';
  end if;

  entity_label:=case tg_table_name
    when 'customers' then trim(coalesce(row_data->>'first_name','')||' '||coalesce(row_data->>'last_name',''))
    when 'dogs' then coalesce(nullif(row_data->>'name',''),'Animale')
    when 'profiles' then coalesce(nullif(row_data->>'full_name',''),nullif(row_data->>'email',''),'Utente')
    when 'dogsitter_services' then coalesce(nullif(row_data->>'service_type',''),'Servizio')
    when 'dogsitter_quotes' then coalesce(nullif(row_data->>'customer_name',''),'Preventivo')
    when 'app_settings' then 'Impostazioni applicazione'
    else initcap(replace(tg_table_name,'_',' '))
  end;
  entity_label:=coalesce(nullif(trim(entity_label),''),initcap(replace(tg_table_name,'_',' ')));

  begin
    if tg_table_name='dogsitter_services' then service_ref:=nullif(row_data->>'id','')::uuid;
    elsif row_data?'service_id' and nullif(row_data->>'service_id','') is not null then service_ref:=(row_data->>'service_id')::uuid;
    elsif row_data?'converted_service_id' and nullif(row_data->>'converted_service_id','') is not null then service_ref:=(row_data->>'converted_service_id')::uuid;
    end if;
  exception when invalid_text_representation then service_ref:=null;
  end;

  title_text:=case tg_table_name
    when 'customers' then 'Cliente '||action_label
    when 'dogs' then 'Animale '||action_label
    when 'profiles' then 'Utente '||action_label
    when 'dogsitter_services' then 'Servizio '||action_label
    when 'dogsitter_quotes' then 'Preventivo '||action_label
    when 'app_settings' then 'Impostazioni modificate'
    else 'Attività '||action_label
  end;

  message_text:=actor_name||' ('||case actor_role when 'vice_admin' then 'Vice Amministratore' else 'Dipendente' end||') ha '||action_label||': '||entity_label||'.';

  for recipient in select id from public.profiles where active=true and role='owner' and id<>actor_id loop
    key_text:='activity:'||txid_current()::text||':'||tg_table_name||':'||tg_op||':'||entity_id||':'||recipient.id::text;
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    values(recipient.id,actor_id,service_ref,title_text,message_text,key_text)
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end loop;

  return case when tg_op='DELETE' then old else new end;
end$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['customers','dogs','profiles','dogsitter_services','dogsitter_quotes','app_settings'] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('drop trigger if exists k9_owner_activity_notify on public.%I',tbl);
      execute format('create trigger k9_owner_activity_notify after insert or update or delete on public.%I for each row execute function public.k9_notify_owner_activity()',tbl);
    end if;
  end loop;
  -- Rimuove trigger della 12.8.3 dalle tabelle tecniche/documentali.
  foreach tbl in array array['dogsitter_document_versions','dogsitter_quote_document_versions','dogsitter_quote_items','service_pdf_drafts'] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('drop trigger if exists k9_owner_activity_notify on public.%I',tbl);
    end if;
  end loop;
end$$;

-- Comunicazioni: il Titolare riceve le azioni di Vice e Dipendenti; il dipendente
-- continua a ricevere le comunicazioni amministrative a lui destinate.
create or replace function public.create_communication_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare r record; emp uuid; actor_name text;
begin
  if new.status<>'sent' then return new; end if;
  select coalesce(nullif(trim(full_name),''),'Utente') into actor_name from public.profiles where id=new.author_id;

  if new.author_role in ('dipendente','vice_admin') then
    for r in select id from public.profiles where active=true and role='owner' and id<>new.author_id loop
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message,event_key)
      values(r.id,new.author_id,new.service_id,new.id,
        case when new.author_role='dipendente' then 'Nuova comunicazione dal dipendente' else 'Nuova comunicazione dal Vice Amministratore' end,
        actor_name||': '||left(new.message,220),'communication-owner:'||new.id::text||':'||r.id::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
    end loop;
  end if;

  if new.author_role in ('owner','vice_admin') then
    select employee_id into emp from public.dogsitter_services where id=new.service_id;
    if emp is not null and emp<>new.author_id then
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message,event_key)
      values(emp,new.author_id,new.service_id,new.id,'Nuova comunicazione interna',actor_name||': '||left(new.message,220),'communication-employee:'||new.id::text||':'||emp::text)
      on conflict(recipient_id,event_key) where event_key is not null do nothing;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists service_communications_notify on public.service_communications;
create trigger service_communications_notify after insert on public.service_communications for each row execute function public.create_communication_notifications();

-- ---------------------------------------------------------------------------
-- 2) PERIODI: niente autonotifiche del Titolare/Vice.
-- ---------------------------------------------------------------------------
create or replace function public.start_service_period(p_service_id uuid,p_period_index integer) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text; actor_role text;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  actor_role:=public.current_role();
  if not (actor_role in ('owner','vice_admin') or (actor_role='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  perform public.sync_service_period_workflows(p_service_id);
  update public.service_period_workflows set status='in_corso',started_at=coalesce(started_at,now()),started_by=coalesce(started_by,auth.uid()),updated_at=now()
   where service_id=p_service_id and period_index=p_period_index and status='programmato' returning * into w;
  if not found then raise exception 'Il periodo non è disponibile per l’avvio'; end if;
  update public.dogsitter_services set status='in_corso' where id=p_service_id and status not in ('chiuso','annullato');
  if actor_role in ('vice_admin','dipendente') then
    select coalesce(nullif(trim(full_name),''),'Utente') into actor_name from public.profiles where id=auth.uid();
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    select p.id,auth.uid(),p_service_id,'Periodo iniziato',actor_name||' ha iniziato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')','period-start:'||w.id::text||':'||p.id::text
      from public.profiles p where p.active=true and p.role='owner' and p.id<>auth.uid()
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;
  return w;
end$$;

create or replace function public.end_service_period(p_service_id uuid,p_period_index integer,p_report_text text default null,p_incident_notes text default null) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text; actor_role text; remaining integer;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  actor_role:=public.current_role();
  if not (actor_role in ('owner','vice_admin') or (actor_role='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  update public.service_period_workflows set status='da_verificare',ended_at=now(),ended_by=auth.uid(),report_text=nullif(trim(p_report_text),''),incident_notes=nullif(trim(p_incident_notes),''),updated_at=now()
   where service_id=p_service_id and period_index=p_period_index and status='in_corso' returning * into w;
  if not found then raise exception 'Il periodo non risulta in corso'; end if;
  select count(*) into remaining from public.service_period_workflows where service_id=p_service_id and status not in ('da_verificare','chiuso','annullato');
  update public.dogsitter_services set status=case when remaining=0 then 'da_verificare' else 'in_corso' end,
    report_text=case when remaining=0 then coalesce(nullif(trim(p_report_text),''),report_text) else report_text end,
    incident_notes=case when remaining=0 then coalesce(nullif(trim(p_incident_notes),''),incident_notes) else incident_notes end
   where id=p_service_id;
  if actor_role in ('vice_admin','dipendente') then
    select coalesce(nullif(trim(full_name),''),'Utente') into actor_name from public.profiles where id=auth.uid();
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    select p.id,auth.uid(),p_service_id,'Periodo terminato',actor_name||' ha terminato il periodo '||(p_period_index+1)||' ('||to_char(w.start_date,'DD/MM/YYYY')||' - '||to_char(w.end_date,'DD/MM/YYYY')||')','period-end:'||w.id::text||':'||p.id::text
      from public.profiles p where p.active=true and p.role='owner' and p.id<>auth.uid()
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;
  return w;
end$$;

-- ---------------------------------------------------------------------------
-- 3) NOTIFICHE: eliminazione sicura da parte del solo destinatario.
-- ---------------------------------------------------------------------------
create or replace function public.delete_app_notification(p_notification_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  delete from public.app_notifications where id=p_notification_id and recipient_id=auth.uid();
  return found;
end$$;
revoke all on function public.delete_app_notification(uuid) from public;
grant execute on function public.delete_app_notification(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) DOCUMENTI: la nuova versione diventa attiva solo dopo upload/finalizzazione.
-- ---------------------------------------------------------------------------
create or replace function public.create_document_version(p_service_id uuid,p_document_type text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.dogsitter_services%rowtype; c public.customers%rowtype; d public.dogs%rowtype; e public.profiles%rowtype;
  v_version integer; v_progressive bigint; v_base text; v_file_name text; v_storage_path text; v_id uuid; v_row public.dogsitter_document_versions%rowtype;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  if p_document_type not in ('customer','employee') then raise exception 'Tipo documento non valido'; end if;
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  select * into c from public.customers where id=s.customer_id;
  select * into d from public.dogs where id=s.dog_id;
  select * into e from public.profiles where id=s.employee_id;
  select coalesce(max(version),0)+1,coalesce(min(progressive),nextval('public.k9_document_progressive_seq')) into v_version,v_progressive from public.dogsitter_document_versions where service_id=p_service_id and document_type=p_document_type;
  v_base:=concat_ws('_',public.k9_safe_file_part(c.first_name),public.k9_safe_file_part(c.last_name),nullif(public.k9_safe_file_part(d.name),''),to_char(s.service_date,'DD-MM-YYYY'),lpad(v_progressive::text,3,'0'));
  v_file_name:=case when p_document_type='employee' then v_base||'_Interno.pdf' else v_base||'.pdf' end;
  v_id:=gen_random_uuid();
  v_storage_path:=concat('documenti/',extract(year from s.service_date)::int,'/',s.customer_id,'/',s.id,'/',p_document_type,'/v',v_version,'/',v_file_name);
  insert into public.dogsitter_document_versions(id,service_id,customer_id,dog_id,employee_id,document_type,progressive,version,is_active,file_name,storage_path,status,customer_name,dog_name,employee_name,service_date,generated_by)
  values(v_id,s.id,s.customer_id,s.dog_id,s.employee_id,p_document_type,v_progressive,v_version,false,v_file_name,v_storage_path,'generating',trim(c.first_name||' '||c.last_name),d.name,e.full_name,s.service_date,auth.uid()) returning * into v_row;
  return to_jsonb(v_row)||jsonb_build_object('customer_amount',s.customer_amount,'employee_compensation',s.employee_compensation,'employee_payment_status',s.employee_payment_status,'customer_payment_status',s.customer_payment_status,'service_type',s.service_type,'service_time',s.service_time,'planned_duration_minutes',s.planned_duration_minutes,'daily_visits',s.daily_visits,'operational_notes',s.operational_notes,'report_text',s.report_text,'incident_notes',s.incident_notes,'started_at',s.started_at,'completed_at',s.completed_at);
end$$;

create or replace function public.finalize_document_version(p_document_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare d public.dogsitter_document_versions%rowtype;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  select * into d from public.dogsitter_document_versions where id=p_document_id and status='generating' for update;
  if not found then raise exception 'Documento non trovato o già finalizzato'; end if;
  update public.dogsitter_document_versions set is_active=false where service_id=d.service_id and document_type=d.document_type and id<>d.id and is_active=true;
  update public.dogsitter_document_versions set status='generated',generated_at=now(),is_active=true where id=d.id;
end$$;

create or replace function public.create_document_pair(p_service_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_customer jsonb; v_employee jsonb;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  if not exists(select 1 from public.dogsitter_services where id=p_service_id and deleted_at is null) then raise exception 'Servizio non trovato'; end if;
  v_customer:=public.create_document_version(p_service_id,'customer');
  v_employee:=public.create_document_version(p_service_id,'employee');
  return jsonb_build_array(v_customer,v_employee);
end$$;

create or replace function public.create_quote_document_version(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.dogsitter_quotes%rowtype; c public.customers%rowtype; d public.dogs%rowtype; v_version integer; v_progressive bigint; v_base text; v_file text; v_path text; v_row public.dogsitter_quote_document_versions%rowtype; v_items jsonb;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  select * into q from public.dogsitter_quotes where id=p_quote_id and deleted_at is null;
  if not found then raise exception 'Preventivo non trovato'; end if;
  select * into c from public.customers where id=q.customer_id;
  if q.dog_id is not null then select * into d from public.dogs where id=q.dog_id; end if;
  select coalesce(max(version),0)+1,coalesce(min(progressive),nextval('public.k9_quote_progressive_seq')) into v_version,v_progressive from public.dogsitter_quote_document_versions where quote_id=p_quote_id;
  v_base:=concat_ws('_','Preventivo',public.k9_safe_file_part(c.first_name),public.k9_safe_file_part(c.last_name),nullif(public.k9_safe_file_part(d.name),''),to_char(q.quote_date,'DD-MM-YYYY'),lpad(v_progressive::text,3,'0'));
  v_file:=v_base||'.pdf'; v_path:=concat('preventivi/',extract(year from q.quote_date)::int,'/',q.customer_id,'/',q.id,'/v',v_version,'/',v_file);
  insert into public.dogsitter_quote_document_versions(quote_id,customer_id,dog_id,progressive,version,is_active,file_name,storage_path,status,customer_name,dog_name,quote_date,generated_by)
  values(q.id,q.customer_id,q.dog_id,v_progressive,v_version,false,v_file,v_path,'generating',trim(c.first_name||' '||c.last_name),d.name,q.quote_date,auth.uid()) returning * into v_row;
  select coalesce(jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'position',i.position) order by i.position),'[]'::jsonb) into v_items from public.dogsitter_quote_items i where i.quote_id=q.id;
  return to_jsonb(v_row)||jsonb_build_object('document_type','quote','items',v_items,'valid_until',q.valid_until,'payment_terms',q.payment_terms,'notes',q.notes,'total_amount',q.total_amount,'customer_phone',c.phone,'customer_email',c.email,'customer_address',concat_ws(', ',nullif(c.address,''),nullif(c.city,'')));
end$$;

create or replace function public.finalize_quote_document_version(p_document_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare d public.dogsitter_quote_document_versions%rowtype;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  select * into d from public.dogsitter_quote_document_versions where id=p_document_id and status='generating' for update;
  if not found then raise exception 'Documento non trovato o già finalizzato'; end if;
  update public.dogsitter_quote_document_versions set is_active=false where quote_id=d.quote_id and id<>d.id and is_active=true;
  update public.dogsitter_quote_document_versions set status='generated',generated_at=now(),is_active=true where id=d.id;
end$$;

-- Cleanup manuale delle versioni rimaste in generating da oltre 24 ore.
create or replace function public.cleanup_stale_generating_documents() returns integer
language plpgsql security definer set search_path=public as $$
declare n1 integer:=0; n2 integer:=0;
begin
  if public.current_role()<>'owner' then raise exception 'Permesso negato'; end if;
  update public.dogsitter_document_versions set status='archived',is_active=false,archived_at=now(),archived_by=auth.uid() where status='generating' and created_at<now()-interval '24 hours';
  get diagnostics n1=row_count;
  update public.dogsitter_quote_document_versions set status='archived',is_active=false,archived_at=now(),archived_by=auth.uid() where status='generating' and created_at<now()-interval '24 hours';
  get diagnostics n2=row_count;
  return n1+n2;
end$$;

-- ---------------------------------------------------------------------------
-- 5) HARDENING: la funzione interna finanziaria non è richiamabile dal client.
-- ---------------------------------------------------------------------------
do $$ begin
  if to_regprocedure('public.k9_sync_quote_financials_internal(uuid)') is not null then
    execute 'revoke all on function public.k9_sync_quote_financials_internal(uuid) from public';
    execute 'revoke all on function public.k9_sync_quote_financials_internal(uuid) from authenticated';
  end if;
end$$;

revoke all on function public.start_service_period(uuid,integer) from public;
revoke all on function public.end_service_period(uuid,integer,text,text) from public;
revoke all on function public.create_document_version(uuid,text) from public;
revoke all on function public.finalize_document_version(uuid) from public;
revoke all on function public.create_document_pair(uuid) from public;
revoke all on function public.create_quote_document_version(uuid) from public;
revoke all on function public.finalize_quote_document_version(uuid) from public;
revoke all on function public.cleanup_stale_generating_documents() from public;

grant execute on function public.start_service_period(uuid,integer) to authenticated;
grant execute on function public.end_service_period(uuid,integer,text,text) to authenticated;
grant execute on function public.create_document_version(uuid,text) to authenticated;
grant execute on function public.finalize_document_version(uuid) to authenticated;
grant execute on function public.create_document_pair(uuid) to authenticated;
grant execute on function public.create_quote_document_version(uuid) to authenticated;
grant execute on function public.finalize_quote_document_version(uuid) to authenticated;
grant execute on function public.cleanup_stale_generating_documents() to authenticated;


-- ---------------------------------------------------------------------------
-- 6) FUNZIONI AMMINISTRATIVE mancanti dalla cronologia della repository.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_employee_code text,
  p_qualification text,
  p_pass_expires_at date,
  p_role text,
  p_active boolean
) returns void
language plpgsql security definer set search_path=public as $$
declare caller_role text; target_owner boolean;
begin
  caller_role:=public.current_role();
  if caller_role not in ('owner','vice_admin') then raise exception 'Permesso negato'; end if;
  select coalesce(is_owner,false) into target_owner from public.profiles where id=p_user_id;
  if not found then raise exception 'Profilo non trovato'; end if;
  if target_owner and caller_role<>'owner' then raise exception 'Il titolare può essere modificato solo dal titolare'; end if;
  if caller_role='vice_admin' and p_role<>'dipendente' and p_user_id<>auth.uid() then raise exception 'Il Vice Amministratore può gestire solo dipendenti'; end if;
  if p_role not in ('owner','vice_admin','dipendente') then raise exception 'Ruolo non valido'; end if;
  update public.profiles set full_name=nullif(trim(p_full_name),''),employee_code=nullif(trim(p_employee_code),''),qualification=nullif(trim(p_qualification),''),pass_expires_at=p_pass_expires_at,role=case when target_owner then 'owner' else p_role end,active=coalesce(p_active,true),updated_at=now() where id=p_user_id;
end$$;
revoke all on function public.admin_update_profile(uuid,text,text,text,date,text,boolean) from public;
grant execute on function public.admin_update_profile(uuid,text,text,text,date,text,boolean) to authenticated;

create or replace function public.edge_user_delete_link_check(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'servizi',(select count(*) from public.dogsitter_services where employee_id=p_user_id),
    'clienti_assegnati',(select count(*) from public.customers where assigned_employee_id=p_user_id),
    'comunicazioni',(select count(*) from public.service_communications where author_id=p_user_id),
    'documenti_dipendente',(select count(*) from public.dogsitter_document_versions where employee_id=p_user_id),
    'preventivi_creati',(select count(*) from public.dogsitter_quotes where created_by=p_user_id)
  ) into result;
  return result;
end$$;
revoke all on function public.edge_user_delete_link_check(uuid) from public,anon,authenticated;
grant execute on function public.edge_user_delete_link_check(uuid) to service_role;

notify pgrst,'reload schema';
commit;
