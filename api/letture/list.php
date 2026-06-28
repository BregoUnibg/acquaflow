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
    $tipo = isset($_GET['tipo']) ? $_GET['tipo'] : 'all';
    $data_da = isset($_GET['data_da']) ? $_GET['data_da'] : '';
    $data_a = isset($_GET['data_a']) ? $_GET['data_a'] : '';

    // Costruzione query base
    $sql = "SELECT l.*, 
            u.codice_parlante as utenza_codice, 
            f.codice_parlante as fattura_codice_parlante,
            p.indirizzo, p.città, p.distretto 
            FROM Lettura l
            LEFT JOIN Utenza u ON l.utenza = u.codice
            LEFT JOIN Fattura f ON l.fattura = f.codice
            LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod";
            
    $countSql = "SELECT COUNT(*) as total 
                 FROM Lettura l
                 LEFT JOIN Utenza u ON l.utenza = u.codice
                 LEFT JOIN Fattura f ON l.fattura = f.codice
                 LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod";

    $whereParams = [];
    $whereConditions = ["1=1"];

    // Filtro Ricerca (Multi-Token: Codice Lettura, Utenza, Indirizzo, Città)
    if (!empty($search)) {
        $tokens = preg_split('/\s+/', trim($search));
        foreach ($tokens as $index => $token) {
            $param_name = ":token_" . $index;
            $whereConditions[] = "(l.codice_parlante LIKE $param_name OR u.codice_parlante LIKE $param_name OR f.codice_parlante LIKE $param_name OR p.indirizzo LIKE $param_name OR p.città LIKE $param_name)";
            $whereParams[$param_name] = "%" . $token . "%";
        }
    }

    // Filtro zona
    if ($zona !== 'all' && !empty($zona)) {
        $whereConditions[] = "p.distretto = :zona";
        $whereParams[':zona'] = $zona;
    }

    // Filtro tipo
    if ($tipo !== 'all' && !empty($tipo)) {
        $whereConditions[] = "l.tipo_lettura = :tipo";
        $whereParams[':tipo'] = $tipo;
    }

    // Filtro Periodo
    if (!empty($data_da)) {
        $whereConditions[] = "l.data >= :data_da";
        $whereParams[':data_da'] = $data_da;
    }
    if (!empty($data_a)) {
        $whereConditions[] = "l.data <= :data_a";
        $whereParams[':data_a'] = $data_a;
    }

    $whereClause = " WHERE " . implode(' AND ', $whereConditions);
    $sql .= $whereClause;
    $countSql .= $whereClause;

    $sort_param = isset($_GET['sort']) ? $_GET['sort'] : '';
    
    $sortMap = [
        'codice_parlante' => 'l.codice_parlante',
        'utenza' => 'u.codice_parlante',
        'fattura' => 'f.codice_parlante',
        'data' => 'l.data',
        'valore' => 'l.valore'
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
    
    if (empty($orderClauses)) {
        $orderClauses[] = 'l.data DESC';
    }
    $orderClauses[] = 'l.codice DESC';
    
    $orderBySql = "ORDER BY " . implode(', ', $orderClauses);

    // Ordine e Limit
    $sql .= " $orderBySql LIMIT :limit OFFSET :offset";

    // Esegui la count
    $stmtCount = $db->prepare($countSql);
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
    $letture = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formattazione aggiuntiva per il JSON
    $mesi_it = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    
    foreach ($letture as &$l) {
        // Formatta data (es. 24 Ott 2023)
        $ts = strtotime($l['data']);
        $l['data_formattata'] = date('d', $ts) . " " . $mesi_it[date('n', $ts) - 1] . " " . date('Y', $ts);
        
        // Indirizzo formattato
        $l['indirizzo_completo'] = trim($l['indirizzo'] . ($l['città'] ? ', ' . $l['città'] : ''), ', ');
    }

    echo json_encode([
        'success' => true,
        'data' => $letture,
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
