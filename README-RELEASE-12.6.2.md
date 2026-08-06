# K9 Studio Dogsitter — Release 12.6.2

## Correzione recupero password amministratore

- Mantiene i parametri Supabase anche quando il collegamento passa dalla pagina `404.html`.
- Accetta i token di recupero sia nel frammento URL sia nella query string.
- Aggiunge un indicatore esplicito `password-recovery=1` all’URL di ritorno.
- Mostra un errore chiaro quando il collegamento è scaduto o privo di sessione.
- Aggiorna cache e versioni delle risorse per evitare che la PWA continui a usare il JavaScript precedente.

## File da sostituire

- `404.html`
- `index.html`
- `js/app.js`
- `sw.js`

Dopo il caricamento su GitHub Pages, chiudere completamente la PWA o il browser e riaprire il sito prima di richiedere una nuova email di recupero.
