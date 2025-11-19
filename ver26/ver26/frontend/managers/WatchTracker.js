export default class WatchTracker {
    constructor(telegramAuth, videoPlayerManager, sessionPoolManager = null) {
        this.telegramAuth = telegramAuth;
        this.videoPlayerManager = videoPlayerManager;
        this.sessionPoolManager = sessionPoolManager;

        // Просмотренные видео
        this.watchedVideosSet = new Set();

        // Таймер отслеживания
        this.watchTimer = null;
        this.watchedSeconds = 0;
        this.currentTrackingFilename = null;

        // Константы
        this.WATCH_THRESHOLD = 5; // секунд для пометки как "просмотрено"

        // Режим работы
        this.usePoolMode = !!sessionPoolManager;

        console.log(`✅ WatchTracker инициализирован (режим: ${this.usePoolMode ? 'POOL' : 'LEGACY'})`);
    }

    // ===============================
    // ИНИЦИАЛИЗАЦИЯ
    // ===============================

    initializeFromUserData(userData) {
        if (userData && !this.usePoolMode) {
            // Только в legacy режиме загружаем из userData
            this.watchedVideosSet = new Set(userData.watchedVideos || []);
            console.log(`📊 Загружено просмотренных видео: ${this.watchedVideosSet.size}`);
        }
    }

    // ===============================
    // УПРАВЛЕНИЕ ТАЙМЕРОМ
    // ===============================

    resetWatchTimer() {
        if (this.watchTimer) {
            clearInterval(this.watchTimer);
            this.watchTimer = null;
        }
        this.watchedSeconds = 0;
        this.currentTrackingFilename = null;
    }

    // ===============================
    // ОТСЛЕЖИВАНИЕ ПРОСМОТРА
    // ===============================

    startWatchTracking(filename, currentTab) {
        this.resetWatchTimer();

        // В режиме пулов не проверяем локальный набор
        if (!this.usePoolMode && this.watchedVideosSet.has(filename)) {
            console.log('⏭️ Видео уже просмотрено, пропускаем отслеживание:', filename);
            return;
        }

        console.log('⏱️ Начинаем отслеживание:', filename);

        this.currentTrackingFilename = filename;

        this.watchTimer = setInterval(() => {
            const activePlayer = this.videoPlayerManager.getActivePlayer();

            // Проверяем, что видео воспроизводится и мы на главной вкладке
            if (activePlayer && !activePlayer.paused && currentTab === 'main') {
                this.watchedSeconds++;

                // Если достигли порога, помечаем как просмотренное
                if (this.watchedSeconds >= this.WATCH_THRESHOLD) {
                    this.markVideoAsWatched(this.currentTrackingFilename);
                    this.resetWatchTimer();
                }
            }
        }, 1000);
    }

    // ===============================
    // ПОМЕТКА КАК ПРОСМОТРЕННОЕ
    // ===============================

    async markVideoAsWatched(filename) {
        console.log('✅ Просмотрено:', filename, `(${this.watchedSeconds} сек)`);

        if (this.usePoolMode && this.sessionPoolManager) {
            // Режим пулов - отправляем через SessionPoolManager
            try {
                await this.sessionPoolManager.markAsWatched(filename);
                console.log('💾 Просмотр отправлен через SessionPoolManager');
            } catch (error) {
                console.error('❌ Ошибка отправки просмотра через SessionPoolManager:', error);
            }
        } else {
            // Старая логика
            // Добавляем в локальный набор
            this.watchedVideosSet.add(filename);

            // Отправляем на сервер
            try {
                await this.telegramAuth.addWatchedVideo(filename, this.watchedSeconds);
                console.log('💾 Просмотр сохранен на сервере (legacy)');
            } catch (error) {
                console.error('❌ Ошибка сохранения просмотра:', error);
            }
        }
    }

    // ===============================
    // ГЕТТЕРЫ
    // ===============================

    isWatched(filename) {
        if (this.usePoolMode) {
            // В режиме пулов Backend управляет историей
            console.log('⚠️ isWatched() не поддерживается в режиме пулов');
            return false;
        }
        return this.watchedVideosSet.has(filename);
    }

    getWatchedCount() {
        if (this.usePoolMode) {
            console.log('⚠️ getWatchedCount() не поддерживается в режиме пулов');
            return 0;
        }
        return this.watchedVideosSet.size;
    }

    getWatchedVideos() {
        if (this.usePoolMode) {
            console.log('⚠️ getWatchedVideos() не поддерживается в режиме пулов');
            return [];
        }
        return Array.from(this.watchedVideosSet);
    }

    getCurrentTrackingFilename() {
        return this.currentTrackingFilename;
    }

    getWatchedSeconds() {
        return this.watchedSeconds;
    }

    // ===============================
    // ОБНОВЛЕНИЕ ДАННЫХ (LEGACY)
    // ===============================

    updateWatchedVideos(watchedVideos) {
        if (this.usePoolMode) {
            console.log('⚠️ updateWatchedVideos() игнорируется в режиме пулов');
            return;
        }

        if (Array.isArray(watchedVideos)) {
            this.watchedVideosSet = new Set(watchedVideos);
        }
    }

    // ===============================
    // ОЧИСТКА
    // ===============================

    clearWatchedVideos() {
        if (this.usePoolMode) {
            console.log('⚠️ clearWatchedVideos() не поддерживается в режиме пулов');
            return;
        }

        this.watchedVideosSet.clear();
        console.log('🗑️ Просмотренные видео очищены');
    }

    cleanup() {
        this.resetWatchTimer();
        console.log('🧹 WatchTracker очищен');
    }
}