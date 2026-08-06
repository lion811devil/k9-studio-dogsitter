# Release 12.7.2 – Recupero titolare corretto

## Correzioni
- rimosso il modulo JavaScript duplicato che leggeva una configurazione non globale e mostrava “Configura config.js”;
- collegato il pulsante Recupero titolare alla logica già presente in `js/app.js`;
- implementata realmente l’azione `emergency_owner_recovery` nella Edge Function prima del controllo della sessione;
- reimpostazione password, rimozione sospensione e ripristino del profilo Owner;
- confronto del codice segreto a tempo costante;
- supporto alla scadenza facoltativa `OWNER_RECOVERY_EXPIRES_AT`;
- cache PWA aggiornata.

## Installazione
Sostituire `index.html`, `sw.js`, `js/app.js` e `supabase/functions/hyper-handler/index.ts`.
Aggiungere `supabase/config.toml` solo se si distribuisce con Supabase CLI. Dal pannello Supabase verificare nelle impostazioni della funzione che **Verify JWT** sia disattivato, poi eseguire Deploy updates.

## Sicurezza
Dopo il recupero impostare `OWNER_RECOVERY_ENABLED=false` oppure eliminare `OWNER_RECOVERY_SECRET`.
