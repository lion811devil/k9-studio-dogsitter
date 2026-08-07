K9 Studio Dogsitter — Release 12.8.2

FIX MIRATO: bottone legacy “Recupero titolare”

Verifica eseguita sull’intera repository sorgente ricevuta:
- il bottone non è presente nell’HTML attuale;
- non esiste alcun handler attivo che lo ricrei;
- la vecchia funzione owner-recovery non è caricata da index.html;
- il recupero password standard “Password dimenticata?” resta attivo;
- la causa compatibile con lo screenshot è una versione legacy servita da cache/PWA/Service Worker.

File da sostituire con questa release:
- index.html
- js/app.js
- reset-cache.html
- sw.js

Dopo il caricamento su GitHub Pages, aprire una sola volta:
  reset-cache.html
La pagina elimina registrazioni Service Worker/cache e riapre index.html con cache-busting 12.8.2.

Non sono richieste modifiche a Supabase o al database.
