# Release 12.6.2 – Recupero password PWA corretto

Correzione mirata del recupero password Supabase.

## File da sostituire
- `index.html`
- `sw.js`
- `js/app.js`
- `css/styles.css`

## Funzionamento
- Mostra sempre il pulsante **Password dimenticata?** nella schermata di accesso.
- Invia l'email di recupero tramite Supabase Auth.
- Gestisce sia i link con token nel frammento URL sia i link con `token_hash`.
- Apre la schermata **Imposta nuova password**.
- Aggiorna la password e riporta alla schermata di accesso.

Non richiede SQL né modifiche alla Edge Function.
