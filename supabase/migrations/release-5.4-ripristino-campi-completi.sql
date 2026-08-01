begin;

-- Campi completi del servizio recuperati dal modulo originario.
alter table public.dogsitter_services add column if not exists frequency text;
alter table public.dogsitter_services add column if not exists end_date date;
alter table public.dogsitter_services add column if not exists time_slot_1 text;
alter table public.dogsitter_services add column if not exists time_slot_2 text;
alter table public.dogsitter_services add column if not exists time_slot_3 text;
alter table public.dogsitter_services add column if not exists time_slot_4 text;
alter table public.dogsitter_services add column if not exists unit_rate numeric(12,2) default 0;
alter table public.dogsitter_services add column if not exists discount_rate numeric(5,2) default 0;
alter table public.dogsitter_services add column if not exists payment_method text;
alter table public.dogsitter_services add column if not exists payment_method_other text;
alter table public.dogsitter_services add column if not exists client_status text;
alter table public.dogsitter_services add column if not exists keys_status text;
alter table public.dogsitter_services add column if not exists keys_mode text;
alter table public.dogsitter_services add column if not exists customer_updates text;
alter table public.dogsitter_services add column if not exists auth_vet text;
alter table public.dogsitter_services add column if not exists auth_transport text;

-- Gli stessi dati organizzativi nel preventivo.
alter table public.dogsitter_quotes add column if not exists frequency text;
alter table public.dogsitter_quotes add column if not exists daily_visits integer default 1;
alter table public.dogsitter_quotes add column if not exists start_date date;
alter table public.dogsitter_quotes add column if not exists end_date date;
alter table public.dogsitter_quotes add column if not exists planned_duration_minutes integer default 30;
alter table public.dogsitter_quotes add column if not exists time_slot_1 text;
alter table public.dogsitter_quotes add column if not exists time_slot_2 text;
alter table public.dogsitter_quotes add column if not exists time_slot_3 text;
alter table public.dogsitter_quotes add column if not exists time_slot_4 text;
alter table public.dogsitter_quotes add column if not exists subtotal_amount numeric(12,2) default 0;
alter table public.dogsitter_quotes add column if not exists discount_rate numeric(5,2) default 0;
alter table public.dogsitter_quotes add column if not exists client_status text;
alter table public.dogsitter_quotes add column if not exists payment_status text;
alter table public.dogsitter_quotes add column if not exists keys_status text;
alter table public.dogsitter_quotes add column if not exists keys_mode text;
alter table public.dogsitter_quotes add column if not exists customer_updates text;
alter table public.dogsitter_quotes add column if not exists auth_vet text;
alter table public.dogsitter_quotes add column if not exists auth_transport text;

-- Il PDF preventivo riceve anche i nuovi campi.
create or replace function public.create_quote_document_version(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.dogsitter_quotes%rowtype; c public.customers%rowtype; d public.dogs%rowtype; v_version integer; v_progressive bigint; v_base text; v_file text; v_path text; v_row public.dogsitter_quote_document_versions%rowtype; v_items jsonb;
begin
 if not public.is_admin_role() then raise exception 'Permesso negato'; end if;
 select * into q from public.dogsitter_quotes where id=p_quote_id and deleted_at is null; if not found then raise exception 'Preventivo non trovato'; end if;
 select * into c from public.customers where id=q.customer_id; if q.dog_id is not null then select * into d from public.dogs where id=q.dog_id; end if;
 select coalesce(max(version),0)+1,coalesce(min(progressive),nextval('public.k9_quote_progressive_seq')) into v_version,v_progressive from public.dogsitter_quote_document_versions where quote_id=p_quote_id;
 v_base:=concat_ws('_','Preventivo',public.k9_safe_file_part(c.first_name),public.k9_safe_file_part(c.last_name),nullif(public.k9_safe_file_part(d.name),''),to_char(q.quote_date,'DD-MM-YYYY'),lpad(v_progressive::text,3,'0')); v_file:=v_base||'.pdf'; v_path:=concat('preventivi/',extract(year from q.quote_date)::int,'/',q.customer_id,'/',q.id,'/v',v_version,'/',v_file);
 update public.dogsitter_quote_document_versions set is_active=false where quote_id=p_quote_id and is_active=true;
 insert into public.dogsitter_quote_document_versions(quote_id,customer_id,dog_id,progressive,version,is_active,file_name,storage_path,status,customer_name,dog_name,quote_date,generated_by) values(q.id,q.customer_id,q.dog_id,v_progressive,v_version,true,v_file,v_path,'generating',trim(c.first_name||' '||c.last_name),d.name,q.quote_date,auth.uid()) returning * into v_row;
 select coalesce(jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'position',i.position) order by i.position),'[]'::jsonb) into v_items from public.dogsitter_quote_items i where i.quote_id=q.id;
 return to_jsonb(v_row)||jsonb_build_object('document_type','quote','items',v_items,'valid_until',q.valid_until,'payment_terms',q.payment_terms,'notes',q.notes,'total_amount',q.total_amount,'subtotal_amount',q.subtotal_amount,'discount_rate',q.discount_rate,'frequency',q.frequency,'daily_visits',q.daily_visits,'start_date',q.start_date,'end_date',q.end_date,'planned_duration_minutes',q.planned_duration_minutes,'time_slot_1',q.time_slot_1,'time_slot_2',q.time_slot_2,'time_slot_3',q.time_slot_3,'time_slot_4',q.time_slot_4,'client_status',q.client_status,'payment_status',q.payment_status,'keys_status',q.keys_status,'keys_mode',q.keys_mode,'customer_updates',q.customer_updates,'auth_vet',q.auth_vet,'auth_transport',q.auth_transport,'customer_phone',c.phone,'customer_email',c.email,'customer_address',concat_ws(', ',nullif(c.address,''),nullif(c.city,'')));
end$$;
grant execute on function public.create_quote_document_version(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
