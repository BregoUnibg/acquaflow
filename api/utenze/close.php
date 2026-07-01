<?php
// /api/utenze/close.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id_utenza) && isset($data->valore_lettura)) {
    try {
        $db->beginTransaction();

        $id_utenza = htmlspecialchars(strip_tags($data->id_utenza));
        $valore_lettura = (int)$data->valore_lettura;
        $data_odierna = date('Y-m-d');

        // 1. UPDATE Utenza
        $queryUtenza = "UPDATE Utenza SET stato = 'inattiva', dataCh = :dataCh WHERE codice = :codice";
        $stmtUtenza = $db->prepare($queryUtenza);
        $stmtUtenza->bindParam(':dataCh', $data_odierna);
        $stmtUtenza->bindParam(':codice', $id_utenza);
        $stmtUtenza->execute();

        // Ottieni info utili per la fattura (cliente, indirizzo_fatturazione ecc)
        $queryInfo = "SELECT cliente, indirizzo_fatturazione, città_fatturazione, tipologia, componenti_nucleo, dataAp FROM Utenza WHERE codice = :codice";
        $stmtInfo = $db->prepare($queryInfo);
        $stmtInfo->bindParam(':codice', $id_utenza);
        $stmtInfo->execute();
        $utenzaInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);

        if (!$utenzaInfo) {
            throw new Exception("Utenza non trovata");
        }

        // 2. INSERT Lettura di Chiusura
        $id_lettura = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $parlante_lettura = "L-" . date('dmY') . "-" . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        $tipo_lettura = 'autolettura';

        $queryLettura = "INSERT INTO Lettura (codice, codice_parlante, utenza, data, valore, tipo_lettura) 
                         VALUES (:codice, :codice_parlante, :utenza, :data, :valore, :tipo_lettura)";
        $stmtLettura = $db->prepare($queryLettura);
        $stmtLettura->bindParam(':codice', $id_lettura);
        $stmtLettura->bindParam(':codice_parlante', $parlante_lettura);
        $stmtLettura->bindParam(':utenza', $id_utenza);
        $stmtLettura->bindParam(':data', $data_odierna);
        $stmtLettura->bindParam(':valore', $valore_lettura);
        $stmtLettura->bindParam(':tipo_lettura', $tipo_lettura);
        $stmtLettura->execute();

        // 3. FATTURAZIONE FINALE
        // Recupera tutte le letture per trovare consumi e giorni
        $queryTutte = "SELECT codice, valore, data, fattura FROM Lettura WHERE utenza = :utenza ORDER BY data ASC";
        $stmtTutte = $db->prepare($queryTutte);
        $stmtTutte->bindParam(':utenza', $id_utenza);
        $stmtTutte->execute();
        $tutte = $stmtTutte->fetchAll(PDO::FETCH_ASSOC);

        $letture_pendenti = [];
        $last_invoiced_val = null;
        $last_invoiced_data = null;
        
        foreach ($tutte as $l) {
            if ($l['fattura'] !== null) {
                $last_invoiced_val = $l['valore'];
                $last_invoiced_data = $l['data'];
            } else {
                $letture_pendenti[] = $l;
            }
        }

        $imponibile = 0.00;
        $iva = 0.00;
        $totale = 0.00;

        if (count($tutte) > 0) {
            if ($last_invoiced_val !== null) {
                $minVal = (int)$last_invoiced_val;
                $data_inizio = $last_invoiced_data;
            } else {
                $minVal = (int)$tutte[0]['valore']; // posa
                $data_inizio = $tutte[0]['data'];
            }
            
            $lastP = end($letture_pendenti);
            $maxVal = (int)$lastP['valore'];
            $data_fine = $lastP['data'];

            // Logica counter rollover (valore - prev < 0 ? + 100000)
            $diff = $maxVal - $minVal;
            if ($diff < 0) {
                $diff += 100000;
            }
            $tot_consumo = $diff;
            
            $giorni_fatturati = max(1, round((strtotime($data_fine) - strtotime($data_inizio)) / 86400));
            $mesi_fatturati = $giorni_fatturati / 30.0;
            
            $tipologia_uso = $utenzaInfo['tipologia'];
            $componenti = (int)($utenzaInfo['componenti_nucleo'] ?? 1);
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

        // Genera id e codice per fattura
        $id_fattura = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $parlante_fattura = "FAT-" . date('dmY') . "-" . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        
        $data_scadenza = date('Y-m-d', strtotime('+30 days'));
        $stato_pagamento = 'Emessa';

        $queryFattura = "INSERT INTO Fattura 
                        (codice, codice_parlante, utenza, cliente, data, imponibile, iva, totale, data_scadenza, stato_pagamento, indirizzo_fatturazione, città_fatturazione)
                        VALUES 
                        (:codice, :parlante, :utenza, :cliente, :data, :imponibile, :iva, :totale, :scadenza, :stato, :ind_fatt, :cit_fatt)";
        $stmtFatt = $db->prepare($queryFattura);
        
        $stmtFatt->bindParam(':codice', $id_fattura);
        $stmtFatt->bindParam(':parlante', $parlante_fattura);
        $stmtFatt->bindParam(':utenza', $id_utenza);
        $stmtFatt->bindParam(':cliente', $utenzaInfo['cliente']);
        $stmtFatt->bindParam(':data', $data_odierna);
        $stmtFatt->bindParam(':imponibile', $imponibile);
        $stmtFatt->bindParam(':iva', $iva);
        $stmtFatt->bindParam(':totale', $totale);
        $stmtFatt->bindParam(':scadenza', $data_scadenza);
        $stmtFatt->bindParam(':stato', $stato_pagamento);
        $stmtFatt->bindParam(':ind_fatt', $utenzaInfo['indirizzo_fatturazione']);
        $stmtFatt->bindParam(':cit_fatt', $utenzaInfo['città_fatturazione']);
        $stmtFatt->execute();

        // Associa le letture pendenti alla nuova fattura
        if (count($letture_pendenti) > 0) {
            $ids_pendenti = array_column($letture_pendenti, 'codice');
            $inQuery = implode(',', array_fill(0, count($ids_pendenti), '?'));
            $updateLetture = "UPDATE Lettura SET fattura = ? WHERE codice IN ($inQuery)";
            $stmtUpLetture = $db->prepare($updateLetture);
            
            // Passa l'id_fattura come primo parametro
            $params = array_merge([$id_fattura], $ids_pendenti);
            $stmtUpLetture->execute($params);
        }

        // Commit transazione
        $db->commit();

        http_response_code(200);
        echo json_encode([
            "success" => true, 
            "message" => "Contratto chiuso, lettura di conguaglio e fattura generata."
        ]);

    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        file_put_contents('error_log.txt', date('Y-m-d H:i:s') . " - " . $e->getMessage() . "\n", FILE_APPEND);
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Errore API Chiusura: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dati incompleti o non validi."]);
}
?>
