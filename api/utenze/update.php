<?php
// /api/utenze/update.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Leggi body JSON
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id_utenza)) {
    try {
        $query = "UPDATE Utenza SET 
                    cliente = :cliente,
                    indirizzo_fatturazione = :indirizzo_fatturazione,
                    città_fatturazione = :citta_fatturazione,
                    tipologia = :tipologia,
                    componenti_nucleo = :componenti_nucleo
                  WHERE codice = :codice";

        $stmt = $db->prepare($query);

        // Parametri sicuri
        $cliente = htmlspecialchars(strip_tags($data->id_cliente));
        $indirizzo_fatturazione = htmlspecialchars(strip_tags($data->indirizzo_fatturazione));
        $citta_fatturazione = htmlspecialchars(strip_tags($data->citta_fatturazione));
        $tipologia = htmlspecialchars(strip_tags($data->tipologia));
        $componenti_nucleo = !empty($data->componenti_nucleo) ? (int)$data->componenti_nucleo : null;
        $codice = htmlspecialchars(strip_tags($data->id_utenza));

        $stmt->bindParam(':cliente', $cliente);
        $stmt->bindParam(':indirizzo_fatturazione', $indirizzo_fatturazione);
        $stmt->bindParam(':citta_fatturazione', $citta_fatturazione);
        $stmt->bindParam(':tipologia', $tipologia);
        $stmt->bindParam(':componenti_nucleo', $componenti_nucleo);
        $stmt->bindParam(':codice', $codice);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(["success" => true, "message" => "Utenza aggiornata con successo."]);
        } else {
            http_response_code(503);
            echo json_encode(["success" => false, "message" => "Impossibile aggiornare l'utenza."]);
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Errore API Update Utenze.", "error" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dati incompleti. ID utenza mancante."]);
}
?>
