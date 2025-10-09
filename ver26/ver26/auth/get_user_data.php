<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/db_functions.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

try {
    $userId = $input['user_id'];
    $pdo = getDBConnection();
    
    // Получаем данные пользователя
    $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        // Пользователь не найден - возвращаем пустые данные
        echo json_encode([
            'success' => true,
            'user_data' => [
                'user_id' => $userId,
                'favorites' => [],
                'likes' => [],
                'dislikes' => [],
                'watchedVideos' => [],
                'lastVideoId' => null,
                'currentSessionOrder' => [],
                'watchProgress' => [],
                'totalCycles' => 0,
                'sessions_count' => 0,
                'total_time' => 0
            ]
        ]);
        exit;
    }
    
    // Получаем избранное (возвращаем filename для совместимости)
    $stmt = $pdo->prepare("
        SELECT v.filename 
        FROM favorites f
        JOIN videos v ON v.id = f.video_id
        WHERE f.user_id = ? AND v.is_active = true
    ");
    $stmt->execute([$userId]);
    $favorites = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Получаем реакции (возвращаем filename)
    $stmt = $pdo->prepare("
        SELECT v.filename, r.reaction_type 
        FROM reactions r
        JOIN videos v ON v.id = r.video_id
        WHERE r.user_id = ? AND v.is_active = true
    ");
    $stmt->execute([$userId]);
    
    $likes = [];
    $dislikes = [];
    while ($row = $stmt->fetch()) {
        if ($row['reaction_type'] === 'like') {
            $likes[] = $row['filename'];
        } else {
            $dislikes[] = $row['filename'];
        }
    }
    
    // Получаем просмотренные видео
    $stmt = $pdo->prepare("
        SELECT v.filename 
        FROM watch_progress wp
        JOIN videos v ON v.id = wp.video_id
        WHERE wp.user_id = ?
        ORDER BY wp.watched_at DESC
    ");
    $stmt->execute([$userId]);
    $watchedVideos = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Получаем прогресс просмотра
    $stmt = $pdo->prepare("
        SELECT v.filename, wp.watched_at, wp.duration 
        FROM watch_progress wp
        JOIN videos v ON v.id = wp.video_id
        WHERE wp.user_id = ?
    ");
    $stmt->execute([$userId]);
    $watchProgressArray = [];
    while ($row = $stmt->fetch()) {
        $watchProgressArray[$row['filename']] = [
            'watchedAt' => $row['watched_at'],
            'duration' => $row['duration']
        ];
    }
    
    // Получаем порядок сессии
    $stmt = $pdo->prepare("
        SELECT v.filename 
        FROM session_order so
        JOIN videos v ON v.id = so.video_id
        WHERE so.user_id = ?
        ORDER BY so.position
    ");
    $stmt->execute([$userId]);
    $sessionOrder = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Получаем статистику сессий
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count, 
               COALESCE(SUM(duration_seconds), 0) as total_time,
               SUM(CASE WHEN logout_time IS NULL THEN 1 ELSE 0 END) as active
        FROM sessions 
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $sessionStats = $stmt->fetch();
    
    // Формируем ответ
    echo json_encode([
        'success' => true,
        'user_data' => [
            'user_id' => $user['user_id'],
            'username' => $user['username'],
            'first_name' => $user['first_name'] ?? '',
            'last_name' => $user['last_name'] ?? '',
            'favorites' => $favorites,
            'likes' => $likes,
            'dislikes' => $dislikes,
            'watchedVideos' => $watchedVideos,
            'lastVideoId' => null, // TODO: добавить поле в БД если нужно
            'currentSessionOrder' => $sessionOrder,
            'watchProgress' => $watchProgressArray,
            'totalCycles' => 0, // TODO: добавить подсчет циклов
            'sessions_count' => $sessionStats['count'] ?? 0,
            'active_sessions' => $sessionStats['active'] ?? 0,
            'total_time' => $sessionStats['total_time'] ?? 0,
            'first_login' => $user['first_login'],
            'last_login' => $user['last_login']
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>