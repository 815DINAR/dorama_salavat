<?php
require_once __DIR__ . '/../config/database.php';

/**
 * Получить видео по ID
 */
function getVideoById($videoId) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT * FROM videos WHERE id = :id AND is_active = true");
    $stmt->execute([':id' => $videoId]);
    return $stmt->fetch();
}

/**
 * Получить видео по filename
 */
function getVideoByFilename($filename) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT * FROM videos WHERE filename = :filename AND is_active = true");
    $stmt->execute([':filename' => $filename]);
    return $stmt->fetch();
}

/**
 * Получить избранное пользователя
 */
function getUserFavorites($userId) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT v.* 
        FROM videos v
        JOIN favorites f ON v.id = f.video_id
        WHERE f.user_id = :user_id AND v.is_active = true
        ORDER BY f.added_at DESC
    ");
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchAll();
}

/**
 * Получить реакции пользователя
 */
function getUserReactions($userId) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT video_id, reaction_type 
        FROM reactions 
        WHERE user_id = :user_id
    ");
    $stmt->execute([':user_id' => $userId]);
    
    $likes = [];
    $dislikes = [];
    
    while ($row = $stmt->fetch()) {
        if ($row['reaction_type'] === 'like') {
            $likes[] = $row['video_id'];
        } else {
            $dislikes[] = $row['video_id'];
        }
    }
    
    return ['likes' => $likes, 'dislikes' => $dislikes];
}

/**
 * Получить прогресс просмотра
 */
function getUserWatchProgress($userId) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT v.filename, wp.watched_at, wp.duration 
        FROM watch_progress wp
        JOIN videos v ON v.id = wp.video_id
        WHERE wp.user_id = :user_id
        ORDER BY wp.watched_at DESC
    ");
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchAll();
}

/**
 * Проверка существования пользователя
 */
function userExists($userId) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE user_id = :user_id");
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchColumn() > 0;
}

/**
 * Создание или обновление пользователя
 */
function upsertUser($userData) {
    $pdo = getDBConnection();
    $sql = "INSERT INTO users (user_id, username, first_name, last_name, language_code, is_premium, first_login, last_login)
            VALUES (:user_id, :username, :first_name, :last_name, :language_code, :is_premium, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                last_login = NOW(),
                last_activity = NOW()";
    
    $stmt = $pdo->prepare($sql);
    return $stmt->execute($userData);
}
?>