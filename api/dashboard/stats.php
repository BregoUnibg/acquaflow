<?php
// /api/dashboard/stats.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$zone = isset($_GET['zone']) ? $_GET['zone'] : 'all';
$date = isset($_GET['date']) ? $_GET['date'] : '30days';

$response = [
    "success" => true,
    "kpi" => [
        "clienti_attivi" => ["valore" => 0, "delta" => 0],
        "utenze_attive" => ["valore" => 0, "delta" => 0],
        "letture_effettuate" => ["valore" => 0, "delta" => 0],
        "fatturato_stimato" => ["valore" => 0, "delta" => 0]
    ],
    "utenze_recenti" => []
];

// Funzione helper per costruire le condizioni della data
function getDateConditions($dateFilter, $column) {
    if ($dateFilter === 'month') {
        return [
            'current' => "YEAR($column) = YEAR(CURDATE()) AND MONTH($column) = MONTH(CURDATE())",
            'previous' => "YEAR($column) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH($column) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))",
            'start_condition' => "$column < DATE_FORMAT(CURDATE(), '%Y-%m-01')"
        ];
    } elseif ($dateFilter === 'year') {
        return [
            'current' => "YEAR($column) = YEAR(CURDATE())",
            'previous' => "YEAR($column) = YEAR(CURDATE()) - 1",
            'start_condition' => "$column < DATE_FORMAT(CURDATE(), '%Y-01-01')"
        ];
    }
    // Default 30 days
    return [
        'current' => "$column >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
        'previous' => "$column >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND $column < DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
        'start_condition' => "$column < DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
    ];
}

function calculateDelta($current, $previous) {
    if ($previous > 0) {
        return round((($current - $previous) / $previous) * 100, 1);
    }
    if ($current > 0) {
        return 100.0;
    }
    return 0.0;
}

try {
    // PREPARAZIONE FILTRO ZONA
    $zone_where = "";
    $params = [];
    if ($zone !== 'all') {
        $zone_where = " AND p.distretto = :zone ";
        $params[':zone'] = $zone;
    }

    // --- 1. Clienti Attivi ---
    $dates_c = getDateConditions($date, 'u.dataAp');
    
    // Attuale
    $q_clienti_curr = "SELECT COUNT(DISTINCT c.codice) as total FROM Cliente c JOIN Utenza u ON c.codice = u.cliente JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE u.stato = 'attiva' " . $zone_where;
    $stmt_c_curr = $db->prepare($q_clienti_curr);
    if ($zone !== 'all') $stmt_c_curr->bindValue(':zone', $params[':zone']);
    $stmt_c_curr->execute();
    $curr_clienti = (int)($stmt_c_curr->fetch()['total'] ?? 0);
    
    // Precedente
    $q_clienti_prev = "SELECT COUNT(DISTINCT c.codice) as total FROM Cliente c JOIN Utenza u ON c.codice = u.cliente JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE u.stato = 'attiva' AND " . $dates_c['start_condition'] . $zone_where;
    $stmt_c_prev = $db->prepare($q_clienti_prev);
    if ($zone !== 'all') $stmt_c_prev->bindValue(':zone', $params[':zone']);
    $stmt_c_prev->execute();
    $prev_clienti = (int)($stmt_c_prev->fetch()['total'] ?? 0);

    $response["kpi"]["clienti_attivi"]["valore"] = $curr_clienti;
    $response["kpi"]["clienti_attivi"]["delta"] = calculateDelta($curr_clienti, $prev_clienti);

    // --- 2. Utenze Attive ---
    // Attuale
    $q_utenze_curr = "SELECT COUNT(DISTINCT u.codice) as total FROM Utenza u JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE u.stato = 'attiva' " . $zone_where;
    $stmt_u_curr = $db->prepare($q_utenze_curr);
    if ($zone !== 'all') $stmt_u_curr->bindValue(':zone', $params[':zone']);
    $stmt_u_curr->execute();
    $curr_utenze = (int)($stmt_u_curr->fetch()['total'] ?? 0);
    
    // Precedente
    $q_utenze_prev = "SELECT COUNT(DISTINCT u.codice) as total FROM Utenza u JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE u.stato = 'attiva' AND " . $dates_c['start_condition'] . $zone_where;
    $stmt_u_prev = $db->prepare($q_utenze_prev);
    if ($zone !== 'all') $stmt_u_prev->bindValue(':zone', $params[':zone']);
    $stmt_u_prev->execute();
    $prev_utenze = (int)($stmt_u_prev->fetch()['total'] ?? 0);

    $response["kpi"]["utenze_attive"]["valore"] = $curr_utenze;
    $response["kpi"]["utenze_attive"]["delta"] = calculateDelta($curr_utenze, $prev_utenze);

    // --- 3. Letture Effettuate ---
    $dates_l = getDateConditions($date, 'l.data');
    
    // Attuale
    $q_letture_curr = "SELECT COUNT(*) as total FROM Lettura l JOIN Utenza u ON l.utenza = u.codice JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE " . $dates_l['current'] . $zone_where;
    $stmt_l_curr = $db->prepare($q_letture_curr);
    if ($zone !== 'all') $stmt_l_curr->bindValue(':zone', $params[':zone']);
    $stmt_l_curr->execute();
    $curr_letture = (int)($stmt_l_curr->fetch()['total'] ?? 0);

    // Precedente
    $q_letture_prev = "SELECT COUNT(*) as total FROM Lettura l JOIN Utenza u ON l.utenza = u.codice JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE " . $dates_l['previous'] . $zone_where;
    $stmt_l_prev = $db->prepare($q_letture_prev);
    if ($zone !== 'all') $stmt_l_prev->bindValue(':zone', $params[':zone']);
    $stmt_l_prev->execute();
    $prev_letture = (int)($stmt_l_prev->fetch()['total'] ?? 0);

    $response["kpi"]["letture_effettuate"]["valore"] = $curr_letture;
    $response["kpi"]["letture_effettuate"]["delta"] = calculateDelta($curr_letture, $prev_letture);

    // --- 4. Fatturato Stimato ---
    $dates_f = getDateConditions($date, 'f.data');
    
    // Attuale
    $q_fatt_curr = "SELECT SUM(f.totale) as total FROM Fattura f JOIN Utenza u ON f.utenza = u.codice JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE " . $dates_f['current'] . $zone_where;
    $stmt_f_curr = $db->prepare($q_fatt_curr);
    if ($zone !== 'all') $stmt_f_curr->bindValue(':zone', $params[':zone']);
    $stmt_f_curr->execute();
    $curr_fatt = (float)($stmt_f_curr->fetch()['total'] ?? 0.0);

    // Precedente
    $q_fatt_prev = "SELECT SUM(f.totale) as total FROM Fattura f JOIN Utenza u ON f.utenza = u.codice JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod WHERE " . $dates_f['previous'] . $zone_where;
    $stmt_f_prev = $db->prepare($q_fatt_prev);
    if ($zone !== 'all') $stmt_f_prev->bindValue(':zone', $params[':zone']);
    $stmt_f_prev->execute();
    $prev_fatt = (float)($stmt_f_prev->fetch()['total'] ?? 0.0);

    $response["kpi"]["fatturato_stimato"]["valore"] = $curr_fatt;
    $response["kpi"]["fatturato_stimato"]["delta"] = calculateDelta($curr_fatt, $prev_fatt);

    // --- 5. Utenze Recenti ---
    $dates_recenti = getDateConditions($date, 'u.dataAp');
    $query5 = "
        SELECT 
            u.codice_parlante as codice, 
            c.ragSoc as cliente_nome, 
            CONCAT(p.indirizzo, ', ', p.città) as punto_erogazione, 
            p.codice_pod as pod,
            u.tipologia,
            u.dataAp as data_attivazione
        FROM Utenza u
        LEFT JOIN Cliente c ON u.cliente = c.codice
        LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod
        WHERE " . $dates_recenti['current'] . $zone_where . "
        ORDER BY u.dataAp DESC LIMIT 4
    ";

    $stmt5 = $db->prepare($query5);
    if ($zone !== 'all') $stmt5->bindValue(':zone', $params[':zone']);
    $stmt5->execute();
    
    while ($row = $stmt5->fetch(PDO::FETCH_ASSOC)) {
        $response["utenze_recenti"][] = [
            "id_utenza" => $row['codice'],
            "cliente" => $row['cliente_nome'],
            "punto_erogazione" => $row['punto_erogazione'],
            "pod" => $row['pod'],
            "data_attivazione" => $row['data_attivazione'],
            "tipologia" => $row['tipologia']
        ];
    }

    http_response_code(200);
    echo json_encode($response);

} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore nell'esecuzione delle query.", "error" => $e->getMessage()]);
}
?>
