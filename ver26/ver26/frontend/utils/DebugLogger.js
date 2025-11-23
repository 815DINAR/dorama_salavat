export default class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.isVisible = false;
        this.setupConsoleInterception();
        this.setupDebugUI();
    }

    setupConsoleInterception() {
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };

        console.log = (...args) => {
            this.addLog('log', args);
            originalConsole.log.apply(console, args);
        };

        console.error = (...args) => {
            this.addLog('error', args);
            originalConsole.error.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalConsole.warn.apply(console, args);
        };

        console.info = (...args) => {
            this.addLog('info', args);
            originalConsole.info.apply(console, args);
        };
    }

    addLog(type, args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        this.logs.push({
            type,
            message,
            timestamp
        });

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        if (this.isVisible) {
            this.updateDebugUI();
        }
    }

    setupDebugUI() {
        const debugButton = document.getElementById('debugButton');
        const debugConsole = document.getElementById('debugConsole');
        const closeDebug = document.getElementById('closeDebug');
        const clearLogs = document.getElementById('clearLogs');

        if (debugButton) {
            debugButton.addEventListener('click', () => {
                this.toggleDebugConsole();
            });
        }

        if (closeDebug) {
            closeDebug.addEventListener('click', () => {
                this.hideDebugConsole();
            });
        }

        if (clearLogs) {
            clearLogs.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        // ✅ ДОБАВЛЯЕМ КНОПКУ ЭКСПОРТА
        const exportButton = document.getElementById('exportLogs');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.sendLogsToTelegram();
            });
        }
    }

    toggleDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            if (this.isVisible) {
                this.hideDebugConsole();
            } else {
                this.showDebugConsole();
            }
        }
    }

    showDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            debugConsole.classList.add('show');
            this.isVisible = true;
            this.updateDebugUI();
        }
    }

    hideDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            debugConsole.classList.remove('show');
            this.isVisible = false;
        }
    }

    updateDebugUI() {
        const debugLogs = document.getElementById('debugLogs');
        if (debugLogs) {
            debugLogs.innerHTML = this.logs.map(log => `
                <div class="debug-log-entry ${log.type}">
                    <span class="debug-timestamp">${log.timestamp}</span>
                    <span class="debug-message">${log.message}</span>
                </div>
            `).join('');

            debugLogs.scrollTop = debugLogs.scrollHeight;
        }
    }

    clearLogs() {
        this.logs = [];
        this.updateDebugUI();
    }

    // ЭКСПОРТ ЛОГОВ
    exportLogs() {
        if (this.logs.length === 0) {
            return 'No logs available';
        }
        
        return this.logs.map(log => {
            return `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`;
        }).join('\n');
    }

    // ОТПРАВКА В TELEGRAM
    async sendLogsToTelegram() {
        try {
            // Получаем userId из Telegram
            const userId = window.telegramAuth?.getUserId();
            
            if (!userId) {
                throw new Error('User ID not found');
            }
            
            // Собираем логи
            const logsText = this.exportLogs();
            
            if (logsText === 'No logs available') {
                alert('⚠️ Нет логов для экспорта');
                return;
            }
            
            // Показываем индикатор загрузки
            const exportBtn = document.getElementById('exportLogs');
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.textContent = '⏳ Отправка...';
            }
            
            // Получаем текущую дату и время
            const now = new Date();
            const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
            
            // Отправляем на сервер
            const response = await fetch('api/send-logs-to-telegram.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    logs: logsText,
                    timestamp: timestamp
                })
            });
            
            const result = await response.json();
            
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = '📥 Экспорт логов';
            }
            
            if (result.success) {
                alert('✅ Логи отправлены в Telegram!');
                console.log('✅ Logs exported successfully:', result);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
            
        } catch (error) {
            console.error('❌ Error exporting logs:', error);
            alert('❌ Ошибка отправки логов: ' + error.message);
            
            const exportBtn = document.getElementById('exportLogs');
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = '📥 Экспорт логов';
            }
        }
    }
}
