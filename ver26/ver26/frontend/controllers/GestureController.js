export default class GestureController {
    constructor(videoController, uiController) {
        this.videoController = videoController;
        this.uiController = uiController;

        this.STATES = {
            IDLE: 'idle',
            TOUCH_START: 'touch_start',
            ANALYZING: 'analyzing',
            TAP_DETECTED: 'tap_detected',
            SWIPE_DETECTED: 'swipe_detected',
            PROCESSING: 'processing'
        };

        this.currentState = this.STATES.IDLE;

        this.TAP_MAX_DURATION = 300;
        this.TAP_MAX_DISTANCE = 10;
        this.SWIPE_MIN_DISTANCE = 30;

        this.gestureData = {
            startTime: 0,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            duration: 0,
            distance: 0
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        const container = document.querySelector('.video-swipe-container');

        if (!container) {
            console.error('❌ video-swipe-container не найден');
            return;
        }

        container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        container.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

        container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        container.addEventListener('mouseup', this.handleMouseUp.bind(this));

        container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        console.log('✅ GestureController инициализирован');
    }

    handleTouchStart(e) {
        if (this.shouldIgnoreElement(e.target)) return;
        if (!this.videoController.isMainTabActive()) return;

        e.preventDefault();

        const touch = e.changedTouches[0];
        this.startGesture(touch.clientX, touch.clientY);
    }

    handleTouchMove(e) {
        if (this.currentState === this.STATES.IDLE) return;

        e.preventDefault();

        const touch = e.changedTouches[0];
        this.updateGesture(touch.clientX, touch.clientY);
    }

    handleTouchEnd(e) {
        if (this.currentState === this.STATES.IDLE) return;

        e.preventDefault();

        const touch = e.changedTouches[0];
        this.endGesture(touch.clientX, touch.clientY);
    }

    handleTouchCancel(e) {
        console.log('🚫 Touch cancelled');
        this.resetGesture();
    }

    handleMouseDown(e) {
        if (this.shouldIgnoreElement(e.target)) return;
        if (!this.videoController.isMainTabActive()) return;

        e.preventDefault();
        this.startGesture(e.clientX, e.clientY);
    }

    handleMouseMove(e) {
        if (this.currentState === this.STATES.IDLE) return;
        this.updateGesture(e.clientX, e.clientY);
    }

    handleMouseUp(e) {
        if (this.currentState === this.STATES.IDLE) return;
        this.endGesture(e.clientX, e.clientY);
    }

    handleWheel(e) {
        if (!this.videoController.isMainTabActive()) return;

        e.preventDefault();

        if (this.currentState === this.STATES.PROCESSING) return;

        this.currentState = this.STATES.PROCESSING;

        if (e.deltaY > 0) {
            this.executeSwipeAction('down');
        } else if (e.deltaY < 0) {
            this.executeSwipeAction('up');
        }

        setTimeout(() => {
            this.resetGesture();
        }, 500);
    }

    startGesture(x, y) {
        this.currentState = this.STATES.TOUCH_START;
        this.gestureData.startTime = Date.now();
        this.gestureData.startX = x;
        this.gestureData.startY = y;
        this.gestureData.currentX = x;
        this.gestureData.currentY = y;
    }

    updateGesture(x, y) {
        this.gestureData.currentX = x;
        this.gestureData.currentY = y;
        this.gestureData.deltaX = x - this.gestureData.startX;
        this.gestureData.deltaY = y - this.gestureData.startY;
        this.gestureData.distance = Math.sqrt(
            this.gestureData.deltaX ** 2 + this.gestureData.deltaY ** 2
        );
        this.gestureData.duration = Date.now() - this.gestureData.startTime;
    }

    endGesture(x, y) {
        this.updateGesture(x, y);

        const gestureType = this.determineGestureType();
        this.executeGesture(gestureType);
    }

    determineGestureType() {
        const { duration, distance, deltaY, deltaX } = this.gestureData;

        if (duration < this.TAP_MAX_DURATION && distance < this.TAP_MAX_DISTANCE) {
            return 'tap';
        }

        if (Math.abs(deltaY) > this.SWIPE_MIN_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX)) {
            return deltaY > 0 ? 'swipe_down' : 'swipe_up';
        }

        return 'unknown';
    }

    executeGesture(gestureType) {
        if (this.currentState === this.STATES.PROCESSING) {
            return;
        }

        this.currentState = this.STATES.PROCESSING;

        console.log('⚡ Жест:', gestureType);

        switch (gestureType) {
            case 'tap':
                this.executeTapAction();
                break;
            case 'swipe_up':
            case 'swipe_down':
                this.executeSwipeAction(gestureType === 'swipe_up' ? 'up' : 'down');
                break;
            default:
                this.resetGesture();
                return;
        }

        setTimeout(() => {
            this.resetGesture();
        }, 300);
    }

    executeTapAction() {
        console.log('👆 TAP - пауза');
        this.videoController.togglePause();
        this.uiController.showPauseIndicator();
    }

    executeSwipeAction(direction) {
        console.log(`📱 SWIPE ${direction} - следующее видео`);
        this.videoController.nextVideo();
    }

    resetGesture() {
        this.currentState = this.STATES.IDLE;
        this.gestureData = {
            startTime: 0,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            duration: 0,
            distance: 0
        };
    }

    shouldIgnoreElement(target) {
        return (
            target.tagName.toLowerCase() === 'button' ||
            target.tagName.toLowerCase() === 'a' ||
            target.closest('button') ||
            target.closest('.action-buttons') ||
            target.closest('.description-modal') ||
            target.closest('.bottom-panel') ||
            target.closest('.favorites-container') ||
            target.closest('.debug-console')
        );
    }
}