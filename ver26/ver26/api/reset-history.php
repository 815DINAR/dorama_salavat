<?php
/**
 * API Endpoint: POST /api/reset-history
 * Назначение: Сбросить всю историю просмотров пользователя (функция "начать заново")
 * 
 * Входные данные (JSON):
 * {
 *   "userId": 123456789
 * }
 * 
 * Выходные данные (JSON):
 * {
 *   "success": true,
 *   "message": "Watch history reset successfully",
 *   "deletedCount": 150
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

$userId = $input['userId'];

// Валидация параметров
if (!is_numeric($userId) || $userId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid userId'
    ]);
    exit;
}

try {
    $pdo = getDBConnection();
    
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }
    
    $startTime = microtime(true);
    
    // ============================================
    // ПОЛУЧЕНИЕ КОЛИЧЕСТВА ЗАПИСЕЙ ДО УДАЛЕНИЯ
    // ============================================
    
    $countSql = "
        SELECT COUNT(*) as total
        FROM user_watch_history
        WHERE user_id = :user_id
    ";
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $countStmt->execute();
    $deletedCount = (int)$countStmt->fetch()['total'];
    
    // Если записей нет - возвращаем успех
    if ($deletedCount === 0) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'No watch history to reset',
            'deletedCount' => 0,
            'executionTime' => 0
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // ============================================
    // УДАЛЕНИЕ ВСЕХ ЗАПИСЕЙ ПОЛЬЗОВАТЕЛЯ
    // ============================================
    
    /**
     * Логика:
     * 1. Удаляем все записи из user_watch_history где user_id = переданный userId
     * 2. Это позволяет пользователю "начать заново" и увидеть все видео снова
     * 3. Операция атомарная - либо удаляются все записи, либо ни одна
     */
    
    $deleteSql = "
        DELETE FROM user_watch_history
        WHERE user_id = :user_id
    ";
    
    $deleteStmt = $pdo->prepare($deleteSql);
    $deleteStmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $deleteStmt->execute();
    
    $executionTime = (microtime(true) - $startTime) * 1000; // в миллисекундах
    
    // ============================================
    // ДОПОЛНИТЕЛЬНО: Очистка связанных данных (опционально)
    // ============================================
    
    /**
     * Если у вас есть другие таблицы, связанные с прогрессом просмотра,
     * можно их тоже очистить. Например:
     * - session_order (порядок просмотра в сессии)
     * - watch_progress (детальный прогресс просмотра)
     * 
     * Раскомментируйте нужные блоки ниже
     */
    
    // Очистка порядка сессии (если есть такая таблица)
    /*
    $pdo->prepare("DELETE FROM session_order WHERE user_id = :user_id")
        ->execute([':user_id' => $userId]);
    */
    
    // Очистка детального прогресса (если есть такая таблица)
    /*
    $pdo->prepare("DELETE FROM watch_progress WHERE user_id = :user_id")
        ->execute([':user_id' => $userId]);
    */
    
    // ============================================
    // ПРОВЕРКА РЕЗУЛЬТАТА
    // ============================================
    
    // Проверяем, что записи действительно удалены
    $verifyStmt = $pdo->prepare($countSql);
    $verifyStmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $verifyStmt->execute();
    $remainingCount = (int)$verifyStmt->fetch()['total'];
    
    if ($remainingCount > 0) {
        throw new Exception('Failed to delete all records');
    }
    
    // ============================================
    // Логирование для мониторинга
    // ============================================
    
    error_log(sprintf(
        "[RESET HISTORY] userId=%d, deletedCount=%d, executionTime=%.2fms",
        $userId,
        $deletedCount,
        $executionTime
    ));
    
    // ============================================
    // Возврат результата
    // ============================================
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Watch history reset successfully',
        'deletedCount' => $deletedCount,
        'remainingCount' => $remainingCount,
        'executionTime' => round($executionTime, 2) // для отладки
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (PDOException $e) {
    error_log("[RESET HISTORY ERROR] Database error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
    
} catch (Exception $e) {
    error_log("[RESET HISTORY ERROR] " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
}
?>
