<?php
// /api/config/database.php

class Database {
    
    private $host = "localhost";
    private $db_name = "my_distribuzioneacqua"; 
    private $username = "distribuzioneacqua"; 
    private $password = ""; 
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->password);
            $this->conn->exec("set names utf8");
            // Imposta l'attributo di errore PDO in modo che lanci eccezioni
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            // Restituisce array associativi di default
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch(PDOException $exception) {
            // Su un server in produzione (Altervista), non stampare a schermo l'errore esatto per motivi di sicurezza,
            // ma restituisci un JSON pulito
            http_response_code(500);
            echo json_encode(["message" => "Errore di connessione al database."]);
            exit;
        }

        return $this->conn;
    }
}
?>
