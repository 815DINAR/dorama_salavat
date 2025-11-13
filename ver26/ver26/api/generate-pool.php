<?php
/**
 * API Endpoint: POST /api/generate-pool
 * Назначение: Генерирует пул из N непросмотренных видео для пользователя
 * 
 * Входные данные (JSON):
 * {
 *   "userId": 123456789,
 *   "poolSize": 50
 * }
 * 
 * Выходные данные (JSON):
 * {
 *   "success": true,
 *   "videos": [...],
 *   "poolSize": 50,
 *   "remainingCount": 450
 * }
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/s3_config.php';

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

if (!$input || !isset($input['userId'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required parameter: userId'
    ]);
    exit;
}

$userId = $input['userId'];
$poolSize = isset($input['poolSize']) ? (int)$input['poolSize'] : 50;

// Валидация параметров
if (!is_numeric($userId) || $userId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid userId'
    ]);
    exit;
}

if ($poolSize < 1 || $poolSize > 100) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'poolSize must be between 1 and 100'
    ]);
    exit;
}

try {
    $pdo = getDBConnection();
    
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }
    
    // ============================================
    // КРИТИЧЕСКИЙ ЗАПРОС: LEFT JOIN для фильтрации просмотренных видео
    // ============================================
    
    /**
     * Логика запроса:
     * 1. Берём все активные видео из таблицы videos
     * 2. Делаем LEFT JOIN с user_watch_history по условию:
     *    - videos.id = user_watch_history.video_id
     *    - user_watch_history.user_id = переданный userId
     * 3. Фильтруем WHERE user_watch_history.video_id IS NULL
     *    Это даёт нам только те видео, которых НЕТ в истории просмотров пользователя
     * 4. Сортируем случайным образом (ORDER BY RAND())
     * 5. Берём первые N записей (LIMIT)
     */
    
    $sql = "
        SELECT 
            v.id,
            v.filename,
            v.s3_url,
            v.title,
            v.description,
            v.series,
            v.seasons,
            v.status,
            v.country,
            v.genre,
            v.year,
            v.file_size,
            v.uploaded_at
        FROM videos v
        LEFT JOIN user_watch_history uwh 
            ON v.id = uwh.video_id AND uwh.user_id = :user_id
        WHERE v.is_active = 1 
            AND uwh.video_id IS NULL
        ORDER BY RAND()
        LIMIT :pool_size
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':pool_size', $poolSize, PDO::PARAM_INT);
    
    $startTime = microtime(true);
    $stmt->execute();
    $executionTime = (microtime(true) - $startTime) * 1000; // в миллисекундах
    
    $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ============================================
    // Подсчёт общего количества оставшихся непросмотренных видео
    // ============================================
    
    $countSql = "
        SELECT COUNT(*) as total
        FROM videos v
        LEFT JOIN user_watch_history uwh 
            ON v.id = uwh.video_id AND uwh.user_id = :user_id
        WHERE v.is_active = 1 
            AND uwh.video_id IS NULL
    ";
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $countStmt->execute();
    $remainingCount = (int)$countStmt->fetch()['total'];
    
    // ============================================
    // Форматирование выходных данных
    // ============================================
    
    // Формируем полные URL для видео
    $formattedVideos = array_map(function($video) {
        // Если s3_url уже есть - используем его, иначе генерируем
        $url = $video['s3_url'] ?: 
            'https://' . rtrim(S3_ENDPOINT, '/') . '/' . rtrim(S3_BUCKET, '/') . '/' . rawurlencode($video['filename']);
        
        return [
            'id' => (int)$video['id'],
            'filename' => $video['filename'],
            'url' => $url,
            's3_url' => $url,
            'title' => $video['title'] ?: 'Без названия',
            'description' => $video['description'] ?: '',
            'series' => $video['series'] ?: 'Неизвестно',
            'seasons' => $video['seasons'] ?: 'Неизвестно',
            'status' => $video['status'] ?: 'Неизвестно',
            'country' => $video['country'] ?: 'Неизвестно',
            'genre' => $video['genre'] ?: 'Неизвестно',
            'year' => $video['year'] ? (int)$video['year'] : null,
            'file_size' => $video['file_size'] ? (int)$video['file_size'] : null,
            'uploaded_at' => $video['uploaded_at']
        ];
    }, $videos);
    
    // ============================================
    // Логирование для мониторинга
    // ============================================
    
    error_log(sprintf(
        "[POOL GENERATION] userId=%d, requested=%d, returned=%d, remaining=%d, executionTime=%.2fms",
        $userId,
        $poolSize,
        count($formattedVideos),
        $remainingCount,
        $executionTime
    ));
    
    // ============================================
    // Возврат результата
    // ============================================
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'videos' => $formattedVideos,
        'poolSize' => count($formattedVideos),
        'remainingCount' => $remainingCount,
        'requestedSize' => $poolSize,
        'executionTime' => round($executionTime, 2) // для отладки
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (PDOException $e) {
    error_log("[POOL GENERATION ERROR] Database error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
    
} catch (Exception $e) {
    error_log("[POOL GENERATION ERROR] " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage() // В продакшене убрать
    ]);
}
?>
