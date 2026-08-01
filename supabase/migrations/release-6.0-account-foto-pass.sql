begin;

alter table public.profiles add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sostituzione idempotente delle policy del bucket.
drop policy if exists "profile_photos_read" on storage.objects;
drop policy if exists "profile_photos_insert" on storage.objects;
drop policy if exists "profile_photos_update" on storage.objects;
drop policy if exists "profile_photos_delete" on storage.objects;

create policy "profile_photos_read" on storage.objects
for select using (bucket_id = 'profile-photos');

create policy "profile_photos_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true and (p.role in ('owner','vice_admin') or p.is_owner = true)
    )
  )
);

create policy "profile_photos_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true and (p.role in ('owner','vice_admin') or p.is_owner = true)
    )
  )
)
with check (bucket_id = 'profile-photos');

create policy "profile_photos_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true and (p.role in ('owner','vice_admin') or p.is_owner = true)
    )
  )
);

create or replace function public.set_profile_photo(p_user_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sessione non valida'; end if;
  if p_user_id <> auth.uid() and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and (p.role in ('owner','vice_admin') or p.is_owner = true)
  ) then raise exception 'Permesso negato'; end if;
  update public.profiles set photo_url = nullif(trim(p_photo_url),''), updated_at = now() where id = p_user_id;
end;
$$;

grant execute on function public.set_profile_photo(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
