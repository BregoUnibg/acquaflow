<?php
// /api/utenze/list.php

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
$stato = isset($_GET['stato']) ? $_GET['stato'] : 'all';
$tipologia = isset($_GET['tipologia']) ? $_GET['tipologia'] : 'all';
$zona = isset($_GET['zona']) ? $_GET['zona'] : 'all';
$data_da = isset($_GET['data_da']) ? $_GET['data_da'] : '';
$data_a = isset($_GET['data_a']) ? $_GET['data_a'] : '';

$response = [
    "success" => true,
    "utenze" => [],
    "has_more" => false,
    "limit" => $limit,
    "offset" => $offset
];

try {
    $where_clauses = ["1=1"];
    $params = [];

    // Filtro Ricerca (ID Utenza, Nome Cliente, Indirizzo)
    if (!empty($search)) {
        $where_clauses[] = "(u.codice LIKE :search OR c.ragSoc LIKE :search OR p.indirizzo LIKE :search)";
        $params[':search'] = "%" . $search . "%";
    }

    // Filtro Stato
    if ($stato !== 'all' && in_array($stato, ['attiva', 'inattiva'])) {
        $where_clauses[] = "u.stato = :stato";
        $params[':stato'] = $stato;
    }

    // Filtro Tipologia
    if ($tipologia !== 'all') {
        $where_clauses[] = "u.tipologia = :tipologia";
        $params[':tipologia'] = $tipologia;
    }

    // Filtro Zona (Distretto)
    if ($zona !== 'all') {
        $where_clauses[] = "p.distretto = :zona";
        $params[':zona'] = $zona;
    }

    // Filtro Periodo (Date)
    if (!empty($data_da)) {
        $where_clauses[] = "u.dataAp >= :data_da";
        $params[':data_da'] = $data_da;
    }
    if (!empty($data_a)) {
        $where_clauses[] = "u.dataAp <= :data_a";
        $params[':data_a'] = $data_a;
    }

    $where_sql = implode(" AND ", $where_clauses);
    $query_limit = $limit + 1; // Per sapere se c'è una pagina successiva

    $query = "
        SELECT 
            u.codice,
            u.codice_parlante,
            u.cliente as id_cliente,
            u.stato,
            u.tipologia,
            u.componenti_nucleo,
            u.indirizzo_fatturazione,
            u.città_fatturazione,
            u.dataAp,
            u.dataCh,
            c.ragSoc,
            c.cf_piva,
            p.indirizzo,
            p.città,
            (SELECT COUNT(*) FROM Lettura l WHERE l.utenza = u.codice) as num_letture
        FROM Utenza u
        LEFT JOIN Cliente c ON u.cliente = c.codice
        LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod
        WHERE $where_sql
        ORDER BY u.dataAp DESC, u.codice ASC
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $db->prepare($query);
    
    // Bind dei parametri dinamici
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    // Bind di limit e offset
    $stmt->bindValue(':limit', $query_limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    
    $count = 0;
    while ($row = $stmt->fetch()) {
        $count++;
        if ($count > $limit) {
            $response["has_more"] = true;
            break;
        }

        // Formattazione del periodo (senza usare IntlDateFormatter che potrebbe non essere installato)
        $mesi_it = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        
        $ts_inizio = strtotime($row['dataAp']);
        $data_inizio = date('d', $ts_inizio) . " " . $mesi_it[date('n', $ts_inizio) - 1] . " " . date('Y', $ts_inizio);
        
        if ($row['dataCh']) {
            $ts_fine = strtotime($row['dataCh']);
            $data_fine = date('d', $ts_fine) . " " . $mesi_it[date('n', $ts_fine) - 1] . " " . date('Y', $ts_fine);
        } else {
            $data_fine = 'In corso';
        }
        
        $periodo = $data_inizio . " - " . $data_fine;
        
        $response["utenze"][] = [
            "id_utenza" => $row['codice'],
            "codice_parlante" => $row['codice_parlante'],
            "id_cliente" => $row['id_cliente'],
            "cliente" => $row['ragSoc'],
            "cliente_cf" => $row['cf_piva'],
            "indirizzo" => $row['indirizzo'] . ', ' . $row['città'],
            "indirizzo_puro" => $row['indirizzo'],
            "citta_pura" => $row['città'],
            "indirizzo_fatturazione" => $row['indirizzo_fatturazione'],
            "citta_fatturazione" => $row['città_fatturazione'],
            "periodo" => $periodo,
            "data_apertura_raw" => $row['dataAp'],
            "tipologia" => $row['tipologia'],
            "componenti_nucleo" => (int)$row['componenti_nucleo'],
            "letture" => (int)$row['num_letture'],
            "stato" => $row['stato']
        ];
    }

    http_response_code(200);
    echo json_encode($response);

} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore API Utenze.", "error" => $e->getMessage()]);
}
?>
