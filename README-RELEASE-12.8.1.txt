K9 STUDIO DOGSITTER — RELEASE 12.8.1
BONIFICA DEFINITIVA "RECUPERO TITOLARE"

FILE DA SOSTITUIRE:
- index.html
- js/app.js
- sw.js

Dopo il deploy GitHub Pages aprire da Chrome:
https://lion811devil.github.io/k9-studio-dogsitter/?v=12.8.1

La release:
- non contiene il bottone Recupero titolare;
- rimuove eventuali elementi legacy dal DOM;
- disinstalla tutti i Service Worker registrati;
- elimina tutte le cache PWA;
- impedisce al vecchio Service Worker di riproporre pagine obsolete.
