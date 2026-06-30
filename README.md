# AcquaFlow 
L'applicazione è intesa come il sistema gestionale interno per un'azienda di distribuzione idrica. 

L'utente target è quindi un impiegato amministrativo, abilitato alla registrazione di clienti, utenze, letture e fatture all'interno del database aziendale.

L'interfaccia, seppur professionale e completa, è stata progettata per offrire un'esperienza d'uso piacevole e intuitiva. A questo scopo è stata introdotta una barra di ricerca dinamica, capace di identificare e distinguere in modo intelligente i dati inseriti dall'utente.

# Modifiche al Database Schema

Le modifiche apportate hanno lo scopo di rendere il database più realistico ed ottimizzato. 

### Scelta Architetturale di Ottimizzazione
Quasi tutte le tabelle presentano una distinzione tra `codice` e `codice_parlante`:
* **`codice`**: è la Primary Key "DBMS-friendly", pensata per ottimizzare e velocizzare le query (principalmente nelle operazioni di JOIN).
* **`codice_parlante`**: è l'identificativo effettivo, quello mostrato all'utente e usato nella logica applicativa.

### PuntoFornitura (Nuova Entità)
Nello schema iniziale i dati del luogo di fornitura erano accorpati dentro `Utenza`. Ho deciso di scorporarli per maggiore realismo:
* **Entità autonoma**: Rappresenta l'infrastruttura fisica vera e propria a cui vengono allacciati i contatori (memorizza: indirizzo, portata, diametro del tubo, ecc.).
* **Separazione logica**: L'`Utenza` diventa quindi un semplice contratto, che viene stipulato in un secondo momento collegandolo a un `PuntoFornitura` fisico.

### Cliente
* **`cf` -> `cf_piva`**: campo rinominato in quanto il gestionale supporta indifferentemente sia le persone fisiche (tramite Codice Fiscale) sia le aziende (tramite Partita IVA).

### Utenza
* **`indirizzo_fatturazione` e `città_fatturazione`**: L'indirizzo fisico dell'impianto si trova ora in `PuntoFornitura`, questi nuovi campi specificano il recapito ove spedire le bollette, che può essere diverso da quello dell'erogazione.
* **`tipologia` e `componenti_nucleo`**: Aggiunti in quanto nella realtà sono parametri fondamentali per il calcolo delle corrette fasce tariffarie.

### Fattura
Tabella ampliata per gestire tutto il ciclo di vita di un pagamento:
* **`stato_pagamento`, `data_scadenza`, `data_pagamento`**: Necessari per tracciare lo stato delle fatture (capire se sono "Scadute" o "Pagate").
* **Storicizzazione degli indirizzi**: L'indirizzo di fatturazione è salvato sulla fattura, non più legato alla tabella cliente. In questo modo, se un cliente cambia domicilio, lo storico delle vecchie bollette rimane inalterato.
* **Collegamento diretto al `Cliente`**: Oltre all'Utenza, la fattura ora fa riferimento direttamente anche all'anagrafica del cliente, seppur ridondante facilita le query (rottura della terza forma normale). Sta di fatto che ora è possibile gestire il caso di subentro, ovvero il passaggio di un'utenza da un cliente ad un altro mantenendo uno storico accurato delle fatture.

### Lettura
* **`tipo_lettura`**: Specifica come è stato ottenuto il dato (procedura legale regolamentata), ovvero se la lettura è: reale (rilevata da un tecnico), stimata dall'algoritmo, o se è un'autolettura comunicata dal cliente.
