begin;

create table if not exists public.service_communication_reads (
  message_id uuid not null references public.service_communications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists service_communication_reads_user_idx
  on public.service_communication_reads(user_id, read_at desc);

alter table public.service_communication_reads enable row level security;

drop policy if exists service_communication_reads_select on public.service_communication_reads;
create policy service_communication_reads_select
on public.service_communication_reads for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.service_communications m
    where m.id = service_communication_reads.message_id
      and m.author_id = auth.uid()
  )
);

revoke insert, update, delete on public.service_communication_reads from authenticated;
grant select on public.service_communication_reads to authenticated;

-- Conserva, quando possibile, le letture registrate dal vecchio sistema.
insert into public.service_communication_reads(message_id, user_id, read_at)
select id, read_by, read_at
from public.service_communications
where read_at is not null and read_by is not null
on conflict (message_id, user_id) do nothing;

drop function if exists public.mark_service_communications_read(uuid);
create function public.mark_service_communications_read(p_service_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not (
    public.current_role() in ('owner','vice_admin')
    or (
      public.current_role() = 'dipendente'
      and exists (
        select 1 from public.dogsitter_services s
        where s.id = p_service_id
          and s.employee_id = auth.uid()
          and s.deleted_at is null
      )
    )
  ) then
    raise exception 'Permesso negato';
  end if;

  with inserted as (
    insert into public.service_communication_reads(message_id, user_id, read_at)
    select m.id, auth.uid(), now()
    from public.service_communications m
    where m.service_id = p_service_id
      and m.status = 'sent'
      and m.author_id <> auth.uid()
    on conflict (message_id, user_id) do nothing
    returning 1
  )
  select count(*)::integer into affected from inserted;

  return affected;
end;
$$;

revoke all on function public.mark_service_communications_read(uuid) from public;
grant execute on function public.mark_service_communications_read(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
