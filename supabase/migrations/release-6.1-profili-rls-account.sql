begin;

-- Garantisce i privilegi di base necessari. Le policy RLS continuano a limitare
-- gli utenti autenticati, mentre service_role resta utilizzabile dalle Edge Functions.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;
revoke all on table public.profiles from anon;

alter table public.profiles enable row level security;

-- Controllo amministrativo centralizzato, eseguito con i privilegi del proprietario
-- della funzione per evitare ricorsione e conflitti tra policy della stessa tabella.
create or replace function public.is_current_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active is true
      and (p.is_owner is true or p.role in ('owner', 'vice_admin'))
  );
$$;

revoke all on function public.is_current_profile_admin() from public;
grant execute on function public.is_current_profile_admin() to authenticated, service_role;

-- Lettura sicura del profilo da parte della Edge Function.
create or replace function public.edge_profile_lookup(p_user_id uuid)
returns table (
  id uuid,
  email text,
  role text,
  is_owner boolean,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.role, coalesce(p.is_owner, false), coalesce(p.active, false)
  from public.profiles p
  where p.id = p_user_id
  limit 1;
$$;

revoke all on function public.edge_profile_lookup(uuid) from public, anon, authenticated;
grant execute on function public.edge_profile_lookup(uuid) to service_role;

-- Rimuove tutte le policy precedenti sulla tabella profiles per evitare conflitti.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end
$$;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_current_profile_admin()
);

create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.is_current_profile_admin());

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.is_current_profile_admin())
with check (public.is_current_profile_admin());

create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using (public.is_current_profile_admin());

-- Ricrea la funzione foto usando lo stesso controllo centralizzato.
create or replace function public.set_profile_photo(p_user_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessione non valida';
  end if;

  if p_user_id <> auth.uid() and not public.is_current_profile_admin() then
    raise exception 'Permesso negato';
  end if;

  update public.profiles
  set photo_url = nullif(trim(p_photo_url), ''),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Profilo non trovato';
  end if;
end;
$$;

revoke all on function public.set_profile_photo(uuid, text) from public;
grant execute on function public.set_profile_photo(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
