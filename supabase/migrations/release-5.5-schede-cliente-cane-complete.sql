begin;

-- Dati cliente: referente di emergenza e reperibilità.
alter table public.customers add column if not exists postal_code text;
alter table public.customers add column if not exists emergency_contact_type text;
alter table public.customers add column if not exists emergency_contact_name text;
alter table public.customers add column if not exists emergency_contact_phone text;
alter table public.customers add column if not exists availability text;

-- Identificazione e veterinario del cane.
alter table public.dogs add column if not exists breed_type text;
alter table public.dogs add column if not exists breed_detail text;
alter table public.dogs add column if not exists size text;
alter table public.dogs add column if not exists age_range text;
alter table public.dogs add column if not exists age_detail text;
alter table public.dogs add column if not exists weight_detail text;
alter table public.dogs add column if not exists sex text;
alter table public.dogs add column if not exists sterilized text;
alter table public.dogs add column if not exists microchip_status text;
alter table public.dogs add column if not exists microchip_number text;
alter table public.dogs add column if not exists vet_status text;
alter table public.dogs add column if not exists vet_name text;
alter table public.dogs add column if not exists vet_phone text;

-- Salute e sicurezza.
alter table public.dogs add column if not exists vaccines text;
alter table public.dogs add column if not exists parasites text;
alter table public.dogs add column if not exists illnesses text;
alter table public.dogs add column if not exists illnesses_detail text;
alter table public.dogs add column if not exists allergies text;
alter table public.dogs add column if not exists allergies_detail text;
alter table public.dogs add column if not exists medicines text;
alter table public.dogs add column if not exists medicines_detail text;
alter table public.dogs add column if not exists health_risk text;

-- Alimentazione e routine.
alter table public.dogs add column if not exists food_type text;
alter table public.dogs add column if not exists food_detail text;
alter table public.dogs add column if not exists meals text;
alter table public.dogs add column if not exists meal_times text;
alter table public.dogs add column if not exists treats text;
alter table public.dogs add column if not exists treats_detail text;
alter table public.dogs add column if not exists home_rules text;
alter table public.dogs add column if not exists home_rules_detail text;

-- Comportamento.
alter table public.dogs add column if not exists character text;
alter table public.dogs add column if not exists adults text;
alter table public.dogs add column if not exists children text;
alter table public.dogs add column if not exists dogs_social text;
alter table public.dogs add column if not exists fears text;
alter table public.dogs add column if not exists fears_detail text;
alter table public.dogs add column if not exists bite_history text;
alter table public.dogs add column if not exists bite_history_detail text;
alter table public.dogs add column if not exists resource_guarding text;
alter table public.dogs add column if not exists resource_guarding_detail text;

-- Passeggiata.
alter table public.dogs add column if not exists equipment text;
alter table public.dogs add column if not exists equipment_detail text;
alter table public.dogs add column if not exists dog_triggers text;
alter table public.dogs add column if not exists moving_triggers text;
alter table public.dogs add column if not exists avoid_areas text;
alter table public.dogs add column if not exists avoid_areas_detail text;
alter table public.dogs add column if not exists off_leash text;
alter table public.dogs add column if not exists walk_level text;

notify pgrst, 'reload schema';
commit;
