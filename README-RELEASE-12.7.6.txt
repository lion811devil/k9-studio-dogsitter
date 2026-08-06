K9 STUDIO DOGSITTER — RELEASE 12.7.6
RIMOZIONE DEFINITIVA «RECUPERO TITOLARE»

Sostituire nella repository i file mantenendo le stesse cartelle:
- index.html
- sw.js
- js/app.js
- js/owner-recovery.js
- supabase/functions/hyper-handler/index.ts

Dopo il caricamento su GitHub:
1. Attendere il completamento del deploy GitHub Pages.
2. Ridistribuire la Edge Function hyper-handler su Supabase.
3. Chiudere completamente la PWA.
4. Aprire il sito in Chrome e ricaricare.
5. Se appare ancora la vecchia pagina, cancellare i dati del sito o reinstallare la PWA.

La funzione «Password dimenticata?» rimane attiva.
