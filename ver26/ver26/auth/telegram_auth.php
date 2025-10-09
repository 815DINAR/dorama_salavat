<?php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

define('BOT_TOKEN', '8437727345:AAEJsxuxQqJQDPNgR9ZHRi9KZRyUrYro4Lg');

// Генерация ID сессии
function generateSessionId() {
    return bin2hex(random_bytes(16));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['action'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

$action = $input['action'];

try {
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception('Ошибка подключения к БД');
    }
    
    switch ($action) {
        case 'login':
            if (!isset($input['user']) || !isset($input['user']['id'])) {
                throw new Exception('Данные пользователя не переданы');
            }
            
            $user = $input['user'];
            $userId = $user['id'];
            $username = $user['username'] ?? 'user_' . $userId;
            
            // Создаем/обновляем пользователя
            $sql = "INSERT INTO users (user_id, username, first_name, last_name, language_code, is_premium, first_login, last_login)
                VALUES (:user_id, :username, :first_name, :last_name, :language_code, :is_premium, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    username = VALUES(username),
                    first_name = VALUES(first_name),
                    last_name = VALUES(last_name),
                    last_login = NOW()";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':user_id' => $userId,
                ':username' => $username,
                ':first_name' => $user['first_name'] ?? '',
                ':last_name' => $user['last_name'] ?? '',
                ':language_code' => $user['language_code'] ?? 'en',
                ':is_premium' => $user['is_premium'] ?? false
            ]);
            
            // Создаем новую сессию
            $sessionId = generateSessionId();
            
            $sql = "INSERT INTO sessions (session_id, user_id, login_time, last_activity)
                    VALUES (:session_id, :user_id, NOW(), NOW())";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':session_id' => $sessionId,
                ':user_id' => $userId
            ]);
            
            // Получаем данные пользователя
            $stmt = $pdo->prepare("
                SELECT GROUP_CONCAT(DISTINCT v.filename) AS favorites
                FROM favorites f
                JOIN videos v ON v.id = f.video_id
                WHERE f.user_id = :user_id AND v.is_active = 1
            ");
            $stmt->execute([':user_id' => $userId]);
            $favorites = $stmt->fetch()['favorites'] ?? '{}';
            
            echo json_encode([
                'success' => true,
                'message' => 'Авторизация успешна',
                'session_id' => $sessionId,
                'user_data' => [
                    'id' => $userId,
                    'username' => $username,
                    'favorites' => json_decode(str_replace(['{', '}'], ['[', ']'], $favorites))
                ]
            ]);
            break;
            
        case 'logout':
            if (!isset($input['user_id']) || !isset($input['session_id'])) {
                throw new Exception('Не переданы user_id или session_id');
            }
            
            $userId = $input['user_id'];
            $sessionId = $input['session_id'];
            
            // Закрываем сессию
            $sql = "UPDATE sessions 
                    SET logout_time = NOW(), 
                        duration_seconds = EXTRACT(EPOCH FROM (NOW() - login_time))
                    WHERE session_id = :session_id 
                    AND user_id = :user_id 
                    AND logout_time IS NULL";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':session_id' => $sessionId,
                ':user_id' => $userId
            ]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Сессия завершена'
            ]);
            break;
            
        default:
            throw new Exception('Неизвестное действие: ' . $action);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>