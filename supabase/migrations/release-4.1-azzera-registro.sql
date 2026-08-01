-- Migrazione consolidata: azzeramento definitivo Registro attività
-- Conservata per riproducibilità della repository.
-- Non rieseguire se la funzione clear_audit_log() è già operativa.

begin;

drop function if exists public.clear_audit_log();

create function public.clear_audit_log()
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
  truncate table public.audit_log;
  return deleted_count;
end;
$$;

revoke all on function public.clear_audit_log() from public;
grant execute on function public.clear_audit_log() to authenticated;
notify pgrst, 'reload schema';

commit;
