-- K9 Studio Dogsitter 12.9.44
-- Assegnazione operativa univoca dei servizi ai dipendenti.
-- Fonte di verità: dogsitter_services.employee_id.
-- customers.assigned_employee_id resta solo il dipendente predefinito per i nuovi servizi.

begin;

-- 1. Completa in sicurezza eventuali servizi attivi senza dipendente,
--    usando il dipendente predefinito del cliente solo se è un dipendente attivo.
update public.dogsitter_services s
set employee_id = c.assigned_employee_id
from public.customers c
join public.profiles p
  on p.id = c.assigned_employee_id
 and p.role = 'dipendente'
 and p.active is true
where s.customer_id = c.id
  and s.employee_id is null
  and s.deleted_at is null
  and s.status not in ('chiuso','annullato');

-- 2. Trigger di normalizzazione e controllo per TUTTI i servizi futuri.
create or replace function public.k9_validate_service_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_role text;
  v_active boolean;
begin
  -- Se il servizio nasce senza dipendente, prova il predefinito del cliente.
  if new.employee_id is null and new.customer_id is not null then
    select c.assigned_employee_id
      into v_employee
    from public.customers c
    where c.id = new.customer_id
      and c.deleted_at is null;

    new.employee_id := v_employee;
  end if;

  -- Servizi operativi devono avere sempre un dipendente responsabile.
  if new.deleted_at is null
     and coalesce(new.status,'programmato') not in ('chiuso','annullato')
     and new.employee_id is null then
    raise exception 'Il servizio operativo deve avere un dipendente responsabile.';
  end if;

  if new.employee_id is not null then
    select p.role, p.active
      into v_role, v_active
    from public.profiles p
    where p.id = new.employee_id;

    if not found then
      raise exception 'Dipendente assegnato inesistente.';
    end if;

    if v_role <> 'dipendente' then
      raise exception 'Il servizio può essere assegnato solo a un profilo Dipendente.';
    end if;

    -- Per un servizio nuovo/operativo non accettiamo un dipendente sospeso.
    if new.deleted_at is null
       and coalesce(new.status,'programmato') not in ('chiuso','annullato')
       and coalesce(v_active,false) is not true then
      raise exception 'Il dipendente assegnato non è attivo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_k9_validate_service_employee on public.dogsitter_services;
create trigger trg_k9_validate_service_employee
before insert or update of customer_id, employee_id, status, deleted_at
on public.dogsitter_services
for each row
execute function public.k9_validate_service_employee();

-- 3. Workspace dipendente: un servizio è visibile esclusivamente al dipendente
--    registrato nel singolo servizio. Questa regola vale uguale per dipendenti
--    esistenti e per quelli creati in futuro.
create or replace function public.employee_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if public.current_role() <> 'dipendente' then
    raise exception 'Permesso negato';
  end if;

  select jsonb_build_object(
    'customers', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.last_name, c.first_name)
      from public.customers c
      where c.deleted_at is null
        and c.status = 'attivo'
        and exists (
          select 1
          from public.dogsitter_services s
          where s.customer_id = c.id
            and s.employee_id = auth.uid()
            and s.deleted_at is null
            and s.status not in ('chiuso','annullato')
        )
    ), '[]'::jsonb),

    'dogs', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.name)
      from public.dogs d
      where d.deleted_at is null
        and d.active is true
        and exists (
          select 1
          from public.dogsitter_services s
          where s.dog_id = d.id
            and s.employee_id = auth.uid()
            and s.deleted_at is null
            and s.status not in ('chiuso','annullato')
        )
    ), '[]'::jsonb),

    'services', coalesce((
      select jsonb_agg(
        to_jsonb(s)
          - 'customer_amount'
          - 'unit_rate'
          - 'discount_rate'
          - 'customer_payment_status'
          - 'payment_method'
          - 'payment_method_other'
          - 'deposit_amount'
          - 'deposit_received_at'
          - 'deposit_payment_method'
          - 'deposit_reference'
          - 'balance_due'
          - 'quote_payment_status'
          - 'quote_id'
          - 'deleted_by'
        order by s.service_date desc, s.service_time asc
      )
      from public.dogsitter_services s
      where s.employee_id = auth.uid()
        and s.deleted_at is null
        and s.status not in ('chiuso','annullato')
    ), '[]'::jsonb),

    'period_runs', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.service_id, w.period_index)
      from public.service_period_workflows w
      join public.dogsitter_services s on s.id = w.service_id
      where s.employee_id = auth.uid()
        and s.deleted_at is null
        and s.status not in ('chiuso','annullato')
    ), '[]'::jsonb),

    'compensation_services', coalesce((
      select jsonb_agg(
        (
          to_jsonb(s)
            - 'customer_amount'
            - 'unit_rate'
            - 'discount_rate'
            - 'customer_payment_status'
            - 'payment_method'
            - 'payment_method_other'
            - 'deposit_amount'
            - 'deposit_received_at'
            - 'deposit_payment_method'
            - 'deposit_reference'
            - 'balance_due'
            - 'quote_payment_status'
            - 'quote_id'
            - 'operational_notes'
            - 'report_text'
            - 'incident_notes'
            - 'auth_vet'
            - 'auth_transport'
            - 'keys_status'
            - 'keys_mode'
            - 'customer_updates'
            - 'deleted_by'
        ) || jsonb_build_object('dog_name', d.name)
        order by s.service_date desc, s.service_time asc
      )
      from public.dogsitter_services s
      left join public.dogs d on d.id = s.dog_id
      where s.employee_id = auth.uid()
        and s.deleted_at is null
    ), '[]'::jsonb),

    'compensation_period_runs', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.service_id, w.period_index)
      from public.service_period_workflows w
      join public.dogsitter_services s on s.id = w.service_id
      where s.employee_id = auth.uid()
        and s.deleted_at is null
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.employee_workspace() from public, anon, authenticated;
grant execute on function public.employee_workspace() to authenticated;

-- 4. Diagnostica amministrativa: individua eventuali servizi attivi rimasti senza
--    un dipendente valido. Non modifica assegnazioni diverse ma intenzionali.
create or replace function public.service_assignment_anomalies()
returns table(
  service_id uuid,
  customer_name text,
  dog_name text,
  service_type text,
  service_date date,
  employee_id uuid,
  employee_name text,
  issue text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    d.name,
    s.service_type,
    s.service_date,
    s.employee_id,
    p.full_name,
    case
      when s.employee_id is null then 'Dipendente non assegnato'
      when p.id is null then 'Profilo dipendente inesistente'
      when p.role <> 'dipendente' then 'Profilo assegnato non è Dipendente'
      when p.active is not true then 'Dipendente non attivo'
      else 'OK'
    end
  from public.dogsitter_services s
  left join public.customers c on c.id = s.customer_id
  left join public.dogs d on d.id = s.dog_id
  left join public.profiles p on p.id = s.employee_id
  where s.deleted_at is null
    and s.status not in ('chiuso','annullato')
    and (
      s.employee_id is null
      or p.id is null
      or p.role <> 'dipendente'
      or p.active is not true
    )
  order by
    s.service_date,
    trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    d.name;
$$;

revoke all on function public.service_assignment_anomalies() from public, anon, authenticated;
grant execute on function public.service_assignment_anomalies() to authenticated;

notify pgrst, 'reload schema';
commit;
