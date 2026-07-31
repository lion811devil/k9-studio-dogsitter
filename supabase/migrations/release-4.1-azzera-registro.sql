-- Release 4.1 - azzeramento definitivo del Registro attività
-- Eseguire una sola volta nel SQL Editor di Supabase.

create or replace function public.clear_audit_log()
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  delete from public.audit_log;
end;
$$;

revoke all on function public.clear_audit_log() from public;
grant execute on function public.clear_audit_log() to authenticated;
