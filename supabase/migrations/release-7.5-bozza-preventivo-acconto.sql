-- Release 7.5 — Bozza automatica preventivo e gestione acconto

alter table public.dogsitter_quotes
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists deposit_received_at date,
  add column if not exists deposit_payment_method text,
  add column if not exists deposit_reference text,
  add column if not exists balance_due numeric(12,2);

update public.dogsitter_quotes
set balance_due = greatest(0, coalesce(total_amount,0) - coalesce(deposit_amount,0))
where balance_due is null;

alter table public.dogsitter_quotes
  drop constraint if exists dogsitter_quotes_deposit_amount_check;

alter table public.dogsitter_quotes
  add constraint dogsitter_quotes_deposit_amount_check
  check (deposit_amount >= 0 and deposit_amount <= coalesce(total_amount, deposit_amount));

comment on column public.dogsitter_quotes.deposit_amount is 'Acconto ricevuto dal cliente';
comment on column public.dogsitter_quotes.balance_due is 'Residuo cliente dopo acconto';
