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

    $formattedVideos = array_map(function($video) {
        // Просто используем s3_url если есть, или генерируем стандартный
        $url = $video['s3_url'] ?:
        'https://' . rtrim(S3_ENDPOINT, '/') . '/' . rtrim(S3_BUCKET, '/') . '/' . rawurlencode($video['filename']);
        return [
            'id' => $video['id'],
            'filename' => $video['filename'],
            'url' => $url,
            's3_url' => $url,
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
?>