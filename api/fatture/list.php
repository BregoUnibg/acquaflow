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
    $data_da = isset($_GET['data_da']) ? $_GET['data_da'] : '';
    $data_a = isset($_GET['data_a']) ? $_GET['data_a'] : '';
    $importo_min = isset($_GET['importo_min']) && $_GET['importo_min'] !== '' ? (float)$_GET['importo_min'] : null;
    $importo_max = isset($_GET['importo_max']) && $_GET['importo_max'] !== '' ? (float)$_GET['importo_max'] : null;

    // Costruzione query base per le fatture
    $selectCols = "f.*, 
                   u.codice_parlante as utenza_codice_parlante,
                   c.ragSoc, c.cf_piva,
                   p.indirizzo as punto_indirizzo, p.città as punto_città, p.distretto,
                   (SELECT COUNT(*) FROM Lettura l WHERE l.fattura = f.codice) as num_letture";
                   
    $fromJoins = "FROM Fattura f
                  LEFT JOIN Cliente c ON f.cliente = c.codice
                  LEFT JOIN Utenza u ON f.utenza = u.codice
                  LEFT JOIN PuntoFornitura p ON u.codice_pod = p.codice_pod";

    $whereParams = [];
    $whereConditions = ["1=1"];

    // Filtro Ricerca (Multi-Token: Codice Fattura, Cliente, Utenza, CF/PIVA, Indirizzo PF, Città PF)
    if (!empty($search)) {
        $tokens = preg_split('/\s+/', trim($search));
        foreach ($tokens as $index => $token) {
            if ($token === '-') continue;
            $param_name = ":token_" . $index;
            $whereConditions[] = "(f.codice_parlante LIKE $param_name OR c.ragSoc LIKE $param_name OR u.codice_parlante LIKE $param_name OR c.cf_piva LIKE $param_name OR p.indirizzo LIKE $param_name OR p.città LIKE $param_name)";
            $whereParams[$param_name] = "%" . $token . "%";
        }
    }

    // Filtro zona
    if ($zona !== 'all' && !empty($zona)) {
        // La zona mappata dall'interfaccia a volte è 'nord-ovest', controlliamo
        $zonaMap = [
            'nord-ovest' => 'Nord-Ovest BG',
            'sud-est' => 'Sud-Est BG e BS',
            'brianza' => 'Brianza',
            'lomellina' => 'Lomellina',
            'lecchese e lario' => 'Lecchese e Lario',
            'martesana e cremasco' => 'Martesana e Cremasco'
        ];
        $zKey = strtolower($zona);
        $realZona = isset($zonaMap[$zKey]) ? $zonaMap[$zKey] : $zona;
        
        $whereConditions[] = "p.distretto = :zona";
        $whereParams[':zona'] = $realZona;
    }

    // Filtro Stato
    if ($stato !== 'all' && !empty($stato)) {
        $whereConditions[] = "f.stato_pagamento = :stato";
        $whereParams[':stato'] = $stato;
    }

    // Filtro Periodo
    if (!empty($data_da)) {
        $whereConditions[] = "f.data >= :data_da";
        $whereParams[':data_da'] = $data_da;
    }
    if (!empty($data_a)) {
        $whereConditions[] = "f.data <= :data_a";
        $whereParams[':data_a'] = $data_a;
    }

    // Filtro Importo
    if ($importo_min !== null) {
        $whereConditions[] = "f.totale >= :importo_min";
        $whereParams[':importo_min'] = $importo_min;
    }
    if ($importo_max !== null) {
        $whereConditions[] = "f.totale <= :importo_max";
        $whereParams[':importo_max'] = $importo_max;
    }

    $whereClause = " WHERE " . implode(' AND ', $whereConditions);

    // SQL per KPI Stats (applica gli stessi filtri)
    $kpiSql = "SELECT 
                   SUM(f.totale) as totale_emesso,
                   SUM(CASE WHEN f.stato_pagamento NOT IN ('Pagata', 'Annullata') THEN f.totale ELSE 0 END) as totale_incassare,
                   SUM(CASE WHEN f.stato_pagamento = 'Scaduta' THEN f.totale ELSE 0 END) as scadute_sum,
                   SUM(CASE WHEN f.stato_pagamento = 'Scaduta' THEN 1 ELSE 0 END) as scadute_count
               $fromJoins
               $whereClause";

    $sort_param = isset($_GET['sort']) ? $_GET['sort'] : '';
    
    $sortMap = [
        'codice_parlante' => 'f.codice_parlante',
        'cliente' => 'c.ragSoc',
        'utenza' => 'u.codice_parlante',
        'data' => 'f.data',
        'data_scadenza' => 'f.data_scadenza',
        'totale' => 'f.totale',
        'letture' => 'num_letture'
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
        $orderClauses[] = 'f.data DESC';
    }
    $orderClauses[] = 'f.codice DESC';
    
    $orderBySql = "ORDER BY " . implode(', ', $orderClauses);

    // SQL Principale
    $sql = "SELECT $selectCols $fromJoins $whereClause $orderBySql LIMIT :limit OFFSET :offset";
    
    // SQL Count
    $countSql = "SELECT COUNT(*) as total $fromJoins $whereClause";

    // Esegui KPI stats
    $stmtKpi = $db->prepare($kpiSql);
    foreach ($whereParams as $key => $val) {
        $stmtKpi->bindValue($key, $val);
    }
    $stmtKpi->execute();
    $kpiData = $stmtKpi->fetch(PDO::FETCH_ASSOC);

    // Esegui COUNT
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
    $fatture = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formattazione aggiuntiva
    $mesi_it = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    
    foreach ($fatture as &$f) {
        $tsEmissione = strtotime($f['data']);
        $f['data_emissione_fmt'] = date('d', $tsEmissione) . " " . $mesi_it[date('n', $tsEmissione) - 1] . " " . date('Y', $tsEmissione);
        
        if ($f['data_scadenza']) {
            $tsScad = strtotime($f['data_scadenza']);
            $f['data_scadenza_fmt'] = date('d', $tsScad) . " " . $mesi_it[date('n', $tsScad) - 1] . " " . date('Y', $tsScad);
        } else {
            $f['data_scadenza_fmt'] = '-';
        }

        if ($f['data_pagamento']) {
            $tsPag = strtotime($f['data_pagamento']);
            $f['data_pagamento_fmt'] = date('d', $tsPag) . " " . $mesi_it[date('n', $tsPag) - 1] . " " . date('Y', $tsPag);
        } else {
            $f['data_pagamento_fmt'] = null;
        }

        $f['utenza_str'] = trim($f['punto_indirizzo'] . ($f['punto_città'] ? ', ' . $f['punto_città'] : ''), ', ');
        $f['spedizione_str'] = trim($f['indirizzo_fatturazione'] . ($f['città_fatturazione'] ? ', ' . $f['città_fatturazione'] : ''), ', ');
    }

    echo json_encode([
        'success' => true,
        'data' => $fatture,
        'kpis' => [
            'totale_emesso' => (float)$kpiData['totale_emesso'],
            'totale_incassare' => (float)$kpiData['totale_incassare'],
            'scadute_sum' => (float)$kpiData['scadute_sum'],
            'scadute_count' => (int)$kpiData['scadute_count']
        ],
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
