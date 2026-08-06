# Release 12.7.3 — Recupero password e controllo titolare

## File da sostituire
- index.html
- sw.js
- js/app.js
- supabase/functions/hyper-handler/index.ts

## File da aggiungere
- supabase/config.toml (utile per deploy CLI; dal pannello disattivare Verify JWT per hyper-handler)

## Correzioni
- Recupero password Supabase gestito con il client ufficiale supabase-js.
- Gestione degli eventi PASSWORD_RECOVERY, callback implicito e callback PKCE con `code`.
- Schermata di nuova password aperta prima del normale ripristino sessione dell'app.
- Messaggi leggibili per link scaduto e limite email.
- Recupero titolare di emergenza eseguito prima della verifica della sessione.
- Conservata la correzione 12.4.2 per il controllo dei collegamenti prima dell'eliminazione utente.

## Sicurezza
Dopo aver recuperato l'accesso, impostare `OWNER_RECOVERY_ENABLED=false` oppure eliminare `OWNER_RECOVERY_SECRET`.
