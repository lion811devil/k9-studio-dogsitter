# Release 12.6.1 – Recupero password PWA

## File da sostituire
- index.html
- js/app.js
- sw.js

## Funzioni
- Intercetta il link Supabase di tipo `recovery`.
- Mostra la schermata “Imposta nuova password”.
- Aggiorna la password tramite Supabase Auth.
- Aggiunge “Password dimenticata?” nella schermata di accesso.
- Non richiede SQL né aggiornamenti della Edge Function.
