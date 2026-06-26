import csv
import os

# Definiamo l'ordine corretto per rispettare i vincoli di chiave esterna
tables = [
    {
        "table_name": "Cliente",
        "csv_file": "Clienti.csv",
        "columns": ["codice", "cf_piva", "ragSoc", "indirizzo", "città"],
        "numeric_cols": []
    },
    {
        "table_name": "PuntoFornitura",
        "csv_file": "PuntiFornitura.csv",
        "columns": ["codice_pod", "indirizzo", "città", "distretto", "diametro_tubo", "portata_massima"],
        "numeric_cols": []
    },
    {
        "table_name": "Utenza",
        "csv_file": "Utenze.csv",
        "columns": ["codice", "codice_parlante", "codice_pod", "cliente", "dataAp", "stato", "dataCh", "tipologia", "componenti_nucleo", "indirizzo_fatturazione", "città_fatturazione"],
        "numeric_cols": ["componenti_nucleo"]
    },
    {
        "table_name": "Fattura",
        "csv_file": "Fatture.csv",
        "columns": ["codice", "codice_parlante", "utenza", "cliente", "data", "imponibile", "iva", "totale", "data_scadenza", "stato_pagamento", "data_pagamento", "indirizzo_fatturazione", "città_fatturazione"],
        "numeric_cols": ["imponibile", "iva", "totale"]
    },
    {
        "table_name": "Lettura",
        "csv_file": "Letture.csv",
        "columns": ["codice", "codice_parlante", "utenza", "fattura", "data", "valore", "tipo_lettura"],
        "numeric_cols": ["valore"]
    }
]

def escape_sql_string(val):
    if val is None or val.strip().upper() == "NULL" or val.strip() == "":
        return "NULL"
    # Escaping degli apici singoli per SQL
    val = val.replace("'", "''")
    return f"'{val}'"

def main():
    output_file = "dump_completo.sql"
    base_dir = "/home/brego/Documents/Uni/progweb/database"
    schema_file = os.path.join(base_dir, "schema.sql")
    
    with open(os.path.join(base_dir, output_file), "w", encoding="utf-8") as out_f:
        # 1. Scriviamo lo schema iniziale (se esiste) per creare le tabelle
        if os.path.exists(schema_file):
            with open(schema_file, "r", encoding="utf-8") as schema_f:
                out_f.write("-- ===========================================\n")
                out_f.write("-- 1. CREAZIONE SCHEMA\n")
                out_f.write("-- ===========================================\n\n")
                out_f.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")
                out_f.write("DROP TABLE IF EXISTS Lettura;\n")
                out_f.write("DROP TABLE IF EXISTS Fattura;\n")
                out_f.write("DROP TABLE IF EXISTS Utenza;\n")
                out_f.write("DROP TABLE IF EXISTS PuntoFornitura;\n")
                out_f.write("DROP TABLE IF EXISTS Cliente;\n\n")
                out_f.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")
                out_f.write(schema_f.read())
                out_f.write("\n\n")

        out_f.write("-- ===========================================\n")
        out_f.write("-- 2. INSERIMENTO DATI (INSERT INTO)\n")
        out_f.write("-- ===========================================\n\n")

        # 2. Iteriamo sulle tabelle per generare le INSERT
        for table in tables:
            csv_path = os.path.join(base_dir, table["csv_file"])
            if not os.path.exists(csv_path):
                print(f"Attenzione: File CSV non trovato {csv_path}")
                continue
                
            out_f.write(f"-- Inserimenti per la tabella: {table['table_name']}\n")
            
            with open(csv_path, "r", encoding="utf-8") as csv_f:
                reader = csv.DictReader(csv_f)
                
                # Buffer per batch insert
                batch_size = 500
                values_list = []
                
                columns_str = ", ".join(table["columns"])
                
                for row in reader:
                    row_vals = []
                    for col in table["columns"]:
                        val = row.get(col, "NULL")
                        
                        if val.strip().upper() == "NULL" or val.strip() == "":
                            row_vals.append("NULL")
                        elif col in table["numeric_cols"]:
                            row_vals.append(val.strip())
                        else:
                            row_vals.append(escape_sql_string(val))
                            
                    values_list.append(f"({', '.join(row_vals)})")
                    
                    if len(values_list) >= batch_size:
                        insert_stmt = f"INSERT INTO {table['table_name']} ({columns_str}) VALUES \n{',\n'.join(values_list)};\n"
                        out_f.write(insert_stmt)
                        values_list = []
                
                # Scrivi rimanenti
                if values_list:
                    insert_stmt = f"INSERT INTO {table['table_name']} ({columns_str}) VALUES \n{',\n'.join(values_list)};\n"
                    out_f.write(insert_stmt)
                    
            out_f.write("\n")

    print(f"Generazione SQL completata! File salvato in: {os.path.join(base_dir, output_file)}")

if __name__ == "__main__":
    main()
