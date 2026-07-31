begin;
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 full_name text not null default '',
 role text not null default 'dipendente' check(role in('owner','vice_admin','dipendente')),
 is_owner boolean not null default false,
 active boolean not null default true,
 employee_code text unique,
 qualification text,
 photo_url text,
 pass_issued_at date default current_date,
 pass_expires_at date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists one_owner_only on public.profiles((is_owner)) where is_owner;

create table if not exists public.customers(
 id uuid primary key default gen_random_uuid(),
 first_name text not null,
 last_name text not null,
 phone text,
 email text,
 address text,
 city text,
 emergency_contact text,
 operational_notes text,
 assigned_employee_id uuid references public.profiles(id),
 status text not null default 'attivo' check(status in('attivo','sospeso','archiviato')),
 created_by uuid references public.profiles(id) default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.dogs(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id) on delete cascade,
 name text not null,
 breed text,
 microchip text,
 feeding_notes text,
 medical_notes text,
 behavior_notes text,
 routine_notes text,
 active boolean not null default true,
 created_by uuid references public.profiles(id) default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.dogsitter_services(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id),
 dog_id uuid not null references public.dogs(id),
 employee_id uuid not null references public.profiles(id),
 service_type text not null,
 service_date date not null,
 service_time time not null,
 planned_duration_minutes integer not null default 30 check(planned_duration_minutes>0),
 daily_visits integer not null default 1 check(daily_visits>0),
 customer_amount numeric(10,2) not null default 0 check(customer_amount>=0),
 employee_compensation numeric(10,2) not null default 0 check(employee_compensation>=0 and employee_compensation<=customer_amount),
 customer_payment_status text not null default 'da_incassare' check(customer_payment_status in('da_incassare','incassato')),
 employee_payment_status text not null default 'da_liquidare' check(employee_payment_status in('da_liquidare','liquidato')),
 customer_paid_at timestamptz,
 employee_paid_at timestamptz,
 status text not null default 'programmato' check(status in('programmato','in_corso','da_verificare','chiuso','annullato')),
 operational_notes text,
 report_text text,
 incident_notes text,
 started_at timestamptz,
 completed_at timestamptz,
 approved_at timestamptz,
 approved_by uuid references public.profiles(id),
 created_by uuid references public.profiles(id) default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.dogsitter_documents(
 id uuid primary key default gen_random_uuid(),
 document_number bigint generated always as identity unique,
 service_id uuid unique not null references public.dogsitter_services(id) on delete cascade,
 customer_id uuid not null references public.customers(id),
 dog_id uuid not null references public.dogs(id),
 file_name text not null,
 storage_path text not null unique,
 status text not null default 'generazione' check(status in('generazione','approvato','inviato')),
 sent_channel text,
 sent_at timestamptz,
 sent_by uuid references public.profiles(id),
 title text not null default 'Rapporto servizio',
 created_by uuid references public.profiles(id) default auth.uid(),
 created_at timestamptz not null default now()
);

create table if not exists public.audit_log(
 id bigint generated always as identity primary key,
 user_id uuid,
 action text not null,
 table_name text,
 record_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists idx_customers_assigned on public.customers(assigned_employee_id);
create index if not exists idx_dogs_customer on public.dogs(customer_id);
create index if not exists idx_services_employee_date on public.dogsitter_services(employee_id,service_date);
create index if not exists idx_services_status on public.dogsitter_services(status);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
drop trigger if exists profiles_touch on public.profiles; create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists customers_touch on public.customers; create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists dogs_touch on public.dogs; create trigger dogs_touch before update on public.dogs for each row execute function public.touch_updated_at();
drop trigger if exists services_touch on public.dogsitter_services; create trigger services_touch before update on public.dogsitter_services for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing; return new; end$$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_profile() returns public.profiles language sql stable security definer set search_path=public as $$select p from public.profiles p where p.id=auth.uid()$$;
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$select coalesce((select role from public.profiles where id=auth.uid() and active),'')$$;
create or replace function public.is_admin_role() returns boolean language sql stable security definer set search_path=public as $$select public.current_role() in('owner','vice_admin')$$;
create or replace function public.is_owner_role() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and active and is_owner)$$;

create or replace function public.validate_service() returns trigger language plpgsql as $$
declare c public.customers; d public.dogs; e public.profiles;
begin
 select * into c from public.customers where id=new.customer_id;
 select * into d from public.dogs where id=new.dog_id;
 select * into e from public.profiles where id=new.employee_id;
 if c.id is null or d.id is null or e.id is null then raise exception 'Cliente, cane o dipendente non valido'; end if;
 if d.customer_id<>c.id then raise exception 'Il cane non appartiene al cliente selezionato'; end if;
 if e.role<>'dipendente' or not e.active then raise exception 'Il collaboratore selezionato non è un dipendente attivo'; end if;
 if c.assigned_employee_id is distinct from e.id then raise exception 'Il servizio deve essere assegnato al dipendente associato al cliente'; end if;
 return new;
end$$;
drop trigger if exists services_validate on public.dogsitter_services; create trigger services_validate before insert or update of customer_id,dog_id,employee_id on public.dogsitter_services for each row execute function public.validate_service();

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.audit_log(user_id,action,table_name,record_id,details) values(auth.uid(),tg_op, tg_table_name, coalesce(new.id,old.id)::text, jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new))); return coalesce(new,old); end$$;
drop trigger if exists customers_audit on public.customers; create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.audit_row();
drop trigger if exists dogs_audit on public.dogs; create trigger dogs_audit after insert or update or delete on public.dogs for each row execute function public.audit_row();
drop trigger if exists services_audit on public.dogsitter_services; create trigger services_audit after insert or update or delete on public.dogsitter_services for each row execute function public.audit_row();
drop trigger if exists profiles_audit on public.profiles; create trigger profiles_audit after update on public.profiles for each row execute function public.audit_row();

create or replace function public.employee_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
 if public.current_role()<>'dipendente' then raise exception 'Permesso negato'; end if;
 select jsonb_build_object(
 'customers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'first_name',c.first_name,'last_name',c.last_name,'phone',c.phone,'address',c.address,'city',c.city,'emergency_contact',c.emergency_contact,'operational_notes',c.operational_notes,'status',c.status)) from public.customers c where c.assigned_employee_id=auth.uid() and c.status='attivo'),'[]'::jsonb),
 'dogs',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'customer_id',d.customer_id,'name',d.name,'breed',d.breed,'feeding_notes',d.feeding_notes,'medical_notes',d.medical_notes,'behavior_notes',d.behavior_notes,'routine_notes',d.routine_notes,'active',d.active)) from public.dogs d join public.customers c on c.id=d.customer_id where c.assigned_employee_id=auth.uid() and d.active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'customer_id',s.customer_id,'dog_id',s.dog_id,'service_type',s.service_type,'service_date',s.service_date,'service_time',s.service_time,'planned_duration_minutes',s.planned_duration_minutes,'daily_visits',s.daily_visits,'employee_compensation',s.employee_compensation,'employee_payment_status',s.employee_payment_status,'status',s.status,'operational_notes',s.operational_notes,'report_text',s.report_text,'incident_notes',s.incident_notes,'started_at',s.started_at,'completed_at',s.completed_at)) from public.dogsitter_services s where s.employee_id=auth.uid()),'[]'::jsonb)
 ) into r; return r;
end$$;

create or replace function public.start_my_service(p_service_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if public.current_role()<>'dipendente' then raise exception 'Permesso negato'; end if;
 update public.dogsitter_services set status='in_corso',started_at=now() where id=p_service_id and employee_id=auth.uid() and status='programmato';
 if not found then raise exception 'Servizio non avviabile'; end if; end$$;

create or replace function public.complete_my_service(p_service_id uuid,p_report_text text,p_incident_notes text default null) returns void language plpgsql security definer set search_path=public as $$
begin if public.current_role()<>'dipendente' then raise exception 'Permesso negato'; end if; if nullif(trim(p_report_text),'') is null then raise exception 'Rapporto obbligatorio'; end if;
 update public.dogsitter_services set status='da_verificare',report_text=p_report_text,incident_notes=nullif(trim(p_incident_notes),''),completed_at=now() where id=p_service_id and employee_id=auth.uid() and status='in_corso';
 if not found then raise exception 'Servizio non terminabile'; end if; end$$;

create or replace function public.approve_service(p_service_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.dogsitter_services; c public.customers; d public.dogs; e public.profiles; a public.profiles; doc public.dogsitter_documents; path text;
begin
 if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
 select * into s from public.dogsitter_services where id=p_service_id and status='da_verificare' for update;
 if not found then raise exception 'Servizio non verificabile'; end if;
 select * into c from public.customers where id=s.customer_id; select * into d from public.dogs where id=s.dog_id; select * into e from public.profiles where id=s.employee_id; select * into a from public.profiles where id=auth.uid();
 path:=to_char(current_date,'YYYY/MM')||'/'||s.id::text||'/rapporto.pdf';
 insert into public.dogsitter_documents(service_id,customer_id,dog_id,file_name,storage_path,status,title) values(s.id,s.customer_id,s.dog_id,'rapporto.pdf',path,'generazione','Rapporto servizio') on conflict(service_id) do update set storage_path=excluded.storage_path,status='generazione' returning * into doc;
 return jsonb_build_object('document_id',doc.id,'document_number',doc.document_number,'storage_path',doc.storage_path,'customer_name',c.first_name||' '||c.last_name,'dog_name',d.name,'employee_name',e.full_name,'approver_name',a.full_name,'service_date',s.service_date,'service_time',s.service_time,'daily_visits',s.daily_visits,'service_type',s.service_type,'report_text',s.report_text,'incident_notes',s.incident_notes,'started_at',s.started_at,'completed_at',s.completed_at,'approved_at',now());
end$$;

create or replace function public.finalize_document(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$declare d public.dogsitter_documents;begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; select * into d from public.dogsitter_documents where id=p_document_id and status='generazione' for update; if not found then raise exception 'Documento non finalizzabile'; end if; update public.dogsitter_services set status='chiuso',approved_at=now(),approved_by=auth.uid() where id=d.service_id and status='da_verificare'; if not found then raise exception 'Servizio non finalizzabile'; end if; update public.dogsitter_documents set status='approvato' where id=d.id; end$$;
create or replace function public.set_customer_payment(p_service_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; if p_status not in('da_incassare','incassato') then raise exception 'Stato non valido'; end if; update public.dogsitter_services set customer_payment_status=p_status,customer_paid_at=case when p_status='incassato' then now() else null end where id=p_service_id; end$$;
create or replace function public.set_employee_payment(p_service_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; if p_status not in('da_liquidare','liquidato') then raise exception 'Stato non valido'; end if; update public.dogsitter_services set employee_payment_status=p_status,employee_paid_at=case when p_status='liquidato' then now() else null end where id=p_service_id; end$$;
create or replace function public.admin_update_profile(p_user_id uuid,p_full_name text,p_employee_code text,p_qualification text,p_pass_expires_at date,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$declare target public.profiles;begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; select * into target from public.profiles where id=p_user_id; if target.is_owner and not public.is_owner_role() then raise exception 'Il titolare è protetto'; end if; if p_role='owner' and not target.is_owner then raise exception 'Ruolo owner non assegnabile'; end if; if p_role='vice_admin' and not public.is_owner_role() then raise exception 'Solo il titolare può nominare un vice'; end if; update public.profiles set full_name=p_full_name,employee_code=p_employee_code,qualification=p_qualification,pass_expires_at=p_pass_expires_at,role=p_role,active=p_active where id=p_user_id; end$$;
create or replace function public.mark_document_sent(p_document_id uuid,p_channel text) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; if nullif(trim(p_channel),'') is null then raise exception 'Canale obbligatorio'; end if; update public.dogsitter_documents set status='inviato',sent_channel=p_channel,sent_at=now(),sent_by=auth.uid() where id=p_document_id and status in('approvato','inviato'); if not found then raise exception 'Documento non inviabile'; end if; end$$;
create or replace function public.get_document_path(p_document_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare d public.dogsitter_documents;begin if not public.is_admin_role() then raise exception 'Permesso negato'; end if; select * into d from public.dogsitter_documents where id=p_document_id and status in('approvato','inviato'); if not found then raise exception 'Documento non disponibile'; end if; return jsonb_build_object('path',d.storage_path); end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('service-documents','service-documents',false,10485760,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

alter table public.profiles enable row level security; alter table public.customers enable row level security; alter table public.dogs enable row level security; alter table public.dogsitter_services enable row level security; alter table public.dogsitter_documents enable row level security; alter table public.audit_log enable row level security;
do $$declare p record;begin for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in('profiles','customers','dogs','dogsitter_services','dogsitter_documents','audit_log') loop execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename); end loop; end$$;
create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin_role());
create policy customers_admin on public.customers for all to authenticated using(public.is_admin_role()) with check(public.is_admin_role());
create policy dogs_admin on public.dogs for all to authenticated using(public.is_admin_role()) with check(public.is_admin_role());
create policy services_admin on public.dogsitter_services for all to authenticated using(public.is_admin_role()) with check(public.is_admin_role());
create policy documents_admin on public.dogsitter_documents for select to authenticated using(public.is_admin_role());
create policy audit_admin on public.audit_log for select to authenticated using(public.is_admin_role());

drop policy if exists service_documents_insert on storage.objects; drop policy if exists service_documents_read on storage.objects; drop policy if exists service_documents_update on storage.objects;
create policy service_documents_insert on storage.objects for insert to authenticated with check(bucket_id='service-documents' and public.is_admin_role());
create policy service_documents_read on storage.objects for select to authenticated using(bucket_id='service-documents' and public.is_admin_role());
create policy service_documents_update on storage.objects for update to authenticated using(bucket_id='service-documents' and public.is_admin_role()) with check(bucket_id='service-documents' and public.is_admin_role());

revoke all on all functions in schema public from public;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.customers,public.dogs,public.dogsitter_services to authenticated;
grant select on public.profiles,public.dogsitter_documents,public.audit_log to authenticated;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin_role() to authenticated;
grant execute on function public.is_owner_role() to authenticated;
grant execute on function public.employee_workspace() to authenticated;
grant execute on function public.start_my_service(uuid) to authenticated;
grant execute on function public.complete_my_service(uuid,text,text) to authenticated;
grant execute on function public.approve_service(uuid) to authenticated;
grant execute on function public.finalize_document(uuid) to authenticated;
grant execute on function public.set_customer_payment(uuid,text) to authenticated;
grant execute on function public.set_employee_payment(uuid,text) to authenticated;
grant execute on function public.admin_update_profile(uuid,text,text,text,date,text,boolean) to authenticated;
grant execute on function public.mark_document_sent(uuid,text) to authenticated;
grant execute on function public.get_document_path(uuid) to authenticated;
commit;

-- DOPO aver creato manualmente il primo utente in Authentication > Users:
-- update public.profiles set role='owner',is_owner=true,active=true,full_name='Giovanni Napoletano' where email='TUA_EMAIL';
