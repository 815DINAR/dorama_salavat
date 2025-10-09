<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/s3_client.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Метод не поддерживается"]);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['action'])) {
    echo json_encode(["success" => false, "message" => "Неверные данные"]);
    exit();
}

$action = $input['action'];

try {
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception("Ошибка подключения к БД");
    }
    
    $s3Client = new S3Client();
    
    if ($action === 'delete_single') {
        if (!isset($input['filename'])) {
            throw new Exception("Не указан файл");
        }
        
        $filename = $input['filename'];
        
        // Получаем информацию о видео
        $stmt = $pdo->prepare("SELECT id, filename FROM videos WHERE filename = :filename");
        $stmt->execute([':filename' => $filename]);
        $video = $stmt->fetch();
        
        if (!$video) {
            throw new Exception("Видео не найдено");
        }
        
        // Удаляем из S3
        $s3Deleted = $s3Client->deleteFile($filename);
        
        // Помечаем как неактивное в БД (soft delete)
        $stmt = $pdo->prepare("UPDATE videos SET is_active = false WHERE id = :id");
        $stmt->execute([':id' => $video['id']]);
        
        // Удаляем связанные данные
        $pdo->prepare("DELETE FROM favorites WHERE video_id = :id")->execute([':id' => $video['id']]);
        $pdo->prepare("DELETE FROM reactions WHERE video_id = :id")->execute([':id' => $video['id']]);
        $pdo->prepare("DELETE FROM watch_progress WHERE video_id = :id")->execute([':id' => $video['id']]);
        
        echo json_encode([
            "success" => true,
            "message" => "Видео удалено",
            "s3_deleted" => $s3Deleted
        ]);
        
    } elseif ($action === 'delete_all') {
        // Получаем все активные видео
        $stmt = $pdo->query("SELECT id, filename FROM videos WHERE is_active = true");
        $videos = $stmt->fetchAll();
        
        $deletedCount = 0;
        $errors = [];
        
        foreach ($videos as $video) {
            try {
                // Удаляем из S3
                $s3Client->deleteFile($video['filename']);
                
                // Помечаем как неактивное
                $pdo->prepare("UPDATE videos SET is_active = false WHERE id = :id")
                    ->execute([':id' => $video['id']]);
                
                $deletedCount++;
            } catch (Exception $e) {
                $errors[] = $video['filename'];
            }
        }
        
        // Очищаем связанные таблицы
        $pdo->exec("DELETE FROM favorites WHERE video_id IN (SELECT id FROM videos WHERE is_active = false)");
        $pdo->exec("DELETE FROM reactions WHERE video_id IN (SELECT id FROM videos WHERE is_active = false)");
        $pdo->exec("DELETE FROM watch_progress WHERE video_id IN (SELECT id FROM videos WHERE is_active = false)");
        $pdo->exec("DELETE FROM session_order");
        
        echo json_encode([
            "success" => true,
            "message" => "Удалено видео: $deletedCount",
            "deleted_count" => $deletedCount,
            "errors" => $errors
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>