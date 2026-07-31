begin;

-- Archivio privato per i PDF cliente e dipendente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-documents', 'service-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le operazioni sui PDF sono riservate a Datore di lavoro e Vice Admin.
drop policy if exists "k9 admins read service documents" on storage.objects;
create policy "k9 admins read service documents"
on storage.objects for select to authenticated
using (bucket_id = 'service-documents' and public.is_admin_role());

drop policy if exists "k9 admins upload service documents" on storage.objects;
create policy "k9 admins upload service documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'service-documents' and public.is_admin_role());

drop policy if exists "k9 admins update service documents" on storage.objects;
create policy "k9 admins update service documents"
on storage.objects for update to authenticated
using (bucket_id = 'service-documents' and public.is_admin_role())
with check (bucket_id = 'service-documents' and public.is_admin_role());

drop policy if exists "k9 owner deletes service documents" on storage.objects;
create policy "k9 owner deletes service documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'service-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and (p.is_owner = true or p.role = 'owner')
  )
);

commit;
