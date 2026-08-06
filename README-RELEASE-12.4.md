# Release 12.4 — Gestione sicura degli account

## File da sostituire su GitHub

- `index.html`
- `sw.js`
- `js/app.js`
- `supabase/functions/hyper-handler/index.ts`

## Supabase Edge Function

Dopo la sostituzione su GitHub, aprire:

`Supabase → Edge Functions → hyper-handler → Code`

Sostituire `index.ts` e premere **Deploy updates**.

Non è necessario eseguire SQL.

## Funzionamento

- **Disattiva**: impedisce l’accesso e conserva lo storico.
- **Riattiva**: ripristina l’accesso.
- **Elimina definitivamente**: disponibile solo al Datore di lavoro, solo per account già disattivati e senza clienti, servizi o comunicazioni operative collegate.
- Il titolare non può essere eliminato.
- La conferma definitiva richiede la digitazione esatta di `ELIMINA`.
