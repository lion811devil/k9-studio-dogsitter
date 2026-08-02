begin;

alter table public.dogsitter_services
  add column if not exists periods jsonb not null default '[]'::jsonb;

alter table public.dogsitter_quotes
  add column if not exists periods jsonb not null default '[]'::jsonb;

update public.dogsitter_services
set periods = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
  'start_date', service_date,
  'end_date', coalesce(end_date, service_date),
  'daily_visits', greatest(coalesce(daily_visits,1),1),
  'time_slot_1', time_slot_1,
  'time_slot_2', time_slot_2,
  'time_slot_3', time_slot_3,
  'time_slot_4', time_slot_4,
  'position', 1
)))
where periods = '[]'::jsonb and service_date is not null;

update public.dogsitter_quotes
set periods = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
  'start_date', coalesce(start_date, quote_date),
  'end_date', coalesce(end_date, start_date, quote_date),
  'daily_visits', greatest(coalesce(daily_visits,1),1),
  'time_slot_1', time_slot_1,
  'time_slot_2', time_slot_2,
  'time_slot_3', time_slot_3,
  'time_slot_4', time_slot_4,
  'position', 1
)))
where periods = '[]'::jsonb and coalesce(start_date, quote_date) is not null;

create index if not exists dogsitter_services_periods_gin
  on public.dogsitter_services using gin (periods);
create index if not exists dogsitter_quotes_periods_gin
  on public.dogsitter_quotes using gin (periods);

commit;
