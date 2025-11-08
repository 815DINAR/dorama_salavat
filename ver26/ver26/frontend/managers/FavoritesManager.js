// FavoritesManager.js
// Управление списком избранного

export default class FavoritesManager {
    constructor(videoManager, telegramAuth) {
        this.videoManager = videoManager;
        this.telegramAuth = telegramAuth;
        
        // Кеш для уже созданных карточек
        this.favoritesCardsCache = new Map();
        
        // Колбэки (будут установлены из app.js)
        this.onSwitchToMainTab = null;
        this.onUpdateButtonStates = null;
    }

    /**
     * Устанавливает колбэк для переключения на главную вкладку
     */
    setSwitchToMainTabCallback(callback) {
        this.onSwitchToMainTab = callback;
    }

    /**
     * Устанавливает колбэк для обновления состояний кнопок
     */
    setUpdateButtonStatesCallback(callback) {
        this.onUpdateButtonStates = callback;
    }

    /**
     * Обновляет список избранного
     */
    async updateFavoritesList(userFavorites, favoritesList, favoritesEmpty) {
        const freshUserData = await this.telegramAuth.getUserData();
        if (freshUserData) {
            userFavorites = freshUserData.favorites || [];
        }

        const videosList = this.videoManager ? this.videoManager.getVideos() : [];
        const favoriteVideos = videosList.filter(video =>
            userFavorites.includes(video.filename)
        );

        if (favoriteVideos.length === 0) {
            favoritesEmpty.style.display = 'flex';
            favoritesList.style.display = 'none';
            favoritesList.classList.remove('has-items');
            // Очищаем кеш
            this.favoritesCardsCache.clear();
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
                    this.favoritesCardsCache.delete(filename);
                }
            });

            // Добавляем/упорядочиваем карточки в DOM согласно порядку favoriteVideos
            favoriteVideos.forEach(video => {
                let card = this.favoritesCardsCache.get(video.filename);
                if (!card) {
                    card = this.createFavoriteCard(video, userFavorites);
                    this.favoritesCardsCache.set(video.filename, card);
                    console.log('➕ Добавлена карточка:', video.filename);
                }
                favoritesList.appendChild(card); // appendChild перемещает существующий узел, если он уже есть
            });
        }
        console.log('✅ updateFavoritesList: found', favoriteVideos.length, 'favoriteVideos. userFavorites count:', userFavorites.length);
        
        return userFavorites;
    }

    /**
     * Создает карточку избранного видео
     */
    createFavoriteCard(video, userFavorites) {
        const card = document.createElement('div');
        card.className = 'favorite-card';
        card.setAttribute('data-video-filename', video.filename);

        // Создаем миниатюру
        const thumbnail = this.createThumbnail(video);
        
        // Создаем информацию о видео
        const info = this.createVideoInfo(video);
        
        // Создаем кнопку удаления
        const removeBtn = this.createRemoveButton(video, userFavorites);

        // Обработчик клика по карточке
        const handleCardClick = (e) => {
            if (!e.target.closest('.favorite-card-remove')) {
                this.playVideoFromCard(video);
            }
        };

        card.addEventListener('click', handleCardClick);
        card.addEventListener('touchend', (e) => {
            e.stopPropagation();
            handleCardClick(e);
        }, { passive: false });

        card.appendChild(thumbnail);
        card.appendChild(info);
        card.appendChild(removeBtn);

        return card;
    }

    /**
     * Создает миниатюру видео
     */
    createThumbnail(video) {
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
        return thumbnail;
    }

    /**
     * Создает блок с информацией о видео
     */
    createVideoInfo(video) {
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

        return info;
    }

    /**
     * Создает кнопку удаления
     */
    createRemoveButton(video, userFavorites) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'favorite-card-remove';
        removeBtn.innerHTML = '⋮';
        removeBtn.setAttribute('aria-label', 'Удалить из избранного');
        removeBtn.setAttribute('title', 'Удалить из избранного');

        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.handleRemoveClick(video, userFavorites);
        });

        return removeBtn;
    }

    /**
     * Обработчик удаления видео из избранного
     */
    async handleRemoveClick(video, userFavorites) {
        // Удаляем локально
        const index = userFavorites.indexOf(video.filename);
        if (index > -1) {
            userFavorites.splice(index, 1);
        }

        if (this.onUpdateButtonStates) {
            this.onUpdateButtonStates(video.filename);
        }

        // Отправляем на сервер
        const success = await this.telegramAuth.toggleFavorite(video.filename);
        
        if (!success) {
            // Откатываем изменения
            userFavorites.push(video.filename);
            if (this.onUpdateButtonStates) {
                this.onUpdateButtonStates(video.filename);
            }
        } else {
            // Анимация удаления
            const card = this.favoritesCardsCache.get(video.filename);
            if (card) {
                card.style.opacity = '0';
                setTimeout(() => {
                    // Обновляем список через 200мс для плавности
                    const favoritesList = document.getElementById('favoritesList');
                    const favoritesEmpty = document.getElementById('favoritesEmpty');
                    this.updateFavoritesList(userFavorites, favoritesList, favoritesEmpty);
                }, 200);
            }
        }
    }

    /**
     * Воспроизводит видео из карточки избранного
     */
    playVideoFromCard(video) {
        const videosList = this.videoManager ? this.videoManager.getVideos() : [];
        const videoIndex = videosList.findIndex(v => v.filename === video.filename);

        if (videoIndex !== -1) {
            // Переключаемся на главную вкладку
            if (this.onSwitchToMainTab) {
                this.onSwitchToMainTab();
            }

            // Если этот файл уже есть в текущем порядке — просто выставим индекс
            const currentOrder = this.videoManager.getVideoOrder();
            const orderIndex = currentOrder.indexOf(videoIndex);
            
            if (orderIndex !== -1) {
                this.videoManager.setCurrentOrderIndex(orderIndex);
            } else {
                // Добавляем в начало порядка и устанавливаем индекс 0
                const newOrder = [videoIndex, ...currentOrder];
                this.videoManager.setVideoOrder(newOrder);
                this.videoManager.setCurrentOrderIndex(0);
            }

            // Запускаем загрузку видео
            // Этот вызов должен быть настроен через app.js
            if (window.loadVideo) {
                window.loadVideo().catch(err => console.error('Ошибка loadVideo через карточку избранного:', err));
            }
        }
    }

    /**
     * Очищает кеш карточек
     */
    clearCache() {
        this.favoritesCardsCache.clear();
    }
}
