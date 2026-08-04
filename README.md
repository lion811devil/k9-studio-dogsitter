# K9 Studio Dogsitter — Release 8.1

PWA gestionale pubblicata tramite GitHub Pages e collegata a Supabase.

## Struttura principale

- `index.html`, `css/`, `js/`, `assets/`: frontend PWA.
- `supabase/functions/hyper-handler/`: Edge Function attuale per creazione account e reset password amministrato.
- `supabase/migrations/`: storico delle migrazioni già applicate al progetto.

## Aggiornamento di una repository esistente

1. Sostituire soltanto i file forniti nella release.
2. Quando la release include una nuova migrazione, copiarla in `supabase/migrations/` ed eseguirla una sola volta in **Supabase → SQL Editor**.
3. Quando viene modificata `hyper-handler`, aggiornare la stessa Edge Function dal Dashboard Supabase e usare **Deploy updates**.
4. Chiudere completamente la PWA e riaprirla per caricare il nuovo Service Worker.

## Configurazione frontend

`config.js` deve contenere esclusivamente:

- URL pubblico del progetto Supabase;
- publishable/anon key pubblica;
- nome applicazione e organizzazione.

Non inserire mai la Service Role Key nel frontend o nella repository.

## Edge Function

La funzione attiva è:

`supabase/functions/hyper-handler`

Usa i secret standard gestiti da Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` o publishable key prevista dal progetto
- `SUPABASE_SERVICE_ROLE_KEY`

## Installazione database

Questa repository conserva lo storico incrementale delle migrazioni del progetto operativo. Non contiene ancora uno schema consolidato destinato alla ricostruzione automatica di un nuovo progetto Supabase vuoto.

Per un ripristino completo occorrono:

- backup del database Supabase attuale;
- backup dei bucket Storage;
- migrazioni della repository;
- secret e configurazione della Edge Function.

Non eseguire indiscriminatamente tutte le vecchie migrazioni su un database esistente. Applicare soltanto la migrazione indicata dalla release installata.

## Ruoli

- `owner`: controllo completo.
- `vice_admin`: gestione amministrativa prevista dall'app.
- `dipendente`: accesso limitato ai clienti, cani, servizi, compensi, pass e comunicazioni assegnati.

Il cliente non accede all'app e riceve i documenti manualmente.

## Documenti

L'app distingue e archivia separatamente:

- PDF preventivo;
- PDF cliente;
- PDF interno;
- PDF pass formato tessera.

L'invio non è automatico: apertura, download e condivisione sono azioni manuali dell'amministrazione.

## Collaudo minimo dopo ogni release

1. Login owner, vice e dipendente.
2. Creazione cliente e cane.
3. Creazione e duplicazione servizio.
4. Creazione preventivo, periodi multipli, acconto e conversione in servizio.
5. Generazione PDF e verifica archivio Documenti.
6. Comunicazioni e notifiche tra dipendente, owner e vice.
7. Foto e PDF del pass.
8. Cestino e registro attività.
9. Impostazioni, logo e allegati PDF.
