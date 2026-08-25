-- K9 Studio Dogsitter 12.9.36
-- Correzione compensi dipendente: i servizi chiusi non tornano nell'area operativa,
-- ma il loro storico economico personale resta disponibile in "Compensi liquidati · Archivio".

begin;

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
          select 1 from public.dogsitter_services s
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
          select 1 from public.dogsitter_services s
          where s.dog_id = d.id
            and s.employee_id = auth.uid()
            and s.deleted_at is null
            and s.status not in ('chiuso','annullato')
        )
    ), '[]'::jsonb),

    -- AREA OPERATIVA: solo servizi ancora di competenza.
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

    -- AREA COMPENSI: include anche i servizi chiusi, ma senza alcun dato
    -- economico del cliente. Serve esclusivamente per lo storico personale.
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
      left join public.dogs d on d.id=s.dog_id
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

notify pgrst, 'reload schema';
commit;
