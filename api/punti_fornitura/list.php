<?php
header("Content-Type: application/json");
require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Parametri
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $zona = isset($_GET['zona']) ? $_GET['zona'] : 'all';
    $stato = isset($_GET['stato']) ? $_GET['stato'] : 'all';
    $diametri = isset($_GET['diametri']) ? $_GET['diametri'] : '';

    // Costruzione query base
    $sql = "SELECT p.*, 
            IF(COUNT(u.codice) > 0, 'Occupato', 'Libero') as stato_calcolato 
            FROM PuntoFornitura p 
            LEFT JOIN Utenza u ON p.codice_pod = u.codice_pod AND u.stato = 'attiva'";
    
    $countSql = "SELECT COUNT(DISTINCT p.codice_pod) as total 
                 FROM PuntoFornitura p 
                 LEFT JOIN Utenza u ON p.codice_pod = u.codice_pod AND u.stato = 'attiva'";

    $whereParams = [];
    $whereConditions = [];

    // Filtro Ricerca (Multi-Token: Codice POD, Indirizzo, Città)
    if (!empty($search)) {
        $tokens = preg_split('/\s+/', trim($search));
        foreach ($tokens as $index => $token) {
            if ($token === '-') continue;
            $param_name = ":token_" . $index;
            $whereConditions[] = "(p.codice_pod LIKE $param_name OR p.indirizzo LIKE $param_name OR p.città LIKE $param_name)";
            $whereParams[$param_name] = "%" . $token . "%";
        }
    }

    // Filtro zona
    if ($zona !== 'all' && !empty($zona)) {
        $whereConditions[] = "p.distretto = :zona";
        $whereParams[':zona'] = $zona;
    }

    // Filtro diametri (stringa separata da virgole es. "DN15,DN20")
    if (!empty($diametri)) {
        $diametriArray = array_filter(explode(',', $diametri));
        if (count($diametriArray) > 0) {
            $diametroPlaceholders = [];
            foreach ($diametriArray as $index => $d) {
                $key = ":diametro_" . $index;
                $diametroPlaceholders[] = $key;
                $whereParams[$key] = $d;
            }
            $whereConditions[] = "p.diametro_tubo IN (" . implode(',', $diametroPlaceholders) . ")";
        }
    }

    // Aggiungi condizioni WHERE prima del GROUP BY
    if (count($whereConditions) > 0) {
        $whereClause = " WHERE " . implode(' AND ', $whereConditions);
        $sql .= $whereClause;
        $countSql .= $whereClause;
    }

    // GROUP BY necessario per l'aggregazione COUNT(u.codice)
    $sql .= " GROUP BY p.codice_pod";
    $countSql .= " GROUP BY p.codice_pod";

    // Filtro Stato (viene applicato con HAVING dato che è un campo calcolato su aggregazione)
    if ($stato === 'Occupato') {
        $sql .= " HAVING COUNT(u.codice) > 0";
    } else if ($stato === 'Libero') {
        $sql .= " HAVING COUNT(u.codice) = 0";
    }

    // Ordine e Limit
    $sort_param = isset($_GET['sort']) ? $_GET['sort'] : '';
    
    $sortMap = [
        'codice_pod' => 'p.codice_pod',
        'localita' => 'p.città',
        'diametro_tubo' => 'p.diametro_tubo'
    ];
    
    $orderClauses = [];
    if (!empty($sort_param)) {
        $parts = explode(':', $sort_param);
        if (count($parts) === 2) {
            $by = $parts[0];
            $dir = strtolower($parts[1]) === 'asc' ? 'ASC' : 'DESC';
            if (isset($sortMap[$by])) {
                $orderClauses[] = $sortMap[$by] . " " . $dir;
            }
        }
    }
    
    $orderClauses[] = 'p.codice_pod ASC'; // fallback
    
    $orderBySql = "ORDER BY " . implode(', ', $orderClauses);
    $sql .= " $orderBySql LIMIT :limit OFFSET :offset";

    // Esegui la count (dobbiamo contare i gruppi o avvolgere la query in una subquery)
    if ($stato !== 'all') {
        // Se c'è HAVING, il countSql ha bisogno dell'HAVING e di essere usato come subquery
        if ($stato === 'Occupato') {
            $countSql .= " HAVING COUNT(u.codice) > 0";
        } else if ($stato === 'Libero') {
            $countSql .= " HAVING COUNT(u.codice) = 0";
        }
    }
    
    // Per avere il COUNT totale di una query con GROUP BY, usiamo una subquery
    $finalCountSql = "SELECT COUNT(*) as total FROM ($countSql) as sub";
    
    $stmtCount = $db->prepare($finalCountSql);
    foreach ($whereParams as $key => $val) {
        $stmtCount->bindValue($key, $val);
    }
    $stmtCount->execute();
    $total = $stmtCount->fetch(PDO::FETCH_ASSOC)['total'];

    // Esegui query principale
    $stmt = $db->prepare($sql);
    foreach ($whereParams as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $punti = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $punti,
        'total' => (int)$total,
        'limit' => $limit,
        'offset' => $offset
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}
