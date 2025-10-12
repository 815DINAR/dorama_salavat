class VideoPlayerManager {
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

                    // ✅ Требуем минимум 3 секунды буфера
                    if (bufferedEnd >= 3 || inactivePlayer.readyState >= 3) {
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
            }, 8000); // ✅ 8 секунд вместо 5

            inactivePlayer.src = src;
            inactivePlayer.preload = 'auto';
            inactivePlayer.load();
        });
    }

    async switchToNextVideo() {
        // ✅ Защита от двойного переключения
        if (this.isSwitching) {
            console.warn('⚠️ Переключение уже идет');
            return null;
        }

        this.isSwitching = true;

        try {
            const current = this.getActivePlayer();
            const next = this.getInactivePlayer();

            console.log(`🔄 Переключение: ${this.activePlayer} → ${this.activePlayer === 'current' ? 'next' : 'current'}`);

            // ===== ✅ ДОБАВЬ ЭТУ ПРОВЕРКУ СЮДА =====
            if (next.readyState < 2) {
                console.warn('⚠️ Видео не готово, ждем...');
                await new Promise((resolve) => {
                    const onReady = () => {
                        console.log('✅ Видео готово');
                        next.removeEventListener('loadeddata', onReady);
                        resolve();
                    };

                    next.addEventListener('loadeddata', onReady, { once: true });

                    // Таймаут 400ms
                    setTimeout(() => {
                        next.removeEventListener('loadeddata', onReady);
                        console.log('⏱️ Таймаут ожидания');
                        resolve();
                    }, 400);
                });
            }
            // ===== КОНЕЦ ДОБАВЛЕНИЯ =====

            // ===== ШАГ 1: ПОЛНАЯ ОСТАНОВКА ТЕКУЩЕГО =====
            console.log('⏹️ Останавливаем текущее видео');
            current.pause();
            current.muted = true;
            current.volume = 0;

            // ✅ Ждем, пока текущее точно остановится
            await new Promise(resolve => setTimeout(resolve, 50));

            // ===== ШАГ 2: ПОДГОТОВКА НОВОГО =====
            console.log('🔊 Подготовка нового видео');

            // Проверяем готовность
            if (next.readyState < 2) {
                console.warn('⚠️ Видео не готово, ждем...');
                await new Promise((resolve) => {
                    const checkReady = setInterval(() => {
                        if (next.readyState >= 2) {
                            clearInterval(checkReady);
                            resolve();
                        }
                    }, 100);

                    setTimeout(() => {
                        clearInterval(checkReady);
                        resolve();
                    }, 2000);
                });
            }

            // Устанавливаем звук
            next.muted = false;
            next.volume = 1.0;

            // ===== ШАГ 3: ВИЗУАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ =====
            console.log('🎨 Визуальное переключение');

            current.style.opacity = '0';
            current.style.visibility = 'hidden';
            current.style.zIndex = '1';
            current.style.pointerEvents = 'none';

            next.style.visibility = 'visible';
            next.style.opacity = '1';
            next.style.zIndex = '2';
            next.style.pointerEvents = 'auto';

            // ===== ШАГ 4: ПЕРЕКЛЮЧАЕМ АКТИВНЫЙ =====
            this.activePlayer = this.activePlayer === 'current' ? 'next' : 'current';

            // ===== ШАГ 5: ЗАПУСК НОВОГО =====
            if (window.hasFirstClickOccurred) {
                console.log('▶️ Запускаем новое видео');

                // Сбрасываем на начало
                next.currentTime = 0;

                try {
                    await next.play();
                    console.log('✅ Новое видео запущено');

                    // Проверка через 200ms
                    setTimeout(() => {
                        if (next.paused) {
                            console.error('❌ Видео остановилось, перезапускаем');
                            next.play().catch(e => console.error('❌ Ошибка перезапуска:', e));
                        }

                        if (next.muted || next.volume === 0) {
                            console.error('❌ Звук выключен, включаем');
                            next.muted = false;
                            next.volume = 1.0;
                        }

                        console.log('🔊 Состояние после переключения:', {
                            paused: next.paused,
                            muted: next.muted,
                            volume: next.volume,
                            currentTime: next.currentTime,
                            readyState: next.readyState
                        });
                    }, 200);

                } catch (error) {
                    console.error('❌ Ошибка запуска:', error);

                    // Повторная попытка
                    next.muted = false;
                    next.volume = 1.0;
                    next.currentTime = 0;

                    try {
                        await next.play();
                        console.log('✅ Повторная попытка успешна');
                    } catch (retryError) {
                        console.error('❌ Повторная попытка не удалась:', retryError);
                    }
                }
            }

            // ===== ШАГ 6: ОЧИСТКА СТАРОГО =====
            setTimeout(() => {
                console.log('🗑️ Очищаем старый плеер');
                current.removeAttribute('src');
                current.load();
                current.currentTime = 0;
            }, 500);

            this.isNextVideoReady = false;

            return this.nextVideoData;

        } finally {
            // ✅ Снимаем блокировку через 300ms
            setTimeout(() => {
                this.isSwitching = false;
            }, 300);
        }
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