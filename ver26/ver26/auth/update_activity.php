<?php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['user_id']) || !isset($input['session_id'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

try {
    $userId = $input['user_id'];
    $sessionId = $input['session_id'];
    
    $pdo = getDBConnection();
    
    // ИСПРАВЛЕНО ДЛЯ MYSQL: используем TIMESTAMPDIFF вместо EXTRACT
    $sql = "UPDATE sessions 
            SET last_activity = NOW(),
                duration_seconds = TIMESTAMPDIFF(SECOND, login_time, NOW())
            WHERE session_id = ? 
            AND user_id = ? 
            AND logout_time IS NULL";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$sessionId, $userId]);
    
    // Обновляем активность пользователя
    $stmt = $pdo->prepare("UPDATE users SET last_activity = NOW() WHERE user_id = ?");
    $stmt->execute([$userId]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Активность обновлена',
        'last_activity' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>