class VideoPreloader {
    constructor(videoPlayerManager) {
        this.videoPlayerManager = videoPlayerManager;
        this.isPreloading = false;
        console.log('✅ VideoPreloader инициализирован');
    }

    async preloadNextVideo(currentIndex, videoOrder, videos) {
        if (!videoOrder || !videos || videoOrder.length === 0) return;
        if (this.isPreloading) return;

        this.isPreloading = true;

        try {
            const nextIndex = currentIndex + 1;

            if (nextIndex < videoOrder.length) {
                const videoIdx = videoOrder[nextIndex];
                const videoData = videos[videoIdx];

                if (videoData) {
                    console.log(`🚀 Предзагружаем следующее видео: ${videoData.filename}`);
                    await this.videoPlayerManager.preloadNextVideo(videoData);
                }
            }
        } finally {
            this.isPreloading = false;
        }
    }
}