<?php
/**
 * TECHNOSAVVYS WMS - HOSTINGER DATABASE CONNECTION TESTER
 */

header('Content-Type: text/html; charset=utf-8');
require_once __DIR__ . '/config.php';

echo '<!DOCTYPE html><html><head><title>Database Connection Test</title><style>
body { font-family: system-ui, sans-serif; background: #071913; color: #fff; padding: 40px; }
.card { background: #0c2b22; border: 1px solid #14533d; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; }
.success { color: #10b981; font-weight: bold; }
.error { color: #ef4444; font-weight: bold; }
.info { color: #facc15; }
code { background: #05140f; padding: 2px 6px; border-radius: 4px; }
</style></head><body><div class="card">';

echo '<h2>Technosavvys WMS &mdash; Hostinger Database Test</h2>';
echo '<p>Host: <code>' . htmlspecialchars(DB_HOST) . ':' . htmlspecialchars(DB_PORT) . '</code></p>';
echo '<p>Database: <code>' . htmlspecialchars(DB_NAME) . '</code></p>';
echo '<p>User: <code>' . htmlspecialchars(DB_USER) . '</code></p>';

try {
    $pdo = getDbConnection();
    echo '<p class="success">&#10004; Database Connected Successfully!</p>';

    $tables = ['admins', 'workshops', 'workshop_sessions', 'students', 'attendance_records', 'certificates', 'audit_logs'];
    echo '<h3>Table Verification:</h3><ul>';
    foreach ($tables as $tbl) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) AS total FROM `" . $tbl . "`");
            $count = $stmt->fetchColumn();
            echo '<li class="success">&#10004; Table <code>' . $tbl . '</code> exists &mdash; ' . $count . ' rows</li>';
        } catch (Exception $e) {
            echo '<li class="error">&#10008; Table <code>' . $tbl . '</code> missing! Please import schema.sql into phpMyAdmin.</li>';
        }
    }
    echo '</ul>';
} catch (Exception $e) {
    echo '<p class="error">&#10008; Connection Error: ' . htmlspecialchars($e->getMessage()) . '</p>';
}

echo '</div></body></html>';
