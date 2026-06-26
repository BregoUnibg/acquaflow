<?php
// /api/clienti/list.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Parametri GET
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$stato_filter = isset($_GET['stato']) ? $_GET['stato'] : 'all';

$response = [
    "success" => true,
    "clienti" => [],
    "has_more" => false,
    "limit" => $limit,
    "offset" => $offset
];

try {
    $where_clauses = ["1=1"];
    $params = [];

    // Filtro Ricerca (Full Text fittizia con LIKE su Nome e P.IVA)
    if (!empty($search)) {
        $where_clauses[] = "(c.ragSoc LIKE :search OR c.cf_piva LIKE :search)";
        $params[':search'] = "%" . $search . "%";
    }

    // Filtro Stato (Moroso / Adempiente)
    if ($stato_filter === 'Moroso') {
        $where_clauses[] = "EXISTS (SELECT 1 FROM Fattura f WHERE f.cliente = c.codice AND f.stato_pagamento = 'Scaduta')";
    } elseif ($stato_filter === 'Adempiente') {
        $where_clauses[] = "NOT EXISTS (SELECT 1 FROM Fattura f WHERE f.cliente = c.codice AND f.stato_pagamento = 'Scaduta')";
    }

    $where_sql = implode(" AND ", $where_clauses);

    // Chiediamo LIMIT + 1 per sapere se c'è una pagina successiva
    $query_limit = $limit + 1;

    $query = "
        SELECT 
            c.codice,
            c.ragSoc,
            c.cf_piva,
            c.indirizzo,
            c.città,
            (SELECT COUNT(*) FROM Utenza u WHERE u.cliente = c.codice AND u.stato = 'attiva') as utenze_attive,
            (SELECT COUNT(*) FROM Fattura f WHERE f.cliente = c.codice AND f.stato_pagamento = 'Scaduta') as fatture_scadute
        FROM Cliente c
        WHERE $where_sql
        ORDER BY c.ragSoc ASC
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $db->prepare($query);
    
    // Bind parameters
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    // Bind limit/offset as integer
    $stmt->bindValue(':limit', $query_limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    
    $count = 0;
    while ($row = $stmt->fetch()) {
        $count++;
        if ($count > $limit) {
            // Abbiamo trovato una riga in più rispetto al limit, quindi c'è una prossima pagina
            $response["has_more"] = true;
            break; // Non includiamo questa riga nel risultato
        }

        $stato = ($row['fatture_scadute'] > 0) ? 'Moroso' : 'Adempiente';
        
        $response["clienti"][] = [
            "id_cliente" => $row['codice'],
            "ragSoc" => $row['ragSoc'],
            "cf_piva" => $row['cf_piva'],
            "indirizzo" => $row['indirizzo'],
            "citta" => $row['città'],
            "utenze_attive" => (int)$row['utenze_attive'],
            "stato" => $stato
        ];
    }

    http_response_code(200);
    echo json_encode($response);

} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore nell'esecuzione della query.", "error" => $e->getMessage()]);
}
?>
