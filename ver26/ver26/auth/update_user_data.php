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

if (!$input || !isset($input['user_id']) || !isset($input['action'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

try {
    $userId = $input['user_id'];
    $action = $input['action'];
    $videoFilename = $input['video_id'] ?? null; // На самом деле это filename
    
    $pdo = getDBConnection();
    
    // Получаем ID видео по filename
    $videoId = null;
    if ($videoFilename) {
        $stmt = $pdo->prepare("SELECT id FROM videos WHERE filename = ?");
        $stmt->execute([$videoFilename]);
        $video = $stmt->fetch();
        $videoId = $video['id'] ?? null;
        
        if (!$videoId) {
            throw new Exception('Видео не найдено');
        }
    }
    
    switch ($action) {
        case 'toggle_favorite':
            // Проверяем, есть ли в избранном
            $stmt = $pdo->prepare("SELECT 1 FROM favorites WHERE user_id = ? AND video_id = ?");
            $stmt->execute([$userId, $videoId]);
            
            if ($stmt->fetch()) {
                // Удаляем из избранного
                $stmt = $pdo->prepare("DELETE FROM favorites WHERE user_id = ? AND video_id = ?");
                $stmt->execute([$userId, $videoId]);
                $message = 'Удалено из избранного';
            } else {
                // Добавляем в избранное
                $stmt = $pdo->prepare("INSERT INTO favorites (user_id, video_id) VALUES (?, ?)");
                $stmt->execute([$userId, $videoId]);
                $message = 'Добавлено в избранное';
            }
            break;
            
        case 'add_like':
            // Удаляем старую реакцию если есть
            $stmt = $pdo->prepare("DELETE FROM reactions WHERE user_id = ? AND video_id = ?");
            $stmt->execute([$userId, $videoId]);
            
            // Добавляем лайк
            $stmt = $pdo->prepare("INSERT INTO reactions (user_id, video_id, reaction_type) VALUES (?, ?, 'like')");
            $stmt->execute([$userId, $videoId]);
            $message = 'Лайк добавлен';
            break;
            
        case 'add_dislike':
            // Удаляем старую реакцию если есть
            $stmt = $pdo->prepare("DELETE FROM reactions WHERE user_id = ? AND video_id = ?");
            $stmt->execute([$userId, $videoId]);
            
            // Добавляем дизлайк
            $stmt = $pdo->prepare("INSERT INTO reactions (user_id, video_id, reaction_type) VALUES (?, ?, 'dislike')");
            $stmt->execute([$userId, $videoId]);
            $message = 'Дизлайк добавлен';
            break;
            
        case 'remove_like':
        case 'remove_dislike':
            $stmt = $pdo->prepare("DELETE FROM reactions WHERE user_id = ? AND video_id = ?");
            $stmt->execute([$userId, $videoId]);
            $message = 'Реакция удалена';
            break;
            
        default:
            throw new Exception('Неизвестное действие: ' . $action);
    }
    
    // Обновляем время модификации пользователя
    $stmt = $pdo->prepare("UPDATE users SET last_modified = NOW() WHERE user_id = ?");
    $stmt->execute([$userId]);
    
    // Получаем обновленные данные для ответа
    $stmt = $pdo->prepare("
        SELECT v.filename FROM favorites f
        JOIN videos v ON v.id = f.video_id
        WHERE f.user_id = ? AND v.is_active = true
    ");
    $stmt->execute([$userId]);
    $favorites = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $stmt = $pdo->prepare("
        SELECT v.filename, r.reaction_type FROM reactions r
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
    
    echo json_encode([
        'success' => true,
        'message' => $message,
        'user_data' => [
            'favorites' => $favorites,
            'likes' => $likes,
            'dislikes' => $dislikes
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>