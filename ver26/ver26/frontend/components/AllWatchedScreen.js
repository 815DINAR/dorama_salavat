export default class AllWatchedScreen {
    constructor(sessionPoolManager, onRestart) {
        this.sessionPoolManager = sessionPoolManager;
        this.onRestart = onRestart;
        this.container = null;
        this.restartButton = null; // Сохраняем ссылку на кнопку
        this.handleRestartBound = null; // Сохраняем bound функцию
        
        console.log('✅ AllWatchedScreen инициализирован');
    }

    create() {
        // Предотвращаем создание дубликатов
        if (this.container) {
            console.warn('⚠️ Контейнер уже создан');
            return this.container;
        }

        this.container = document.createElement('div');
        this.container.className = 'all-watched-screen';
        this.container.innerHTML = `
            <div class="all-watched-content">
                <div class="celebration-icon">🎉</div>
                <h2 class="all-watched-title">Поздравляем!</h2>
                <p class="all-watched-text">Вы просмотрели все доступные видео</p>
                <button class="restart-button" id="restartButton">Начать заново</button>
            </div>
        `;

        // Добавляем стили
        this.addStyles();

        // Сохраняем ссылки и используем bound метод
        this.restartButton = this.container.querySelector('#restartButton');
        this.handleRestartBound = this.handleRestart.bind(this);
        
        if (this.restartButton) {
            this.restartButton.addEventListener('click', this.handleRestartBound);
        }

        return this.container;
    }

    addStyles() {
        const styleId = 'all-watched-screen-styles';
        
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .all-watched-screen {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100;
                animation: fadeIn 0.5s ease-out;
            }

            .all-watched-content {
                text-align: center;
                padding: 40px 20px;
                max-width: 400px;
            }

            .celebration-icon {
                font-size: 120px;
                margin-bottom: 30px;
                animation: bounce 1s infinite;
            }

            .all-watched-title {
                color: #ffffff;
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 16px;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }

            .all-watched-text {
                color: rgba(255, 255, 255, 0.9);
                font-size: 18px;
                line-height: 1.6;
                margin-bottom: 40px;
                text-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
            }

            .restart-button {
                background: #ffffff;
                color: #667eea;
                border: none;
                border-radius: 30px;
                padding: 16px 48px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
                -webkit-tap-highlight-color: transparent;
            }

            .restart-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
            }

            .restart-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }

            @keyframes bounce {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-20px);
                }
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            @media (max-width: 600px) {
                .celebration-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                }

                .all-watched-title {
                    font-size: 28px;
                }

                .all-watched-text {
                    font-size: 16px;
                    margin-bottom: 30px;
                }

                .restart-button {
                    padding: 14px 40px;
                    font-size: 16px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    async handleRestart() {
        const confirmed = confirm('Вы уверены, что хотите сбросить историю просмотров и начать заново?');
        
        if (!confirmed) {
            return;
        }

        console.log('🔄 Сброс истории просмотров...');

        try {
            const success = await this.sessionPoolManager.resetHistory();
            
            if (success) {
                console.log('✅ История сброшена, перезагружаем...');
                
                // Вызываем колбэк для перезапуска приложения
                if (this.onRestart) {
                    await this.onRestart();
                } else {
                    // Fallback - перезагрузка страницы
                    window.location.reload();
                }
            } else {
                alert('Ошибка при сбросе истории. Попробуйте позже.');
            }
        } catch (error) {
            console.error('❌ Ошибка сброса истории:', error);
            alert('Ошибка при сбросе истории. Попробуйте позже.');
        }
    }

    show(parentElement) {
        if (!this.container) {
            this.container = this.create();
        }

        if (parentElement && !this.container.parentElement) {
            parentElement.appendChild(this.container);
            console.log('✅ Экран "Все просмотрено" показан');
        }
    }

    hide() {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
            console.log('✅ Экран "Все просмотрено" скрыт');
        }
    }

    // Добавлена правильная очистка
    destroy() {
        console.log('🧹 Очистка AllWatchedScreen...');
        
        // Удаляем event listener
        if (this.restartButton && this.handleRestartBound) {
            this.restartButton.removeEventListener('click', this.handleRestartBound);
            console.log('✅ Event listener удален');
        }
        
        // Удаляем из DOM
        this.hide();
        
        // Очищаем ссылки
        this.restartButton = null;
        this.handleRestartBound = null;
        this.container = null;
        
        console.log('✅ AllWatchedScreen очищен');
    }

    // Метод для повторного использования без пересоздания
    reset() {
        if (!this.container) {
            console.warn('⚠️ Контейнер не создан, создаём новый');
            this.create();
        }
    }
}