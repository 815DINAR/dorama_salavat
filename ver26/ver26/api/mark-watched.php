<?php
/**
 * API Endpoint: POST /api/mark-watched
 * Назначение: Отметить конкретное видео как просмотренное пользователем
 * 
 * Входные данные (JSON):
 * {
 *   "userId": 123456789,
 *   "videoId": 123,
 *   "watchedAt": "2025-11-15T13:59:18Z"  // опционально
 * }
 * 
 * Выходные данные (JSON):
 * {
 *   "success": true,
 *   "message": "Video marked as watched",
 *   "isNewRecord": true
 * }
 */

require_once __DIR__ . '/../config/database.php';

// Настройка заголовков
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Проверка метода запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit;
}

// Получение входных данных
$input = json_decode(file_get_contents('php://input'), true);

// Валидация обязательных параметров
if (!$input || !isset($input['userId'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required parameter: userId'
    ]);
    exit;
}

if (!isset($input['videoId'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required parameter: videoId'
    ]);
    exit;
}

$userId = $input['userId'];
$videoId = $input['videoId'];
$watchedAt = isset($input['watchedAt']) ? $input['watchedAt'] : null;

// Валидация параметров
if (!is_numeric($userId) || $userId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid userId'
    ]);
    exit;
}

if (!is_numeric($videoId) || $videoId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid videoId'
    ]);
    exit;
}

try {
    $pdo = getDBConnection();
    
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }
    
    // ============================================
    // КРИТИЧЕСКИЙ ЗАПРОС: INSERT с ON DUPLICATE KEY UPDATE
    // ============================================
    
    /**
     * Логика запроса:
     * 1. Пытаемся вставить новую запись в user_watch_history
     * 2. Если пара (user_id, video_id) уже существует (из-за UNIQUE KEY):
     *    - MySQL вызовет ON DUPLICATE KEY UPDATE
     *    - Обновим только watched_at (дата последнего просмотра)
     * 3. Это защищает от дубликатов и race conditions
     * 
     * Важно: Таблица user_watch_history должна иметь UNIQUE KEY на (user_id, video_id)
     */
    
    $startTime = microtime(true);
    
    // Проверяем существование видео
    $checkSql = "SELECT id FROM videos WHERE id = :video_id AND is_active = 1";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->bindValue(':video_id', $videoId, PDO::PARAM_INT);
    $checkStmt->execute();
    
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Video not found or inactive'
        ]);
        exit;
    }
    
    // Определяем время просмотра
    if ($watchedAt) {
        // Преобразуем ISO 8601 в MySQL DATETIME
        $watchedAtDateTime = date('Y-m-d H:i:s', strtotime($watchedAt));
    } else {
        $watchedAtDateTime = date('Y-m-d H:i:s');
    }
    
    // Вставка с защитой от дубликатов
    $sql = "
        INSERT INTO user_watch_history (user_id, video_id, watched_at)
        VALUES (:user_id, :video_id, :watched_at)
        ON DUPLICATE KEY UPDATE 
            watched_at = VALUES(watched_at)
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':video_id', $videoId, PDO::PARAM_INT);
    $stmt->bindValue(':watched_at', $watchedAtDateTime, PDO::PARAM_STR);
    
    $stmt->execute();
    
    $executionTime = (microtime(true) - $startTime) * 1000; // в миллисекундах
    
    // Определяем, была ли это новая запись или обновление существующей
    // PDO::rowCount() вернёт:
    // - 1 если была вставка (INSERT)
    // - 2 если было обновление (UPDATE)
    // - 0 если данные не изменились
    $rowCount = $stmt->rowCount();
    $isNewRecord = ($rowCount === 1);
    
    // ============================================
    // Логирование для мониторинга
    // ============================================
    
    $actionType = $isNewRecord ? 'INSERT' : 'UPDATE';
    
    error_log(sprintf(
        "[MARK WATCHED] action=%s, userId=%d, videoId=%d, executionTime=%.2fms",
        $actionType,
        $userId,
        $videoId,
        $executionTime
    ));
    
    // ============================================
    // Возврат результата
    // ============================================
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Video marked as watched',
        'isNewRecord' => $isNewRecord,
        'watchedAt' => $watchedAtDateTime,
        'executionTime' => round($executionTime, 2) // для отладки
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (PDOException $e) {
    error_log("[MARK WATCHED ERROR] Database error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
    
} catch (Exception $e) {
    error_log("[MARK WATCHED ERROR] " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
}
?>
