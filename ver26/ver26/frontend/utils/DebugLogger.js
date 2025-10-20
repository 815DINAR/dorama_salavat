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
}
