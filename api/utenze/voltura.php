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

        $tipologia = isset($data->tipologia) ? htmlspecialchars(strip_tags($data->tipologia)) : $old_utenza['tipologia'];
        $componenti_nucleo = property_exists($data, 'componenti_nucleo') ? ($data->componenti_nucleo !== null ? (int)$data->componenti_nucleo : null) : $old_utenza['componenti_nucleo'];
        $indirizzo_fatturazione = isset($data->indirizzo_fatturazione) ? htmlspecialchars(strip_tags($data->indirizzo_fatturazione)) : $old_utenza['indirizzo_fatturazione'];
        $citta_fatturazione = isset($data->citta_fatturazione) ? htmlspecialchars(strip_tags($data->citta_fatturazione)) : $old_utenza['città_fatturazione'];

        $query_new = "INSERT INTO Utenza 
                      (codice, codice_parlante, codice_pod, cliente, dataAp, stato, tipologia, componenti_nucleo, indirizzo_fatturazione, città_fatturazione)
                      VALUES 
                      (:codice, :codice_parlante, :codice_pod, :cliente, CURDATE(), 'attiva', :tipologia, :componenti_nucleo, :indirizzo_fatturazione, :citta_fatturazione)";
        
        $stmt_new = $db->prepare($query_new);
        $stmt_new->bindParam(':codice', $new_uuid);
        $stmt_new->bindParam(':codice_parlante', $new_codice_parlante);
        $stmt_new->bindParam(':codice_pod', $old_utenza['codice_pod']);
        $stmt_new->bindParam(':cliente', $id_nuovo_cliente);
        $stmt_new->bindParam(':tipologia', $tipologia);
        $stmt_new->bindParam(':componenti_nucleo', $componenti_nucleo);
        $stmt_new->bindParam(':indirizzo_fatturazione', $indirizzo_fatturazione);
        $stmt_new->bindParam(':citta_fatturazione', $citta_fatturazione);
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

        // 7. Genera Fattura di chiusura per la vecchia utenza (con calcolo consumi reali e associazione letture pendenti)
        
        // Recupera le letture dell'utenza vecchia che hanno stato "da fatturare" (ovvero fattura IS NULL)
        $queryPendenti = "SELECT codice, valore, data FROM Lettura WHERE utenza = :utenza AND fattura IS NULL ORDER BY data ASC";
        $stmtPendenti = $db->prepare($queryPendenti);
        $stmtPendenti->bindParam(':utenza', $id_vecchia);
        $stmtPendenti->execute();
        $letture_pendenti = $stmtPendenti->fetchAll(PDO::FETCH_ASSOC);

        // Recupera l'ultima lettura già fatturata come baseline
        $queryLastInvoiced = "SELECT valore, data FROM Lettura WHERE utenza = :utenza AND fattura IS NOT NULL ORDER BY data DESC, valore DESC LIMIT 1";
        $stmtLastInvoiced = $db->prepare($queryLastInvoiced);
        $stmtLastInvoiced->bindParam(':utenza', $id_vecchia);
        $stmtLastInvoiced->execute();
        $lastInvoiced = $stmtLastInvoiced->fetch(PDO::FETCH_ASSOC);

        $imponibile = 0.00;
        $iva = 0.00;
        $totale = 0.00;

        if (count($letture_pendenti) > 0) {
            if ($lastInvoiced) {
                $minVal = (int)$lastInvoiced['valore'];
                $data_inizio = $lastInvoiced['data'];
            } else {
                $minVal = (int)$letture_pendenti[0]['valore'];
                $data_inizio = $letture_pendenti[0]['data'];
            }
            
            $lastP = end($letture_pendenti);
            $maxVal = (int)$lastP['valore'];
            $data_fine = $lastP['data'];

            $diff = $maxVal - $minVal;
            if ($diff < 0) {
                $diff += 100000;
            }
            $tot_consumo = $diff;
            
            $giorni_fatturati = max(1, round((strtotime($data_fine) - strtotime($data_inizio)) / 86400));
            $mesi_fatturati = $giorni_fatturati / 30.0;
            
            $tipologia_uso = $old_utenza['tipologia'];
            $componenti = (int)($old_utenza['componenti_nucleo'] ?? 1);
            if ($componenti < 1) $componenti = 1;

            if (in_array($tipologia_uso, ['Commerciale', 'Industriale'])) {
                $quota_fissa = 0.15 * $giorni_fatturati;
                $costo_acqua = $tot_consumo * 1.80;
                $costo_fognatura_dep = $tot_consumo * 0.80;
                $aliquota_iva = 0.22;
            } else if ($tipologia_uso == 'Domestico Non Residente') {
                $quota_fissa = 0.10 * $giorni_fatturati;
                $costo_acqua = $tot_consumo * 1.50;
                $costo_fognatura_dep = $tot_consumo * 0.50;
                $aliquota_iva = 0.10;
            } else { // Domestico Residente
                $quota_fissa = 0.05 * $giorni_fatturati;
                
                $soglia_agevolata = 4.16 * $componenti * $mesi_fatturati;
                $soglia_base = 8.33 * $componenti * $mesi_fatturati;
                
                if ($tot_consumo <= $soglia_agevolata) {
                    $costo_acqua = $tot_consumo * 0.90;
                } else if ($tot_consumo <= $soglia_base) {
                    $costo_acqua = ($soglia_agevolata * 0.90) + (($tot_consumo - $soglia_agevolata) * 1.50);
                } else {
                    $costo_acqua = ($soglia_agevolata * 0.90) + (($soglia_base - $soglia_agevolata) * 1.50) + (($tot_consumo - $soglia_base) * 2.20);
                }
                    
                $costo_fognatura_dep = $tot_consumo * 0.50;
                $aliquota_iva = 0.10;
            }
            
            $imponibile = round($quota_fissa + $costo_acqua + $costo_fognatura_dep, 2);
            $iva = round($imponibile * $aliquota_iva, 2);
            $totale = round($imponibile + $iva, 2);
        }

        $id_fattura = gen_uuid();
        $cod_parl_fatt = "FAT-" . date('dmY') . "-" . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
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

        // Associa le letture pendenti alla nuova fattura
        if (count($letture_pendenti) > 0) {
            $ids_pendenti = array_column($letture_pendenti, 'codice');
            $inQuery = implode(',', array_fill(0, count($ids_pendenti), '?'));
            $updateLetture = "UPDATE Lettura SET fattura = ? WHERE codice IN ($inQuery)";
            $stmtUpLetture = $db->prepare($updateLetture);
            
            $params = array_merge([$id_fattura], $ids_pendenti);
            $stmtUpLetture->execute($params);
        }

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
