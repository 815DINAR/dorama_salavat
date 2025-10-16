// script102.js v9.1 - Исправленная версия со звуком
document.addEventListener('DOMContentLoaded', async () => {

  window.debugLogger = new DebugLogger();
  
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
  const uiController = new UIController(videoPlayerManager);
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

    // Кеш для уже созданных карточек
    const favoritesCardsCache = new Map();

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
            // Очищаем кеш
            favoritesCardsCache.clear();
        } else {
            favoritesEmpty.style.display = 'none';
            favoritesList.style.display = 'grid';
            favoritesList.classList.add('has-items');

            // ✅ ОПТИМИЗАЦИЯ: Не пересоздаем карточки, если они уже есть
            const currentFilenames = new Set(favoriteVideos.map(v => v.filename));

            // Удаляем карточки которых больше нет в избранном
            Array.from(favoritesList.children).forEach(card => {
                const filename = card.getAttribute('data-video-filename');
                if (!currentFilenames.has(filename)) {
                    card.remove();
                    favoritesCardsCache.delete(filename);
                }
            });

            // Добавляем/упорядочиваем карточки в DOM согласно порядку favoriteVideos
            favoriteVideos.forEach(video => {
                let card = favoritesCardsCache.get(video.filename);
                if (!card) {
                    card = createFavoriteCard(video);
                    favoritesCardsCache.set(video.filename, card);
                    console.log('➕ Добавлена карточка:', video.filename);
                }
                favoritesList.appendChild(card); // appendChild перемещает существующий узел, если он уже есть
            });
        }
    }

    function createFavoriteCard(video) {
        const card = document.createElement('div');
        card.className = 'favorite-card';
        card.setAttribute('data-video-filename', video.filename);

        const thumbnail = document.createElement('div');
        thumbnail.className = 'favorite-card-thumbnail';

        const videoSrc = video.s3_url || video.url ||
            `https://s3.regru.cloud/dorama-shorts/${encodeURIComponent(video.filename)}`;

        // Создаем video элемент для миниатюры
        const thumbnailVideo = document.createElement('video');
        thumbnailVideo.src = videoSrc;
        thumbnailVideo.muted = true;
        thumbnailVideo.playsInline = true;
        thumbnailVideo.preload = 'metadata';
        thumbnailVideo.style.width = '100%';
        thumbnailVideo.style.height = '100%';
        thumbnailVideo.style.objectFit = 'cover';

        // ✅ ИСПРАВЛЕНО: Загружаем кадр ОДИН РАЗ
        let frameLoaded = false;

        thumbnailVideo.addEventListener('loadedmetadata', () => {
            if (!frameLoaded) {
                thumbnailVideo.currentTime = Math.min(1, thumbnailVideo.duration * 0.1);
            }
        });

        thumbnailVideo.addEventListener('seeked', () => {
            if (!frameLoaded) {
                frameLoaded = true;
                console.log('✅ Миниатюра загружена:', video.filename);
            }
        });

        // Предотвращаем повторную загрузку
        thumbnailVideo.addEventListener('canplay', () => {
            if (frameLoaded) {
                thumbnailVideo.pause();
            }
        });

        thumbnail.appendChild(thumbnailVideo);

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
        removeBtn.innerHTML = '⋮';
        removeBtn.setAttribute('aria-label', 'Удалить из избранного');
        removeBtn.setAttribute('title', 'Удалить из избранного');

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
                card.style.opacity = '0';
                setTimeout(() => {
                    updateFavoritesList();
                }, 200);
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
        likeIcon.src = isLiked ? 'frontend/assets/svg/like-active.svg' : 'frontend/assets/svg/like.svg';
      }
    }
    
    if (dislikeButton) {
      const isDisliked = userDislikes.includes(videoId);
      dislikeButton.classList.toggle('active', isDisliked);
      dislikeButton.setAttribute('data-video-id', videoId);
      
      const dislikeIcon = dislikeButton.querySelector('.dislike-icon');
      if (dislikeIcon) {
        dislikeIcon.src = isDisliked ? 'frontend/assets/svg/dislike-active.svg' : 'frontend/assets/svg/dislike.svg';
      }
    }
    
    if (favoriteButton) {
      const isFavorite = userFavorites.includes(videoId);
      favoriteButton.classList.toggle('active', isFavorite);
      favoriteButton.setAttribute('data-video-id', videoId);
      
      const favoriteIcon = favoriteButton.querySelector('.favorite-icon');
      if (favoriteIcon) {
        const timestamp = Date.now();
        favoriteIcon.src = isFavorite ? `frontend/assets/svg/favorites-active.svg?t=${timestamp}` : `frontend/assets/svg/favorites.svg?t=${timestamp}`;
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

Год выпуска: ${year}
Серии: ${series}
Сезоны: ${seasons}  
Статус: ${status}
Страна: ${country}
Жанр: ${genre}`;
      
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