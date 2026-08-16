begin;

alter table public.service_period_workflows
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

create or replace function public.verify_service_period(p_service_id uuid,p_period_index integer)
returns public.service_period_workflows
language plpgsql
security definer
set search_path=public
as $$
declare
  w public.service_period_workflows%rowtype;
  s public.dogsitter_services%rowtype;
  actor_role text;
  actor_name text;
  remaining integer;
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;

  actor_role:=public.current_role();
  if actor_role not in ('owner','vice_admin') then
    raise exception 'Operazione riservata al Titolare/Vice';
  end if;

  select * into s
  from public.dogsitter_services
  where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;

  update public.service_period_workflows
     set status='chiuso',
         verified_at=now(),
         verified_by=auth.uid(),
         updated_at=now()
   where service_id=p_service_id
     and period_index=p_period_index
     and status='da_verificare'
  returning * into w;

  if not found then
    raise exception 'Il periodo non è disponibile per la verifica';
  end if;

  select count(*) into remaining
  from public.service_period_workflows
  where service_id=p_service_id
    and status not in ('chiuso','annullato');

  update public.dogsitter_services
     set status=case when remaining=0 then 'da_verificare' else 'in_corso' end
   where id=p_service_id
     and status not in ('chiuso','annullato');

  if s.employee_id is not null and s.employee_id<>auth.uid() then
    select coalesce(nullif(trim(full_name),''),'Titolare/Vice')
      into actor_name
      from public.profiles
     where id=auth.uid();

    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    values(
      s.employee_id,
      auth.uid(),
      p_service_id,
      'Periodo verificato',
      coalesce(actor_name,'Titolare/Vice')||' ha verificato e chiuso il periodo '||(p_period_index+1)||'.',
      'period-verified:'||w.id::text||':'||s.employee_id::text
    )
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;

  return w;
end$$;

revoke all on function public.verify_service_period(uuid,integer) from public,anon,authenticated;
grant execute on function public.verify_service_period(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
