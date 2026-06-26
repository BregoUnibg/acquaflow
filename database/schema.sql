CREATE TABLE Cliente (
    codice VARCHAR(50) PRIMARY KEY,
    cf_piva VARCHAR(16) UNIQUE NOT NULL,
    ragSoc VARCHAR(100) NOT NULL,
    indirizzo VARCHAR(150),
    città VARCHAR(100)
);

CREATE TABLE PuntoFornitura (
    codice_pod VARCHAR(50) PRIMARY KEY,
    indirizzo VARCHAR(150),
    città VARCHAR(100),
    distretto ENUM('Nord-Ovest BG', 'Sud-Est BG e BS', 'Brianza', 'Lecchese e Lario', 'Martesana e Cremasco', 'Non Definito') DEFAULT 'Non Definito',
    diametro_tubo VARCHAR(20),
    portata_massima VARCHAR(20)
);

CREATE TABLE Utenza (
    codice VARCHAR(50) PRIMARY KEY,
    codice_parlante VARCHAR(50) UNIQUE,
    codice_pod VARCHAR(50),
    cliente VARCHAR(50),
    dataAp DATE,
    stato ENUM('attiva', 'inattiva') DEFAULT 'attiva',
    dataCh DATE,
    tipologia ENUM('Domestico Residente', 'Domestico Non Residente', 'Commerciale', 'Industriale') NOT NULL,
    componenti_nucleo INT,
    indirizzo_fatturazione VARCHAR(150),
    città_fatturazione VARCHAR(100),
    FOREIGN KEY (codice_pod) REFERENCES PuntoFornitura(codice_pod) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (cliente) REFERENCES Cliente(codice) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Fattura (
    codice VARCHAR(50) PRIMARY KEY,
    codice_parlante VARCHAR(50) UNIQUE,
    utenza VARCHAR(50),
    cliente VARCHAR(50),
    data DATE NOT NULL,
    imponibile DECIMAL(10, 2) NOT NULL,
    iva DECIMAL(10, 2) NOT NULL,
    totale DECIMAL(10, 2) NOT NULL,
    data_scadenza DATE,
    stato_pagamento ENUM('Emessa', 'Pagata', 'Scaduta', 'Annullata') DEFAULT 'Emessa',
    data_pagamento DATE,
    indirizzo_fatturazione VARCHAR(150),
    città_fatturazione VARCHAR(100),
    FOREIGN KEY (utenza) REFERENCES Utenza(codice) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (cliente) REFERENCES Cliente(codice) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Lettura (
    codice VARCHAR(50) PRIMARY KEY,
    codice_parlante VARCHAR(50) UNIQUE,
    utenza VARCHAR(50),
    fattura VARCHAR(50),
    data DATE NOT NULL,
    valore INT NOT NULL,
    tipo_lettura ENUM('reale', 'stimata', 'autolettura') DEFAULT 'reale',
    FOREIGN KEY (utenza) REFERENCES Utenza(codice) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (fattura) REFERENCES Fattura(codice) ON DELETE SET NULL ON UPDATE CASCADE
);
