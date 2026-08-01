begin;

-- Controllo centralizzato del ruolo corrente. SECURITY DEFINER evita che
-- eventuali policy sulla tabella profiles impediscano la verifica del ruolo.
create or replace function public.k9_is_admin()
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
      and (p.is_owner is true or p.role in ('owner','vice_admin'))
  );
$$;

revoke all on function public.k9_is_admin() from public;
grant execute on function public.k9_is_admin() to authenticated;

-- Le policy RESTRICTIVE si sommano a quelle già presenti: anche se una policy
-- precedente fosse troppo permissiva, un dipendente non può scrivere.
do $$
declare
  t text;
begin
  foreach t in array array['customers','dogs','dogsitter_services','profiles']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists k9_admin_only_insert on public.%I', t);
    execute format('drop policy if exists k9_admin_only_update on public.%I', t);
    execute format('drop policy if exists k9_admin_only_delete on public.%I', t);

    execute format(
      'create policy k9_admin_only_insert on public.%I as restrictive for insert to authenticated with check (public.k9_is_admin())',
      t
    );
    execute format(
      'create policy k9_admin_only_update on public.%I as restrictive for update to authenticated using (public.k9_is_admin()) with check (public.k9_is_admin())',
      t
    );
    execute format(
      'create policy k9_admin_only_delete on public.%I as restrictive for delete to authenticated using (public.k9_is_admin())',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
