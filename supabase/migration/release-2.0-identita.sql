begin;

create table if not exists public.app_settings(
 id integer primary key default 1 check(id=1),
 organization_name text not null default 'K9 Napoletano Academy',
 app_name text not null default 'K9 Studio Dogsitter',
 subtitle text,
 description text,
 address text,
 postal_code text,
 city text,
 province text,
 country text not null default 'Italia',
 phone text,
 mobile text,
 email text,
 website text,
 vat_number text,
 fiscal_code text,
 iban text,
 social_text text,
 footer_text text,
 legal_text text,
 primary_color text not null default '#0f5f53',
 secondary_color text not null default '#153e75',
 header_color text not null default '#ffffff',
 card_color text not null default '#ffffff',
 button_color text not null default '#0f5f53',
 logo_url text,
 logo_size integer not null default 48 check(logo_size between 28 and 160),
 logo_position text not null default 'sinistra' check(logo_position in('sinistra','centro','destra')),
 show_logo_pdf boolean not null default true,
 show_header_pdf boolean not null default true,
 show_footer_pdf boolean not null default true,
 show_fiscal_data_pdf boolean not null default true,
 show_qr_pdf boolean not null default false,
 show_photos_pdf boolean not null default false,
 show_signatures_pdf boolean not null default false,
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now()
);

insert into public.app_settings(id,organization_name,app_name)
values(1,'K9 Napoletano Academy','K9 Studio Dogsitter')
on conflict(id) do nothing;

create or replace function public.touch_app_settings() returns trigger
language plpgsql as $$
begin
 new.updated_at=now();
 new.updated_by=auth.uid();
 return new;
end$$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
for each row execute function public.touch_app_settings();

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using(true);
create policy app_settings_write on public.app_settings for update to authenticated
using(public.is_admin_role()) with check(public.is_admin_role());

grant select,update on public.app_settings to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('app-assets','app-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=5242880,
allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists app_assets_read on storage.objects;
drop policy if exists app_assets_insert on storage.objects;
drop policy if exists app_assets_update on storage.objects;
drop policy if exists app_assets_delete on storage.objects;
create policy app_assets_read on storage.objects for select using(bucket_id='app-assets');
create policy app_assets_insert on storage.objects for insert to authenticated
with check(bucket_id='app-assets' and public.is_admin_role());
create policy app_assets_update on storage.objects for update to authenticated
using(bucket_id='app-assets' and public.is_admin_role())
with check(bucket_id='app-assets' and public.is_admin_role());
create policy app_assets_delete on storage.objects for delete to authenticated
using(bucket_id='app-assets' and public.is_admin_role());

commit;
