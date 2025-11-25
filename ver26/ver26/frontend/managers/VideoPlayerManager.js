export default class VideoPlayerManager {
    constructor() {
        this.currentPlayer = document.getElementById('currentVideo');
        this.nextPlayer = document.getElementById('nextVideo');
        this.activePlayer = 'current';
        this.isNextVideoReady = false;
        this.nextVideoData = null;
        this.isSwitching = false; // ✅ НОВЫЙ флаг

        // ✅ Убираем autoplay из HTML
        this.currentPlayer.removeAttribute('autoplay');
        this.nextPlayer.removeAttribute('autoplay');

        // ✅ Начальное состояние
        this.currentPlayer.muted = false;
        this.currentPlayer.volume = 1.0;
        this.nextPlayer.muted = true;
        this.nextPlayer.volume = 0; // ✅ Громкость 0 для предзагрузки
        this.nextPlayer.pause();

        console.log('✅ VideoPlayerManager инициализирован');
    }

    getActivePlayer() {
        return this.activePlayer === 'current' ? this.currentPlayer : this.nextPlayer;
    }

    getInactivePlayer() {
        return this.activePlayer === 'current' ? this.nextPlayer : this.currentPlayer;
    }

    async preloadNextVideo(videoData) {
        if (!videoData) {
            console.warn('⚠️ Нет данных для предзагрузки');
            return false;
        }

        const inactivePlayer = this.getInactivePlayer();
        const src = videoData.s3_url || videoData.url ||
            `https://s3.regru.cloud/dorama-shorts/${encodeURIComponent(videoData.filename)}`;

        console.log(`🔄 Предзагрузка:`, videoData.filename);

        // ===== КРИТИЧНО: Полная остановка =====
        inactivePlayer.pause();
        inactivePlayer.currentTime = 0;
        inactivePlayer.muted = true;
        inactivePlayer.volume = 0; // ✅ Громкость 0!

        // ✅ Очищаем старый src
        if (inactivePlayer.src) {
            inactivePlayer.removeAttribute('src');
            inactivePlayer.load();
        }

        this.nextVideoData = videoData;
        this.isNextVideoReady = false;

        return new Promise((resolve) => {
            let resolved = false;

            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                inactivePlayer.removeEventListener('canplay', onCanPlay);
                inactivePlayer.removeEventListener('canplaythrough', onCanPlay);
                inactivePlayer.removeEventListener('error', onError);
                inactivePlayer.removeEventListener('loadeddata', onLoadedData);
            };

            const onCanPlay = () => {
                if (resolved) return;

                if (inactivePlayer.buffered.length > 0) {
                    const bufferedEnd = inactivePlayer.buffered.end(0);
                    console.log(`📊 Буфер: ${bufferedEnd.toFixed(1)}с`);

                    // ✅ Требуем минимум 2 секунды буфера
                    if (bufferedEnd >= 2 || inactivePlayer.readyState >= 3) {
                        this.isNextVideoReady = true;
                        cleanup();
                        console.log('✅ Следующее видео готово');
                        resolve(true);
                    }
                }
            };

            const onLoadedData = () => {
                if (resolved) return;
                console.log('📥 Данные загружены, readyState:', inactivePlayer.readyState);
            };

            const onError = (e) => {
                console.error('❌ Ошибка предзагрузки:', e);
                cleanup();
                resolve(false);
            };

            inactivePlayer.addEventListener('canplay', onCanPlay);
            inactivePlayer.addEventListener('canplaythrough', onCanPlay);
            inactivePlayer.addEventListener('loadeddata', onLoadedData);
            inactivePlayer.addEventListener('error', onError);

            // ✅ Увеличенный таймаут
            setTimeout(() => {
                if (!resolved) {
                    if (inactivePlayer.readyState >= 2) {
                        this.isNextVideoReady = true;
                        cleanup();
                        console.log('⏱️ Таймаут: видео частично готово');
                        resolve(true);
                    } else {
                        cleanup();
                        console.warn('⏱️ Таймаут: видео не готово');
                        resolve(false);
                    }
                }
            }, 4000); // ✅ 4 секунды таймаут

            inactivePlayer.src = src;
            inactivePlayer.preload = 'auto';
            inactivePlayer.load();
        });
    }

    async switchToNextVideo() {
        // Защита от двойного переключения
        if (this.isSwitching) {
            console.warn('⚠️ Переключение уже идет');
            return null;
        }
    
        this.isSwitching = true;
    
        try {
            const current = this.getActivePlayer();
            const next = this.getInactivePlayer();
    
            console.log(`🔄 Переключение видео`);
    
            // ===== ШАГ 1: ЖДЁМ ГОТОВНОСТИ СЛЕДУЮЩЕГО ВИДЕО (ОДИН РАЗ) =====
            if (next.readyState < 2) {
                console.log('⏳ Ожидаем загрузку...');
                await this.waitForVideoReady(next, 2000); // Макс 2 секунды
            }
    
            // ===== ШАГ 2: ОСТАНАВЛИВАЕМ ТЕКУЩЕЕ =====
            current.pause();
            current.muted = true;
            current.volume = 0;
    
            // ===== ШАГ 3: ГОТОВИМ СЛЕДУЮЩЕЕ =====
            next.muted = false;
            next.volume = 1.0;
            next.currentTime = 0;
    
            // ===== ШАГ 4: ВИЗУАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ =====
            current.style.opacity = '0';
            current.style.visibility = 'hidden';
            current.style.zIndex = '1';
            current.style.pointerEvents = 'none';
    
            next.style.visibility = 'visible';
            next.style.opacity = '1';
            next.style.zIndex = '2';
            next.style.pointerEvents = 'auto';
    
            // ===== ШАГ 5: ПЕРЕКЛЮЧАЕМ АКТИВНОГО =====
            this.activePlayer = this.activePlayer === 'current' ? 'next' : 'current';
    
            // ===== ШАГ 6: ЗАПУСКАЕМ ВОСПРОИЗВЕДЕНИЕ =====
            if (window.hasFirstClickOccurred) {
                await this.playVideo(next);
            }
    
            // ===== ШАГ 7: ОЧИЩАЕМ СТАРЫЙ ПЛЕЕР (В ФОНЕ) =====
            this.cleanupPlayer(current);
    
            this.isNextVideoReady = false;
            return this.nextVideoData;
    
        } finally {
            // Снимаем блокировку сразу (без задержки)
            this.isSwitching = false;
        }
    }
    
    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
    
    /**
     * Ожидает готовности видео с таймаутом
     */
    async waitForVideoReady(videoElement, timeout = 2000) {
        return new Promise((resolve) => {
            if (videoElement.readyState >= 2) {
                resolve();
                return;
            }
    
            const onReady = () => {
                cleanup();
                resolve();
            };
    
            const onTimeout = () => {
                cleanup();
                console.warn('⏱️ Таймаут ожидания готовности');
                resolve(); // Не блокируем, продолжаем
            };
    
            const timeoutId = setTimeout(onTimeout, timeout);
    
            const cleanup = () => {
                videoElement.removeEventListener('loadeddata', onReady);
                videoElement.removeEventListener('canplay', onReady);
                clearTimeout(timeoutId);
            };
    
            videoElement.addEventListener('loadeddata', onReady, { once: true });
            videoElement.addEventListener('canplay', onReady, { once: true });
        });
    }
    
    /**
     * Запускает воспроизведение с автоматическим retry
     */
    async playVideo(videoElement, maxRetries = 2) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await videoElement.play();
                console.log('✅ Видео запущено');
    
                // Проверка через 100ms
                setTimeout(() => {
                    if (videoElement.paused || videoElement.muted || videoElement.volume === 0) {
                        console.warn('⚠️ Корректируем воспроизведение');
                        videoElement.muted = false;
                        videoElement.volume = 1.0;
                        videoElement.play().catch(() => {});
                    }
                }, 100);
    
                return true;
            } catch (error) {
                console.error(`❌ Попытка ${attempt + 1}/${maxRetries}:`, error);
                
                if (attempt < maxRetries - 1) {
                    // Перед повторной попыткой сбрасываем состояние
                    videoElement.muted = false;
                    videoElement.volume = 1.0;
                    videoElement.currentTime = 0;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        console.error('❌ Не удалось запустить видео');
        return false;
    }
    
    /**
     * Очищает старый плеер (в фоне, не блокируя)
     */
    cleanupPlayer(videoElement) {
        setTimeout(() => {
            videoElement.removeAttribute('src');
            videoElement.load();
            videoElement.currentTime = 0;
            console.log('🗑️ Плеер очищен');
        }, 300); // Небольшая задержка для плавности
    }

    getNextVideoData() {
        return this.nextVideoData;
    }

    isNextReady() {
        return this.isNextVideoReady && !this.isSwitching;
    }

    // ✅ НОВЫЙ МЕТОД: Принудительная остановка неактивного
    stopInactivePlayer() {
        const inactive = this.getInactivePlayer();
        if (!inactive.paused) {
            console.warn('⚠️ Неактивный плеер играет, останавливаем');
            inactive.pause();
            inactive.muted = true;
            inactive.volume = 0;
        }
    }
}