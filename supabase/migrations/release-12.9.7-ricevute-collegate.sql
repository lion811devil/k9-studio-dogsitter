begin;

-- Release 12.9.7
-- Catena documentale univoca: Preventivo -> Servizio -> Saldo -> Ricevuta.
-- Una sola ricevuta definitiva per servizio. Tutti i riferimenti restano associati
-- a cliente, animale, preventivo e servizio.

create table if not exists public.dogsitter_receipts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.dogsitter_services(id) on delete restrict,
  quote_id uuid not null references public.dogsitter_quotes(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  dog_id uuid references public.dogs(id) on delete restrict,
  progressive integer not null check (progressive > 0),
  receipt_year integer not null check (receipt_year >= 2000),
  receipt_number text not null unique,
  receipt_date date not null default current_date,
  quote_number text not null,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'generating' check (status in ('generating','generated','inviato')),
  customer_name text not null,
  dog_name text,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  saldo_amount numeric(12,2) not null default 0 check (saldo_amount >= 0),
  payment_method text,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  sent_channel text,
  created_at timestamptz not null default now(),
  unique(receipt_year, progressive)
);

create index if not exists dogsitter_receipts_customer_idx on public.dogsitter_receipts(customer_id, receipt_date desc);
create index if not exists dogsitter_receipts_quote_idx on public.dogsitter_receipts(quote_id);
create index if not exists dogsitter_receipts_service_idx on public.dogsitter_receipts(service_id);

alter table public.dogsitter_receipts enable row level security;

drop policy if exists "k9 admins read receipts" on public.dogsitter_receipts;
create policy "k9 admins read receipts"
on public.dogsitter_receipts for select to authenticated
using (public.is_admin_role());

drop policy if exists "k9 admins manage receipts" on public.dogsitter_receipts;
create policy "k9 admins manage receipts"
on public.dogsitter_receipts for all to authenticated
using (public.is_admin_role()) with check (public.is_admin_role());

create or replace function public.create_service_receipt(p_service_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  s public.dogsitter_services%rowtype;
  q public.dogsitter_quotes%rowtype;
  c public.customers%rowtype;
  d public.dogs%rowtype;
  existing public.dogsitter_receipts%rowtype;
  v_progressive integer;
  v_year integer := extract(year from current_date)::integer;
  v_receipt_number text;
  v_quote_progressive bigint;
  v_quote_year integer;
  v_quote_number text;
  v_file_name text;
  v_storage_path text;
  v_total numeric(12,2);
  v_deposit numeric(12,2);
  v_saldo numeric(12,2);
  v_method text;
  v_row public.dogsitter_receipts%rowtype;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;

  select * into s from public.dogsitter_services where id=p_service_id and deleted_at is null;
  if not found then raise exception 'Servizio non trovato'; end if;
  if s.status <> 'chiuso' then raise exception 'Il servizio deve essere chiuso prima di emettere la ricevuta'; end if;
  if coalesce(s.customer_payment_status,'') <> 'incassato' then raise exception 'Prima registra il saldo cliente come incassato'; end if;

  select * into existing from public.dogsitter_receipts where service_id=s.id limit 1;
  if found then return to_jsonb(existing) || jsonb_build_object('document_type','receipt','source_kind','receipt','version',1,'is_active',true); end if;

  if s.quote_id is not null then
    select * into q from public.dogsitter_quotes where id=s.quote_id and deleted_at is null;
  end if;
  if not found then
    select * into q from public.dogsitter_quotes
      where converted_service_id=s.id and deleted_at is null
      order by created_at desc limit 1;
  end if;
  if not found then raise exception 'Il servizio non è collegato a un preventivo'; end if;
  if q.customer_id <> s.customer_id then raise exception 'Preventivo e servizio appartengono a clienti diversi'; end if;
  if coalesce(q.payment_status,'') <> 'Pagato' then raise exception 'Il preventivo collegato non risulta completamente pagato'; end if;

  select * into c from public.customers where id=s.customer_id;
  if not found then raise exception 'Cliente non trovato'; end if;
  if s.dog_id is not null then select * into d from public.dogs where id=s.dog_id; end if;

  v_total := coalesce(q.total_amount,s.customer_amount,0);
  v_deposit := coalesce(q.deposit_amount,0);
  v_saldo := greatest(0,v_total-v_deposit);
  v_method := coalesce(nullif(s.payment_method_other,''),nullif(s.payment_method,''),nullif(q.payment_terms,''),'Non indicata');

  -- Progressivo annuale: 001/AAAA, 002/AAAA... senza duplicati concorrenti.
  perform pg_advisory_xact_lock(hashtext('k9_receipts_'||v_year::text));
  select coalesce(max(progressive),0)+1 into v_progressive
    from public.dogsitter_receipts where receipt_year=v_year;
  v_receipt_number := 'R-'||lpad(v_progressive::text,3,'0')||'/'||v_year::text;

  v_quote_year := extract(year from coalesce(q.quote_date,current_date))::integer;
  select min(progressive) into v_quote_progressive
    from public.dogsitter_quote_document_versions where quote_id=q.id;
  v_quote_number := case
    when v_quote_progressive is not null then lpad(v_quote_progressive::text,3,'0')||'/'||v_quote_year::text
    else upper(substring(q.id::text,1,8))||'/'||v_quote_year::text
  end;

  v_file_name := concat_ws('_',
    'Ricevuta',
    public.k9_safe_file_part(c.first_name),
    public.k9_safe_file_part(c.last_name),
    nullif(public.k9_safe_file_part(d.name),''),
    replace(v_receipt_number,'/','-')
  )||'.pdf';
  v_storage_path := concat('ricevute/',v_year,'/',s.customer_id,'/',s.id,'/',v_file_name);

  insert into public.dogsitter_receipts(
    service_id,quote_id,customer_id,dog_id,progressive,receipt_year,receipt_number,receipt_date,
    quote_number,file_name,storage_path,status,customer_name,dog_name,total_amount,deposit_amount,
    saldo_amount,payment_method,generated_by
  ) values (
    s.id,q.id,s.customer_id,s.dog_id,v_progressive,v_year,v_receipt_number,current_date,
    v_quote_number,v_file_name,v_storage_path,'generating',trim(c.first_name||' '||c.last_name),d.name,
    v_total,v_deposit,v_saldo,v_method,auth.uid()
  ) returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('document_type','receipt','source_kind','receipt','version',1,'is_active',true);
end$$;

create or replace function public.finalize_service_receipt(p_receipt_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_receipts
     set status='generated', generated_at=coalesce(generated_at,now())
   where id=p_receipt_id and status='generating';
  if not found then
    if not exists(select 1 from public.dogsitter_receipts where id=p_receipt_id and status in ('generated','inviato')) then
      raise exception 'Ricevuta non trovata';
    end if;
  end if;
end$$;

create or replace function public.mark_service_receipt_sent(p_receipt_id uuid,p_channel text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  update public.dogsitter_receipts
     set status='inviato',sent_at=now(),sent_by=auth.uid(),sent_channel=nullif(trim(p_channel),'')
   where id=p_receipt_id and status in ('generated','inviato');
  if not found then raise exception 'Ricevuta non trovata o non ancora generata'; end if;
end$$;

grant select on public.dogsitter_receipts to authenticated;
grant execute on function public.create_service_receipt(uuid) to authenticated;
grant execute on function public.finalize_service_receipt(uuid) to authenticated;
grant execute on function public.mark_service_receipt_sent(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
