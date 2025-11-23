<?php
/**
 * API Endpoint: POST /api/send-logs-to-telegram
 * Назначение: Отправляет логи пользователю в Telegram через бота
 * 
 * Входные данные (JSON):
 * {
 *   "userId": 123456789,
 *   "logs": "текст логов",
 *   "timestamp": "2025-11-23 18:01:57"
 * }
 */

require_once __DIR__ . '/../config/telegram_config.php';

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

try {
    // Получаем входные данные
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }
    
    // Валидация данных
    if (empty($data['userId'])) {
        throw new Exception('userId is required');
    }
    
    if (empty($data['logs'])) {
        throw new Exception('logs is required');
    }
    
    $userId = intval($data['userId']);
    $logs = $data['logs'];
    $timestamp = $data['timestamp'] ?? date('Y-m-d H:i:s');
    
    // Ограничение размера логов (5MB)
    $maxSize = 5 * 1024 * 1024; // 5MB
    if (strlen($logs) > $maxSize) {
        throw new Exception('Logs size exceeds 5MB limit');
    }
    
    // Создаем временный файл
    $tempDir = sys_get_temp_dir();
    $fileName = 'dorama_logs_' . $userId . '_' . time() . '.txt';
    $filePath = $tempDir . '/' . $fileName;
    
    // Формируем содержимое файла
    $fileContent = "=== DoramaShorts Debug Logs ===\n";
    $fileContent .= "User ID: {$userId}\n";
    $fileContent .= "Export Time: {$timestamp}\n";
    $fileContent .= "================================\n\n";
    $fileContent .= $logs;
    
    // Сохраняем логи во временный файл
    $bytesWritten = file_put_contents($filePath, $fileContent);
    
    if ($bytesWritten === false) {
        throw new Exception('Failed to create temp file');
    }
    
    // Отправляем файл в Telegram
    try {
        $caption = "📊 Логи DoramaShorts\n🕐 {$timestamp}";
        $result = sendDocumentToTelegram($userId, $filePath, $caption);
        
        // Удаляем временный файл
        unlink($filePath);
        
        echo json_encode([
            'success' => true,
            'message' => 'Logs sent successfully to Telegram',
            'fileSize' => strlen($logs),
            'timestamp' => $timestamp
        ]);
        
    } catch (Exception $e) {
        // Удаляем временный файл в случае ошибки
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        throw new Exception('Failed to send to Telegram: ' . $e->getMessage());
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
