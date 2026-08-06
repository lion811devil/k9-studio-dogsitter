# Release 12.6.0 — Reimpostazione password utenti

## File da sostituire su GitHub
- `index.html`
- `sw.js`
- `js/app.js`

## Edge Function da aggiornare
- `supabase/functions/hyper-handler/index.ts`

Dopo la sostituzione, distribuire nuovamente la Edge Function `hyper-handler` da Supabase.

## Funzionamento
Nella sezione **Utenti**, aprire **Seleziona e gestisci** e premere **Imposta nuova password**.

Sono disponibili:
- inserimento e conferma della nuova password;
- generazione automatica di una password sicura di 14 caratteri;
- mostra/nascondi password;
- conferma prima dell'aggiornamento;
- aggiornamento immediato in Supabase Authentication;
- registrazione nel Log senza memorizzare la password;
- notifica all'utente alla successiva apertura dell'app.

## Permessi
- il Titolare può reimpostare la password di Vice e Dipendenti;
- il Vice può reimpostare soltanto le password dei Dipendenti;
- la password del Titolare resta protetta;
- i Dipendenti non possono modificare password di altri account.

Non è richiesta alcuna migrazione SQL.
