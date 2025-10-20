export default class WatchTracker {
    constructor(telegramAuth, videoPlayerManager) {
        this.telegramAuth = telegramAuth;
        this.videoPlayerManager = videoPlayerManager;

        // Просмотренные видео
        this.watchedVideosSet = new Set();

        // Таймер отслеживания
        this.watchTimer = null;
        this.watchedSeconds = 0;
        this.currentTrackingFilename = null;

        // Константы
        this.WATCH_THRESHOLD = 5; // секунд для пометки как "просмотрено"

        console.log('✅ WatchTracker инициализирован');
    }

    // ===============================
    // ИНИЦИАЛИЗАЦИЯ
    // ===============================

    initializeFromUserData(userData) {
        if (userData) {
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

        // Если видео уже просмотрено, не отслеживаем повторно
        if (this.watchedVideosSet.has(filename)) {
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

        // Добавляем в локальный набор
        this.watchedVideosSet.add(filename);

        // Отправляем на сервер
        try {
            await this.telegramAuth.addWatchedVideo(filename, this.watchedSeconds);
            console.log('💾 Просмотр сохранен на сервере');
        } catch (error) {
            console.error('❌ Ошибка сохранения просмотра:', error);
        }
    }

    // ===============================
    // ГЕТТЕРЫ
    // ===============================

    isWatched(filename) {
        return this.watchedVideosSet.has(filename);
    }

    getWatchedCount() {
        return this.watchedVideosSet.size;
    }

    getWatchedVideos() {
        return Array.from(this.watchedVideosSet);
    }

    getCurrentTrackingFilename() {
        return this.currentTrackingFilename;
    }

    getWatchedSeconds() {
        return this.watchedSeconds;
    }

    // ===============================
    // ОБНОВЛЕНИЕ ДАННЫХ
    // ===============================

    updateWatchedVideos(watchedVideos) {
        if (Array.isArray(watchedVideos)) {
            this.watchedVideosSet = new Set(watchedVideos);
        }
    }

    // ===============================
    // ОЧИСТКА
    // ===============================

    clearWatchedVideos() {
        this.watchedVideosSet.clear();
        console.log('🗑️ Просмотренные видео очищены');
    }

    cleanup() {
        this.resetWatchTimer();
        console.log('🧹 WatchTracker очищен');
    }
}