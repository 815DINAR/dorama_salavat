export default class VideoController {
    constructor(videoPlayerManager) {
        this.videoPlayerManager = videoPlayerManager;
        this.currentTab = 'main';
        this.isLoadingVideo = false;
    }

    isMainTabActive() {
        return this.currentTab === 'main';
    }

    setCurrentTab(tab) {
        this.currentTab = tab;
    }

    async togglePause() {
        const activePlayer = this.videoPlayerManager.getActivePlayer();
        if (!activePlayer || !this.isMainTabActive()) return;

        try {
            if (activePlayer.paused) {
                // ✅ Проверяем звук перед запуском
                if (activePlayer.muted) {
                    console.warn('⚠️ Звук был выключен при паузе, включаем');
                    activePlayer.muted = false;
                    activePlayer.volume = 1.0;
                }

                await activePlayer.play();
                console.log('▶️ Видео запущено');
            } else {
                activePlayer.pause();
                console.log('⏸️ Видео на паузе');
            }
        } catch (error) {
            console.error('❌ Ошибка паузы:', error);
        }
    }

    async nextVideo() {
        if (typeof window.nextVideo === 'function') {
            await window.nextVideo();
        }
    }

    setLoadingState(state) {
        this.isLoadingVideo = state;
    }
}