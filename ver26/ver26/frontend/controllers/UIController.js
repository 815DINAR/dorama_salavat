export default class UIController {
    constructor(videoPlayerManager) {
        this.videoPlayerManager = videoPlayerManager;
        this.pauseIndicator = null;
        this.createPauseIndicator();
    }

    createPauseIndicator() {
        this.pauseIndicator = document.getElementById('pauseIndicator');
        if (!this.pauseIndicator) {
            this.pauseIndicator = document.createElement('div');
            this.pauseIndicator.id = 'pauseIndicator';
            this.pauseIndicator.className = 'pause-indicator';
            this.pauseIndicator.innerHTML = `
              <div class="pause-indicator-content">
                <svg class="pause-icon" width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" id="playIcon"/>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" id="pauseIcon" style="display: none;"/>
                </svg>
              </div>
            `;

            const style = document.createElement('style');
            style.textContent = `
                .pause-indicator {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 50%;
                    width: 80px;
                    height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease;
                    z-index: 15;
                }
                
                .pause-indicator.show {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);

            const container = document.querySelector('.video-swipe-container');
            if (container) {
                container.appendChild(this.pauseIndicator);
            }
        }
    }

    showPauseIndicator() {
        if (!this.pauseIndicator) return;

        const videoPlayer = this.videoPlayerManager.getActivePlayer();
        if (!videoPlayer) return;

        const playIcon = this.pauseIndicator.querySelector('#playIcon');
        const pauseIcon = this.pauseIndicator.querySelector('#pauseIcon');

        if (videoPlayer.paused) {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        }

        this.pauseIndicator.classList.add('show');

        setTimeout(() => {
            this.pauseIndicator.classList.remove('show');
        }, 1500);
    }
}