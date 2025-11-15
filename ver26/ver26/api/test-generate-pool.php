<?php
/**
 * Тестовый скрипт для проверки работы /api/generate-pool
 * Запуск: php test-generate-pool.php
 */

// Настройки теста
$API_URL = 'https://doramashortsru.ru/Salavat_ver39/api/generate-pool.php'; // Измените на ваш URL
$TEST_USER_ID = 590563384; // Ваш тестовый user_id
$TEST_POOL_SIZE = 10;

echo "=== ТЕСТИРОВАНИЕ API: generate-pool ===\n\n";

// Тест 1: Нормальный запрос
echo "Тест 1: Запрос пула из {$TEST_POOL_SIZE} видео...\n";
$response = makeRequest($API_URL, [
    'userId' => $TEST_USER_ID,
    'poolSize' => $TEST_POOL_SIZE
]);

if ($response['success']) {
    echo "✅ Успех!\n";
    echo "   Получено видео: {$response['poolSize']}\n";
    echo "   Осталось непросмотренных: {$response['remainingCount']}\n";
    echo "   Время выполнения: {$response['executionTime']}ms\n";
    
    if (!empty($response['videos'])) {
        echo "\n   Первое видео в пуле:\n";
        $firstVideo = $response['videos'][0];
        echo "   - ID: {$firstVideo['id']}\n";
        echo "   - Название: {$firstVideo['title']}\n";
        echo "   - Жанр: {$firstVideo['genre']}\n";
        echo "   - URL: {$firstVideo['url']}\n";
    }
} else {
    echo "❌ Ошибка: " . ($response['error'] ?? 'Unknown error') . "\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Тест 2: Запрос с большим пулом
echo "Тест 2: Запрос максимального пула (100 видео)...\n";
$response = makeRequest($API_URL, [
    'userId' => $TEST_USER_ID,
    'poolSize' => 100
]);

if ($response['success']) {
    echo "✅ Успех!\n";
    echo "   Получено видео: {$response['poolSize']}\n";
    echo "   Время выполнения: {$response['executionTime']}ms\n";
} else {
    echo "❌ Ошибка: " . ($response['error'] ?? 'Unknown error') . "\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Тест 3: Запрос без userId (должна быть ошибка)
echo "Тест 3: Запрос без userId (ожидается ошибка)...\n";
$response = makeRequest($API_URL, [
    'poolSize' => 10
]);

if (!$response['success']) {
    echo "✅ Корректная обработка ошибки!\n";
    echo "   Ошибка: {$response['error']}\n";
} else {
    echo "❌ Ошибка: должна была вернуться ошибка валидации\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Тест 4: Запрос с некорректным poolSize
echo "Тест 4: Запрос с некорректным poolSize (150)...\n";
$response = makeRequest($API_URL, [
    'userId' => $TEST_USER_ID,
    'poolSize' => 150
]);

if (!$response['success']) {
    echo "✅ Корректная обработка ошибки!\n";
    echo "   Ошибка: {$response['error']}\n";
} else {
    echo "❌ Ошибка: должна была вернуться ошибка валидации\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Тест 5: Проверка на отсутствие дубликатов
echo "Тест 5: Проверка на отсутствие дубликатов в пуле...\n";
$response = makeRequest($API_URL, [
    'userId' => $TEST_USER_ID,
    'poolSize' => 50
]);

if ($response['success'] && !empty($response['videos'])) {
    $videoIds = array_column($response['videos'], 'id');
    $uniqueIds = array_unique($videoIds);
    
    if (count($videoIds) === count($uniqueIds)) {
        echo "✅ Дубликатов не найдено!\n";
        echo "   Всего видео в пуле: " . count($videoIds) . "\n";
    } else {
        echo "❌ Найдены дубликаты!\n";
        echo "   Всего видео: " . count($videoIds) . "\n";
        echo "   Уникальных: " . count($uniqueIds) . "\n";
    }
} else {
    echo "⚠️  Пул пуст или ошибка\n";
}

echo "\n=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===\n";

// Вспомогательная функция для отправки запроса
function makeRequest($url, $data) {
    $ch = curl_init($url);
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 10
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $curlErrorMsg = curl_error($ch);
        echo "CURL Error: " . $curlErrorMsg . "\n";
        curl_close($ch);
        return ['success' => false, 'error' => 'CURL error: ' . $curlErrorMsg];
    }
    
    curl_close($ch);
    
    $decoded = json_decode($response, true);
    
    if ($decoded === null) {
        echo "Ответ сервера: $response\n";
        return ['success' => false, 'error' => 'Invalid JSON response'];
    }
    
    return $decoded;
}
?>