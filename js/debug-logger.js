/**
 * Debug Logger для мобильных устройств
 * Показывает логи прямо на странице для удобной отладки на мобильных устройствах
 */

class DebugLogger {
    constructor(options = {}) {
        this.enabled = options.enabled !== false; // По умолчанию включен
        this.maxLogs = options.maxLogs || 50; // Максимум логов в контейнере
        this.showOnMobile = options.showOnMobile !== false; // Показывать на мобильных
        this.logs = [];
        this.container = null;
        this.toggleButton = null;
        this.isVisible = false;
        
        // Определяем, мобильное ли устройство
        this.isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (this.enabled && (this.showOnMobile || !this.isMobile)) {
            this.init();
        }
    }
    
    init() {
        // Создаем контейнер для логов
        this.createContainer();
        
        // Перехватываем console.log, console.error, console.warn
        this.interceptConsole();
        
        // Добавляем кнопку переключения
        this.createToggleButton();
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'debug-logger';
        this.container.innerHTML = `
            <div class="debug-logger-header">
                <h3>🐛 Логи отладки</h3>
                <button class="debug-logger-clear" aria-label="Очистить логи">✕ Очистить</button>
                <button class="debug-logger-toggle" aria-label="Свернуть">▼</button>
            </div>
            <div class="debug-logger-content"></div>
        `;
        
        // Стили через inline для гарантии работы
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 90%;
            max-width: 500px;
            max-height: 400px;
            background: var(--card-bg, #ffffff);
            border: 2px solid var(--border-color, #e2d5d5);
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: ${this.isMobile ? 'block' : 'none'};
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow: hidden;
        `;
        
        // Стили для заголовка
        const header = this.container.querySelector('.debug-logger-header');
        header.style.cssText = `
            background: var(--primary-color, #6366f1);
            color: white;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        `;
        
        header.querySelector('h3').style.cssText = `
            margin: 0;
            font-size: 14px;
            font-weight: 600;
        `;
        
        // Стили для кнопок
        const buttons = this.container.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.cssText = `
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-left: 5px;
            `;
        });
        
        // Стили для контента
        const content = this.container.querySelector('.debug-logger-content');
        content.style.cssText = `
            max-height: 350px;
            overflow-y: auto;
            padding: 10px;
            background: var(--bg-primary, #ffffff);
        `;
        
        // Обработчики
        this.container.querySelector('.debug-logger-clear').addEventListener('click', () => {
            this.clear();
        });
        
        this.container.querySelector('.debug-logger-toggle').addEventListener('click', () => {
            this.toggle();
        });
        
        // Добавляем на страницу
        document.body.appendChild(this.container);
        
        // Показываем на мобильных по умолчанию
        if (this.isMobile) {
            this.isVisible = true;
        }
    }
    
    createToggleButton() {
        this.toggleButton = document.createElement('button');
        this.toggleButton.innerHTML = '🐛';
        this.toggleButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: ${this.isMobile ? '20px' : '20px'};
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary-color, #6366f1);
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            display: ${this.isMobile ? 'none' : 'block'};
        `;
        
        this.toggleButton.addEventListener('click', () => {
            this.container.style.display = this.isVisible ? 'none' : 'block';
            this.isVisible = !this.isVisible;
        });
        
        document.body.appendChild(this.toggleButton);
    }
    
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        const self = this;
        
        console.log = function(...args) {
            originalLog.apply(console, args);
            self.addLog('log', args);
        };
        
        console.error = function(...args) {
            originalError.apply(console, args);
            self.addLog('error', args);
        };
        
        console.warn = function(...args) {
            originalWarn.apply(console, args);
            self.addLog('warn', args);
        };
    }
    
    addLog(type, args) {
        if (!this.container) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const logEntry = {
            type,
            message,
            timestamp
        };
        
        this.logs.push(logEntry);
        
        // Ограничиваем количество логов
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.render();
    }
    
    render() {
        if (!this.container) return;
        
        const content = this.container.querySelector('.debug-logger-content');
        const typeColors = {
            log: '#333',
            error: '#ef4444',
            warn: '#f59e0b'
        };
        
        content.innerHTML = this.logs.map(log => {
            const color = typeColors[log.type] || '#333';
            return `
                <div style="
                    padding: 5px 0;
                    border-bottom: 1px solid var(--border-color, #e2d5d5);
                    color: ${color};
                ">
                    <span style="opacity: 0.6; font-size: 10px;">[${log.timestamp}]</span>
                    <span style="font-weight: 600; margin-left: 5px;">${log.type.toUpperCase()}:</span>
                    <div style="margin-left: 10px; margin-top: 3px; white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(log.message)}</div>
                </div>
            `;
        }).join('');
        
        // Скроллим вниз
        content.scrollTop = content.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    clear() {
        this.logs = [];
        this.render();
    }
    
    toggle() {
        const content = this.container.querySelector('.debug-logger-content');
        const toggleBtn = this.container.querySelector('.debug-logger-toggle');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleBtn.textContent = '▼';
            this.isVisible = true;
        } else {
            content.style.display = 'none';
            toggleBtn.textContent = '▲';
            this.isVisible = false;
        }
    }
}

// Автоматически инициализируем на мобильных или если в URL есть ?debug
if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const debugEnabled = urlParams.get('debug') !== null || /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    
    if (debugEnabled) {
        window.debugLogger = new DebugLogger({
            enabled: true,
            showOnMobile: true
        });
    }
}
