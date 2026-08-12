begin;

-- 12.8.5: le notifiche di prova sono uno strumento diagnostico riservato al Titolare.
delete from public.app_notifications n
using public.profiles p
where n.recipient_id=p.id
  and coalesce(n.title,'')='Notifica di prova'
  and p.role<>'owner';

create or replace function public.create_test_app_notification()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare nid uuid; r text;
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  r:=public.current_role();
  if r<>'owner' then raise exception 'Funzione riservata al Titolare'; end if;
  insert into public.app_notifications(recipient_id,actor_id,title,message,event_key)
  values(auth.uid(),auth.uid(),'Notifica di prova','Il sistema notifiche è attivo.','manual-test-12.8.5:'||auth.uid()::text||':'||clock_timestamp()::text)
  returning id into nid;
  return nid;
end$$;
revoke all on function public.create_test_app_notification() from public,anon,authenticated;
grant execute on function public.create_test_app_notification() to authenticated;

-- Difesa server-side: un periodo già terminato non può essere avviato in ritardo.
create or replace function public.start_service_period(p_service_id uuid,p_period_index integer) returns public.service_period_workflows
language plpgsql security definer set search_path=public as $$
declare w public.service_period_workflows%rowtype; s public.dogsitter_services%rowtype; actor_name text; actor_role text;
begin
  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  actor_role:=public.current_role();
  if not (actor_role in ('owner','vice_admin') or (actor_role='dipendente' and s.employee_id=auth.uid())) then raise exception 'Permesso negato'; end if;
  perform public.sync_service_period_workflows(p_service_id);
  select * into w from public.service_period_workflows where service_id=p_service_id and period_index=p_period_index;
  if not found then raise exception 'Periodo non trovato'; end if;
  if w.end_date<current_date then raise exception 'Il periodo è già concluso e non può essere avviato'; end if;
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

notify pgrst,'reload schema';
commit;
