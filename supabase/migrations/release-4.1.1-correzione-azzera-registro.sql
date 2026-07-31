-- Release 4.1.1 - correzione definitiva azzeramento Registro attività
-- Eseguire una sola volta nel SQL Editor di Supabase.

create or replace function public.clear_audit_log()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_owner = true
      and active = true
  ) then
    raise exception 'Solo il Datore di lavoro può azzerare il Registro attività';
  end if;

  select count(*) into deleted_count from public.audit_log;

  -- TRUNCATE evita eventuali trigger riga-per-riga e svuota realmente il registro.
  truncate table public.audit_log;

  return deleted_count;
end;
$$;

revoke all on function public.clear_audit_log() from public;
grant execute on function public.clear_audit_log() to authenticated;

-- Forza il ricaricamento dello schema API PostgREST.
notify pgrst, 'reload schema';
