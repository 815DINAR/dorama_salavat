<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/s3_config.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache');

try {
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception("Ошибка подключения к БД");
    }
    
    $sql = "SELECT id, filename, s3_url, title, description, series, seasons, 
                   status, country, genre, year, file_size, uploaded_at
            FROM videos 
            WHERE is_active = true 
            ORDER BY uploaded_at DESC";
    
    $stmt = $pdo->query($sql);
    $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Форматируем для frontend с правильными URL
    $formattedVideos = array_map(function($video) {
        // ИСПРАВЛЕНИЕ: Генерируем рабочие URL
        $workingUrl = generateWorkingUrl($video['filename'], $video['s3_url']);
        
        return [
            'id' => $video['id'],
            'filename' => $video['filename'],
            'url' => $workingUrl,
            's3_url' => $workingUrl, // Для совместимости
            'title' => $video['title'],
            'description' => $video['description'],
            'series' => $video['series'],
            'seasons' => $video['seasons'],
            'status' => $video['status'],
            'country' => $video['country'],
            'genre' => $video['genre'],
            'year' => $video['year']
        ];
    }, $videos);
    
    echo json_encode($formattedVideos);
    
} catch (Exception $e) {
    error_log("Error in get_videos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * НОВАЯ ФУНКЦИЯ: Генерирует рабочий URL для видео
 */
function generateWorkingUrl($filename, $existingUrl = null) {
    // Если есть существующий URL и он работает - используем его
    if ($existingUrl && isUrlAccessible($existingUrl)) {
        return $existingUrl;
    }
    
    // Пробуем разные варианты URL в порядке вероятности работы
    $possibleUrls = [
        // Path-style как в старом S3Client
        'https://' . S3_ENDPOINT . '/' . S3_BUCKET . '/' . rawurlencode($filename),
        // Virtual-host style
        'https://' . S3_BUCKET . '.' . S3_ENDPOINT . '/' . rawurlencode($filename),
        // Без кодирования (может быть файл загружен по-старому)
        'https://' . S3_ENDPOINT . '/' . S3_BUCKET . '/' . $filename,
        // CDN URL если есть
        'https://storage.regru.cloud/' . S3_BUCKET . '/' . rawurlencode($filename),
    ];
    
    // Возвращаем первый рабочий URL
    foreach ($possibleUrls as $url) {
        if (isUrlAccessible($url)) {
            return $url;
        }
    }
    
    // Если ни один не работает, возвращаем наиболее вероятный
    return $possibleUrls[0];
}

/**
 * НОВАЯ ФУНКЦИЯ: Быстро проверяет доступность URL
 */
function isUrlAccessible($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_NOBODY, true); // HEAD request
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3); // Быстрая проверка
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return $httpCode === 200;
}
?>