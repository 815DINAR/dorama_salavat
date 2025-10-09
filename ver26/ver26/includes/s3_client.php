<?php
require_once __DIR__ . '/../config/s3_config.php';

/**
 * Рабочий S3 клиент для Reg.ru Object Storage (Signature V4)
 * Virtual-host style версия с исправлением кодировки
 */
class S3Client {
    private $accessKey;
    private $secretKey;
    private $endpoint;
    private $bucket;
    private $region;

    public function __construct() {
        $this->accessKey = S3_ACCESS_KEY;
        $this->secretKey = S3_SECRET_KEY;
        $this->endpoint = S3_ENDPOINT;
        $this->bucket = S3_BUCKET;
        $this->region = S3_REGION;
    }

    private function debugLog($message) {
        $debugLog = __DIR__ . '/../s3_debug.log';
        $timestamp = date('Y-m-d H:i:s');
        file_put_contents($debugLog, "[$timestamp] S3Client: $message\n", FILE_APPEND | LOCK_EX);
    }

    /**
     * Правильное кодирование URI для AWS
     */
    private function uriEncode($str) {
        $encoded = rawurlencode($str);
        // AWS требует специальную обработку некоторых символов
        $encoded = str_replace('%2F', '/', $encoded);
        return $encoded;
    }

    /**
     * Загрузка файла на S3
     */
    public function uploadFile($localFilePath, $s3FileName, $contentType = null) {
        $this->debugLog("=== НАЧАЛО ЗАГРУЗКИ В S3CLIENT ===");
        $this->debugLog("Параметры: localPath=$localFilePath, s3Name=$s3FileName, contentType=$contentType");

        if (!file_exists($localFilePath)) {
            $this->debugLog("ERROR: Файл не найден");
            return ['success' => false, 'error' => 'Файл не найден'];
        }

        $fileContent = file_get_contents($localFilePath);
        if (!$contentType) {
            $contentType = $this->getContentTypeByExtension($s3FileName);
        }

        $this->debugLog("Файл прочитан: размер=" . strlen($fileContent) . ", contentType=$contentType");

        // ИСПРАВЛЕНИЕ: Создаем безопасное имя файла для S3
        $safeFileName = $this->createSafeFileName($s3FileName);
        $this->debugLog("Безопасное имя файла: $safeFileName");

        $date = gmdate('Ymd\THis\Z');
        $shortDate = gmdate('Ymd');

        $this->debugLog("Время: date=$date, shortDate=$shortDate");

        // Virtual-host style: используем bucket в домене
        $host = $this->bucket . '.' . $this->endpoint;
        
        // Путь для virtual-host style с правильным кодированием
        $path = '/' . $this->uriEncode($safeFileName);

        $this->debugLog("URL компоненты: host=$host, path=$path, safeFileName=$safeFileName");

        $headers = [
            'Host' => $host,
            'x-amz-date' => $date,
            'x-amz-content-sha256' => hash('sha256', $fileContent),
            'x-amz-acl' => 'public-read',
            'Content-Type' => $contentType,
            'Content-Length' => strlen($fileContent)
        ];

        $this->debugLog("Заголовки до подписи: " . json_encode($headers));

        $headers['Authorization'] = $this->createSignatureV4('PUT', $path, $headers, $fileContent, $date, $shortDate, $host);

        $this->debugLog("Финальные заголовки: " . json_encode($headers));

        // Virtual-host style URL с правильным кодированием
        $url = "https://{$host}/" . rawurlencode($safeFileName);
        $this->debugLog("Финальный URL: $url");

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $curlHeaders = [];
        foreach ($headers as $k => $v) {
            $curlHeaders[] = "$k: $v";
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

        $this->debugLog("=== ОТПРАВЛЯЕМ CURL ЗАПРОС ===");

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $this->debugLog("CURL результат: HTTP=$httpCode, error=$error");
        $this->debugLog("CURL ответ: " . substr($response, 0, 500));

        if ($httpCode === 200 || $httpCode === 201) {
            $this->debugLog("=== УСПЕШНАЯ ЗАГРУЗКА ===");
            return [
                'success' => true,
                'url' => S3_PUBLIC_URL . $safeFileName,
                'filename' => $safeFileName
            ];
        } else {
            $this->debugLog("=== ОШИБКА ЗАГРУЗКИ ===");
            return [
                'success' => false,
                'error' => "HTTP $httpCode: $response $error"
            ];
        }
    }

    /**
     * Создание безопасного имени файла (только ASCII символы)
     */
        public function createSafeFileName($originalName) {
        $info = pathinfo($originalName);
        $extension = isset($info['extension']) ? '.' . $info['extension'] : '';
        $basename = $info['filename'];
        
        // Транслитерация кириллицы - ИСПРАВЛЕНО!
        $translitMap = [
            'А' => 'A', 'Б' => 'B', 'В' => 'V', 'Г' => 'G', 'Д' => 'D',
            'Е' => 'E', 'Ё' => 'Yo', 'Ж' => 'Zh', 'З' => 'Z', 'И' => 'I',
            'Й' => 'Y', 'К' => 'K', 'Л' => 'L', 'М' => 'M', 'Н' => 'N',
            'О' => 'O', 'П' => 'P', 'Р' => 'R', 'С' => 'S', 'Т' => 'T',
            'У' => 'U', 'Ф' => 'F', 'Х' => 'Kh', 'Ц' => 'Ts', 'Ч' => 'Ch',
            'Ш' => 'Sh', 'Щ' => 'Sch', 'Ъ' => '', 'Ы' => 'Y', 'Ь' => '',
            'Э' => 'E', 'Ю' => 'Yu', 'Я' => 'Ya',
            'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
            'е' => 'e', 'ё' => 'yo', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
            'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
            'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
            'у' => 'u', 'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch',
            'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
            'э' => 'e', 'ю' => 'yu', 'я' => 'ya'
        ];
        
        // Применяем транслитерацию
        $safeBasename = strtr($basename, $translitMap);
        
        // Удаляем все символы кроме букв, цифр, дефисов и подчеркиваний
        $safeBasename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $safeBasename);
        
        // Убираем множественные подчеркивания
        $safeBasename = preg_replace('/_{2,}/', '_', $safeBasename);
        
        // Убираем подчеркивания в начале и конце
        $safeBasename = trim($safeBasename, '_');
        
        // Если имя стало пустым, генерируем случайное
        if (empty($safeBasename)) {
            $safeBasename = 'file_' . uniqid();
        }
        
        return $safeBasename . $extension;
    }

    /**
     * Удаление файла с S3
     */
    public function deleteFile($s3FileName) {
        $date = gmdate('Ymd\THis\Z');
        $shortDate = gmdate('Ymd');

        // Virtual-host style
        $host = $this->bucket . '.' . $this->endpoint;
        $path = '/' . $this->uriEncode($s3FileName);

        $headers = [
            'Host' => $host,
            'x-amz-date' => $date,
            'x-amz-content-sha256' => hash('sha256', '')
        ];

        $headers['Authorization'] = $this->createSignatureV4('DELETE', $path, $headers, '', $date, $shortDate, $host);

        $url = "https://{$host}/" . rawurlencode($s3FileName);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $curlHeaders = [];
        foreach ($headers as $k => $v) {
            $curlHeaders[] = "$k: $v";
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($httpCode === 200 || $httpCode === 204);
    }

    /**
     * Определение Content-Type по расширению файла
     */
    private function getContentTypeByExtension($fileName) {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        $mimeTypes = [
            'mp4' => 'video/mp4',
            'avi' => 'video/x-msvideo',
            'mov' => 'video/quicktime',
            'wmv' => 'video/x-ms-wmv',
            'flv' => 'video/x-flv',
            'webm' => 'video/webm',
            'mkv' => 'video/x-matroska',
            'm4v' => 'video/x-m4v',
        ];
        
        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    /**
     * Создание подписи AWS Signature V4
     */
    private function createSignatureV4($method, $uri, $headers, $payload, $date, $shortDate, $host) {
        $this->debugLog("=== СОЗДАНИЕ ПОДПИСИ ===");
        
        $service = 's3';
        $algorithm = 'AWS4-HMAC-SHA256';

        $this->debugLog("Базовые параметры: method=$method, uri=$uri, service=$service");

        // Canonical headers (обязательно в алфавитном порядке!)
        $canonicalHeaders = '';
        $signedHeadersList = [];

        ksort($headers);
        foreach ($headers as $key => $value) {
            $lowerKey = strtolower($key);
            $canonicalHeaders .= $lowerKey . ':' . trim($value) . "\n";
            $signedHeadersList[] = $lowerKey;
        }
        $signedHeaders = implode(';', $signedHeadersList);

        $this->debugLog("Canonical headers:\n$canonicalHeaders");
        $this->debugLog("Signed headers: $signedHeaders");

        // Canonical URI - уже закодирован
        $canonicalUri = $uri;

        // Canonical Request
        $canonicalRequest = implode("\n", [
            $method,
            $canonicalUri,
            '',  // query string (пустая)
            $canonicalHeaders,
            $signedHeaders,
            hash('sha256', $payload)
        ]);

        $this->debugLog("Canonical request:\n" . str_replace("\n", "\\n\n", $canonicalRequest));

        // Credential Scope
        $credentialScope = "{$shortDate}/{$this->region}/{$service}/aws4_request";
        $this->debugLog("Credential scope: $credentialScope");

        // String to Sign
        $stringToSign = implode("\n", [
            $algorithm,
            $date,
            $credentialScope,
            hash('sha256', $canonicalRequest)
        ]);

        $this->debugLog("String to sign:\n" . str_replace("\n", "\\n\n", $stringToSign));

        // Calculate Signature
        $kDate = hash_hmac('sha256', $shortDate, "AWS4{$this->secretKey}", true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authorization = "{$algorithm} Credential={$this->accessKey}/{$credentialScope}, SignedHeaders={$signedHeaders}, Signature={$signature}";
        
        $this->debugLog("Финальная подпись: $authorization");
        $this->debugLog("=== КОНЕЦ СОЗДАНИЯ ПОДПИСИ ===");

        return $authorization;
    }
}
?>