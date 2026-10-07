-- K9 Studio Dogsitter 12.9.54
-- Servizi generali: animale facoltativo + modalità di calcolo oraria.

alter table public.dogsitter_services
  alter column dog_id drop not null;

alter table public.dogsitter_services
  add column if not exists billing_mode text not null default 'prestazione';

alter table public.dogsitter_quotes
  add column if not exists billing_mode text not null default 'prestazione';

alter table public.dogsitter_services
  drop constraint if exists dogsitter_services_billing_mode_check;
alter table public.dogsitter_services
  add constraint dogsitter_services_billing_mode_check
  check (billing_mode in ('prestazione','ora'));

alter table public.dogsitter_quotes
  drop constraint if exists dogsitter_quotes_billing_mode_check;
alter table public.dogsitter_quotes
  add constraint dogsitter_quotes_billing_mode_check
  check (billing_mode in ('prestazione','ora'));
