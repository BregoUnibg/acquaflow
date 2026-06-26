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
        "clienti_attivi" => 0,
        "utenze_attive" => 0,
        "letture_effettuate" => 0,
        "fatturato_stimato" => 0
    ],
    "utenze_recenti" => []
];

// Funzione helper per costruire la clausola WHERE della data
function getDateWhere($dateFilter, $column) {
    if ($dateFilter === 'month') {
        return "MONTH($column) = MONTH(CURDATE()) AND YEAR($column) = YEAR(CURDATE())";
    } elseif ($dateFilter === 'year') {
        return "YEAR($column) = YEAR(CURDATE())";
    }
    // Default 30 days
    return "$column >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
}

try {
    // PREPARAZIONE FILTRI COMUNI
    $zone_join = "";
    $zone_where = "";
    $params = [];
    if ($zone !== 'all') {
        $zone_join = " JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod ";
        $zone_where = " AND p.distretto = :zone ";
        $params[':zone'] = $zone;
    }

    // 1. Clienti Attivi (filtrati per distretto se necessario)
    $query1 = "SELECT COUNT(DISTINCT c.codice) as total FROM Cliente c";
    if ($zone !== 'all') {
        $query1 .= " JOIN Utenza u ON c.codice = u.cliente" . $zone_join . " WHERE 1=1 " . $zone_where;
    }
    $stmt1 = $db->prepare($query1);
    if ($zone !== 'all') $stmt1->bindValue(':zone', $params[':zone']);
    $stmt1->execute();
    $row1 = $stmt1->fetch();
    $response["kpi"]["clienti_attivi"] = (int)$row1['total'];

    // 2. Utenze Attive (filtrate per dataAp e distretto)
    $date_where_u = getDateWhere($date, 'u.dataAp');
    $query2 = "SELECT COUNT(DISTINCT u.codice) as total FROM Utenza u " . $zone_join . " WHERE u.stato = 'attiva' AND " . $date_where_u . $zone_where;
    $stmt2 = $db->prepare($query2);
    if ($zone !== 'all') $stmt2->bindValue(':zone', $params[':zone']);
    $stmt2->execute();
    $row2 = $stmt2->fetch();
    $response["kpi"]["utenze_attive"] = (int)$row2['total'];

    // 3. Letture Effettuate
    $date_where_l = getDateWhere($date, 'l.data');
    $query3 = "SELECT COUNT(*) as total FROM Lettura l JOIN Utenza u ON l.utenza = u.codice " . $zone_join . " WHERE " . $date_where_l . $zone_where;
    $stmt3 = $db->prepare($query3);
    if ($zone !== 'all') $stmt3->bindValue(':zone', $params[':zone']);
    $stmt3->execute();
    $row3 = $stmt3->fetch();
    $response["kpi"]["letture_effettuate"] = (int)$row3['total'];

    // 4. Fatturato Totale
    $date_where_f = getDateWhere($date, 'f.data');
    $query4 = "SELECT SUM(f.totale) as totale_fatturato FROM Fattura f JOIN Utenza u ON f.utenza = u.codice " . $zone_join . " WHERE " . $date_where_f . $zone_where;
    $stmt4 = $db->prepare($query4);
    if ($zone !== 'all') $stmt4->bindValue(':zone', $params[':zone']);
    $stmt4->execute();
    $row4 = $stmt4->fetch();
    $response["kpi"]["fatturato_stimato"] = $row4['totale_fatturato'] ? (float)$row4['totale_fatturato'] : 0.0;

    // 5. Utenze Recenti (per la tabella)
    $query5 = "
        SELECT 
            u.codice, 
            c.ragSoc as cliente_nome, 
            CONCAT(p.indirizzo, ', ', p.città) as punto_erogazione, 
            u.tipologia,
            u.dataAp as data_attivazione
        FROM Utenza u
        LEFT JOIN Cliente c ON u.cliente = c.codice
        LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod
        WHERE 1=1 
    ";
    
    // Per le utenze recenti applichiamo anche qui i filtri
    if ($zone !== 'all') {
        $query5 .= " AND p.distretto = :zone ";
    }
    $query5 .= " AND " . getDateWhere($date, 'u.dataAp');
    
    $query5 .= " ORDER BY u.dataAp DESC LIMIT 4";

    $stmt5 = $db->prepare($query5);
    if ($zone !== 'all') $stmt5->bindValue(':zone', $params[':zone']);
    $stmt5->execute();
    
    while ($row = $stmt5->fetch()) {
        $response["utenze_recenti"][] = [
            "id_utenza" => $row['codice'],
            "cliente" => $row['cliente_nome'],
            "punto_erogazione" => $row['punto_erogazione'],
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
