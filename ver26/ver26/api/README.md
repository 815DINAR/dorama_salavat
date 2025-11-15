# API Documentation - Система рекомендаций

## Обзор
Это API для системы рекомендаций видео без повторов. Backend является единственным источником истины о просмотренных видео.

## Endpoints

### 1. POST /api/generate-pool

Генерирует пул из N непросмотренных видео для пользователя.

**URL:** `/api/generate-pool.php` или `/api/generate-pool`

**Метод:** POST

**Входные данные:**
```json
{
  "userId": 1062716814,
  "poolSize": 50
}
```

**Параметры:**
- `userId` (обязательный) - ID пользователя из Telegram (BIGINT)
- `poolSize` (опциональный) - Размер пула (по умолчанию 50, максимум 100)

**Успешный ответ (200 OK):**
```json
{
  "success": true,
  "videos": [
    {
      "id": 123,
      "filename": "video123.mp4",
      "url": "https://s3.regru.cloud/dorama-shorts/video123.mp4",
      "s3_url": "https://s3.regru.cloud/dorama-shorts/video123.mp4",
      "title": "Название дорамы",
      "description": "Описание...",
      "series": "16",
      "seasons": "1",
      "status": "Завершён",
      "country": "Корея",
      "genre": "romance",
      "year": 2024,
      "file_size": 15728640,
      "uploaded_at": "2025-01-10 12:30:00"
    }
    // ... еще 49 видео
  ],
  "poolSize": 50,
  "remainingCount": 450,
  "requestedSize": 50,
  "executionTime": 85.42
}
```

**Ответ при отсутствии непросмотренных видео (200 OK):**
```json
{
  "success": true,
  "videos": [],
  "poolSize": 0,
  "remainingCount": 0,
  "requestedSize": 50,
  "executionTime": 12.34
}
```

**Ошибки:**

400 Bad Request - неверные параметры:
```json
{
  "success": false,
  "error": "Missing required parameter: userId"
}
```

500 Internal Server Error - ошибка базы данных:
```json
{
  "success": false,
  "error": "Database error occurred",
  "message": "SQLSTATE[...]"
}
```

### Производительность

**Ожидаемое время выполнения:**
- 10-50ms при < 1000 видео в базе
- 50-100ms при 10,000 видео и 5,000 просмотров
- 100-200ms при 50,000 видео и 20,000 просмотров

**Оптимизация:**
- Использует LEFT JOIN с индексами (быстрее NOT IN)
- Индексы на `user_watch_history.user_id` и `user_watch_history.video_id`
- UNIQUE KEY на паре (user_id, video_id) предотвращает дубликаты

### Примеры использования

**cURL:**
```bash
curl -X POST https://your-domain.com/ver26/ver26/api/generate-pool.php \
  -H "Content-Type: application/json" \
  -d '{"userId": 1062716814, "poolSize": 50}'
```

**JavaScript (Fetch API):**
```javascript
const response = await fetch('/ver26/ver26/api/generate-pool.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 1062716814,
    poolSize: 50
  })
});

const data = await response.json();
if (data.success) {
  console.log(`Получено ${data.poolSize} видео из ${data.remainingCount} оставшихся`);
  console.log('Первое видео:', data.videos[0]);
}
```

### Логирование

Каждый запрос логируется в error_log PHP:
```
[POOL GENERATION] userId=1062716814, requested=50, returned=50, remaining=450, executionTime=85.42ms
```

### Мониторинг

**Метрики для отслеживания:**
1. Среднее время выполнения запроса (должно быть < 100ms)
2. Количество пустых пулов (remainingCount = 0)
3. Частота запросов от одного пользователя

**Признаки проблем:**
- Время выполнения > 500ms → нужна оптимизация индексов или кэширование
- Много пустых пулов → пользователи посмотрели весь контент
- Высокая частота запросов → возможна проблема на клиенте