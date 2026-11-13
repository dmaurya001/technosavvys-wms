<?php
/**
 * TECHNOSAVVYS WORKSHOP MANAGEMENT SYSTEM (WMS)
 * HOSTINGER DATABASE CONFIGURATION & PDO CONNECTION
 */

// Allow cross-origin requests from frontend (Vercel, custom domain, localhost)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -----------------------------------------------------------------------------
// Hostinger Database Credentials (Update these with your Hostinger hPanel values)
// -----------------------------------------------------------------------------
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'u123456789_technosavvys');
define('DB_USER', getenv('DB_USER') ?: 'u123456789_admin');
define('DB_PASS', getenv('DB_PASS') ?: 'YourPasswordHere');

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'Database connection failed: ' . $e->getMessage(),
                'hint'    => 'Verify DB_HOST, DB_NAME, DB_USER, and DB_PASS in config.php'
            ]);
            exit();
        }
    }
    return $pdo;
}
