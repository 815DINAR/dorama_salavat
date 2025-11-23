export default class VideoManager {
    constructor(videoPlayerManager, videoPreloader, telegramAuth, sessionPoolManager = null) {
        this.videoPlayerManager = videoPlayerManager;
        this.videoPreloader = videoPreloader;
        this.telegramAuth = telegramAuth;
        this.sessionPoolManager = sessionPoolManager; // ✅ НОВОЕ

        // Данные видео
        this.videos = [];
        this.videoOrder = [];
        this.currentOrderIndex = 0;

        // Просмотренные видео (legacy)
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

        // ✅ Режим работы
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
        if (this.usePoolMode && this.sessionPoolManager) {
            return this.sessionPoolManager.getCurrentVideo();
        }
        const idx = this.videoOrder[this.currentOrderIndex];
        return this.videos[idx];
    }

    isLoading() {
        return this.isLoadingVideo;
    }

    // ===============================
    // POOL MODE: инициализация / навигация
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
        if (!this.usePoolMode || !this.sessionPoolManager) return null;
        return this.sessionPoolManager.getPoolInfo();
    }

    // ===============================
    // LEGACY: shuffle / restore
    // ===============================

    async shuffleUnwatchedVideos() {
        const unwatchedIndices = [];

        this.videos.forEach((video, index) => {
            if (!this.watchedVideosSet.has(video.filename)) {
                const bufferIndex = this.skippedVideosBuffer.indexOf(video.filename);
                if (bufferIndex === -1 || bufferIndex < this.skippedVideosBuffer.length - this.MIN_VIDEOS_BEFORE_REPEAT) {
                    unwatchedIndices.push(index);
                }
            }
        });

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
    // ЗАГРУЗКА ВИДЕО (МОДИФИЦИРОВАНО) — теперь помечаем просмотр СРАЗУ
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

            // Обновляем данные пользователя (non-blocking for core flow)
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
                // prefer canonical id
                const canonicalId = videoData.id ? String(videoData.id) : String(videoData.filename);

                updateButtonStates(canonicalId);
                // WatchTracker теперь только отслеживает UI; пометка просмотра — здесь, в VideoManager
                watchTracker.resetWatchTimer();


                // помечаем просмотр сразу, как только видео подготовлено и пользователь на главной вкладке
                if (this.usePoolMode && this.sessionPoolManager && currentTab === 'main') {
                    try {
                        if (!this.sessionPoolManager.isMarked(canonicalId)) {
                            // fire-and-forget, sessionPoolManager делает дедуп/ retry
                            this.sessionPoolManager.markAsWatched(canonicalId).catch(e => {
                                console.warn('⚠️ Ошибка пометки просмотра (optimistic):', e);
                            });
                        }
                    } catch (e) {
                        console.error('❌ Ошибка при проверке/отправке пометки просмотра:', e);
                    }
                }

                // ===== Если есть готовый next и переключение происходит мгновенно =====
                const isNextVideoReady = this.videoPlayerManager.isNextReady();
                const nextVideoData = this.videoPlayerManager.getNextVideoData();

                if (isNextVideoReady && nextVideoData && nextVideoData.filename === videoData.filename) {
                    console.log('🚀 МГНОВЕННОЕ ПЕРЕКЛЮЧЕНИЕ');

                    await this.videoPlayerManager.switchToNextVideo();

                    if (currentTab === 'main' && hasFirstClickOccurred) {
                        // WatchTracker can still track UI state (no network)
                        watchTracker.startWatchTracking(canonicalId, currentTab);
                    }

                } else {
                    // Обычная загрузка
                    console.log('📁 Обычная загрузка:', videoData.filename);

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
                                }, 100);

                                // WatchTracker continues to handle UI tracking (no network)
                                watchTracker.startWatchTracking(canonicalId, currentTab);
                            }).catch(error => {
                                console.error('❌ Ошибка воспроизведения:', error);
                            });
                        }
                    }
                }

                // ===== НЕМЕДЛЕННАЯ ПРЕДЗАГРУЗКА СЛЕДУЮЩЕГО =====
                if (this.videoPreloader) {
                    // Fire-and-forget - не блокируем UI
                    (async () => {
                        try {
                            if (this.usePoolMode && this.sessionPoolManager) {
                                await this.preloadNextFromPool();
                            } else {
                                await this.videoPreloader.preloadNextVideo(this.currentOrderIndex, this.videoOrder, this.videos);
                            }
                        } catch (error) {
                            console.error('❌ Ошибка предзагрузки:', error);
                        }
                    })();
                }

                // Обновление UI
                if (videoTitle) videoTitle.textContent = videoData.title || 'Без названия';
                if (videoGenre) videoGenre.textContent = `${videoData.genre || 'Неизвестно'}`;

                this.updateLastVideoBatch(canonicalId);
            }
        } finally {
            this.isLoadingVideo = false;
            videoController.setLoadingState(false);
        }
    }

    async preloadNextFromPool() {
        if (!this.usePoolMode || !this.sessionPoolManager) return;

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
    // СЛЕДУЮЩЕЕ ВИДЕО (убрано двойное помечание)
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
            const result = await this.moveToNextInPool();
            
            if (result.isEmpty) {
                console.log('📭 Все видео просмотрены');
                return { isEmpty: true };
            }

            if (!result.success) {
                console.error('❌ Ошибка перехода к следующему видео');
                return { success: false };
            }

        } else {
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

        return { isEmpty: false };
    }

    // ===============================
    // LEGACY: серверные fetch / прочее (без изменений)
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
        if (this.usePoolMode) {
            console.log('⏭️ saveSessionOrderBatch пропущен в pool mode');
            return;
        }

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

    markAsWatched(filename) {
        this.watchedVideosSet.add(filename);
        const skipIndex = this.skippedVideosBuffer.indexOf(filename);
        if (skipIndex !== -1) this.skippedVideosBuffer.splice(skipIndex, 1);
    }

    isWatched(filename) {
        return this.watchedVideosSet.has(filename);
    }

    // ===============================
    // CLEANUP
    // ===============================
    cleanup() {
        console.log('🧹 Cleanup VideoManager...');
    
        if (this.lastVideoUpdateTimer) {
            clearTimeout(this.lastVideoUpdateTimer);
            this.lastVideoUpdateTimer = null;
        }
    
        if (this.sessionOrderUpdateTimer) {
            clearTimeout(this.sessionOrderUpdateTimer);
            this.sessionOrderUpdateTimer = null;
        }
        
        console.log('✅ VideoManager cleanup завершен');
    }
}