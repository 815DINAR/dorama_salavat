import FavoritesManager from "./managers/FavoritesManager.js";
import VideoPlayerManager from "./managers/VideoPlayerManager.js";
import VideoPreloader from "./managers/VideoPreloader.js";
import VideoManager from "./managers/VideoManager.js";
import WatchTracker from "./managers/WatchTracker.js";
import VideoController from "./controllers/VideoController.js";
import GestureController from "./controllers/GestureController.js";
import UIController from "./controllers/UIController.js";
import DebugLogger from "./utils/DebugLogger.js";

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

  const videoManager = new VideoManager(videoPlayerManager, videoPreloader, window.telegramAuth);
  videoManager.initializeFromUserData(userData);

  // ✅ Создаём FavoritesManager
  const favoritesManager = new FavoritesManager(videoManager, window.telegramAuth);

  // ✅ Устанавливаем начальное состояние
  favoritesManager.setUserFavorites(userFavorites);

  // ✅ Устанавливаем DOM элементы
  favoritesManager.setDOMElements(favoritesList, favoritesEmpty);

  // ✅ НОВЫЙ: Колбэк для синхронизации состояния избранного
  favoritesManager.setFavoritesChangedCallback((updatedFavorites) => {
    console.log('🔄 Синхронизация избранного:', updatedFavorites.length, 'видео');
    userFavorites = updatedFavorites;
  });

  // ✅ Настраиваем колбэки
  favoritesManager.setSwitchToMainTabCallback(() => {
      switchTab('main');
  });

  favoritesManager.setUpdateButtonStatesCallback((videoId) => {
      updateButtonStates(videoId);
  });

  favoritesManager.setLoadVideoCallback(async () => {
      await videoManager.loadVideo(
          videoController,
          updateButtonStates,
          watchTracker,
          videoTitle,
          videoGenre,
          currentTab,
          hasFirstClickOccurred
      );
  });

  const watchTracker = new WatchTracker(window.telegramAuth, videoPlayerManager);
  watchTracker.initializeFromUserData(userData);

  window.videoPreloader = videoPreloader;
  window.videoPlayerManager = videoPlayerManager;
  window.videoManager = videoManager;
  window.watchTracker = watchTracker;

  console.log("✅ VideoManager инициализирован");

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

  let currentSessionOrder = userData?.currentSessionOrder || [];
  
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
    watched: watchTracker.getWatchedCount()
  });

  // ===============================
  // ФУНКЦИИ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК
  // ===============================
  
  function switchTab(tabName) {
    currentTab = tabName;
    videoController.setCurrentTab(tabName);

    if (window.videoManager) {
        videos = window.videoManager.getVideos();
        videoOrder = window.videoManager.getVideoOrder();
        currentOrderIndex = window.videoManager.getCurrentOrderIndex();
    }
    
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
            videoManager.loadVideo(
                videoController,
                updateButtonStates,
                watchTracker,
                videoTitle,
                videoGenre,
                currentTab,
                hasFirstClickOccurred
            );
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

  // Настраиваем колбэки для FavoritesManager
  favoritesManager.setSwitchToMainTabCallback(() => {
    switchTab('main');
  });

  favoritesManager.setUpdateButtonStatesCallback((videoId) => {
    updateButtonStates(videoId);
  });

  async function updateFavoritesList() {
    // ✅ FavoritesManager управляет состоянием и уведомляет через колбэк
    await favoritesManager.updateFavoritesList();
    // ✅ userFavorites уже обновлён через onFavoritesChanged колбэк
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

  // ===============================
  // ИСПРАВЛЕННАЯ ФУНКЦИЯ loadVideo()
  // ===============================

  window.videos = videos;
  window.videoOrder = videoOrder;
  window.currentOrderIndex = currentOrderIndex;
  window.hasFirstClickOccurred = hasFirstClickOccurred;
  window.updateButtonStates = updateButtonStates;
  window.startWatchTracking = (filename, currentTab) => {
      watchTracker.startWatchTracking(filename, currentTab);
  };
  window.updateLastVideoBatch = async () => {
      await videoManager.updateLastVideoBatch();
  };
  window.shuffleUnwatchedVideos = async () => {
    await videoManager.shuffleUnwatchedVideos();
  };

  // ===============================
  // ЗАГРУЗКА ВИДЕО С СЕРВЕРА
  // ===============================

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

  function showDescription() {
    const videosList = window.videoManager ? window.videoManager.getVideos() : videos;
    const order = window.videoManager ? window.videoManager.getVideoOrder() : videoOrder;
    const currentIdx = window.videoManager ? window.videoManager.getCurrentOrderIndex() : currentOrderIndex;
    if (videosList.length === 0) {
        console.warn('⚠️ Нет видео для отображения описания');
        return;
    }
    
    const idx = order[currentIdx];
    const videoData = videosList[idx];
    
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
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];

        favoritesManager.setUserFavorites(freshUserData.favorites || []);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
    }
    
    const isFavorite = favoritesManager.isFavorite(videoId);
    
    if (isFavorite) {
      favoritesManager.removeFromFavorites(videoId);
    } else {
      favoritesManager.addToFavorites(videoId);
    }
    updateButtonStates(videoId);
    
    window.telegramAuth.toggleFavorite(videoId).then(success => {
      if (!success) {
        if (isFavorite) {
          favoritesManager.addToFavorites(videoId);
        } else {
          favoritesManager.removeFromFavorites(videoId);
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
  
  window.nextVideo = async () => {
      await videoManager.nextVideo(
          videoController,
          updateButtonStates,
          watchTracker,
          videoTitle,
          videoGenre,
          currentTab,
          hasFirstClickOccurred
      );
  };
  window.loadVideo = async () => {
      await videoManager.loadVideo(
          videoController,
          updateButtonStates,
          watchTracker,
          videoTitle,
          videoGenre,
          currentTab,
          hasFirstClickOccurred
      );
  };

  // ===============================
  // ЗАПУСК ПРИЛОЖЕНИЯ
  // ===============================

    await videoManager.fetchVideos(
        updateFavoritesList,
        videoController,
        updateButtonStates,
        watchTracker,
        videoTitle,
        videoGenre,
        currentTab,
        hasFirstClickOccurred
    );

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
        userLikes = freshUserData.likes || [];
        userDislikes = freshUserData.dislikes || [];
        favoritesManager.setUserFavorites(freshUserData.favorites || []);
        watchTracker.updateWatchedVideos(freshUserData.watchedVideos || []);
        
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

    watchTracker.cleanup();
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

    window.addEventListener("beforeunload", () => {
        videoManager.cleanup();
        watchTracker.cleanup();
    });

  console.log('🎉 DoramaShorts v9.1 с исправленным звуком полностью инициализирован!');
});