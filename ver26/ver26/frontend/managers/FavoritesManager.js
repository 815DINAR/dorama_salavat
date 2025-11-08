// FavoritesManager.js
// Управление списком избранного
// ✅ Single Source of Truth для userFavorites

export default class FavoritesManager {
    constructor(videoManager, telegramAuth) {
        this.videoManager = videoManager;
        this.telegramAuth = telegramAuth;
        
        // Кеш для уже созданных карточек
        this.favoritesCardsCache = new Map();
        
        // ✅ СОСТОЯНИЕ: Единственное место хранения userFavorites
        this.userFavorites = [];
        
        // DOM элементы (устанавливаются через setDOMElements)
        this.favoritesList = null;
        this.favoritesEmpty = null;
        
        // Колбэки (будут установлены из app.js)
        this.onSwitchToMainTab = null;
        this.onUpdateButtonStates = null;
        this.onLoadVideo = null;
        this.onFavoritesChanged = null;
    }

    /**
     * Устанавливает ссылки на DOM элементы
     */
    setDOMElements(favoritesList, favoritesEmpty) {
        this.favoritesList = favoritesList;
        this.favoritesEmpty = favoritesEmpty;
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
     * Устанавливает колбэк для загрузки видео
     */
    setLoadVideoCallback(callback) {
        this.onLoadVideo = callback;
    }

    /**
     * Устанавливает колбэк для уведомления об изменении избранного
     * Вызывается когда this.userFavorites изменяется
     */
    setFavoritesChangedCallback(callback) {
        this.onFavoritesChanged = callback;
    }

    /**
     * Получает актуальный список избранного
     * ✅ Возвращает копию массива для предотвращения внешних мутаций
     */
    getUserFavorites() {
        return [...this.userFavorites];
    }

    /**
     * Устанавливает список избранного и уведомляет об изменении
     */
    setUserFavorites(favorites) {
        this.userFavorites = [...(favorites || [])];
        this.notifyFavoritesChanged();
    }

    /**
     * Добавляет видео в избранное (локально)
     */
    addToFavorites(videoId) {
        if (!this.userFavorites.includes(videoId)) {
            this.userFavorites.push(videoId);
            this.notifyFavoritesChanged();
            console.log('➕ Добавлено в избранное:', videoId);
        }
    }

    /**
     * Удаляет видео из избранного (локально)
     */
    removeFromFavorites(videoId) {
        const index = this.userFavorites.indexOf(videoId);
        if (index > -1) {
            this.userFavorites.splice(index, 1);
            this.notifyFavoritesChanged();
            console.log('➖ Удалено из избранного:', videoId);
        }
    }

    /**
     * Проверяет, находится ли видео в избранном
     */
    isFavorite(videoId) {
        return this.userFavorites.includes(videoId);
    }

    /**
     * Уведомляет app.js об изменении избранного
     */
    notifyFavoritesChanged() {
        if (this.onFavoritesChanged) {
            // ✅ Передаём копию массива для защиты от внешних мутаций
            this.onFavoritesChanged([...this.userFavorites]);
        }
    }

    /**
     * Обновляет список избранного из сервера и перерисовывает UI
     */
    async updateFavoritesList() {
        // Проверяем, что DOM элементы установлены
        if (!this.favoritesList || !this.favoritesEmpty) {
            console.error('❌ FavoritesManager: DOM элементы не установлены. Вызовите setDOMElements()');
            return;
        }

        // ✅ Получаем свежие данные с сервера
        const freshUserData = await this.telegramAuth.getUserData();
        if (freshUserData && freshUserData.favorites) {
            const serverFavorites = freshUserData.favorites || [];
            
            // Проверяем, изменились ли данные
            const hasChanged = JSON.stringify(this.userFavorites.sort()) !== 
                              JSON.stringify(serverFavorites.sort());
            
            if (hasChanged) {
                this.userFavorites = [...serverFavorites];
                this.notifyFavoritesChanged();
                console.log('🔄 Синхронизировано с сервером:', this.userFavorites.length, 'избранных');
            }
        }

        // Получаем видео для отображения
        const videosList = this.videoManager ? this.videoManager.getVideos() : [];
        const favoriteVideos = videosList.filter(video =>
            this.userFavorites.includes(video.filename)
        );

        if (favoriteVideos.length === 0) {
            this.showEmptyState();
        } else {
            this.renderFavoritesList(favoriteVideos);
        }

        console.log('✅ updateFavoritesList: отображено', favoriteVideos.length, 'видео');
    }

    /**
     * Показывает пустое состояние (нет избранного)
     */
    showEmptyState() {
        this.favoritesEmpty.style.display = 'flex';
        this.favoritesList.style.display = 'none';
        this.favoritesList.classList.remove('has-items');
        this.favoritesCardsCache.clear();
    }

    /**
     * Рендерит список избранного с оптимизацией DOM операций
     */
    renderFavoritesList(favoriteVideos) {
        this.favoritesEmpty.style.display = 'none';
        this.favoritesList.style.display = 'grid';
        this.favoritesList.classList.add('has-items');

        const currentFilenames = new Set(favoriteVideos.map(v => v.filename));

        // Удаляем карточки которых больше нет в избранном
        Array.from(this.favoritesList.children).forEach(card => {
            const filename = card.getAttribute('data-video-filename');
            if (!currentFilenames.has(filename)) {
                card.remove();
                this.favoritesCardsCache.delete(filename);
            }
        });

        // ✅ БАТЧИНГ DOM операций для минимизации reflow
        const cardsToAdd = [];
        
        favoriteVideos.forEach((video, index) => {
            let card = this.favoritesCardsCache.get(video.filename);
            
            if (!card) {
                card = this.createFavoriteCard(video);
                this.favoritesCardsCache.set(video.filename, card);
                console.log('➕ Создана карточка:', video.filename);
                cardsToAdd.push({ card, index });
            } else {
                // Проверяем позицию
                const currentIndex = Array.from(this.favoritesList.children).indexOf(card);
                if (currentIndex !== index) {
                    cardsToAdd.push({ card, index });
                }
            }
        });

        // ✅ Применяем все изменения за один раз
        if (cardsToAdd.length > 0) {
            const fragment = document.createDocumentFragment();
            const orderedCards = favoriteVideos.map(video => 
                this.favoritesCardsCache.get(video.filename)
            );
            
            this.favoritesList.innerHTML = '';
            orderedCards.forEach(card => fragment.appendChild(card));
            this.favoritesList.appendChild(fragment);
            
            console.log(`🔄 Переупорядочено ${cardsToAdd.length} карточек`);
        }
    }

    /**
     * Создает карточку избранного видео
     */
    createFavoriteCard(video) {
        const card = document.createElement('div');
        card.className = 'favorite-card';
        card.setAttribute('data-video-filename', video.filename);

        const thumbnail = this.createThumbnail(video);
        const info = this.createVideoInfo(video);
        const removeBtn = this.createRemoveButton(video);

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

        const thumbnailVideo = document.createElement('video');
        thumbnailVideo.src = videoSrc;
        thumbnailVideo.muted = true;
        thumbnailVideo.playsInline = true;
        thumbnailVideo.preload = 'metadata';
        thumbnailVideo.style.width = '100%';
        thumbnailVideo.style.height = '100%';
        thumbnailVideo.style.objectFit = 'cover';

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
    createRemoveButton(video) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'favorite-card-remove';
        removeBtn.innerHTML = '⋮';
        removeBtn.setAttribute('aria-label', 'Удалить из избранного');
        removeBtn.setAttribute('title', 'Удалить из избранного');

        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.handleRemoveClick(video);
        });

        return removeBtn;
    }

    /**
     * Обработчик удаления видео из избранного
     * ✅ ИСПРАВЛЕНО: Работает только с внутренним состоянием
     */
    async handleRemoveClick(video) {
        // ✅ Удаляем из внутреннего состояния
        this.removeFromFavorites(video.filename);

        // Обновляем UI кнопок
        if (this.onUpdateButtonStates) {
            this.onUpdateButtonStates(video.filename);
        }

        // Отправляем на сервер
        const success = await this.telegramAuth.toggleFavorite(video.filename);
        
        if (!success) {
            // ✅ Откатываем изменения
            this.addToFavorites(video.filename);
            
            if (this.onUpdateButtonStates) {
                this.onUpdateButtonStates(video.filename);
            }
            
            console.error('❌ Не удалось удалить из избранного на сервере');
        } else {
            // Анимация удаления
            const card = this.favoritesCardsCache.get(video.filename);
            if (card) {
                card.style.opacity = '0';
                setTimeout(async () => {
                    await this.updateFavoritesList();
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
            if (this.onSwitchToMainTab) {
                this.onSwitchToMainTab();
            }

            const currentOrder = this.videoManager.getVideoOrder();
            const orderIndex = currentOrder.indexOf(videoIndex);
            
            if (orderIndex !== -1) {
                this.videoManager.setCurrentOrderIndex(orderIndex);
            } else {
                const newOrder = [videoIndex, ...currentOrder];
                this.videoManager.setVideoOrder(newOrder);
                this.videoManager.setCurrentOrderIndex(0);
            }

            if (this.onLoadVideo) {
                this.onLoadVideo().catch(err => 
                    console.error('❌ Ошибка loadVideo через карточку избранного:', err)
                );
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
