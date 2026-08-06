K9 Studio Dogsitter — Release 12.8.0

CAUSA ACCERTATA
Nella repository il bottone "Recupero titolare" non è presente nell'index.html.
La schermata visualizzata sul telefono proviene da una vecchia copia conservata dal Service Worker/PWA.

FILE DA SOSTITUIRE
- index.html
- css/styles.css
- js/app.js
- sw.js

FILE DA AGGIUNGERE
- reset-cache.html

PROCEDURA OBBLIGATORIA DOPO IL DEPLOY
1. Attendere il completamento di GitHub Pages.
2. Aprire in Chrome:
   https://lion811devil.github.io/k9-studio-dogsitter/reset-cache.html
3. La pagina elimina Service Worker e cache, poi riapre automaticamente l'app aggiornata.
4. Solo dopo la verifica, riaprire l'icona PWA installata.

Il bottone "Password dimenticata?" resta disponibile.
