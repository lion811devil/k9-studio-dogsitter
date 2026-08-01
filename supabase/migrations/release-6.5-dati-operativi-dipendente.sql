begin;

-- Restituisce al dipendente tutti i dati operativi delle sole anagrafiche e
-- dei soli servizi a lui assegnati. Gli importi cliente e gli altri valori
-- economici interni restano esclusi.
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
        and (
          c.assigned_employee_id = auth.uid()
          or exists (
            select 1
            from public.dogsitter_services s
            where s.customer_id = c.id
              and s.employee_id = auth.uid()
              and s.deleted_at is null
          )
        )
    ), '[]'::jsonb),
    'dogs', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.name)
      from public.dogs d
      join public.customers c on c.id = d.customer_id
      where d.deleted_at is null
        and d.active is true
        and c.deleted_at is null
        and (
          c.assigned_employee_id = auth.uid()
          or exists (
            select 1
            from public.dogsitter_services s
            where s.dog_id = d.id
              and s.employee_id = auth.uid()
              and s.deleted_at is null
          )
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
          - 'deleted_by'
        order by s.service_date desc, s.service_time asc
      )
      from public.dogsitter_services s
      where s.employee_id = auth.uid()
        and s.deleted_at is null
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.employee_workspace() from public;
grant execute on function public.employee_workspace() to authenticated;

notify pgrst, 'reload schema';
commit;
