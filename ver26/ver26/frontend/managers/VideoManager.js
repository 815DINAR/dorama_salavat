export default class VideoManager {
    constructor(videoPlayerManager, videoPreloader, telegramAuth, sessionPoolManager = null) {
        this.videoPlayerManager = videoPlayerManager;
        this.videoPreloader = videoPreloader;
        this.telegramAuth = telegramAuth;
        this.sessionPoolManager = sessionPoolManager;

        // Данные видео
        this.videos = [];
        this.videoOrder = [];
        this.currentOrderIndex = 0;

        // Просмотренные видео
        this.watchedVideosSet = new Set();
        this.currentSessionOrder = [];

        // Предпочтения пользователя
        this.userFavorites = [];
        this.userLikes = [];
        this.userDislikes = [];

        // Пропущенные видео
        this.skippedVideosBuffer = [];
        this.SKIPPED_BUFFER_SIZE = 10;
        this.MIN_VIDEOS_BEFORE_REPEAT = 5;

        // Таймеры
        this.sessionOrderUpdateTimer = null;
        this.lastVideoUpdateTimer = null;

        // Флаг загрузки
        this.isLoadingVideo = false;

        // Режим работы
        this.usePoolMode = !!sessionPoolManager;

        console.log(`✅ VideoManager инициализирован (режим: ${this.usePoolMode ? 'POOL' : 'LEGACY'})`);
    }

    // ===============================
    // ИНИЦИАЛИЗАЦИЯ
    // ===============================

    initializeFromUserData(userData) {
        if (userData) {
            this.watchedVideosSet = new Set(userData.watchedVideos || []);
            this.currentSessionOrder = userData.currentSessionOrder || [];
        }
    }

    // ===============================
    // ГЕТТЕРЫ И СЕТТЕРЫ
    // ===============================

    setVideos(videos) {
        this.videos = videos;
        window.videos = videos;
    }

    getVideos() {
        return this.videos;
    }

    setVideoOrder(order) {
        this.videoOrder = order;
        window.videoOrder = order;
    }

    getVideoOrder() {
        return this.videoOrder;
    }

    setCurrentOrderIndex(index) {
        this.currentOrderIndex = index;
        window.currentOrderIndex = index;
    }

    getCurrentOrderIndex() {
        return this.currentOrderIndex;
    }

    getCurrentVideo() {
        // Используем пул, если включен режим пулов
        if (this.usePoolMode && this.sessionPoolManager) {
            return this.sessionPoolManager.getCurrentVideo();
        }
        
        // Старая логика
        const idx = this.videoOrder[this.currentOrderIndex];
        return this.videos[idx];
    }

    isLoading() {
        return this.isLoadingVideo;
    }

    // ===============================
    // РАБОТА С ПУЛАМИ
    // ===============================

    async initializePoolMode() {
        if (!this.usePoolMode || !this.sessionPoolManager) {
            console.warn('⚠️ Режим пулов не активен');
            return false;
        }

        console.log('🚀 Инициализация режима пулов...');

        try {
            const result = await this.sessionPoolManager.initializePool();

            if (result.isEmpty) {
                console.log('📭 Все видео просмотрены');
                return { success: true, isEmpty: true };
            }

            console.log(`✅ Пул инициализирован: ${result.poolSize} видео`);
            return { success: true, isEmpty: false, poolSize: result.poolSize };
        } catch (error) {
            console.error('❌ Ошибка инициализации пула:', error);
            return { success: false, error };
        }
    }

    async moveToNextInPool() {
        if (!this.usePoolMode || !this.sessionPoolManager) {
            console.warn('⚠️ Режим пулов не активен');
            return { success: false };
        }

        try {
            const result = await this.sessionPoolManager.moveToNext();
            
            if (result.isEmpty) {
                console.log('📭 Видео закончились');
                return { success: true, isEmpty: true };
            }

            return { success: true, isEmpty: false };
        } catch (error) {
            console.error('❌ Ошибка перехода к следующему видео:', error);
            return { success: false, error };
        }
    }

    getPoolInfo() {
        if (!this.usePoolMode || !this.sessionPoolManager) {
            return null;
        }

        return this.sessionPoolManager.getPoolInfo();
    }

    // ===============================
    // ПЕРЕМЕШИВАНИЕ НЕПРОСМОТРЕННЫХ ВИДЕО (LEGACY)
    // ===============================

    async shuffleUnwatchedVideos() {
        // Старая логика остается без изменений
        const unwatchedIndices = [];

        this.videos.forEach((video, index) => {
            if (!this.watchedVideosSet.has(video.filename)) {
                const bufferIndex = this.skippedVideosBuffer.indexOf(video.filename);
                if (bufferIndex === -1 || bufferIndex < this.skippedVideosBuffer.length - this.MIN_VIDEOS_BEFORE_REPEAT) {
                    unwatchedIndices.push(index);
                }
            }
        });

        console.log(`📊 Просмотрено: ${this.watchedVideosSet.size}, доступно: ${unwatchedIndices.length}`);

        if (unwatchedIndices.length < 3 && this.skippedVideosBuffer.length > 0) {
            const oldSkipped = this.skippedVideosBuffer.slice(0, Math.max(0, this.skippedVideosBuffer.length - this.MIN_VIDEOS_BEFORE_REPEAT));
            oldSkipped.forEach(filename => {
                const index = this.videos.findIndex(v => v.filename === filename);
                if (index !== -1 && !this.watchedVideosSet.has(filename)) {
                    unwatchedIndices.push(index);
                }
            });
        }

        if (unwatchedIndices.length === 0) {
            console.log('🔄 Все просмотрено, новый круг');
            this.watchedVideosSet.clear();
            this.currentSessionOrder = [];
            this.skippedVideosBuffer = [];

            await this.telegramAuth.resetWatchProgress();

            unwatchedIndices.push(...this.videos.map((_, i) => i));
        }

        this.videoOrder = [...unwatchedIndices];
        for (let i = this.videoOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.videoOrder[i], this.videoOrder[j]] = [this.videoOrder[j], this.videoOrder[i]];
        }

        this.currentOrderIndex = 0;
        window.videoOrder = this.videoOrder;
        window.currentOrderIndex = this.currentOrderIndex;

        this.currentSessionOrder = this.videoOrder.map(idx => this.videos[idx].filename);

        this.saveSessionOrderBatch();

        console.log('🔀 Видео перемешаны:', this.videoOrder.length);
    }

    // ===============================
    // ВОССТАНОВЛЕНИЕ ПОРЯДКА СЕССИИ (LEGACY)
    // ===============================

    restoreSessionOrder() {
        const existingFilenames = new Set(this.videos.map(v => v.filename));
        const validOrder = this.currentSessionOrder.filter(filename => existingFilenames.has(filename));

        if (validOrder.length === 0) {
            this.shuffleUnwatchedVideos();
            return;
        }

        this.videoOrder = [];
        validOrder.forEach(filename => {
            const index = this.videos.findIndex(v => v.filename === filename);
            if (index !== -1 && !this.watchedVideosSet.has(filename)) {
                this.videoOrder.push(index);
            }
        });

        if (this.videoOrder.length === 0) {
            this.shuffleUnwatchedVideos();
            return;
        }

        this.currentOrderIndex = 0;
        window.videoOrder = this.videoOrder;
        window.currentOrderIndex = this.currentOrderIndex;
        this.currentSessionOrder = validOrder;
        console.log('✅ Порядок восстановлен:', this.videoOrder.length);
    }

    // ===============================
    // ЗАГРУЗКА ВИДЕО (МОДИФИЦИРОВАНО)
    // ===============================

    async loadVideo(
        videoController,
        updateButtonStates,
        watchTracker,
        videoTitle,
        videoGenre,
        currentTab,
        hasFirstClickOccurred
    ) {
        if (this.isLoadingVideo) {
            console.log('⏳ Уже загружается');
            return;
        }

        this.isLoadingVideo = true;
        videoController.setLoadingState(true);

        try {
            // Получаем видео из пула или старым способом
            let videoData;
            
            if (this.usePoolMode && this.sessionPoolManager) {
                videoData = this.sessionPoolManager.getCurrentVideo();
                
                if (!videoData) {
                    console.warn('⚠️ Нет видео в пуле');
                    this.isLoadingVideo = false;
                    videoController.setLoadingState(false);
                    return;
                }
            } else {
                // Старая логика
                if (this.videos.length === 0) {
                    console.warn('⚠️ Нет видео');
                    this.isLoadingVideo = false;
                    videoController.setLoadingState(false);
                    return;
                }

                if (this.videoOrder.length === 0 || this.currentOrderIndex >= this.videoOrder.length) {
                    await this.shuffleUnwatchedVideos();
                }

                const idx = this.videoOrder[this.currentOrderIndex];
                videoData = this.videos[idx];
            }

            // Обновляем данные пользователя
            try {
                const freshUserData = await this.telegramAuth.getUserData();
                if (freshUserData) {
                    this.userFavorites = freshUserData.favorites || [];
                    this.userLikes = freshUserData.likes || [];
                    this.userDislikes = freshUserData.dislikes || [];
                    
                    if (!this.usePoolMode) {
                        this.watchedVideosSet = new Set(freshUserData.watchedVideos || []);
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка обновления данных:', error);
            }

            console.log(`🎬 Загружаем видео: ${videoData.filename}`);

            if (videoData) {
                const videoId = videoData.filename;

                updateButtonStates(videoId);
                watchTracker.resetWatchTimer();

                // ===== ПРОВЕРКА ПРЕДЗАГРУЗКИ =====

                const isNextVideoReady = this.videoPlayerManager.isNextReady();
                const nextVideoData = this.videoPlayerManager.getNextVideoData();

                if (isNextVideoReady && nextVideoData && nextVideoData.filename === videoId) {
                    console.log('🚀 МГНОВЕННОЕ ПЕРЕКЛЮЧЕНИЕ');

                    await this.videoPlayerManager.switchToNextVideo();

                    if (currentTab === 'main' && hasFirstClickOccurred) {
                        watchTracker.startWatchTracking(videoId, currentTab);
                    }

                } else {
                    // Обычная загрузка
                    console.log('📁 Обычная загрузка:', videoId);

                    const activePlayer = this.videoPlayerManager.getActivePlayer();
                    const newSrc = videoData.s3_url || videoData.url ||
                        `https://s3.regru.cloud/dorama-shorts/${encodeURIComponent(videoData.filename)}`;

                    if (activePlayer.src !== newSrc) {
                        activePlayer.muted = false;
                        activePlayer.volume = 1.0;

                        console.log('🔊 Устанавливаем звук для обычной загрузки:', {
                            muted: activePlayer.muted,
                            volume: activePlayer.volume
                        });

                        activePlayer.src = newSrc;
                        activePlayer.load();

                        if (currentTab === 'main' && hasFirstClickOccurred) {
                            activePlayer.play().then(() => {
                                console.log('✅ Видео запущено со звуком');

                                setTimeout(() => {
                                    if (activePlayer.muted) {
                                        console.warn('⚠️ Звук был выключен после запуска, включаем');
                                        activePlayer.muted = false;
                                    }
                                    console.log('🔊 Финальное состояние звука:', {
                                        muted: activePlayer.muted,
                                        volume: activePlayer.volume,
                                        paused: activePlayer.paused
                                    });
                                }, 100);

                                watchTracker.startWatchTracking(videoId, currentTab);
                            }).catch(error => {
                                console.error('❌ Ошибка воспроизведения:', error);
                            });
                        }
                    }
                }

                // ===== ПРЕДЗАГРУЗКА СЛЕДУЮЩЕГО =====

                setTimeout(async () => {
                    if (this.videoPreloader) {
                        if (this.usePoolMode && this.sessionPoolManager) {
                            // ✅ НОВОЕ: Предзагружаем следующее видео из пула
                            await this.preloadNextFromPool();
                        } else {
                            // Старая логика
                            await this.videoPreloader.preloadNextVideo(this.currentOrderIndex, this.videoOrder, this.videos);
                        }
                    }
                }, 500);

                // Обновление UI
                if (videoTitle) {
                    videoTitle.textContent = videoData.title || 'Без названия';
                }
                if (videoGenre) {
                    videoGenre.textContent = `${videoData.genre || 'Неизвестно'}`;
                }

                this.updateLastVideoBatch(videoId);
            }
        } finally {
            this.isLoadingVideo = false;
            videoController.setLoadingState(false);
        }
    }

    // Предзагрузка следующего видео из пула
    async preloadNextFromPool() {
        if (!this.usePoolMode || !this.sessionPoolManager) {
            return;
        }

        const pool = this.sessionPoolManager.getPool();
        const currentIndex = this.sessionPoolManager.getCurrentIndex();
        const nextIndex = currentIndex + 1;

        if (nextIndex < pool.length) {
            const nextVideo = pool[nextIndex];
            if (nextVideo && this.videoPreloader) {
                console.log('🔄 Предзагрузка следующего из пула:', nextVideo.filename);
                await this.videoPlayerManager.preloadNextVideo(nextVideo);
            }
        } else {
            console.log('⚠️ Следующее видео за пределами пула (будет загружен новый пул)');
        }
    }

    // ===============================
    // СЛЕДУЮЩЕЕ ВИДЕО
    // ===============================

    async nextVideo(
        videoController,
        updateButtonStates,
        watchTracker,
        videoTitle,
        videoGenre,
        currentTab,
        hasFirstClickOccurred
    ) {
        console.log('⏭️ Следующее видео');

        if (this.usePoolMode && this.sessionPoolManager) {
            // Режим пулов
            const result = await this.moveToNextInPool();
            
            if (result.isEmpty) {
                console.log('📭 Все видео просмотрены');
                // TODO: Показать экран "Все просмотрено"
                return;
            }

            if (!result.success) {
                console.error('❌ Ошибка перехода к следующему видео');
                return;
            }

        } else {
            // Старая логика
            if (this.videos.length > 0 && this.videoOrder.length > 0 && this.currentOrderIndex < this.videoOrder.length) {
                const currentVideo = this.videos[this.videoOrder[this.currentOrderIndex]];
                if (currentVideo && !this.watchedVideosSet.has(currentVideo.filename)) {
                    this.addToSkippedBuffer(currentVideo.filename);
                }
            }

            const newIndex = this.currentOrderIndex + 1;

            if (newIndex >= this.videoOrder.length) {
                await this.shuffleUnwatchedVideos();
            } else {
                this.currentOrderIndex = newIndex;
                window.currentOrderIndex = this.currentOrderIndex;
            }
        }

        await this.loadVideo(
            videoController,
            updateButtonStates,
            watchTracker,
            videoTitle,
            videoGenre,
            currentTab,
            hasFirstClickOccurred
        );

        return result;
    }

    // ===============================
    // ЗАГРУЗКА ВИДЕО С СЕРВЕРА (LEGACY)
    // ===============================

    async fetchVideos(
        updateFavoritesList,
        videoController,
        updateButtonStates,
        watchTracker,
        videoTitle,
        videoGenre,
        currentTab,
        hasFirstClickOccurred
    ) {
        console.log('📥 Загрузка видео...');
        try {
            const response = await fetch('get_videos.php');

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const rawText = await response.text();

            try {
                this.videos = JSON.parse(rawText);
                window.videos = this.videos;
                console.log('✅ Видео загружено:', this.videos.length);

                if (this.videos.length > 0) {
                    const existingFilenames = this.videos.map(v => v.filename);
                    await this.telegramAuth.cleanDeletedVideos(existingFilenames);

                    if (this.currentSessionOrder.length > 0) {
                        this.restoreSessionOrder();
                    } else {
                        await this.shuffleUnwatchedVideos();
                    }

                    await this.loadVideo(
                        videoController,
                        updateButtonStates,
                        watchTracker,
                        videoTitle,
                        videoGenre,
                        currentTab,
                        hasFirstClickOccurred
                    );
                    updateFavoritesList();

                    // Предзагрузка первых видео
                    setTimeout(async () => {
                        if (this.videoPreloader) {
                            await this.videoPreloader.preloadNextVideo(this.currentOrderIndex, this.videoOrder, this.videos);
                        }
                    }, 1000);

                } else {
                    console.warn('⚠️ Массив видео пустой');
                }
            } catch (parseError) {
                console.error('❌ Ошибка парсинга JSON:', parseError);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки видео:', error);
        }
    }

    // ===============================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (LEGACY)
    // ===============================

    addToSkippedBuffer(filename) {
        const existingIndex = this.skippedVideosBuffer.indexOf(filename);
        if (existingIndex !== -1) {
            this.skippedVideosBuffer.splice(existingIndex, 1);
        }

        this.skippedVideosBuffer.push(filename);

        if (this.skippedVideosBuffer.length > this.SKIPPED_BUFFER_SIZE) {
            this.skippedVideosBuffer.shift();
        }
    }

    saveSessionOrderBatch() {
        if (this.sessionOrderUpdateTimer) {
            clearTimeout(this.sessionOrderUpdateTimer);
        }

        this.sessionOrderUpdateTimer = setTimeout(() => {
            this.telegramAuth.saveSessionOrder(this.currentSessionOrder);
        }, 2000);
    }

    updateLastVideoBatch(videoId) {
        if (this.lastVideoUpdateTimer) {
            clearTimeout(this.lastVideoUpdateTimer);
        }

        this.lastVideoUpdateTimer = setTimeout(() => {
            this.telegramAuth.updateLastVideo(videoId);
        }, 10000);
    }

    // ===============================
    // УПРАВЛЕНИЕ ПРОСМОТРЕННЫМИ ВИДЕО (LEGACY)
    // ===============================

    markAsWatched(filename) {
        this.watchedVideosSet.add(filename);

        const skipIndex = this.skippedVideosBuffer.indexOf(filename);
        if (skipIndex !== -1) {
            this.skippedVideosBuffer.splice(skipIndex, 1);
        }
    }

    isWatched(filename) {
        return this.watchedVideosSet.has(filename);
    }

    // ===============================
    // ОЧИСТКА
    // ===============================

    cleanup() {
        if (this.lastVideoUpdateTimer) {
            clearTimeout(this.lastVideoUpdateTimer);
        }

        if (this.sessionOrderUpdateTimer) {
            clearTimeout(this.sessionOrderUpdateTimer);
        }
    }
}