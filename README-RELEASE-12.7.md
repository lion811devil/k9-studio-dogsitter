# Release 12.7 – Recupero di emergenza del Titolare

Questa release permette di ripristinare l’accesso dell’account Titolare anche quando non è disponibile alcuna sessione amministrativa e il recupero email non è utilizzabile.

## Sicurezza

La procedura è disabilitata per impostazione predefinita. Funziona solo se nella Edge Function sono configurati:

- `OWNER_RECOVERY_ENABLED=true`
- `OWNER_RECOVERY_SECRET=<codice casuale di almeno 24 caratteri>`
- facoltativo: `OWNER_RECOVERY_EXPIRES_AT=2026-08-06T18:00:00Z`

Il codice non deve essere inserito in GitHub, `config.js` o altri file pubblici.

## Procedura

1. Pubblicare i file frontend della release.
2. Sostituire e distribuire `supabase/functions/hyper-handler/index.ts`.
3. Nelle impostazioni della Edge Function disattivare la verifica JWT del gateway per `hyper-handler`. Le altre azioni restano protette perché la funzione verifica internamente il token utente; il recupero titolare richiede il codice server.
4. Configurare i secret indicati sopra.
5. Aprire la pagina di accesso e premere **Recupero titolare**.
6. Inserire email del Titolare, codice di recupero e nuova password.
7. Accedere con la nuova password.
8. Subito dopo, impostare `OWNER_RECOVERY_ENABLED=false` oppure eliminare `OWNER_RECOVERY_SECRET`.

## Effetti

La procedura aggiorna la password in Supabase Auth, rimuove un eventuale blocco dell’account e ripristina nel profilo i valori `active=true`, `role=owner`, `is_owner=true`. Non modifica clienti, servizi, preventivi, documenti o altri account.
