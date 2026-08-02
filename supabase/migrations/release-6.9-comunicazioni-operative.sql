begin;

create table if not exists public.service_communications (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.dogsitter_services(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_role text not null check (author_role in ('owner','vice_admin','dipendente')),
  message text not null check (char_length(btrim(message)) between 1 and 3000),
  status text not null default 'draft' check (status in ('draft','sent')),
  edited_from_id uuid references public.service_communications(id) on delete set null,
  read_at timestamptz,
  read_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_communications_service_idx
  on public.service_communications(service_id, created_at);
create index if not exists service_communications_unread_idx
  on public.service_communications(service_id, read_at)
  where status = 'sent';

alter table public.service_communications enable row level security;

drop policy if exists service_communications_select on public.service_communications;
drop policy if exists service_communications_insert on public.service_communications;
drop policy if exists service_communications_update_own_draft on public.service_communications;
drop policy if exists service_communications_delete_own_draft on public.service_communications;

create policy service_communications_select
on public.service_communications for select
to authenticated
using (
  (public.current_role() in ('owner','vice_admin') and (service_communications.status = 'sent' or service_communications.author_id = auth.uid()))
  or exists (
    select 1 from public.dogsitter_services s
    where s.id = service_communications.service_id
      and s.employee_id = auth.uid()
      and s.deleted_at is null
      and (service_communications.status = 'sent' or service_communications.author_id = auth.uid())
  )
);

create policy service_communications_insert
on public.service_communications for insert
to authenticated
with check (
  author_id = auth.uid()
  and author_role = public.current_role()
  and (
    public.current_role() in ('owner','vice_admin')
    or (
      public.current_role() = 'dipendente'
      and exists (
        select 1 from public.dogsitter_services s
        where s.id = service_communications.service_id
          and s.employee_id = auth.uid()
          and s.deleted_at is null
      )
    )
  )
);

create policy service_communications_update_own_draft
on public.service_communications for update
to authenticated
using (author_id = auth.uid() and status = 'draft')
with check (author_id = auth.uid() and status = 'draft');

create policy service_communications_delete_own_draft
on public.service_communications for delete
to authenticated
using (author_id = auth.uid() and status = 'draft');

create or replace function public.mark_service_communications_read(p_service_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if public.current_role() in ('owner','vice_admin') then
    update public.service_communications
       set read_at = coalesce(read_at, now()), read_by = auth.uid(), updated_at = now()
     where service_id = p_service_id
       and status = 'sent'
       and author_id <> auth.uid()
       and read_at is null;
  elsif public.current_role() = 'dipendente' and exists (
    select 1 from public.dogsitter_services s
    where s.id = p_service_id and s.employee_id = auth.uid() and s.deleted_at is null
  ) then
    update public.service_communications
       set read_at = coalesce(read_at, now()), read_by = auth.uid(), updated_at = now()
     where service_id = p_service_id
       and status = 'sent'
       and author_id <> auth.uid()
       and read_at is null;
  else
    raise exception 'Permesso negato';
  end if;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_service_communications_read(uuid) from public;
grant execute on function public.mark_service_communications_read(uuid) to authenticated;

grant select, insert, update, delete on public.service_communications to authenticated;

notify pgrst, 'reload schema';
commit;
