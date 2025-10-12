// script102.js v9.1 - Исправленная версия со звуком
document.addEventListener('DOMContentLoaded', async () => {
  
  // ===============================
  // DEBUG LOGGER
  // ===============================

  window.debugLogger = new DebugLogger();

  // ===============================
  // ИСПРАВЛЕННЫЙ VIDEO PLAYER MANAGER СО ЗВУКОМ
  // ===============================
  
  // ===============================
  // УПРОЩЕННЫЙ VIDEO PRELOADER
  // ===============================
  
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

  // ===============================
  // GESTURE CONTROLLER
  // ===============================
  
  class GestureController {
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
  
  // ===============================
  // UI CONTROLLER
  // ===============================
  
  class UIController {
    constructor() {
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
      
      const videoPlayer = videoPlayerManager.getActivePlayer();
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
  
  // ===============================
  // VIDEO CONTROLLER
  // ===============================
  
  class VideoController {
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
  
  console.log('🚀 DoramaShorts v9.1 - Версия с исправленным звуком');
  
  // ===============================
  // АВТОРИЗАЦИЯ
  // ===============================
  
  const authSuccess = await window.telegramAuth.init();
  
  if (!authSuccess) {
    console.error('❌ Авторизация не удалась');
    return;
  }
  
  console.log('✅ Авторизация успешна');
  
  const userData = await window.telegramAuth.getUserData();
  if (userData) {
    console.log('📊 Данные пользователя загружены');
  }
   
  // ===============================
  // DEBUG ACCESS
  // ===============================
  
  const setupDebugAccess = async () => {
    const ALLOWED_DEBUG_USERS = ['79046704122', '1062716814', '590563384', '79196982303'];
    
    const getAllPossibleUserIds = () => {
      return {
        'userData.user_id': userData?.user_id,
        'userData.id': userData?.id,
        'telegramAuth.getUserId()': window.telegramAuth?.getUserId?.(),
        'Telegram.WebApp.initDataUnsafe.user.id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
        'localStorage.user_id': localStorage.getItem('user_id')
      };
    };
    
    const checkAccess = () => {
      const allIds = getAllPossibleUserIds();
      
      for (const [source, value] of Object.entries(allIds)) {
        if (value !== undefined && value !== null && value !== '') {
          const stringId = String(value);
          
          if (ALLOWED_DEBUG_USERS.includes(stringId)) {
            console.log(`✅ Debug доступ разрешен: ${stringId}`);
            return true;
          }
        }
      }
      
      return false;
    };
    
    const hasDebugAccess = checkAccess();
    
    const debugButton = document.getElementById('debugButton');
    
    if (debugButton) {
      if (hasDebugAccess) {
        debugButton.style.display = 'block';
        debugButton.style.visibility = 'visible';
        debugButton.style.opacity = '1';
      } else {
        debugButton.style.display = 'none';
      }
    }
    
    return hasDebugAccess;
  };

  setupDebugAccess();
  
  // ===============================
  // ИНИЦИАЛИЗАЦИЯ КОНТРОЛЛЕРОВ
  // ===============================
  
  const videoPlayerManager = new VideoPlayerManager();
  const uiController = new UIController();
  const videoController = new VideoController(videoPlayerManager);
  const gestureController = new GestureController(videoController, uiController);
  const videoPreloader = new VideoPreloader(videoPlayerManager);
  
  window.videoPreloader = videoPreloader;
  window.videoPlayerManager = videoPlayerManager;
  
  // ===============================
  // DOM ЭЛЕМЕНТЫ
  // ===============================
  
  const videoPlayer = videoPlayerManager.getActivePlayer();
  const videoTitle = document.getElementById('videoTitle');
  const videoGenre = document.getElementById('videoGenre');
  const likeButton = document.getElementById('likeButton');
  const dislikeButton = document.getElementById('dislikeButton');
  const favoriteButton = document.getElementById('favoriteButton');
  const descriptionButton = document.getElementById('descriptionButton');
  const descriptionModal = document.getElementById('descriptionModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  
  const mainTab = document.getElementById('mainTab');
  const favoritesTab = document.getElementById('favoritesTab');
  const mainContent = document.getElementById('mainContent');
  const favoritesContent = document.getElementById('favoritesContent');
  const favoritesList = document.getElementById('favoritesList');
  const favoritesEmpty = document.getElementById('favoritesEmpty');

  // ===============================
  // ОВЕРЛЕЙ ПЕРВОГО КЛИКА
  // ===============================
  
  let hasFirstClickOccurred = false;
  const firstClickOverlay = document.getElementById('firstClickOverlay');

  function hideFirstClickOverlay() {
      if (!hasFirstClickOccurred && firstClickOverlay) {
          console.log('🎯 Скрываем оверлей');
          
          firstClickOverlay.style.animation = 'fadeOut 0.3s ease-out forwards';
          
          setTimeout(() => {
              firstClickOverlay.classList.add('hidden');
              hasFirstClickOccurred = true;
              window.hasFirstClickOccurred = true;
              console.log('✅ Оверлей скрыт');
          }, 300);
      }
  }

  if (firstClickOverlay) {
      const handleOverlayClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('👆 Клик по оверлею');
          
          hideFirstClickOverlay();
          
          const activePlayer = videoPlayerManager.getActivePlayer();
          if (activePlayer && videoController.currentTab === 'main') {
              // ✅ ВКЛЮЧАЕМ ЗВУК ПЕРЕД ЗАПУСКОМ
              activePlayer.muted = false;
              activePlayer.volume = 1.0;
              
              console.log('🔊 Устанавливаем звук при первом клике:', {
                  muted: activePlayer.muted,
                  volume: activePlayer.volume
              });
              
              if (activePlayer.paused) {
                  activePlayer.play().then(() => {
                      console.log('✅ Видео запущено со звуком');
                      
                      // ✅ Проверяем, что звук действительно включен
                      setTimeout(() => {
                          if (activePlayer.muted) {
                              console.warn('⚠️ Звук был выключен после запуска, включаем принудительно');
                              activePlayer.muted = false;
                          }
                          console.log('🔊 Финальное состояние звука:', {
                              muted: activePlayer.muted,
                              volume: activePlayer.volume,
                              paused: activePlayer.paused
                          });
                      }, 100);
                      
                      const currentVideoId = likeButton?.getAttribute('data-video-id');
                      if (currentVideoId) {
                          startWatchTracking(currentVideoId);
                      }
                  }).catch(error => {
                      console.error('❌ Ошибка запуска:', error);
                  });
              }
          }
      };
      
      firstClickOverlay.addEventListener('click', handleOverlayClick);
      firstClickOverlay.addEventListener('touchend', handleOverlayClick);
  }
  
  // ===============================
  // ПЕРЕМЕННЫЕ СОСТОЯНИЯ
  // ===============================
  
  let videos = [];
  let videoOrder = [];
  let currentOrderIndex = 0;
  let userFavorites = userData?.favorites || [];
  let userLikes = userData?.likes || [];
  let userDislikes = userData?.dislikes || [];
  let currentTab = 'main';
  
  let watchedVideosSet = new Set(userData?.watchedVideos || []);
  let currentSessionOrder = userData?.currentSessionOrder || [];
  let watchTimer = null;
  let watchedSeconds = 0;
  const WATCH_THRESHOLD = 5;
  
  let skippedVideosBuffer = [];
  const SKIPPED_BUFFER_SIZE = 10;
  const MIN_VIDEOS_BEFORE_REPEAT = 5;
  
  let lastVideoUpdateTimer = null;
  let sessionOrderUpdateTimer = null;
  
  let isLoadingVideo = false;
  
  window.videos = videos;
  window.videoOrder = videoOrder;
  window.currentOrderIndex = currentOrderIndex;
  window.hasFirstClickOccurred = hasFirstClickOccurred;

  console.log('📊 Начальное состояние:', {
    favorites: userFavorites.length,
    likes: userLikes.length,
    dislikes: userDislikes.length,
    watched: watchedVideosSet.size
  });

  // ===============================
  // ФУНКЦИИ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК
  // ===============================
  
  function switchTab(tabName) {
    currentTab = tabName;
    videoController.setCurrentTab(tabName);
    
    if (tabName === 'main') {
      mainTab.classList.add('active');
      favoritesTab.classList.remove('active');
      mainContent.classList.add('active');
      favoritesContent.classList.remove('active');
      
      const activePlayer = videoPlayerManager.getActivePlayer();
      if (activePlayer) {
        if (activePlayer.src) {
          if (hasFirstClickOccurred) {
            // ✅ Проверяем звук при возврате на главную
            if (activePlayer.muted) {
              console.warn('⚠️ Звук был выключен, включаем');
              activePlayer.muted = false;
              activePlayer.volume = 1.0;
            }
            
            activePlayer.play().catch(error => {
              console.error('❌ Ошибка воспроизведения:', error);
            });
          }
        } else {
          loadVideo();
        }
      }
    } else if (tabName === 'favorites') {
      mainTab.classList.remove('active');
      favoritesTab.classList.add('active');
      mainContent.classList.remove('active');
      favoritesContent.classList.add('active');
      
      const activePlayer = videoPlayerManager.getActivePlayer();
      if (activePlayer && !activePlayer.paused) {
        activePlayer.pause();
      }
      
      updateFavoritesList();
    }
  }
  
  // ===============================
  // ОБРАБОТЧИКИ ВКЛАДОК
  // ===============================
  
  if (mainTab) {
    const handleMainTab = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentTab !== 'main') {
        switchTab('main');
      }
    };
    
    mainTab.addEventListener('click', handleMainTab);
    mainTab.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleMainTab(e);
    }, { passive: false });
  }
  
  if (favoritesTab) {
    const handleFavoritesTab = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentTab !== 'favorites') {
        switchTab('favorites');
      }
    };
    
    favoritesTab.addEventListener('click', handleFavoritesTab);
    favoritesTab.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleFavoritesTab(e);
    }, { passive: false });
  }
  
  // ===============================
  // ФУНКЦИИ ИЗБРАННОГО
  // ===============================
  
  async function updateFavoritesList() {
    const freshUserData = await window.telegramAuth.getUserData();
    if (freshUserData) {
      userFavorites = freshUserData.favorites || [];
    }
    
    const favoriteVideos = videos.filter(video => 
      userFavorites.includes(video.filename)
    );
    
    if (favoriteVideos.length === 0) {
      favoritesEmpty.style.display = 'flex';
      favoritesList.style.display = 'none';
      favoritesList.classList.remove('has-items');
    } else {
      favoritesEmpty.style.display = 'none';
      favoritesList.style.display = 'flex';
      favoritesList.classList.add('has-items');
      
      favoritesList.innerHTML = '';
      
      favoriteVideos.forEach(video => {
        const card = createFavoriteCard(video);
        favoritesList.appendChild(card);
      });
    }
  }
  
  function createFavoriteCard(video) {
    const card = document.createElement('div');
    card.className = 'favorite-card';
    card.setAttribute('data-video-filename', video.filename);
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'favorite-card-thumbnail';
    
    thumbnail.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" rx="8" fill="#1a1a1a"/>
        <circle cx="40" cy="40" r="25" fill="#333"/>
        <path d="M35 30L50 40L35 50V30Z" fill="#666"/>
      </svg>
    `;
    
    const info = document.createElement('div');
    info.className = 'favorite-card-info';
    
    const title = document.createElement('div');
    title.className = 'favorite-card-title';
    title.textContent = video.title || 'Без названия';
    
    const genre = document.createElement('div');
    genre.className = 'favorite-card-genre';
    genre.textContent = video.genre || 'Неизвестно';
    
    info.appendChild(title);
    info.appendChild(genre);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-card-remove';
    removeBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `;
    
    const handleCardClick = (e) => {
      if (!e.target.closest('.favorite-card-remove')) {
        const videoIndex = videos.findIndex(v => v.filename === video.filename);
        if (videoIndex !== -1) {
          switchTab('main');
          const orderIndex = videoOrder.indexOf(videoIndex);
          if (orderIndex !== -1) {
            currentOrderIndex = orderIndex;
            window.currentOrderIndex = currentOrderIndex;
          } else {
            currentOrderIndex = 0;
            window.currentOrderIndex = currentOrderIndex;
            videoOrder.unshift(videoIndex);
            window.videoOrder = videoOrder;
          }
          const currentVideoId = likeButton?.getAttribute('data-video-id');
          if (currentVideoId !== video.filename) {
            loadVideo();
          }
        }
      }
    };
    
    card.addEventListener('click', handleCardClick);
    card.addEventListener('touchend', (e) => {
      e.stopPropagation();
      handleCardClick(e);
    }, { passive: false });
    
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      userFavorites = userFavorites.filter(id => id !== video.filename);
      updateButtonStates(video.filename);
      
      const success = await window.telegramAuth.toggleFavorite(video.filename);
      if (!success) {
        userFavorites.push(video.filename);
        updateButtonStates(video.filename);
      } else {
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        setTimeout(() => {
          updateFavoritesList();
        }, 300);
      }
    });
    
    card.appendChild(thumbnail);
    card.appendChild(info);
    card.appendChild(removeBtn);
    
    return card;
  }
  
  // ===============================
  // ФУНКЦИИ УПРАВЛЕНИЯ ВИДЕО
  // ===============================
  
  function setupButtonWithPointerEvents(button, handler) {
    if (!button) return;
    
    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 100);
      
      handler(e);
    };
    
    button.addEventListener('click', handleClick);
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleClick(e);
    });
  }
  
  async function shuffleUnwatchedVideos() {
    const unwatchedIndices = [];
    
    videos.forEach((video, index) => {
      if (!watchedVideosSet.has(video.filename)) {
        const bufferIndex = skippedVideosBuffer.indexOf(video.filename);
        if (bufferIndex === -1 || bufferIndex < skippedVideosBuffer.length - MIN_VIDEOS_BEFORE_REPEAT) {
          unwatchedIndices.push(index);
        }
      }
    });
    
    console.log(`📊 Просмотрено: ${watchedVideosSet.size}, доступно: ${unwatchedIndices.length}`);
    
    if (unwatchedIndices.length < 3 && skippedVideosBuffer.length > 0) {
      const oldSkipped = skippedVideosBuffer.slice(0, Math.max(0, skippedVideosBuffer.length - MIN_VIDEOS_BEFORE_REPEAT));
      oldSkipped.forEach(filename => {
        const index = videos.findIndex(v => v.filename === filename);
        if (index !== -1 && !watchedVideosSet.has(filename)) {
          unwatchedIndices.push(index);
        }
      });
    }
    
    if (unwatchedIndices.length === 0) {
      console.log('🔄 Все просмотрено, новый круг');
      watchedVideosSet.clear();
      currentSessionOrder = [];
      skippedVideosBuffer = [];
      
      await window.telegramAuth.resetWatchProgress();
      
      unwatchedIndices.push(...videos.map((_, i) => i));
    }
    
    videoOrder = [...unwatchedIndices];
    for (let i = videoOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videoOrder[i], videoOrder[j]] = [videoOrder[j], videoOrder[i]];
    }
    
    currentOrderIndex = 0;
    window.videoOrder = videoOrder;
    window.currentOrderIndex = currentOrderIndex;
    
    currentSessionOrder = videoOrder.map(idx => videos[idx].filename);
    
    saveSessionOrderBatch();
    
    console.log('🔀 Видео перемешаны:', videoOrder.length);
  }

  function saveSessionOrderBatch() {
    if (sessionOrderUpdateTimer) {
      clearTimeout(sessionOrderUpdateTimer);
    }
    
    sessionOrderUpdateTimer = setTimeout(() => {
      window.telegramAuth.saveSessionOrder(currentSessionOrder);
    }, 2000);
  }

  function updateLastVideoBatch(videoId) {
    if (lastVideoUpdateTimer) {
      clearTimeout(lastVideoUpdateTimer);
    }
    
    lastVideoUpdateTimer = setTimeout(() => {
      window.telegramAuth.updateLastVideo(videoId);
    }, 10000);
  }

  function addToSkippedBuffer(filename) {
    const existingIndex = skippedVideosBuffer.indexOf(filename);
    if (existingIndex !== -1) {
      skippedVideosBuffer.splice(existingIndex, 1);
    }
    
    skippedVideosBuffer.push(filename);
    
    if (skippedVideosBuffer.length > SKIPPED_BUFFER_SIZE) {
      skippedVideosBuffer.shift();
    }
  }

  function resetWatchTimer() {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
    watchedSeconds = 0;
  }

  function startWatchTracking(filename) {
    resetWatchTimer();
    
    if (watchedVideosSet.has(filename)) {
      return;
    }
    
    console.log('⏱️ Отслеживание:', filename);
    
    const activePlayer = videoPlayerManager.getActivePlayer();
    
    watchTimer = setInterval(() => {
      if (activePlayer && !activePlayer.paused && currentTab === 'main') {
        watchedSeconds++;
        
        if (watchedSeconds >= WATCH_THRESHOLD) {
          markVideoAsWatched(filename);
          clearInterval(watchTimer);
          watchTimer = null;
        }
      }
    }, 1000);
  }

  async function markVideoAsWatched(filename) {
    console.log('✅ Просмотрено:', filename);
    
    watchedVideosSet.add(filename);
    
    const skipIndex = skippedVideosBuffer.indexOf(filename);
    if (skipIndex !== -1) {
      skippedVideosBuffer.splice(skipIndex, 1);
    }
    
    await window.telegramAuth.addWatchedVideo(filename, watchedSeconds);
  }

  // ===============================
  // ИСПРАВЛЕННАЯ ФУНКЦИЯ loadVideo()
  // ===============================
  
  async function loadVideo() {
    if (isLoadingVideo) {
      console.log('⏳ Уже загружается');
      return;
    }
    
    if (videos.length === 0) {
      console.warn('⚠️ Нет видео');
      return;
    }
    
    isLoadingVideo = true;
    videoController.setLoadingState(true);
    
    try {
      if (videoOrder.length === 0 || currentOrderIndex >= videoOrder.length) {
        await shuffleUnwatchedVideos();
      }
      
      // Обновляем данные пользователя
      try {
        const freshUserData = await window.telegramAuth.getUserData();
        if (freshUserData) {
          userFavorites = freshUserData.favorites || [];
          userLikes = freshUserData.likes || [];
          userDislikes = freshUserData.dislikes || [];
          watchedVideosSet = new Set(freshUserData.watchedVideos || []);
        }
      } catch (error) {
        console.error('❌ Ошибка обновления данных:', error);
      }
      
      const idx = videoOrder[currentOrderIndex];
      const videoData = videos[idx];
      console.log(`🎬 Загружаем видео ${currentOrderIndex + 1}/${videoOrder.length}`);
      
      if (videoData) {
        const videoId = videoData.filename;
        
        updateButtonStates(videoId);
        resetWatchTimer();

        // ===== ПРОВЕРКА ПРЕДЗАГРУЗКИ =====
        
        const isNextVideoReady = videoPlayerManager.isNextReady();
        const nextVideoData = videoPlayerManager.getNextVideoData();
        
        if (isNextVideoReady && nextVideoData && nextVideoData.filename === videoId) {
          console.log('🚀 МГНОВЕННОЕ ПЕРЕКЛЮЧЕНИЕ');
          
          // ✅ ИСПОЛЬЗУЕМ ИСПРАВЛЕННЫЙ switchToNextVideo()
          await videoPlayerManager.switchToNextVideo();
          
          if (currentTab === 'main' && hasFirstClickOccurred) {
            startWatchTracking(videoId);
          }
          
        } else {
          // Обычная загрузка
          console.log('📁 Обычная загрузка:', videoId);
          
          const activePlayer = videoPlayerManager.getActivePlayer();
          const newSrc = videoData.s3_url || videoData.url || 
                        `https://s3.regru.cloud/dorama-shorts/${encodeURIComponent(videoData.filename)}`;
          
          if (activePlayer.src !== newSrc) {
            // ✅ ВАЖНО: Проверяем и включаем звук
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
                
                // ✅ Дополнительная проверка звука
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
                
                startWatchTracking(videoId);
              }).catch(error => {
                console.error('❌ Ошибка воспроизведения:', error);
              });
            }
          }
        }

        // ===== ПРЕДЗАГРУЗКА СЛЕДУЮЩЕГО =====
        
        setTimeout(async () => {
          await videoPreloader.preloadNextVideo(currentOrderIndex, videoOrder, videos);
        }, 500);

        // Обновление UI
        videoTitle.textContent = videoData.title || 'Без названия';
        videoGenre.textContent = `${videoData.genre || 'Неизвестно'}`;
        
        updateLastVideoBatch(videoId);
      }
    } finally {
      isLoadingVideo = false;
      videoController.setLoadingState(false);
    }
  }
  
  window.videos = videos;
  window.videoOrder = videoOrder;
  window.currentOrderIndex = currentOrderIndex;
  window.hasFirstClickOccurred = hasFirstClickOccurred;
  window.updateButtonStates = updateButtonStates;
  window.startWatchTracking = startWatchTracking;
  window.updateLastVideoBatch = updateLastVideoBatch;
  window.shuffleUnwatchedVideos = shuffleUnwatchedVideos;

  // ===============================
  // ЗАГРУЗКА ВИДЕО С СЕРВЕРА
  // ===============================
  
  async function fetchVideos() {
    console.log('📥 Загрузка видео...');
    try {
      const response = await fetch('get_videos.php');
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const rawText = await response.text();
      
      try {
        videos = JSON.parse(rawText);
        window.videos = videos;
        console.log('✅ Видео загружено:', videos.length);
        
        if (videos.length > 0) {
          const existingFilenames = videos.map(v => v.filename);
          await window.telegramAuth.cleanDeletedVideos(existingFilenames);
          
          if (currentSessionOrder.length > 0) {
            restoreSessionOrder();
          } else {
            await shuffleUnwatchedVideos();
          }
          
          await loadVideo();
          updateFavoritesList();
          
          // Предзагрузка первых видео
          setTimeout(async () => {
            await videoPreloader.preloadNextVideo(currentOrderIndex, videoOrder, videos);
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

  function restoreSessionOrder() {
    const existingFilenames = new Set(videos.map(v => v.filename));
    const validOrder = currentSessionOrder.filter(filename => existingFilenames.has(filename));
    
    if (validOrder.length === 0) {
      shuffleUnwatchedVideos();
      return;
    }
    
    videoOrder = [];
    validOrder.forEach(filename => {
      const index = videos.findIndex(v => v.filename === filename);
      if (index !== -1 && !watchedVideosSet.has(filename)) {
        videoOrder.push(index);
      }
    });
    
    if (videoOrder.length === 0) {
      shuffleUnwatchedVideos();
      return;
    }
    
    currentOrderIndex = 0;
    window.videoOrder = videoOrder;
    window.currentOrderIndex = currentOrderIndex;
    currentSessionOrder = validOrder;
    console.log('✅ Порядок восстановлен:', videoOrder.length);
  }

  function updateButtonStates(videoId) {
    if (!videoId) return;
    
    if (likeButton) {
      const isLiked = userLikes.includes(videoId);
      likeButton.classList.toggle('active', isLiked);
      likeButton.setAttribute('data-video-id', videoId);
      
      const likeIcon = likeButton.querySelector('.like-icon');
      if (likeIcon) {
        likeIcon.src = isLiked ? 'svg/like-active.svg' : 'svg/like.svg';
      }
    }
    
    if (dislikeButton) {
      const isDisliked = userDislikes.includes(videoId);
      dislikeButton.classList.toggle('active', isDisliked);
      dislikeButton.setAttribute('data-video-id', videoId);
      
      const dislikeIcon = dislikeButton.querySelector('.dislike-icon');
      if (dislikeIcon) {
        dislikeIcon.src = isDisliked ? 'svg/dislike-active.svg' : 'svg/dislike.svg';
      }
    }
    
    if (favoriteButton) {
      const isFavorite = userFavorites.includes(videoId);
      favoriteButton.classList.toggle('active', isFavorite);
      favoriteButton.setAttribute('data-video-id', videoId);
      
      const favoriteIcon = favoriteButton.querySelector('.favorite-icon');
      if (favoriteIcon) {
        const timestamp = Date.now();
        favoriteIcon.src = isFavorite ? `svg/favorites-active.svg?t=${timestamp}` : `svg/favorites.svg?t=${timestamp}`;
      }
    }
  }

  async function nextVideo() {
    console.log('⏭️ Следующее видео');
    
    if (videos.length > 0 && videoOrder.length > 0 && currentOrderIndex < videoOrder.length) {
      const currentVideo = videos[videoOrder[currentOrderIndex]];
      if (currentVideo && !watchedVideosSet.has(currentVideo.filename)) {
        addToSkippedBuffer(currentVideo.filename);
      }
    }
    
    const newIndex = currentOrderIndex + 1;
    
    if (newIndex >= videoOrder.length) {
      await shuffleUnwatchedVideos();
    } else {
      currentOrderIndex = newIndex;
      window.currentOrderIndex = currentOrderIndex;
    }
    
    await loadVideo();
  }

  function showDescription() {
    if (videos.length === 0) return;
    
    const idx = videoOrder[currentOrderIndex];
    const videoData = videos[idx];
    
    if (videoData) {
      const title = videoData.title || 'Без названия';
      const description = videoData.description || 'Описание отсутствует';
      const series = videoData.series || 'Неизвестно';
      const seasons = videoData.seasons || 'Неизвестно';
      const status = videoData.status || 'Неизвестно';
      const country = videoData.country || 'Неизвестно';
      const genre = videoData.genre || 'Неизвестно';
      const year = videoData.year || 'Неизвестно';
      
      const fullDescription = `${description}

📊 Подробная информация:
• Год выпуска: ${year}
• Серии: ${series}
• Сезоны: ${seasons}  
• Статус: ${status}
• Страна: ${country}
• Жанр: ${genre}`;
      
      if (modalTitle) {
        modalTitle.textContent = title;
      }
      
      if (modalDescription) {
        modalDescription.textContent = fullDescription;
      }
      
      if (descriptionModal) {
        descriptionModal.classList.add('show');
      }
    }
  }

  function hideDescription() {
    if (descriptionModal) {
      descriptionModal.classList.remove('show');
    }
  }

  // ===============================
  // НАСТРОЙКА КНОПОК
  // ===============================
  
  setupButtonWithPointerEvents(likeButton, async (e) => {
    const videoId = likeButton.getAttribute('data-video-id');
    if (!videoId) return;
    
    try {
      const freshUserData = await window.telegramAuth.getUserData();
      if (freshUserData) {
        userFavorites = freshUserData.favorites || [];
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
    }
    
    const isCurrentlyLiked = userLikes.includes(videoId);
    const wasDisliked = userDislikes.includes(videoId);
    
    if (isCurrentlyLiked) {
      userLikes = userLikes.filter(id => id !== videoId);
    } else {
      userLikes.push(videoId);
      if (wasDisliked) {
        userDislikes = userDislikes.filter(id => id !== videoId);
      }
    }
    updateButtonStates(videoId);
    
    const actions = [];
    
    if (isCurrentlyLiked) {
      actions.push(window.telegramAuth.updateReaction('remove_like', videoId));
    } else {
      actions.push(window.telegramAuth.updateReaction('add_like', videoId));
      if (wasDisliked) {
        actions.push(window.telegramAuth.updateReaction('remove_dislike', videoId));
      }
    }
    
    Promise.all(actions).then(results => {
      const allSuccess = results.every(success => success === true);
      if (!allSuccess) {
        if (isCurrentlyLiked) {
          userLikes.push(videoId);
        } else {
          userLikes = userLikes.filter(id => id !== videoId);
          if (wasDisliked) {
            userDislikes.push(videoId);
          }
        }
        updateButtonStates(videoId);
      }
    });
  });

  setupButtonWithPointerEvents(dislikeButton, async (e) => {
    const videoId = dislikeButton.getAttribute('data-video-id');
    if (!videoId) return;
    
    try {
      const freshUserData = await window.telegramAuth.getUserData();
      if (freshUserData) {
        userFavorites = freshUserData.favorites || [];
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
    }
    
    const isCurrentlyDisliked = userDislikes.includes(videoId);
    const wasLiked = userLikes.includes(videoId);
    
    if (isCurrentlyDisliked) {
      userDislikes = userDislikes.filter(id => id !== videoId);
    } else {
      userDislikes.push(videoId);
      if (wasLiked) {
        userLikes = userLikes.filter(id => id !== videoId);
      }
    }
    updateButtonStates(videoId);
    
    const actions = [];
    
    if (isCurrentlyDisliked) {
      actions.push(window.telegramAuth.updateReaction('remove_dislike', videoId));
    } else {
      actions.push(window.telegramAuth.updateReaction('add_dislike', videoId));
      if (wasLiked) {
        actions.push(window.telegramAuth.updateReaction('remove_like', videoId));
      }
    }
    
    Promise.all(actions).then(results => {
      const allSuccess = results.every(success => success === true);
      if (!allSuccess) {
        if (isCurrentlyDisliked) {
          userDislikes.push(videoId);
        } else {
          userDislikes = userDislikes.filter(id => id !== videoId);
          if (wasLiked) {
            userLikes.push(videoId);
          }
        }
        updateButtonStates(videoId);
      }
    });
  });

  setupButtonWithPointerEvents(favoriteButton, async (e) => {
    const videoId = favoriteButton.getAttribute('data-video-id');
    if (!videoId) return;
    
    try {
      const freshUserData = await window.telegramAuth.getUserData();
      if (freshUserData) {
        userFavorites = freshUserData.favorites || [];
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
    }
    
    const isFavorite = userFavorites.includes(videoId);
    
    if (isFavorite) {
      userFavorites = userFavorites.filter(id => id !== videoId);
    } else {
      userFavorites.push(videoId);
    }
    updateButtonStates(videoId);
    
    window.telegramAuth.toggleFavorite(videoId).then(success => {
      if (!success) {
        if (isFavorite) {
          userFavorites.push(videoId);
        } else {
          userFavorites = userFavorites.filter(id => id !== videoId);
        }
        updateButtonStates(videoId);
      }
    });
    
    if (currentTab === 'favorites') {
      setTimeout(() => updateFavoritesList(), 300);
    }
  });

  if (descriptionButton) {
    descriptionButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDescription();
    });
    
    descriptionButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDescription();
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideDescription();
    });
    
    modalClose.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideDescription();
    });
  }

  if (descriptionModal) {
    descriptionModal.addEventListener('click', (e) => {
      if (e.target === descriptionModal) {
        hideDescription();
      }
    });
  }

  // ===============================
  // НАСТРОЙКА VIDEO ЭЛЕМЕНТОВ
  // ===============================
  
  const activePlayer = videoPlayerManager.getActivePlayer();
  if (activePlayer) {
    // ✅ ВАЖНО: Убеждаемся, что звук включен
    activePlayer.muted = false;
    activePlayer.volume = 1.0;
    
    console.log('🔊 Начальная настройка активного плеера:', {
      muted: activePlayer.muted,
      volume: activePlayer.volume
    });
    
    activePlayer.addEventListener('playing', async () => {
      console.log('🎬 Видео воспроизводится');
      
      // ✅ Проверяем звук при каждом запуске
      if (activePlayer.muted) {
        console.warn('⚠️ Звук был выключен при playing, включаем');
        activePlayer.muted = false;
      }
      
      setTimeout(async () => {
        await videoPreloader.preloadNextVideo(currentOrderIndex, videoOrder, videos);
      }, 1000);
    });
    
    // ✅ Добавляем обработчик для отслеживания проблем со звуком
    activePlayer.addEventListener('volumechange', () => {
      console.log(`🔊 Громкость изменена: volume=${activePlayer.volume}, muted=${activePlayer.muted}`);
    });
    
    // ✅ Обработчик паузы
    activePlayer.addEventListener('pause', () => {
      console.log('⏸️ Видео на паузе');
    });
    
    // ✅ Обработчик ошибок
    activePlayer.addEventListener('error', (e) => {
      console.error('❌ Ошибка видео:', e);
    });
  }

  // ===============================
  // ГЛОБАЛЬНЫЕ ФУНКЦИИ
  // ===============================
  
  window.nextVideo = nextVideo;
  window.loadVideo = loadVideo;

  // ===============================
  // ЗАПУСК ПРИЛОЖЕНИЯ
  // ===============================
  
  await fetchVideos();

  console.log('🎥 Ожидаем первый клик');

  // ===============================
  // ДИАГНОСТИКА ЗВУКА
  // ===============================

  // Проверяем состояние звука каждые 2 секунды
  setInterval(() => {
    const active = videoPlayerManager.getActivePlayer();
    const inactive = videoPlayerManager.getInactivePlayer();
    
    if (active && !active.paused && currentTab === 'main') {
      if (active.muted) {
        console.warn('⚠️ ПРОБЛЕМА: Активное видео без звука! Исправляем...');
        active.muted = false;
        active.volume = 1.0;
      }
    }
    
    // Неактивное видео должно быть без звука
    if (inactive && !inactive.paused) {
      if (!inactive.muted) {
        console.warn('⚠️ ПРОБЛЕМА: Неактивное видео со звуком! Исправляем...');
        inactive.muted = true;
        inactive.pause();
      }
    }
  }, 2000);

  // Периодическая синхронизация
  setInterval(async () => {
    try {
      const freshUserData = await window.telegramAuth.getUserData();
      if (freshUserData) {
        userFavorites = freshUserData.favorites || [];
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];
        watchedVideosSet = new Set(freshUserData.watchedVideos || []);
        
        const currentVideoId = likeButton?.getAttribute('data-video-id');
        if (currentVideoId) {
          updateButtonStates(currentVideoId);
        }
        
        if (currentTab === 'favorites') {
          updateFavoritesList();
        }
      }
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
    }
  }, 30000);

  window.addEventListener('beforeunload', () => {
    if (lastVideoUpdateTimer) {
      clearTimeout(lastVideoUpdateTimer);
      const currentVideoId = likeButton?.getAttribute('data-video-id');
      if (currentVideoId) {
        window.telegramAuth.updateLastVideo(currentVideoId);
      }
    }
    
    if (sessionOrderUpdateTimer) {
      clearTimeout(sessionOrderUpdateTimer);
      window.telegramAuth.saveSessionOrder(currentSessionOrder);
    }
  });
// ===============================
// МОНИТОРИНГ КОНФЛИКТОВ
// ===============================

setInterval(() => {
  const current = document.getElementById('currentVideo');
  const next = document.getElementById('nextVideo');
  const active = videoPlayerManager.getActivePlayer();
  const inactive = videoPlayerManager.getInactivePlayer();
  
  // Проверка 1: Оба плеера играют одновременно
  if (!current.paused && !next.paused) {
    console.error('🚨 КОНФЛИКТ: Оба плеера играют!');
    inactive.pause();
    inactive.muted = true;
    inactive.volume = 0;
  }
  
  // Проверка 2: Неактивный плеер со звуком
  if (!inactive.paused && (!inactive.muted || inactive.volume > 0)) {
    console.error('🚨 КОНФЛИКТ: Неактивный плеер со звуком!');
    inactive.pause();
    inactive.muted = true;
    inactive.volume = 0;
  }
  
  // Проверка 3: Активный плеер без звука
  if (!active.paused && (active.muted || active.volume === 0)) {
    console.error('🚨 ПРОБЛЕМА: Активный плеер без звука!');
    active.muted = false;
    active.volume = 1.0;
  }
  
  // Проверка 4: Заедание (currentTime не меняется)
  if (window.lastCheckTime !== undefined) {
    if (!active.paused && active.currentTime === window.lastCurrentTime) {
      console.error('🚨 ЗАЕДАНИЕ: currentTime не меняется!');
      console.log('Состояние:', {
        paused: active.paused,
        currentTime: active.currentTime,
        readyState: active.readyState,
        buffered: active.buffered.length > 0 ? active.buffered.end(0) : 0,
        networkState: active.networkState
      });
      
      // Попытка исправить
      if (active.readyState >= 2) {
        active.play().catch(e => console.error('Ошибка перезапуска:', e));
      }
    }
  }
  
  window.lastCurrentTime = active.currentTime;
  window.lastCheckTime = Date.now();
  
}, 2000);


  console.log('🎉 DoramaShorts v9.1 с исправленным звуком полностью инициализирован!');
});