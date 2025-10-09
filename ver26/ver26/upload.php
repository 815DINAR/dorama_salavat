<?php
// === НАСТРОЙКИ ДЛЯ КОРРЕКТНОГО JSON ===
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_clean();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/s3_client.php';
require_once __DIR__ . '/config/s3_config.php';

// === ВКЛЮЧАЕМ ОТЛАДКУ ===
$debugLog = __DIR__ . '/s3_debug.log';
function debugLog($message) {
    global $debugLog;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($debugLog, "[$timestamp] $message\n", FILE_APPEND | LOCK_EX);
}

debugLog("=== НАЧАЛО ЗАГРУЗКИ ВИДЕО ===");

header('Content-Type: application/json');
header('Cache-Control: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    debugLog("ERROR: Неправильный метод запроса");
    echo json_encode(["success" => false, "message" => "Метод не поддерживается"]);
    exit();
}

// Проверка файла
if (!isset($_FILES['videoFile'])) {
    debugLog("ERROR: Нет файла для загрузки");
    echo json_encode(["success" => false, "message" => "Нет файла для загрузки"]);
    exit();
}

$file = $_FILES['videoFile'];
debugLog("FILE INFO: name={$file['name']}, size={$file['size']}, type={$file['type']}, tmp_name={$file['tmp_name']}");

// Проверка на ошибки
if ($file['error'] !== UPLOAD_ERR_OK) {
    debugLog("UPLOAD ERROR: code={$file['error']}");
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Файл превышает максимальный размер',
        UPLOAD_ERR_FORM_SIZE => 'Файл превышает максимальный размер формы',
        UPLOAD_ERR_PARTIAL => 'Файл загружен частично',
        UPLOAD_ERR_NO_FILE => 'Файл не был загружен',
        UPLOAD_ERR_NO_TMP_DIR => 'Отсутствует временная папка',
        UPLOAD_ERR_CANT_WRITE => 'Ошибка записи файла на диск',
        UPLOAD_ERR_EXTENSION => 'Загрузка файла остановлена расширением'
    ];
    $message = $errorMessages[$file['error']] ?? 'Неизвестная ошибка';
    echo json_encode(["success" => false, "message" => $message]);
    exit();
}

// Проверка расширения
$fileName = basename($file['name']);
$fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
$allowedExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];

debugLog("FILE CHECK: fileName=$fileName, extension=$fileExtension");

if (!in_array($fileExtension, $allowedExtensions)) {
    debugLog("ERROR: Недопустимое расширение файла");
    echo json_encode(["success" => false, "message" => "Недопустимый формат файла"]);
    exit();
}

// Определение Content-Type
function getVideoMimeType($extension) {
    $mimeTypes = [
        'mp4' => 'video/mp4',
        'avi' => 'video/x-msvideo',
        'mov' => 'video/quicktime',
        'wmv' => 'video/x-ms-wmv',
        'flv' => 'video/x-flv',
        'webm' => 'video/webm'
    ];
    return $mimeTypes[$extension] ?? 'video/mp4';
}

// Получение метаданных
$title = $_POST['title'] ?? '';
$description = $_POST['description'] ?? '';
$series = $_POST['series'] ?? '';
$seasons = $_POST['seasons'] ?? '';
$status = $_POST['status'] ?? '';
$country = $_POST['country'] ?? '';
$genre = $_POST['genre'] ?? '';
$year = $_POST['year'] ?? '';

debugLog("METADATA: title=$title, series=$series, seasons=$seasons");

// Валидация
if (empty($title) || empty($description)) {
    debugLog("ERROR: Пустые обязательные поля");
    echo json_encode(["success" => false, "message" => "Название и описание обязательны"]);
    exit();
}

try {
    debugLog("=== НАЧИНАЕМ ЗАГРУЗКУ В S3 ===");
    
    // 1. Создаем S3Client и безопасное имя файла
    $s3Client = new S3Client();
    $contentType = getVideoMimeType($fileExtension);
    
    // ИСПРАВЛЕНИЕ: Получаем безопасное имя файла из S3Client
    $safeFileName = $s3Client->createSafeFileName($fileName);
    
    debugLog("ORIGINAL FILENAME: $fileName");
    debugLog("SAFE FILENAME: $safeFileName");
    debugLog("S3 PARAMS: safeFileName=$safeFileName, contentType=$contentType, filePath={$file['tmp_name']}, fileSize={$file['size']}");
    
    // Загружаем с безопасным именем
    $s3Result = $s3Client->uploadFile($file['tmp_name'], $safeFileName, $contentType);
    
    debugLog("S3 RESULT: " . json_encode($s3Result));
    
    if (!$s3Result['success']) {
        throw new Exception("Ошибка S3: " . $s3Result['error']);
    }
    
    debugLog("=== S3 ЗАГРУЗКА УСПЕШНА ===");
    
    // 2. Создаем правильный URL для просмотра с безопасным именем
    $viewUrl = "https://" . S3_ENDPOINT . "/" . S3_BUCKET . "/" . rawurlencode($safeFileName);
    debugLog("VIEW URL: $viewUrl");
    
    // 3. Сохранение в MySQL с безопасным именем
    debugLog("=== НАЧИНАЕМ СОХРАНЕНИЕ В БД (MySQL) ===");
    
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception("Ошибка подключения к БД!");
    }
    
    debugLog("DB CONNECTION: успешно");
    
    // Проверка на дубликат по безопасному имени
    $checkStmt = $pdo->prepare("SELECT id FROM videos WHERE filename = ?");
    $checkStmt->execute([$safeFileName]);
    if ($checkStmt->fetch()) {
        debugLog("ERROR: Дубликат файла найден");
        throw new Exception("Файл с таким именем уже существует");
    }
    
    debugLog("DUPLICATE CHECK: файл уникален");
    
    // Вставка для MySQL с безопасным именем
    $sql = "INSERT INTO videos (filename, s3_url, title, description, series, seasons, status, country, genre, year, file_size) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        $safeFileName,          // Безопасное имя файла
        $viewUrl,               // URL с безопасным именем
        $title,
        $description,
        $series,
        $seasons,
        $status,
        $country,
        $genre,
        $year,
        $file['size']
    ]);
    
    if (!$result) {
        $errorInfo = $stmt->errorInfo();
        debugLog("DB ERROR: " . implode(', ', $errorInfo));
        throw new Exception("Ошибка вставки в БД: " . $errorInfo[2]);
    }
    
    // Получаем ID последней вставленной записи (MySQL)
    $videoId = $pdo->lastInsertId();
    
    debugLog("DB INSERT: успешно, video_id=$videoId");
    debugLog("=== ЗАГРУЗКА ПОЛНОСТЬЮ ЗАВЕРШЕНА ===");
    
    // Успешный ответ с безопасным именем
    $response = [
        "success" => true,
        "message" => "Видео успешно загружено",
        "video_id" => $videoId,
        "s3_url" => $viewUrl,           // URL с безопасным именем
        "filename" => $safeFileName,    // Безопасное имя файла
        "original_name" => $fileName    // Оригинальное имя для справки
    ];
    
    debugLog("SUCCESS RESPONSE: " . json_encode($response));
    echo json_encode($response);
    
} catch (Exception $e) {
    debugLog("EXCEPTION: " . $e->getMessage());
    debugLog("STACK TRACE: " . $e->getTraceAsString());
    
    // Откат: удаление из S3 с безопасным именем
    if (isset($s3Result) && $s3Result['success'] && isset($safeFileName)) {
        debugLog("ROLLBACK: удаляем файл из S3");
        try {
            $deleteResult = $s3Client->deleteFile($safeFileName); // Используем безопасное имя
            debugLog("DELETE RESULT: " . ($deleteResult ? 'успешно' : 'ошибка'));
        } catch (Exception $deleteEx) {
            debugLog("DELETE ERROR: " . $deleteEx->getMessage());
        }
    }
    
    $errorResponse = [
        "success" => false,
        "message" => $e->getMessage()
    ];
    
    debugLog("ERROR RESPONSE: " . json_encode($errorResponse));
    echo json_encode($errorResponse);
}

debugLog("=== КОНЕЦ ОБРАБОТКИ ===\n");
exit();
?>