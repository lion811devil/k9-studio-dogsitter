K9 Studio Dogsitter - Release 12.7.8

Sostituire esclusivamente:
- index.html
- js/app.js
- sw.js

Correzione verificata:
- rimosso il bottone "Recupero titolare" dalla schermata di accesso;
- rimosso il relativo modulo HTML;
- rimossi eventi e funzioni JavaScript collegati;
- cache PWA aggiornata alla versione 12.7.8.

Dopo il deploy GitHub Pages, chiudere completamente la PWA e riaprirla. Se persiste la vecchia schermata, aprire il sito in Chrome e ricaricare una volta: il nuovo Service Worker elimina le cache precedenti.
