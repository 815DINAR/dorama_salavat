<?php
// Конфигурация подключения к MySQL
define('DB_HOST', 'localhost'); // или укажи IP/домен, если база не на этом же сервере
define('DB_PORT', '3306');
define('DB_NAME', 'u3000935_dorama_shorts');
define('DB_USER', 'u3000935_Dinar_dorama');
define('DB_PASS', 'Dinar_dorama2025');

function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        return null;
    }
}
?>
