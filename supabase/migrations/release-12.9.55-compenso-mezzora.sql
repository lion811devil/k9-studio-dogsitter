-- K9 Studio Dogsitter 12.9.55
-- Per i servizi a ore, employee_unit_compensation rappresenta il compenso ogni 30 minuti.
-- Per i servizi a prestazione continua a rappresentare il compenso per uscita/prestazione.

begin;

-- Mantiene invariato il totale dei servizi a ore creati con la 12.9.54,
-- convertendo il vecchio valore "per uscita" nel nuovo valore "ogni 30 minuti".
with service_visits as (
  select s.id,
    case
      when jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array' and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>0 then
        (select coalesce(sum(greatest(1,coalesce(nullif(x->>'daily_visits','')::integer,1))*greatest(1,(coalesce(nullif(x->>'end_date',''),x->>'start_date')::date-(x->>'start_date')::date)+1)),0) from jsonb_array_elements(s.periods) x)
      else greatest(1,coalesce(s.daily_visits,1))*greatest(1,(coalesce(s.end_date,s.service_date)-s.service_date)+1)
    end::numeric as visits
  from public.dogsitter_services s
  where coalesce(s.billing_mode,'prestazione')='ora' and s.deleted_at is null
)
update public.dogsitter_services s
set employee_unit_compensation=round((s.employee_compensation/nullif(v.visits*(greatest(0,coalesce(s.planned_duration_minutes,0)::numeric)/30),0))::numeric,2)
from service_visits v
where s.id=v.id and coalesce(s.employee_compensation,0)>0 and coalesce(s.planned_duration_minutes,0)>0;

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
  employee_factor numeric(12,4):=1;
  period_amount numeric(12,2):=0;
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  actor_role:=public.current_role();
  if actor_role not in ('owner','vice_admin') then raise exception 'Operazione riservata al Titolare/Vice'; end if;

  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;

  if jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array' and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>p_period_index then
    p:=s.periods->p_period_index;
  else
    p:=jsonb_build_object('start_date',s.service_date,'end_date',coalesce(s.end_date,s.service_date),'daily_visits',coalesce(s.daily_visits,1));
  end if;

  period_visits:=greatest(1,coalesce(nullif(p->>'daily_visits','')::integer,1))
    * greatest(1,(coalesce(nullif(p->>'end_date',''),p->>'start_date')::date-(p->>'start_date')::date)+1);

  if jsonb_typeof(coalesce(s.periods,'[]'::jsonb))='array' and jsonb_array_length(coalesce(s.periods,'[]'::jsonb))>0 then
    select coalesce(sum(greatest(1,coalesce(nullif(x->>'daily_visits','')::integer,1))*greatest(1,(coalesce(nullif(x->>'end_date',''),x->>'start_date')::date-(x->>'start_date')::date)+1)),0)::integer
      into total_visits from jsonb_array_elements(s.periods) x;
  else
    total_visits:=greatest(1,coalesce(s.daily_visits,1))*greatest(1,(coalesce(s.end_date,s.service_date)-s.service_date)+1);
  end if;

  employee_factor:=case when coalesce(s.billing_mode,'prestazione')='ora' then greatest(0,coalesce(s.planned_duration_minutes,0)::numeric/30) else 1 end;
  unit_comp:=case
    when coalesce(s.employee_unit_compensation,0)>0 then s.employee_unit_compensation
    when coalesce(s.employee_compensation,0)>0 and total_visits>0 and employee_factor>0 then s.employee_compensation/(total_visits*employee_factor)
    else 0
  end;
  period_amount:=round((unit_comp*period_visits*employee_factor)::numeric,2);

  update public.service_period_workflows
     set status='chiuso',verified_at=now(),verified_by=auth.uid(),employee_visits=period_visits,
         employee_unit_compensation=round(unit_comp::numeric,2),employee_amount=period_amount,
         employee_payment_status=case when period_amount>0 then 'da_liquidare' else 'non_maturato' end,
         employee_paid_at=null,employee_paid_by=null,updated_at=now()
   where service_id=p_service_id and period_index=p_period_index and status='da_verificare'
  returning * into w;
  if not found then raise exception 'Il periodo non è disponibile per la verifica'; end if;

  select count(*) into remaining from public.service_period_workflows where service_id=p_service_id and status not in ('chiuso','annullato');
  update public.dogsitter_services
     set status=case when remaining=0 then 'da_verificare' else 'in_corso' end,
         employee_payment_status=case when period_amount>0 then 'da_liquidare' else 'non_maturato' end
   where id=p_service_id and status not in ('chiuso','annullato');

  if s.employee_id is not null and s.employee_id<>auth.uid() then
    select coalesce(nullif(trim(full_name),''),'Titolare/Vice') into actor_name from public.profiles where id=auth.uid();
    insert into public.app_notifications(recipient_id,actor_id,service_id,title,message,event_key)
    values(s.employee_id,auth.uid(),p_service_id,'Periodo verificato',coalesce(actor_name,'Titolare/Vice')||' ha verificato il periodo '||(p_period_index+1)||'. Compenso maturato: '||to_char(period_amount,'FM999999990D00')||' €.','period-verified:'||w.id::text||':'||s.employee_id::text)
    on conflict(recipient_id,event_key) where event_key is not null do nothing;
  end if;
  return w;
end$$;

revoke all on function public.verify_service_period(uuid,integer) from public,anon,authenticated;
grant execute on function public.verify_service_period(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
