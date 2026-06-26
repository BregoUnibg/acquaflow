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
            u.codice as utenza_codice, 
            p.indirizzo, p.città, p.distretto 
            FROM Lettura l
            LEFT JOIN Utenza u ON l.utenza = u.codice
            LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod";
            
    $countSql = "SELECT COUNT(*) as total 
                 FROM Lettura l
                 LEFT JOIN Utenza u ON l.utenza = u.codice
                 LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod";

    $whereParams = [];
    $whereConditions = ["1=1"];

    // Ricerca testuale
    if (!empty($search)) {
        $whereConditions[] = "(l.codice LIKE :search OR l.codice_parlante LIKE :search OR u.codice LIKE :search OR p.indirizzo LIKE :search)";
        $whereParams[':search'] = "%{$search}%";
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

    // Ordine e Limit
    $sql .= " ORDER BY l.data DESC, l.codice DESC LIMIT :limit OFFSET :offset";

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
