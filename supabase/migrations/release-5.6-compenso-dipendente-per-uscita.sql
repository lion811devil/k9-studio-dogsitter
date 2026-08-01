begin;

alter table public.dogsitter_services
  add column if not exists employee_unit_compensation numeric(12,2) not null default 0;

update public.dogsitter_services
set employee_unit_compensation = round(
  coalesce(employee_compensation, 0) /
  greatest(
    1,
    coalesce(daily_visits, 1) *
    greatest(1, (coalesce(end_date, service_date) - service_date + 1))
  ),
  2
)
where coalesce(employee_unit_compensation, 0) = 0
  and coalesce(employee_compensation, 0) > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dogsitter_services_employee_unit_compensation_nonnegative'
      and conrelid = 'public.dogsitter_services'::regclass
  ) then
    alter table public.dogsitter_services
      add constraint dogsitter_services_employee_unit_compensation_nonnegative
      check (employee_unit_compensation >= 0);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
