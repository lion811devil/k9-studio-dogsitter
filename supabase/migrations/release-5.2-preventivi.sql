begin;

create sequence if not exists public.k9_quote_progressive_seq start 1;

create table if not exists public.dogsitter_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  dog_id uuid references public.dogs(id),
  source_service_id uuid references public.dogsitter_services(id),
  quote_date date not null default current_date,
  valid_until date not null,
  status text not null default 'bozza' check (status in ('bozza','inviato','accettato','rifiutato','scaduto')),
  payment_terms text,
  notes text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.dogsitter_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.dogsitter_quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.dogsitter_quote_document_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.dogsitter_quotes(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  dog_id uuid references public.dogs(id),
  progressive bigint not null,
  version integer not null check (version > 0),
  is_active boolean not null default true,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'generating' check (status in ('generating','generated','inviato','archived')),
  customer_name text not null,
  dog_name text,
  quote_date date not null,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  sent_channel text,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(quote_id,version)
);

create index if not exists quotes_customer_idx on public.dogsitter_quotes(customer_id,created_at desc);
create index if not exists quote_items_quote_idx on public.dogsitter_quote_items(quote_id,position);
create index if not exists quote_docs_quote_idx on public.dogsitter_quote_document_versions(quote_id,version desc);

alter table public.dogsitter_quotes enable row level security;
alter table public.dogsitter_quote_items enable row level security;
alter table public.dogsitter_quote_document_versions enable row level security;

drop policy if exists "admins manage quotes" on public.dogsitter_quotes;
create policy "admins manage quotes" on public.dogsitter_quotes for all to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
drop policy if exists "admins manage quote items" on public.dogsitter_quote_items;
create policy "admins manage quote items" on public.dogsitter_quote_items for all to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
drop policy if exists "admins manage quote documents" on public.dogsitter_quote_document_versions;
create policy "admins manage quote documents" on public.dogsitter_quote_document_versions for all to authenticated using (public.is_admin_role()) with check (public.is_admin_role());

create or replace function public.create_quote_document_version(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.dogsitter_quotes%rowtype; c public.customers%rowtype; d public.dogs%rowtype;
  v_version integer; v_progressive bigint; v_base text; v_file text; v_path text; v_row public.dogsitter_quote_document_versions%rowtype; v_items jsonb;
begin
  if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
  select * into q from public.dogsitter_quotes where id=p_quote_id and deleted_at is null;
  if not found then raise exception 'Preventivo non trovato'; end if;
  select * into c from public.customers where id=q.customer_id;
  if q.dog_id is not null then select * into d from public.dogs where id=q.dog_id; end if;
  select coalesce(max(version),0)+1,coalesce(min(progressive),nextval('public.k9_quote_progressive_seq')) into v_version,v_progressive from public.dogsitter_quote_document_versions where quote_id=p_quote_id;
  v_base:=concat_ws('_','Preventivo',public.k9_safe_file_part(c.first_name),public.k9_safe_file_part(c.last_name),nullif(public.k9_safe_file_part(d.name),''),to_char(q.quote_date,'DD-MM-YYYY'),lpad(v_progressive::text,3,'0'));
  v_file:=v_base||'.pdf';v_path:=concat('preventivi/',extract(year from q.quote_date)::int,'/',q.customer_id,'/',q.id,'/v',v_version,'/',v_file);
  update public.dogsitter_quote_document_versions set is_active=false where quote_id=p_quote_id and is_active=true;
  insert into public.dogsitter_quote_document_versions(quote_id,customer_id,dog_id,progressive,version,is_active,file_name,storage_path,status,customer_name,dog_name,quote_date,generated_by)
  values(q.id,q.customer_id,q.dog_id,v_progressive,v_version,true,v_file,v_path,'generating',trim(c.first_name||' '||c.last_name),d.name,q.quote_date,auth.uid()) returning * into v_row;
  select coalesce(jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'position',i.position) order by i.position),'[]'::jsonb) into v_items from public.dogsitter_quote_items i where i.quote_id=q.id;
  return to_jsonb(v_row)||jsonb_build_object('document_type','quote','items',v_items,'valid_until',q.valid_until,'payment_terms',q.payment_terms,'notes',q.notes,'total_amount',q.total_amount,'customer_phone',c.phone,'customer_email',c.email,'customer_address',concat_ws(', ',nullif(c.address,''),nullif(c.city,'')));
end$$;

create or replace function public.finalize_quote_document_version(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if;update public.dogsitter_quote_document_versions set status='generated',generated_at=now() where id=p_document_id and status='generating';if not found then raise exception 'Documento non trovato o già finalizzato';end if;end$$;
create or replace function public.mark_quote_document_version_sent(p_document_id uuid,p_channel text) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_admin_role() then raise exception 'Permesso negato';end if;update public.dogsitter_quote_document_versions set status='inviato',sent_at=now(),sent_by=auth.uid(),sent_channel=nullif(trim(p_channel),'') where id=p_document_id;if not found then raise exception 'Preventivo non trovato';end if;end$$;
create or replace function public.archive_quote_document_version(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_admin_role() then raise exception 'Permesso negato';end if;update public.dogsitter_quote_document_versions set status='archived',is_active=false,archived_at=now(),archived_by=auth.uid() where id=p_document_id;if not found then raise exception 'Preventivo non trovato';end if;end$$;

grant select,insert,update,delete on public.dogsitter_quotes,public.dogsitter_quote_items,public.dogsitter_quote_document_versions to authenticated;
grant execute on function public.create_quote_document_version(uuid) to authenticated;
grant execute on function public.finalize_quote_document_version(uuid) to authenticated;
grant execute on function public.mark_quote_document_version_sent(uuid,text) to authenticated;
grant execute on function public.archive_quote_document_version(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
