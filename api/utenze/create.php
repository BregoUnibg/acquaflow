<?php
// /api/utenze/create.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id_cliente) && !empty($data->codice_pod) && !empty($data->tipologia)) {
    try {
        // Genera UUID v4
        $uuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        // Genera Codice Parlante: U-DDMMYYYY-RAND
        $dateStr = date('dmY');
        $randSuffix = str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        $codice_parlante = "U-" . $dateStr . "-" . $randSuffix;

        $dataAp = date('Y-m-d');
        $stato = 'attiva';

        $query = "INSERT INTO Utenza 
                  (codice, codice_parlante, codice_pod, cliente, dataAp, stato, tipologia, componenti_nucleo, indirizzo_fatturazione, città_fatturazione)
                  VALUES 
                  (:codice, :codice_parlante, :codice_pod, :cliente, :dataAp, :stato, :tipologia, :componenti_nucleo, :indirizzo_fatturazione, :citta_fatturazione)";

        $stmt = $db->prepare($query);

        $cliente = htmlspecialchars(strip_tags($data->id_cliente));
        $codice_pod = htmlspecialchars(strip_tags($data->codice_pod));
        $indirizzo_fatturazione = !empty($data->indirizzo_fatturazione) ? htmlspecialchars(strip_tags($data->indirizzo_fatturazione)) : null;
        $citta_fatturazione = !empty($data->citta_fatturazione) ? htmlspecialchars(strip_tags($data->citta_fatturazione)) : null;
        $tipologia = htmlspecialchars(strip_tags($data->tipologia));
        $componenti_nucleo = !empty($data->componenti_nucleo) ? (int)$data->componenti_nucleo : null;

        $stmt->bindParam(':codice', $uuid);
        $stmt->bindParam(':codice_parlante', $codice_parlante);
        $stmt->bindParam(':codice_pod', $codice_pod);
        $stmt->bindParam(':cliente', $cliente);
        $stmt->bindParam(':dataAp', $dataAp);
        $stmt->bindParam(':stato', $stato);
        $stmt->bindParam(':tipologia', $tipologia);
        $stmt->bindParam(':componenti_nucleo', $componenti_nucleo);
        $stmt->bindParam(':indirizzo_fatturazione', $indirizzo_fatturazione);
        $stmt->bindParam(':citta_fatturazione', $citta_fatturazione);

        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                "success" => true, 
                "message" => "Utenza creata con successo.", 
                "id_utenza" => $uuid,
                "codice_parlante" => $codice_parlante
            ]);
        } else {
            http_response_code(503);
            echo json_encode(["success" => false, "message" => "Impossibile creare l'utenza."]);
        }
    } catch(PDOException $e) {
        // Controllo se c'è un duplicato del codice_parlante
        if ($e->getCode() == 23000) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Errore duplicato. Riprovare per generare un nuovo codice.", "error" => $e->getMessage()]);
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Errore API Create Utenza.", "error" => $e->getMessage()]);
        }
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dati incompleti. Cliente, POD o Tipologia mancante."]);
}
?>
