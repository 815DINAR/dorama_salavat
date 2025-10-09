// telegram-auth.js v3.3 - Модуль авторизации с поддержкой прогресса просмотра

// НАСТРОЙКА ВРЕМЕНИ ПОКАЗА ЭКРАНА ЗАГРУЗКИ (в миллисекундах)
// Измените это значение для изменения времени показа splash screen
const LOADING_SCREEN_DURATION = 1000; // 2 секунды (как у старых пользователей)

class TelegramAuth {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.user = null;
        this.sessionId = null;
        this.lastActivityTime = Date.now();
        this.activityInterval = null;
        this.isAuthorized = false;
    }

    // Инициализация авторизации
    async init() {
        console.log('🔐 Инициализация Telegram авторизации v3.4...');
        console.log(`⏱️ Время показа загрузочного экрана: ${LOADING_SCREEN_DURATION}мс`);
        
        if (!this.tg) {
            console.error('❌ Telegram WebApp API не доступен');
            // В режиме разработки можем продолжить без авторизации
            if (this.isDevelopment()) {
                console.log('🔧 Режим разработки - продолжаем без авторизации');
                this.user = this.getMockUserData();
                this.isAuthorized = true;
                this.updateUI();
                return true;
            }
            this.showError('Приложение должно быть открыто через Telegram');
            return false;
        }

        // Расширяем приложение на весь экран
        this.tg.ready();
        this.tg.expand();
        
        // Настройка внешнего вида
        this.setupAppearance();

        // Получаем данные пользователя
        const initData = this.tg.initData;
        const initDataUnsafe = this.tg.initDataUnsafe;
        
        console.log('📱 Telegram WebApp готов');
        console.log('👤 InitDataUnsafe:', initDataUnsafe);

        if (initDataUnsafe.user) {
            this.user = {
                id: initDataUnsafe.user.id,
                username: initDataUnsafe.user.username || `user_${initDataUnsafe.user.id}`,
                first_name: initDataUnsafe.user.first_name || '',
                last_name: initDataUnsafe.user.last_name || '',
                language_code: initDataUnsafe.user.language_code || 'en',
                is_premium: initDataUnsafe.user.is_premium || false
            };

            console.log('✅ Данные пользователя получены:', this.user);

            // Авторизуем пользователя на сервере
            const authResult = await this.authorizeOnServer();
            
            if (authResult) {
                this.isAuthorized = true;
                this.startActivityTracking();
                
                // Небольшая задержка для плавности анимации
                setTimeout(() => {
                    this.updateUI();
                }, 1500); // 1.5 секунды - как у старых пользователей
                
                return true;
            }
        } else {
            console.error('❌ Не удалось получить данные пользователя');
            this.showError('Не удалось получить данные пользователя');
        }

        return false;
    }
    
    // Настройка внешнего вида приложения
    setupAppearance() {
        if (!this.tg) return;

        // Устанавливаем цвета
        this.tg.setHeaderColor('#1a1a1a');
        this.tg.setBackgroundColor('#000000');

        // Включаем кнопку закрытия
        this.tg.enableClosingConfirmation();

        console.log('🎨 Внешний вид настроен');
    }

    // Авторизация на сервере
    async authorizeOnServer() {
        try {
            const response = await fetch('auth/telegram_auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'login',
                    user: this.user,
                    init_data: this.tg.initData // Для проверки подписи на сервере
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('🔑 Результат авторизации:', result);

            if (result.success) {
                this.sessionId = result.session_id;
                console.log('✅ Авторизация успешна!');
                return true;
            } else {
                throw new Error(result.message || 'Ошибка авторизации');
            }
        } catch (error) {
            console.error('❌ Ошибка авторизации:', error);
            this.showError(`Ошибка авторизации: ${error.message}`);
            return false;
        }
    }

    // Отслеживание активности пользователя
    startActivityTracking() {
        // Обновляем активность каждые 30 секунд
        this.activityInterval = setInterval(() => {
            this.updateActivity();
        }, 10000);

        // Отслеживаем события активности
        ['click', 'touchstart', 'scroll', 'keypress'].forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivityTime = Date.now();
            });
        });

        // Обработчик закрытия приложения
        window.addEventListener('beforeunload', () => {
            this.logout();
        });

        // Для Telegram Web App
        if (this.tg) {
            this.tg.onEvent('viewportChanged', () => {
                this.lastActivityTime = Date.now();
            });

            // Обработчик кнопки "Назад"
            this.tg.BackButton.onClick(() => {
                this.logout();
            });
        }
    }

    // Обновление активности на сервере
    async updateActivity() {
        if (!this.sessionId) return;

        try {
            const response = await fetch('auth/update_activity.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    session_id: this.sessionId,
                    last_activity: new Date().toISOString()
                })
            });

            const result = await response.json();
            console.log('📊 Активность обновлена:', result);
        } catch (error) {
            console.error('❌ Ошибка обновления активности:', error);
        }
    }

    // Выход/завершение сессии
    async logout() {
        if (!this.sessionId) return;

        try {
            const response = await fetch('auth/telegram_auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'logout',
                    user_id: this.user.id,
                    session_id: this.sessionId
                })
            });

            const result = await response.json();
            console.log('👋 Сессия завершена:', result);
        } catch (error) {
            console.error('❌ Ошибка завершения сессии:', error);
        }

        if (this.activityInterval) {
            clearInterval(this.activityInterval);
        }
    }

    // Получение данных пользователя с сервера
    async getUserData() {
        if (!this.user) return null;

        try {
            const response = await fetch(`auth/get_user_data.php?cachebuster=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify({
                    user_id: this.user.id
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('📊 Получены свежие данные пользователя');
                return result.user_data;
            }
        } catch (error) {
            console.error('❌ Ошибка получения данных пользователя:', error);
        }

        return null;
    }

    // Сохранение избранного
    async toggleFavorite(videoId) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_user_data.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'toggle_favorite',
                    video_id: videoId
                })
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка обновления избранного:', error);
            return false;
        }
    }
// ⬇️ ДОБАВЬТЕ МЕТОД СЮДА, ПЕРЕД ЗАКРЫВАЮЩЕЙ СКОБКОЙ КЛАССА ⬇️
    getUserId() {
        return this.userId || '';
    }
    // Обновление реакций (лайк/дизлайк)
    async updateReaction(action, videoId) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_user_data.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: action,
                    video_id: videoId
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ Реакция обновлена:', action, videoId);
            }
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка обновления реакции:', error);
            return false;
        }
    }

    // Добавление видео в просмотренные
    async addWatchedVideo(videoId, duration = 5) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_watch_progress.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'add_watched',
                    video_id: videoId,
                    duration: duration
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ Видео добавлено в просмотренные:', videoId);
            }
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка добавления в просмотренные:', error);
            return false;
        }
    }

    // Обновление последнего просмотренного видео
    async updateLastVideo(videoId) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_watch_progress.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'update_last_video',
                    video_id: videoId
                })
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка обновления последнего видео:', error);
            return false;
        }
    }

    // Сохранение порядка текущей сессии
    async saveSessionOrder(order) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_watch_progress.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'save_session_order',
                    order: order
                })
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка сохранения порядка сессии:', error);
            return false;
        }
    }

    // Сброс прогресса просмотра
    async resetWatchProgress() {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_watch_progress.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'reset_progress'
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('🔄 Прогресс просмотра сброшен');
            }
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка сброса прогресса:', error);
            return false;
        }
    }

    // Очистка удаленных видео из прогресса
    async cleanDeletedVideos(existingVideos) {
        if (!this.user) return false;

        try {
            const response = await fetch('auth/update_watch_progress.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.user.id,
                    action: 'clean_deleted_videos',
                    existing_videos: existingVideos
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('🧹 Удаленные видео очищены из прогресса');
            }
            return result.success;
        } catch (error) {
            console.error('❌ Ошибка очистки удаленных видео:', error);
            return false;
        }
    }

    // Обновление UI после авторизации
    updateUI() {
        const loadingScreen = document.querySelector('.loading-screen');
        const videoContainer = document.getElementById('videoContainer');

        if (loadingScreen) {
            // Плавное исчезновение загрузочного экрана
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }

        if (videoContainer) {
            videoContainer.style.display = 'block';
            videoContainer.style.opacity = '1';
        }
        
        console.log('🎨 UI обновлен, загрузочный экран скрыт');
    }

    // Показ сообщений
    showError(message) {
        console.error('❌ Ошибка:', message);
        // Можно добавить отображение ошибки в UI
    }

    showSuccess(message) {
        console.log('✅ Успех:', message);
    }

    // Проверка, авторизован ли пользователь
    isUserAuthorized() {
        return this.isAuthorized && this.user !== null;
    }

    // Получение ID пользователя
    getUserId() {
        return this.user?.id || null;
    }

    // Получение имени пользователя
    getUsername() {
        return this.user?.username || null;
    }
    
    // Проверка режима разработки
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('.local');
    }

    // Тестовые данные для разработки
    getMockUserData() {
        return {
            id: 'test_user_123',
            username: 'Test User',
            first_name: 'Test',
            last_name: 'User',
            language_code: 'ru',
            is_premium: false
        };
    }
    
    // Показ уведомления
    showNotification(message) {
        if (this.tg?.showPopup) {
            this.tg.showPopup({
                title: 'DoramaShorts',
                message: message,
                buttons: [{
                    type: 'ok'
                }]
            });
        } else {
            alert(message);
        }
    }

    // Вибрация (для мобильных устройств)
    hapticFeedback(type = 'light') {
        if (this.tg?.HapticFeedback) {
            switch(type) {
                case 'light':
                    this.tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.tg.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    this.tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'warning':
                    this.tg.HapticFeedback.notificationOccurred('warning');
                    break;
                case 'error':
                    this.tg.HapticFeedback.notificationOccurred('error');
                    break;
            }
        }
    }
}

// Создаем глобальный экземпляр
window.telegramAuth = new TelegramAuth();

console.log('✅ Модуль telegram-auth.js v3.3 загружен');