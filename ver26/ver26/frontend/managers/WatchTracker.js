export default class WatchTracker {
    constructor(telegramAuth, videoPlayerManager, sessionPoolManager = null) {
        this.telegramAuth = telegramAuth;
        this.videoPlayerManager = videoPlayerManager;
        this.sessionPoolManager = sessionPoolManager; // optional, but WatchTracker won't call network

        // Локальный набор просмотренных (legacy)
        this.watchedVideosSet = new Set();

        // Состояние отслеживания
        this.currentTrackingFilename = null;
        this.watchedSeconds = 0;

        // В pool режиме WatchTracker НЕ выполняет сетевые вызовы — это ответственность VideoManager / SessionPoolManager
        this.usePoolMode = !!sessionPoolManager;

        console.log(`✅ WatchTracker инициализирован (режим: ${this.usePoolMode ? 'POOL' : 'LEGACY'})`);
    }

    initializeFromUserData(userData) {
        if (userData && !this.usePoolMode) {
            this.watchedVideosSet = new Set(userData.watchedVideos || []);
            console.log(`📊 Загружено просмотренных видео: ${this.watchedVideosSet.size}`);
        }
    }

    resetWatchTimer() {
        // Упрощённо: WatchTracker больше не запускает таймеры для пометки просмотра
        this.watchedSeconds = 0;
        this.currentTrackingFilename = null;
    }

    // startWatchTracking теперь только отслеживает UI/таймеры для аналитики,
    // но НЕ отправляет отметку просмотра на сервер (это делает VideoManager через SessionPoolManager).
    startWatchTracking(filename, currentTab) {
        // Если legacy и уже помечено — можно пропустить
        if (!this.usePoolMode && this.watchedVideosSet.has(filename)) {
            console.log('⏭️ Видео уже помечено локально, пропускаем отслеживание:', filename);
            return;
        }

        this.currentTrackingFilename = filename;
        this.watchedSeconds = 0;

        // Можно при желании всё ещё собирать watchedSeconds локально для аналитики,
        // но тут мы не делаем сетевых вызовов.
        console.log('⏱️ WatchTracker: начато отслеживание (без сетевых вызовов):', filename);
    }

    // legacy helper: mark locally and optionally send to backend (kept for compatibility)
    async markVideoAsWatched(filename) {
        this.watchedVideosSet.add(filename);
        try {
            await this.telegramAuth.addWatchedVideo(filename, this.watchedSeconds);
            console.log('💾 Просмотр сохранен на сервере (legacy)');
        } catch (error) {
            console.error('❌ Ошибка сохранения просмотра (legacy):', error);
        }
    }

    isWatched(filename) {
        if (this.usePoolMode) {
            console.warn('⚠️ isWatched() не поддерживается в режиме пулов');
            return false;
        }
        return this.watchedVideosSet.has(filename);
    }

    getWatchedCount() {
        if (this.usePoolMode) return 0;
        return this.watchedVideosSet.size;
    }

    updateWatchedVideos(watchedVideos) {
        if (this.usePoolMode) return;
        if (Array.isArray(watchedVideos)) this.watchedVideosSet = new Set(watchedVideos);
    }

    clearWatchedVideos() {
        if (this.usePoolMode) {
            console.warn('⚠️ clearWatchedVideos() не поддерживается в режиме пулов');
            return;
        }
        this.watchedVideosSet.clear();
        console.log('🗑️ Просмотренные видео очищены (legacy)');
    }

    cleanup() {
        // Nothing network-related to cleanup here
        this.resetWatchTimer();
        console.log('🧹 WatchTracker очищен');
    }
}