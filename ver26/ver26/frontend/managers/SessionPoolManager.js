export default class SessionPoolManager {
    constructor(telegramAuth) {
        this.telegramAuth = telegramAuth;
        this.isPreloadingNextPool = false;
        this.nextPoolCache = null;
        this.POOL_SIZE = 50;
        this.PRELOAD_THRESHOLD = 0.8; // 80% пула

        // Множество videoId, которые уже помечены в этой сессии (локально)
        this.markedVideoIds = new Set();

        console.log('✅ SessionPoolManager инициализирован');
    }

    // ===============================
    // РАБОТА С sessionStorage
    // ===============================

    getPool() {
        const poolStr = sessionStorage.getItem('currentPool');
        if (!poolStr) {
            return [];
        }
        try {
            const parsed = JSON.parse(poolStr);
            if (Array.isArray(parsed)) {
                return parsed;
            } else {
                console.warn('⚠️ Parsed pool is not an array. Returning empty array.');
                return [];
            }
        } catch (error) {
            console.warn('⚠️ Failed to parse currentPool from sessionStorage. Returning empty array.', error);
            return [];
        }
    }

    setPool(pool) {
        sessionStorage.setItem('currentPool', JSON.stringify(pool));
    }

    getCurrentIndex() {
        const indexStr = sessionStorage.getItem('currentIndex');
        return indexStr ? parseInt(indexStr, 10) : 0;
    }

    setCurrentIndex(index) {
        sessionStorage.setItem('currentIndex', String(index));
    }

    // ===============================
    // HELPERS
    // ===============================

    /**
     * Try to resolve provided identifier (could be videoId or filename)
     * to a canonical videoId (videos.id) using the current pool.
     * Returns resolved id string or null if not found.
     */
    resolveVideoId(videoIdentifier) {
        if (!videoIdentifier) return null;

        const pool = this.getPool();

        // 1) If identifier already equals an id in pool -> return it
        const byId = pool.find(v => String(v.id) === String(videoIdentifier));
        if (byId) {
            return String(byId.id);
        }

        // 2) Try matching by filename
        const byFilename = pool.find(v => String(v.filename) === String(videoIdentifier));
        if (byFilename) {
            return String(byFilename.id);
        }

        // 3) Try matching by filename without path / encoding (e.g. decoding)
        try {
            const decoded = decodeURIComponent(videoIdentifier);
            const byDecoded = pool.find(v => String(v.filename) === String(decoded));
            if (byDecoded) return String(byDecoded.id);
        } catch (e) {
            // ignore decode errors
        }

        // Not found in pool
        return null;
    }

    /**
     * Проверяет, было ли видео уже помечено в этой сессии.
     * Принимает videoId (строка/число) или filename — в последнем случае попробует разрешить.
     */
        isMarked(videoIdentifier) {
            if (!videoIdentifier) return false;
            // Если передали filename, попробуем резолвить
            const resolved = this.resolveVideoId(videoIdentifier) || String(videoIdentifier);
            return this.markedVideoIds.has(String(resolved));
        }

    // ===============================
    // API МЕТОДЫ
    // ===============================

    async fetchPoolFromAPI(userId, poolSize = 50) {
        try {
            console.log(`🚀 Отправляем запрос на генерацию пула для userId: ${userId}, poolSize: ${poolSize}`);
            
            const response = await fetch('api/generate-pool.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: userId, poolSize: poolSize })
            });

            console.log(`📡 Получен ответ: статус ${response.status} ${response.statusText}`);

            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errorText = await response.text();
                    errorDetails = errorText;
                    console.error('❌ Текст ответа:', errorText);
                } catch (e) {
                    errorDetails = 'Не удалось прочитать тело ответа';
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}. Details: ${errorDetails}`);
            }

            console.log(`✅ Парсим JSON ответ...`);
            const data = await response.json();
            console.log(`✅ Ответ распарсен:`, data);
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to generate pool');
            }

            console.log(`✅ Получен пул: ${data.videos.length} видео, осталось: ${data.remainingCount}`);
            
            return {
                videos: data.videos || [],
                remainingCount: data.remainingCount || 0
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки пула:', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    async markAsWatchedAPI(videoId, userId) {
        const maxRetries = 3;
        const delays = [1000, 2000, 4000];

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch('api/mark-watched.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId,
                        videoId: videoId,
                        watchedAt: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    console.error(`❌ Ошибка ${response.status}:`, errorText);
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    console.log(`✅ Видео отмечено как просмотренное: ${videoId}`);
                    return true;
                } else {
                    throw new Error(data.error || 'Failed to mark as watched');
                }
            } catch (error) {
                console.error(`❌ Попытка ${attempt + 1}/${maxRetries} не удалась:`, error);
                
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
                } else {
                    console.error('❌ Все попытки исчерпаны');
                    return false;
                }
            }
        }
        
        return false;
    }

    async resetHistoryAPI(userId) {
        try {
            const response = await fetch('api/reset-history.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: userId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Ошибка ${response.status}:`, errorText);
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('❌ Ошибка сброса истории:', error);
            return false;
        }
    }

    // ===============================
    // УПРАВЛЕНИЕ ПУЛОМ
    // ===============================

    async initializePool() {
        console.log('🚀 Инициализация пула...');
        
        const userId = this.telegramAuth.getUserId();
        if (!userId) {
            throw new Error('User ID не найден');
        }
        
        console.log(`👤 User ID: ${userId}`);

        try {
            const { videos, remainingCount } = await this.fetchPoolFromAPI(userId, this.POOL_SIZE);

            if (videos.length === 0) {
                console.log('📭 Все видео просмотрены');
                return {
                    isEmpty: true,
                    remainingCount: 0
                };
            }

            this.setPool(videos);
            this.setCurrentIndex(0);

            console.log(`✅ Пул инициализирован: ${videos.length} видео, осталось: ${remainingCount}`);

            return {
                isEmpty: false,
                poolSize: videos.length,
                remainingCount
            };
        } catch (error) {
            console.error('❌ Ошибка инициализации пула:', error);
            throw error;
        }
    }

    getCurrentVideo() {
        const pool = this.getPool();
        const index = this.getCurrentIndex();

        if (pool.length === 0) {
            console.warn('⚠️ Пул пуст');
            return null;
        }

        if (index >= pool.length) {
            console.warn('⚠️ Индекс за границами пула');
            return null;
        }

        return pool[index];
    }

    async moveToNext() {
        const pool = this.getPool();
        let currentIndex = this.getCurrentIndex();

        currentIndex++;

        // Проверяем, достигли ли конца пула
        if (currentIndex >= pool.length) {
            console.log('🔄 Пул закончился, загружаем новый...');
            
            // Проверяем предзагруженный пул
            if (this.nextPoolCache) {
                console.log('⚡ Используем предзагруженный пул');
                try {
                    const result = await this.nextPoolCache;
                    
                    // Очищаем кеш после использования
                    this.nextPoolCache = null;
                    
                    if (result.isEmpty) {
                        return { isEmpty: true };
                    }
                    
                    this.setPool(result.videos);
                    this.setCurrentIndex(0);
                    return { isEmpty: false, poolSize: result.videos.length };
                } catch (error) {
                    console.error('❌ Ошибка использования предзагруженного пула:', error);
                    // При ошибке очищаем кеш и флаг
                    this.nextPoolCache = null;
                    this.isPreloadingNextPool = false;
                }
            }
            
            // Обычная загрузка нового пула
            const result = await this.loadNewPool();
            return result;
        }

        // Проверяем порог предзагрузки
        if (currentIndex >= pool.length * this.PRELOAD_THRESHOLD && !this.isPreloadingNextPool) {
            console.log('🔄 Запускаем предзагрузку следующего пула...');
            this.preloadNextPool();
        }

        this.setCurrentIndex(currentIndex);
        return { isEmpty: false };
    }

    async loadNewPool() {
        console.log('📥 Загрузка нового пула...');
        
        const userId = this.telegramAuth.getUserId();
        if (!userId) {
            throw new Error('User ID не найден');
        }

        try {
            const { videos, remainingCount } = await this.fetchPoolFromAPI(userId, this.POOL_SIZE);

            if (videos.length === 0) {
                console.log('📭 Видео закончились');
                this.setPool([]);
                this.setCurrentIndex(0);
                return {
                    isEmpty: true,
                    remainingCount: 0
                };
            }

            this.setPool(videos);
            this.setCurrentIndex(0);

            console.log(`✅ Новый пул загружен: ${videos.length} видео, осталось: ${remainingCount}`);

            return {
                isEmpty: false,
                poolSize: videos.length,
                remainingCount
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки нового пула:', error);
            throw error;
        }
    }

    preloadNextPool() {
        if (this.isPreloadingNextPool) {
            console.log('⏳ Предзагрузка уже идёт');
            return;
        }

        console.log('🚀 Запуск предзагрузки следующего пула...');

        this.isPreloadingNextPool = true;
        
        const userId = this.telegramAuth.getUserId();
        
        this.nextPoolCache = this.fetchPoolFromAPI(userId, this.POOL_SIZE)
            .then(({ videos, remainingCount }) => {
                console.log(`✅ Следующий пул предзагружен: ${videos.length} видео`);
                this.isPreloadingNextPool = false;
                return {
                    isEmpty: videos.length === 0,
                    videos,
                    remainingCount
                };
            })
            .catch(error => {
                console.error('❌ Ошибка предзагрузки следующего пула:', error);
                
                // Сбрасываем флаг и кеш при ошибке
                this.isPreloadingNextPool = false;
                this.nextPoolCache = null;
                
                // Не пробрасываем ошибку дальше, возвращаем пустой результат
                return {
                    isEmpty: false,
                    videos: [],
                    remainingCount: 0
                };
            });
    }

    /**
     * Accepts either a videoId (id) or filename.
     * Resolves to the canonical videoId and sends mark-watched to backend.
     * Non-blocking for UI (returns true immediately and retries async).
     */
    async markAsWatched(videoIdentifier) {
        const userId = this.telegramAuth.getUserId();
        if (!userId) {
            console.error('❌ User ID не найден');
            return false;
        }

        // Resolve identifier -> videoId if possible
        let resolvedId = this.resolveVideoId(videoIdentifier);
        if (!resolvedId) {
            console.warn(`⚠️ Не удалось разрешить идентификатор в pool: ${videoIdentifier}. Попробуем отправить как есть.`);
            resolvedId = String(videoIdentifier); // fall back
        } else {
            console.log(`🔁 Разрешён videoId для '${videoIdentifier}' → ${resolvedId}`);
        }

        // Асинхронно отправляем на сервер (не блокируем UI)
        this.markAsWatchedAPI(resolvedId, userId).catch(error => {
            console.error('❌ Ошибка отправки просмотра:', error);
        });

        return true;
    }

    getPoolSize() {
        return this.getPool().length;
    }

    getPoolInfo() {
        const pool = this.getPool();
        const index = this.getCurrentIndex();
        
        return {
            totalSize: pool.length,
            currentIndex: index,
            remaining: pool.length - index,
            percentage: pool.length > 0 ? Math.round((index / pool.length) * 100) : 0
        };
    }

    clearPool() {
        sessionStorage.removeItem('currentPool');
        sessionStorage.removeItem('currentIndex');
        console.log('🗑️ Пул очищен');
    }

    cancelPreload() {
        if (this.isPreloadingNextPool) {
            console.log('🚫 Отмена предзагрузки...');
            this.nextPoolCache = null;
            this.isPreloadingNextPool = false;
        }
    }

    cleanup() {
        console.log('🧹 Cleanup SessionPoolManager...');

        // Отменяем предзагрузку, если идёт
        this.cancelPreload();
        
        console.log('✅ SessionPoolManager cleanup завершен');
    }

    async resetHistory() {
        const userId = this.telegramAuth.getUserId();
        if (!userId) {
            throw new Error('User ID не найден');
        }

        const success = await this.resetHistoryAPI(userId);
        
        if (success) {
            this.clearPool();
            console.log('✅ История сброшена');
        }
        
        return success;
    }
}