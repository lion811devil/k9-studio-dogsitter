begin;

create or replace function public.set_profile_photo(
  p_user_id uuid,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_user_id <> auth.uid() and not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and active = true
      and (is_owner = true or role in ('owner','vice_admin'))
  ) then
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

revoke all on function public.set_profile_photo(uuid,text) from public;
grant execute on function public.set_profile_photo(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
