begin;

alter table public.app_settings
  add column if not exists pdf_attachments jsonb not null default '[]'::jsonb,
  add column if not exists attach_pdfs_to_quotes boolean not null default true;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pdf-attachments','pdf-attachments',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

drop policy if exists pdf_attachments_select on storage.objects;
drop policy if exists pdf_attachments_insert on storage.objects;
drop policy if exists pdf_attachments_update on storage.objects;
drop policy if exists pdf_attachments_delete on storage.objects;
create policy pdf_attachments_select on storage.objects for select to authenticated using(bucket_id='pdf-attachments' and public.current_role() in ('owner','vice_admin'));
create policy pdf_attachments_insert on storage.objects for insert to authenticated with check(bucket_id='pdf-attachments' and public.current_role() in ('owner','vice_admin'));
create policy pdf_attachments_update on storage.objects for update to authenticated using(bucket_id='pdf-attachments' and public.current_role() in ('owner','vice_admin')) with check(bucket_id='pdf-attachments' and public.current_role() in ('owner','vice_admin'));
create policy pdf_attachments_delete on storage.objects for delete to authenticated using(bucket_id='pdf-attachments' and public.current_role() in ('owner','vice_admin'));

create table if not exists public.app_notifications(
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  service_id uuid references public.dogsitter_services(id) on delete cascade,
  communication_id uuid references public.service_communications(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists app_notifications_communication_recipient_uidx on public.app_notifications(communication_id,recipient_id);
create index if not exists app_notifications_recipient_idx on public.app_notifications(recipient_id,read_at,created_at desc);
alter table public.app_notifications enable row level security;
drop policy if exists app_notifications_select on public.app_notifications;
create policy app_notifications_select on public.app_notifications for select to authenticated using(recipient_id=auth.uid());
grant select on public.app_notifications to authenticated;

create or replace function public.create_communication_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare r record; emp uuid; actor_name text;
begin
  if new.status <> 'sent' then return new; end if;
  select coalesce(full_name,'Utente') into actor_name from public.profiles where id=new.author_id;
  if new.author_role='dipendente' then
    for r in select id from public.profiles where active=true and role in ('owner','vice_admin') loop
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message)
      values(r.id,new.author_id,new.service_id,new.id,'Nuova comunicazione dal dipendente',actor_name||': '||left(new.message,220)) on conflict(communication_id,recipient_id) do nothing;
    end loop;
  else
    select employee_id into emp from public.dogsitter_services where id=new.service_id;
    if emp is not null then
      insert into public.app_notifications(recipient_id,actor_id,service_id,communication_id,title,message)
      values(emp,new.author_id,new.service_id,new.id,'Nuova comunicazione interna',actor_name||': '||left(new.message,220)) on conflict(communication_id,recipient_id) do nothing;
    end if;
  end if;
  return new;
end$$;
drop trigger if exists service_communications_notify on public.service_communications;
create trigger service_communications_notify after insert on public.service_communications for each row execute function public.create_communication_notifications();

create or replace function public.mark_app_notification_read(p_notification_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 update public.app_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid();
 return found;
end$$;
revoke all on function public.mark_app_notification_read(uuid) from public;
grant execute on function public.mark_app_notification_read(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
