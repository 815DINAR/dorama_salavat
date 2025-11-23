<?php
/**
 * Конфигурация Telegram Bot API
 */

// Токен вашего Telegram бота (получите у @BotFather)
define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');

// URL Telegram Bot API
define('TELEGRAM_API_URL', 'https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN);

/**
 * Отправка документа пользователю в Telegram
 */
function sendDocumentToTelegram($chatId, $filePath, $caption = '') {
    $url = TELEGRAM_API_URL . '/sendDocument';
    
    $postData = [
        'chat_id' => $chatId,
        'document' => new CURLFile($filePath),
        'caption' => $caption
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("CURL Error: " . $error);
    }
    
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode !== 200 || !$result['ok']) {
        throw new Exception("Telegram API Error: " . ($result['description'] ?? 'Unknown error'));
    }
    
    return $result;
}
