export default class SessionPoolManager {
    constructor(telegramAuth) {
        this.telegramAuth = telegramAuth;
        this.isPreloadingNextPool = false;
        this.nextPoolCache = null;
        this.POOL_SIZE = 50;
        this.PRELOAD_THRESHOLD = 0.8; // 80% пула

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
    // API МЕТОДЫ
    // ===============================

    async fetchPoolFromAPI(userId, poolSize = 50) {
        try {
            const response = await fetch('/api/generate-pool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, poolSize })
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            
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
            throw error;
        }
    }

    async markAsWatchedAPI(videoId, userId) {
        const maxRetries = 3;
        const delays = [1000, 2000, 4000];

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch('/api/mark-watched', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,
                        videoId,
                        watchedAt: new Date().toISOString()
                    })
                });

                if (!response.ok) {
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
            const response = await fetch('/api/reset-history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
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
                let result;
                try {
                    result = await this.nextPoolCache;
                } catch (error) {
                    console.error('❌ Ошибка использования предзагруженного пула:', error);
                } finally {
                    this.nextPoolCache = null;
                    this.isPreloadingNextPool = false;
                }
                if (result) {
                    if (result.isEmpty) {
                        return { isEmpty: true };
                    }
                    this.setPool(result.videos);
                    this.setCurrentIndex(0);
                    return { isEmpty: false, poolSize: result.videos.length };
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

        this.isPreloadingNextPool = true;
        
        const userId = this.telegramAuth.getUserId();
        
        this.nextPoolCache = this.fetchPoolFromAPI(userId, this.POOL_SIZE)
            .then(({ videos, remainingCount }) => {
                console.log('✅ Следующий пул предзагружен');
                return {
                    isEmpty: videos.length === 0,
                    videos,
                    remainingCount
                };
            })
            .catch(error => {
                console.error('❌ Ошибка предзагрузки:', error);
                throw error;
            })
            .finally(() => {
                this.isPreloadingNextPool = false;
            });
    }

    async markAsWatched(videoId) {
        const userId = this.telegramAuth.getUserId();
        if (!userId) {
            console.error('❌ User ID не найден');
            return false;
        }

        // Асинхронно отправляем на сервер (не блокируем UI)
        this.markAsWatchedAPI(videoId, userId).catch(error => {
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
