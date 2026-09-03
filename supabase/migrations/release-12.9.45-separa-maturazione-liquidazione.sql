-- K9 Studio Dogsitter 12.9.45
-- Correzione definitiva: maturazione e liquidazione compensi sono eventi separati.
-- Nessun compenso può diventare "liquidato" durante la sola verifica del periodo.

begin;

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
  p jsonb;
  period_visits integer:=0;
  total_visits integer:=0;
  unit_comp numeric(12,4):=0;
  period_amount numeric(12,2):=0;
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

  if jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array'
     and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>p_period_index then
    p:=s.periods->p_period_index;
  else
    p:=jsonb_build_object(
      'start_date',s.service_date,
      'end_date',coalesce(s.end_date,s.service_date),
      'daily_visits',coalesce(s.daily_visits,1)
    );
  end if;

  period_visits:=greatest(1,coalesce(nullif(p->>'daily_visits','')::integer,1))
    * greatest(1,(coalesce(nullif(p->>'end_date',''),p->>'start_date')::date-(p->>'start_date')::date)+1);

  if jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array'
     and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>0 then
    select coalesce(sum(
      greatest(1,coalesce(nullif(x->>'daily_visits','')::integer,1))
      * greatest(1,(coalesce(nullif(x->>'end_date',''),x->>'start_date')::date-(x->>'start_date')::date)+1)
    ),0)::integer
    into total_visits
    from jsonb_array_elements(s.periods) x;
  else
    total_visits:=greatest(1,coalesce(s.daily_visits,1))
      * greatest(1,(coalesce(s.end_date,s.service_date)-s.service_date)+1);
  end if;

  unit_comp:=case
    when coalesce(s.employee_unit_compensation,0)>0 then s.employee_unit_compensation
    when coalesce(s.employee_compensation,0)>0 and total_visits>0 then s.employee_compensation/total_visits
    else 0
  end;
  period_amount:=round((unit_comp*period_visits)::numeric,2);

  update public.service_period_workflows
     set status='chiuso',
         verified_at=now(),
         verified_by=auth.uid(),
         employee_visits=period_visits,
         employee_unit_compensation=round(unit_comp::numeric,2),
         employee_amount=period_amount,
         employee_payment_status=case when period_amount>0 then 'da_liquidare' else 'non_maturato' end,
         employee_paid_at=null,
         employee_paid_by=null,
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
     set status=case when remaining=0 then 'da_verificare' else 'in_corso' end,
         employee_payment_status=case when period_amount>0 then 'da_liquidare' else 'non_maturato' end
   where id=p_service_id
     and status not in ('chiuso','annullato');

  if s.employee_id is not null and s.employee_id<>auth.uid() then
    select coalesce(nullif(trim(full_name),''),'Titolare/Vice')
      into actor_name
      from public.profiles
     where id=auth.uid();

    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    values(
      s.employee_id,auth.uid(),p_service_id,'Periodo verificato',
      coalesce(actor_name,'Titolare/Vice')||' ha verificato il periodo '||(p_period_index+1)||
      '. Compenso maturato: '||to_char(period_amount,'FM999999990D00')||' €.',
      'period-verified:'||w.id::text||':'||s.employee_id::text
    )
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;

  return w;
end$$;

revoke all on function public.verify_service_period(uuid,integer) from public,anon,authenticated;
grant execute on function public.verify_service_period(uuid,integer) to authenticated;

-- Ripara esclusivamente le false liquidazioni automatiche create dalla vecchia logica:
-- importo 0, liquidato, con data liquidazione coincidente con la verifica.
do $$
declare
  r record;
  p jsonb;
  pv integer;
  tv integer;
  uc numeric;
  pa numeric;
begin
  for r in
    select w.id,w.service_id,w.period_index,w.verified_at,
           s.periods,s.service_date,s.end_date,s.daily_visits,
           s.employee_unit_compensation,s.employee_compensation
    from public.service_period_workflows w
    join public.dogsitter_services s on s.id=w.service_id
    where w.status='chiuso'
      and w.verified_at is not null
      and w.employee_payment_status='liquidato'
      and coalesce(w.employee_amount,0)=0
      and w.employee_paid_at is not null
      and abs(extract(epoch from (w.employee_paid_at-w.verified_at))) <= 5
  loop
    if jsonb_typeof(coalesce(r.periods,'[]'::jsonb))='array'
       and jsonb_array_length(coalesce(r.periods,'[]'::jsonb))>r.period_index then
      p:=r.periods->r.period_index;
    else
      p:=jsonb_build_object(
        'start_date',r.service_date,
        'end_date',coalesce(r.end_date,r.service_date),
        'daily_visits',coalesce(r.daily_visits,1)
      );
    end if;

    pv:=greatest(1,coalesce(nullif(p->>'daily_visits','')::integer,1))
      * greatest(1,(coalesce(nullif(p->>'end_date',''),p->>'start_date')::date-(p->>'start_date')::date)+1);

    if jsonb_typeof(coalesce(r.periods,'[]'::jsonb))='array'
       and jsonb_array_length(coalesce(r.periods,'[]'::jsonb))>0 then
      select coalesce(sum(
        greatest(1,coalesce(nullif(x->>'daily_visits','')::integer,1))
        * greatest(1,(coalesce(nullif(x->>'end_date',''),x->>'start_date')::date-(x->>'start_date')::date)+1)
      ),0)::integer into tv
      from jsonb_array_elements(r.periods) x;
    else
      tv:=greatest(1,coalesce(r.daily_visits,1))
        * greatest(1,(coalesce(r.end_date,r.service_date)-r.service_date)+1);
    end if;

    uc:=case
      when coalesce(r.employee_unit_compensation,0)>0 then r.employee_unit_compensation
      when coalesce(r.employee_compensation,0)>0 and tv>0 then r.employee_compensation/tv
      else 0
    end;
    pa:=round((uc*pv)::numeric,2);

    update public.service_period_workflows
       set employee_visits=pv,
           employee_unit_compensation=round(uc::numeric,2),
           employee_amount=pa,
           employee_payment_status=case when pa>0 then 'da_liquidare' else 'non_maturato' end,
           employee_paid_at=null,
           employee_paid_by=null,
           updated_at=now()
     where id=r.id;
  end loop;
end$$;

-- Riallinea lo stato complessivo del servizio ai periodi, senza creare liquidazioni.
update public.dogsitter_services s
set employee_payment_status =
  case
    when exists (
      select 1 from public.service_period_workflows w
      where w.service_id=s.id and w.status='chiuso'
        and w.employee_payment_status='da_liquidare'
    ) then 'da_liquidare'
    when exists (
      select 1 from public.service_period_workflows w
      where w.service_id=s.id and w.status='chiuso'
        and w.employee_payment_status='liquidato'
    )
    and not exists (
      select 1 from public.service_period_workflows w
      where w.service_id=s.id and w.status='chiuso'
        and w.employee_payment_status<>'liquidato'
    ) then 'liquidato'
    else 'da_liquidare'
  end
where s.deleted_at is null
  and exists (
    select 1 from public.service_period_workflows w where w.service_id=s.id
  );

notify pgrst,'reload schema';
commit;
