-- K9 Studio Dogsitter 12.9.56
-- Preventivo: compenso dipendente interno e margine, mai esposti nel PDF cliente.

alter table public.dogsitter_quotes
  add column if not exists employee_unit_compensation numeric(12,2) not null default 0,
  add column if not exists employee_compensation numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='dogsitter_quotes_employee_unit_compensation_nonnegative'
      and conrelid='public.dogsitter_quotes'::regclass
  ) then
    alter table public.dogsitter_quotes
      add constraint dogsitter_quotes_employee_unit_compensation_nonnegative
      check (employee_unit_compensation >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='dogsitter_quotes_employee_compensation_nonnegative'
      and conrelid='public.dogsitter_quotes'::regclass
  ) then
    alter table public.dogsitter_quotes
      add constraint dogsitter_quotes_employee_compensation_nonnegative
      check (employee_compensation >= 0);
  end if;
end $$;
