# K9 Studio Dogsitter — Release 1.0 ricostruita

Questa cartella contiene il progetto completo per GitHub Pages e Supabase.

## Ordine obbligatorio

### 1. Creare il progetto Supabase

Creare un nuovo progetto in area Europa e conservare la password del database.

### 2. Eseguire lo schema

Aprire **SQL Editor**, incollare tutto il contenuto di:

`supabase/schema.sql`

e premere **Run** una sola volta. Lo script è progettato per essere rieseguibile sulle strutture principali, ma la prima installazione deve essere eseguita su un progetto vuoto.

### 3. Creare il titolare

In **Authentication → Users**, creare manualmente il primo utente con email confermata.

Poi eseguire in SQL Editor, sostituendo l’email:

```sql
update public.profiles
set role='owner', is_owner=true, active=true,
    full_name='Giovanni Napoletano'
where email='TUA_EMAIL';
```

Il titolare è protetto: il Vice Amministratore non può sospenderlo, declassarlo o sostituirlo.

### 4. Pubblicare la Edge Function

Installare Supabase CLI oppure usare l’editor Functions del pannello Supabase.

Funzione da distribuire:

`supabase/functions/create-user`

Nome esatto: `create-user`

La funzione usa automaticamente le variabili:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

La Service Role resta esclusivamente nella Edge Function e non è presente nel frontend.

### 5. Configurare il frontend

Aprire `config.js` e sostituire:

- `INCOLLA_QUI_PROJECT_URL`
- `INCOLLA_QUI_ANON_KEY`

Usare la **anon public key**, mai la Service Role Key.

### 6. Caricare su GitHub

Creare una repository pubblica e caricare il contenuto della cartella, non la cartella contenitore.

In **Settings → Pages** selezionare:

- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

### 7. Primo collaudo

Accedere come titolare e verificare nell’ordine:

1. creazione account dipendente;
2. creazione cliente con assegnazione dipendente;
3. creazione cane collegato al cliente;
4. creazione servizio con lo stesso dipendente assegnato al cliente;
5. accesso del dipendente;
6. avvio e conclusione servizio con rapporto;
7. approvazione del titolare;
8. generazione e caricamento PDF nel bucket privato `service-documents`;
9. apertura del PDF con URL firmato temporaneo;
10. registrazione incasso cliente, liquidazione dipendente e invio documento.

## Regole implementate

- Il titolare e il Vice Amministratore hanno accesso operativo completo.
- Solo il titolare può creare un Vice Amministratore.
- Il Vice non può modificare o sospendere il titolare.
- Il dipendente vede soltanto clienti, cani e servizi assegnati.
- Il dipendente vede soltanto il proprio compenso.
- I compensi maturano soltanto per servizi terminati o chiusi.
- Il cane deve appartenere al cliente selezionato.
- Il servizio deve essere assegnato al dipendente associato al cliente.
- Il PDF viene creato dopo l’approvazione e archiviato in un bucket privato.
- Solo titolare e Vice possono aprire e segnare come inviati i documenti.
- Il service worker conserva solo file statici dello stesso dominio e non memorizza dati Supabase.

## Limiti intenzionali della Release 1.0

- Nessun portale cliente.
- Nessun centro comunicazioni interno.
- Nessuna integrazione con Netlify, Drive, Sheets o Resend.
- La condivisione del PDF avviene dal visualizzatore del dispositivo dopo aver aperto il documento firmato.
