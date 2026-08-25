K9 STUDIO DOGSITTER — RELEASE 12.9.35

Consolidamento generale:
- Dashboard e calendario escludono i servizi chiusi/annullati dalle attività operative.
- Margine maturato separato dai flussi ancora da incassare/da liquidare.
- Conteggio documenti basato sui PDF validi e attivi.
- Documento cliente, dipendente e interno mantenuti distinti.
- Eliminato il vecchio flusso duplicato "PDF cliente + PDF interno".
- Archivio "Scarica tutti e 3" produce un unico ZIP con tre PDF distinti.
- Saldo cliente visibile e registrabile direttamente dal servizio.
- Se tutti i periodi sono completati: "Registra saldo e chiudi".
- Chiusura servizio esplicita e separata dalla ricevuta.
- Dipendente: dati amministrativi cliente rimossi a monte da employee_workspace().
- Modali mobile: barra Salva/Annulla sempre raggiungibile.
- Navigazione mobile migliorata.
- Service Worker con cache della shell applicativa.

IMPORTANTE:
Eseguire una sola volta in Supabase SQL Editor:
supabase/migrations/release-12.9.35-consolidamento-ruoli.sql

La migrazione 12.9.33 per i tre tipi documentali resta necessaria se non è già stata eseguita.
