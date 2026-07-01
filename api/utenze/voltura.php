<?php
// /api/utenze/voltura.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id_vecchia_utenza) && !empty($data->id_nuovo_cliente) && isset($data->lettura_voltura)) {
    try {
        $db->beginTransaction();

        $id_vecchia = htmlspecialchars(strip_tags($data->id_vecchia_utenza));
        $id_nuovo_cliente = htmlspecialchars(strip_tags($data->id_nuovo_cliente));
        $lettura_voltura = (int)$data->lettura_voltura;

        // 1. Leggi i dati della vecchia utenza
        $query_old = "SELECT codice_pod, tipologia, componenti_nucleo, indirizzo_fatturazione, città_fatturazione, cliente 
                      FROM Utenza WHERE codice = :id";
        $stmt_old = $db->prepare($query_old);
        $stmt_old->bindParam(':id', $id_vecchia);
        $stmt_old->execute();
        $old_utenza = $stmt_old->fetch(PDO::FETCH_ASSOC);

        if (!$old_utenza) {
            throw new Exception("Utenza originaria non trovata.");
        }

        // 2. Calcolo dei consumi per la fattura di chiusura (Ultima lettura)
        $query_max_lettura = "SELECT MAX(valore) as max_valore FROM Lettura WHERE utenza = :utenza";
        $stmt_max = $db->prepare($query_max_lettura);
        $stmt_max->bindParam(':utenza', $id_vecchia);
        $stmt_max->execute();
        $res_max = $stmt_max->fetch(PDO::FETCH_ASSOC);
        $ultima_lettura = $res_max['max_valore'] ? (int)$res_max['max_valore'] : 0;

        $consumo = $lettura_voltura - $ultima_lettura;
        if ($consumo < 0) $consumo = 0; // Prevenzione errori

        // 3. Chiudi la vecchia utenza
        $query_close = "UPDATE Utenza SET stato = 'inattiva', dataCh = CURDATE() WHERE codice = :id";
        $stmt_close = $db->prepare($query_close);
        $stmt_close->bindParam(':id', $id_vecchia);
        $stmt_close->execute();

        // 4. Apri la nuova utenza
        $new_uuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $dateStr = date('dmY');
        $randSuffix = str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        $new_codice_parlante = "U-" . $dateStr . "-" . $randSuffix;

        $query_new = "INSERT INTO Utenza 
                      (codice, codice_parlante, codice_pod, cliente, dataAp, stato, tipologia, componenti_nucleo, indirizzo_fatturazione, città_fatturazione)
                      VALUES 
                      (:codice, :codice_parlante, :codice_pod, :cliente, CURDATE(), 'attiva', :tipologia, :componenti_nucleo, :indirizzo_fatturazione, :citta_fatturazione)";
        
        $stmt_new = $db->prepare($query_new);
        $stmt_new->bindParam(':codice', $new_uuid);
        $stmt_new->bindParam(':codice_parlante', $new_codice_parlante);
        $stmt_new->bindParam(':codice_pod', $old_utenza['codice_pod']);
        $stmt_new->bindParam(':cliente', $id_nuovo_cliente);
        $stmt_new->bindParam(':tipologia', $old_utenza['tipologia']);
        $stmt_new->bindParam(':componenti_nucleo', $old_utenza['componenti_nucleo']);
        $stmt_new->bindParam(':indirizzo_fatturazione', $old_utenza['indirizzo_fatturazione']);
        $stmt_new->bindParam(':citta_fatturazione', $old_utenza['città_fatturazione']);
        $stmt_new->execute();

        // Funzione helper per generare UUID per Lettura e Fattura
        function gen_uuid() {
            return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }

        // 5. Inserisci Lettura Finale per vecchia utenza (autolettura come concordato)
        $id_lettura_old = gen_uuid();
        $cod_parl_lett_old = "L-" . date('dmY') . "-" . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        $query_lett_old = "INSERT INTO Lettura (codice, codice_parlante, utenza, data, valore, tipo_lettura) 
                           VALUES (:codice, :parlante, :utenza, CURDATE(), :valore, 'autolettura')";
        $stmt_lett_old = $db->prepare($query_lett_old);
        $stmt_lett_old->bindParam(':codice', $id_lettura_old);
        $stmt_lett_old->bindParam(':parlante', $cod_parl_lett_old);
        $stmt_lett_old->bindParam(':utenza', $id_vecchia);
        $stmt_lett_old->bindParam(':valore', $lettura_voltura);
        $stmt_lett_old->execute();

        // 6. Inserisci Lettura Iniziale per nuova utenza
        $id_lettura_new = gen_uuid();
        $cod_parl_lett_new = "L-" . date('dmY') . "-" . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        $query_lett_new = "INSERT INTO Lettura (codice, codice_parlante, utenza, data, valore, tipo_lettura) 
                           VALUES (:codice, :parlante, :utenza, CURDATE(), :valore, 'autolettura')";
        $stmt_lett_new = $db->prepare($query_lett_new);
        $stmt_lett_new->bindParam(':codice', $id_lettura_new);
        $stmt_lett_new->bindParam(':parlante', $cod_parl_lett_new);
        $stmt_lett_new->bindParam(':utenza', $new_uuid);
        $stmt_lett_new->bindParam(':valore', $lettura_voltura);
        $stmt_lett_new->execute();

        // 7. Genera Fattura di chiusura per la vecchia utenza
        $id_fattura = gen_uuid();
        $cod_parl_fatt = "F-" . date('Y') . "-" . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $imponibile = $consumo * 0.10; // Tariffa fissa 0.10 per unità
        $iva = $imponibile * 0.22;
        $totale = $imponibile + $iva;
        $data_scadenza = date('Y-m-d', strtotime('+30 days'));

        $query_fatt = "INSERT INTO Fattura 
                       (codice, codice_parlante, utenza, cliente, data, imponibile, iva, totale, data_scadenza, stato_pagamento, indirizzo_fatturazione, città_fatturazione) 
                       VALUES 
                       (:codice, :parlante, :utenza, :cliente, CURDATE(), :imponibile, :iva, :totale, :scadenza, 'Emessa', :ind, :cit)";
        $stmt_fatt = $db->prepare($query_fatt);
        $stmt_fatt->bindParam(':codice', $id_fattura);
        $stmt_fatt->bindParam(':parlante', $cod_parl_fatt);
        $stmt_fatt->bindParam(':utenza', $id_vecchia);
        $stmt_fatt->bindParam(':cliente', $old_utenza['cliente']);
        $stmt_fatt->bindParam(':imponibile', $imponibile);
        $stmt_fatt->bindParam(':iva', $iva);
        $stmt_fatt->bindParam(':totale', $totale);
        $stmt_fatt->bindParam(':scadenza', $data_scadenza);
        $stmt_fatt->bindParam(':ind', $old_utenza['indirizzo_fatturazione']);
        $stmt_fatt->bindParam(':cit', $old_utenza['città_fatturazione']);
        $stmt_fatt->execute();

        $db->commit();

        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Voltura eseguita con successo."]);

    } catch(Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Errore durante la voltura.", "error" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dati incompleti per la voltura."]);
}
?>
