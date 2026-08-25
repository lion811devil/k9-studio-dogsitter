-- K9 Studio Dogsitter 12.9.37
-- Eliminazione definitiva universale dei documenti.
-- Il file Storage viene eliminato dall'app; questa funzione elimina
-- il record corrispondente dal database in base alla sua origine.

begin;

create or replace function public.delete_document_permanently(
  p_document_id uuid,
  p_source_kind text default 'service'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_role() then
    raise exception 'Permesso negato';
  end if;

  case coalesce(p_source_kind,'service')
    when 'quote' then
      delete from public.dogsitter_quote_document_versions
      where id = p_document_id;

    when 'receipt' then
      delete from public.dogsitter_receipts
      where id = p_document_id;

    else
      delete from public.dogsitter_document_versions
      where id = p_document_id;
  end case;

  if not found then
    raise exception 'Documento non trovato o già eliminato';
  end if;
end;
$$;

revoke all on function public.delete_document_permanently(uuid,text)
  from public, anon, authenticated;

grant execute on function public.delete_document_permanently(uuid,text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
