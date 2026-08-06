# K9 Studio Dogsitter — Release 12.7.4

## Modifica eseguita

- Rimossa dalla schermata di accesso la voce **Recupero titolare**.
- Rimosso il relativo modulo di recupero di emergenza.
- Rimossa dal frontend la chiamata pubblica alla procedura di recupero titolare.
- Rimossa dalla Edge Function `hyper-handler` l'azione `emergency_owner_recovery`.
- Mantenuto il normale comando **Password dimenticata?**.
- Aggiornata la cache PWA alla versione 12.7.4 per forzare il caricamento dei file corretti.

## File da sostituire

- `index.html`
- `js/app.js`
- `sw.js`
- `supabase/functions/hyper-handler/index.ts`

## Operazione Supabase necessaria

Dopo avere sostituito il file della funzione, ridistribuire la Edge Function `hyper-handler`.
Per una chiusura completa della procedura precedente, in Supabase eliminare o disattivare anche i secret:

- `OWNER_RECOVERY_ENABLED`
- `OWNER_RECOVERY_SECRET`
- `OWNER_RECOVERY_EXPIRES_AT`

I secret non sono più utilizzati dalla Release 12.7.4.
